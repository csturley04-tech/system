// Offline support for the System app.
//
// NETWORK-FIRST for the page, CACHE-FIRST for everything else.
//
// Why: a pure cache-first worker serves the version it cached on the day you
// installed it, forever, with no error and no sign anything is wrong. Updates
// simply never arrive. That failure is silent, which makes it the worst kind.
// So the HTML is fetched fresh whenever there is a network, and the cache is
// the fallback rather than the default. Offline behaviour is unchanged: with
// no signal the fetch fails and the cached page answers immediately.
//
// Nothing here sends anything anywhere. It only caches this app's own files.

const CACHE = "system-v2";
const FILES = [
  "./", "./index.html", "./manifest.webmanifest",
  "./icon-192-v3.png", "./icon-512-v3.png", "./icon-512-maskable-v3.png"
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

function isPage(req) {
  return req.mode === "navigate"
      || (req.headers.get("accept") || "").includes("text/html");
}

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;

  if (isPage(e.request)) {
    // Fresh if possible; cached if not. Update the cache on every success.
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put("./index.html", copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match("./index.html", {ignoreSearch: true})
                       .then(hit => hit || caches.match("./")))
    );
    return;
  }

  // Icons and the manifest are cache-first, which is only safe because new
  // artwork ALWAYS gets a new filename (icon-192-v3.png, -v3 and so on).
  // Overwriting an icon in place would leave every installed phone showing the
  // old one forever. The rule is the filename, not anyone remembering.
  e.respondWith(
    caches.match(e.request, {ignoreSearch: true})
      .then(hit => hit || fetch(e.request))
  );
});
