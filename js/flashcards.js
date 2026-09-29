// Session de flashcards : file de cartes, retournement, glissement, réponses.
import { $, $$, esc, md, plain, ic, buzz, endOfToday, plural, toast } from './util.js';
import { state, S, save, today } from './store.js';
import { cards, decks, deckById, CUSTOM_ID } from './data.js';
import { schedule, preview } from './srs.js';
import { speak, stopSpeaking } from './tts.js';
import { actions, enter, leave, push, pop, openSheet, closeSheet } from './ui.js';

/* ---------- Construire la liste des cartes à étudier ---------- */

// Cartes à revoir (déjà vues, dont la date est arrivée), les plus en retard d'abord
export function dueCards(deckId) {
  const end = endOfToday(), out = [];
  for (const c of cards.values()) {
    if (deckId && c.deck !== deckId) continue;
    const st = state.cards[c.id];
    if (st && st.s !== 'new' && st.due <= end) out.push(c);
  }
  return out.sort((a, b) => state.cards[a.id].due - state.cards[b.id].due);
}

// Nouvelles cartes, en alternant les paquets (vos cartes perso d'abord)
export function newCards(deckId) {
  const isNew = c => !state.cards[c.id] || state.cards[c.id].s === 'new';
  if (deckId) return deckById(deckId).cards.filter(isNew);
  const lists = [deckById(CUSTOM_ID), ...decks.filter(d => d.id !== CUSTOM_ID)]
    .filter(Boolean).map(d => d.cards.filter(isNew));
  const out = [];
  for (let i = 0; lists.some(l => i < l.length); i++) for (const l of lists) if (i < l.length) out.push(l[i]);
  return out;
}

export const newQuota = () => Math.max(0, S.newPerDay - today().n);

// Résumé pour l'accueil et les paquets
export function plan(deckId) {
  const due = dueCards(deckId).length;
  const fresh = Math.min(newCards(deckId).length, newQuota());
  return { due, fresh, total: Math.min(S.sessionSize, due + fresh) };
}

function buildQueue(deckId, extra) {
  const size = S.sessionSize;
  const due = dueCards(deckId).slice(0, size);
  const quota = extra ? size : newQuota();
  const fresh = newCards(deckId).slice(0, Math.min(quota, size - due.length));
  // On mélange un peu : les nouvelles cartes sont glissées entre les révisions
  const q = [...due];
  fresh.forEach((c, i) => q.splice(Math.min(q.length, (i + 1) * 3), 0, c));
  return q;
}

/* ---------- Session ---------- */
const sess = { queue: [], deckId: null, total: 0, done: new Set(), seen: new Set(), res: { good: 0, hard: 0, again: 0 }, cur: null, busy: false, shownAt: 0 };
let card, footer, ghost, drag = null;

// Démarre une session (depuis un bouton). Renvoie false s'il n'y a rien à réviser.
export function startSession(deckId = null, extra = false) {
  const q = buildQueue(deckId, extra);
  if (!q.length) {
    toast(extra ? 'Tous les mots de ce paquet ont déjà été vus' : 'Rien à réviser pour l’instant');
    return false;
  }
  Object.assign(sess, { queue: q, deckId, total: q.length, done: new Set(), seen: new Set(), res: { good: 0, hard: 0, again: 0 }, busy: false });
  // Sur iPhone, la voix doit démarrer pendant le toucher : on lit le premier mot tout de suite.
  if (S.autoplay) speak(q[0].word);
  push('flash', deckId);
  return true;
}

enter.flash = deckId => {
  $('#fc-title').textContent = deckId ? deckById(deckId).short : 'Session du jour';
  card.style.cssText = '';
  showCard();
};
leave.flash = () => stopSpeaking();

function showCard() {
  const c = sess.cur = sess.queue[0];
  const words = c.word.length;
  card.className = 'fc-card' + (S.translate ? '' : ' no-tr');
  const d = deckById(c.deck);
  const ex = (c.examples || []).filter(e => e && e.en);
  card.innerHTML = `
    <div class="fc-inner">
      <div class="fc-face fc-front">
        <div class="fc-meta"><span class="chip">${esc(d ? d.short : '')}</span><span class="pos">${esc(c.pos || '')}</span></div>
        <div class="fc-center">
          <p class="fc-word${words > 16 ? ' long' : ''}" lang="en">${esc(c.word)}</p>
          ${c.ipa ? `<p class="fc-ipa">${esc(c.ipa)}</p>` : ''}
          <div class="accents">${['US', 'UK', 'AU'].map(a => `<button class="acc${a === S.voice ? ' on' : ''}" data-speak="${esc(c.word)}" data-acc="${a}" aria-label="Écouter (accent ${a})">${ic('vol')}${a}</button>`).join('')}</div>
        </div>
        <p class="fc-tap">Touchez la carte pour la retourner</p>
      </div>
      <div class="fc-face fc-back">${backHTML(c, ex)}</div>
    </div>
    <div class="fc-feedback"><span class="fb-badge"></span></div>`;
  footer.classList.remove('revealed');
  ghost.style.opacity = sess.queue.length > 1 ? '' : '0';
  const st = state.cards[c.id];
  for (const g of ['again', 'hard', 'good']) $('#ivl-' + g).textContent = preview(st, g);
  $('#fc-count').textContent = `${Math.min(sess.done.size + 1, sess.total)} / ${sess.total}`;
  $('#fc-bar').style.width = `${sess.done.size / sess.total * 100}%`;
  sess.shownAt = Date.now();
}

