// src/main.js

import './style.css';

// ✅ Auto-detect local or live API URL
const API = window.location.hostname.includes('localhost')
  ? 'http://localhost:4000'
  : 'https://api.scribsy.io';

// Admin login: prompt for password, send to server, store token if valid
let isAdmin = false;

async function askForAdmin() {
  const password = prompt('Enter admin password:');
  if (!password) return;
  const res = await fetch(`${API}/api/admin/login`, {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ password })
  });
  const data = await res.json();
  if (!res.ok) return alert(data.error || 'Login failed');
  localStorage.setItem('scribsy-admin-token', data.token);
  isAdmin = true;
  document.body.classList.add('admin-mode');
  document.querySelectorAll('.post-wrapper').forEach(addDeleteButton);
}

// Enable admin login via keyboard shortcut Ctrl+Shift+A
// (single binding only; removed duplicate)
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.shiftKey && e.code === 'KeyA') askForAdmin();
});

// DOM elements references
const wall = document.getElementById('wall');
const createPostBtn = document.getElementById('create-post');
const modal = document.getElementById('post-modal');
const overlay = document.getElementById('overlay');
const closeModalBtn = document.getElementById('close-modal');
const writeTab = document.getElementById('write-tab');
const drawTab = document.getElementById('draw-tab');
const textArea = document.getElementById('post-text');
const charCount = document.getElementById('char-count');
const canvas = document.getElementById('draw-canvas');
const ctx = canvas.getContext('2d');
const submitBtn = document.getElementById('submit-post');
const nameInput = document.getElementById('post-name');
const moodSelect = document.getElementById('mood-select');

let postCount = 0;
const MAX_POSTS = 10;

// Update countdown timer to weekly reset
function updateCountdown() {
  const now = new Date();
  const day = now.getUTCDay(); // Sunday = 0
  const daysUntilSunday = (7 - day) % 7;
  let nextReset = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + daysUntilSunday,
    16, 0, 0 // 16:00 UTC = 00:00 PH
  ));
  if (nextReset <= now) {
    nextReset.setUTCDate(nextReset.getUTCDate() + 7);
  }
  const diff = nextReset - now;
  if (diff <= 0) {
    document.querySelector('#reset-timer .reset-value').textContent = '0d 0h 0m';
    return;
  }
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((diff / (1000 * 60)) % 60);
  document.querySelector('#reset-timer .reset-value').textContent = `${days}d ${hours}h ${mins}m`;
}

updateCountdown();
setInterval(updateCountdown, 60000);

// Random rotation between -5 and +5 degrees
function randomRotation() {
  return Math.floor(Math.random() * 10) - 5;
}

// Small helper: create Share button (permalink to /p/:id)
function makeShareButton(post) {
  const btn = document.createElement('button');
  btn.className = 'share-btn';
  btn.type = 'button';
  btn.textContent = 'Share';
  const permalink = `https://scribsy.io/p/${post.id}`;
  btn.addEventListener('click', async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Scribsy Post',
          text: post.text ? `“${post.text}”` : 'See this Scribsy post',
          url: permalink
        });
      } else {
        await navigator.clipboard.writeText(permalink);
        alert('Link copied!');
      }
    } catch (_) {}
  });
  return btn;
}

