// Service worker mínimo y conservador (PWA · I4).
// Objetivo: instalabilidad + una página offline. NO intercepta ni cachea las
// peticiones normales (evita servir contenido viejo / romper Next). Solo da un
// fallback cuando una NAVEGACIÓN falla por falta de red.
const CACHE = "sc-shell-v2";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add("/offline.html")));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || req.mode !== "navigate") return; // todo lo demás → red directa
  event.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
});
