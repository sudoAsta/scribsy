// ─────────────────────────────────────────────────────────────────
// Scribsy Server (Express + Firebase Firestore)
// ─────────────────────────────────────────────────────────────

import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { nanoid } from 'nanoid';
import admin from 'firebase-admin';
import fs from 'fs';

const app = express();

// ─── Middleware ───────────────────────────────────────────
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://scribsy.io',
  ]
}));
app.use(express.json());

// ─── Firebase Initialization ─────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const postsRef = db.collection('posts');
const archivesRef = db.collection('archives');

// ─── Simple Admin Session Store ─────────────────
const sessions = new Set();

// ─── Archive Helper ──────────────────────────────
async function archiveNow() {
  const snapshot = await postsRef.get();
  if (snapshot.empty) return;

  const posts = [];
  snapshot.forEach(doc => posts.push(doc.data()));

  const today = new Date().toISOString().split('T')[0];

  const existing = await archivesRef.where('date', '>=', today).limit(1).get();
  if (!existing.empty) {
    console.log('⚠️ Already archived today. Skipping.');
    return;
  }

  await archivesRef.add({
    date: new Date().toISOString(),
    posts
  });

  const batch = db.batch();
  snapshot.forEach(doc => batch.delete(doc.ref));
  await batch.commit();

  console.log('📦 Archived posts for', today);
}

// ─── Cron Job: Daily Archive ───────────────────
cron.schedule('0 16 * * *', archiveNow);

// ─── API Routes ──────────────────────────────

// GET: Live posts
app.get('/api/posts', async (_, res) => {
  const snapshot = await postsRef.orderBy('createdAt', 'desc').get();
  const posts = snapshot.docs.map(doc => doc.data());
  res.json(posts);
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
  await postsRef.doc(post.id).set(post);
  res.status(201).json(post);
});

// POST: Admin login
app.post('/api/admin/login', async (req, res) => {
  const { password } = req.body;
  if (password === 'scribsySuperSecret') {
    const token = nanoid();
    sessions.add(token);
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

// DELETE: Admin deletes post
app.delete('/api/posts/:id', async (req, res) => {
  const token = req.header('x-auth-token');
  if (!sessions.has(token)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const id = req.params.id;
  await postsRef.doc(id).delete();
  res.json({ success: true });
});

// GET: Archived past walls
app.get('/api/archives', async (_, res) => {
  const snapshot = await archivesRef.orderBy('date', 'desc').get();
  const archives = snapshot.docs.map(doc => doc.data());
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

// ─── Start Server ────────────────────────────────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🖥 API ready at http://localhost:${PORT}`);
});
