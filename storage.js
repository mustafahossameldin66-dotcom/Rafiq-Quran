const STORAGE_KEY = 'rafiq-supreme-v15';
let pendingSave = null;

export function deepMerge(base, incoming) {
  const out = structuredClone(base);
  for (const key of Object.keys(incoming || {})) {
    const value = incoming[key];
    if (value && typeof value === 'object' && !Array.isArray(value) && out[key] && typeof out[key] === 'object' && !Array.isArray(out[key])) {
      out[key] = deepMerge(out[key], value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function loadState(state, defaults) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const next = raw ? deepMerge(defaults, JSON.parse(raw)) : structuredClone(defaults);
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, next);
  } catch {
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, structuredClone(defaults));
  }
  return state;
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function scheduleSave(state, delay = 120) {
  clearTimeout(pendingSave);
  pendingSave = setTimeout(() => {
    pendingSave = null;
    try { saveState(state); } catch {}
  }, delay);
}

export function flushSave(state) {
  clearTimeout(pendingSave);
  pendingSave = null;
  try { saveState(state); } catch {}
}

export { STORAGE_KEY };
