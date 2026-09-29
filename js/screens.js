// Contenu des écrans : accueil, paquets, page d'un paquet, progrès, réglages.
import { $, esc, ic, chev, dayKey, plural, toast, slug } from './util.js';
import { state, S, save, today, dayStats, exportData, importData, resetAll } from './store.js';
import { cards, decks, deckById, search, refreshCustom, CUSTOM_ID } from './data.js';
import { status, mastery, fmtMs, fmtDays } from './srs.js';
import { plan, startSession, backHTML } from './flashcards.js';
import { actions, enter, push, openSheet, closeSheet, confirmSheet, rings, playRings, seg, toggleRow, stepperRow, onRefresh, refresh, current } from './ui.js';

const WEEKDAY = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

/* ---------- Calculs ---------- */
function deckStats(d) {
  let n = 0, learn = 0, review = 0, mastered = 0, m = 0;
  for (const c of d.cards) {
    const st = state.cards[c.id], s = status(st);
    if (s === 'new') n++; else if (s === 'learn') learn++; else if (s === 'review') review++; else mastered++;
    m += mastery(st);
  }
  return { n, learn, review, mastered, total: d.cards.length, p: d.cards.length ? m / d.cards.length : 0 };
}
function allStats() {
  const t = { n: 0, learn: 0, review: 0, mastered: 0, total: 0 };
  for (const d of decks) { const s = deckStats(d); for (const k in t) t[k] += s[k]; }
  return t;
}
// Série : nombre de jours de suite où l'objectif a été atteint
function streak() {
  let n = 0;
  const d = new Date();
  if (dayStats(dayKey(d)).r >= S.goal) n++;
  for (;;) {
    d.setDate(d.getDate() - 1);
    if (dayStats(dayKey(d)).r >= S.goal) n++; else break;
  }
  return n;
}
function bestStreak() {
  const keys = Object.keys(state.days).filter(k => state.days[k].r >= S.goal).sort();
  let best = 0, run = 0, prev = null;
  for (const k of keys) {
    const d = new Date(k + 'T12:00:00');
    run = prev && (d - prev) < 1.5 * 864e5 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}
const pct = x => `${Math.round(x * 100)} %`;
const deckRing = p => rings(30, [{ r: 11.5, w: 4.5, color: 'var(--accent)', p }]);

/* ---------- Accueil ---------- */
function renderHome() {
  const t = today(), p = plan(), st = allStats(), s = streak();
  $('#today-date').textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const minutes = Math.round(t.ms / 60e3);
  let hero;
  if (p.total > 0) {
    const parts = [];
    if (p.due) parts.push(plural(p.due, 'carte à revoir', 'cartes à revoir'));
    if (p.fresh) parts.push(plural(p.fresh, 'nouveau mot', 'nouveaux mots'));
    hero = `<h2 class="hero-title">${parts.join(' · ')}</h2>
      <p class="hero-sub">Environ ${Math.max(1, Math.round(p.total * 12 / 60))} min · session de ${plural(p.total, 'carte', 'cartes')}</p>
      <button class="btn primary" data-action="study">Commencer</button>`;
  } else {
    hero = `<h2 class="hero-title">Tout est à jour</h2>
      <p class="hero-sub">Vos révisions du jour sont faites. Vous pouvez apprendre quelques mots de plus.</p>
      <button class="btn tinted" data-action="study" data-extra="1">Apprendre de nouveaux mots</button>`;
  }
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const r = dayStats(dayKey(d)).r;
    week.push(`<div class="${i === 0 ? 'today' : ''}">${rings(30, [{ r: 11.5, w: 5, color: 'var(--accent)', p: r / S.goal }])}<span>${WEEKDAY[d.getDay()]}</span></div>`);
  }
  const left = S.goal - t.r;
  const inProgress = decks.map(d => ({ d, p: plan(d.id) })).filter(x => x.p.due > 0).slice(0, 3);
  $('#home').innerHTML = `
    <div class="card hero"><p class="kicker">${ic('zap')}Session du jour</p>${hero}</div>

    <h2 class="section-title">Objectif du jour</h2>
    <div class="card rings-card">
      <div id="home-rings">${rings(132, [
        { r: 58, w: 13, color: 'var(--accent)', p: t.r / S.goal },
        { r: 43, w: 13, color: 'var(--green)', p: S.newPerDay ? t.n / S.newPerDay : 0 },
        { r: 28, w: 13, color: 'var(--orange)', p: minutes / S.minutesGoal }
      ], true)}</div>
      <ul class="legend">
        <li style="--c:var(--accent)"><span class="l">Cartes</span><span class="v">${t.r}<small>/${S.goal}</small></span></li>
        <li style="--c:var(--green)"><span class="l">Nouveaux mots</span><span class="v">${t.n}<small>/${S.newPerDay}</small></span></li>
        <li style="--c:var(--orange)"><span class="l">Minutes</span><span class="v">${minutes}<small>/${S.minutesGoal}</small></span></li>
      </ul>
    </div>
    <div class="card">
      <div class="streak-head">
        ${ic('flame', 'flame' + (s ? '' : ' off'))}
        <div><p class="streak-title">${s ? plural(s, 'jour de suite', 'jours de suite') : 'Lancez votre série'}</p>
        <p class="streak-sub">${left > 0 ? `Encore ${plural(left, 'carte', 'cartes')} pour valider aujourd’hui` : 'Objectif atteint aujourd’hui'}</p></div>
      </div>
      <div class="week">${week.join('')}</div>
    </div>

    ${inProgress.length ? `<h2 class="section-title">À revoir par paquet</h2>
    <div class="list">${inProgress.map(({ d, p }) => `<button class="row" data-action="open-deck" data-deck="${d.id}">${deckRing(deckStats(d).p)}<span class="rt"><span>${esc(d.name)}</span></span><span class="rd due">${p.due}</span>${chev()}</button>`).join('')}</div>` : ''}

    <h2 class="section-title">Vocabulaire</h2>
    <div class="card">
      <p class="muted">Mots maîtrisés</p>
      <p class="big-num">${st.mastered}<span> / ${st.total}</span></p>
      ${stackBar(st)}
    </div>`;
  playRings($('#home-rings'));
}

