// Refactored main.js for Scribsy — clean, modular, readable

import html2canvas from 'html2canvas';
import './style.css';

window.addEventListener("DOMContentLoaded", () => {
  document.body.style.visibility = "visible";

  // ✅ DELAY RESET LOGIC UNTIL WALL IS LOADED
  requestAnimationFrame(() => {
    const lastReset = parseInt(localStorage.getItem('scribsyLastReset') || '0');
    const now = Date.now();
    const hoursPassed = (now - lastReset) / (1000 * 60 * 60);

    if (hoursPassed >= 24) {
      console.log('🕛 24 hours passed — resetting wall.');
      captureWall();
      wall.innerHTML = '';
      localStorage.setItem('scribsyLastReset', now.toString());
    } else {
      console.log(`⏳ Last reset was ${Math.floor(hoursPassed)} hour(s) ago.`);
    }
  });

  updateCountdown(); // <- keep this here
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
  const millisLeft = (24 * 60 * 60 * 1000) - (now - lastReset);

  if (millisLeft <= 0) {
    resetTimeText.textContent = 'Resetting soon...';
    return;
  }

  const hours = Math.floor(millisLeft / (1000 * 60 * 60));
  const minutes = Math.floor((millisLeft % (1000 * 60 * 60)) / (1000 * 60));
  resetTimeText.textContent = `Reset in: ${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
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
  const name = nameInput.value.trim() || 'Anonymous';
  const mood = moodSelect.value;

  if (writeTab.classList.contains('active')) {
    const text = textArea.value.trim();
    if (!text) return alert("Please write something first!");

    const post = document.createElement('div');
    post.textContent = `"${text}"\n– ${name}`;
    decoratePost(post, mood);

    const wrapper = document.createElement('div');
    wrapper.classList.add('post-wrapper');
    wrapper.appendChild(post);
    wall.appendChild(wrapper);

    textArea.value = '';
  } else {
    const imageData = canvas.toDataURL();
    const wrapper = document.createElement('div');
    wrapper.classList.add('post-wrapper');
    wrapper.style.backgroundColor = getMoodColor(mood);
    wrapper.style.padding = '10px';
    wrapper.style.borderRadius = '5px';
    wrapper.style.maxWidth = '200px';
    wrapper.style.boxShadow = '2px 2px 5px rgba(0,0,0,0.1)';
    wrapper.style.margin = '10px';
    wrapper.style.transform = `rotate(${randomRotation()}deg)`;

    const img = document.createElement('img');
    img.src = imageData;
    img.style.maxWidth = '100%';
    img.style.display = 'block';
    img.style.borderRadius = '4px';

    wrapper.appendChild(img);
    wall.appendChild(wrapper);


    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

    nameInput.value = '';
    moodSelect.value = '';
    closeModal();
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

  // Make sure wall has something in it
  if (!wall || wall.children.length === 0) {
    console.warn("Wall is empty, nothing to capture.");
    return;
  }

  // Force a slight delay to ensure DOM is settled
  requestAnimationFrame(() => {
    html2canvas(wall, { useCORS: true }).then((canvas) => {
      const imageData = canvas.toDataURL("image/png");

      if (!imageData || imageData === "data:,") {
        console.error("🛑 Image capture failed.");
        return;
      }

      const pastWalls = JSON.parse(localStorage.getItem('scribsyPastWalls') || '[]');
      pastWalls.unshift({
        image: imageData,
        date: new Date().toLocaleString()
      });

      localStorage.setItem('scribsyPastWalls', JSON.stringify(pastWalls));
      console.log('✅ Wall captured and saved!');
    });
  });
}

captureWall();
wall.innerHTML = '';
window.captureWall = captureWall;
localStorage.setItem('scribsyLastReset', Date.now().toString());


/*
document.getElementById('reset-button').addEventListener('click', () => {
  captureWall();         // 🧠 Save snapshot
  wall.innerHTML = '';   // 🧽 Clear the wall
}); */

/*
captureWall(); // save
wall.innerHTML = ''; // reset

document.getElementById('reset-button').addEventListener('click', () => {
  captureWall();
  wall.innerHTML = '';
});  */
