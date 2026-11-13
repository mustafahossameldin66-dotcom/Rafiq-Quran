(() => {
  'use strict';

  /* ═══════════════════════════════════════════════════════════════
     1. خيط التلاوة والمسار القرآني (Reading Timeline & Waypoints)
     ═══════════════════════════════════════════════════════════════ */
  function renderReadingTimeline() {
    const card = document.getElementById('resumeCard');
    if (!card) return;

    const state = window.RAFIQ_API?.state || {};
    const quran = window.RAFIQ_QURAN || [];

    // 1. Last Read
    const lastSurahId = state.last?.s || 1;
    const lastAyahNum = state.last?.a || 1;
    const surahObj = quran.find(s => s.id === lastSurahId || s.s === lastSurahId) || { name: 'الفاتحة' };
    const lastReadLabel = `سورة ${surahObj.name} · الآية ${lastAyahNum}`;

    // 2. Memorization Status
    const memTotal = Array.isArray(state.hifz) ? state.hifz.length : 0;
    const memPlanGoal = state.plan?.goal ? `هدف: ${state.plan.goal} ${state.plan.unit || 'آيات'}` : `المحفوظ: ${memTotal} سورة`;

    // 3. Audio Recitation
    const audioSurahId = state.audio?.surah || lastSurahId;
    const audioSurahObj = quran.find(s => s.id === audioSurahId || s.s === audioSurahId) || surahObj;
    const reciterList = window.RAFIQ_RECITERS || [];
    const reciterObj = reciterList.find(r => r.folder === state.audio?.reciter);
    const reciterName = reciterObj ? reciterObj.name : 'القارئ المفضل';
    const audioLabel = `سورة ${audioSurahObj.name} (${reciterName})`;

    // Maintain native elements
    const posElem = document.getElementById('resumePosition');
    const metaElem = document.getElementById('resumePositionMeta');
    if (posElem) posElem.textContent = lastReadLabel;
    if (metaElem) metaElem.textContent = 'الموضع المحفوظ على هذا الجهاز · استئناف مباشر';

    // Render Timeline Flow
    let flow = card.querySelector('.reading-timeline-flow');
    if (!flow) {
      flow = document.createElement('div');
      flow.className = 'reading-timeline-flow';
      card.appendChild(flow);
    }

    flow.innerHTML = `
      <div class="timeline-header">
        <span class="timeline-kicker">✦ خيط التلاوة والمسار القرآني</span>
        <span class="timeline-badge">مسارك الحي</span>
      </div>
      <div class="timeline-track">
        <button type="button" class="timeline-node active" id="tlNodeQuran" title="متابعة القراءة في المصحف">
          <span class="node-halo"></span>
          <span class="node-icon"><svg class="rq-ico" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M8 7h8"/><path d="M8 11h8"/></svg></span>
          <div class="node-copy">
            <small>آخر قراءة</small>
            <b>${lastReadLabel}</b>
          </div>
        </button>
        <span class="timeline-line"></span>
        <button type="button" class="timeline-node" id="tlNodePlan" title="فتح خطة الحفظ والمراجعة">
          <span class="node-halo"></span>
          <span class="node-icon"><svg class="rq-ico" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/></svg></span>
          <div class="node-copy">
            <small>ورد الحفظ</small>
            <b>${memPlanGoal}</b>
          </div>
        </button>
        <span class="timeline-line"></span>
        <button type="button" class="timeline-node" id="tlNodeRecite" title="الاستماع للتلاوة">
          <span class="node-halo"></span>
          <span class="node-icon"><svg class="rq-ico" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg></span>
          <div class="node-copy">
            <small>مجلس التلاوة</small>
            <b>${audioLabel}</b>
          </div>
        </button>
      </div>
    `;

    // Wire actions
    flow.querySelector('#tlNodeQuran')?.addEventListener('click', () => {
      document.getElementById('resumeBtn')?.click();
    });
    flow.querySelector('#tlNodePlan')?.addEventListener('click', () => {
      window.go?.('plan');
    });
    flow.querySelector('#tlNodeRecite')?.addEventListener('click', () => {
      window.go?.('recitations');
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     2. جلسة آية واحدة (One-Ayah Contemplation Session with Controls)
     ═══════════════════════════════════════════════════════════════ */
  const ONE_AYAH_SEEDS = [
    {
      s: 2, a: 255, surah: 'البقرة',
      text: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ',
      tafsir: 'أعظم آية في كتاب الله؛ تقرر تفرد الله بالكمال والألوهية وقيوميته التامة على خلقه ورعايتهم دون فتور أو غفلة.',
      action: 'استحضر قيومية الله عليك اليوم في كل شأنك، وسلّم أمورك لمن لا يغفل ولا ينام.'
    },
    {
      s: 2, a: 186, surah: 'البقرة',
      text: 'وَإِذَا سَأَلَكَ عِبَادِي عَنِّي فَإِنِّي قَرِيبٌ ۖ أُجِيبُ دَعْوَةَ الدَّاعِ إِذَا دَعَانِ',
      tafsir: 'قرب إلهي خاص بإجابة الدعاء وتفريج الكروب، بدون واسطة أو حجاب.',
      action: 'خصّص دقيقة في خلوة وارفع حاجتك مباشرة لمن هو أقرب إليك من حبل الوريد.'
    },
    {
      s: 13, a: 28, surah: 'الرعد',
      text: 'الَّذِينَ آمَنُوا وَتَطْمَئِنُّ قُلُوبُهُم بِذِكْرِ اللَّهِ ۗ أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ',
      tafsir: 'سكون النفس وذهاب القلق والوحشة لا يتحقق إلا بذكر الله والاطمئنان إلى كفايته ورحمته.',
      action: 'إذا شعرت بشتات أو ضيق خلال يومك، ردّد الذكر بحضور قلب حتى تسكن نفسك.'
    },
    {
      s: 65, a: 2, surah: 'الطلاق',
      text: 'وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا وَيَرْزُقْهُ مِنْ حَيْثُ لَا يَحْتَسِبُ',
      tafsir: 'وعد إلهي قاطع لمن اتقى الله، أن تنفرج له المضائق ويأتيه الرزق من أبواب لا تخطر له على بال.',
      action: 'قدّم رضا الله في أصغر قرار يواجهك اليوم، واستبشر بالفرج الموعود.'
    },
    {
      s: 94, a: 6, surah: 'الشرح',
      text: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا',
      tafsir: 'اليسر مصاحب للعسر وملازم له؛ وفي طيّات الشدة يكمن الفرج القريب.',
      action: 'تذكر أن أي كرب أو ضيق تمر به الآن يحمل في باطنه فرجاً عظيماً؛ فاستبشر خيراً.'
    },
    {
      s: 20, a: 114, surah: 'طه',
      text: 'وَقُل رَّبِّ زِدْنِي عِلْمًا',
      tafsir: 'لم يأمر الله نبيه ﷺ بطلب الزيادة في شيء إلا في العلم النافع؛ لأنه سبب الرفعة والهدى.',
      action: 'احرص اليوم على فهم معنى آية أو تدبر كلمة جديدة من كتاب الله والعمل بها.'
    }
  ];

  let currentAyahIndex = 0;
  let activeTab = 'listen';

  function renderOneAyahSession() {
    const card = document.getElementById('oneAyahCard');
    if (!card) return;

    const item = ONE_AYAH_SEEDS[currentAyahIndex];
    const audio = document.getElementById('quranAudio');
    const isPlayingThis = audio && !audio.paused && window.isAudioPlaying;

    card.innerHTML = `
      <div class="one-ayah-header">
        <div class="one-ayah-badge">
          <span class="badge-dot"></span>
          <span>✦ جلسة آية واحدة · ٣ دقائق</span>
        </div>
        <button type="button" class="btn text-btn one-ayah-cycle" id="oneAyahNextBtn" title="عرض آية أخرى">
          <span>آية أخرى</span> <svg class="rq-ico" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        </button>
      </div>

      <div class="one-ayah-content">
        <div class="one-ayah-meta">سورة ${item.surah} · الآية ${item.a}</div>
        <div class="one-ayah-frame">
          <div class="one-ayah-text">﴿ ${item.text} ﴾</div>
        </div>

        <div class="one-ayah-tabs" role="tablist">
          <button type="button" class="one-ayah-tab ${activeTab === 'listen' ? 'active' : ''}" data-step="listen">
            <svg class="rq-ico" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg> استماع
          </button>
          <button type="button" class="one-ayah-tab ${activeTab === 'tafsir' ? 'active' : ''}" data-step="tafsir">
            <svg class="rq-ico" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M8 7h8"/><path d="M8 11h8"/></svg> البيان
          </button>
          <button type="button" class="one-ayah-tab ${activeTab === 'tadabbur' ? 'active' : ''}" data-step="tadabbur">
            <svg class="rq-ico" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg> تدبر
          </button>
          <button type="button" class="one-ayah-tab ${activeTab === 'repeat' ? 'active' : ''}" data-step="repeat">
            <svg class="rq-ico" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> تثبيت
          </button>
        </div>

        <div class="one-ayah-panel">
          ${activeTab === 'listen' ? `
            <div class="step-box">
              <p class="step-tip">استمع بإنصات وخشوع لمخارج الحروف ونغمات الآية:</p>
              <div class="audio-control-actions">
                <button type="button" class="btn primary step-action-btn" id="oneAyahPlayBtn">
                  <span>${isPlayingThis ? '<svg class="rq-ico" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>' : '<svg class="rq-ico" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" stroke="none"><polygon points="6 4 20 12 6 20 6 4"/></svg>'}</span>
                  <span>${isPlayingThis ? 'إيقاف مؤقت للتلاوة' : 'تشغيل التلاوة الخاشعة'}</span>
                </button>
                ${isPlayingThis ? `
                  <button type="button" class="btn step-action-btn" id="oneAyahStopBtn" title="إيقاف كامل">
                    <span><svg class="rq-ico" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" stroke="none"><rect x="5" y="5" width="14" height="14" rx="2"/></svg></span> إنهاء
                  </button>
                ` : ''}
              </div>
            </div>
          ` : ''}

          ${activeTab === 'tafsir' ? `
            <div class="step-box">
              <span class="step-kicker">المعنى الميسر من المصادر المعتمدة:</span>
              <p class="step-desc">${item.tafsir}</p>
            </div>
          ` : ''}

          ${activeTab === 'tadabbur' ? `
            <div class="step-box">
              <span class="step-kicker">خطوة عمل وتطبيق روحي لليوم:</span>
              <p class="step-desc">${item.action}</p>
            </div>
          ` : ''}

          ${activeTab === 'repeat' ? `
            <div class="step-box">
              <p class="step-tip">تكرار الآية ٣ مرات متتالية مع القارئ لترسيخها في القلب:</p>
              <div class="repeat-controls">
                <button type="button" class="btn primary step-action-btn" id="oneAyahRepeatBtn">
                  <span><svg class="rq-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg></span> ابدأ تكرار ٣ مرات
                </button>
                <button type="button" class="btn step-action-btn" id="oneAyahStopLoopBtn" style="display:none">
                  <span><svg class="rq-ico" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2"/></svg></span> إيقاف
                </button>
                <span class="repeat-status-pill" id="oneAyahRepeatStatus"></span>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    // Tab buttons
    card.querySelectorAll('.one-ayah-tab').forEach(b => {
      b.addEventListener('click', () => {
        activeTab = b.dataset.step;
        renderOneAyahSession();
      });
    });

    // Next Ayah
    card.querySelector('#oneAyahNextBtn')?.addEventListener('click', () => {
      currentAyahIndex = (currentAyahIndex + 1) % ONE_AYAH_SEEDS.length;
      renderOneAyahSession();
    });

    // Play/Pause button
    card.querySelector('#oneAyahPlayBtn')?.addEventListener('click', () => {
      const qAudio = document.getElementById('quranAudio');
      if (qAudio && !qAudio.paused && window.isAudioPlaying) {
        qAudio.pause();
        window.isAudioPlaying = false;
        renderOneAyahSession();
        window.toast?.('تم إيقاف التلاوة مؤقتًا ⏸️');
      } else {
        startAyahRecitation(item.s, item.a);
      }
    });

    // Stop button
    card.querySelector('#oneAyahStopBtn')?.addEventListener('click', () => {
      window.stopRecitation ? window.stopRecitation(true) : document.getElementById('quranAudio')?.pause();
      renderOneAyahSession();
      window.toast?.('تم إنهاء التلاوة ⏹️');
    });

    // Repeat 3 times loop
    card.querySelector('#oneAyahRepeatBtn')?.addEventListener('click', () => {
      const status = document.getElementById('oneAyahRepeatStatus');
      const stopBtn = document.getElementById('oneAyahStopLoopBtn');
      const audio = document.getElementById('quranAudio');
      if (!audio) return;

      if (stopBtn) stopBtn.style.display = 'inline-flex';

      let count = 1;
      if (status) status.textContent = 'تكرار ١ من ٣…';
      startAyahRecitation(item.s, item.a);

      const loopHandler = () => {
        if (count < 3) {
          count++;
          if (status) status.textContent = `تكرار ${count} من ٣…`;
          audio.currentTime = 0;
          audio.play().catch(() => {});
        } else {
          audio.removeEventListener('ended', loopHandler);
          if (status) status.textContent = '✓ تم التثبيت ٣ مرات بحمد الله';
          if (stopBtn) stopBtn.style.display = 'none';
          window.toast?.('تمت جلسة التثبيت بنجاح ✨');
        }
      };

      audio.addEventListener('ended', loopHandler);

      stopBtn?.addEventListener('click', () => {
        audio.removeEventListener('ended', loopHandler);
        window.stopRecitation ? window.stopRecitation(true) : audio.pause();
        if (status) status.textContent = 'تم إيقاف التكرار';
        if (stopBtn) stopBtn.style.display = 'none';
      });
    });
  }

  function startAyahRecitation(s, a) {
    const list = window.RAFIQ_RECITERS || [];
    const state = window.RAFIQ_API?.state || {};
    const pref = state.prefs?.reciter || state.audio?.reciter;
    const r = list.find(x => x.folder === pref) || list[0];
    if (!r) {
      window.toast?.('اختر قارئًا أولًا من التلاوات.');
      return;
    }

    if (window.playRecitation) {
      window.playRecitation(r, s, Math.max(0, a - 1));
      renderOneAyahSession();
    } else {
      const audio = document.getElementById('quranAudio');
      if (!audio) return;
      const pad = (n, len = 3) => String(n).padStart(len, '0');
      const url = r.source === 'mp3quran' ? `${r.server}${pad(s)}.mp3` : `https://everyayah.com/data/${r.folder}/${pad(s)}${pad(a)}.mp3`;
      audio.src = url;
      audio.currentTime = 0;
      audio.play().then(() => {
        window.isAudioPlaying = true;
        renderOneAyahSession();
        window.toast?.(`بدأت تلاوة الآية ${a} ✨`);
      }).catch(() => {
        window.toast?.('التلاوة تحتاج اتصالاً بالإنترنت.');
      });
    }
  }

  // Keep One-Ayah play button in sync with global audio events
  const globalAudio = document.getElementById('quranAudio');
  if (globalAudio) {
    globalAudio.addEventListener('play', () => renderOneAyahSession());
    globalAudio.addEventListener('pause', () => renderOneAyahSession());
    globalAudio.addEventListener('ended', () => renderOneAyahSession());
  }

  /* ═══════════════════════════════════════════════════════════════
     3. خريطة النور الأسبوعية (Weekly Light Map Constellation)
     ═══════════════════════════════════════════════════════════════ */
  function renderWeeklyLightMap() {
    const container = document.getElementById('homeWeekBars');
    if (!container) return;

    const weekScores = window.getWeekScores ? window.getWeekScores() : [];
    if (!weekScores || !weekScores.length) return;

    container.className = 'weekly-light-map-grid';
    container.innerHTML = weekScores.map((day, idx) => {
      const isToday = idx === 6; // last day is today
      const score = Math.round(day.score || 0);
      const intensity = score >= 6 ? 'high' : score >= 2 ? 'medium' : score > 0 ? 'low' : 'idle';

      return `
        <div class="light-station ${intensity} ${isToday ? 'is-today' : ''}" data-day="${day.name}" title="${day.name}: ${score} نقطة نشاط">
          <div class="station-rosette" aria-hidden="true">
            <span class="rosette-glow"></span>
            <span class="rosette-star">✦</span>
          </div>
          <span class="station-name">${day.name}</span>
          <span class="station-score">${score > 0 ? score : '—'}</span>
          ${isToday ? '<span class="station-today-badge">اليوم</span>' : ''}
        </div>
      `;
    }).join('');
  }

  /* ═══════════════════════════════════════════════════════════════
     4. تلاوة الظل والمتابعة مع القارئ (Shadow Recitation & Guided Flow)
     ═══════════════════════════════════════════════════════════════ */
  function initShadowRecitation() {
    const mushafToolbar = document.querySelector('.mushaf-toolbar');
    if (!mushafToolbar) return;

    if (document.getElementById('shadowReciteBtn')) return;

    const btn = document.createElement('button');
    btn.className = 'action shadow-recite-btn';
    btn.id = 'shadowReciteBtn';
    btn.type = 'button';
    btn.setAttribute('aria-pressed', 'false');
    btn.title = 'تلاوة الظل: استمع للقارئ وردد خلفه بتركيز مع تظليل الآيات غير النشطة';
    btn.innerHTML = '<span class="ayah-ico" data-ico="wave"></span> تلاوة الظل';

    mushafToolbar.appendChild(btn);

    // Banner explanation for Shadow Recitation
    let shadowBanner = document.getElementById('shadowReciteBanner');
    if (!shadowBanner) {
      shadowBanner = document.createElement('div');
      shadowBanner.id = 'shadowReciteBanner';
      shadowBanner.className = 'shadow-recite-banner card';
      shadowBanner.hidden = true;
      shadowBanner.innerHTML = `
        <div class="shadow-banner-content">
          <div class="shadow-banner-text">
            <b>☁️ مسار تلاوة الظل والمتابعة</b>
            <p>استمع للقارئ وردد خلفه بقلب حاضر؛ تتنحى الآيات بهدوء لتضيء فقط الآية الجاري تلاوتها، مع إمكانية تكرار المقطع الصعب ٣ مرات لتثبيته.</p>
          </div>
          <div class="shadow-banner-actions">
            <button type="button" class="btn text-btn" id="shadowPeekAllBtn">👁️ كشف جميع الآيات</button>
            <button type="button" class="btn text-btn" id="shadowCloseBannerBtn">✕ إغلاق التظليل</button>
          </div>
        </div>
      `;
      mushafToolbar.parentElement?.insertBefore(shadowBanner, mushafToolbar.nextElementSibling);

      shadowBanner.querySelector('#shadowPeekAllBtn')?.addEventListener('click', () => {
        const isRevealed = document.body.classList.toggle('shadow-peek-all');
        const b = shadowBanner.querySelector('#shadowPeekAllBtn');
        if (b) b.textContent = isRevealed ? '☁️ إعادة التظليل' : '👁️ كشف جميع الآيات';
      });

      shadowBanner.querySelector('#shadowCloseBannerBtn')?.addEventListener('click', () => {
        btn.click();
      });
    }

    btn.addEventListener('click', () => {
      const active = document.body.classList.toggle('shadow-recite-active');
      btn.setAttribute('aria-pressed', String(active));
      btn.classList.toggle('active', active);
      btn.innerHTML = active ? '<span>👁️</span> إلغاء الظل' : '<span>☁️</span> تلاوة الظل';
      if (shadowBanner) shadowBanner.hidden = !active;
      window.toast?.(active ? 'تم تفعيل تلاوة الظل: استمع للقارئ وردد خلفه ✨' : 'تم إلغاء تلاوة الظل');
    });

    // In-Ayah difficulty repeat button injection
    document.addEventListener('click', (e) => {
      if (!document.body.classList.contains('shadow-recite-active')) return;
      const ayah = e.target.closest('.mushaf-ayah');
      if (ayah && !e.target.closest('button')) {
        ayah.classList.toggle('shadow-revealed');
      }
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     5. تهيئة المكونات ومراقبة الأحداث
     ═══════════════════════════════════════════════════════════════ */
  function setup() {
    renderReadingTimeline();
    renderOneAyahSession();
    renderWeeklyLightMap();
    initShadowRecitation();

    document.addEventListener('rafiq-home-updated', () => {
      renderReadingTimeline();
      renderWeeklyLightMap();
    });

    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-view="quran"]') || e.target.closest('[data-go="quran"]')) {
        setTimeout(initShadowRecitation, 300);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();
