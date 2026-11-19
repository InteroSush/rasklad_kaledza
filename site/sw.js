const CACHE = "schedule-v1";
const SHELL = ["./", "index.html", "core.js", "app.js", "style.css", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin) return;
  if (u.pathname.endsWith("/data/schedule.json")) {           // data: network first, cache as offline fallback
    e.respondWith(fetch(r, { cache: "no-cache" }).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); return res;
    }).catch(() => caches.match(r)));
    return;
  }
  e.respondWith(caches.match(r, { ignoreSearch: true }).then(hit => {   // app files: cache first, refresh in background
    const net = fetch(r).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); return res; }).catch(() => hit);
    return hit || net;
  }));
});