function stackBar(st) {
  const seg = (n, c) => n ? `<i style="width:${n / st.total * 100}%;background:${c}"></i>` : '';
  return `<div class="stack">${seg(st.mastered, 'var(--green)')}${seg(st.review, 'var(--accent)')}${seg(st.learn, 'var(--orange)')}</div>
    <div class="stack-legend">
      <span style="--c:var(--green)"><i></i>Maîtrisés<b>${st.mastered}</b></span>
      <span style="--c:var(--accent)"><i></i>En révision<b>${st.review}</b></span>
      <span style="--c:var(--orange)"><i></i>En apprentissage<b>${st.learn}</b></span>
      <span style="--c:var(--fill-2)"><i></i>Jamais vus<b>${st.n}</b></span>
    </div>`;
}

/* ---------- Onglet Cartes ---------- */
function deckRow(d) {
  const s = deckStats(d), p = plan(d.id);
  return `<button class="row" data-action="open-deck" data-deck="${d.id}">${deckRing(s.p)}<span class="rt"><span>${esc(d.name)}</span><small>${plural(s.total, 'mot', 'mots')} · ${pct(s.p)} maîtrisé</small></span>${p.due ? `<span class="rd due">${p.due}</span>` : ''}${chev()}</button>`;
}
function renderDecks() {
  const theme = decks.filter(d => d.group === 'theme'), special = decks.filter(d => d.group === 'special');
  const custom = deckById(CUSTOM_ID);
  $('#decks').innerHTML = `
    <p class="list-header">Thèmes</p>
    <div class="list icons">${theme.map(deckRow).join('')}</div>
    <p class="list-header">Paquets spéciaux</p>
    <div class="list icons">${special.map(deckRow).join('')}</div>
    <p class="list-header">Mes cartes</p>
    <div class="list icons">
      ${custom.cards.length ? deckRow(custom) : ''}
      <button class="row action" data-action="add-card"><span class="ri">${ic('plus')}</span><span class="rt"><span>Ajouter une carte</span></span></button>
    </div>
    <p class="list-footer">${plural(cards.size, 'carte', 'cartes')} au total. Le chiffre bleu indique les cartes à revoir aujourd’hui.</p>`;
}

