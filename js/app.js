// Point de départ de l'application.
import { $, toast } from './util.js';
import { S, save } from './store.js';
import { loadData } from './data.js';
import { speak } from './tts.js';
import { actions, applyTheme, pop, showTab, openSheet, closeSheet, sheetOpen, current, refresh, seg, toggleRow, initScrollBars, initSheetDrag } from './ui.js';
import { initFlashcards, answer, flashKey, refreshCardVoice, refreshTranslate } from './flashcards.js';
import { initScreens, initImport } from './screens.js';

applyTheme();

// Un seul écouteur de clics pour toute l'application
function onClick(e) {
  const t = e.target;
  let el;
  if ((el = t.closest('[data-speak]'))) return speak(el.dataset.speak, el.dataset.acc || S.voice, el);
  if ((el = t.closest('.seg button'))) {
    const s = el.parentElement, btns = [...s.querySelectorAll('button')];
    s.style.setProperty('--i', btns.indexOf(el));
    btns.forEach(b => b.classList.toggle('on', b === el));
    return onSeg(s.dataset.seg, el.dataset.v);
  }
  if ((el = t.closest('[data-step]'))) return actions.step(el);
  if (t.closest('[data-close]')) return closeSheet();
  if (t.closest('[data-pop]')) return pop();
  if ((el = t.closest('[data-tab]'))) return showTab(el.dataset.tab);
  if ((el = t.closest('[data-toast]'))) return toast(el.dataset.toast);
  if ((el = t.closest('[data-ans]'))) return answer(el.dataset.ans);
  if ((el = t.closest('[data-action]'))) return actions[el.dataset.action]?.(el);
}

function onSeg(name, v) {
  S[name] = v;
  save();
  if (name === 'theme') applyTheme();
  if (name === 'voice') { refreshCardVoice(v); speak('Welcome to your TOEIC practice session.', v); }
}

function onChange(e) {
  const name = e.target.dataset.switch;
  if (!name) return;
  S[name] = e.target.checked;
  save();
  if (name === 'translate') refreshTranslate();
}

// Options pendant une session
actions['fc-options'] = () => openSheet({
    title: 'Options',
    body: `<p class="list-header">Voix</p>
      <div class="card" style="padding:12px">${seg('voice', [['US', 'US'], ['UK', 'UK'], ['AU', 'AU']], S.voice)}</div>
      <p class="list-header">Lecture</p>
      <div class="list">${toggleRow('autoplay', 'Lire le mot automatiquement', S.autoplay)}${toggleRow('translate', 'Traduire les exemples', S.translate)}</div>
      <p class="list-footer">Sur ordinateur : Espace retourne la carte, ← « Je ne savais pas », ↑ « Difficile », → « Je savais ».</p>`
});

function onKey(e) {
  if (sheetOpen()) { if (e.key === 'Escape') closeSheet(); return; }
  if (e.target.closest?.('input, textarea')) return;
  if (current() === 'flash') return flashKey(e);
  if (e.key === 'Escape') pop();
}

async function boot() {
  const app = $('#app');
  app.addEventListener('click', onClick);
  app.addEventListener('change', onChange);
  document.addEventListener('keydown', onKey);
  initScrollBars();
  initSheetDrag();
  initFlashcards();
  initScreens();
  initImport();
  try {
    await loadData();
  } catch (err) {
    console.error(err);
    $('#boot').textContent = 'Impossible de charger le vocabulaire. Rechargez la page.';
    return;
  }
  refresh();
  const boot = $('#boot');
  boot.style.opacity = '0';
  setTimeout(() => boot.remove(), 300);
}
boot();

// Mode hors ligne : le « service worker » garde une copie de l'application
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(err => console.warn('Hors ligne indisponible', err)));
}

