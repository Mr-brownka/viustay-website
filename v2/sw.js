// Viustay v2 service worker: makes the site installable and keeps it usable on a weak connection.
// Pages: network first (always fresh), cached copy if offline. Styles, scripts, images: cache first.
// Supabase, Google Sheets and other sites are never cached.
var CACHE = 'viustay-v2-1';
var CORE = ['./', './index.html', './homes.html', './matches.html', './book.html', './owners.html',
  './css/styles.css', './css/glass.css', './css/chat.css',
  './js/look.js', './js/common.js', './js/config.js', './js/chat.js', './js/results.js', './js/flow.js', './js/install.js',
  './assets/viustay-logo-colour.svg', './assets/viustay-logo-white.svg', './assets/app-icon-192.png', './assets/favicon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).catch(function () {}));
  self.skipWaiting();
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('viustay-v2-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});
self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;   // leave Supabase, Sheets, fonts alone
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') >= 0) {
    e.respondWith(fetch(req).then(function (res) {
      var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); return res;
    }).catch(function () { return caches.match(req).then(function (r) { return r || caches.match('./index.html'); }); }));
    return;
  }
  e.respondWith(caches.match(req).then(function (hit) {
    var net = fetch(req).then(function (res) {
      if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    });
    return hit || net;
  }));
});
