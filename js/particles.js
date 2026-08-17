// Rafiq Quran — single canvas particle system.
// Handles both ambient background particles and interaction bursts without creating DOM nodes.
export class ParticleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas?.getContext('2d', { alpha: true });
    this.items = [];
    this.ambient = [];
    this.running = false;
    this.visible = !document.hidden;
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.resize = this.resize.bind(this);
    this.frame = this.frame.bind(this);
    window.addEventListener('resize', this.resize, { passive: true });
    document.addEventListener('visibilitychange', () => {
      this.visible = !document.hidden;
      if (this.visible) this.ensureRunning();
    });
    this.resize();
  }

  setLevel(level = 1) {
    const target = this.reducedMotion || level <= 1 ? 0 : level >= 3 ? 24 : 12;
    while (this.ambient.length < target) this.ambient.push(this.makeAmbient());
    if (this.ambient.length > target) this.ambient.length = target;
    this.ensureRunning();
  }

  makeAmbient() {
    const r = this.canvas?.getBoundingClientRect();
    return {
      x: Math.random() * (r?.width || innerWidth),
      y: Math.random() * (r?.height || innerHeight),
      vx: (Math.random() - .5) * .12,
      vy: -.08 - Math.random() * .18,
      r: .7 + Math.random() * 1.8,
      a: .12 + Math.random() * .35,
      phase: Math.random() * Math.PI * 2
    };
  }

  resize() {
    if (!this.canvas || !this.ctx) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = this.ambient.length;
    this.ambient = Array.from({ length: count }, () => this.makeAmbient());
    this.ensureRunning();
  }

  burst(x, y) {
    if (!this.ctx || this.reducedMotion) return;
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 25 + Math.random() * 45;
      this.items.push({
        x, y, vx: Math.cos(a) * d / 28, vy: Math.sin(a) * d / 28,
        r: 1.5 + Math.random() * 2.5, life: 1
      });
    }
    this.ensureRunning();
  }

  ensureRunning() {
    if (!this.running && this.visible && (this.items.length || this.ambient.length)) {
      this.running = true;
      requestAnimationFrame(this.frame);
    }
  }

  frame(now = performance.now()) {
    if (!this.ctx || !this.canvas || !this.visible) {
      this.running = false;
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    const ctx = this.ctx;
    ctx.clearRect(0, 0, rect.width, rect.height);

    if (this.ambient.length) {
      for (const p of this.ambient) {
        p.x += p.vx;
        p.y += p.vy;
        p.phase += .012;
        if (p.y < -8) { p.y = rect.height + 8; p.x = Math.random() * rect.width; }
        const alpha = p.a * (.72 + Math.sin(p.phase) * .28);
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.fillStyle = 'rgba(134,220,163,1)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    this.items = this.items.filter(p => {
      p.x += p.vx; p.y += p.vy; p.vy += .015; p.life -= .035;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = 'rgba(212,175,55,1)';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      return p.life > 0;
    });

    ctx.globalAlpha = 1;
    if (this.items.length || this.ambient.length) {
      requestAnimationFrame(this.frame);
    } else {
      this.running = false;
    }
  }

  destroy() {
    window.removeEventListener('resize', this.resize);
    this.items = [];
    this.ambient = [];
    this.running = false;
    this.ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
