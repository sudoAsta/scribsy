// src/main.js

// ————————————————————————————————
// 1) STYLE IMPORT
// ————————————————————————————————
import './style.css';

const API = import.meta.env.VITE_API_URL;

// ————————————————————————————————
// 2) ADMIN MODE (Ctrl+Shift+A to unlock)
// ————————————————————————————————
async function hashString(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}
const ADMIN_HASH = 'f104d4c4d76bb8f19ece351c9dfd1f93422e4403d8ba32abe4906862de4d6302';
let isAdmin = false;

async function askForAdmin() {
  const attempt = prompt('Enter admin code:');
  if (attempt !== null && (await hashString(attempt)) === ADMIN_HASH) {
    isAdmin = true;
    document.body.classList.add('admin-mode');
    // retro-add delete buttons to existing posts
    document.querySelectorAll('.post-wrapper').forEach(addDeleteButton);
  }
}
// trigger on Ctrl+Shift+A
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.shiftKey && e.code === 'KeyA') askForAdmin();
});

// ————————————————————————————————
// 3) DOM REFERENCES
// ————————————————————————————————
const wall           = document.getElementById('wall');
const createPostBtn  = document.getElementById('create-post');
const modal          = document.getElementById('post-modal');
const overlay        = document.getElementById('overlay');
const closeModalBtn  = document.getElementById('close-modal');
const writeTab       = document.getElementById('write-tab');
const drawTab        = document.getElementById('draw-tab');
const textArea       = document.getElementById('post-text');
const charCount      = document.getElementById('char-count');
const canvas         = document.getElementById('draw-canvas');
const ctx            = canvas.getContext('2d');
const submitBtn      = document.getElementById('submit-post');
const nameInput      = document.getElementById('post-name');
const moodSelect     = document.getElementById('mood-select');

let postCount = 0;
const MAX_POSTS = 10;

// ————————————————————————————————
// COUNTDOWN TO NEXT MIDNIGHT
// ————————————————————————————————
function updateCountdown() {
  const now = new Date();
  // set to next midnight
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);

  const diff = next - now;
  if (diff <= 0) {
    document.querySelector('#reset-timer .reset-value').textContent = '0h 0m';
    return;
  }

  const hrs = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  document.querySelector('#reset-timer .reset-value').textContent =
    `${hrs}h ${mins}m`;
}

// run at startup…
updateCountdown();

// …and every minute
setInterval(updateCountdown, 60 * 1000);

// ————————————————————————————————
// RANDOM ROTATION HELPER
// ————————————————————————————————
function randomRotation() {
  return Math.floor(Math.random() * 10) - 5; // ±5°
}

// ————————————————————————————————
// 4) RENDERING & DELETION HELPERS (Step 5B & 5E)
// ————————————————————————————————
function renderPost(post, prepend = false) {
  const wrapper = document.createElement('div');
  wrapper.classList.add('post-wrapper');
  wrapper.dataset.id = post.id;
  wrapper.style.backgroundColor = getMoodColor(post.mood);
  wrapper.style.transform = `rotate(${randomRotation()}deg)`;

  // content
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

  // footer (by name + mood)
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

  // admin delete
  if (isAdmin) addDeleteButton(wrapper);

  // insert
  if (prepend) wall.prepend(wrapper);
  else        wall.append(wrapper);

  // animate
  requestAnimationFrame(() => wrapper.classList.add('visible'));
}

function addDeleteButton(wrapper) {
  if (wrapper.querySelector('.post-delete')) return;
  const btn = document.createElement('button');
  btn.className = 'post-delete';
  btn.textContent = '✕';
  btn.addEventListener('click', async () => {
    await fetch(`${API}/api/posts/${wrapper.dataset.id}`, {
      method: 'DELETE',
      headers: { 'x-admin-key': 'scribsyAdmin123' }
    });
    wrapper.remove();
    updateEmptyState();
    postCount = Math.max(0, postCount - 1);
  });
  wrapper.append(btn);
}

// returns a background color for each mood
function getMoodColor(mood) {
  switch (mood) {
    case 'Dreamy': return '#B3D9E0';
    case 'Happy':  return '#F1A805';
    case 'Meh':    return '#F2D6A1';
    default:       return '#EDD5C0';
  }
}

