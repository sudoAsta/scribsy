import './style.css';

let hours = 23;
let minutes = 59;

function updateCountdown() {
  const resetTimeText = document.getElementById('reset-timer');
  resetTimeText.textContent = `Reset in: ${hours} hours ${minutes} minutes`;

  if (minutes === 0) {
    if (hours === 0) {
      resetTimeText.textContent = "Reset soon!";
      return;
    } else {
      hours--;
      minutes = 59;
    }
  } else {
    minutes--;
  }
}

setInterval(updateCountdown, 60000); // Update every 1 minute
updateCountdown(); // Call once at start

let postCount = 0;
const postLimit = 10;
const createPostButton = document.getElementById('create-post');
const wall = document.getElementById('wall');

createPostButton.addEventListener('click', () => {
  if (postCount >= postLimit) {
  alert("Whoa! You've reached the max posts allowed for now. Come back later!");
  return;
  }

  /* Simple prompt to get user input
  let text = prompt("What's on your mind?");
  if (text && text.length > 100) {
    text = text.substring(0, 100) + "...";
  } */

  if (text) {
    const post = document.createElement('div');
    post.textContent = text;
    post.style.backgroundColor = '#EDD5C0'; // Sugar Cookie color
    post.style.padding = '10px';
    post.style.borderRadius = '5px';
    post.style.color = '#84572F';
    post.style.maxWidth = '200px';
    post.style.wordBreak = 'break-word';
    post.style.boxShadow = '2px 2px 5px rgba(0,0,0,0.1)';
    post.style.margin = '10px';

    // NEW: Random slight rotation
    const randomRotation = Math.floor(Math.random() * 10) - 5; // -5 to +5 degrees
    post.style.transform = `rotate(${randomRotation}deg)`;

    wall.appendChild(post);

    postCount++; // 🆕 Increase counter
  }

  if (drawTab.classList.contains('active')) {
  const imageData = canvas.toDataURL(); // Convert drawing to image

  const img = document.createElement('img');
  img.src = imageData;
  img.style.maxWidth = '200px';
  img.style.borderRadius = '5px';
  img.style.boxShadow = '2px 2px 5px rgba(0,0,0,0.1)';
  img.style.margin = '10px';

  const randomRotation = Math.floor(Math.random() * 10) - 5;
  img.style.transform = `rotate(${randomRotation}deg)`;

  document.getElementById('wall').appendChild(img);

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

}); 

const pastWallsButton = document.getElementById('past-walls');
pastWallsButton.addEventListener('click', () => {
  alert("Past Walls coming soon!");
});

//this is modal
const modal = document.getElementById('post-modal');
const overlay = document.getElementById('overlay');
const openBtn = document.getElementById('create-post');
const closeBtn = document.getElementById('close-modal');

openBtn.addEventListener('click', () => {
  modal.classList.remove('hidden');
  overlay.classList.remove('hidden');
  modal.classList.add('show');
  overlay.classList.add('show');
});

closeBtn.addEventListener('click', closeModal);
overlay.addEventListener('click', closeModal);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

function closeModal() {
  modal.classList.remove('show');
  overlay.classList.remove('show');
  setTimeout(() => {
    modal.classList.add('hidden');
    overlay.classList.add('hidden');
  }, 300);
}

//modal write/draw tab
const writeTab = document.getElementById('write-tab');
const drawTab = document.getElementById('draw-tab');
const textArea = document.getElementById('post-text');
const canvas = document.getElementById('draw-canvas');

writeTab.addEventListener('click', () => {
  writeTab.classList.add('active');
  drawTab.classList.remove('active');
  textArea.style.display = 'block';
  canvas.classList.add('hidden');
  // drawingCanvas.style.display = 'none'; ← will add this later
});

drawTab.addEventListener('click', () => {
  drawTab.classList.add('active');
  writeTab.classList.remove('active');
  textArea.style.display = 'none';
  canvas.classList.remove('hidden');
  // drawingCanvas.style.display = 'block'; ← will add this later
});

//text-based posts
const submitBtn = document.getElementById('submit-post');
const nameInput = document.getElementById('post-name');
const moodSelect = document.getElementById('mood-select');

submitBtn.addEventListener('click', () => {
  const text = textArea.value.trim();
  const name = nameInput.value.trim() || 'Anonymous';
  const mood = moodSelect.value;

  if (writeTab.classList.contains('active') && !text) {
  alert("Please write something first!");
  return;
  }

  const post = document.createElement('div');
  post.classList.add('post-tile');
  post.textContent = `"${text}"\n– ${name}`;

  post.style.backgroundColor = '#EDD5C0';
  post.style.padding = '10px';
  post.style.borderRadius = '5px';
  post.style.color = '#84572F';
  post.style.maxWidth = '200px';
  post.style.wordBreak = 'break-word';
  post.style.boxShadow = '2px 2px 5px rgba(0,0,0,0.1)';
  post.style.margin = '10px';
  post.style.whiteSpace = 'pre-line';

  const randomRotation = Math.floor(Math.random() * 10) - 5;
  post.style.transform = `rotate(${randomRotation}deg)`;

  if (mood === 'Dreamy') post.style.backgroundColor = '#B3D9E0';
  if (mood === 'Happy') post.style.backgroundColor = '#F1A805';
  if (mood === 'Meh') post.style.backgroundColor = '#92ADA4';

  document.getElementById('wall').appendChild(post);

  // Clear form & close modal
  textArea.value = '';
  nameInput.value = '';
  moodSelect.value = '';
  closeModal();
});

const ctx = canvas.getContext('2d');
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

canvas.addEventListener('mouseup', () => {
  isDrawing = false;
});





