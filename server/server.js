// ─────────────────────────────────────────────
// Scribsy Server (Express + Firestore + Reactions + Token Auth + OG Share)
// ─────────────────────────────────────────────
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import rateLimit from 'express-rate-limit';
import { nanoid } from 'nanoid';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// --- Dynamic OG image deps ---
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
import path from 'node:path';

// ─── Firebase ──────────────────────────────────
const creds = JSON.parse(process.env.FIREBASE_CREDENTIALS);
initializeApp({ credential: cert(creds) });
const firestore = getFirestore();

// ─── Express ───────────────────────────────────
const app = express();
app.use(
  cors({
    origin: ['http://localhost:5173', 'https://scribsy.io', 'https://api.scribsy.io'],
  }),
);
app.use(express.json());

// ─── Rate limit: 20 posts / hour / IP ─────────
const postLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Too many posts from this IP. Please try again later.' },
});

// ─── Tiny in-memory token store (24h expiry) ───
const sessions = new Map(); // token -> expiry timestamp
function issueToken() {
  const token = nanoid();
  sessions.set(token, Date.now() + 24 * 60 * 60 * 1000);
  return token;
}
function isValidToken(t) {
  const exp = sessions.get(t);
  if (!exp) return false;
  if (Date.now() > exp) {
    sessions.delete(t);
    return false;
  }
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

  // if latest archive starts with today → skip
  const latest = await firestore.collection('archives').orderBy('date', 'desc').limit(1).get();
  if (latest.docs[0]?.data()?.date?.startsWith(today)) {
    console.log('⚠️ Already archived today. Skipping.');
    return;
  }

  const postsSnap = await firestore.collection('posts').get();
  if (postsSnap.empty) return;

  const posts = postsSnap.docs.map((d) => d.data());
  await firestore.collection('archives').add({ date: now.toISOString(), posts });

  const batch = firestore.batch();
  postsSnap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  console.log('📦 Archived posts for', today);
}

// Daily at 16:00 UTC (adjust if you want)
cron.schedule('0 16 * * 0', archiveNow);

// ─── Helpers for OG/permalinks ─────────────────
function getOrigin(req) {
  // Allows overriding from env when behind proxies/CDN
  return process.env.PUBLIC_API_ORIGIN || `${req.protocol}://${req.get('host')}`;
}

async function findPostById(id) {
  // find among current posts
  const postDoc = await firestore.collection('posts').doc(id).get();
  if (postDoc.exists) return postDoc.data();

  // otherwise scan archives
  const archivesSnap = await firestore.collection('archives').get();
  for (const doc of archivesSnap.docs) {
    const data = doc.data();
    const hit = (data.posts || []).find((p) => p.id === id);
    if (hit) return hit;
  }
  return null;
}

// Optional font for Satori (fallback to system if not found)
let fontData = null;
try {
  const candidates = [
    path.resolve('./public/HostGrotesk-SemiBold.ttf'),
    path.resolve('./HostGrotesk-SemiBold.ttf'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      fontData = fs.readFileSync(p);
      break;
    }
  }
} catch {
  fontData = null;
}

// ─── Routes ─────────────────────────────────────
app.get('/api/posts', async (_, res) => {
  const snap = await firestore.collection('posts').orderBy('createdAt', 'desc').get();
  const posts = snap.docs.map((doc) => ({ reactions: {}, ...doc.data() }));
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
    reactions: {},
  };
  await firestore.collection('posts').doc(post.id).set(post);
  res.status(201).json(post);
});

// 🔐 Admin login: compares with env ADMIN_PASSWORD, returns token
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'Missing password' });

  if (password === process.env.ADMIN_PASSWORD) {
    const token = issueToken();
    return res.json({ token });
  }
  return res.status(401).json({ error: 'Invalid password' });
});

// 🔐 Delete post (requires token)
app.delete('/api/posts/:id', requireAdmin, async (req, res) => {
  await firestore.collection('posts').doc(req.params.id).delete();
  res.json({ success: true });
});

// Reactions
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

// Archives (sorted, reactions normalized)
app.get('/api/archives', async (_, res) => {
  const snap = await firestore.collection('archives').orderBy('date', 'desc').get();
  const archives = snap.docs.map((d) => {
    const data = d.data();
    return { ...data, posts: (data.posts || []).map((p) => ({ reactions: {}, ...p })) };
  });
  res.json(archives);
});

// Manual archive
app.post('/api/archive-now', async (_, res) => {
  await archiveNow();
  res.json({ success: true });
});

// ─── Permalink (OG meta page) ───────────────────
// Social crawlers hit this and see OG tags; humans get redirected to app.
app.get('/p/:id', async (req, res) => {
  const post = await findPostById(req.params.id);
  if (!post) return res.status(404).send('Not found');

  const origin = getOrigin(req); // e.g., https://api.scribsy.io
  const title = post.text ? post.text.slice(0, 70) : 'Scribsy Post';
  const desc = `${post.name || 'Anonymous'} • ${post.mood || 'mood'}`;
  const ogUrl = `${origin}/og/${post.id}.png`;
  const canonical = `https://scribsy.io/p/${post.id}`;

  res
    .set('Content-Type', 'text/html')
    .send(`<!doctype html>
<html><head>
  <meta charset="utf-8">
  <title>${title}</title>
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${desc}">
  <meta property="og:image" content="${ogUrl}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:type" content="article">
  <meta name="twitter:card" content="summary_large_image">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <!-- Redirect humans to main app -->
  <meta http-equiv="refresh" content="0; url=https://scribsy.io/?post=${post.id}">
</head><body></body></html>`);
});

// ─── Dynamic OG image (1200x630 PNG) ───────────
app.get('/og/:id.png', async (req, res) => {
  try {
    const post = await findPostById(req.params.id);
    if (!post) return res.status(404).send('Not found');

    const W = 1200,
      H = 630;
    const text = post.text || '';
    const mood = post.mood || 'mood';
    const name = post.name || 'Anonymous';

    const svg = await satori(
      {
        type: 'div',
        props: {
          style: {
            width: W,
            height: H,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: 'linear-gradient(180deg,#0b1023,#1b2735 60%,#090a0f)',
          },
          children: [
            {
              type: 'div',
              props: {
                style: {
                  padding: '56px 72px',
                  color: '#fff',
                  fontSize: 56,
                  lineHeight: 1.25,
                  fontWeight: 700,
                },
                children: text ? `“${text}”` : 'Scribsy Post',
              },
            },
            {
              type: 'div',
              props: {
                style: {
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0 72px 56px 72px',
                  color: '#fff',
                  fontSize: 28,
                  opacity: 0.95,
                },
                children: [
                  { type: 'div', props: { children: `by ${name} • ${mood}` } },
                  { type: 'div', props: { style: { fontWeight: 800 }, children: 'scribsy.io' } },
                ],
              },
            },
          ],
        },
      },
      {
        width: W,
        height: H,
        fonts: fontData ? [{ name: 'HostGrotesk', data: fontData, weight: 600, style: 'normal' }] : [],
      },
    );

    const png = new Resvg(svg, {
      fitTo: { mode: 'width', value: W },
      background: 'transparent',
    })
      .render()
      .asPng();

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.end(png);
  } catch (e) {
    console.error(e);
    res.status(500).end();
  }
});

// ─── Health ─────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🖥 API ready at http://localhost:${PORT}`));
