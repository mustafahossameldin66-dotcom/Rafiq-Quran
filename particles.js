let canvas = null;
let ctx = null;
let bursts = [];
let bubbles = [];
let raf = 0;
let dpr = 1;
let bubbleGraphics = 1;

function ensureCanvas() {
  if (canvas) return;
  canvas = document.createElement('canvas');
  canvas.id = 'particleCanvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  ctx = canvas.getContext('2d', { alpha: true });
  resize();
  window.addEventListener('resize', resize, { passive: true });
}

function resize() {
  if (!canvas) return;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  canvas.style.width = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function rebuildBubbles(count) {
  bubbles = Array.from({ length: count }, () => ({
    x: Math.random(), y: Math.random() + 1, r: 2 + Math.random() * 6,
    speed: 0.00008 + Math.random() * 0.00012,
    drift: (Math.random() - .5) * .00005,
    phase: Math.random() * Math.PI * 2
  }));
}

export function setOceanBubbles(graphics = 1) {
  bubbleGraphics = graphics;
  if (graphics === 1 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    bubbles = [];
    return;
  }
  ensureCanvas();
  const count = graphics >= 3 ? 24 : 12;
  if (bubbles.length !== count) rebuildBubbles(count);
  if (!raf) raf = requestAnimationFrame(frame);
}

function visibleOceanRects() {
  const rects = [];
  const global = document.getElementById('globalZadOcean');
  if (global && getComputedStyle(global).display !== 'none') rects.push(global.getBoundingClientRect());
  document.querySelectorAll('.ocean').forEach(el => {
    if (el.id === 'ocean' && getComputedStyle(el).display === 'none') return;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight) rects.push(r);
  });
  return rects;
}

function drawBubbles(now) {
  if (!bubbles.length || bubbleGraphics === 1) return;
  const rects = visibleOceanRects();
  if (!rects.length) return;
  for (const r of rects) {
    for (const b of bubbles) {
      const yNorm = (b.y - ((now * b.speed) % 1) + 1) % 1;
      const xNorm = (b.x + Math.sin(now * .0008 + b.phase) * .035) % 1;
      const x = r.left + xNorm * r.width;
      const y = r.top + yNorm * r.height;
      if (y < r.top || y > r.bottom) continue;
      ctx.globalAlpha = .08 + .10 * Math.sin(b.phase + now * .002) ** 2;
      ctx.strokeStyle = 'rgba(213,243,223,.9)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, b.r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function frame(now) {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  drawBubbles(now);
  const next = [];
  for (const p of bursts) {
    const age = now - p.t;
    const progress = age / p.life;
    if (progress >= 1) continue;
    const ease = 1 - progress;
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.018;
    ctx.globalAlpha = ease * .9;
    ctx.fillStyle = p.gold ? '#d4af37' : '#49a75c';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * (.65 + ease * .35), 0, Math.PI * 2);
    ctx.fill();
    next.push(p);
  }
  bursts = next;
  ctx.globalAlpha = 1;
  if (bubbles.length || bursts.length) raf = requestAnimationFrame(frame);
  else raf = 0;
}

export function burstParticles(x, y, graphics = 2) {
  if (graphics === 1 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  ensureCanvas();
  const count = graphics >= 3 ? 14 : 9;
  const now = performance.now();
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.2 + Math.random() * 2.4;
    bursts.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - .5, r: 2 + Math.random() * 2.5, t: now, life: 520 + Math.random() * 380, gold: Math.random() > .5 });
  }
  if (!raf) raf = requestAnimationFrame(frame);
}
