// Service Worker: macht den Fancy Health Tracker offline startbar.
// Strategie „Netz zuerst“: Online kommt immer die neueste Version von GitHub,
// offline (oder bei sehr langsamem Netz) die zuletzt gespeicherte Kopie.
// Externe Anfragen (Open Food Facts, Scanner-Bibliothek) laufen direkt ins Netz.
const CACHE = 'fancy-health-v3';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './apple-touch-icon.png', './icon-192.png', './icon-512.png'];
const TIMEOUT = 4000;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(networkFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  const fromNet = fetch(req).then(res => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  });
  const cached = await cache.match(req, { ignoreSearch: true })
    || (req.mode === 'navigate' ? await cache.match('./index.html') : undefined);
  if (!cached) return fromNet; // noch nichts gespeichert → normal laden
  const timeout = new Promise(resolve => setTimeout(() => resolve(cached), TIMEOUT));
  return Promise.race([fromNet.catch(() => cached), timeout]);
}
