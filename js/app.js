// js/app.js

import { stateManager, state } from './state.js';
import { $, esc, fmt, toast, haptic, beep, particles, addDays, diffDays, hijri, greeting } from './utils.js';
import { surahs, dailyVerses, method, reminders, asbab, wordMeanings, tazkiyah, tajRules, adhkar, TAZKIYAH_DAYS, DEEP, ARCHIVE_META, ARCHIVE_EXTRA, STUDY_GUIDES } from './data.js';

// دوال حفظ واستدعاء سريعة
const save = () => stateManager.save();
const dayKey = (d) => stateManager.getDayKey(d);

// المتغيرات التشغيلية
let chartMonth = new Date(), timer = null, timeLeft = 0, focusStarted = 0, recording = null, recordUrl = null, noise = null, deferredInstall = null, currentStudy = null, currentStudyTab = 'all', currentVerses = [], currentPrayer = null, oceanSound = null, oceanSoundGain = null, oceanSoundSource = null;
let quranBook = null, mushafSura = 1, mushafSelected = null, mushafTab = 'overview';
const quranCache = { tafseer: {}, words: {} };
const QURAN_BASE = 'quran-uthmani.json';

// ==========================================
// 1. دوال الوقت والمظهر والإعدادات
// ==========================================

function ritualKey(d = new Date()) {
    const p = state.prayerToday?.Maghrib;
    const now = new Date(d);
    if (p) {
        const [h, m] = String(p).split(':').map(Number);
        const mg = new Date(now); mg.setHours(h || 0, m || 0, 0, 0);
        if (now >= mg) return dayKey(addDays(now, 1));
    }
    return dayKey(now);
}

function requestNotifications() {
    if (!('Notification' in window)) return toast('الإشعارات غير مدعومة في هذا المتصفح');
    Notification.requestPermission().then(p => {
        state.notify = p === 'granted';
        save();
        toast(p === 'granted' ? 'تم تفعيل الإشعارات ✅' : 'لم يتم السماح بالإشعارات');
    }).catch(() => toast('تعذر طلب الإذن'));
}

function setTimeGlow() {
    const h = new Date().getHours();
    const c = h < 6 ? 'rgba(92,133,86,.08)' : h < 12 ? 'rgba(212,175,55,.10)' : h < 17 ? 'rgba(220,155,70,.08)' : h < 21 ? 'rgba(90,180,150,.08)' : 'rgba(51,82,55,.10)';
    document.documentElement.style.setProperty('--timeGlow', c);
}

function applyGraphics() {
    const cores = navigator.hardwareConcurrency || 8;
    const mem = navigator.deviceMemory || 8;
    const compact = window.innerWidth < 700;
    const coarse = matchMedia('(pointer:coarse)').matches;
    const lowPower = cores <= 4 || mem <= 4;
    document.body.classList.remove('mode-1', 'mode-2', 'mode-3');
    document.body.classList.add(`mode-${state.graphics}`);
    document.body.dataset.theme = state.theme;
    document.body.dataset.perf = (lowPower || state.graphics === 1) ? 'lite' : 'full';
    document.body.classList.toggle('lite-mobile', compact || coarse || lowPower || state.graphics === 1);
    document.body.dataset.graphics = String(state.graphics);
    createStars();
    createOceanBubbles();
    createGlobalOceanBubbles();
    const g = $('graphicsSelect'); if (g) g.value = String(state.graphics);
    const t = $('themeSelect'); if (t) t.value = state.theme;
}

function createStars() {
    const box = $('starsLayer'); if (!box) return;
    box.innerHTML = ''; if (state.graphics === 1) return;
    const n = state.graphics === 3 ? (window.innerWidth > 1400 ? 28 : window.innerWidth > 1000 ? 20 : 12) : (window.innerWidth > 1000 ? 14 : 8);
    const f = document.createDocumentFragment();
    for (let i = 0; i < n; i++) {
        const s = document.createElement('span');
        s.className = 'star';
        s.style.left = Math.random() * 100 + '%';
        s.style.top = Math.random() * 100 + '%';
        s.style.setProperty('--dur', (20 + Math.random() * 18) + 's');
        s.style.setProperty('--dx', (-18 + Math.random() * 36) + 'px');
        s.style.setProperty('--dy', (-18 + Math.random() * 36) + 'px');
        f.appendChild(s);
    }
    box.appendChild(f);
}

// ==========================================
// 2. دوال التتبع (Tracking) والشاشة الافتتاحية
// ==========================================

function logActivity(k, n = 1) {
    const t = dayKey();
    state.dailyLog[t] ||= { save: 0, review: 0, rep: 0, focus: 0 };
    state.dailyLog[t][k] = (state.dailyLog[t][k] || 0) + n;
    save();
}

function markActive() {
    const t = dayKey();
    if (state.lastActive === t) return;
    const old = state.streak || 0;
    state.streak = !state.lastActive ? 1 : (diffDays(state.lastActive, t) === 1 ? old + 1 : 1);
    state.lastActive = t;
    if (!state.firstDate) state.firstDate = t;
    if (state.streak > old && state.streak % 7 === 0) state.streakFreezes = Math.min(3, (state.streakFreezes || 0) + 1);
    save();
}

function getDailyVerse() {
    return dailyVerses[Math.floor(Date.now() / 86400000) % dailyVerses.length];
}

function recitationUrl(s, a, r = state.reciter) {
    return `https://everyayah.com/data/${r}/${String(s).padStart(3, '0')}${String(a).padStart(3, '0')}.mp3`;
}

function showDailySplash(force = false) {
    if (!state.name) return;
    const key = ritualKey();
    if (!force && localStorage.getItem('rafiq-splash-boundary') === key) return;
    const a = getDailyVerse();
    const ay = $('splashAyah'), ref = $('splashRef'), audio = $('splashAudio'), panel = $('dailySplash');
    if (!ay || !ref || !audio || !panel) return;
    ay.textContent = a.text;
    ref.textContent = `${a.ref} — بصوت ${a.name}`;
    audio.pause();
    audio.src = recitationUrl(a.s, a.a, a.reciter || state.reciter);
    audio.volume = Math.max(0, Math.min(1, state.volume || .85));
    audio.currentTime = 0;
    panel.classList.add('show');
    const play = $('splashPlay'); if (play) play.textContent = '▶ تشغيل الآية';
}

function closeSplash(mark = true) {
    const a = $('splashAudio'); if (a) { a.pause(); a.currentTime = 0 }
    $('dailySplash')?.classList.remove('show');
    if (mark) localStorage.setItem('rafiq-splash-boundary', ritualKey());
}

function openModal(id) { $(id)?.classList.add('show') }
function closeModal(id) { $(id)?.classList.remove('show') }

function switchView(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    $(id)?.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === id));
    document.body.classList.toggle('ocean-world', id === 'spiritual');
    document.body.classList.toggle('view-spiritual', id === 'spiritual');
    if ($('globalZadOcean')) $('globalZadOcean').style.display = id === 'spiritual' ? 'none' : 'block';
    if (id !== 'spiritual') document.body.classList.remove('space-world');
    if (id === 'spiritual') {
        const o = $('ocean'), s = $('spaceView');
        if (o) { o.style.display = 'block'; o.classList.remove('ocean-dive') }
        if (s) s.classList.remove('show')
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
    if (id === 'home') renderHome();
    if (id === 'planning') renderPlanning();
    if (id === 'mushaf') mushafInit();
    if (id === 'spiritual') { renderSpiritual(); createOceanBubbles() } else if (oceanSound) stopOceanSound();
    if (id === 'progress') renderProgress();
    if (id === 'settings') renderSettings();
    setTimeGlow();
}

// ==========================================
// 3. دوال الشاشة الرئيسية (Home) و الأوراد
// ==========================================

