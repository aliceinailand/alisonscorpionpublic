/**
 * Traveling-through-space wallpaper — stars fly toward the camera.
 * Lightweight 2D canvas (no Three.js). Only animates while enabled.
 */

const COUNT = 220;
let canvas = null;
let ctx = null;
let stars = [];
let raf = 0;
let running = false;
let speed = 0.55;
let reduce = false;

function spawn(far) {
  return {
    x: (Math.random() - 0.5) * 2,
    y: (Math.random() - 0.5) * 2,
    z: far ? 0.4 + Math.random() * 1.6 : Math.random() * 0.15 + 0.02,
    px: 0,
    py: 0,
  };
}

function resize() {
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth || 800;
  const h = window.innerHeight || 600;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function frame() {
  if (!running || !ctx) return;
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  const cx = w / 2;
  const cy = h / 2;
  const scale = Math.max(w, h) * 0.55;
  ctx.fillStyle = "rgba(6, 3, 16, 0.42)";
  ctx.fillRect(0, 0, w, h);

  for (const s of stars) {
    s.z -= speed * (reduce ? 0.35 : 1) * 0.018;
    if (s.z <= 0.02) {
      Object.assign(s, spawn(true));
      s.px = 0;
      s.py = 0;
      continue;
    }
    const x = cx + (s.x / s.z) * scale;
    const y = cy + (s.y / s.z) * scale;
    const px = s.px || x;
    const py = s.py || y;
    const bright = Math.min(1, (1.1 - s.z) * 0.9);
    ctx.strokeStyle = `rgba(230, 220, 255, ${0.25 + bright * 0.7})`;
    ctx.lineWidth = 1 + (1 - s.z) * 1.6;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(x, y);
    ctx.stroke();
    s.px = x;
    s.py = y;
  }
  raf = requestAnimationFrame(frame);
}

function onResize() {
  if (running) resize();
}

export function setSpaceSpeed(n) {
  const v = Number(n);
  if (Number.isFinite(v)) speed = Math.min(2.4, Math.max(0.15, v));
}

export function stopSpaceBg() {
  running = false;
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  if (canvas) canvas.hidden = true;
}

export function startSpaceBg(canvasId = "space-bg") {
  canvas = document.getElementById(canvasId);
  if (!canvas || !canvas.getContext) return false;
  ctx = canvas.getContext("2d");
  if (!ctx) return false;
  try {
    reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    reduce = false;
  }
  if (!stars.length) stars = Array.from({ length: COUNT }, () => spawn(true));
  canvas.hidden = false;
  resize();
  if (!running) {
    running = true;
    raf = requestAnimationFrame(frame);
  }
  return true;
}

export function syncSpaceBg(wallpaperId) {
  const on = wallpaperId === "travel";
  if (on) startSpaceBg();
  else stopSpaceBg();
  return on;
}

export function initSpaceBg() {
  window.addEventListener("resize", onResize);
  document.addEventListener("asx-prefs", (e) => {
    syncSpaceBg(e.detail?.wallpaper);
  });
}
