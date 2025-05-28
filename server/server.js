// server/server.js
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { nanoid } from 'nanoid';

const app = express();
app.use(cors());
app.use(express.json());

// ─── LowDB setup with both posts & archives ───────────────
const adapter = new JSONFile('db.json');
const db = new Low(adapter, { posts: [], archives: [] });
await db.read();

// ─── Archive helper ──────────────────────────────
async function archiveNow() {
  await db.read();

  // ─── Ensure both collections exist ───────────────
  db.data ||= {};
  db.data.posts    ||= [];
  db.data.archives ||= [];

  await db.write();   // flush these defaults back into db.json

  // ─── Only archive if there’s something to save ────
  if (db.data.posts.length) {
    db.data.archives.unshift({
      date: new Date().toISOString(),
      posts: db.data.posts
    });
    db.data.posts = [];
    await db.write();
    console.log('🔔 Manual archive & reset complete.');
  }
}

// Cron: run at midnight daily
cron.schedule('0 0 * * *', archiveNow);

// Manual trigger for testing (POST /api/archive-now)
// app.post('/api/archive-now', async (req, res) => {
//  await archiveNow();
//  res.json({ success: true });
// });

// ─── GET all live posts ────────────────────────────────────
app.get('/api/posts', async (req, res) => {
  await db.read();
  res.json(db.data.posts);
});

// ─── POST new post ────────────────────────────────────────
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

// ─── DELETE post (admin only) ─────────────────────────────
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

// ─── GET archived walls ───────────────────────────────────
app.get('/api/archives', async (req, res) => {
  await db.read();
  const archives = Array.isArray(db.data.archives) ? db.data.archives : [];
  console.log('GET /api/archives →', archives.length, 'entries');
  res.json(archives);
});

// ─── Health-check endpoint ──────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ─── Start server ─────────────────────────────────────────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🖥 API listening on http://localhost:${PORT}`);
});