function renderHome() {
    const greg = new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const g = $('greeting'); if (g) g.textContent = greeting();
    const dl = $('dateLine'); if (dl) dl.textContent = greg;
    const hl = $('hijriLine'); if (hl) hl.textContent = `التاريخ الهجري: ${hijri()}`;
    const t = dayKey(); const log = state.dailyLog[t] || {};
    const due = state.entries.filter(e => e.nextReviewDate <= t && e.hasBeenEvaluated);
    const fresh = state.entries.filter(e => e.date === t && !e.hasBeenEvaluated);
    const old = state.entries.filter(e => e.date !== t);
    const pct = state.goal ? Math.min(100, estimateProgress() / state.goal * 100) : 0;
    
    if($('heroPct')) $('heroPct').textContent = `${pct.toFixed(0)}%`;
    if($('heroRing')) $('heroRing').style.setProperty('--pct', pct + '%');
    if($('missionReviewText')) $('missionReviewText').textContent = `${log.review || 0}/${state.dailyReviewTarget || 3}`;
    if($('missionRepText')) $('missionRepText').textContent = `${log.rep || 0}/${state.dailyRepTarget || 10}`;
    if($('missionFocusText')) $('missionFocusText').textContent = `${Math.round(log.focus || 0)}/${state.dailyFocusTarget || 20}د`;
    
    if($('missionReviewBar')) $('missionReviewBar').style.width = Math.min(100, (log.review || 0) / (state.dailyReviewTarget || 3) * 100) + '%';
    if($('missionRepBar')) $('missionRepBar').style.width = Math.min(100, (log.rep || 0) / (state.dailyRepTarget || 10) * 100) + '%';
    if($('missionFocusBar')) $('missionFocusBar').style.width = Math.min(100, (log.focus || 0) / (state.dailyFocusTarget || 20) * 100) + '%';
    
    if($('homePriority')) $('homePriority').textContent = due.length ? `ابدأ بـ ${due.length} مراجعة مستحقة الآن، ثم الحفظ الجديد، ثم 10 تكرارات غيبًا.` : fresh.length ? `ابدأ بالحفظ الجديد: ${fresh.length} ورد، ثم أكمل 10 تكرارات غيبًا وسجّل تقييم اليوم.` : 'لا توجد مراجعات طارئة الآن. نفّذ خطة اليوم أو أضف حفظًا جديدًا.';
    if($('homeNewList')) $('homeNewList').innerHTML = fresh.length ? fresh.map(entryCard).join('') : '<div class="muted">لا يوجد حفظ جديد اليوم.</div>';
    if($('homeDueList')) $('homeDueList').innerHTML = due.length ? due.map(entryCard).join('') : '<div class="muted">🎉 لا توجد مراجعات مستحقة الآن.</div>';
    if($('homeOldSummary')) $('homeOldSummary').textContent = old.length ? `لديك ${old.length} وردًا محفوظًا سابقًا. المستحق الآن: ${old.filter(e => e.nextReviewDate <= t).length}. خلال 7 أيام: ${old.filter(e => e.nextReviewDate > t && e.nextReviewDate <= dayKey(addDays(new Date(), 7))).length}.` : 'أضف محفوظك السابق مرة واحدة ليبني لك التطبيق مراجعاته.';
    if($('homeOldList')) $('homeOldList').innerHTML = old.slice(0, 5).map(entryMini).join('') || '<div class="muted">لا يوجد محفوظ سابق مضاف بعد.</div>';
    if($('homeSchedule')) $('homeSchedule').innerHTML = buildNextDays();
    if($('homeMethod')) $('homeMethod').innerHTML = method.slice(0, 3).map(m => `<div class="schedule-day"><strong>${m[0]} — ${m[1]}</strong><div class="small">${m[2]}</div></div>`).join('');
    if($('todaySpiritualNote')) $('todaySpiritualNote').textContent = tazkiyah[Math.floor(Date.now() / 86400000) % tazkiyah.length];
    
    renderPrayerChecklist();
    const a = getDailyVerse();
    if($('dailyVerseHome')) $('dailyVerseHome').textContent = a.text;
    if($('dailyVerseRef')) $('dailyVerseRef').textContent = a.ref;
}

function estimateProgress() { return state.entries.reduce((n, e) => n + (e.hasBeenEvaluated ? Math.max(0, e.baseUnits || 1) : 0), 0) }

function buildNextDays() {
    let h = '';
    for (let i = 0; i < 7; i++) {
        const d = addDays(new Date(), i), k = dayKey(d), due = state.entries.filter(e => e.nextReviewDate <= k && e.hasBeenEvaluated).length, newN = state.entries.filter(e => e.date === k && !e.hasBeenEvaluated).length;
        h += `<div class="schedule-day"><strong>${d.toLocaleDateString('ar-EG', { weekday: 'long' })}</strong><div class="small">${k} — مراجعة ${due} • جديد ${newN || (i === 0 ? state.dailyPlan : 0)}</div></div>`
    } return h
}

function entryCard(e) {
    const t = dayKey(), due = e.hasBeenEvaluated && e.nextReviewDate <= t, phase = e.phaseDays?.length || 0, reps = e.sessionReps || 0;
    const reviewButtons = phase < 7 ? `<div class="qbtns"><button class="success" onclick="window.reviewEntry('${e.id}','pass')">✅ أتممت اليوم</button><button class="danger" onclick="window.reviewEntry('${e.id}','fail')">🔄 لم أتقن</button></div>` : state.evalMode === 'weekly' ? `<div class="qbtns"><button class="success" onclick="window.reviewEntry('${e.id}','pass')">✅ ممتازة — 7 أيام</button><button class="danger" onclick="window.reviewEntry('${e.id}','fail')">🔴 أعد غدًا</button></div>` : `<div class="qbtns"><button class="info" onclick="window.reviewEntry('${e.id}',4)">🔵 سهل</button><button class="success" onclick="window.reviewEntry('${e.id}',3)">🟢 تذكرته</button><button class="warning" onclick="window.reviewEntry('${e.id}',2)">🟡 بصعوبة</button><button class="danger" onclick="window.reviewEntry('${e.id}',1)">🔴 نسيت</button></div>`;
    return `<div class="item ${due ? 'due' : ''} ${e.intensive ? 'focus' : ''}"><div class="item-header"><div><div class="quran-title">${esc(e.label)} ${e.isExactLetters ? '🎯' : ''}</div>${e.note ? `<div class="note-txt">📌 ${esc(e.note)}</div>` : ''}</div><div class="row"><button class="action danger" onclick="window.openRecorder('${e.id}')">🎤</button><button class="action" onclick="window.deleteEntry('${e.id}')">✕</button></div></div><div class="item-meta"><div>${!e.hasBeenEvaluated ? '✨ ورد جديد' : due ? '⏰ مستحق الآن' : `📅 القادم ${e.nextReviewDate}`}</div><div class="phase"><span class="badge gold">${phase < 7 ? `تثبيت ${phase}/7` : 'استدامة'}</span>${phase < 7 ? Array.from({ length: 7 }, (_, i) => `<span class="dot ${i < phase ? 'on' : ''}"></span>`).join('') : ''}</div></div><div class="links"><a href="https://quran.com/${smartPath(e.label)}" target="_blank" rel="noopener">📖 المصحف</a></div><div class="rep-box"><div class="rep-row"><b>${phase < 7 && !e.hasBeenEvaluated ? 'هدف التثبيت: 10 تكرارات غيبًا' : 'تكرار إضافي'}</b><button class="rep-btn ${reps >= 10 ? 'done' : ''}" onclick="window.addRep('${e.id}',this)">📿 كررت (${reps})</button></div><div class="small">إجمالي التكرارات: ${e.totalReps || 0}</div></div>${(!e.hasBeenEvaluated || due) ? reviewButtons : ''}</div>`
}

function entryMini(e) { return `<div class="old-row"><div><b>${esc(e.label)}</b><div class="small">${e.nextReviewDate <= dayKey() ? 'مستحق الآن' : 'المراجعة ' + e.nextReviewDate}</div></div><span class="badge ${e.nextReviewDate <= dayKey() ? 'red' : 'gold'}">${e.nextReviewDate <= dayKey() ? '⏰ مستحق' : '📅 مجدول'}</span></div>` }

function smartPath(label) {
    const m = label.match(/(?:صفحة|صفحه|ص)\s*(\d+)/); if (m) return `page/${m[1]}`;
    let s = -1; surahs.forEach((x, i) => { if (s < 0 && label.includes(x)) s = i + 1 });
    const a = label.match(/(?:آية|ايه|آيه|اية)\s*(\d+)/); return s > 0 ? (a ? `${s}/${a[1]}` : `${s}`) : `search?q=${encodeURIComponent(label)}`
}