function wordRow(c) {
  const st = state.cards[c.id], s = status(st);
  let right;
  if (s === 'new') right = `<span class="pill" style="--c:var(--gray)">Nouveau</span>`;
  else if (st.due <= Date.now()) right = `<span class="pill" style="--c:var(--accent)">À revoir</span>`;
  else right = `<span class="rd">${st.s === 'review' ? fmtDays(Math.max(1, Math.round((st.due - Date.now()) / 864e5))) : fmtMs(st.due - Date.now())}</span>`;
  return `<button class="row" data-action="word" data-id="${esc(c.id)}"><span class="rt"><span lang="en">${esc(c.word)}</span><small>${esc(c.fr)}</small></span>${right}</button>`;
}

function renderSearch() {
  const q = $('#search').value;
  const box = $('#search-results');
  $('#search-clear').hidden = !q;
  if (!q.trim()) { box.hidden = true; $('#decks').hidden = false; return; }
  const res = search(q);
  box.hidden = false;
  $('#decks').hidden = true;
  box.innerHTML = res.length
    ? `<p class="list-header">${plural(res.length, 'résultat', 'résultats')}${res.length >= 60 ? ' (les 60 premiers)' : ''}</p><div class="list">${res.map(wordRow).join('')}</div>`
    : `<div class="empty">${ic('search')}<h3>Aucun résultat</h3><p>Essayez un autre mot, en anglais ou en français.</p></div>`;
}

/* ---------- Page d'un paquet ---------- */
let deckId = null;
enter.deck = id => { deckId = id; renderDeck(); $('.scroll', $('.page[data-page="deck"]')).scrollTop = 0; };
function renderDeck() {
  const d = deckById(deckId);
  if (!d) return;
  const s = deckStats(d), p = plan(d.id);
  $('.page[data-page="deck"]').dataset.title = d.short;
  $('#deck-nav-title').textContent = d.name;
  let cta;
  if (p.total) cta = `<button class="btn primary" data-action="study" data-deck="${d.id}">Réviser · ${plural(p.total, 'carte', 'cartes')}</button>`;
  else if (s.n) cta = `<button class="btn tinted" data-action="study" data-deck="${d.id}" data-extra="1">Apprendre de nouveaux mots</button>`;
  else cta = `<button class="btn primary" disabled>Tout est à jour</button>`;
  $('#deck').innerHTML = `
    <div class="lt"><h1 class="large-title">${esc(d.name)}</h1></div>
    ${d.description ? `<p class="deck-desc">${esc(d.description)}</p>` : ''}
    <div class="card deck-stats">
      <div><b>${s.n}</b><span>Jamais vus</span></div>
      <div><b style="color:var(--accent-ink)">${p.due}</b><span>À revoir</span></div>
      <div><b style="color:var(--green-ink)">${s.mastered}</b><span>Maîtrisés</span></div>
    </div>
    <div class="deck-cta">${cta}</div>
    ${d.id === CUSTOM_ID ? `<p class="list-header">Ajouter</p><div class="list icons"><button class="row action" data-action="add-card"><span class="ri">${ic('plus')}</span><span class="rt"><span>Ajouter une carte</span></span></button></div>` : ''}
    ${d.cards.length ? `<p class="list-header">${plural(d.cards.length, 'mot', 'mots')}</p><div class="list">${d.cards.map(wordRow).join('')}</div>` : `<div class="empty">${ic('layers')}<h3>Aucune carte</h3><p>Ajoutez vos propres mots : ils seront révisés comme les autres.</p></div>`}`;
}

/* ---------- Fiche d'un mot ---------- */
actions.word = el => {
  const c = cards.get(el.dataset.id);
  if (!c) return;
  const st = state.cards[c.id], s = status(st), d = deckById(c.deck);
  const info = s === 'new' ? 'Pas encore étudié'
    : st.due <= Date.now() ? 'À revoir maintenant'
    : `Prochaine révision dans ${st.s === 'review' ? fmtDays(Math.max(1, Math.round((st.due - Date.now()) / 864e5))) : fmtMs(st.due - Date.now())}`;
  openSheet({
    title: d ? d.short : '', tall: false,
    body: `<div class="card word-card${S.translate ? '' : ' no-tr'}">
        <div class="word-head"><div><p class="word-title" lang="en">${esc(c.word)}</p><p class="word-sub">${esc([c.ipa, c.pos].filter(Boolean).join(' · '))}</p></div>
        <button class="icon-btn" data-speak="${esc(c.word)}" aria-label="Écouter">${ic('vol')}</button></div>
        ${backHTML(c, undefined, false)}
      </div>
      <p class="list-footer">${info}${st && st.lapses ? ` · oublié ${plural(st.lapses, 'fois', 'fois')}` : ''}</p>
      ${c.deck === CUSTOM_ID ? `<div class="sheet-actions"><button class="btn danger" data-action="delete-card" data-id="${esc(c.id)}">Supprimer cette carte</button></div>` : ''}`
  });
};

