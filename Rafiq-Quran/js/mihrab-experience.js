(() => {
  'use strict';
  const body = document.body;
  if (!body) return;

  // ── 1. Build Majestic Living Celestial Mihrab Sanctuary ─────────────────────
  const atmosphere = document.createElement('div');
  atmosphere.className = 'mihrab-atmosphere celestial-sanctuary';
  atmosphere.setAttribute('aria-hidden', 'true');
  atmosphere.innerHTML = `
    <!-- Living Deep Cosmic Canvas (Stars, Aurora, Nebula & Floating Light Motes) -->
    <canvas id="celestialCanvas" class="celestial-canvas"></canvas>
    
    <!-- Royal Embossed Islamic Damask Texture Layer (المقترح الثالث: النقش الإسلامي الملكي الخافت) -->
    <div class="royal-islamic-damask" id="royalDamask" aria-hidden="true"></div>
    <div class="sanctuary-focal-aura" id="sanctuaryFocalAura" aria-hidden="true"></div>

    <!-- The Suspended Golden Lantern Assembly (المشكاة المعلقة في الذروة) -->
    <div class="celestial-lantern-wrap">
      <div class="lantern-chain"></div>
      <div class="celestial-lantern" id="celestialLantern">
        <div class="lantern-ambient-halo" id="lanternHalo"></div>
        <div class="lantern-cap">
          <span class="lantern-finial-top"></span>
        </div>
        <div class="lantern-glass-body">
          <div class="lantern-core-flame" id="lanternFlame"></div>
        </div>
        <div class="lantern-bottom-finial"></div>
      </div>
    </div>

    <!-- Sacred Texture Overlay -->
    <i class="mihrab-grain"></i>
  `;
  body.prepend(atmosphere);

  // Suppress old ocean canvas
  const oldOcean = document.getElementById('oceanCanvas');
  if (oldOcean) { oldOcean.width = 0; oldOcean.height = 0; oldOcean.style.display = 'none'; }

  // ── 2. Time-of-Day Atmospheric Hue ──────────────────────────────────────────
  const setTimeMood = () => {
    const h = new Date().getHours();
    body.dataset.mihrabTime = h < 5 ? 'night' : h < 7 ? 'before-dawn' : h < 11 ? 'dawn' : h < 17 ? 'day' : h < 20 ? 'dusk' : 'night';
  };
  setTimeMood();
  setInterval(setTimeMood, 15 * 60 * 1000);

  // ── 3. High-Performance Living Canvas Engine ────────────────────────────────
  const canvas = document.getElementById('celestialCanvas');
  const ctx = canvas ? canvas.getContext('2d') : null;
  let animId = null;
  let visible = !document.hidden;
  let reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', e => { reducedMotion = e.matches; });

  let W = 0, H = 0;
  let stars = [];
  let lightMotes = [];
  let auroraCurtains = [];

  // Floating Golden Dust Motes — depth layers, soft glow sprites, gentle parallax
  const makeSprite = (size, stops) => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(([p, col]) => gr.addColorStop(p, col));
    g.fillStyle = gr;
    g.fillRect(0, 0, size, size);
    return c;
  };
  const moteSprite = makeSprite(64, [[0, 'rgba(255,244,200,1)'], [0.16, 'rgba(255,226,150,.6)'], [0.5, 'rgba(212,175,55,.14)'], [1, 'rgba(212,175,55,0)']]);
  // Soft volumetric light shaft (feathered on both sides, fades toward the bottom)
  const shaftSprite = (() => {
    const w = 360, h = 1000;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const hg = g.createLinearGradient(0, 0, w, 0);
    hg.addColorStop(0, 'rgba(255,230,160,0)');
    hg.addColorStop(0.5, 'rgba(255,230,160,.9)');
    hg.addColorStop(1, 'rgba(255,230,160,0)');
    g.fillStyle = hg; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-in';
    const vg = g.createLinearGradient(0, 0, 0, h);
    vg.addColorStop(0, 'rgba(0,0,0,1)');
    vg.addColorStop(0.55, 'rgba(0,0,0,.35)');
    vg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = vg; g.fillRect(0, 0, w, h);
    return c;
  })();
  const shafts = [
    { x: 0.30, w: 0.20, rot: 0.16, sp: 0.00011, a: 0.050 },
    { x: 0.52, w: 0.26, rot: -0.05, sp: 0.00008, a: 0.045 },
    { x: 0.74, w: 0.18, rot: -0.18, sp: 0.00013, a: 0.040 }
  ];
  // pointer parallax (desktop only)
  let parX = 0, parY = 0, parTX = 0, parTY = 0;
  if (matchMedia('(pointer: fine)').matches) {
    window.addEventListener('pointermove', e => {
      parTX = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
      parTY = (e.clientY / Math.max(1, window.innerHeight)) * 2 - 1;
    }, { passive: true });
  }
  // rare, soft shooting star
  let comet = null;
  let nextComet = performance.now() + 9000 + Math.random() * 12000;

  const initLightMotes = () => {
    lightMotes = [];
    const tier = body.dataset.perfTier || 'balanced';
    const count = tier === 'lite' ? 26 : tier === 'high' ? 72 : 52;
    for (let i = 0; i < count; i++) {
      const z = Math.random();
      lightMotes.push({
        x: Math.random() * W,
        y: Math.random() * H,
        z,
        vx: (Math.random() - 0.5) * 0.12 * (0.4 + z),
        vy: -(0.06 + Math.random() * 0.16) * (0.4 + z),
        alpha: 0.18 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
        swaySpeed: Math.random() * 0.0012 + 0.0006
      });
    }
  };

  // Multi-Depth Stars (sparse, elegant, deep night)
  const initStars = () => {
    stars = [];
    const tier = body.dataset.perfTier || 'balanced';
    const count = tier === 'lite' ? 36 : tier === 'high' ? 84 : 56;
    for (let i = 0; i < count; i++) {
      const isTwinkler = Math.random() < 0.28;
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H * 0.85,
        radius: Math.random() < 0.2 ? Math.random() * 1.5 + 1.2 : Math.random() * 0.8 + 0.5,
        baseAlpha: Math.random() * 0.5 + 0.25,
        twinkle: isTwinkler,
        twinkleSpeed: isTwinkler ? (Math.random() * 0.0008 + 0.0004) : 0, // peaceful 14-25s cycle
        twinklePhase: Math.random() * Math.PI * 2,
        golden: Math.random() < 0.32,
        layer: i < count * 0.35 ? 0 : i < count * 0.75 ? 1 : 2
      });
    }
  };

  // Flowing Aurora Curtains — quiet, deeply subtle atmospheric depth
  const initAurora = () => {
    auroraCurtains = [
      {
        baseX: 0.22,
        widthPct: 0.35,
        speed: 0.000025,
        colorStops: [
          { pos: 0, col: 'rgba(6, 48, 36, 0)' },
          { pos: 0.3, col: 'rgba(10, 120, 80, 0.20)' },
          { pos: 0.65, col: 'rgba(8, 100, 70, 0.11)' },
          { pos: 1, col: 'rgba(6, 48, 36, 0)' }
        ]
      },
      {
        baseX: 0.55,
        widthPct: 0.42,
        speed: -0.00002,
        colorStops: [
          { pos: 0, col: 'rgba(4, 38, 30, 0)' },
          { pos: 0.35, col: 'rgba(14, 140, 100, 0.17)' },
          { pos: 0.7, col: 'rgba(10, 90, 65, 0.10)' },
          { pos: 1, col: 'rgba(4, 38, 30, 0)' }
        ]
      },
      {
        baseX: 0.80,
        widthPct: 0.30,
        speed: 0.000030,
        colorStops: [
          { pos: 0, col: 'rgba(5, 42, 34, 0)' },
          { pos: 0.4, col: 'rgba(12, 110, 78, 0.15)' },
          { pos: 1, col: 'rgba(5, 42, 34, 0)' }
        ]
      },
      {
        baseX: 0.40,
        widthPct: 0.50,
        speed: 0.000016,
        colorStops: [
          { pos: 0, col: 'rgba(120, 90, 20, 0)' },
          { pos: 0.3, col: 'rgba(212, 175, 55, 0.055)' },
          { pos: 0.7, col: 'rgba(160, 120, 30, 0.03)' },
          { pos: 1, col: 'rgba(120, 90, 20, 0)' }
        ]
      }
    ];
  };

  const resize = () => {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    initStars();
    initLightMotes();
    initAurora();
  };
  window.addEventListener('resize', resize, { passive: true });
  resize();

  // ── 4. True Audio-Reactive Analysis ─────────────────────────────────────────
  const audioEl = document.getElementById('quranAudio');
  let aCtx = null, analyser = null, srcNode = null, freqBuf = null, timeBuf = null;
  let peakRef = 0.06, flatFrames = 0, dataBlind = false;
  let webAudioOk = false, isPlaying = false, corsLimited = false;
  let audioIntensity = 0.0, targetIntensity = 0.0;

  const initAudio = () => {
    if (webAudioOk || corsLimited || !audioEl) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      aCtx = new AC();
      analyser = aCtx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.6;
      freqBuf = new Uint8Array(analyser.frequencyBinCount);
      timeBuf = new Uint8Array(analyser.fftSize);
      try {
        srcNode = aCtx.createMediaElementSource(audioEl);
        srcNode.connect(analyser);
        analyser.connect(aCtx.destination);
        webAudioOk = true;
      } catch (e) {
        corsLimited = true;
        webAudioOk = false;
      }
    } catch (e) {
      corsLimited = true;
    }
  };

  // Real loudness of the recitation: RMS of the waveform, normalised against a slowly
  // decaying recent peak so quiet reciters still use the full range and loud ones don't clip.
  // Louder voice -> value near 1 -> more haze & light. Softer / pauses -> value falls toward 0.
  const sampleAmplitude = () => {
    if (!isPlaying || !audioEl || audioEl.paused) { flatFrames = 0; return 0.0; }
    if (webAudioOk && analyser && timeBuf && !dataBlind) {
      if (aCtx && aCtx.state === 'suspended') aCtx.resume().catch(() => {});
      analyser.getByteTimeDomainData(timeBuf);
      let sum = 0, flat = true;
      for (let i = 0; i < timeBuf.length; i++) {
        const v = (timeBuf[i] - 128) / 128;
        if (timeBuf[i] !== 128) flat = false;
        sum += v * v;
      }
      // Cross-origin audio without CORS gives an all-zero stream: detect it and degrade gracefully.
      flatFrames = flat ? flatFrames + 1 : 0;
      if (flatFrames > 240 && audioEl.currentTime > 2) dataBlind = true;
      const rms = Math.sqrt(sum / timeBuf.length);
      peakRef = Math.max(rms, peakRef * 0.9985, 0.05);
      return Math.min(1.0, Math.pow(rms / peakRef, 0.9));
    }
    // No readable audio data (CORS-limited): hold a calm steady glow instead of faking pulses.
    return 0.35;
  };

  const setPlayState = (active) => {
    isPlaying = active;
    window.isAudioPlaying = active;
    body.classList.toggle('recitation-active', active);
    body.dataset.recitation = active ? 'playing' : 'idle';
    if (active) {
      initAudio();
      if (aCtx?.state === 'suspended') aCtx.resume().catch(() => {});
    }
  };

  if (audioEl) {
    audioEl.addEventListener('play', () => setPlayState(true));
    audioEl.addEventListener('pause', () => setPlayState(false));
    audioEl.addEventListener('ended', () => setPlayState(false));
    audioEl.addEventListener('emptied', () => setPlayState(false));
    if (!audioEl.paused && audioEl.currentTime > 0) setPlayState(true);
  }

  // ── 5. Master Animation Loop (Living Light & Deep Cosmos) ───────────────────
  let prevT = performance.now();
  let lastVoice = 0;
  const lanternHalo = document.getElementById('lanternHalo');
  const lanternFlame = document.getElementById('lanternFlame');

  const updateSanctuaryAlignment = () => {
    const mainEl = document.getElementById('main-content');
    const lanternWrap = document.querySelector('.celestial-lantern-wrap');
    const focalAura = document.getElementById('sanctuaryFocalAura');
    if (!mainEl || !lanternWrap) return W * 0.5;
    const rect = mainEl.getBoundingClientRect();
    if (rect.width > 200) {
      const cx = rect.left + rect.width * 0.5;
      lanternWrap.style.left = `${cx}px`;
      if (focalAura) focalAura.style.left = `${cx}px`;
      return cx;
    }
    return W * 0.5;
  };

  const render = (now) => {
    animId = requestAnimationFrame(render);
    if (!visible) return;

    const dt = Math.min((now - prevT) * 0.001, 0.1);
    prevT = now;

    // Smooth audio reactivity physics (Attack & Release)
    targetIntensity = sampleAmplitude();
    const rate = targetIntensity > audioIntensity ? 0.09 : 0.035;
    audioIntensity += (targetIntensity - audioIntensity) * rate;
    window.__rafiqVoice = audioIntensity;   // read by nebula-gl.js (live background)
    if (Math.abs(audioIntensity - lastVoice) > 0.004 || (audioIntensity < 0.004 && lastVoice !== 0)) {
      lastVoice = audioIntensity < 0.004 ? 0 : audioIntensity;
      atmosphere.style.setProperty('--voice', lastVoice.toFixed(3));
    }

    // Lantern living breathing physics
    const ambientBreath = Math.sin(now * 0.001) * 0.08;
    const glowScale = 1.0 + (audioIntensity * 0.45) + ambientBreath;
    const glowAlpha = isPlaying ? (0.65 + audioIntensity * 0.35) : (0.55 + ambientBreath * 0.15);

    if (lanternHalo) {
      lanternHalo.style.transform = `scale(${glowScale.toFixed(3)})`;
      lanternHalo.style.opacity = glowAlpha.toFixed(3);
    }
    if (lanternFlame) {
      const flicker = 1.0 + Math.sin(now * 0.006) * 0.08 + audioIntensity * 0.25;
      lanternFlame.style.transform = `translate(-50%, -50%) scale(${flicker.toFixed(3)})`;
    }

    // ── Canvas Drawing ──
    if (!ctx || W <= 0 || H <= 0) return;
    ctx.clearRect(0, 0, W, H);

    parX += (parTX - parX) * 0.04;
    parY += (parTY - parY) * 0.04;
    const tierNow = body.dataset.perfTier || 'balanced';

    // A. Cosmic Aurora Curtains (deeply subtle atmospheric depth — not visible stripes)
    if (false) { // disabled: replaced by the nebula background layers
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const boost = 1.0 + audioIntensity * 0.3;

      for (let i = 0; i < auroraCurtains.length; i++) {
        const cur = auroraCurtains[i];
        const phase = now * cur.speed + i * 2.2;
        const cx = W * cur.baseX + Math.sin(phase) * W * 0.04;
        const curWidth = W * cur.widthPct * (1.0 + Math.sin(phase * 1.4) * 0.08);

        const grad = ctx.createLinearGradient(0, 0, 0, H * 0.80);
        cur.colorStops.forEach(cs => {
          grad.addColorStop(cs.pos, cs.col);
        });

        ctx.globalAlpha = Math.min(0.92, 0.78 * boost * (1 + 0.28 * Math.sin(now * 0.0004 + i * 1.7)));
        ctx.fillStyle = grad;

        ctx.beginPath();
        const xLeft = cx - curWidth * 0.5;
        const xRight = cx + curWidth * 0.5;
        const sway1 = Math.sin(phase * 1.6 + i) * curWidth * 0.18;
        const sway2 = Math.cos(phase * 1.2 + i * 2) * curWidth * 0.14;

        ctx.moveTo(xLeft, 0);
        ctx.bezierCurveTo(xLeft + sway1, H * 0.3, xLeft - sway2, H * 0.55, xLeft + sway1 * 0.5, H * 0.80);
        ctx.lineTo(xRight + sway2 * 0.5, H * 0.80);
        ctx.bezierCurveTo(xRight - sway2, H * 0.55, xRight + sway1, H * 0.3, xRight, 0);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // A2. Soft light shafts — slow, feathered, barely-there
    if (false) { // disabled: no beams from the top
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < shafts.length; i++) {
        const sh = shafts[i];
        const ph = reducedMotion ? i : now * sh.sp + i * 2.1;
        const wpx = W * sh.w;
        ctx.save();
        ctx.translate(W * sh.x + Math.sin(ph) * W * 0.03 + parX * 14, -30);
        ctx.rotate(sh.rot + Math.sin(ph * 0.7) * 0.04);
        ctx.globalAlpha = Math.min(0.12, sh.a * (1 + 0.35 * Math.sin(now * 0.00045 + i * 2)) * (1 + audioIntensity * 0.5));
        ctx.drawImage(shaftSprite, -wpx / 2, 0, wpx, H * 1.15);
        ctx.restore();
      }
      ctx.restore();
    }

    // B. Stars (multi-depth, peaceful twinkling)
    ctx.save();
    const starBoost = audioIntensity * 0.22;
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const sx = s.x + parX * (s.layer + 1) * 3, sy = s.y + parY * (s.layer + 1) * 2;
      let a = s.baseAlpha + starBoost;
      if (s.twinkle && !reducedMotion) {
        a += Math.sin(now * s.twinkleSpeed + s.twinklePhase) * 0.25;
      }
      a = Math.max(0.12, Math.min(0.95, a));

      ctx.fillStyle = s.golden ? `rgba(255, 235, 160, ${a.toFixed(3)})` : `rgba(190, 245, 225, ${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, s.radius, 0, Math.PI * 2);
      ctx.fill();

      // Foreground star delicate cross-glint
      if (s.layer === 2 && a > 0.68 && s.radius > 1.1) {
        ctx.fillStyle = `rgba(255, 245, 200, ${(a * 0.35).toFixed(3)})`;
        ctx.fillRect(sx - s.radius * 2.8, sy - 0.5, s.radius * 5.6, 1);
        ctx.fillRect(sx - 0.5, sy - s.radius * 2.8, 1, s.radius * 5.6);
      }
    }
    ctx.restore();

    // C. Soft Sanctuary Golden Aura (Warm misty diffusion, NO triangles or sharp cones)
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const lx = updateSanctuaryAlignment();
    const ly = 70; // Soft lantern glow origin
    const auraRadius = Math.max(W * 0.55, 600);

    const auraGrad = ctx.createRadialGradient(lx, ly, 15, lx, ly + 80, auraRadius);
    const auraAlpha = (isPlaying ? (0.16 + audioIntensity * 0.16) : 0.12) * (1 + 0.22 * Math.sin(now * 0.00065));
    auraGrad.addColorStop(0, `rgba(255, 238, 175, ${auraAlpha.toFixed(3)})`);
    auraGrad.addColorStop(0.24, `rgba(212, 175, 55, ${(auraAlpha * 0.52).toFixed(3)})`);
    auraGrad.addColorStop(0.65, `rgba(16, 185, 129, ${(auraAlpha * 0.18).toFixed(3)})`);
    auraGrad.addColorStop(1, 'rgba(2, 12, 8, 0)');

    // (top golden aura disabled — the voice-reactive haze now lives in CSS)
    ctx.restore();

    // D. Living Floating Golden Dust Motes (depth layers + soft glow)
    if (!reducedMotion) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const k = dt * 60;
      for (let i = 0; i < lightMotes.length; i++) {
        const m = lightMotes[i];
        m.y += m.vy * k * (1.0 + audioIntensity * 0.5);
        m.x += (m.vx + Math.sin(now * m.swaySpeed + m.phase) * 0.18) * k;
        if (m.y < -20) { m.y = H + 20; m.x = Math.random() * W; }
        if (m.x < -20) m.x = W + 20; else if (m.x > W + 20) m.x = -20;

        const near = Math.max(0.35, 1 - Math.abs(m.x - lx) / (W * 0.65));
        const tw = 0.75 + 0.25 * Math.sin(now * m.swaySpeed * 2.3 + m.phase);
        const a = Math.min(0.9, m.alpha * near * tw * (1.0 + audioIntensity * 0.6));
        const px = m.x + parX * (6 + m.z * 14);
        const py = m.y + parY * (4 + m.z * 9);
        const sz = 6 + m.z * 16;
        ctx.globalAlpha = a;
        ctx.drawImage(moteSprite, px - sz / 2, py - sz / 2, sz, sz);
      }
      ctx.restore();

      // E. A rare, quiet shooting star
      if (!comet && now > nextComet) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        comet = { x: W * (0.15 + Math.random() * 0.7), y: H * (0.05 + Math.random() * 0.25),
                  vx: dir * W * 0.00055 * (0.9 + Math.random() * 0.4), vy: H * 0.00028, life: 0, max: 1400 };
      }
      if (comet) {
        comet.life += dt * 1000;
        comet.x += comet.vx * dt * 1000;
        comet.y += comet.vy * dt * 1000;
        const kk = Math.min(1, comet.life / comet.max);
        const ca = Math.sin(kk * Math.PI) * 0.55;
        const tx = comet.x - comet.vx * 220, ty = comet.y - comet.vy * 220;
        const cg = ctx.createLinearGradient(comet.x, comet.y, tx, ty);
        cg.addColorStop(0, `rgba(255,244,200,${ca.toFixed(3)})`);
        cg.addColorStop(1, 'rgba(255,244,200,0)');
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.strokeStyle = cg;
        ctx.lineWidth = 1.4;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(comet.x, comet.y); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.restore();
        if (kk >= 1) { comet = null; nextComet = now + 25000 + Math.random() * 30000; }
      }
    }
  };

  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    if (visible) prevT = performance.now();
  });
  animId = requestAnimationFrame(render);

  // ── 6. Quran Focus Chamber ──────────────────────────────────────────────────
  const fKey = 'rafiq-mihrab-focus-v1';
  const fBtn = document.getElementById('mushafFocusBtn');
  let prevFocus = null;

  const setFocus = (on, { persist = true } = {}) => {
    body.classList.toggle('mihrab-focus', on);
    fBtn?.setAttribute('aria-pressed', String(on));
    if (fBtn) fBtn.innerHTML = on ? '<span class="ayah-ico" data-ico="close"></span> خروج من التركيز' : '<span class="ayah-ico" data-ico="focus"></span> تركيز المحراب';
    if (persist) {
      try { localStorage.setItem(fKey, on ? '1' : '0'); } catch {}
    }
    if (on) {
      prevFocus = document.activeElement;
      const m = document.getElementById('mushafTop');
      m?.setAttribute('tabindex', '-1');
      m?.focus({ preventScroll: true });
    } else if (prevFocus instanceof HTMLElement) {
      prevFocus.focus({ preventScroll: true });
    }
  };

  fBtn?.addEventListener('click', () => setFocus(!body.classList.contains('mihrab-focus')));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && body.classList.contains('mihrab-focus')) {
      e.preventDefault();
      setFocus(false);
    }
  });

  try {
    if (localStorage.getItem(fKey) === '1') setFocus(false, { persist: false });
  } catch {}
})();
