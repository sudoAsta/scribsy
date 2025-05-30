# ✨ Scribsy – A Digital Freedom Wall

Scribsy is an anonymous space where users can **write**, **draw**, and **express their thoughts freely** — just like a freedom wall in school or the workplace.

🖋️ Post thoughts  
🎨 Scribble drawings  
💬 No accounts, no judgment  
🔒 Admin moderation & daily archive reset

> [🌐 Visit Scribsy → scribsy.io](https://scribsy.io)

---

## 🚀 Features

- 🧠 **Write mode** – Share anonymous thoughts, limited to 100 characters
- ✏️ **Draw mode** – Freehand doodles posted to the wall
- 🎭 **Mood tagging** – Add emotional context with color-coded pills
- 🧹 **Auto-reset** – The wall resets every 24 hours (archived privately)
- 🧑‍💼 **Admin controls** – Secure deletion of inappropriate content
- 🗃 **Past Walls** – Archived view of older posts

---

## 🛠 Local Development

Clone the repo:

git clone https://github.com/sudoAsta/scribsy.git
cd scribsy
1. Frontend (Vite + Vanilla JS)
npm install
npm run dev

2. Backend (Express + LowDB)
cd server
npm install
node server.js

---

## 🌍 Deployment
Frontend: Netlify
Custom domain: scribsy.io
Backend: Render
Deployed Node.js Express server with LowDB
 Auto-archiving via scheduled cron job

---

## 🎯 Tech Stack
Frontend: Vite + Vanilla JS + HTML/CSS
Backend: Node.js + Express + LowDB
Drawing: <canvas> API
Deployment: Netlify + Render
Misc: Cron jobs, Open Graph tags, mobile-first layout

---

## 📦 Folder Structure
scribsy/
├── public/           # Static assets
├── server/           # Express backend (LowDB API)
├── styles/           # CSS files
├── main.js           # App logic
├── past.js           # Archives viewer
├── index.html
└── past.html

---

## 🤝 Contributing
Not accepting external contributions at the moment. Just enjoy the wall ❤️

## 🧠 Why Scribsy?
Because everyone needs a space to vent, draw, and let it out.
 No likes. No followers. Just self-expression.

## 📷 OG Image Preview
Add your og-image.png in /public and make sure the <meta> tags are present in your HTML.
 Try it with https://ogp.me/ or Twitter Card Validator.

## 🛡 Admin Code
Admin deletes are protected with a hashed password prompt. This is not secure for production — upgrade to real auth if scaling.

## 🧩 Future Ideas
User voting / emoji reacts
Private walls with shareable links
Drawing tools (color, undo)
Export wall as image

Made with ❤️ by @sudoAsta
