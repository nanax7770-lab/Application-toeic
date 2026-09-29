// Chargement du vocabulaire depuis les fichiers JSON du dossier data/vocab/.
import { state } from './store.js';
import { slug, fold } from './util.js';

export const decks = [];          // paquets dans l'ordre d'affichage
export const cards = new Map();   // toutes les cartes, par identifiant

export const CUSTOM_ID = 'perso';

export async function loadData() {
  const index = await (await fetch('data/vocab/index.json')).json();
  const files = await Promise.all(index.decks.map(f =>
    fetch('data/vocab/' + f).then(r => r.json()).catch(err => {
      console.error('Paquet illisible :', f, err);
      return null;
    })));
  for (const d of files) if (d) addDeck(d);
  refreshCustom();
}

function addDeck(d) {
  const deck = {
    id: d.id, name: d.name, short: d.short || d.name,
    group: d.group || 'theme', description: d.description || '', cards: []
  };
  for (const raw of d.cards || []) {
    if (!raw.word || !raw.fr) continue;
    const id = `${d.id}:${slug(raw.word)}`;
    if (cards.has(id)) continue;
    const card = { ...raw, id, deck: deck.id };
    cards.set(id, card);
    deck.cards.push(card);
  }
  decks.push(deck);
}

// Paquet « Mes cartes » : les cartes ajoutées par l'utilisateur
export function refreshCustom() {
  let deck = decks.find(d => d.id === CUSTOM_ID);
  if (!deck) {
    deck = { id: CUSTOM_ID, name: 'Mes cartes', short: 'Mes cartes', group: 'custom', description: 'Les cartes que vous avez ajoutées.', cards: [] };
    decks.push(deck);
  }
  for (const c of deck.cards) cards.delete(c.id);
  deck.cards = state.custom.map(c => ({ ...c, deck: CUSTOM_ID }));
  for (const c of deck.cards) cards.set(c.id, c);
}

export const deckById = id => decks.find(d => d.id === id);

// Recherche dans tout le vocabulaire (sans tenir compte des accents)
export function search(q, limit = 60) {
  const f = fold(q.trim());
  if (!f) return [];
  const starts = [], contains = [];
  for (const c of cards.values()) {
    const w = fold(c.word), fr = fold(c.fr);
    if (w.startsWith(f)) starts.push(c);
    else if (w.includes(f) || fr.includes(f)) contains.push(c);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}
