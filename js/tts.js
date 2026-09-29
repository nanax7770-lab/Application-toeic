// Prononciation avec la synthèse vocale du navigateur (voix US, UK, AU).
import { S } from './store.js';
import { plain, toast } from './util.js';

const LANGS = { US: 'en-US', UK: 'en-GB', AU: 'en-AU' };
const supported = 'speechSynthesis' in window;
let voices = [];
const loadVoices = () => { voices = supported ? speechSynthesis.getVoices() : []; };
if (supported) {
  loadVoices();
  speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
}

// On préfère les voix de meilleure qualité quand elles existent.
function pickVoice(lang) {
  const l = lang.toLowerCase();
  const list = voices.filter(v => v.lang.replace('_', '-').toLowerCase() === l);
  return list.find(v => /premium|enhanced|natural|neural/i.test(v.name))
    || list.find(v => /samantha|daniel|karen|google/i.test(v.name))
    || list[0] || null;
}

const warned = {};
export function speak(text, acc = S.voice, btn) {
  if (!supported) { toast('La synthèse vocale n’est pas disponible sur ce navigateur'); return; }
  speechSynthesis.cancel();
  // « affect / effect » est lu « affect, effect » (sans prononcer la barre)
  const u = new SpeechSynthesisUtterance(plain(text).replace(/\s*\/\s*/g, ', '));
  u.lang = LANGS[acc] || 'en-US';
  const v = pickVoice(u.lang);
  if (v) u.voice = v;
  else if (voices.length && !warned[acc]) {
    warned[acc] = 1;
    toast(`Pas de voix ${acc} sur cet appareil : voix anglaise par défaut`);
  }
  u.rate = 0.92;
  if (btn) {
    btn.classList.add('speaking');
    u.onend = u.onerror = () => btn.classList.remove('speaking');
  }
  speechSynthesis.speak(u);
}

export function stopSpeaking() { if (supported) speechSynthesis.cancel(); }