actions['delete-card'] = el => {
  const id = el.dataset.id;
  confirmSheet({
    title: 'Supprimer', text: 'Cette carte et sa progression seront supprimées.', ok: 'Supprimer la carte',
    onOk: () => {
      state.custom = state.custom.filter(c => c.id !== id);
      delete state.cards[id];
      save(); refreshCustom(); refresh();
      toast('Carte supprimée');
    }
  });
};

/* ---------- Ajouter une carte ---------- */
actions['add-card'] = () => {
  const f = (name, ph, area = false, en = false) => `<label class="row field">${area
    ? `<textarea name="${name}" rows="2" placeholder="${ph}" ${en ? 'lang="en" autocapitalize="off"' : ''}></textarea>`
    : `<input name="${name}" placeholder="${ph}" autocomplete="off" ${en ? 'lang="en" autocapitalize="off" spellcheck="false"' : ''}>`}</label>`;
  openSheet({
    title: 'Nouvelle carte', tall: true,
    left: { label: 'Annuler', close: true }, right: { label: 'Ajouter', action: 'save-card', strong: true },
    body: `<form id="card-form" autocomplete="off" onsubmit="return false">
      <p class="list-header">Obligatoire</p>
      <div class="list">${f('word', 'Mot ou expression en anglais', false, true)}${f('fr', 'Traduction en français')}</div>
      <p class="list-header">Facultatif</p>
      <div class="list">${f('pos', 'Nature (nom, verbe, adjectif…)')}${f('def', 'Définition simple en anglais', true, true)}</div>
      <p class="list-header">Exemple</p>
      <div class="list">${f('ex', 'Phrase d’exemple en anglais', true, true)}${f('exfr', 'Traduction de l’exemple', true)}</div>
      <p class="list-header">Astuce</p>
      <div class="list">${f('note', 'Piège, règle ou moyen mnémotechnique', true)}</div>
      <p class="form-error" id="form-error" hidden></p>
      <p class="list-footer">La carte rejoint le paquet « Mes cartes » et sera révisée comme les autres.</p>
    </form>`
  });
  setTimeout(() => $('#card-form [name=word]')?.focus(), 450);
};
actions['save-card'] = () => {
  const form = $('#card-form');
  const v = n => form.elements[n].value.trim();
  const word = v('word'), fr = v('fr');
  if (!word || !fr) {
    const e = $('#form-error'); e.hidden = false; e.textContent = 'Indiquez au moins le mot anglais et sa traduction.';
    return;
  }
  const card = { id: `${CUSTOM_ID}:${slug(word) || 'carte'}-${Date.now().toString(36)}`, word, fr, pos: v('pos'), def: v('def'), ipa: '', examples: [] };
  if (v('ex')) card.examples.push({ en: v('ex'), fr: v('exfr') });
  if (v('note')) card.note = { type: 'tip', text: v('note') };
  state.custom.push(card);
  save(); refreshCustom();
  closeSheet(); refresh();
  toast(`« ${word} » ajouté à Mes cartes`);
};