function saveEntry(label, note, intensive, baseLetters, old = false) {
    const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
    const e = { id, label, note, intensive: !!intensive, isExactLetters: false, date: dayKey(), nextReviewDate: dayKey(), hasBeenEvaluated: false, phaseDays: old ? ['old1', 'old2', 'old3', 'old4', 'old5', 'old6', 'old7'] : [], reviewCount: 0, reviewReads: 0, manualReps: 0, totalReps: 0, sessionReps: 0, lastRepDate: dayKey(), interval: old ? 7 : 0, ease: 2.5, srsLevel: old ? 1 : 0, failCount: 0, baseLetters, baseUnits: Math.max(.1, baseLetters / 500) };
    state.entries.push(e);
    logActivity('save');
    markActive();
    save();
    renderAll();
    particles(innerWidth / 2, innerHeight / 2);
    beep('done'); haptic('done');
}

async function resolveLetters(label, count, unit) {
    try {
        const ref = parseRef(label); if (!ref) return count * unit;
        const url = ref.page ? `https://api.alquran.cloud/v1/page/${ref.page}/quran-uthmani` : `https://api.alquran.cloud/v1/ayah/${ref.sura}:${ref.aya}/quran-uthmani`;
        const r = await fetch(url); if (!r.ok) throw 0;
        const j = await r.json(); const text = j?.data?.ayahs ? j.data.ayahs.map(a => a.text).join('') : (j?.data?.text || '');
        const n = text.replace(/[^\u0621-\u064A]/g, '').length; return n || count * unit
    } catch { return count * unit }
}

function parseRef(label) {
    const page = label.match(/(?:صفحة|صفحه|ص)\s*(\d+)/); if (page) return { page: +page[1] };
    let s = -1; surahs.forEach((x, i) => { if (s < 0 && label.includes(x)) s = i + 1 });
    const a = label.match(/(?:آية|ايه|آيه|اية)\s*(\d+)/); return s > 0 && a ? { sura: s, aya: +a[1] } : null
}

async function addNew() {
    const label = $('newLabel').value.trim(); if (!label) return toast('اكتب الورد أولًا');
    const count = +$('newUnitCount').value || 1, unit = +$('newUnit').value || 500;
    $('saveNewBtn').disabled = true;
    const letters = await resolveLetters(label, count, unit);
    saveEntry(label, $('newNote').value.trim(), $('intensiveCheck').checked, letters, false);
    closeModal('addNewModal');
    $('newLabel').value = ''; $('newNote').value = ''; $('intensiveCheck').checked = false; $('saveNewBtn').disabled = false
}

async function addOld() {
    const label = $('oldLabel').value.trim(); if (!label) return toast('اكتب اسم المحفوظ');
    const count = +$('oldCount').value || 1, unit = +$('oldUnit').value || 500;
    const letters = await resolveLetters(label, count, unit);
    saveEntry(label, '', false, letters, true);
    closeModal('addOldModal'); $('oldLabel').value = ''
}

function deleteEntry(id) {
    const e = state.entries.find(x => x.id === id); if (!e) return;
    if (!confirm(`حذف «${e.label}»؟`)) return;
    state.entries = state.entries.filter(x => x.id !== id);
    save(); renderAll()
}

function addRep(id, btn) {
    const e = state.entries.find(x => x.id === id); if (!e) return;
    if (e.lastRepDate !== dayKey()) e.sessionReps = 0;
    e.sessionReps++; e.manualReps++; e.totalReps = e.manualReps + e.reviewReads; e.lastRepDate = dayKey();
    logActivity('rep'); markActive(); save(); renderAll();
    if (btn) { const r = btn.getBoundingClientRect(); particles(r.left + r.width / 2, r.top + r.height / 2) }
    beep(e.sessionReps >= 10 ? 'done' : 'click'); haptic(e.sessionReps >= 10 ? 'done' : 'light')
}

function reviewEntry(id, q) {
    const e = state.entries.find(x => x.id === id); if (!e) return;
    const t = dayKey(); const phase = e.phaseDays?.length || 0;
    if (phase < 7) {
        if ((e.sessionReps || 0) < 10 && q === 'pass' && !confirm('لم تكمل 10 تكرارات. هل تريد التقييم الآن؟')) return;
        if (q === 'pass') {
            if (e.phaseDays.includes(t)) return toast('سجلت مراجعة اليوم بالفعل');
            if (e.phaseDays.length && e.phaseDays.at(-1).match(/^\d{4}-\d{2}-\d{2}$/) && diffDays(e.phaseDays.at(-1), t) > 1) e.phaseDays = [];
            e.phaseDays.push(t); e.interval = 1
        } else { e.phaseDays = []; e.interval = 1; e.failCount++ }
    } else {
        if (state.evalMode === 'weekly') e.interval = q === 'pass' ? 7 : 1;
        else if (q === 4) { e.srsLevel++; e.ease += .15; e.interval = e.srsLevel === 1 ? 4 : Math.max(1, Math.round((e.interval || 1) * e.ease * 1.3)) }
        else if (q === 3) { e.srsLevel++; e.interval = e.srsLevel === 1 ? 1 : Math.max(1, Math.round((e.interval || 1) * e.ease)) }
        else if (q === 2) { e.ease = Math.max(1.3, e.ease - .15); e.interval = Math.max(1, Math.round((e.interval || 1) * 1.2)) }
        else { e.srsLevel = 0; e.interval = 1; e.failCount++ }
    }
    e.hasBeenEvaluated = true; e.reviewCount++; e.reviewReads++; e.totalReps = e.manualReps + e.reviewReads; e.sessionReps = 0;
    const d = addDays(new Date(), e.interval); e.nextReviewDate = dayKey(d);
    logActivity('review'); markActive(); save(); renderAll();
    beep((q === 'pass' || q === 3 || q === 4 || e.phaseDays.length >= 7) ? 'done' : 'click');
    haptic((q === 'pass' || q === 3 || q === 4) ? 'done' : 'light')
}

// ==========================================
// 4. دوال التخطيط (Planning) والأثر (Progress)
// ==========================================

function renderPlanning() {
    const t = dayKey();
    if($('weeklyPlan')) $('weeklyPlan').innerHTML = buildPlan(7);
    if($('monthlyPlan')) $('monthlyPlan').innerHTML = buildPlan(30);
    const arr = [...state.entries].sort((a, b) => a.nextReviewDate.localeCompare(b.nextReviewDate));
    if($('poolList')) $('poolList').innerHTML = arr.length ? arr.map(entryCard).join('') : '<div class="muted">لم تضف أورادًا بعد.</div>';
    const f = state.entries.filter(e => e.intensive);
    if($('focusList')) $('focusList').innerHTML = f.length ? f.map(entryCard).join('') : '<div class="muted">لا توجد أوراد في المتابعة المكثفة.</div>';
    renderPlanPreview();
}

function buildPlan(days) {
    let h = '';
    for (let i = 0; i < days; i++) {
        const d = addDays(new Date(), i), k = dayKey(d), due = state.entries.filter(e => e.hasBeenEvaluated && e.nextReviewDate <= k).length, newN = i === 0 ? state.dailyPlan : state.dailyPlan;
        h += `<div class="schedule-day"><strong>${d.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'short' })}</strong><div class="small">جديد: ${newN} ${state.goalUnit} • مراجعة: ${due}</div></div>`
    } return h
}

function renderPlanPreview() {
    const d = state.planDays || 30, qty = state.planMode === 'auto' ? Math.max(1, Math.ceil((state.goal || 604) / d)) : state.dailyPlan;
    if($('planPreview')) $('planPreview').innerHTML = `الخطة الحالية: <b>${qty}</b> ${state.goalUnit} يوميًا لمدة <b>${d}</b> يومًا، مع مراجعة تقارب <b>${state.reviewRatio}</b> وحدات مراجعة لكل وحدة جديد.`
}

