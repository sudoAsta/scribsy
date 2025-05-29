import './style.css';

const API = import.meta.env.VITE_API_URL;

// ─── Load & render archives ─────────────────────────────
async function loadArchives() {
  const noArchives = document.getElementById('no-archives');
  const container  = document.getElementById('archives-container');
  container.innerHTML = '';
  noArchives.style.display = 'none';

  try {
    const res = await fetch(`${API}/api/archives`);
    const archives = await res.json();

    if (!archives.length) {
      noArchives.style.display = 'block';
    } else {
      archives.forEach(renderArchive);
    }
  } catch (err) {
    console.error('Failed to load archives:', err);
    noArchives.textContent = 'Unable to load archives.';
    noArchives.style.display = 'block';
  }
}

// ─── Kick things off on DOM ready ───────────────────────
window.addEventListener('DOMContentLoaded', () => {
  loadArchives();
});


// ─── Mood-color helper (keep in sync with main.js) ─────────
function getMoodColor(mood) {
  switch (mood) {
    case 'Dreamy': return '#B3D9E0';
    case 'Happy':  return '#F1A805';
    case 'Meh':    return '#658A7F';
    default:       return '#EDD5C0';
  }
}

// ─── Render one post into a given container ───────────────
function renderPost(post, container) {
  const wrapper = document.createElement('div');
  wrapper.classList.add('post-wrapper');
  wrapper.style.backgroundColor = getMoodColor(post.mood);
  wrapper.style.transform = `rotate(${Math.floor(Math.random()*10) - 5}deg)`;

  if (post.type === 'text') {
    const txt = document.createElement('div');
    txt.className = 'post-text';
    txt.textContent = `"${post.text}"`;
    wrapper.append(txt);
  } else {
    const img = document.createElement('img');
    img.src = post.image;
    img.alt = `Drawing by ${post.name}, mood: ${post.mood}`;
    wrapper.append(img);
  }

  const footer = document.createElement('div');
  footer.className = 'post-footer';

  const author = document.createElement('span');
  author.className = 'post-author';
  author.textContent = `by ${post.name}`;

  const pill = document.createElement('span');
  pill.className = `post-mood post-mood--${post.mood}`;
  pill.textContent = post.mood;

  footer.append(author, pill);
  wrapper.append(footer);

  container.append(wrapper);
}

// ─── Render one archive batch ─────────────────────────────
function renderArchive(entry) {
  const main = document.getElementById('archives-container');

  const section = document.createElement('section');
  section.classList.add('archive-section');

  const heading = document.createElement('h2');
  heading.textContent = new Date(entry.date).toLocaleString();
  section.append(heading);

  const wall = document.createElement('div');
  wall.id = 'wall';  // reuses your masonry CSS

  entry.posts.forEach(post => renderPost(post, wall));

  section.append(wall);
  main.append(section);
}

// ─── Fetch & display archives on load ────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  const noArchives = document.getElementById('no-archives');
  const container  = document.getElementById('archives-container');

  try {
    const res = await fetch(`${API}/api/archives`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const archives = await res.json();

    if (!archives.length) {
      noArchives.style.display = 'block';
    } else {
      archives.forEach(renderArchive);
    }
  } catch (err) {
    console.error('Failed to load archives:', err);
    noArchives.textContent = 'Unable to load archives. Please try again later.';
    noArchives.style.display = 'block';
  }
});
