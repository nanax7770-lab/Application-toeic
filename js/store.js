// Sauvegarde de la progression dans le navigateur (localStorage).
// Rien n'est envoyé sur internet.
import { dayKey } from './util.js';

const KEY = 'toeic990';

export const DEFAULTS = {
  theme: 'auto',      // auto | light | dark
  voice: 'US',        // US | UK | AU
  autoplay: true,     // lire le mot automatiquement
  translate: true,    // afficher la traduction des exemples
  goal: 30,           // cartes à réviser par jour
  newPerDay: 15,      // nouveaux mots par jour
  sessionSize: 20,    // cartes par session
  minutesGoal: 10     // minutes par jour
};

const blank = () => ({ v: 1, settings: { ...DEFAULTS }, cards: {}, days: {}, custom: [], created: Date.now() });

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.v === 1) return { ...blank(), ...s, settings: { ...DEFAULTS, ...s.settings } };
  } catch (e) { /* stockage indisponible */ }
  return blank();
}

export const state = load();
export const S = state.settings;

let timer, locked = false; // locked : on ne sauvegarde plus (avant un rechargement)
export function save() { clearTimeout(timer); timer = setTimeout(saveNow, 200); }
export function saveNow() {
  clearTimeout(timer);
  if (locked) return;
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { console.warn('Sauvegarde impossible', e); }
}
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNow(); });
addEventListener('pagehide', saveNow);

// Statistiques du jour : r = cartes révisées, n = nouveaux mots, ms = temps passé
export function today() {
  const k = dayKey();
  return (state.days[k] ||= { r: 0, n: 0, ms: 0 });
}
export const dayStats = k => state.days[k] || { r: 0, n: 0, ms: 0 };

export function exportData() {
  return JSON.stringify({ app: 'TOEIC 990', exported: new Date().toISOString(), ...state });
}

export function importData(text) {
  const d = JSON.parse(text);
  if (!d || d.v !== 1 || typeof d.cards !== 'object') throw new Error('Fichier non reconnu');
  const clean = {
    v: 1,
    settings: { ...DEFAULTS, ...(d.settings || {}) },
    cards: d.cards || {},
    days: d.days || {},
    custom: Array.isArray(d.custom) ? d.custom : [],
    created: d.created || Date.now()
  };
  locked = true;
  localStorage.setItem(KEY, JSON.stringify(clean));
}

export function resetAll() {
  clearTimeout(timer);
  locked = true;
  localStorage.removeItem(KEY);
}
