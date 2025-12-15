// src/themes/christmas.particles.js

let rafId = null;
let canvas = null;
let ctx = null;
let particles = [];
let running = false;

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function getParticleCount(width, height) {
  const area = width * height;
  const base = Math.floor(area / 22000);
  return Math.max(25, Math.min(base, 80));
}

function createParticles(count, w, h) {
  particles = Array.from({ length: count }, () => {
    const depth = Math.random(); // 0..1

    let r, vy, alpha;

    if (depth > 0.9) {
      // Big foreground flakes (rare)
      r = rand(3.5, 6.0);
      vy = rand(0.8, 1.6);
      alpha = rand(0.65, 0.9);
    } else if (depth > 0.7) {
      // Medium flakes
      r = rand(2.2, 3.5);
      vy = rand(0.45, 0.9);
      alpha = rand(0.4, 0.65);
    } else {
      // Snow dust (majority)
      r = rand(0.8, 2.0);
      vy = rand(0.15, 0.45);
      alpha = rand(0.15, 0.35);
    }

    return {
      x: rand(0, w),
      y: rand(0, h),
      r,
      vy,
      vx: rand(-0.15, 0.15),
      alpha,
      wobble: rand(0, Math.PI * 2)
    };
  });
}

function resize() {
  if (!canvas || !ctx) return;

  // Force viewport-fixed sizing (bulletproof)
  canvas.style.position = 'fixed';
  canvas.style.left = '0';
  canvas.style.top = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '-1';
  canvas.style.display = 'block';

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;

  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  createParticles(getParticleCount(w, h), w, h);
}

function step() {
  if (!running || !ctx) return;

  const w = window.innerWidth;
  const h = window.innerHeight;

  ctx.clearRect(0, 0, w, h);

  for (const p of particles) {
    p.wobble += 0.01;
    p.x += p.vx + Math.sin(p.wobble) * 0.08;
    p.y += p.vy;


    if (p.y > h + 10) p.y = -10;
    if (p.x < -10) p.x = w + 10;
    if (p.x > w + 10) p.x = -10;

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
    ctx.fill();
  }

  rafId = requestAnimationFrame(step);
}

function start() {
  if (running) return;
  running = true;
  rafId = requestAnimationFrame(step);
}

function stop() {
  running = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
}

function onVisibilityChange() {
  if (document.hidden) stop();
  else start();
}

export function mountChristmasParticles() {
  // If already mounted, don't mount again
  const existing = document.querySelector('.christmas-snow-canvas');
  if (existing) {
    canvas = existing;
    ctx = canvas.getContext('2d', { alpha: true });
    resize();
    start();
    return;
  }

  canvas = document.createElement('canvas');
  canvas.className = 'christmas-snow-canvas';

  // Insert ABOVE the sky layer so sky gradient never covers it
  const sky = document.querySelector('.sky');
  if (sky && sky.parentNode) sky.parentNode.insertBefore(canvas, sky);
  else document.body.appendChild(canvas);

  ctx = canvas.getContext('2d', { alpha: true });

  resize();
  start();

  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', onVisibilityChange);
}
