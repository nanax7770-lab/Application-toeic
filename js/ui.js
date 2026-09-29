// Navigation façon iOS, feuilles modales, anneaux et petits composants.
import { $, $$, ic, esc } from './util.js';
import { S } from './store.js';

/* ---------- Actions déclenchées par les boutons (data-action="...") ---------- */
export const actions = {};
export const enter = {};   // appelé quand une page s'ouvre
export const leave = {};   // appelé quand une page se ferme
const refreshers = [];
export const onRefresh = fn => refreshers.push(fn);
export const refresh = () => refreshers.forEach(fn => fn());

/* ---------- Apparence ---------- */
const mq = matchMedia('(prefers-color-scheme: dark)');
export function applyTheme() {
  const r = document.documentElement;
  if (S.theme === 'auto') delete r.dataset.theme; else r.dataset.theme = S.theme;
  const dark = S.theme === 'dark' || (S.theme === 'auto' && mq.matches);
  $$('meta[name="theme-color"]').forEach(m => m.content = dark ? '#000000' : '#F2F2F7');
}
mq.addEventListener?.('change', applyTheme);

/* ---------- Pages ---------- */
const tabbar = () => $('#tabbar');
export const stack = ['home'];
let animating = false;
export const page = n => $(`.page[data-page="${n}"]`);
export const current = () => stack.at(-1);

function afterTransform(el, fn) {
  let done = false;
  const finish = () => { if (done) return; done = true; el.removeEventListener('transitionend', h); fn(); };
  const h = e => { if (e.target === el && e.propertyName === 'transform') finish(); };
  el.addEventListener('transitionend', h);
  setTimeout(finish, 650);
}

export function push(n, arg) {
  if (animating || current() === n) return;
  const from = page(current()), to = page(n);
  animating = true;
  $$('.back-label', to).forEach(b => b.textContent = from.dataset.title);
  stack.push(n);
  enter[n]?.(arg);
  to.style.transition = 'none';
  to.style.transform = 'translateX(100%)';
  to.classList.add('active');
  to.getBoundingClientRect();
  to.style.transition = '';
  to.style.transform = 'translateX(0)';
  from.classList.add('under');
  if (stack.length === 2) tabbar().classList.add('under');
  afterTransform(to, () => { animating = false; to.style.transform = ''; });
}

export function pop() {
  if (animating || stack.length < 2) return;
  animating = true;
  const n = stack.pop(), from = page(n), to = page(current());
  leave[n]?.();
  refresh();
  from.style.transform = 'translateX(100%)';
  to.classList.remove('under');
  if (stack.length === 1) tabbar().classList.remove('under');
  afterTransform(from, () => { from.classList.remove('active'); from.style.transform = ''; animating = false; });
}

export function showTab(n) {
  if (stack.length > 1) return;
  if (stack[0] === n) { $('.scroll', page(n))?.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  page(stack[0]).classList.remove('active');
  const p = page(n);
  p.classList.add('active', 'fade');
  setTimeout(() => p.classList.remove('fade'), 260);
  stack[0] = n;
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === n));
}

// Grand titre qui se replie et barre floutée pendant le défilement
export function initScrollBars() {
  $$('.page').forEach(p => {
    const sc = $('.scroll', p), nav = $('.nav', p);
    if (!sc || !nav) return;
    sc.addEventListener('scroll', () => {
      const h1 = $('.large-title', p);
      const limit = h1 ? h1.offsetTop + h1.offsetHeight - nav.offsetHeight : 2;
      nav.classList.toggle('scrolled', sc.scrollTop > limit);
    }, { passive: true });
  });
}

/* ---------- Feuilles modales (qui montent du bas) ---------- */
let onSheetClose = null;
const sheetEl = () => $('#sheet');

// left / right : { label, action, strong }
export function openSheet({ title = '', body = '', left = null, right = { label: 'OK', close: true }, tall = false, onClose = null }) {
  const sheet = sheetEl();
  const btn = b => b ? `<button class="sh-btn${b.strong ? ' strong' : ''}" ${b.close ? 'data-close' : `data-action="${b.action}"`}>${esc(b.label)}</button>` : '';
  sheet.innerHTML = `<div class="sheet-head"><span class="grabber"></span><div class="sh-left">${btn(left)}</div><h3>${esc(title)}</h3><div class="sh-right">${btn(right)}</div></div><div class="sheet-body">${body}</div>`;
  sheet.classList.toggle('tall', tall);
  onSheetClose = onClose;
  sheet.style.transform = '';
  sheet.getBoundingClientRect();
  sheet.classList.add('open');
  $('#backdrop').classList.add('open');
}
export const sheetOpen = () => sheetEl().classList.contains('open');
export function closeSheet(silent = false) {
  const sheet = sheetEl();
  if (!sheet.classList.contains('open')) return;
  sheet.style.transition = '';
  sheet.style.transform = '';
  sheet.classList.remove('open');
  $('#backdrop').classList.remove('open');
  document.activeElement?.blur?.();
  const cb = onSheetClose;
  onSheetClose = null;
  if (!silent) cb?.();
}

