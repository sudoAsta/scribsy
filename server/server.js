// ─────────────────────────────────────────────
// Scribsy Server (Express + LowDB + Rate Limit + Admin Auth)
// ─────────────────────────────────────────────

import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { nanoid } from 'nanoid';
import rateLimit from 'express-rate-limit';

const app = express();

// ─── Middleware ────────────────────────────────
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://scribsy.io',
    'https://api.scribsy.io'
  ]
}));
app.use(express.json());

// ─── Rate Limiting: 20 posts per hour per IP ─────
const postLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: { error: 'Too many posts from this IP. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// ─── DB Setup ───────────────────────────────────
const adapter = new JSONFile('db.json');
const db = new Low(adapter, { posts: [], archives: [] });
await db.read();

// ─── Session Store ──────────────────────────────
const sessions = new Set();

// ─── Archive Helper ─────────────────────────────
async function archiveNow() {
  await db.read();

  db.data ||= {};
  db.data.posts ||= [];
  db.data.archives ||= [];

  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // ✅ Avoid archiving multiple times on same day
  if (db.data.archives[0]?.date?.startsWith(today)) {
    console.log('⚠️ Already archived today. Skipping.');
    return;
  }

  if (db.data.posts.length) {
    db.data.archives.unshift({
      date: now.toISOString(),
      posts: db.data.posts
    });
    db.data.posts = [];
    await db.write();
    console.log('📦 Archived posts for', today);
  }
}

// ─── Cron Job: Daily Archive ───────────────────
cron.schedule('0 16 * * *', archiveNow);

// ─── API Routes ────────────────────────────────

// GET: Live posts
app.get('/api/posts', async (_, res) => {
  await db.read();
  res.json(db.data.posts);
});

// POST: New post (rate-limited)
app.post('/api/posts', postLimiter, async (req, res) => {
  const { type, text, image, name, mood } = req.body;
  if (!type || (!text && !image)) {
    return res.status(400).json({ error: 'Missing post data' });
  }
  const post = {
    id: nanoid(),
    type,
    text: text || null,
    image: image || null,
    name: name || 'Anonymous',
    mood: mood || 'default',
    createdAt: Date.now()
  };
  db.data.posts.unshift(post);
  await db.write();
  res.status(201).json(post);
});

// POST: Admin login → returns token
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === 'scribsySuperSecret') {
    const token = nanoid();
    sessions.add(token);
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

// DELETE: Admin deletes post (token protected)
app.delete('/api/posts/:id', async (req, res) => {
  const token = req.header('x-auth-token');
  if (!token || !sessions.has(token)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const id = req.params.id;
  db.data.posts = db.data.posts.filter(p => p.id !== id);
  await db.write();
  res.json({ success: true });
});

// GET: Archived past walls
app.get('/api/archives', async (_, res) => {
  await db.read();
  const archives = Array.isArray(db.data.archives) ? db.data.archives : [];
  console.log('📂 /api/archives →', archives.length, 'entries');
  res.json(archives);
});

// POST: Manual archive trigger (Render cron)
app.post('/api/archive-now', async (_, res) => {
  await archiveNow();
  res.json({ success: true });
});

// GET: Health check
app.get('/api/health', (_, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ─── Start Server ───────────────────────────────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🖥 API ready at http://localhost:${PORT}`);
});