export function backHTML(c, ex = (c.examples || []).filter(e => e && e.en), head = true) {
  return `
    ${head ? `<div class="fc-back-head"><span class="fc-word-sm" lang="en">${esc(c.word)}</span><button class="icon-btn" data-speak="${esc(c.word)}" aria-label="Écouter">${ic('vol')}</button></div>` : ''}
    <p class="fc-fr">${esc(c.fr)}</p>
    ${c.def ? `<p class="fc-def" lang="en">${esc(c.def)}</p>` : ''}
    ${ex.length ? `<p class="fc-label">Exemple${ex.length > 1 ? 's' : ''}</p>` : ''}
    ${ex.map(e => `<div class="fc-ex"><button class="ex-play" data-speak="${esc(plain(e.en))}" aria-label="Écouter l’exemple">${ic('vol')}</button><div><p lang="en">${md(e.en)}</p>${e.fr ? `<p class="tr">${esc(e.fr)}</p>` : ''}</div></div>`).join('')}
    ${c.note && c.note.text ? `<div class="fc-note ${c.note.type === 'warn' ? 'warn' : 'tip'}">${ic(c.note.type === 'warn' ? 'alert' : 'bulb')}<p>${md(c.note.text)}</p></div>` : ''}`;
}

export function flip() {
  if (sess.busy || !sess.cur) return;
  card.classList.toggle('flipped');
  footer.classList.add('revealed');
}

const FB = { good: ['check', 'Je savais'], again: ['x', 'À revoir'], hard: ['alert', 'Difficile'] };
function feedback(kind, o) {
  const fb = $('.fc-feedback', card);
  if (!fb) return;
  if (fb.dataset.kind !== (kind || '')) {
    fb.dataset.kind = kind || '';
    $('.fb-badge', fb).innerHTML = kind ? ic(FB[kind][0]) + FB[kind][1] : '';
  }
  fb.style.opacity = kind ? o : 0;
}

export function answer(kind) {
  if (sess.busy || !sess.cur) return;
  sess.busy = true;
  const c = sess.cur, now = Date.now();
  const prev = state.cards[c.id];
  const next = schedule(prev, kind, now);
  state.cards[c.id] = next;

  // Statistiques du jour
  const t = today();
  t.r++;
  if (!prev || prev.s === 'new') t.n++;
  t.ms += Math.min(now - sess.shownAt, 60e3);
  if (!sess.seen.has(c.id)) { sess.seen.add(c.id); sess.res[kind]++; }
  save();

  // La carte revient plus tard dans la session si elle est encore en apprentissage
  sess.queue.shift();
  if (next.s === 'learn' || next.s === 'relearn') {
    sess.queue.splice(Math.min(sess.queue.length, kind === 'again' ? 3 : 6), 0, c);
  } else sess.done.add(c.id);

  buzz(kind === 'good' ? 12 : [10, 40, 10]);
  feedback(kind, 1);
  const w = card.offsetWidth, h = card.offsetHeight;
  const dx = drag?.dx || 0, dy = drag?.dy || 0;
  const tx = kind === 'good' ? w * 1.5 : kind === 'again' ? -w * 1.5 : dx;
  const ty = kind === 'hard' ? -h * 1.3 : dy + 40;
  const rot = kind === 'good' ? 18 : kind === 'again' ? -18 : dx / 18;
  card.style.transition = 'transform .34s cubic-bezier(.4,0,.9,.6), opacity .34s ease-in';
  card.style.transform = `translate(${tx}px, ${ty}px) rotate(${rot}deg)`;
  card.style.opacity = '0';
  drag = null;
  setTimeout(nextCard, 340);
}

function nextCard() {
  if (!sess.queue.length) {
    sess.cur = null;
    sess.busy = false;
    $('#fc-bar').style.width = '100%';
    ghost.style.opacity = '0';
    return showDone();
  }
  card.style.cssText = 'transition:none';
  showCard();
  card.getBoundingClientRect();
  card.style.cssText = '';
  card.classList.add('enter');
  setTimeout(() => card.classList.remove('enter'), 340);
  sess.busy = false;
  if (S.autoplay) speak(sess.cur.word);
}

