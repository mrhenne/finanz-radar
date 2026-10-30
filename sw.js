/* Finanz-Radar Service Worker: App offline startbar halten, Updates sofort ausliefern.
   Strategie: eigene Dateien zuerst aus dem Netz (immer aktuell), bei fehlender Verbindung aus dem Cache.
   Supabase-Bibliothek vom CDN: Cache mit Aktualisierung im Hintergrund.
   API-Aufrufe (Supabase-Daten, CoinGecko) werden NIE gecacht. */
const VERSION = 'fr-2026-10-30b';
const SHELL = ['./', 'index.html', 'styles.css', 'config.js', 'app.js', 'features.js', 'extras.js', 'boost.js', 'manifest.webmanifest', 'icon-180.png', 'icon-512.png'];
const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => /* eine fehlende Datei bricht die Installation nicht ab (S-27) */ null)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const timeout = (p, ms) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout')), ms); p.then(v => { clearTimeout(t); res(v); }, err => { clearTimeout(t); rej(err); }); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      try {
        const res = await timeout(fetch(req), 5000);
        if (res && res.ok && res.type === 'basic') cache.put(req.mode === 'navigate' ? 'index.html' : req, res.clone());
        return res;
      } catch (err) {
        const hit = await cache.match(req.mode === 'navigate' ? 'index.html' : req, { ignoreSearch: true });
        if (hit) return hit;
        if (req.mode === 'navigate') { const idx = await cache.match('./'); if (idx) return idx; }
        throw err;
      }
    })());
    return;
  }

  if (req.url.startsWith(CDN)) {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION), hit = await cache.match(req);
      const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => /* Netzfehler: der Aufrufer nutzt den Cache-Eintrag oder Response.error() */ null);
      return hit || (await net) || Response.error();
    })());
  }
});
