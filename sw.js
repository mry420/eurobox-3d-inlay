// Offline-Unterstützung: alles zuerst aus dem Netz, ohne Verbindung aus dem Zwischenspeicher.
const CACHE = 'ebx-v1';
const CORE = ['./', 'index.html', 'assets/css/app.css', 'assets/js/config.js', 'assets/js/i18n.js', 'assets/js/font.js',
  'assets/js/app.js', 'assets/vendor/three.min.js', 'assets/img/icon.svg', 'assets/img/icon-192.png', 'manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // Werbung und Fremdes nie zwischenspeichern
  // Immer zuerst das Netz, damit Updates sofort ankommen; ohne Netz die gespeicherte Kopie
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
