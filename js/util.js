// Petits outils utilisés partout dans l'application.

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// Protège le texte avant de l'insérer dans la page.
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// **mot** devient <b>mot</b> (le reste est protégé).
export const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
export const plain = s => String(s ?? '').replace(/\*\*/g, '');

export const ic = (id, cls = '') => `<svg class="ic${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
export const chev = () => ic('chev-r', 'chev');

export const buzz = p => { try { navigator.vibrate?.(p); } catch (e) { /* non disponible */ } };

export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const endOfToday = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime(); };

export const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const fold = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Pluriel français : 0 et 1 au singulier.
export const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

let toastTimer;
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}
