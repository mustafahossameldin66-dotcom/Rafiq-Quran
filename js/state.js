const STORAGE = 'rafiq-supreme-v15';

const DEFAULT = {
  name: '', age: '', role: '', theme: 'dark', graphics: 1, locale: 'ar',
  reciter: 'Husary_128kbps', volume: 0.85, notify: false, notifyHour: 20,
  soundEnabled: true, calcMethod: 5, asrMethod: 0, city: 'أسيوط', lat: null,
  lon: null, goal: 604, goalUnit: 'صفحة', planMode: 'auto', dailyPlan: 2,
  planDays: 30, reviewRatio: 3, evalMode: 'weekly', restDays: [5], streak: 0,
  lastActive: '', firstDate: '', focusMin: 0, dailyReviewTarget: 3,
  dailyRepTarget: 10, dailyFocusTarget: 20, entries: [], dailyLog: {},
  mistakes: [], prayers: {}, dhikr: {}, selectedEntryId: null, planStart: '',
  lastPrayerDate: '', lastDailyBoundary: '', season: '', studyCache: {}, ambient: false
};

export class AppState {
  constructor() {
    this.data = this.load();
    this.checkFirstDate();
  }

  deepMerge(a, b) {
    const o = structuredClone(a);
    for (const k in b) {
      if (
        b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) &&
        typeof o[k] === 'object' && o[k] && !Array.isArray(o[k])
      ) {
        o[k] = this.deepMerge(o[k], b[k]);
      } else {
        o[k] = b[k];
      }
    }
    return o;
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE);
      return raw ? this.deepMerge(DEFAULT, JSON.parse(raw)) : structuredClone(DEFAULT);
    } catch {
      return structuredClone(DEFAULT);
    }
  }

  save() {
    localStorage.setItem(STORAGE, JSON.stringify(this.data));
  }

  checkFirstDate() {
    if (!this.data.firstDate && this.data.entries.length) {
      this.data.firstDate = this.data.entries.map(e => e.date).sort()[0] || this.getDayKey();
      this.save();
    }
  }

  getDayKey(d = new Date()) {
    const x = new Date(d);
    return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
}

export const stateManager = new AppState();
export const state = stateManager.data;