export function initSheetDrag() {
  const sheet = sheetEl();
  let sd = null;
  sheet.addEventListener('pointerdown', e => {
    if (!e.target.closest('.sheet-head') || e.target.closest('button')) return;
    sd = { y: e.clientY, t: performance.now(), dy: 0 };
    try { sheet.setPointerCapture(e.pointerId); } catch (err) { /* ignoré */ }
    sheet.style.transition = 'none';
  });
  sheet.addEventListener('pointermove', e => {
    if (!sd) return;
    sd.dy = Math.max(0, e.clientY - sd.y);
    sheet.style.transform = `translateY(${sd.dy}px)`;
  });
  const up = () => {
    if (!sd) return;
    const fast = sd.dy / (performance.now() - sd.t) > 0.6;
    const close = sd.dy > 110 || (fast && sd.dy > 30);
    sd = null;
    if (close) closeSheet();
    else { sheet.style.transition = ''; sheet.style.transform = ''; }
  };
  sheet.addEventListener('pointerup', up);
  sheet.addEventListener('pointercancel', up);
  $('#backdrop').addEventListener('click', () => closeSheet());
}

// Fenêtre de confirmation (pour les actions importantes)
export function confirmSheet({ title, text, ok, danger = true, onOk }) {
  actions.__confirm = () => { closeSheet(true); onOk(); };
  openSheet({
    title, right: null, left: { label: 'Annuler', close: true },
    body: `<div class="confirm"><p>${text}</p><button class="btn ${danger ? 'danger' : 'primary'}" data-action="__confirm">${esc(ok)}</button><button class="btn text" data-close>Annuler</button></div>`
  });
}

/* ---------- Composants ---------- */
export function seg(name, opts, val) {
  const i = Math.max(0, opts.findIndex(o => o[0] === val));
  return `<div class="seg" data-seg="${name}" style="--n:${opts.length};--i:${i}"><span class="seg-thumb"></span>${opts.map(([v, l]) => `<button class="${v === val ? 'on' : ''}" data-v="${v}">${esc(l)}</button>`).join('')}</div>`;
}
export const toggleRow = (name, label, on) =>
  `<div class="row"><span class="rt"><span>${esc(label)}</span></span><label class="switch"><input type="checkbox" data-switch="${name}" ${on ? 'checked' : ''}><span></span></label></div>`;
export const stepperRow = (name, label, value) =>
  `<div class="row"><span class="rt"><span>${esc(label)}</span><small data-stepval="${name}">${value}</small></span><div class="stepper"><button data-step="${name}" data-d="-1" aria-label="Moins">${ic('minus')}</button><button data-step="${name}" data-d="1" aria-label="Plus">${ic('plus')}</button></div></div>`;

// Anneaux façon Apple Fitness. list : [{ r, w, color, p }]
export function rings(size, list, animate = false) {
  const c = size / 2;
  return `<svg class="ringsvg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">${list.map(g => {
    const C = 2 * Math.PI * g.r, off = C * (1 - Math.max(0, Math.min(g.p, 1)));
    return `<circle cx="${c}" cy="${c}" r="${g.r}" fill="none" style="stroke:${g.color}" stroke-opacity=".2" stroke-width="${g.w}"/>` +
      (g.p > 0 ? `<circle class="${animate ? 'arc' : ''}" cx="${c}" cy="${c}" r="${g.r}" fill="none" style="stroke:${g.color}" stroke-width="${g.w}" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${animate ? C : off}" data-off="${off}" transform="rotate(-90 ${c} ${c})"/>` : '');
  }).join('')}</svg>`;
}
export function playRings(root) {
  const arcs = $$('.arc', root);
  root.getBoundingClientRect();
  arcs.forEach(a => a.style.strokeDashoffset = a.dataset.off);
}
