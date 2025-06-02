// ─────────────────────────────────────────────
// Scribsy Server (Express + LowDB)
// ─────────────────────────────────────────────

import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { nanoid } from 'nanoid';

const app = express();

// ─── Middleware ────────────────────────────────
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://scribsy.io',
  ]
}));
app.use(express.json());

// ─── DB Setup ───────────────────────────────────
const adapter = new JSONFile('db.json');
const db = new Low(adapter, { posts: [], archives: [] });
await db.read();

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

// POST: New post
app.post('/api/posts', async (req, res) => {
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

// DELETE: Admin deletes post
app.delete('/api/posts/:id', async (req, res) => {
  const key = req.header('x-admin-key');
  if (key !== 'scribsyAdmin123') {
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