/* ---------- Progrès ---------- */
function renderStats() {
  const st = allStats();
  const days = [];
  let max = 1;
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const r = dayStats(dayKey(d)).r; max = Math.max(max, r); days.push([d, r]); }
  const total7 = days.reduce((a, [, r]) => a + r, 0);
  const allDays = Object.values(state.days);
  const totalReviews = allDays.reduce((a, d) => a + d.r, 0);
  const totalMin = Math.round(allDays.reduce((a, d) => a + d.ms, 0) / 60e3);
  const hard = [...cards.values()].filter(c => state.cards[c.id]?.lapses > 0)
    .sort((a, b) => state.cards[b.id].lapses - state.cards[a.id].lapses).slice(0, 10);
  const ranked = decks.filter(d => d.cards.length).map(d => ({ d, s: deckStats(d) }));
  const started = ranked.filter(x => x.s.total - x.s.n > 0);
  const weak = [...started].sort((a, b) => a.s.p - b.s.p).slice(0, 3);
  $('#stats').innerHTML = `
    <div class="card">
      <p class="muted">Mots maîtrisés</p>
      <p class="big-num">${st.mastered}<span> / ${st.total}</span></p>
      ${stackBar(st)}
    </div>

    <h2 class="section-title">7 derniers jours</h2>
    <div class="card">
      <p class="muted">${plural(total7, 'carte révisée', 'cartes révisées')} · série actuelle ${plural(streak(), 'jour', 'jours')} · record ${plural(bestStreak(), 'jour', 'jours')}</p>
      <div class="days">${days.map(([d, r]) => `<div class="${r >= S.goal ? 'hit' : ''}"><em>${r || ''}</em><i style="height:${Math.max(4, r / max * 80)}%"></i><small>${WEEKDAY[d.getDay()]}</small></div>`).join('')}</div>
    </div>
    <p class="list-footer">En bleu : les jours où l’objectif de ${S.goal} cartes est atteint. Depuis le début : ${plural(totalReviews, 'révision', 'révisions')}, ${totalMin} min.</p>

    ${weak.length ? `<h2 class="section-title">À travailler</h2>
    <div class="list icons">${weak.map(({ d }) => deckRow(d)).join('')}</div>
    <p class="list-footer">Les paquets commencés où vous avez le moins de mots bien ancrés.</p>` : ''}

    ${hard.length ? `<h2 class="section-title">Mots difficiles</h2>
    <div class="list">${hard.map(wordRow).join('')}</div>
    <p class="list-footer">Les mots que vous avez oubliés le plus souvent.</p>` : ''}

    <h2 class="section-title">Par paquet</h2>
    <div class="list icons">${ranked.map(({ d }) => deckRow(d)).join('')}</div>`;
}

/* ---------- Entraînement et Examens (à venir) ---------- */
function renderSoon() {
  const row = (icon, title, sub, c) => `<button class="row" data-toast="Cette partie arrive dans une prochaine étape"><span class="ri"${c ? ` style="--c:${c}"` : ''}>${ic(icon)}</span><span class="rt"><span>${title}</span><small>${sub}</small></span>${chev()}</button>`;
  $('#train').innerHTML = `
    <p class="list-header">Listening</p>
    <div class="list icons">
      ${row('headphones', 'Partie 2 · Questions-réponses', '25 questions à l’examen')}
      ${row('headphones', 'Partie 3 · Conversations', '39 questions à l’examen')}
      ${row('headphones', 'Partie 4 · Exposés', '30 questions à l’examen')}
    </div>
    <p class="list-header">Reading</p>
    <div class="list icons">
      ${row('book', 'Partie 5 · Phrases incomplètes', '30 questions à l’examen')}
      ${row('book', 'Partie 6 · Textes incomplets', '16 questions à l’examen')}
      ${row('book', 'Partie 7 · Compréhension écrite', '54 questions à l’examen')}
    </div>
    <p class="list-header">Grammaire</p>
    <div class="list icons">
      ${row('bulb', 'Fiches de grammaire', '11 fiches et mini-exercices')}
      ${row('alert', 'Les pièges du TOEIC', 'Les faux-pièges qui reviennent tout le temps', 'var(--orange)')}
    </div>
    <p class="list-footer">Ces entraînements arrivent dans les prochaines étapes. Pour l’instant, place aux flashcards.</p>`;
  $('#exams').innerHTML = `
    <div class="list icons">
      ${row('timer', 'Mini-simulation', '20 questions · environ 12 min')}
      ${row('timer', 'Simulation', '50 questions · environ 30 min')}
      ${row('timer', 'Examen complet', '200 questions · 2 h')}
    </div>
    <p class="list-footer">Chronomètre réel et score estimé sur 990, avec le détail Listening et Reading. Arrive dans une prochaine étape.</p>`;
}

