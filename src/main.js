// Refactored main.js for Scribsy — clean, modular, readable

import './style.css';

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
overlay.addEventListener('click', () => closeModal());
document.addEventListener('keydown', (e) => e.key === 'Escape' && closeModal());

function showModal() {
  modal.classList.remove('hidden');
  overlay.classList.remove('hidden');
  modal.classList.add('show');
  overlay.classList.add('show');
}

function closeModal() {
  modal.classList.remove('show');
  overlay.classList.remove('show');
  setTimeout(() => {
    modal.classList.add('hidden');
    overlay.classList.add('hidden');
  }, 300);
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
let isDrawing = false;
canvas.addEventListener('mousedown', (e) => {
  isDrawing = true;
  ctx.beginPath();
  ctx.moveTo(e.offsetX, e.offsetY);
});
canvas.addEventListener('mousemove', (e) => {
  if (isDrawing) {
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
});
canvas.addEventListener('mouseup', () => isDrawing = false);

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
    wall.appendChild(post);
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
    wall.appendChild(img);
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
