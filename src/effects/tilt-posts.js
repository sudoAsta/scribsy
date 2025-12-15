// src/effects/tilt-posts.js
export function initTiltPosts({
  selector = '.post-wrapper',
  rotateAmplitude = 8,  // degrees (keep tasteful)
  hoverScale = 1.03,
} = {}) {
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!canHover || reduceMotion) return;

  let raf = 0;
  let active = null;
  let lastEvent = null;

  function applyTilt(el, e) {
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;  // 0..1
    const py = (e.clientY - rect.top) / rect.height;  // 0..1

    // center to -0.5..0.5
    const dx = px - 0.5;
    const dy = py - 0.5;

    const rotY = dx * rotateAmplitude;       // left/right
    const rotX = -dy * rotateAmplitude;      // up/down (invert)

    el.style.setProperty('--tilt-x', `${rotX.toFixed(2)}deg`);
    el.style.setProperty('--tilt-y', `${rotY.toFixed(2)}deg`);
  }

  function onMove(e) {
    if (!active) return;
    lastEvent = e;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (active && lastEvent) applyTilt(active, lastEvent);
    });
  }

  function onEnter(e) {
    const el = e.target.closest(selector);
    if (!el) return;
    active = el;
    el.style.setProperty('--tilt-scale', String(hoverScale));
  }

  function onLeave(e) {
    const el = e.target.closest(selector);
    if (!el) return;

    el.style.setProperty('--tilt-x', '0deg');
    el.style.setProperty('--tilt-y', '0deg');
    el.style.setProperty('--tilt-scale', '1');

    if (active === el) active = null;
  }

  // Event delegation: works for dynamically added posts
  document.addEventListener('pointerenter', onEnter, true);
  document.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerleave', onLeave, true);
}