// ✅ Mobile-friendly reaction tray + share
function renderPost(post, prepend = false) {
  const wrapper = document.createElement('div');
  wrapper.classList.add('post-wrapper');
  wrapper.dataset.id = post.id;
  wrapper.style.backgroundColor = getMoodColor(post.mood);
  wrapper.style.transform = `rotate(${randomRotation()}deg)`;
  wrapper.style.overflow = 'visible';
  wrapper.style.position = 'relative';

  if (post.type === 'text') {
    const txt = document.createElement('div');
    txt.className = 'post-text';
    txt.textContent = `"${post.text}"`;
    wrapper.append(txt);
  } else if (post.type === 'image') {
    const img = document.createElement('img');
    img.src = post.image;
    img.alt = `Anonymous drawing, mood: ${post.mood || 'default'}`;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.width = 400;  // reserve space to avoid layout shift
    img.height = 300; // 4:3 ratio
    wrapper.append(img);
  }

  const footer = document.createElement('div');
  footer.className = 'post-footer';
  const author = document.createElement('span');
  author.className = 'post-author';
  author.textContent = `by ${post.name}`;
  const pill = document.createElement('span');
  pill.className = `post-mood post-mood--${post.mood || 'default'}`;
  pill.textContent = post.mood;
  footer.append(author, pill);
  wrapper.append(footer);

  const countBar = document.createElement('div');
  countBar.className = 'reaction-count-bar';
  wrapper.append(countBar);

  function updateReactionCounts(reactions) {
    countBar.innerHTML = '';
    Object.entries(reactions).forEach(([emoji, count]) => {
      if (count > 0) {
        const pill = document.createElement('div');
        pill.className = 'reaction-pill';
        pill.innerHTML = `${emoji} <span>${count}</span>`;
        countBar.append(pill);
      }
    });
  }

  if (post.reactions) updateReactionCounts(post.reactions);

  const tray = document.createElement('div');
  tray.className = 'reaction-tray';
  const emojis = ['🔥','❤️','😂','😢','😡','💩'];

  emojis.forEach(emoji => {
    const btn = document.createElement('button');
    btn.className = 'reaction-emoji';
    btn.textContent = emoji;

    btn.addEventListener('click', async () => {
      try {
        const res = await fetch(`${API}/api/posts/${post.id}/react`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emoji })
        });
        const data = await res.json();
        if (data.reactions) updateReactionCounts(data.reactions);
        tray.classList.remove('show');
      } catch (err) {
        console.error('Reaction error:', err);
      }
    });

    tray.append(btn);
  });

  wrapper.append(tray);

  // Actions row (Share button, right-aligned)
  const actions = document.createElement('div');
  actions.className = 'post-actions';
  actions.append(makeShareButton(post));
  wrapper.append(actions);

  // 📱 Mobile: tap to toggle tray
  if (window.innerWidth <= 600) {
    let autoHideTimer = null;

    wrapper.addEventListener('click', (e) => {
      if (e.target.closest('.reaction-emoji')) return;

      // Close all other trays
      document.querySelectorAll('.reaction-tray.show').forEach(t => {
        t.classList.remove('show');
        t.classList.remove('hide');
      });

      tray.classList.add('show');
      tray.classList.remove('hide');
      e.stopPropagation();

      // Clear any previous timer
      if (autoHideTimer) clearTimeout(autoHideTimer);

      // ⏱️ Auto-hide after 4s
      autoHideTimer = setTimeout(() => {
        tray.classList.remove('show');
        tray.classList.add('hide');

        setTimeout(() => {
          tray.classList.remove('hide');
        }, 500);
      }, 4000);
    });

    // Tap outside to close immediately
    document.addEventListener('click', () => {
      tray.classList.remove('show');
      tray.classList.add('hide');
      if (autoHideTimer) clearTimeout(autoHideTimer);
      setTimeout(() => tray.classList.remove('hide'), 500);
    }, { once: true });
  }

  if (isAdmin) addDeleteButton(wrapper);
  if (prepend) wall.prepend(wrapper);
  else wall.append(wrapper);
  requestAnimationFrame(() => wrapper.classList.add('visible'));
}

// Add delete button to post wrapper (admin only)
function addDeleteButton(wrapper) {
  if (wrapper.querySelector('.post-delete')) return;
  const btn = document.createElement('button');
  btn.className = 'post-delete';
  btn.textContent = '✕';
  btn.addEventListener('click', async () => {
    const token = localStorage.getItem('scribsy-admin-token');
    await fetch(`${API}/api/posts/${wrapper.dataset.id}`, {
      method: 'DELETE',
      headers: { 'x-auth-token': token }
    });
    wrapper.remove();
    updateEmptyState();
    postCount = Math.max(0, postCount - 1);
  });
  wrapper.append(btn);
}

// Mood-to-color mapping
function getMoodColor(mood) {
  switch (mood) {
    case 'Dreamy': return '#B3D9E0';
    case 'Happy':  return '#F1A805';
    case 'Sad':    return '#92ADA4';
    case 'Meh':    return '#F2D6A1';
    case 'Rant':   return '#F36949';
    default:       return '#EDD5C0';
  }
}

// Show/hide empty state
function updateEmptyState() {
  const empty = document.getElementById('empty-state');
  empty.style.display = wall.children.length === 0 ? 'block' : 'none';
}

// Load and render posts from server
async function loadPosts() {
  try {
    const res = await fetch(`${API}/api/posts`);
    const posts = await res.json();
    posts.forEach(p => renderPost(p, false));
    updateEmptyState();
  } catch (err) {
    console.error('Failed to load posts', err);
  }
}

