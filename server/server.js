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
import fs from 'node:fs/promises';

// ─── Firebase ──────────────────────────────────
const creds = JSON.parse(process.env.FIREBASE_CREDENTIALS);
initializeApp({ credential: cert(creds) });
const firestore = getFirestore();

// ─── Express ───────────────────────────────────
const app = express();
app.set('trust proxy', true); // correct protocol/host behind proxies
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

// Weekly at Sunday 16:00 UTC (Mon 00:00 PH)
cron.schedule('0 16 * * 0', archiveNow);

// ─── Helpers ───────────────────────────────────
async function getPostById(id) {
  const live = await firestore.collection('posts').doc(id).get();
  if (live.exists) return live.data();

  const archivesSnap = await firestore.collection('archives').get();
  for (const doc of archivesSnap.docs) {
    const data = doc.data();
    const hit = (data.posts || []).find(p => p.id === id);
    if (hit) return hit;
  }
  return null;
}

const CRAWLER_UA = /(facebookexternalhit|Facebot|Twitterbot|Slackbot|LinkedInBot|Discordbot|TelegramBot|Pinterest|Googlebot|bingbot)/i;
function isCrawler(req) {
  return CRAWLER_UA.test(req.get('user-agent') || '');
}

// OG font loader (local TTFs; avoids remote/WOFF issues)
const fontCache = { ready: false };
async function loadOgFonts() {
  if (fontCache.ready) return fontCache;
  const interRegUrl = new URL('./fonts/Inter-Regular.ttf', import.meta.url);
  const interBoldUrl = new URL('./fonts/Inter-Bold.ttf', import.meta.url);
  const emojiUrl    = new URL('./fonts/NotoEmoji-Regular.ttf', import.meta.url); // optional

  const [interReg, interBold, emoji] = await Promise.all([
    fs.readFile(interRegUrl),
    fs.readFile(interBoldUrl),
    fs.readFile(emojiUrl).catch(() => null)
  ]);

  fontCache.interReg = interReg;
  fontCache.interBold = interBold;
  fontCache.emoji = emoji; // may be null
  fontCache.ready = true;
  return fontCache;
}

// ─── API Routes ────────────────────────────────
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

// ─── OG Image: /og/:id.png ─────────────────────
app.get('/og/:id.png', async (req, res) => {
  try {
    const { default: satori } = await import('satori').catch(() => ({}));
    const { Resvg } = await import('@resvg/resvg-js').catch(() => ({}));
    if (!satori || !Resvg) {
      console.warn('OG: satori/resvg not available; falling back.');
      return res.redirect(302, 'https://scribsy.io/og-image.png');
    }

    const post = await getPostById(req.params.id);
    if (!post) return res.status(404).send('Not found');

    const fonts = await loadOgFonts();

    const text = (post.text || 'Scribsy Post').toString();
    const name = (post.name || 'Anonymous').toString();
    const mood = (post.mood || 'default').toString();

    // Simple, legible card
    const tree = {
      type: 'div',
      props: {
        style: {
          width: 1200,
          height: 630,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(180deg,#0b1023,#1b2735 60%,#090a0f)',
          color: '#fff',
          padding: 64
        },
        children: [
          {
            type: 'div',
            props: {
              style: { fontSize: 54, lineHeight: 1.2, whiteSpace: 'pre-wrap' },
              children: `“${text}”`
            }
          },
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 28
              },
              children: [
                `by ${name} • ${mood}`,
                { type: 'div', props: { style: { fontSize: 24, opacity: .85 }, children: 'scribsy.io' } }
              ]
            }
          }
        ]
      }
    };

    const svg = await satori(tree, {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Inter', data: fonts.interReg, weight: 400, style: 'normal' },
        { name: 'Inter', data: fonts.interBold, weight: 700, style: 'normal' },
        ...(fonts.emoji ? [{ name: 'Noto Emoji', data: fonts.emoji, weight: 400, style: 'normal' }] : [])
      ]
    });

    const png = new Resvg(svg).render().asPng();
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=86400');
    return res.end(png);
  } catch (err) {
    console.error('OG generation failed:', err);
    return res.redirect(302, 'https://scribsy.io/og-image.png');
  }
});

// ─── Share Page (bot-aware): /share/:id ─────────
// Bots get OG HTML (unique og:url + per-post image).
// Humans get 302 to homepage.
// Not indexed.
app.get('/share/:id', async (req, res) => {
  const id = req.params.id;
  const post = await getPostById(id);
  if (!post) return res.status(404).send('Not found');

  const escape = (s='') => String(s)
    .slice(0, 200)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');

  // Honor original host/proto when proxied by Netlify
  // (Netlify sets x-forwarded-host: scribsy.io, x-forwarded-proto: https)
  const fwdHost  = (req.headers['x-forwarded-host']  || '').split(',')[0].trim();
  const fwdProto = (req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const host     = fwdHost  || req.get('host');                 // scribsy.io if proxied, api.scribsy.io direct
  const proto    = fwdProto || req.protocol || 'https';

  const shareUrl = `${proto}://${host}${req.originalUrl}`;       // ← used for og:url (will be https://scribsy.io/share/:id)
  const ogImg    = `https://api.scribsy.io/og/${id}.png`;        // keep image on API domain
  const title    = 'Scribsy Post';
  const desc     = escape(post.text || 'Anonymous post');

  // Don’t let these pages be indexed; help caches split on UA/forwarded headers
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Vary', 'User-Agent, X-Forwarded-Host, X-Forwarded-Proto');
  res.setHeader('Cache-Control', 'no-cache');

  // Humans → homepage
  if (!isCrawler(req)) {
    return res.redirect(302, 'https://scribsy.io');
  }

  // Bots → OG HTML (no redirect)
  const html = `<!doctype html>
<html lang="en"><head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="robots" content="noindex, nofollow" />

  <!-- Open Graph -->
  <meta property="og:site_name" content="Scribsy" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${desc}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${shareUrl}" />
  <meta property="og:image" content="${ogImg}" />
  <meta property="og:image:secure_url" content="${ogImg}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${desc}" />
  <meta name="twitter:image" content="${ogImg}" />
</head>
<body><p>Scribsy</p></body></html>`;

  res.type('html').send(html);
});

// Back-compat: /p/:id → 301 /share/:id
app.get('/p/:id', (req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.redirect(301, `/share/${req.params.id}`);
});

app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🖥 API ready at http://localhost:${PORT}`));
