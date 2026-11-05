/* Saioua Connecté : service worker (coque hors ligne + notifications push) */
var VER = "saioua-v1";
var COQUE = ["./", "index.html", "manifest.webmanifest", "icon.svg", "icon-192.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(VER).then(function (c) { return c.addAll(COQUE); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== VER; }).map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") { return; }
  var u = new URL(req.url);
  if (u.origin !== self.location.origin) { return; }   // les appels au serveur ne passent jamais par le cache

  if (req.mode === "navigate") {
    // page : toujours la version en ligne, la copie sert seulement hors connexion
    e.respondWith(fetch(req).catch(function () { return caches.match("index.html"); }));
    return;
  }
  // fichiers fixes (icônes, manifeste) : copie locale puis mise à jour en arrière-plan
  e.respondWith(
    caches.match(req).then(function (hit) {
      var reseau = fetch(req).then(function (r) {
        if (r && r.ok) { var copie = r.clone(); caches.open(VER).then(function (c) { c.put(req, copie); }); }
        return r;
      }).catch(function () { return hit; });
      return hit || reseau;
    })
  );
});

/* ---- notifications ---- */
self.addEventListener("push", function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { texte: e.data ? e.data.text() : "" }; }
  e.waitUntil(
    self.registration.showNotification(d.titre || "Saioua Connecté", {
      body: d.texte || "",
      icon: "icon-192.png",
      badge: "badge-72.png",
      tag: d.tag || "saioua",
      renotify: true,
      lang: "fr",
      data: { url: d.url || "" }
    })
  );
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (liste) {
      for (var i = 0; i < liste.length; i++) {
        if (liste[i].url.indexOf(self.registration.scope) === 0 && "focus" in liste[i]) { return liste[i].focus(); }
      }
      return self.clients.openWindow(self.registration.scope);
    })
  );
});
