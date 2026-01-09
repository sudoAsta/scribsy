// src/main.js
import './style.css';
import { initTheme } from './theme-loader.js';
import { initTiltPosts } from './effects/tilt-posts.js';

initTheme();

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

document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.shiftKey && e.code === 'KeyA') askForAdmin();
});

function addDeleteButton(wrapper) {
  if (wrapper.querySelector('.post-delete')) return;
  const btn = document.createElement('button');
  btn.className = 'post-delete';
  btn.textContent = '✕';
  btn.addEventListener('click', async () => {
    const token = localStorage.getItem('scribsy-admin-token');
    const res = await fetch(`${API}/api/posts/${wrapper.dataset.id}`, {
      method: 'DELETE',
      headers: { 'x-auth-token': token }
    });
    if (!res.ok) return alert('Delete failed');
    wrapper.remove();
  });
  wrapper.append(btn);
}

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
  const day = now.getUTCDay();
  const daysUntilSunday = (7 - day) % 7;
  let nextReset = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + daysUntilSunday,
    16, 0, 0
  ));
  if (nextReset <= now) nextReset.setUTCDate(nextReset.getUTCDate() + 7);

  const diff = nextReset - now;
  if (diff <= 0) {
    document.querySelector('#reset-timer .reset-value').textContent = '0d 0h 0m';
    return;
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((diff / (1000 * 60)) % 60);

  document.querySelector('#reset-timer .reset-value').textContent =
    `${days}d ${hours}h ${mins}m`;
}

updateCountdown();
setInterval(updateCountdown, 60000);

// Random rotation between -5 and +5 degrees
function randomRotation() {
  return Math.floor(Math.random() * 10) - 5;
}

