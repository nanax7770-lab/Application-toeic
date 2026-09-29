// Répétition espacée (variante de l'algorithme SM-2, comme Anki).
// Chaque carte garde : s (état), due (date de la prochaine révision),
// ivl (intervalle en jours), ease (facilité), reps, lapses (oublis), step (étape d'apprentissage).
//
// États : new = jamais vue · learn = en apprentissage · review = en révision · relearn = oubliée, à réapprendre
// Réponses : again = « Je ne savais pas » · hard = « Difficile » · good = « Je savais »

const MIN = 60e3, DAY = 864e5;
export const STEPS = [1, 10];        // étapes d'apprentissage, en minutes
const FIRST_GOOD = 3;                 // mot déjà connu dès la 1re fois : revient dans 3 jours
const MAX_IVL = 365;
export const MASTERED = 21;           // maîtrisé à partir de 21 jours d'intervalle

export const fresh = () => ({ s: 'new', due: 0, ivl: 0, ease: 2.5, reps: 0, lapses: 0, step: 0 });

function reviewDue(now, ivl) {
  // La révision tombe le jour prévu, dès 4 h du matin.
  const d = new Date(now + ivl * DAY);
  d.setHours(4, 0, 0, 0);
  return d.getTime();
}

export function schedule(prev, grade, now = Date.now(), fuzz = true) {
  const c = { ...(prev || fresh()) };
  c.reps++;
  c.last = now;

  if (c.s === 'new' || c.s === 'learn' || c.s === 'relearn') {
    const wasNew = c.s === 'new';
    if (grade === 'again') {
      if (wasNew) c.s = 'learn';
      c.step = 0;
      c.due = now + STEPS[0] * MIN;
    } else if (grade === 'hard') {
      if (wasNew) c.s = 'learn';
      c.due = now + (c.step === 0 ? 6 : STEPS[c.step]) * MIN;
    } else if (wasNew) {
      graduate(c, FIRST_GOOD, now, fuzz);
    } else {
      c.step++;
      if (c.step >= STEPS.length) graduate(c, c.s === 'relearn' ? Math.max(1, c.ivl) : 1, now, fuzz);
      else c.due = now + STEPS[c.step] * MIN;
    }
    return c;
  }

  // Carte en révision
  if (grade === 'again') {
    c.lapses++;
    c.ease = Math.max(1.3, c.ease - 0.2);
    c.ivl = Math.max(1, Math.round(c.ivl * 0.3));
    c.s = 'relearn';
    c.step = 0;
    c.due = now + STEPS[0] * MIN;
    return c;
  }
  let ivl;
  if (grade === 'hard') {
    c.ease = Math.max(1.3, c.ease - 0.15);
    ivl = Math.max(c.ivl + 1, Math.round(c.ivl * 1.2));
  } else {
    ivl = Math.max(c.ivl + 1, Math.round(c.ivl * c.ease));
  }
  setInterval_(c, ivl, now, fuzz);
  return c;
}

function graduate(c, ivl, now, fuzz) {
  c.s = 'review';
  c.step = 0;
  setInterval_(c, ivl, now, fuzz);
}

function setInterval_(c, ivl, now, fuzz) {
  if (fuzz && ivl >= 3) ivl = Math.round(ivl * (0.95 + Math.random() * 0.1));
  c.ivl = Math.min(MAX_IVL, ivl);
  c.due = reviewDue(now, c.ivl);
}

// Texte affiché sous chaque bouton (« 10 min », « 3 jours »…)
export function preview(prev, grade, now = Date.now()) {
  const c = schedule(prev, grade, now, false);
  return c.s === 'review' ? fmtDays(c.ivl) : fmtMs(c.due - now);
}
export function fmtMs(ms) {
  const m = Math.max(1, Math.round(ms / MIN));
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h`;
  return fmtDays(Math.round(h / 24));
}
export function fmtDays(d) {
  if (d < 1) return 'aujourd’hui';
  if (d === 1) return '1 jour';
  if (d < 31) return `${d} jours`;
  const mo = Math.round(d / 30);
  return mo < 12 ? `${mo} mois` : `${Math.round(d / 365 * 10) / 10} an`.replace('.', ',');
}

// Statut simple d'une carte pour l'affichage
export function status(c) {
  if (!c || c.s === 'new') return 'new';
  if (c.s === 'learn' || c.s === 'relearn') return 'learn';
  return c.ivl >= MASTERED ? 'mastered' : 'review';
}

// Niveau de maîtrise d'une carte entre 0 et 1 (pour les anneaux)
export const mastery = c => (!c || c.s === 'new') ? 0 : c.s === 'review' ? Math.min(1, c.ivl / MASTERED) : 0.05;