function savePlan() {
    state.planMode = $('planMode').value; state.dailyPlan = Math.max(1, Math.round(+$('planDaily').value || state.dailyPlan || 2));
    state.planDays = Math.max(1, Math.round(+$('planDays').value || state.planDays || 30));
    state.reviewRatio = Math.max(1, Math.min(20, Math.round(+$('planReviewRatio').value || 3)));
    if (state.planMode === 'auto') state.dailyPlan = Math.max(1, Math.ceil((state.goal || 604) / state.planDays));
    state.planStart = dayKey(); save(); renderAll(); toast('تم حفظ خطة الحفظ والمراجعة ✅')
}

function calculateReverse() {
    const n = +$('reverseAmount').value; const d = $('reverseDate').value;
    if (!n || !d) return toast('أدخل البيانات');
    const days = Math.max(1, diffDays(dayKey(), d)); const per = n / days;
    $('reverseResult').innerHTML = `تحتاج تقريبًا إلى <b>${per.toFixed(2)}</b> ${esc($('reverseUnit').value)} يوميًا لمدة <b>${days}</b> يومًا.`
}

function dayScore(k) { const l = state.dailyLog[k] || {}; return (l.save || 0) * 3 + (l.review || 0) * 2 + (l.rep || 0) * .12 + (l.focus || 0) * .05 }

function renderProgress() {
    const ev = state.entries.filter(e => e.hasBeenEvaluated).length;
    const letters = state.entries.reduce((n, e) => n + (e.baseLetters || 0) * (e.totalReps || 0), 0);
    if($('pStreak')) $('pStreak').textContent = state.streak;
    if($('pEntries')) $('pEntries').textContent = state.entries.length;
    if($('pReviews')) $('pReviews').textContent = state.entries.reduce((n, e) => n + (e.reviewCount || 0), 0);
    if($('pLetters')) $('pLetters').textContent = fmt(letters);
    const pct = state.goal ? Math.min(100, ev / state.goal * 100) : 0;
    if($('goalProgress')) $('goalProgress').style.width = pct + '%';
    if($('goalText')) $('goalText').textContent = `إنجاز ${ev} من ${state.goal} ${state.goalUnit} (${pct.toFixed(1)}%)`;
    renderCalendar(); drawChart(); renderHeatmap(); renderConstellation(); renderAnalytics(); renderMistakes();
}

function renderCalendar() {
    const y = chartMonth.getFullYear(), m = chartMonth.getMonth();
    if($('calTitle')) $('calTitle').textContent = new Date(y, m, 1).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
    const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
    let h = '<div class="cal">'; ['أحد', 'اثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'].forEach(x => h += `<div class="calcell calhead">${x}</div>`);
    for (let i = 0; i < first; i++) h += '<div class="calcell"></div>';
    for (let d = 1; d <= days; d++) {
        const k = dayKey(new Date(y, m, d)), s = dayScore(k), cls = s >= 6 ? 'dg' : s > 0 ? 'dy' : k < dayKey() ? 'dr' : '';
        h += `<div class="calcell ${cls}"><b>${d}</b><span>${s.toFixed(1)}</span></div>`
    } h += '</div>';
    if($('calendar')) $('calendar').innerHTML = h;
}

function drawChart() {
    const c = $('activityChart'); if(!c) return;
    const r = c.getBoundingClientRect(), w = Math.max(320, r.width), h = 260, dpr = devicePixelRatio || 1;
    c.width = w * dpr; c.height = h * dpr; const ctx = c.getContext('2d'); ctx.scale(dpr, dpr); ctx.clearRect(0, 0, w, h);
    const vals = []; for (let i = 29; i >= 0; i--) vals.push(dayScore(dayKey(addDays(new Date(), -i))));
    const max = Math.max(8, ...vals);
    ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--gold'); ctx.lineWidth = 3; ctx.beginPath();
    vals.forEach((v, i) => { const x = 18 + i * (w - 36) / 29, y = h - 25 - (v / max) * (h - 45); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y) }); ctx.stroke();
}

function renderHeatmap() {
    const box = $('heatmap'); if(!box) return; box.innerHTML = '';
    for (let i = 363; i >= 0; i--) {
        const s = dayScore(dayKey(addDays(new Date(), -i))), d = document.createElement('div');
        d.className = 'heat ' + (s >= 10 ? 'l4' : s >= 6 ? 'l3' : s >= 2 ? 'l2' : s > 0 ? 'l1' : '');
        d.title = dayKey(addDays(new Date(), -i)); box.appendChild(d);
    }
}

function renderConstellation() {
    const done = new Set(); state.entries.forEach(e => { if (!e.hasBeenEvaluated) return; surahs.forEach((s, i) => { if (e.label.includes(s)) done.add(i) }) });
    if($('constellation')) $('constellation').innerHTML = surahs.map((s, i) => `<div class="cstar ${done.has(i) ? 'on' : ''}" title="${s}">★</div>`).join('');
}

function renderAnalytics() {
    const days = Object.keys(state.dailyLog), reviews = days.reduce((n, k) => n + (state.dailyLog[k]?.review || 0), 0), focus = state.focusMin || 0;
    if($('analytics')) $('analytics').innerHTML = `<div class="schedule-day">متوسط التركيز لكل ورد<br><b>${(focus / Math.max(1, state.entries.length)).toFixed(1)} دقيقة</b></div><div class="schedule-day">إجمالي المراجعات<br><b>${reviews}</b></div><div class="schedule-day">أيام النشاط<br><b>${days.length}</b></div><div class="schedule-day">أفضل سلسلة<br><b>${state.streak} يوم</b></div>`
}

function renderMistakes() {
    const list = state.mistakes || [];
    if($('mistakesList')) $('mistakesList').innerHTML = list.length ? list.map((m, i) => `<div class="schedule-day"><div class="row" style="justify-content:space-between"><strong>${esc(m.title)}</strong><button class="action danger" onclick="window.deleteMistake(${i})">✕</button></div><div class="small">${esc(m.text)}</div></div>`).join('') : '<div class="muted">لا توجد ملاحظات بعد.</div>';
    if($('mistakeFormList')) $('mistakeFormList').innerHTML = list.map((m, i) => `<div class="schedule-day"><strong>${esc(m.title)}</strong><div class="small">${esc(m.text)}</div></div>`).join('');
}

function deleteMistake(i) { state.mistakes.splice(i, 1); save(); renderProgress() }
function saveMistake() {
    const t = $('mistakeTitle').value.trim(), x = $('mistakeText').value.trim();
    if (!t || !x) return toast('اكتب العنوان والملاحظة');
    state.mistakes.unshift({ title: t, text: x, type: 'ملاحظة', date: dayKey() });
    save(); $('mistakeTitle').value = ''; $('mistakeText').value = ''; renderMistakes()
}

// ==========================================
// 5. دوال الصوت والمؤثرات (Audio & Ambience)
// ==========================================

function playAmbient() {
    const a = $('splashAudio'); const v = getDailyVerse();
    if(!a) return;
    a.src = recitationUrl(v.s, v.a, state.reciter);
    a.loop = true; a.volume = state.volume;
    a.play().then(() => { state.ambient = true; save(); if($('ambientQuranBtn')) $('ambientQuranBtn').textContent = '⏹ إيقاف القرآن الهادئ' }).catch(() => toast('اضغط تشغيل بعد السماح للصوت'));
}

function stopAmbient() {
    const a = $('splashAudio'); if(a){ a.pause(); a.loop = false; }
    state.ambient = false; save(); if($('ambientQuranBtn')) $('ambientQuranBtn').textContent = '▶ قرآن هادئ';
}

function noiseStart(type) {
    if (noise) { noise.close(); noise = null; return }
    const A = window.AudioContext || window.webkitAudioContext; if (!A) return;
    noise = new A(); const b = noise.createBuffer(1, noise.sampleRate * 2, noise.sampleRate), d = b.getChannelData(0);
    let last = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = type === 'brown' ? last + .06 * w : w; d[i] = type === 'brown' ? last * .45 : w * .16 }
    const s = noise.createBufferSource(); s.buffer = b; s.loop = true;
    const f = noise.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = type === 'brown' ? 500 : 1800;
    const g = noise.createGain(); g.gain.value = type === 'brown' ? .06 : .025;
    s.connect(f).connect(g).connect(noise.destination); s.start();
}