function renderPost(post, prepend = false) {
  const wrapper = document.createElement('div');
  wrapper.classList.add('post-wrapper');
  wrapper.dataset.id = post.id;
  wrapper.style.backgroundColor = getMoodColor(post.mood);
  wrapper.style.setProperty('--base-rot', `${randomRotation()}deg`);
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
    img.alt = `Drawing by ${post.name}, mood ${post.mood}`;
    wrapper.append(img);
  }

  // Footer (author + mood)
  const footer = document.createElement('div');
  footer.className = 'post-footer';
  const author = document.createElement('span');
  author.className = 'post-author';
  author.textContent = `by ${post.name}`;
  const pill = document.createElement('span');
  pill.className = `post-mood post-mood--${post.mood || 'default'}`;
  pill.textContent = post.mood || 'default';
  footer.append(author, pill);
  wrapper.append(footer);

  // Reaction counts
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

  // Reaction tray (now also contains Share icon)
  const tray = document.createElement('div');
  tray.className = 'reaction-tray';
  const emojis = ['🔥','❤️','😂','😢','😡','💩'];
  emojis.forEach(emoji => {
    const btn = document.createElement('button');
    btn.className = 'reaction-emoji';
    btn.textContent = emoji;
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        const res = await fetch(`${API}/api/posts/${post.id}/react`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emoji })
        });
        const data = await res.json();
        if (data.reactions) updateReactionCounts(data.reactions);
        tray.classList.remove('show');
      } catch (err) { console.error('Reaction error:', err); }
    });
    tray.append(btn);
  });

  // 🔗 Share icon (icon-only, aligned with tray)
  const shareBtn = document.createElement('button');
  shareBtn.className = 'reaction-emoji reaction-emoji--share';
  shareBtn.textContent = '🔗';
  shareBtn.title = 'Share';
  shareBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/share/${post.id}`;
    const shareData = {
      title: 'Scribsy Post',
      text: post.type === 'text' && post.text ? `"${post.text}" — Scribsy` : 'Scribsy – Write & draw anonymously',
      url: shareUrl
    };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(shareUrl);
        alert('Link copied to clipboard!');
      }
    } catch {
      await navigator.clipboard.writeText(shareUrl);
      alert('Link copied to clipboard!');
    }
  });
  tray.append(shareBtn);

  wrapper.append(tray);

  // 📱 Mobile: tap to toggle tray (unchanged)
  if (window.innerWidth <= 600) {
    let autoHideTimer = null;
    wrapper.addEventListener('click', (e) => {
      if (e.target.closest('.reaction-emoji')) return;
      document.querySelectorAll('.reaction-tray.show').forEach(t => t.classList.remove('show','hide'));
      tray.classList.add('show');
      tray.classList.remove('hide');
      e.stopPropagation();
      if (autoHideTimer) clearTimeout(autoHideTimer);
      autoHideTimer = setTimeout(() => {
        tray.classList.remove('show'); tray.classList.add('hide');
        setTimeout(() => tray.classList.remove('hide'), 500);
      }, 4000);
    });
    document.addEventListener('click', () => {
      tray.classList.remove('show'); tray.classList.add('hide');
      setTimeout(() => tray.classList.remove('hide'), 500);
    }, { once: true });
  }

  if (isAdmin) addDeleteButton(wrapper);
  if (prepend) wall.prepend(wrapper); else wall.append(wrapper);
  requestAnimationFrame(() => wrapper.classList.add('visible'));
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

// Load posts
async function loadPosts() {
  try {
    const res = await fetch(`${API}/api/posts`);
    const posts = await res.json();
    posts.forEach(p => renderPost(p, false));
    updateEmptyState();
  } catch (err) { console.error('Failed to load posts', err); }
}

initTiltPosts({
  selector: '.post-wrapper',
  rotateAmplitude: 8,
  hoverScale: 1.03
});

// Modal controls
createPostBtn.addEventListener('click', () => showModal());
closeModalBtn.addEventListener('click', () => closeModal());
overlay.addEventListener('click', e => e.target === overlay && closeModal());
document.addEventListener('keydown', e => e.key === 'Escape' && closeModal());

// Resize canvas
function resizeCanvas() {
  canvas.width  = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  ctx.strokeStyle = '#000';
  ctx.lineWidth   = 2;
  ctx.lineCap     = 'round';
  ctx.clearRect(0,0,canvas.width,canvas.height);
  canvasReady = true;
}

// Show modal
function showModal() {
  modal.style.display   = 'flex';
  overlay.style.display = 'block';
  requestAnimationFrame(() => { modal.classList.add('show'); overlay.classList.add('show'); setTimeout(resizeCanvas, 50); });
}

// Hide modal
function closeModal() {
  modal.classList.remove('show');
  overlay.classList.remove('show');
  modal.addEventListener('transitionend', () => {
    modal.style.display   = 'none';
    overlay.style.display = 'none';
  }, { once: true });
}

// Toggle tabs
writeTab.addEventListener('click', () => { writeTab.classList.add('active'); drawTab.classList.remove('active'); textArea.style.display = 'block'; canvas.style.display = 'none'; charCount.style.display = 'block'; charCount.textContent = `${textArea.value.length} / 150`; });
drawTab.addEventListener('click', () => { drawTab.classList.add('active'); writeTab.classList.remove('active'); textArea.style.display = 'none'; canvas.style.display = 'block'; charCount.style.display = 'none'; canvasReady = false; resizeCanvas(); });

// Live counter
textArea.addEventListener('input', () => { charCount.textContent = `${textArea.value.length} / 150`; });

// Drawing events
let drawing = false;
function startDrawing(x, y) { drawing = true; ctx.beginPath(); ctx.moveTo(x, y); }
function drawLine(x, y) { if (!drawing) return; ctx.lineTo(x, y); ctx.stroke(); }
function stopDrawing() { drawing = false; }
function getCanvasCoords(touch) { const rect = canvas.getBoundingClientRect(); const scaleX = canvas.width / rect.width; const scaleY = canvas.height / rect.height; return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY }; }
canvas.addEventListener('mousedown', (e) => startDrawing(e.offsetX, e.offsetY));
canvas.addEventListener('mousemove', (e) => drawLine(e.offsetX, e.offsetY));
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseleave', stopDrawing);
canvas.addEventListener('touchstart', (e) => { const { x, y } = getCanvasCoords(e.touches[0]); startDrawing(x, y); });
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); const { x, y } = getCanvasCoords(e.touches[0]); drawLine(x, y); }, { passive: false });
canvas.addEventListener('touchend', stopDrawing);

// Submit a post
let isSubmittingPost = false;

submitBtn.addEventListener('click', async () => {
  if (isSubmittingPost) return;
  if (postCount >= MAX_POSTS) return alert(`Max ${MAX_POSTS} posts reached.`);

  const name = nameInput.value.trim() || 'Anonymous';
  const mood = moodSelect.value;
  let type, text, image;

  if (writeTab.classList.contains('active')) {
    text = textArea.value.trim();
    if (!text) return alert('Write something first!');
    if (text.length > 150) return alert('Keep under 150 characters.');
    type = 'text';
  } else {
    image = canvas.toDataURL();
    type = 'image';
  }

  const prevLabel = submitBtn.textContent;

  // instant feedback
  isSubmittingPost = true;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';

  try {
    const res = await fetch(`${API}/api/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, text, image, name, mood })
    });

    const newPost = await res.json();
    if (!res.ok) return alert(newPost?.error || 'Post failed. Please try again.');

    renderPost(newPost, true);
    postCount++;
    updateEmptyState();

    textArea.value = '';
    nameInput.value = '';
    moodSelect.value = '';
    closeModal();
  } catch (err) {
    console.error('Post failed', err);
    alert('Network error. Please try again.');
  } finally {
    // always restore for next time modal opens
    submitBtn.textContent = prevLabel; // usually "Submit"
    submitBtn.disabled = postCount >= MAX_POSTS;
    isSubmittingPost = false;
  }
});

let canvasReady = false;

// Init
window.addEventListener('DOMContentLoaded', () => {
  document.body.style.visibility = 'visible';
  resizeCanvas();
  loadPosts();
  updateEmptyState();
  updateCountdown();
  setInterval(updateCountdown, 60000);
});
