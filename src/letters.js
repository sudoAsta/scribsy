// src/letters.js
import './letters.css';

const API = window.location.hostname.includes('localhost')
  ? 'http://localhost:4000'
  : 'https://api.scribsy.io';

// ── Admin login (same behavior as main wall) ──
let isAdmin = false;

async function askForAdmin() {
  const password = prompt('Enter admin password:');
  if (!password) return;

  const res = await fetch(`${API}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });

  const data = await res.json();
  if (!res.ok) {
    alert(data.error || 'Login failed');
    return;
  }

  localStorage.setItem('scribsy-admin-token', data.token);
  isAdmin = true;
  document.body.classList.add('admin-mode');

  // Add delete button to all existing cards
  document.querySelectorAll('.letter-card').forEach(addDeleteButton);
}

// Keyboard shortcut: Ctrl + Shift + A
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.shiftKey && e.code === 'KeyA') {
    askForAdmin();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const splash = document.getElementById('letters-hero-splash');

  if (splash) {
    // lock scroll while hero is visible
    document.body.classList.add('letters-splash-active');

    // let the typewriter play, then fade out
    setTimeout(() => {
      splash.classList.add('is-hidden');

      // after fade-out completes, allow scroll again
      setTimeout(() => {
        document.body.classList.remove('letters-splash-active');
      }, 650); // matches CSS transition duration
    }, 6000); // ~4s: enough for most of the type effect
  }

  // ...existing letters.js setup (fetch, filters, etc.)...
});

// ── DOM refs ─────────────────────────────────
const writeBtn        = document.getElementById('write-letter-btn');
const grid            = document.getElementById('letter-grid');
const readModal       = document.getElementById('letter-modal');
const modalContent    = document.getElementById('modal-content');
const composeModal    = document.getElementById('compose-modal');
const composeContent  = document.getElementById('compose-content');
const filterSelect    = document.getElementById('letters-filter');
const dockMoodButtons = document.querySelectorAll('.letters-dock-mood');
const dockWriteBtn    = document.getElementById('letters-dock-write');

// ── State ────────────────────────────────────
let composeBuilt = false;
let currentMood  = 'all';
let nextCursor   = null;
let isLoading    = false;
let reachedEnd   = false;
let cardSequence = 0;

// ── Utils ───────────────────────────────────
function escapeHtml(str = '') {
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));
}

function moodColor(mood) {
  switch (mood) {
    case 'Dreamy': return '#B3D9E0';
    case 'Happy':  return '#F1A805';
    case 'Sad':    return '#92ADA4';
    case 'Meh':    return '#F2D6A1';
    case 'Rant':   return '#F36949';
    default:       return '#E0DCD5';
  }
}

function timeAgo(value) {
  if (!value) return '';
  const ts = typeof value === 'number' ? value : Date.parse(value);
  if (Number.isNaN(ts)) return '';
  const now  = Date.now();
  const diff = Math.floor((now - ts) / 1000); // seconds

  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hour ago`;

  const days = Math.floor(diff / 86400);
  if (days === 1) return 'Yesterday';
  if (days < 30)  return `${days} days ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month ago`;

  const years = Math.floor(months / 12);
  return `${years} year ago`;
}

function addDeleteButton(card) {
  if (card.querySelector('.letter-delete-btn')) return;

  const btn = document.createElement('button');
  btn.className = 'letter-delete-btn';
  btn.textContent = '✕';

  btn.addEventListener('click', async e => {
    e.stopPropagation(); // don’t open modal when deleting
    if (!confirm('Delete this Letter?')) return;

    const token = localStorage.getItem('scribsy-admin-token') || '';
    const res = await fetch(`${API}/api/letters/${card.dataset.id}`, {
      method: 'DELETE',
      headers: { 'x-auth-token': token }
    });

    if (!res.ok) {
      alert('Delete failed');
      return;
    }
    card.remove();
  });

  card.append(btn);
}

// ── Compose modal ───────────────────────────
function buildComposeModal() {
  if (composeBuilt) return;
  composeBuilt = true;

  // Inject modal HTML once
  composeContent.innerHTML = `
    <button id="compose-close" class="letters-modal-close">✕</button>

    <h2 class="letters-modal-title">Write a Letter</h2>
    <p class="letters-modal-desc">
      Here lies the quiet side of Scribsy — a place for deeper thoughts.
      Write your Letter openly and anonymously. These words won’t disappear.
      Share anything: rants, confessions, love letters, apologies, reflections, stories —
      even letters to the universe.
    </p>

    <textarea id="letter-text"
      class="letters-textarea"
      placeholder="Let it all out…"></textarea>

    <div id="letter-char-count" class="letters-char-count">
      0 / 5000
    </div>

    <div class="letters-editor-row">
      <input id="letter-name"
        class="letters-input"
        type="text"
        placeholder="Name (optional)" />

      <select id="letter-mood" class="letters-select">
        <option value="">Select mood (optional)</option>
        <option value="Dreamy">💭 Dreamy</option>
        <option value="Happy">🙂 Happy</option>
        <option value="Sad">😭 Sad</option>
        <option value="Meh">😐 Meh</option>
        <option value="Rant">😤 Rant</option>
      </select>
    </div>

    <button id="letter-submit" class="letters-submit-btn">
      Publish Letter
    </button>
  `;

  // 🔍 IMPORTANT: scope queries to the composeContent
  const textEl   = composeContent.querySelector('#letter-text');
  const countEl  = composeContent.querySelector('#letter-char-count');
  const nameEl   = composeContent.querySelector('#letter-name');
  const moodEl   = composeContent.querySelector('#letter-mood');
  const submitEl = composeContent.querySelector('#letter-submit');
  const closeBtn = composeContent.querySelector('#compose-close');

  if (!textEl || !countEl || !nameEl || !moodEl || !submitEl || !closeBtn) {
    console.error('Letters compose modal elements missing:', {
      textEl, countEl, nameEl, moodEl, submitEl, closeBtn
    });
    return;
  }

  textEl.value = '';
  countEl.textContent = '0 / 5000';

  textEl.addEventListener('input', () => {
    if (textEl.value.length > 5000) {
      textEl.value = textEl.value.slice(0, 5000);
    }
    countEl.textContent = `${textEl.value.length} / 5000`;
  });

  closeBtn.addEventListener('click', closeComposeModal);

  submitEl.addEventListener('click', async () => {
    const text = textEl.value.trim();
    if (text.length < 20) {
      alert('Please write at least 20 characters for a Letter.');
      return;
    }

    const name = nameEl.value.trim() || 'Anonymous';
    const mood = moodEl.value || 'default';

    submitEl.disabled = true;
    submitEl.textContent = 'Publishing…';

    try {
      const res = await fetch(`${API}/api/letters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, name, mood })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to publish Letter.');
      } else {
        renderLetterCard(data, true);
        closeComposeModal();
      }
    } catch (err) {
      console.error('Create letter failed:', err);
      alert('Something went wrong. Please try again.');
    } finally {
      submitEl.disabled = false;
      submitEl.textContent = 'Publish Letter';
    }
  });
}

function openComposeModal() {
  buildComposeModal();
  document.body.classList.add('letters-modal-open'); // lock scroll
  composeModal.style.display = 'flex';
  composeModal.addEventListener('click', composeBackdropClose);
  document.addEventListener('keydown', composeEscClose);
}

function closeComposeModal() {
  composeModal.style.display = 'none';
  composeModal.removeEventListener('click', composeBackdropClose);
  document.removeEventListener('keydown', composeEscClose);
  document.body.classList.remove('letters-modal-open'); // unlock scroll
}

function composeBackdropClose(e) {
  if (e.target === composeModal) closeComposeModal();
}

function composeEscClose(e) {
  if (e.key === 'Escape') closeComposeModal();
}

// Top write button (if it exists anywhere)
if (writeBtn) {
  writeBtn.addEventListener('click', openComposeModal);
}

// Dock write button always opens compose modal
if (dockWriteBtn) {
  dockWriteBtn.addEventListener('click', openComposeModal);
} 

// ── Read modal ──────────────────────────────
function openReadModal(letter) {
  const safeText   = escapeHtml(letter.text);
  const safeName   = escapeHtml(letter.name || 'Anonymous');
  const date       = timeAgo(letter.createdAt);
  const mood       = letter.mood || 'default';
  const reactions  = letter.reactions || {};
  const emojis     = ['🔥','💗','😂','😲','😡','💩'];

  modalContent.innerHTML = `
    <button id="modal-close" class="letters-modal-close">✕</button>

    <header class="letters-modal-header">
      <div class="letter-card-header">
        <div class="letter-avatar">
          ${safeName.charAt(0).toUpperCase()}
        </div>
        <div class="letter-meta">
          <span class="letter-meta-name">${safeName}</span>
          <span class="letter-meta-date">${date}</span>
        </div>
        <span class="letter-mood-pill" style="background:${moodColor(mood)};">
          ${mood === 'default' ? 'Letter' : mood}
        </span>
      </div>
    </header>

    <article class="letters-modal-body">
      ${safeText}
    </article>

    <footer class="letters-modal-footer">
      <div class="letters-reactions">
        ${emojis.map(e => `
          <button class="letters-react-btn" data-emoji="${e}">
            <span class="letters-react-emoji">${e}</span>
            <span class="letters-react-count">${reactions[e] || 0}</span>
          </button>
        `).join('')}
      </div>

      <button id="letters-report-btn" class="letters-report-btn">
        <span class="letters-report-flag">🚩</span>
        <span class="letters-report-label">Report this Letter</span>
      </button>
    </footer>
  `;

  readModal.style.display = 'flex';
  document.body.classList.add('letters-modal-open');

  const closeBtn = document.getElementById('modal-close');
  closeBtn.addEventListener('click', closeReadModal);
  readModal.addEventListener('click', readBackdropClose);
  document.addEventListener('keydown', readEscClose);

  const reactButtons = modalContent.querySelectorAll('.letters-react-btn');
  reactButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const emoji = btn.dataset.emoji;

      // tiny emoji pop on click
      const emojiSpan = btn.querySelector('.letters-react-emoji');
      if (emojiSpan) {
        emojiSpan.classList.remove('is-popping');
        void emojiSpan.offsetWidth; // restart animation
        emojiSpan.classList.add('is-popping');
      }

      try {
        const res = await fetch(`${API}/api/letters/${letter.id}/react`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emoji })
        });
        const data = await res.json();
        if (data.reactions) {
          reactButtons.forEach(rb => {
            const e = rb.dataset.emoji;
            const countEl = rb.querySelector('.letters-react-count');
            countEl.textContent = data.reactions[e] || 0;
          });
          letter.reactions = data.reactions;
        }
      } catch (err) {
        console.error('React failed:', err);
      }
    });
  });

  const reportBtn = document.getElementById('letters-report-btn');
  reportBtn.addEventListener('click', async () => {
    if (!confirm('Report this Letter as inappropriate?')) return;
    try {
      const res = await fetch(`${API}/api/letters/${letter.id}/report`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to report Letter.');
        return;
      }
      reportBtn.innerHTML = `
        <span class="letters-report-flag">🚩</span>
        <span class="letters-report-label">Letter reported. Thank you.</span>
      `;
      reportBtn.disabled = true;
      reportBtn.classList.add('is-disabled');
    } catch (err) {
      console.error('Report failed:', err);
      alert('Something went wrong. Please try again.');
    }
  });
}

function closeReadModal() {
  readModal.style.display = 'none';
  readModal.removeEventListener('click', readBackdropClose);
  document.removeEventListener('keydown', readEscClose);
  document.body.classList.remove('letters-modal-open');
}

function readBackdropClose(e) {
  if (e.target === readModal) closeReadModal();
}

function readEscClose(e) {
  if (e.key === 'Escape') closeReadModal();
}

// ── Card rendering ──────────────────────────
function renderLetterCard(letter, prepend = false) {
  const safeName = escapeHtml(letter.name || 'Anonymous');
  const date     = timeAgo(letter.createdAt);
  const mood     = letter.mood || 'default';
  const fullText = letter.text || '';
  const preview  = fullText.length > 220
    ? `${fullText.slice(0, 220)}…`
    : fullText;

  const card = document.createElement('article');
  card.className = 'letter-card';
  card.dataset.id = letter.id;
  card.style.borderTop = `4px solid ${moodColor(mood)}`;

  card.innerHTML = `
    <header class="letter-card-header">
      <span class="letter-meta-date">${date}</span>
    </header>

    <div class="letter-preview">
      ${escapeHtml(preview)}
    </div>

    <footer class="letter-card-footer">
      <div class="letter-footer-left">
        <div class="letter-avatar">
          ${safeName.charAt(0).toUpperCase()}
        </div>
        <span class="letter-meta-name">${safeName}</span>
      </div>

      <span class="letter-mood-pill"
        data-mood="${mood}"
        style="background:${moodColor(mood)};">
        ${mood === 'default' ? 'Letter' : mood}
      </span>
    </footer>
  `;

  // Animate card in with a subtle stagger
  card.classList.add('letter-card--enter');
  const delay = Math.min(cardSequence * 40, 260);
  card.style.animationDelay = `${delay}ms`;
  cardSequence += 1;

  card.addEventListener('animationend', () => {
    card.classList.remove('letter-card--enter');
    card.style.animationDelay = '';
  });

  // Open full letter on card click
  card.addEventListener('click', (e) => {
    if (e.target.closest('.letter-delete-btn')) return; // don't open when deleting
    openReadModal(letter);
  });

  // Micro tilt based on mouse position
  const maxTilt = 4; // degrees
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const percentX = (x - centerX) / centerX; // -1 to 1
    const percentY = (y - centerY) / centerY; // -1 to 1

    const rotateY = percentX * maxTilt;      // left/right
    const rotateX = -percentY * maxTilt;     // up/down (invert for natural feel)

    card.style.setProperty('--card-rotate-x', `${rotateX.toFixed(2)}deg`);
    card.style.setProperty('--card-rotate-y', `${rotateY.toFixed(2)}deg`);
  });

  card.addEventListener('mouseleave', () => {
    card.style.setProperty('--card-rotate-x', '0deg');
    card.style.setProperty('--card-rotate-y', '0deg');
  });

  if (document.body.classList.contains('admin-mode')) {
    addDeleteButton(card);
  }

  if (prepend) grid.prepend(card);
  else grid.append(card);

}

function beginGridTransition() {
  if (!grid) return;
  grid.classList.remove('letters-grid--fade-in');
  grid.classList.add('letters-grid--fade-out');
}

function endGridTransition() {
  if (!grid) return;
  grid.classList.remove('letters-grid--fade-out');
  grid.classList.add('letters-grid--fade-in');
  setTimeout(() => {
    grid.classList.remove('letters-grid--fade-in');
  }, 260);
}

// ── Loading / filters / infinite scroll ─────
async function loadLetters(loadMore = false) {
  if (isLoading || (loadMore && reachedEnd)) return;

  isLoading = true;

  if (!loadMore) {
    beginGridTransition();
    grid.innerHTML = '';
    nextCursor = null;
    reachedEnd = false;
  }

  try {
    const params = new URLSearchParams();
    params.set('limit', '20');
    if (currentMood && currentMood !== 'all') {
      params.set('mood', currentMood);
    }
    if (loadMore && nextCursor) {
      params.set('cursor', String(nextCursor));
    }

    const res = await fetch(`${API}/api/letters?${params.toString()}`);
    if (!res.ok) {
      console.error('Failed to load letters:', await res.text());
      return;
    }

    const data = await res.json();

    // Support both:
    //  - old API:   [ ...letters ]
    //  - new API:   { letters: [...], nextCursor: number|null }
    let list = [];
    let newCursor = null;

    if (Array.isArray(data)) {
      list = data;
      newCursor = null;
    } else if (data && Array.isArray(data.letters)) {
      list = data.letters;
      newCursor = data.nextCursor ?? null;
    }

    // If no letters for this mood, show a friendly empty state
    if (!loadMore && list.length === 0) {
      grid.innerHTML = `
        <div class="letters-empty">
          <div class="letters-empty-emoji">🕊</div>
          <p class="letters-empty-title">It’s quiet here.</p>
          <p class="letters-empty-text">
            No Letters in this mood yet. Be the first to share something.
          </p>
        </div>
      `;
      nextCursor = null;
      reachedEnd = true;
      return;
    }

    list.forEach(letter => renderLetterCard(letter));

    nextCursor = newCursor;
    if (!newCursor || list.length === 0) {
      reachedEnd = true;
    }
    } catch (err) {
    console.error('Network error loading letters:', err);
    } finally {
      if (!loadMore) {
        endGridTransition();
      }
      isLoading = false;
    }
}

// Top select filter (still works even if hidden)
if (filterSelect) {
  filterSelect.addEventListener('change', () => {
    currentMood = filterSelect.value || 'all';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    loadLetters(false);
  });
}

// Dock mood filters (bottom toolbar)
if (dockMoodButtons.length) {
  dockMoodButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const mood = btn.dataset.mood || 'all';
      currentMood = mood === 'all' ? 'all' : mood;

      if (filterSelect) {
        filterSelect.value = currentMood;
      }

      dockMoodButtons.forEach(b => {
        const isActive = b === btn;
        b.classList.toggle('is-active', isActive);
        b.classList.remove('is-pulsing');
      });

      // retrigger pulse animation on the clicked one
      void btn.offsetWidth; // force reflow so animation can restart
      btn.classList.add('is-pulsing');

      window.scrollTo({ top: 0, behavior: 'smooth' });
      loadLetters(false);
    });
  });
}

// Infinite scroll
window.addEventListener('scroll', () => {
  const nearBottom =
    window.innerHeight + window.scrollY >= document.body.offsetHeight - 400;

  if (nearBottom) {
    loadLetters(true);
  }
});

// Initial load
window.addEventListener('DOMContentLoaded', () => {
  loadLetters(false);
});