// Modal controls
createPostBtn.addEventListener('click', () => showModal());
closeModalBtn.addEventListener('click', () => closeModal());
overlay.addEventListener('click', e => e.target === overlay && closeModal());
document.addEventListener('keydown', e => e.key === 'Escape' && closeModal());

// Resize canvas for drawing
function resizeCanvas() {
  canvas.width  = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  ctx.strokeStyle = '#000';
  ctx.lineWidth   = 2;
  ctx.lineCap     = 'round';
  ctx.clearRect(0,0,canvas.width,canvas.height);
  canvasReady = true;
}

// Show modal with animation
function showModal() {
  modal.style.display   = 'flex';
  overlay.style.display = 'block';
  requestAnimationFrame(() => {
    modal.classList.add('show');
    overlay.classList.add('show');
    setTimeout(resizeCanvas, 50);
  });
}

// Hide modal with animation
function closeModal() {
  modal.classList.remove('show');
  overlay.classList.remove('show');
  modal.addEventListener('transitionend', () => {
    modal.style.display   = 'none';
    overlay.style.display = 'none';
  }, { once: true });
}

// Toggle write tab
writeTab.addEventListener('click', () => {
  writeTab.classList.add('active');
  drawTab.classList.remove('active');
  textArea.style.display = 'block';
  canvas.style.display   = 'none';
  charCount.style.display = 'block';
  charCount.textContent   = `${textArea.value.length} / 120`;
});

// Toggle draw tab

drawTab.addEventListener('click', () => {
  drawTab.classList.add('active');
  writeTab.classList.remove('active');
  textArea.style.display = 'none';
  canvas.style.display   = 'block';
  charCount.style.display = 'none';
  canvasReady = false;
  resizeCanvas();
});

// Live character counter
textArea.addEventListener('input', () => {
  charCount.textContent = `${textArea.value.length} / 120`;
});

// Drawing state flags
let drawing = false;

function startDrawing(x, y) {
  drawing = true;
  ctx.beginPath();
  ctx.moveTo(x, y);
}

function drawLine(x, y) {
  if (!drawing) return;
  ctx.lineTo(x, y);
  ctx.stroke();
}

function stopDrawing() {
  drawing = false;
}

// Convert touch event coordinates to canvas space
function getCanvasCoords(touch) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (touch.clientX - rect.left) * scaleX,
    y: (touch.clientY - rect.top) * scaleY
  };
}

// Mouse drawing events
canvas.addEventListener('mousedown', (e) => startDrawing(e.offsetX, e.offsetY));
canvas.addEventListener('mousemove', (e) => drawLine(e.offsetX, e.offsetY));
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseleave', stopDrawing);

// Touch drawing events
canvas.addEventListener('touchstart', (e) => {
  const touch = e.touches[0];
  const { x, y } = getCanvasCoords(touch);
  startDrawing(x, y);
});

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  const { x, y } = getCanvasCoords(touch);
  drawLine(x, y);
}, { passive: false });

canvas.addEventListener('touchend', stopDrawing);

// Submit a post
submitBtn.addEventListener('click', async () => {
  if (postCount >= MAX_POSTS) {
    return alert(`Max ${MAX_POSTS} posts reached.`);
  }
  const name = nameInput.value.trim() || 'Anonymous';
  const mood = moodSelect.value;
  let type, text, image;

  if (writeTab.classList.contains('active')) {
    text = textArea.value.trim();
    if (!text) return alert('Write something first!');
    if (text.length > 120) return alert('Keep under 120 characters.');
    type = 'text';
  } else {
    image = canvas.toDataURL();
    type = 'image';
  }

  try {
    const res = await fetch(`${API}/api/posts`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ type, text, image, name, mood })
    });
    const newPost = await res.json();
    renderPost(newPost, true);
    postCount++;
    updateEmptyState();
  } catch (err) {
    console.error('Post failed', err);
  }

  // Disable button temporarily and reset modal
  submitBtn.disabled = true;
  setTimeout(() => submitBtn.disabled = postCount >= MAX_POSTS, 5000);
  textArea.value = '';
  nameInput.value = '';
  moodSelect.value = '';
  closeModal();
});

let canvasReady = false;

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  resizeCanvas();
  loadPosts();
  updateEmptyState();
  updateCountdown();
  setInterval(updateCountdown, 60000);
});

