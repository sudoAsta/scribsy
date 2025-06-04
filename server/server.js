// ─────────────────────────────────────────────
// Scribsy Server (Express + Firebase + Reactions + Auth)
// ─────────────────────────────────────────────

import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { nanoid } from 'nanoid';
import rateLimit from 'express-rate-limit';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ─── Environment ───────────────────────────────
const isProd = process.env.NODE_ENV === 'production';
const creds = JSON.parse(process.env.FIREBASE_CREDENTIALS);

// ─── Firebase Initialization ───────────────────
initializeApp({ credential: cert(creds) });
const firestore = getFirestore();

// ─── In-memory Session for Admin Tokens ────────
const sessions = new Set();

// ─── Express Init ──────────────────────────────
const app = express();
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://scribsy.io',
    'https://api.scribsy.io'
  ]
}));
app.use(express.json());

// ─── Rate Limit: 20 posts per hour per IP ──────
const postLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Too many posts from this IP. Please try again later.' }
});

// ─── Archive Helper ─────────────────────────────
async function archiveNow() {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  const archiveSnap = await firestore.collection('archives')
    .orderBy('date', 'desc').limit(1).get();

  const alreadyArchived = archiveSnap.docs[0]?.data()?.date?.startsWith(today);
  if (alreadyArchived) return console.log('⚠️ Already archived today.');

  const postsSnap = await firestore.collection('posts').get();
  if (postsSnap.empty) return;

  const posts = postsSnap.docs.map(doc => doc.data());
  await firestore.collection('archives').add({ date: now.toISOString(), posts });

  const batch = firestore.batch();
  postsSnap.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  console.log('📦 Archived posts for', today);
}

cron.schedule('0 16 * * *', archiveNow);

// ─── API Routes ────────────────────────────────

app.get('/api/posts', async (_, res) => {
  const snap = await firestore.collection('posts').orderBy('createdAt', 'desc').get();
  const posts = snap.docs.map(doc => ({ reactions: {}, ...doc.data() }));
  res.json(posts);
});

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
    createdAt: Date.now(),
    reactions: {}
  };
  await firestore.collection('posts').doc(post.id).set(post);
  res.status(201).json(post);
});

app.delete('/api/posts/:id', async (req, res) => {
  const token = req.header('x-auth-token');
  if (!token || !sessions.has(token)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  await firestore.collection('posts').doc(req.params.id).delete();
  res.json({ success: true });
});

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

app.get('/api/archives', async (_, res) => {
  const snap = await firestore.collection('archives').orderBy('date', 'desc').get();
  const archives = snap.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      posts: (data.posts || []).map(p => ({ reactions: {}, ...p }))
    };
  });
  res.json(archives);
});

app.post('/api/archive-now', async (_, res) => {
  await archiveNow();
  res.json({ success: true });
});

app.post('/api/posts/:id/react', async (req, res) => {
  const { emoji } = req.body;
  const { id } = req.params;
  if (!emoji || typeof emoji !== 'string') {
    return res.status(400).json({ error: 'Invalid emoji' });
  }
  const ref = firestore.collection('posts').doc(id);
  const doc = await ref.get();
  if (!doc.exists) return res.status(404).json({ error: 'Post not found' });
  const data = doc.data();
  data.reactions ||= {};
  data.reactions[emoji] = (data.reactions[emoji] || 0) + 1;
  await ref.set(data);
  res.json({ success: true, reactions: data.reactions });
});

app.get('/api/health', (_, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🖥 API ready at http://localhost:${PORT}`);
});
