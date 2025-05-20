// Refactored main.js for Scribsy — clean, modular, readable

import html2canvas from 'html2canvas';
import './style.css';

let postCount = 0;
const MAX_POSTS = 20;

window.addEventListener("DOMContentLoaded", () => {
  document.body.style.visibility = "visible";

  requestAnimationFrame(() => {
    const lastReset = parseInt(localStorage.getItem('scribsyLastReset') || '0');
    const now = Date.now();
    const minutesPassed = (now - lastReset) / (1000 * 60);

    console.log(`⏳ Last reset was ${Math.floor(minutesPassed)} minute(s) ago.`);

    if (minutesPassed >= 3) {
      console.log('⏰ 3 minutes passed — resetting wall.');

      setTimeout(() => {
        captureWall(); // Save before clearing
        wall.innerHTML = '';
        localStorage.setItem('scribsyLastReset', Date.now().toString());
      }, 100); // Give time for layout to settle
    }
  });

  function checkAutoReset() {
    const lastReset = parseInt(localStorage.getItem('scribsyLastReset') || '0');
    const now = Date.now();
    const minutesPassed = (now - lastReset) / (1000 * 60);

    console.log(`⏳ Last reset was ${Math.floor(minutesPassed)} minute(s) ago.`);

    if (minutesPassed >= 3) {
      console.log('⏰ 3 minutes passed — resetting wall.');

      setTimeout(() => {
        captureWall();
        wall.innerHTML = '';
        updateEmptyState();
        localStorage.setItem('scribsyLastReset', Date.now().toString());
      }, 100);
    }
  }

  updateCountdown();
  setInterval(updateCountdown, 1000);
  setInterval(checkAutoReset, 10000); // check every 10 seconds

  updateEmptyState();


});


let canvasReady = false;

// DOM references
const createPostButton = document.getElementById('create-post');
const wall = document.getElementById('wall');
const resetTimeText = document.getElementById('reset-timer');
const modal = document.getElementById('post-modal');
const overlay = document.getElementById('overlay');
const closeBtn = document.getElementById('close-modal');
const writeTab = document.getElementById('write-tab');
const drawTab = document.getElementById('draw-tab');
const textArea = document.getElementById('post-text');

const canvas = document.getElementById('draw-canvas');
const ctx = canvas.getContext('2d');

const submitBtn = document.getElementById('submit-post');
const nameInput = document.getElementById('post-name');
const moodSelect = document.getElementById('mood-select');

