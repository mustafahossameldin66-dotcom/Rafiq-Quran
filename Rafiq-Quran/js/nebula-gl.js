/* ═══════════════════════════════════════════════════════════════════════════════
   NEBULA-GL — خلفية حية بتتولّد لحظيًا على كرت الشاشة (WebGL)
   • دخان زمردي/تركوازي بيتدفق (domain-warped fbm) مع إضاءة جانبية تدّي إحساس الحجم
   • خيوط ذهبية وغبار ذهبي بيطفو على 3 طبقات عمق ويلمع
   • علوّ صوت القارئ (window.__rafiqVoice من mihrab-experience.js) بيزوّد السرعة والضباب والضوء
   • لو WebGL مش متاح، أو وضع تقليل الحركة: بيرجع للصورة الثابتة تلقائيًا (CSS)
   ═══════════════════════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const VERT = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uT;   // accumulated flow time (speeds up with the voice)
uniform float uV;   // smoothed voice level 0..1

float hash(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
mat2 M = mat2(1.6, 1.2, -1.2, 1.6);
float fbm3(vec2 p){                       // smooth, large forms (used for the flow warp)
  float v = 0.0, a = 0.5;
  for(int i = 0; i < 3; i++){ v += a * noise(p); p = M * p; a *= 0.5; }
  return v / 0.875;
}
float fbm5(vec2 p){                       // fine detail (used for density)
  float v = 0.0, a = 0.5;
  for(int i = 0; i < 5; i++){ v += a * noise(p); p = M * p; a *= 0.5; }
  return v / 0.96875;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float asp = uRes.x / uRes.y;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0) * 1.25;       // bigger, calmer forms
  float t = uT * 0.02;

  // gentle two-pass warp -> slow volumetric billowing instead of marbled ripples
  vec2 q = vec2(fbm3(p + vec2(0.0, t)), fbm3(p + vec2(5.2, 1.3) - vec2(t * 0.8, 0.0)));
  vec2 r = vec2(fbm3(p + 2.2 * q + vec2(1.7, 9.2) + 0.35 * t),
                fbm3(p + 2.2 * q + vec2(8.3, 2.8) - 0.30 * t));
  vec2 pf = p + 2.2 * r;
  float f  = fbm5(pf);
  float f2 = fbm5(pf + vec2(0.05, 0.08));            // key light from the upper right
  float shade = clamp((f - f2) * 10.0, -1.0, 1.0);

  // density with real dark voids and luminous cores
  float d = smoothstep(0.34, 0.76, f);
  d = d * d * (1.0 + 0.55 * d);

  vec3 base = vec3(0.003, 0.017, 0.014);
  vec3 emer = vec3(0.020, 0.400, 0.280);
  vec3 teal = vec3(0.012, 0.300, 0.380);
  vec3 mint = vec3(0.420, 0.950, 0.760);
  vec3 gold = vec3(0.950, 0.720, 0.290);

  vec3 col = mix(base, emer, clamp(d, 0.0, 1.0));
  col = mix(col, teal, smoothstep(0.35, 0.95, length(q)) * 0.60 * clamp(d, 0.0, 1.0));
  float warm = smoothstep(0.58, 0.92, r.y) * clamp(d, 0.0, 1.0);          // warm olive-gold pockets
  col = mix(col, vec3(0.34, 0.27, 0.06), warm * 0.38);
  col += mint * pow(clamp(d, 0.0, 1.0), 3.0) * 0.22;                     // luminous cores
  col += mint * max(shade, 0.0) * 0.42 * d;                              // lit rims -> volume
  col *= 1.0 - 0.45 * max(-shade, 0.0) * d;                              // soft self-shadow

  // fine golden filaments along the folds
  float ridge = 1.0 - abs(2.0 * fbm5(pf * 1.4 + q) - 1.0);
  col += gold * pow(ridge, 12.0) * smoothstep(0.40, 0.78, f) * (0.34 + 0.60 * uV);

  // voice: more mist, more light
  col += mint * d * uV * 0.11;
  col *= 0.78 + 0.32 * uV;
  col *= 1.0 + 0.04 * sin(uT * 0.35);                                    // slow breathing

  // golden dust: 3 depth layers, bigger soft grains that gather inside the clouds
  float dust = 0.0;
  for(int i = 0; i < 3; i++){
    float fi = float(i);
    float sc = 8.0 + fi * 6.0;
    vec2 g = uv * vec2(asp, 1.0) * sc
           + vec2(uT * 0.010 * (1.0 + fi * 0.6), uT * 0.028 * (1.0 + fi * 0.7))
           + vec2(fi * 13.1, fi * 7.7);
    vec2 id = floor(g);
    vec2 fr = fract(g) - 0.5;
    float h = hash(id);
    vec2 off = (vec2(hash(id + 1.7), hash(id + 9.1)) - 0.5) * 0.5;
    float dd = length(fr - off);
    float tw = 0.45 + 0.55 * sin(uT * (0.7 + h * 1.6) + h * 6.2831);
    float rad = 0.06 + 0.05 * hash(id + 3.3);
    float on = step(0.52, h);
    float core = 1.0 - smoothstep(0.0, rad, dd);
    float halo = 1.0 - smoothstep(0.0, rad * 3.2, dd);
    dust += on * (core + 0.22 * halo) * max(tw, 0.0) * (0.95 - 0.22 * fi);
  }
  col += vec3(1.0, 0.84, 0.46) * dust * (0.30 + 0.80 * uV) * (0.25 + 1.1 * d);

  // vignette + soft clip + dither
  float vg = 1.0 - smoothstep(0.30, 1.05, length((uv - 0.5) * 1.3));
  col *= mix(0.45, 1.0, vg);
  col = col / (1.0 + col * 0.30);
  col += (hash(gl_FragCoord.xy + fract(uT)) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}`;

  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const start = (sanct) => {
    const canvas = document.createElement('canvas');
    canvas.className = 'lx-nebula-canvas';
    canvas.setAttribute('aria-hidden', 'true');

    const gl = canvas.getContext('webgl', {
      alpha: false, antialias: false, depth: false, stencil: false,
      powerPreference: 'low-power', preserveDrawingBuffer: false
    });
    if (!gl) return;
    const hp = gl.getShaderPrecisionFormat && gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    if (!hp || hp.precision <= 0) return;

    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, 'uRes');
    const uT = gl.getUniformLocation(prog, 'uT');
    const uV = gl.getUniformLocation(prog, 'uV');

    sanct.insertBefore(canvas, sanct.firstChild);

    const body = document.body;
    const isStatic = () => reduced || body.dataset.mode === 'simple';
    const tier = () => body.dataset.perfTier || 'balanced';

    const resize = () => {
      const mobile = window.innerWidth < 760;
      const scale = tier() === 'lite' ? 0.3 : mobile ? 0.42 : 0.5;   // upscaled by CSS: smoke is soft anyway
      const w = Math.max(160, Math.round(window.innerWidth * scale));
      const h = Math.max(160, Math.round(window.innerHeight * scale));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
    };

    let phase = 40 + Math.random() * 200;
    let voice = 0, last = 0, raf = 0, shown = false;

    const draw = () => {
      gl.uniform1f(uT, phase);
      gl.uniform1f(uV, voice);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!shown) { shown = true; sanct.classList.add('lx-gl'); }
    };

    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      if (now - last < 33) return;                 // ~30fps is plenty for slow smoke, easy on battery
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const target = Math.max(0, Math.min(1, window.__rafiqVoice || 0));
      voice += (target - voice) * 0.12;
      phase += dt * (1.0 + 1.8 * voice);           // louder voice -> faster, more turbulent flow
      draw();
    };

    const run = () => {
      cancelAnimationFrame(raf);
      resize();
      if (isStatic()) { draw(); return; }
      last = 0;
      raf = requestAnimationFrame(frame);
    };

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(raf); else run();
    });
    let rt = 0;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(run, 150); }, { passive: true });

    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      cancelAnimationFrame(raf);
      sanct.classList.remove('lx-gl');            // static image takes over again
    });

    run();
  };

  let tries = 0;
  const wait = () => {
    const sanct = document.querySelector('.celestial-sanctuary');
    if (sanct) { start(sanct); return; }
    if (++tries < 60) setTimeout(wait, 100);
  };
  wait();
})();
