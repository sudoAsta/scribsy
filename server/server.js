// ─────────────────────────────────────────────
// Scribsy Server (Express + Firestore + Reactions + Token Auth)
// ─────────────────────────────────────────────
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import rateLimit from 'express-rate-limit';
import { nanoid } from 'nanoid';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ─── Firebase ──────────────────────────────────
const creds = JSON.parse(process.env.FIREBASE_CREDENTIALS);
initializeApp({ credential: cert(creds) });
const firestore = getFirestore();

// ─── Express ───────────────────────────────────
const app = express();
app.use(cors({
  origin: ['http://localhost:5173', 'https://scribsy.io', 'https://api.scribsy.io']
}));
app.use(express.json());

// ─── Rate limit: 20 posts / hour / IP ─────────
const postLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Too many posts from this IP. Please try again later.' }
});

// ─── Tiny in‑memory token store (24h expiry) ───
const sessions = new Map();
function issueToken() {
  const token = nanoid();
  sessions.set(token, Date.now() + 24 * 60 * 60 * 1000);
  return token;
}
function isValidToken(t) {
  const exp = sessions.get(t);
  if (!exp) return false;
  if (Date.now() > exp) { sessions.delete(t); return false; }
  return true;
}
function requireAdmin(req, res, next) {
  const token = req.header('x-auth-token');
  if (!token || !isValidToken(token)) return res.status(403).json({ error: 'Forbidden' });
  next();
}

// ─── Archive Helper: one batch per calendar day ─
async function archiveNow() {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  const latest = await firestore.collection('archives').orderBy('date', 'desc').limit(1).get();
  if (latest.docs[0]?.data()?.date?.startsWith(today)) {
    console.log('⚠️ Already archived today. Skipping.');
    return;
  }

  const postsSnap = await firestore.collection('posts').get();
  if (postsSnap.empty) return;

  const posts = postsSnap.docs.map(d => d.data());
  await firestore.collection('archives').add({ date: now.toISOString(), posts });

  const batch = firestore.batch();
  postsSnap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  console.log('📦 Archived posts for', today);
}

cron.schedule('0 16 * * 0', archiveNow);

// ─── Routes ─────────────────────────────────────
app.get('/api/posts', async (_, res) => {
  const snap = await firestore.collection('posts').orderBy('createdAt', 'desc').get();
  const posts = snap.docs.map(doc => ({ reactions: {}, ...doc.data() }));
  res.json(posts);
});

app.post('/api/posts', postLimiter, async (req, res) => {
  const { type, text, image, name, mood } = req.body || {};
  if (!type || (!text && !image)) return res.status(400).json({ error: 'Missing post data' });

  const post = {
    id: nanoid(),
    type,
    text: text || null,
    image: image || null,
    name: name || 'Anonymous',
    mood: mood || 'default',
    createdAt: Date.now(),
    reactions: {}
  };
  await firestore.collection('posts').doc(post.id).set(post);
  res.status(201).json(post);
});

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'Missing password' });

  if (password === process.env.ADMIN_PASSWORD) {
    const token = issueToken();
    return res.json({ token });
  }
  return res.status(401).json({ error: 'Invalid password' });
});

app.delete('/api/posts/:id', requireAdmin, async (req, res) => {
  await firestore.collection('posts').doc(req.params.id).delete();
  res.json({ success: true });
});

app.post('/api/posts/:id/react', async (req, res) => {
  const { emoji } = req.body || {};
  const { id } = req.params;
  if (!emoji || typeof emoji !== 'string') return res.status(400).json({ error: 'Invalid emoji' });

  const ref = firestore.collection('posts').doc(id);
  const doc = await ref.get();
  if (!doc.exists) return res.status(404).json({ error: 'Post not found' });

  const data = doc.data();
  data.reactions ||= {};
  data.reactions[emoji] = (data.reactions[emoji] || 0) + 1;
  await ref.set(data);
  res.json({ success: true, reactions: data.reactions });
});

app.get('/api/archives', async (_, res) => {
  const snap = await firestore.collection('archives').orderBy('date', 'desc').get();
  const archives = snap.docs.map(d => {
    const data = d.data();
    return { ...data, posts: (data.posts || []).map(p => ({ reactions: {}, ...p })) };
  });
  res.json(archives);
});

app.post('/api/archive-now', async (_, res) => {
  await archiveNow();
  res.json({ success: true });
});

// ─── OG Image route with dynamic import fallback ───────
app.get('/og/:id.png', async (req, res) => {
  try {
    const { default: satori } = await import('satori').catch(() => ({}));
    const { Resvg } = await import('@resvg/resvg-js').catch(() => ({}));

    if (!satori || !Resvg) {
      console.warn('OG image libraries not available, using fallback.');
      return res.redirect(302, 'https://scribsy.io/og-image.png');
    }

    const id = req.params.id;
    let post;

    // Try fetching post from live posts
    const live = await firestore.collection('posts').doc(id).get();
    if (live.exists) {
      post = live.data();
    } else {
      // Try archives
      const archivesSnap = await firestore.collection('archives').get();
      for (const doc of archivesSnap.docs) {
        const data = doc.data();
        const hit = (data.posts || []).find(p => p.id === id);
        if (hit) { post = hit; break; }
      }
    }

    if (!post) return res.status(404).send('Not found');

    const text = post.text || 'Scribsy Post';
    const name = post.name || 'Anonymous';
    const mood = post.mood || 'default';

    const svg = await satori(
      {
        type: 'div',
        props: {
          style: {
            width: 1200,
            height: 630,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            background: 'linear-gradient(180deg,#0b1023,#1b2735 60%,#090a0f)',
            color: 'white',
            fontSize: 48,
            textAlign: 'center',
            padding: '40px'
          },
          children: [
            text ? `“${text}”` : 'Scribsy Post',
            `by ${name} • ${mood}`
          ]
        }
      },
      { width: 1200, height: 630 }
    );

    const png = new Resvg(svg).render().asPng();
    res.setHeader('Content-Type', 'image/png');
    res.end(png);
  } catch (err) {
    console.error('OG generation failed:', err);
    res.redirect(302, 'https://scribsy.io/og-image.png');
  }
});

// ─── Per-post HTML route with OG tags ───────
app.get('/p/:id', async (req, res) => {
  const id = req.params.id;
  let post;

  const live = await firestore.collection('posts').doc(id).get();
  if (live.exists) {
    post = live.data();
  } else {
    const archivesSnap = await firestore.collection('archives').get();
    for (const doc of archivesSnap.docs) {
      const data = doc.data();
      const hit = (data.posts || []).find(p => p.id === id);
      if (hit) { post = hit; break; }
    }
  }

  if (!post) return res.status(404).send('Not found');

  const ogUrl = `https://api.scribsy.io/og/${id}.png`;
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scribsy Post</title>
  <meta property="og:title" content="Scribsy Post" />
  <meta property="og:description" content="${post.text || 'Anonymous post'}" />
  <meta property="og:image" content="${ogUrl}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="https://scribsy.io/p/${id}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Scribsy Post" />
  <meta name="twitter:description" content="${post.text || 'Anonymous post'}" />
  <meta name="twitter:image" content="${ogUrl}" />
</head>s
<body>
  <p>Redirecting… <a href="https://scribsy.io">Go to Scribsy</a></p>
  <script>window.location.href='https://scribsy.io';</script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🖥 API ready at http://localhost:${PORT}`));
