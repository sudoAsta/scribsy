// src/theme-loader.js
const DESKTOP_MIN = 481;

function getThemeOverride() {
  const params = new URLSearchParams(window.location.search);
  const q = params.get('theme');

  // Allow quick toggles:
  // ?theme=off          -> disable and persist
  // ?theme=christmas    -> enable and persist
  if (q === 'off') {
    localStorage.setItem('scribsy-theme', 'off');
    return 'off';
  }
  if (q === 'christmas') {
    localStorage.setItem('scribsy-theme', 'christmas');
    return 'christmas';
  }

  return localStorage.getItem('scribsy-theme'); // 'off' | 'christmas' | null
}

function isDesktop() {
  return window.matchMedia(`(min-width: ${DESKTOP_MIN}px)`).matches;
}

function motionAllowed() {
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export async function initTheme() {
  // Desktop-only theme
  if (!isDesktop()) return;

  const override = getThemeOverride();
  if (override === 'off') return;

  // Default is ON (christmas), unless user explicitly turned it off
  const theme = override || 'christmas';

  if (theme === 'christmas') {
    // Add class hooks
    document.documentElement.classList.add('theme-christmas');

    // Load theme CSS (code-split)
    await import('./themes/christmas.css');

    // If reduced motion, skip particles
    if (!motionAllowed()) return;

    // Load particles (code-split)
    const mod = await import('./themes/christmas.particles.js');
    mod.mountChristmasParticles();
  }
}