function startFocus() {
    if (timeLeft <= 0) return toast('اختر مدة أولًا');
    $('breathBox').style.display = 'block'; $('timerBox').style.display = 'none';
    $('breatheCircle').style.animation = 'breatheIn 2s forwards'; $('breathText').textContent = 'شهيق…';
    setTimeout(() => { $('breatheCircle').style.animation = 'breatheOut 2s forwards'; $('breathText').textContent = 'زفير…' }, 2000);
    setTimeout(() => {
        $('breathText').textContent = 'استعن بالله';
        setTimeout(() => { $('breathBox').style.display = 'none'; $('timerBox').style.display = 'block'; runTimer() }, 3500)
    }, 4000);
}

function runTimer() {
    clearInterval(timer); focusStarted = Date.now();
    timer = setInterval(() => {
        timeLeft--; renderTimer();
        if (timeLeft <= 0) {
            clearInterval(timer); const mins = Math.max(1, Math.round((Date.now() - focusStarted) / 60000));
            state.focusMin += mins; logActivity('focus', mins); markActive(); save(); beep('done'); haptic('done');
            toast('انتهت جلسة التركيز ✅'); closeModal('focusModal');
        }
    }, 1000);
}

function renderTimer() { if($('timer')) $('timer').textContent = `${String(Math.floor(timeLeft / 60)).padStart(2, '0')}:${String(timeLeft % 60).padStart(2, '0')}`; }

function openRecorder(id) {
    const e = state.entries.find(x => x.id === id); if (!e) return;
    if($('recordTarget')) $('recordTarget').textContent = e.label;
    if($('recordPlayback')) $('recordPlayback').style.display = 'none';
    if($('recordStatus')) $('recordStatus').textContent = 'اضغط للبدء';
    if($('recordBtn')) $('recordBtn').textContent = '🎤';
    openModal('recorderModal');
}

async function toggleRecorder() {
    if (recording?.state === 'recording') { recording.stop(); return }
    if (!navigator.mediaDevices?.getUserMedia) return toast('التسجيل يحتاج HTTPS أو localhost');
    try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        recording = new MediaRecorder(s); const chunks = [];
        recording.ondataavailable = e => e.data.size && chunks.push(e.data);
        recording.onstop = () => {
            const b = new Blob(chunks, { type: recording.mimeType || 'audio/webm' });
            if (recordUrl) URL.revokeObjectURL(recordUrl);
            recordUrl = URL.createObjectURL(b);
            if($('recordPlayback')){ $('recordPlayback').src = recordUrl; $('recordPlayback').style.display = 'block'; }
            if($('recordStatus')) $('recordStatus').textContent = 'استمع لتسجيلك ثم قارن بالمصحف';
            s.getTracks().forEach(t => t.stop());
            if($('recordBtn')) $('recordBtn').textContent = '🎤';
        };
        recording.start();
        if($('recordBtn')) $('recordBtn').textContent = '⏹';
        if($('recordStatus')) $('recordStatus').textContent = 'جارٍ التسجيل…';
    } catch { toast('اسمح للمتصفح باستخدام الميكروفون') }
}

// ==========================================
// 6. دوال المصحف الكامل (Mushaf Engine)
// ==========================================

async function loadQuranBook() {
    if (quranBook) return quranBook;
    try {
        const r = await fetch(QURAN_BASE, { cache: 'force-cache' });
        if (!r.ok) throw new Error('quran file');
        quranBook = await r.json(); return quranBook;
    } catch (e) { toast('تعذر تحميل المصحف المحلي'); return null; }
}

function quranStorageKey(type, s, a) { return `rq-${type}-${s}-${a}` }
function loadCache(type, s, a) { try { return localStorage.getItem(quranStorageKey(type, s, a)) || '' } catch { return '' } }
function saveCache(type, s, a, text) { try { localStorage.setItem(quranStorageKey(type, s, a), text) } catch { } }

function mushafSurahButton(s) { return `<button class="mushaf-surah-btn ${mushafSura === s.s ? 'active' : ''}" data-sura="${s.s}"><span class="mushaf-surah-num">${s.s}</span><span class="mushaf-surah-name">${esc(s.name)}</span><span class="mushaf-surah-meta">${s.type} • ${s.count}</span></button>` }

async function renderMushafList() {
    const b = await loadQuranBook(); if (!b) return;
    const q = ($('mushafSearch')?.value || '').trim();
    const list = b.filter(s => !q || s.name.includes(q) || String(s.s) === q);
    if($('mushafSurahList')) {
        $('mushafSurahList').innerHTML = list.map(mushafSurahButton).join('');
        document.querySelectorAll('.mushaf-surah-btn').forEach(x => x.onclick = () => { mushafSura = +x.dataset.sura; renderMushafList(); renderMushafSurah(); });
    }
}

function renderMushafSurah() {
    if (!quranBook) return;
    const s = quranBook.find(x => x.s === mushafSura) || quranBook[0]; mushafSelected = null;
    if($('mushafSurahTitle')) $('mushafSurahTitle').textContent = s.name;
    if($('mushafSurahMeta')) $('mushafSurahMeta').textContent = `${s.s} • ${s.type} • ${s.count} آيات`;
    if($('mushafPrev')) $('mushafPrev').disabled = s.s === 1;
    if($('mushafNext')) $('mushafNext').disabled = s.s === 114;
    if($('mushafVerses')) {
        $('mushafVerses').innerHTML = s.verses.map(v => `<article class="mushaf-ayah" data-ayah="${v.a}"><div class="mushaf-ayah-ref">${s.name} — الآية ${v.a} — رقمها في المصحف ${v.global}</div><div class="mushaf-ayah-text">${esc(v.text)}</div><div class="mushaf-ayah-actions"><button class="action info" data-study-ayah="${v.a}">🔍 دراسة الآية</button><button class="action" data-audio-ayah="${v.a}">🔊 استماع</button></div></article>`).join('');
        document.querySelectorAll('[data-study-ayah]').forEach(b => b.onclick = () => openAyahStudy(s.s, +b.dataset.studyAyah));
        document.querySelectorAll('[data-audio-ayah]').forEach(b => b.onclick = () => playAyahByReciter(s.s, +b.dataset.audioAyah));
    }
}

async function playAyahByReciter(s, a) {
    const au = new Audio(recitationUrl(s, a, state.reciter));
    au.volume = state.volume;
    await au.play().catch(() => toast('اضغط مرة أخرى لتشغيل الصوت'));
}

async function fetchVerseMeta(s, a) {
    let taf = loadCache('tafseer', s, a), word = loadCache('words', s, a);
    if (taf && word) return { taf, word };
    if($('mushafLoading')) $('mushafLoading').style.display = 'block';
    try {
        if (!taf) {
            const r = await fetch(`https://quranenc.com/api/v1/translation/aya/arabic_moyassar/${s}/${a}`, { cache: 'no-store' });
            if (r.ok) { const j = await r.json(); taf = j?.result?.translation || j?.data?.translation || j?.translation || ''; if (taf) saveCache('tafseer', s, a, taf); }
        }
        if (!word) {
            const r = await fetch(`https://quranenc.com/api/v1/translation/aya/arabic_seraj/${s}/${a}`, { cache: 'no-store' });
            if (r.ok) { const j = await r.json(); word = j?.result?.translation || j?.data?.translation || j?.translation || ''; if (word) saveCache('words', s, a, word); }
        }
    } catch { } finally { if($('mushafLoading')) $('mushafLoading').style.display = 'none'; }
    return { taf: taf || 'التفسير يحتاج اتصالًا لأول تحميل.', word: word || 'معاني الكلمات تحتاج اتصالًا لأول تحميل.' }
}

