// Cache the whole app on install so it opens with no signal, forever.
// There is no network fetching in this app beyond its own files — nothing
// here talks to a server, and this worker never sends anything anywhere.
const CACHE = "system-v1";
const FILES = [
  "./", "./index.html", "./manifest.webmanifest",
  "./icon-192.png", "./icon-512.png", "./icon-512-maskable.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first: the app must open identically whether or not there is a network.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request, {ignoreSearch:true})
      .then(hit => hit || fetch(e.request).catch(() => caches.match("./index.html")))
  );
});
