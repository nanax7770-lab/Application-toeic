// « Service worker » : garde une copie de l'application pour qu'elle marche hors ligne.
// Changez VERSION à chaque mise à jour pour forcer le téléchargement des nouveaux fichiers.
const VERSION = 'toeic990-v1';

const CORE = [
  './', 'index.html', 'manifest.json', 'css/style.css',
  'js/app.js', 'js/util.js', 'js/store.js', 'js/srs.js', 'js/tts.js', 'js/data.js', 'js/ui.js', 'js/flashcards.js', 'js/screens.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'data/vocab/index.json'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(CORE);
    // On ajoute aussi tous les paquets de vocabulaire listés dans index.json
    const index = await (await fetch('data/vocab/index.json', { cache: 'no-store' })).json();
    await cache.addAll(index.decks.map(f => 'data/vocab/' + f));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

// Stratégie : on répond tout de suite avec la copie locale, puis on la met à jour en arrière-plan.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req).then(res => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (cached) { e.waitUntil(network); return cached; }
    return (await network) || new Response('Hors ligne', { status: 503, statusText: 'Hors ligne' });
  })());
});