function showDone() {
  const r = sess.res;
  const tomorrow = endOfToday() + 864e5;
  let dueTomorrow = 0;
  for (const st of Object.values(state.cards)) if (st.s !== 'new' && st.due <= tomorrow && st.due > endOfToday()) dueTomorrow++;
  const t = today();
  const goalMsg = t.r >= S.goal ? 'Objectif du jour atteint' : `Encore ${plural(S.goal - t.r, 'carte', 'cartes')} pour l’objectif du jour`;
  openSheet({
    title: 'Session terminée', right: null,
    body: `<div class="done">
      <div class="done-icon">${ic('check')}</div>
      <p class="done-title">Bravo, ${plural(sess.total, 'carte révisée', 'cartes révisées')}</p>
      <p class="done-sub">${goalMsg}<br>${dueTomorrow ? `Demain : ${plural(dueTomorrow, 'carte', 'cartes')} à revoir` : 'Rien de prévu demain pour l’instant'}</p>
      <div class="done-stats">
        <div style="--c:var(--green);--ink:var(--green-ink)"><b>${r.good}</b><span>Je savais</span></div>
        <div style="--c:var(--orange);--ink:var(--orange-ink)"><b>${r.hard}</b><span>Difficiles</span></div>
        <div style="--c:var(--red);--ink:var(--red-ink)"><b>${r.again}</b><span>À revoir</span></div>
      </div>
      <button class="btn primary" data-action="fc-finish">Terminer</button>
      <button class="btn text" data-action="fc-more">Continuer à réviser</button>
    </div>`,
    onClose: () => pop()
  });
}
actions['fc-finish'] = () => closeSheet();
actions['fc-more'] = () => {
  const q = buildQueue(sess.deckId, true);
  if (!q.length) { toast('Plus aucune carte disponible ici'); return; }
  closeSheet(true);
  Object.assign(sess, { queue: q, total: q.length, done: new Set(), seen: new Set(), res: { good: 0, hard: 0, again: 0 }, busy: false });
  card.style.cssText = '';
  showCard();
  if (S.autoplay) speak(sess.cur.word);
};
actions.flip = flip;

/* ---------- Glisser la carte (souris ou doigt) ---------- */
export function initFlashcards() {
  card = $('#fc-card'); footer = $('#fc-footer'); ghost = $('#fc-ghost');

  card.addEventListener('pointerdown', e => {
    if (sess.busy || e.button > 0 || e.target.closest('button')) return;
    drag = { x: e.clientX, y: e.clientY, dx: 0, dy: 0, moved: false, kind: null, over: false, id: e.pointerId };
    try { card.setPointerCapture(e.pointerId); } catch (err) { /* ignoré */ }
    card.style.transition = 'none';
  });
  card.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.dx = e.clientX - drag.x;
    drag.dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(drag.dx, drag.dy) < 6) return;
    drag.moved = true;
    const { dx, dy } = drag;
    card.style.transform = `translate(${dx}px, ${dy * 0.4}px) rotate(${dx / 18}deg)`;
    const horiz = Math.abs(dx) >= Math.abs(dy);
    const kind = horiz ? (dx > 0 ? 'good' : 'again') : (dy < 0 ? 'hard' : null);
    const strength = kind === 'hard' ? Math.min(1, -dy / 110) : kind ? Math.min(1, Math.abs(dx) / 110) : 0;
    feedback(kind, strength * 0.95);
    const over = !!kind && strength >= 1;
    if (over && !drag.over) buzz(8);
    drag.over = over;
    drag.kind = kind;
  });
  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    if (!d.moved) { drag = null; card.style.transition = ''; flip(); return; }
    if (d.over && d.kind && e.type === 'pointerup') { drag = { dx: d.dx, dy: d.dy * 0.4 }; answer(d.kind); return; }
    drag = null;
    card.style.transition = 'transform .45s cubic-bezier(.34,1.4,.64,1)';
    card.style.transform = '';
    feedback(null, 0);
  };
  card.addEventListener('pointerup', end);
  card.addEventListener('pointercancel', end);
}

// Raccourcis clavier sur ordinateur
export function flashKey(e) {
  const k = e.key;
  if (k === ' ' || k === 'Enter') { e.preventDefault(); e.target.blur?.(); flip(); }
  else if (k === 'ArrowRight' || k === '3') answer('good');
  else if (k === 'ArrowLeft' || k === '1') answer('again');
  else if (k === 'ArrowUp' || k === '2') { e.preventDefault(); answer('hard'); }
  else if (k === 'Escape') pop();
}

export const refreshCardVoice = v => $$('.acc', card).forEach(a => a.classList.toggle('on', a.dataset.acc === v));
export const refreshTranslate = () => card.classList.toggle('no-tr', !S.translate);