// Countdown logic
function updateCountdown() {
  const lastReset = parseInt(localStorage.getItem('scribsyLastReset') || '0');
  const now = Date.now();
  const millisLeft = (3 * 60 * 1000) - (now - lastReset);

  if (millisLeft <= 0) {
    resetTimeText.textContent = 'Resetting soon...';
    return;
  }

  const minutes = Math.floor((millisLeft % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((millisLeft % (1000 * 60)) / 1000);
  resetTimeText.textContent = `Reset in: ${minutes}m ${seconds}s`;
}


// Modal controls
createPostButton.addEventListener('click', () => showModal());
closeBtn.addEventListener('click', () => closeModal());

overlay.addEventListener('click', (e) => {
  if (e.target === overlay) {
    closeModal();
  }
});

document.addEventListener('keydown', (e) => e.key === 'Escape' && closeModal());

function resizeCanvas() {
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;

  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  canvasReady = true;
}

function showModal() {
  modal.style.display = "flex";
  overlay.style.display = "block";

  requestAnimationFrame(() => {
    modal.classList.add("show");
    overlay.classList.add("show");

    // Wait 1 more frame to make sure canvas is visible
    setTimeout(() => {
      resizeCanvas();
    }, 50); // slight delay ensures rendering is fully done
  });
}

function closeModal() {
  modal.classList.remove("show");
  overlay.classList.remove("show");

  modal.addEventListener("transitionend", () => {
    modal.style.display = "none";
    overlay.style.display = "none";
    canvasReady = false; // reset for next open
  }, { once: true });
}

// Tab toggle logic
writeTab.addEventListener('click', () => {
  writeTab.classList.add('active');
  drawTab.classList.remove('active');
  textArea.style.display = 'block';
  canvas.classList.add('hidden');
  canvasReady = false;
});


drawTab.addEventListener('click', () => {
  drawTab.classList.add('active');
  writeTab.classList.remove('active');
  textArea.style.display = 'none';
  canvas.classList.remove('hidden');
  resizeCanvas(); // ← guarantee it's ready when switching to draw
});

// Drawing logic
let drawing = false;

canvas.addEventListener('mousedown', (e) => {
  if (!canvasReady) return;

  drawing = true;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  ctx.beginPath();
  ctx.moveTo(x, y);
});

canvas.addEventListener('mousemove', (e) => {
  if (!drawing || !canvasReady) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  ctx.lineTo(x, y);
  ctx.stroke();
});

canvas.addEventListener('mouseup', () => {
  drawing = false;
});


// Submission logic
submitBtn.addEventListener('click', () => {
  // 🚨 Spam-guard: session limit
  if (postCount >= MAX_POSTS) {
    return alert(`You’ve reached the maximum of ${MAX_POSTS} posts. Try again after reset!`);
  }

  const name = nameInput.value.trim() || 'Anonymous';
  const mood = moodSelect.value;

  if (writeTab.classList.contains('active')) {
    const text = textArea.value.trim();

    // 🚨 New: enforce the 150-char cap
    if (text.length === 0) {
      return alert("Please write something first!");
    }
    if (text.length > 150) {
      return alert("Your post is too long — please keep it under 100 characters.");
    }

    // ——— Build the wrapper and its content ———
    const wrapper = document.createElement('div');
    wrapper.classList.add('post-wrapper');

    const textEl = document.createElement('div');
    textEl.classList.add('post-text');
    textEl.textContent = `"${text}"`;

    // post footer with author + mood
    const footer = document.createElement('div');
    footer.classList.add('post-footer');

    // Left side: “by Name”
    const author = document.createElement('span');
    author.classList.add('post-author');
    author.textContent = `by ${name}`;

    // Right side: mood pill
    const moodPill = document.createElement('span');
    moodPill.classList.add('post-mood');
    moodPill.classList.add('post-mood', `post-mood--${mood || 'default'}`);
    moodPill.textContent = mood;

    footer.append(author, moodPill);

    // finalize
    wrapper.append(textEl, footer);
    decoratePost(wrapper, mood);

    // ——— Prepend and animate ———
    wall.prepend(wrapper);
    requestAnimationFrame(() => wrapper.classList.add('visible'));

    // ——— Update counters & state ———
    postCount++;
    updateEmptyState();

    // ——— Cooldown: disable submit for 5s or until under cap ———
    submitBtn.disabled = true;
    setTimeout(() => {
      submitBtn.disabled = postCount >= MAX_POSTS;
    }, 5000);

    // ——— Clear inputs & close modal ———
    textArea.value = '';
    nameInput.value = '';
    moodSelect.value = '';
    closeModal();
  
  } else {
    // ——— Build the wrapper ———
    const wrapper = document.createElement('div');
    wrapper.classList.add('post-wrapper');
    // after you create wrapper…
    wrapper.style.setProperty('--mood-color', getMoodColor(mood));
    wrapper.style.transform = `rotate(${randomRotation()}deg)`;

    // ——— Create & style the image ———
    const imageData = canvas.toDataURL();
    const img = document.createElement('img');
    img.src = imageData;
    img.style.maxWidth     = '100%';
    img.style.display      = 'block';
    img.style.borderRadius = '4px';
    wrapper.appendChild(img);

    // ——— Add footer (by Name + Mood pill) ———
    const footer = document.createElement('div');
    footer.classList.add('post-footer');

    const author = document.createElement('span');
    author.classList.add('post-author');
    author.textContent = `by ${name}`;

    const moodPill = document.createElement('span');
    moodPill.classList.add('post-mood', `post-mood--${mood || 'default'}`);
    moodPill.textContent = mood;

    footer.append(author, moodPill);
    wrapper.appendChild(footer);

    // ——— Prepend, animate & style ———
    wall.prepend(wrapper);
    requestAnimationFrame(() => wrapper.classList.add('visible'));

    // ——— Clear the drawing canvas ———
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ——— Update counters & state ———
    postCount++;
    updateEmptyState();
    submitBtn.disabled = true;
    setTimeout(() => {
      submitBtn.disabled = postCount >= MAX_POSTS;
    }, 5000);

    // ——— Close modal ———
    closeModal();
  }

});

const countDisplay = document.getElementById('char-count');
textArea.addEventListener('input', () => {
  countDisplay.textContent = `${textArea.value.length} / 150`;
});


function decoratePost(post, mood) {
  post.style.backgroundColor = getMoodColor(mood);
  post.style.padding = '10px';
  post.style.borderRadius = '5px';
  post.style.color = '#84572F';
  post.style.maxWidth = '200px';
  post.style.wordBreak = 'break-word';
  post.style.boxShadow = '2px 2px 5px rgba(0,0,0,0.1)';
  post.style.margin = '10px';
  post.style.whiteSpace = 'pre-line';
  post.style.transform = `rotate(${randomRotation()}deg)`;
}

function getMoodColor(mood) {
  switch (mood) {
    case 'Dreamy': return '#B3D9E0';
    case 'Happy': return '#F1A805';
    case 'Meh': return '#92ADA4';
    default: return '#EDD5C0';
  }
}

function randomRotation() {
  return Math.floor(Math.random() * 10) - 5;
}

//Capture Wall
function captureWall() {
  const wall = document.getElementById('wall');

  // 1️⃣ Bail if empty
  if (!wall || wall.children.length === 0) {
    console.warn("Wall is empty, nothing to capture.");
    return;
  }

  // 2️⃣ Clone the wall and strip out canvases
  const clone = wall.cloneNode(true);
  clone.querySelectorAll('canvas').forEach(c => c.remove());

  // 3️⃣ Render it off‐screen
  clone.style.position = 'fixed';
  clone.style.top = '-9999px';
  document.body.appendChild(clone);

  // 4️⃣ Capture the clone
  html2canvas(clone, { useCORS: true }).then(cnv => {
    const imageData = cnv.toDataURL("image/png");
    if (!imageData || imageData === "data:,") {
      console.error("🛑 Image capture failed.");
    } else {
      const pastWalls = JSON.parse(localStorage.getItem('scribsyPastWalls') || '[]');
      pastWalls.unshift({ image: imageData, date: new Date().toLocaleString() });
      localStorage.setItem('scribsyPastWalls', JSON.stringify(pastWalls));
      console.log('✅ Wall captured and saved!');
    }
  }).catch(err => {
    console.error("❌ Capture error:", err);
  }).finally(() => {
    // 5️⃣ Clean up
    document.body.removeChild(clone);
  });
}

window.captureWall = captureWall;

//EmptyState
function updateEmptyState() {
  const empty = document.getElementById('empty-state');
  empty.style.display = wall.children.length === 0 ? 'block' : 'none';
}
window.updateEmptyState = updateEmptyState;