/* ---------- Réglages ---------- */
const STEP = { goal: [10, 10, 200], newPerDay: [5, 0, 50], sessionSize: [5, 10, 60], minutesGoal: [5, 5, 60] };
const stepLabel = { goal: v => plural(v, 'carte', 'cartes'), newPerDay: v => plural(v, 'mot', 'mots'), sessionSize: v => plural(v, 'carte', 'cartes'), minutesGoal: v => `${v} min` };
actions.step = el => {
  const k = el.dataset.step, [inc, min, max] = STEP[k];
  S[k] = Math.max(min, Math.min(max, S[k] + inc * Number(el.dataset.d)));
  $(`[data-stepval="${k}"]`).textContent = stepLabel[k](S[k]);
  save(); refresh();
};
actions.settings = () => openSheet({
  title: 'Réglages', tall: true,
  body: `
    <p class="list-header">Apparence</p>
    <div class="card" style="padding:12px">${seg('theme', [['auto', 'Automatique'], ['light', 'Clair'], ['dark', 'Sombre']], S.theme)}</div>
    <p class="list-footer">« Automatique » suit le réglage clair ou sombre de votre iPhone.</p>
    <p class="list-header">Voix</p>
    <div class="card" style="padding:12px">${seg('voice', [['US', 'Américaine'], ['UK', 'Britannique'], ['AU', 'Australienne']], S.voice)}</div>
    <div class="list" style="margin-top:12px">${toggleRow('autoplay', 'Lire le mot automatiquement', S.autoplay)}${toggleRow('translate', 'Traduire les exemples', S.translate)}</div>
    <p class="list-header">Objectifs</p>
    <div class="list">
      ${stepperRow('goal', 'Cartes par jour', stepLabel.goal(S.goal))}
      ${stepperRow('newPerDay', 'Nouveaux mots par jour', stepLabel.newPerDay(S.newPerDay))}
      ${stepperRow('sessionSize', 'Cartes par session', stepLabel.sessionSize(S.sessionSize))}
      ${stepperRow('minutesGoal', 'Minutes par jour', stepLabel.minutesGoal(S.minutesGoal))}
    </div>
    <p class="list-footer">15 nouveaux mots par jour, c’est environ 450 mots par mois.</p>
    <p class="list-header">Sauvegarde</p>
    <div class="list icons">
      <button class="row action" data-action="export"><span class="ri">${ic('download')}</span><span class="rt"><span>Exporter ma progression</span></span></button>
      <button class="row action" data-action="import"><span class="ri">${ic('upload')}</span><span class="rt"><span>Importer une progression</span></span></button>
    </div>
    <p class="list-footer">Votre progression est enregistrée uniquement sur cet appareil. Exportez-la de temps en temps pour la garder en sécurité ou la transférer.</p>
    <div class="list icons" style="margin-top:24px">
      <button class="row destructive" data-action="reset"><span class="ri" style="--c:var(--red)">${ic('trash')}</span><span class="rt"><span>Tout réinitialiser</span></span></button>
    </div>
    <p class="list-footer">TOEIC 990 · version 1.0</p>`
});

actions.export = () => {
  const blob = new Blob([exportData()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `toeic990-progression-${dayKey()}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast('Fichier de sauvegarde créé');
};
actions.import = () => $('#import-file').click();
export function initImport() {
  $('#import-file').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    try { JSON.parse(text); } catch (err) { toast('Ce fichier n’est pas une sauvegarde valide'); return; }
    confirmSheet({
      title: 'Importer', danger: false, ok: 'Remplacer ma progression',
      text: 'La progression de ce fichier remplacera celle de cet appareil.',
      onOk: () => {
        try { importData(text); location.reload(); }
        catch (err) { toast('Ce fichier n’est pas une sauvegarde TOEIC 990'); }
      }
    });
  });
}
actions.reset = () => confirmSheet({
  title: 'Tout réinitialiser', ok: 'Tout effacer',
  text: 'Toute votre progression, vos statistiques et vos cartes personnelles seront effacées. Pensez à exporter une sauvegarde avant.',
  onOk: () => { resetAll(); location.reload(); }
});

/* ---------- Démarrer une session ---------- */
actions.study = el => startSession(el.dataset.deck || null, !!el.dataset.extra);
actions['open-deck'] = el => push('deck', el.dataset.deck);

/* ---------- Mise à jour des écrans ---------- */
export function initScreens() {
  renderSoon();
  $('#search').addEventListener('input', renderSearch);
  $('#search-clear').addEventListener('click', e => { e.preventDefault(); $('#search').value = ''; renderSearch(); });
  onRefresh(() => {
    renderHome(); renderDecks(); renderStats(); renderSearch();
    if (deckId && (current() === 'deck' || current() === 'flash')) renderDeck();
  });
  // À minuit (ou au retour dans l'app), on remet l'accueil à jour
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
}
