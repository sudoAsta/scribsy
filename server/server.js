// server/server.js

import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { nanoid } from 'nanoid';
import path from 'node:path';
import rateLimit from 'express-rate-limit';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ───── Determine Environment ─────
const isProd = process.env.NODE_ENV === 'production';

// ───── DB Setup ─────
let db;
if (isProd) {
  import { initializeApp, cert } from 'firebase-admin/app';
  
  const creds = JSON.parse(process.env.FIREBASE_CREDENTIALS);
  initializeApp({ credential: cert(creds) });

  const firestore = getFirestore();
  db = {
    async read() {
      const postsSnap = await firestore.collection('posts').get();
      const archivesSnap = await firestore.collection('archives').get();

      this.data = {
        posts: postsSnap.docs.map(doc => doc.data()),
        archives: archivesSnap.docs.map(doc => doc.data())
      };
    },
    async write() {
      const batch = firestore.batch();
      const postsRef = firestore.collection('posts');
      const archivesRef = firestore.collection('archives');

      // Clear and re-write
      const oldPosts = await postsRef.get();
      oldPosts.forEach(doc => batch.delete(doc.ref));
      this.data.posts.forEach(p => batch.set(postsRef.doc(p.id), p));

      const oldArchives = await archivesRef.get();
      oldArchives.forEach(doc => batch.delete(doc.ref));
      this.data.archives.forEach(a => batch.set(archivesRef.doc(), a));

      await batch.commit();
    },
    data: { posts: [], archives: [] }
  };
} else {
  const adapter = new JSONFile(path.resolve('../db.json'));
  db = new Low(adapter, { posts: [], archives: [] });
  await db.read();
}

// ───── App Init ─────
const app = express();
app.use(cors({
  origin: ['http://localhost:5173', 'https://scribsy.io']
}));
app.use(express.json());

// ───── Rate Limit ─────
app.use('/api/', rateLimit({
  windowMs: 10 * 1000,
  max: 10,
  message: 'Too many requests — please slow down!'
}));

// ───── Archive Helper ─────
async function archiveNow() {
  await db.read();
  db.data ||= {};
  db.data.posts ||= [];
  db.data.archives ||= [];

  const now = new Date();
  const today = now.toISOString().split('T')[0];

  if (db.data.archives[0]?.date?.startsWith(today)) {
    console.log('⚠️ Already archived today.');
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
cron.schedule('0 16 * * *', archiveNow);

// ───── Routes ─────

// ✅ Safer patch to avoid 500 errors on live
app.get('/api/posts', async (_, res) => {
  await db.read();
  db.data ||= {};
  db.data.posts ||= [];

  db.data.posts.forEach(p => {
    p.reactions ||= {};
  });

  res.json(db.data.posts);
});

// ✅ Safer archive patch
app.get('/api/archives', async (_, res) => {
  await db.read();
  db.data ||= {};
  db.data.archives ||= [];

  db.data.archives.forEach(entry => {
    entry.posts ||= [];
    entry.posts.forEach(p => {
      p.reactions ||= {};
    });
  });

  res.json(db.data.archives);
});


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
    createdAt: Date.now(),
    reactions: {} // 👈 initialize reactions here
  };
  db.data.posts.unshift(post);
  await db.write();
  res.status(201).json(post);
});

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

app.get('/api/archives', async (_, res) => {
  await db.read();
  const archives = Array.isArray(db.data.archives) ? db.data.archives : [];
  res.json(archives);
});

app.post('/api/archive-now', async (_, res) => {
  await archiveNow();
  res.json({ success: true });
});

// POST: React to a post
app.post('/api/posts/:id/react', async (req, res) => {
  const { emoji } = req.body;
  const { id } = req.params;

  if (!emoji || typeof emoji !== 'string') {
    return res.status(400).json({ error: 'Invalid emoji' });
  }

  await db.read();
  const post = db.data.posts.find(p => p.id === id);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  post.reactions ||= {};
  post.reactions[emoji] = (post.reactions[emoji] || 0) + 1;

  await db.write();
  res.json({ success: true, reactions: post.reactions });
});

app.get('/api/health', (_, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ───── Start ─────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🖥 API ready at http://localhost:${PORT}`);
});
