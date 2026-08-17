// js/utils.js
import { state } from './state.js';

export const $ = id => document.getElementById(id);

export const esc = s => {
    const d = document.createElement('div');
    d.textContent = s ?? '';
    return d.innerHTML;
};

export const fmt = n => Number(n || 0).toLocaleString('en-US');

export function toast(text) {
    const t = document.createElement('div');
    t.textContent = text;
    t.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:10000;padding:10px 15px;border:1px solid var(--border);border-radius:999px;background:var(--surface2);color:var(--text);box-shadow:var(--shadow);font-weight:800';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2400);
}

export function haptic(kind = 'light') {
    if (!navigator.vibrate) return;
    try { navigator.vibrate(kind === 'done' ? [12, 25, 12] : 10) } catch {}
}

export function beep(kind = 'click') {
    if (!state.soundEnabled) return;
    const A = window.AudioContext || window.webkitAudioContext;
    if (!A) return;
    window.__audio = window.__audio || new A();
    const c = window.__audio;
    if (c.state === 'suspended') c.resume();
    const fs = kind === 'shine' ? [740, 988, 1319] : kind === 'done' ? [440, 660, 880] : kind === 'ok' ? [520, 760] : [180];
    const type = kind === 'shine' ? 'triangle' : 'sine';
    fs.forEach((f, i) => {
        const o = c.createOscillator(), g = c.createGain();
        o.type = type;
        o.frequency.value = f;
        g.gain.value = .0001;
        g.gain.exponentialRampToValueAtTime(kind === 'shine' ? .055 : .09, c.currentTime + .01 + i * .06);
        g.gain.exponentialRampToValueAtTime(.0001, c.currentTime + .13 + i * .06);
        o.connect(g).connect(c.destination);
        o.start(c.currentTime + i * .06);
        o.stop(c.currentTime + .16 + i * .06);
    });
}

export function particles(x, y) {
    if (state.graphics === 1) return;
    for (let i = 0; i < 10; i++) {
        const p = document.createElement('span');
        p.className = 'particle';
        p.style.left = x + 'px';
        p.style.top = y + 'px';
        p.style.width = p.style.height = (4 + Math.random() * 5) + 'px';
        p.style.background = Math.random() > .5 ? 'var(--gold)' : 'var(--success)';
        const a = Math.random() * Math.PI * 2, d = 25 + Math.random() * 45;
        p.style.setProperty('--dx', Math.cos(a) * d + 'px');
        p.style.setProperty('--dy', Math.sin(a) * d + 'px');
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 900);
    }
}

export function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
}

export function diffDays(a, b) {
    return Math.floor((new Date(b) - new Date(a)) / 86400000);
}

export function hijri(d = new Date()) {
    try {
        return new Intl.DateTimeFormat('ar-SA-u-ca-islamic', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
    } catch { return ''; }
}

export function greeting() {
    const h = new Date().getHours(), n = state.name || 'يا صديقي';
    if (h >= 2 && h < 5) return `وقت الخلوات يا ${n} 🌌`;
    if (h < 6) return `صباح الهمة والبركة يا ${n} 🌅`;
    if (h < 12) return `صباح الخير يا ${n} ☀️`;
    if (h < 17) return `طاب يومك يا ${n} 🌤️`;
    if (h < 22) return `مساء الهدوء يا ${n} 🌙`;
    return `ليلة مباركة يا ${n} 🌌`;
}
