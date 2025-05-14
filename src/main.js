// Refactored main.js for Scribsy — clean, modular, readable

import './style.css';

window.addEventListener("DOMContentLoaded", () => {
  document.body.style.visibility = "visible";
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
let hours = 23;
let minutes = 59;
function updateCountdown() {
  resetTimeText.textContent = `Reset in: ${hours} hours ${minutes} minutes`;
  if (minutes === 0) {
    if (hours === 0) {
      resetTimeText.textContent = "Reset soon!";
      return;
    }
    hours--;
    minutes = 59;
  } else {
    minutes--;
  }
}
setInterval(updateCountdown, 60000);
updateCountdown();

// Modal controls
createPostButton.addEventListener('click', () => showModal());
closeBtn.addEventListener('click', () => closeModal());

overlay.addEventListener('click', (e) => {
  if (e.target === overlay) {
    closeModal();
  }
});

document.addEventListener('keydown', (e) => e.key === 'Escape' && closeModal());

function showModal() {
  modal.style.display = "flex";
  overlay.style.display = "block";

  requestAnimationFrame(() => {
    modal.classList.add("show");
    overlay.classList.add("show");

    // Wait 1 more frame to make sure canvas is visible
    setTimeout(() => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;

      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvasReady = true; // 🟢 Enable drawing

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
});

drawTab.addEventListener('click', () => {
  drawTab.classList.add('active');
  writeTab.classList.remove('active');
  textArea.style.display = 'none';
  canvas.classList.remove('hidden');
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
  const img = document.createElement('img');
  img.src = imageData;
  img.style.maxWidth = '200px';
  img.style.borderRadius = '5px';
  img.style.boxShadow = '2px 2px 5px rgba(0,0,0,0.1)';
  img.style.margin = '10px';
  img.style.transform = `rotate(${randomRotation()}deg)`;

  const wrapper = document.createElement('div');
  wrapper.classList.add('post-wrapper');
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
