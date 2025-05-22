// server/server.js
import express from 'express';
import cors from 'cors';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { nanoid } from 'nanoid';

const app = express();
app.use(cors());
app.use(express.json());

// ——— Set up lowdb ———
const adapter = new JSONFile('db.json');
const db = new Low(adapter, { posts: [] });
await db.read();

// ——— GET all posts ———
app.get('/api/posts', async (req, res) => {
  await db.read();
  res.json(db.data.posts);
});

// ——— POST a new post ———
app.post('/api/posts', async (req, res) => {
  const { type, text, image, name, mood } = req.body;
  if (!type || (!text && !image)) {
    return res.status(400).json({ error: 'Missing post payload' });
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

// ——— DELETE a post (admin only) ———
app.delete('/api/posts/:id', async (req, res) => {
  const adminKey = req.header('x-admin-key');
  if (adminKey !== 'scribsyAdmin123') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const id = req.params.id;
  db.data.posts = db.data.posts.filter(p => p.id !== id);
  await db.write();
  res.json({ success: true });
});

// ——— Start the server ———
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🖥  API server running at http://localhost:${PORT}`);
});
