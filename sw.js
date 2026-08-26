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
//
// The CACHE name is bumped on every release that changes a cached file. The
// icons are safe because new artwork always gets a new filename - but the
// MANIFEST cannot, it lives at a fixed path and is cache-first, so a stale
// copy could hand Android the previous icon at install time. Renaming the
// cache makes activate() delete the old one outright instead of relying on
// addAll happening to overwrite in time.

const CACHE = "system-v3";
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

// Tapping the "who's fronting" notification should open the app, not a new
// copy of it. Focus an existing window if one is already open.
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({type: "window", includeUncontrolled: true}).then(list => {
      for (const c of list) if ("focus" in c) return c.focus();
      if (self.clients.openWindow) return self.clients.openWindow("./index.html");
    })
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