async function openAyahStudy(s, a) {
    const book = quranBook.find(x => x.s === s), v = book?.verses.find(x => x.a === a); if (!v) return;
    document.querySelectorAll('.mushaf-ayah').forEach(x => x.classList.toggle('selected', +x.dataset.ayah === a));
    const meta = await fetchVerseMeta(s, a);
    
    // واجهة الدراسة السريعة داخل المصحف
    if($('ayahStudyPanel')){
        $('ayahStudyPanel').style.display = 'block';
        $('ayahStudyPanel').innerHTML = `
            <div class="row" style="justify-content:space-between;gap:8px"><div><h3>📚 ${esc(book.name)} — الآية ${a}</h3></div><button class="action" id="closeAyahStudy">✕ إغلاق</button></div>
            <div class="ayah-detail-grid"><section class="ayah-detail"><h4>📖 التفسير الميسر</h4><p>${esc(meta.taf)}</p></section><section class="ayah-detail"><h4>🔎 معاني الكلمات</h4><p>${esc(meta.word)}</p></section></div>
        `;
        $('closeAyahStudy').onclick = () => { $('ayahStudyPanel').style.display = 'none'; document.querySelectorAll('.mushaf-ayah').forEach(x => x.classList.remove('selected')); };
        $('ayahStudyPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function mushafInit() {
    const root = $('mushaf'); if (!root) return;
    if (root.dataset.ready === '1') { loadQuranBook().then(() => { renderMushafList(); renderMushafSurah(); }); return; }
    root.dataset.ready = '1';
    loadQuranBook().then(() => { renderMushafList(); renderMushafSurah(); });
    $('mushafSearch')?.addEventListener('input', renderMushafList);
    $('mushafPrev')?.addEventListener('click', () => { if (mushafSura > 1) { mushafSura--; renderMushafList(); renderMushafSurah(); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
    $('mushafNext')?.addEventListener('click', () => { if (mushafSura < 114) { mushafSura++; renderMushafList(); renderMushafSurah(); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
}

// ==========================================
// 7. دوال واجهات النظام والتطبيقات المصغرة (Explore, Settings, Ocean)
// ==========================================

function renderSettings() {
    if($('graphicsSelect')) $('graphicsSelect').value = state.graphics;
    if($('themeSelect')) $('themeSelect').value = state.theme;
    if($('profileName')) $('profileName').value = state.name;
    if($('profileAge')) $('profileAge').value = state.age;
    if($('reciterSelect')) $('reciterSelect').value = state.reciter;
    if($('volumeRange')) $('volumeRange').value = state.volume;
    if($('notifyToggle')) $('notifyToggle').checked = state.notify;
    if($('notifyHour')) $('notifyHour').value = state.notifyHour;
    if($('calcMethod')) $('calcMethod').value = state.calcMethod;
    if($('asrMethod')) $('asrMethod').value = state.asrMethod;
    if($('cityInput')) $('cityInput').value = state.city;
    if($('prayerSettingsStatus')) $('prayerSettingsStatus').textContent = state.prayerToday ? `آخر مواقيت محفوظة: ${state.city}` : 'لم تحفظ مواقيت اليوم بعد.';
    if($('installStatus')) $('installStatus').textContent = deferredInstall ? 'التثبيت متاح الآن.' : 'يمكن التثبيت من قائمة المتصفح إذا لم يظهر الزر.';
}

function renderSpiritual() {
    const idx = Math.floor(Date.now() / 86400000);
    if($('tazkiyahText')) $('tazkiyahText').textContent = tazkiyah[idx % tazkiyah.length];
}

function prayerCacheKey() { return `prayer:${dayKey()}:${state.city}:${state.lat || ''}:${state.lon || ''}:${state.calcMethod}:${state.asrMethod}` }

async function prayerTimes() {
    const key = prayerCacheKey(), local = JSON.parse(localStorage.getItem(key) || 'null'); if (local) return local;
    if (!navigator.onLine) return null;
    let url = '';
    if (Number.isFinite(state.lat) && Number.isFinite(state.lon)) url = `https://api.aladhan.com/v1/timings/${dayKey()}?latitude=${state.lat}&longitude=${state.lon}&method=${state.calcMethod}&school=${state.asrMethod}`;
    else url = `https://api.aladhan.com/v1/timingsByCity/${dayKey()}?city=${encodeURIComponent(state.city)}&country=Egypt&method=${state.calcMethod}&school=${state.asrMethod}`;
    try {
        const r = await fetch(url); if (!r.ok) throw 0;
        const j = await r.json(); const data = j?.data?.timings || null;
        if (data) localStorage.setItem(key, JSON.stringify(data)); return data;
    } catch { return null; }
}

function renderPrayerChecklist() {
    const names = ['الفجر', 'الظهر', 'العصر', 'المغرب', 'العشاء']; const t = dayKey(); const box = $('prayerChecklist');
    if(!box) return;
    box.innerHTML = names.map(n => `<label class="schedule-day"><span class="row"><input type="checkbox" data-prayer="${n}" style="width:18px" ${state.prayers[t]?.[n] ? 'checked' : ''}><strong>${n}</strong></span></label>`).join('');
    box.querySelectorAll('input').forEach(i => i.onchange = () => { state.prayers[t] ||= {}; state.prayers[t][i.dataset.prayer] = i.checked; save(); });
    const times = state.prayerToday;
    if($('nextReminder')) $('nextReminder').textContent = nextReminderText(times);
}

function nextReminderText(times) {
    if (!times) return 'فعّل مواقيت الصلاة في الإعدادات لربط التذكيرات باليوم الشرعي.';
    const now = new Date(); const order = [['Fajr', 'الفجر'], ['Dhuhr', 'الظهر'], ['Asr', 'العصر'], ['Maghrib', 'المغرب'], ['Isha', 'العشاء']];
    for (const [k, n] of order) {
        const tt = times[k]; if (!tt) continue;
        const [h, m] = tt.split(':').map(Number); const d = new Date(); d.setHours(h, m, 0, 0);
        if (d > now) return `القادم: ${n} الساعة ${tt}`;
    } return 'بعد العشاء: الشفع والوتر، ثم بعد منتصف الليل تذكير بقيام الليل والاستغفار والدعاء.';
}

async function refreshPrayer() {
    const p = await prayerTimes(); state.prayerToday = p; save(); renderHome();
    if (p) toast('تم تحديث مواقيت الصلاة ✅');
}

function recommend() {
    const feel = $('feelSelect').value, age = $('ageGroup').value, role = $('roleSelect').value;
    const map = {
        'أشعر بالتشتت': 'ابدأ بجلسة تركيز 15 دقيقة + آية واحدة + مراجعة ورد واحد فقط.',
        'متأخر وأريد الاستدراك': 'ابدأ من اليوم؛ لا تنتظر الإجازة. خفّف مقدار الجديد وارفع جودة المراجعة.',
        'أحتاج تثبيت الحفظ': 'ارجع إلى 10 تكرارات غيبًا + التثبيت اليومي 7 أيام + كشكول المتشابهات.',
        'أريد أن أتعلم التجويد': 'ابدأ بالإظهار والإدغام والإخفاء والقلقلة والمد الطبيعي، ثم طبّق على وردك حرفًا حرفًا.',
        'أريد فقهًا أساسيًا': 'ابدأ بمالا يسع المسلم جهله وبفقه الطهارة والصلاة وحقوق الناس.',
        'أحتاج دافعًا': 'لا تحاول أن تحفظ صفحة كاملة في جلسة واحدة؛ آية ثابتة كل يوم خير من خطة مثالية متروكة.'
    };
    if($('recommendation')) $('recommendation').innerHTML = `<b>مناسب لك كـ${age} ${role}</b><p>${map[feel] || map['أحتاج دافعًا']}</p><div class="small">اقتراح بحث: ${feel} القرآن حفظ ${role}</div>`;
}

function shareImage() {
    const c = $('shareCanvas'); if(!c) return; const ctx = c.getContext('2d');
    c.width = 1200; c.height = 760;
    const g = ctx.createLinearGradient(0, 0, 1200, 760); g.addColorStop(0, '#07100b'); g.addColorStop(1, '#193025');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1200, 760);
    ctx.fillStyle = '#d4af37'; ctx.textAlign = 'center'; ctx.font = '700 58px Tajawal'; ctx.fillText('فضل الله عليّ', 600, 120);
    ctx.fillStyle = '#fff'; ctx.font = '700 46px Tajawal'; ctx.fillText(state.name || 'رفيق القرآن', 600, 210);
    ctx.fillText(`🔥 ${state.streak} يوم التزام`, 600, 320);
    ctx.fillText(`📖 ${fmt(state.entries.reduce((n, e) => n + (e.baseLetters || 0) * (e.totalReps || 0), 0))} حرف مقروء`, 600, 400);
    ctx.fillStyle = '#9aa99c'; ctx.font = '30px Tajawal'; ctx.fillText('رحلة مستمرة مع كتاب الله', 600, 520);
    ctx.fillStyle = '#d4af37'; ctx.font = '700 28px Tajawal'; ctx.fillText('رفيق القرآن', 600, 660);
    openModal('shareModal');
}

function downloadShare() {
    const c = $('shareCanvas'); if(!c) return;
    const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = `Rafiq_${dayKey()}.png`; a.click();
}

async function nativeShare() {
    if (!navigator.share) return downloadShare();
    try {
        const b = await new Promise(r => $('shareCanvas').toBlob(r, 'image/png'));
        await navigator.share({ title: 'رفيق القرآن', text: 'فضل الله عليّ 🤲', files: [new File([b], `Rafiq_${dayKey()}.png`, { type: 'image/png' })] })
    } catch { }
}

function printReport() { window.print(); }
function exportJSON() { const a = document.createElement('a'); a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state)); a.download = `Rafiq_Backup_${dayKey()}.json`; a.click(); toast('تم أخذ النسخة الاحتياطية ✅'); }
function importJSON(file) { const r = new FileReader(); r.onload = e => { try { state = stateManager.deepMerge(state, JSON.parse(e.target.result)); save(); location.reload() } catch { toast('ملف غير صالح') } }; r.readAsText(file); }
function resetApp() { if (prompt('اكتب مسح للتأكيد:') !== 'مسح') return; localStorage.clear(); location.reload(); }
async function locate() { if (!navigator.geolocation) return toast('الموقع غير مدعوم'); navigator.geolocation.getCurrentPosition(p => { state.lat = p.coords.latitude; state.lon = p.coords.longitude; save(); refreshPrayer(); }, () => toast('تعذر الحصول على موقعك')); }

// خلفية المحيط
function createOceanBubbles() {
    const box = $('oceanBubbles'); if (!box) return;
    if (document.body.dataset.perf === 'lite' || state.graphics === 1) { box.innerHTML = ''; return; }
    box.innerHTML = ''; const count = state.graphics >= 3 ? (window.innerWidth > 1100 ? 14 : 9) : (state.graphics === 2 ? 7 : 0);
    for (let i = 0; i < count; i++) {
        const b = document.createElement('span'); b.className = 'bubble';
        const size = (3 + Math.random() * 10).toFixed(1) + 'px'; b.style.setProperty('--size', size); b.style.left = (Math.random() * 100).toFixed(2) + '%';
        b.style.setProperty('--dur', (9 + Math.random() * 13).toFixed(2) + 's'); b.style.setProperty('--delay', (-Math.random() * 12).toFixed(2) + 's');
        b.style.setProperty('--drift', (Math.random() * 90 - 45).toFixed(1) + 'px'); box.appendChild(b);
    }
}
function createGlobalOceanBubbles() {
    const box = $('globalOceanBubbles'); if (!box) return;
    if (document.body.dataset.perf === 'lite' || state.graphics === 1) { box.innerHTML = ''; return; }
    box.innerHTML = ''; const count = state.graphics >= 3 ? (innerWidth > 1200 ? 16 : 10) : (innerWidth > 900 ? 9 : 6);
    for (let i = 0; i < count; i++) {
        const b = document.createElement('span'); b.style.left = (Math.random() * 100).toFixed(2) + '%';
        b.style.setProperty('--size', (3 + Math.random() * 9).toFixed(1) + 'px'); b.style.setProperty('--dur', (9 + Math.random() * 12).toFixed(1) + 's');
        b.style.setProperty('--delay', (-Math.random() * 10).toFixed(1) + 's'); b.style.setProperty('--dx', (Math.random() * 90 - 45).toFixed(1) + 'px');
        box.appendChild(b);
    }
}
function initGlobalOcean() {
    createGlobalOceanBubbles(); const btn = $('globalOceanSoundBtn');
    if (btn) btn.onclick = () => oceanSound ? stopOceanSound() : startOceanSound();
}

function startOceanSound() {
    if (oceanSound) return; const A = window.AudioContext || window.webkitAudioContext; if (!A) { toast('الصوت غير مدعوم في هذا المتصفح'); return; }
    oceanSound = new A(); if (oceanSound.state === 'suspended') oceanSound.resume();
    const sr = oceanSound.sampleRate; const buffer = oceanSound.createBuffer(1, sr * 3, sr); const d = buffer.getChannelData(0);
    let brown = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; brown = brown * .985 + w * .15; d[i] = brown * .30 + w * .035; }
    oceanSoundSource = oceanSound.createBufferSource(); oceanSoundSource.buffer = buffer; oceanSoundSource.loop = true;
    const low = oceanSound.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = 900;
    const band = oceanSound.createBiquadFilter(); band.type = 'bandpass'; band.frequency.value = 650; band.Q.value = .55;
    oceanSoundGain = oceanSound.createGain(); oceanSoundGain.gain.value = .0001;
    oceanSoundSource.connect(low).connect(band).connect(oceanSoundGain).connect(oceanSound.destination);
    const lfo = oceanSound.createOscillator(), lg = oceanSound.createGain(); lfo.frequency.value = .085; lg.gain.value = .018; lfo.connect(lg).connect(oceanSoundGain.gain);
    lfo.start(); oceanSoundSource.start(); oceanSound.__rafiqLfo = lfo;
    if($('oceanStatusText')) $('oceanStatusText').textContent = 'صوت البحر يعمل — استمتع بالهدوء';
    const btn = $('oceanSoundBtn'); if (btn) { btn.textContent = '🌊 صوت البحر يعمل'; btn.classList.add('ambient-playing'); }
}

function stopOceanSound() {
    if (!oceanSound) return; try { oceanSound.__rafiqLfo?.stop(); oceanSoundSource?.stop(); oceanSound.close(); } catch { }
    oceanSound = null; oceanSoundGain = null; oceanSoundSource = null;
    if($('oceanStatusText')) $('oceanStatusText').textContent = 'المشهد حي — الصوت اختياري';
    const btn = $('oceanSoundBtn'); if (btn) { btn.textContent = '🌊 تشغيل صوت البحر'; btn.classList.remove('ambient-playing'); }
}

function openSpace(key) {
    if($('spaceTitle')){
        $('spaceTitle').textContent = key; // يمكنك ربطها بموسوعتك الخاصة بـ ARCHIVE_META
        $('spaceIntro').textContent = "تفاصيل هذه المساحة ستظهر هنا...";
    }
    const ocean = $('ocean'); if (!ocean) return;
    const tr = $('sceneTransition'); tr?.classList.remove('play'); void tr?.offsetWidth; tr?.classList.add('play');
    ocean.classList.remove('ocean-dive'); void ocean.offsetWidth; ocean.classList.add('ocean-dive');
    setTimeout(() => { ocean.style.display = 'none'; $('spaceView').classList.add('show'); $('spaceView').scrollIntoView({ block: 'start', behavior: 'auto' }) }, 360);
}

// ==========================================
// 8. إعداد الأحداث (Event Listeners) والتهيئة (Initialization)
// ==========================================

function setupEvents() {
    const bind = (id, event, fn) => { const el = $(id); if (el) el[event] = fn; };
    
    document.querySelectorAll('.nav-item').forEach(b => b.onclick = () => switchView(b.dataset.view));
    document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => closeModal(b.dataset.close));
    
    bind('welcomeStartBtn', 'onclick', () => { profileSave($('welcomeName').value, $('welcomeAge').value); applyGraphics(); closeModal('welcomeModal'); showDailySplash(true); });
    bind('addNewBtn', 'onclick', () => openModal('addNewModal'));
    bind('addOldBtn', 'onclick', () => openModal('addOldModal'));
    bind('saveNewBtn', 'onclick', addNew);
    bind('saveOldBtn', 'onclick', addOld);
    bind('reverseBtn', 'onclick', () => openModal('reverseModal'));
    bind('calcReverseBtn', 'onclick', calculateReverse);
    bind('savePlanBtn', 'onclick', savePlan);
    
    bind('startTodayBtn', 'onclick', () => { const e = state.entries.find(x => (x.nextReviewDate <= dayKey() && x.hasBeenEvaluated) || !x.hasBeenEvaluated); if (e) openFocus(e.label); else openModal('addNewModal') });
    document.querySelector('#focusModal .focus-actions')?.querySelectorAll('[data-min]').forEach(b => b.onclick = () => { timeLeft = +b.dataset.min * 60; renderTimer(); });
    bind('customMinBtn', 'onclick', () => { const m = +$('customMin').value; if (m > 0) { timeLeft = m * 60; renderTimer(); } });
    bind('startFocusBtn', 'onclick', startFocus);
    bind('stopFocusBtn', 'onclick', () => closeModal('focusModal'));
    bind('rainBtn', 'onclick', () => noiseStart('rain'));
    bind('brownBtn', 'onclick', () => noiseStart('brown'));
    bind('splashClose', 'onclick', () => closeSplash(true));
    bind('splashPlay', 'onclick', async () => { const a = $('splashAudio'); if (!a) return; try { await a.play() } catch { toast('اضغط تشغيل مرة أخرى أو اسمح بالصوت في المتصفح') } });
    bind('themeSelect', 'onchange', e => { state.theme = e.target.value; save(); applyGraphics(); });
    bind('graphicsSelect', 'onchange', e => { state.graphics = Math.max(1, Math.min(3, +e.target.value || 1)); save(); applyGraphics(); renderAll(); toast(`الجرافيك: المستوى ${state.graphics} ✅`); });
    bind('saveProfileBtn', 'onclick', () => { profileSave($('profileName')?.value || '', $('profileAge')?.value || ''); toast('تم حفظ الملف ✅'); renderAll(); });
    bind('reciterSelect', 'onchange', e => { state.reciter = e.target.value; save(); });
    bind('volumeRange', 'oninput', e => { state.volume = +e.target.value; save(); });
    bind('ambientQuranBtn', 'onclick', () => state.ambient ? stopAmbient() : playAmbient());
    bind('testSoundBtn', 'onclick', () => beep('shine'));
    bind('notifyToggle', 'onchange', e => { state.notify = e.target.checked; save(); });
    bind('saveNotifyBtn', 'onclick', () => { state.notifyHour = Math.max(0, Math.min(23, +$('notifyHour')?.value || 20)); save(); requestNotifications(); });
    bind('locBtn', 'onclick', locate);
    bind('calcMethod', 'onchange', e => { state.calcMethod = +e.target.value; save(); refreshPrayer(); });
    bind('asrMethod', 'onchange', e => { state.asrMethod = +e.target.value; save(); refreshPrayer(); });
    bind('cityInput', 'onchange', e => { state.city = e.target.value.trim() || 'أسيوط'; state.lat = null; state.lon = null; save(); refreshPrayer(); });
    bind('backupBtn', 'onclick', exportJSON);
    bind('restoreInput', 'onchange', e => e.target.files[0] && importJSON(e.target.files[0]));
    bind('resetBtn', 'onclick', resetApp);
    bind('shareBtn', 'onclick', shareImage);
    bind('downloadShareBtn', 'onclick', downloadShare);
    bind('nativeShareBtn', 'onclick', nativeShare);
    bind('printBtn', 'onclick', printReport);
    bind('prevMonth', 'onclick', () => { chartMonth.setMonth(chartMonth.getMonth() - 1); renderProgress(); });
    bind('nextMonth', 'onclick', () => { chartMonth.setMonth(chartMonth.getMonth() + 1); renderProgress(); });
    bind('recommendBtn', 'onclick', recommend);
    bind('saveMistakeBtn', 'onclick', saveMistake);
    
    document.addEventListener('click', e => { const c = e.target.closest('.floating-card'); if (!c) return; e.preventDefault(); e.stopPropagation(); openSpace(c.dataset.space); }, { passive: false });
    
    bind('backToOcean', 'onclick', ev => {
        ev?.preventDefault(); ev?.stopPropagation();
        const tr = $('sceneTransition'); tr?.classList.remove('play'); void tr?.offsetWidth; tr?.classList.add('play');
        document.body.classList.remove('space-world'); document.body.classList.add('ocean-world');
        $('spaceView')?.classList.remove('show');
        const o = $('ocean'); if (o) { o.style.display = 'block'; o.classList.remove('ocean-dive'); void o.offsetWidth; }
        window.scrollTo({ top: 0, behavior: 'auto' });
    });
    
    bind('recordBtn', 'onclick', toggleRecorder);
    document.querySelectorAll('.modal,.splash').forEach(m => m.addEventListener('click', e => { if (e.target === m && m !== $('dailySplash')) m.classList.remove('show'); }));
}

function renderAll() {
    renderHome();
    const active = document.querySelector('.view.active')?.id;
    if (active === 'planning') renderPlanning();
    if (active === 'spiritual') renderSpiritual();
    if (active === 'progress') renderProgress();
    if (active === 'settings') renderSettings();
}

function profileSave(name, age) {
    state.name = String(name || '').trim(); state.age = age || ''; save();
}

function init() {
    setTimeGlow();
    applyGraphics();
    initGlobalOcean();
    setupEvents();
    renderAll();
    
    if (!state.name) openModal('welcomeModal'); else setTimeout(() => showDailySplash(false), 450);
    
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js?v=65', { updateViaCache: 'none' }).catch(() => { });
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; renderSettings(); });
    
    let resizeRaf = 0, lastLayoutBucket = Math.floor(window.innerWidth / 120);
    window.addEventListener('resize', () => {
        if (resizeRaf) return;
        resizeRaf = requestAnimationFrame(() => {
            resizeRaf = 0;
            const bucket = Math.floor(window.innerWidth / 120);
            if (bucket !== lastLayoutBucket) {
                lastLayoutBucket = bucket; applyGraphics();
                if ($('spiritual')?.classList.contains('active')) createOceanBubbles();
                createGlobalOceanBubbles();
            }
            if ($('progress')?.classList.contains('active')) drawChart();
        });
    }, { passive: true });

    window.addEventListener('orientationchange', () => { setTimeout(() => { applyGraphics(); createGlobalOceanBubbles(); }, 180) }, { passive: true });
    window.addEventListener('online', () => { document.body.dataset.net = 'online'; toast('عاد الاتصال بالإنترنت ✅'); });
    window.addEventListener('offline', () => { document.body.dataset.net = 'offline'; toast('أنت أوفلاين — البيانات المحلية متاحة ✅'); });
    
    setInterval(() => {
        setTimeGlow();
        const g = $('greeting'); if (g && state.name) g.textContent = greeting();
    }, 60000);
}

// ==========================================
// 9. تصدير الدوال للـ HTML (Inline Handlers)
// ==========================================

window.startOceanSound = startOceanSound;
window.stopOceanSound = stopOceanSound;
window.reviewEntry = reviewEntry;
window.deleteEntry = deleteEntry;
window.addRep = addRep;
window.openRecorder = openRecorder;
window.deleteMistake = deleteMistake;
window.switchView = switchView;

// بدء تشغيل التطبيق
document.addEventListener('DOMContentLoaded', init);

// تفعيل تأثير المحيط في جميع الشاشات
(function () {
    function seedPageBubbles() {
        document.querySelectorAll('.page-bubbles').forEach((box) => {
            if (box.children.length) return;
            const frag = document.createDocumentFragment();
            for (let i = 0; i < 10; i++) {
                const b = document.createElement('span');
                b.className = 'bubble';
                b.style.left = (Math.random() * 100) + '%';
                b.style.setProperty('--size', (4 + Math.random() * 13) + 'px');
                b.style.setProperty('--dur', (12 + Math.random() * 14) + 's');
                b.style.setProperty('--delay', (-Math.random() * 18) + 's');
                frag.appendChild(b);
            }
            box.appendChild(frag);
        });
    }
    function syncDepth() {
        const views = ['home', 'planning', 'mushaf', 'study', 'progress', 'explore', 'settings'];
        views.forEach((id, i) => document.getElementById(id)?.style.setProperty('--zad-depth-index', i));
    }
    document.addEventListener('DOMContentLoaded', () => { seedPageBubbles(); syncDepth(); });
})();