// ————————————————————————————————
// 5) EMPTY-STATE HANDLER
// ————————————————————————————————
function updateEmptyState() {
  const empty = document.getElementById('empty-state');
  empty.style.display = wall.children.length === 0 ? 'block' : 'none';
}

// ————————————————————————————————
// 6) INITIAL LOAD (Step 5C)
// ————————————————————————————————
async function loadPosts() {
  try {
    const res   = await fetch(`${API}/api/posts`);
    const posts = await res.json();
    posts.forEach(p => renderPost(p, false));
    updateEmptyState();
  } catch (err) {
    console.error('Failed to load posts', err);
  }
}

// ————————————————————————————————
// 7) MODAL CONTROLS
// ————————————————————————————————
createPostBtn.addEventListener('click', () => showModal());
closeModalBtn.addEventListener('click', () => closeModal());
overlay.addEventListener('click', e => e.target === overlay && closeModal());
document.addEventListener('keydown', e => e.key === 'Escape' && closeModal());

function resizeCanvas() {
  canvas.width  = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  ctx.strokeStyle = '#000';
  ctx.lineWidth   = 2;
  ctx.lineCap     = 'round';
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // ◀ mark ready for drawing
  canvasReady = true;
}

function showModal() {
  modal.style.display   = 'flex';
  overlay.style.display = 'block';
  requestAnimationFrame(() => {
    modal.classList.add('show');
    overlay.classList.add('show');
    setTimeout(resizeCanvas, 50);
  });
}

function closeModal() {
  modal.classList.remove('show');
  overlay.classList.remove('show');
  modal.addEventListener('transitionend', () => {
    modal.style.display   = 'none';
    overlay.style.display = 'none';
  }, { once: true });
}

// ————————————————————————————————
// 8) TAB SWITCHING & CHAR-COUNT (Step 5D)
// ————————————————————————————————
writeTab.addEventListener('click', () => {
  writeTab.classList.add('active');
  drawTab.classList.remove('active');
  textArea.style.display = 'block';
  canvas.style.display   = 'none';
  charCount.style.display = 'block';
  charCount.textContent   = `${textArea.value.length} / 100`;
});

drawTab.addEventListener('click', () => {
  drawTab.classList.add('active');
  writeTab.classList.remove('active');
  textArea.style.display = 'none';
  canvas.style.display   = 'block';
  charCount.style.display = 'none';

  // ◀ NEW: size it right now
  canvasReady = false;
  resizeCanvas();
});

// live count
textArea.addEventListener('input', () => {
  charCount.textContent = `${textArea.value.length} / 100`;
});

// ————————————————————————————————
// 9) DRAWING LOGIC
// ————————————————————————————————
let drawing = false;

canvas.addEventListener('mousedown', e => {
  if (!canvasReady) return;      // don’t start if not ready
  drawing = true;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  ctx.beginPath();
  ctx.moveTo(x, y);
});

canvas.addEventListener('mousemove', e => {
  if (!drawing) return;          // only draw when mouse is down
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  ctx.lineTo(x, y);
  ctx.stroke();
});

canvas.addEventListener('mouseup', () => {
  drawing = false;
});
canvas.addEventListener('mouseleave', () => {
  drawing = false;
});

// ————————————————————————————————
// 10) SUBMIT HANDLER (Step 5D)
// ————————————————————————————————
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
    if (text.length > 100) return alert('Keep under 100 characters.');
    type = 'text';
  } else {
    image = canvas.toDataURL();
    type = 'image';
  }

  // build & send
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

  // cooldown & cleanup
  submitBtn.disabled = true;
  setTimeout(() => submitBtn.disabled = postCount >= MAX_POSTS, 5000);
  textArea.value = '';
  nameInput.value = '';
  moodSelect.value = '';
  closeModal();
});

// ————————————————————————————————
// 11) INITIALIZE ON LOAD
// ————————————————————————————————
let canvasReady = false;
window.addEventListener('DOMContentLoaded', () => {
  document.body.style.visibility = 'visible';
  resizeCanvas();
  loadPosts();
  updateEmptyState();
  updateCountdown();
  setInterval(updateCountdown, 60000); 
});
