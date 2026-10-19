// Map home: Nairobi is the home screen. Area bubbles (homes + starting price), story circles, area sheet, Ask Amina.
if (/^#ask/.test(location.hash)) location.replace('amina.html');
document.addEventListener('DOMContentLoaded', function () {
  var V = window.V, T = V.t, $ = V.$;
  var stay = 'long', ALL = [], map = null, layer = null, cur = null;
  try { stay = localStorage.getItem('vs-map-stay') === 'short' ? 'short' : 'long'; } catch (e) {}
  function k(n) { return n >= 1000 ? Math.round(n / 1000) + 'k' : String(n); }
  function list() { return ALL.filter(function (l) { return (l.stay === 'short') === (stay === 'short'); }); }
  function byArea(arr) { var by = {}; arr.forEach(function (l) { if (l.area) (by[l.area] = by[l.area] || []).push(l); }); return by; }

  // ---- the map ----
  if (window.L) {
    map = L.map('map', { zoomControl: false, attributionControl: true, center: [-1.287, 36.80], zoom: window.innerWidth > 900 ? 13 : 12, minZoom: 10, maxZoom: 17 });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 19, attribution: '&copy; OpenStreetMap &copy; CARTO' }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 19, opacity: .55, pane: 'shadowPane' }).addTo(map);
    layer = L.layerGroup().addTo(map);
    map.on('click', function () { sheet(null); });
  }
  function draw() {
    if (!layer) return;
    layer.clearLayers();
    var by = byArea(list()), pts = [], i = 0;
    Object.keys(by).forEach(function (a) {
      var ll = V.AREAS[a]; if (!ll) return;
      var n = by[a].length, from = Math.min.apply(null, by[a].map(V.price)), size = Math.min(54, 14 + n * 4);
      var html = '<div class="ab' + (a === cur ? ' on' : '') + '" data-n="' + n + '" style="animation-delay:' + (i++ * 60) + 'ms"><b><span class="nm">' + V.esc(a) + ' · </span>' + n + ' <small>' + k(from) + '+</small></b><i style="width:' + size + 'px;height:' + size + 'px"><em>' + n + '</em></i></div>';
      var m = L.marker(ll, { icon: L.divIcon({ html: html, className: '', iconSize: [0, 0] }), keyboard: true, title: a });
      m.on('click', function (e) { L.DomEvent.stopPropagation(e); open(a); });
      m.addTo(layer); pts.push(ll);
    });
    declutter();
    if (pts.length > 1 && !cur) map.fitBounds(pts, { padding: window.innerWidth > 900 ? [160, 160] : [70, 60], maxZoom: 14 });
    setTimeout(declutter, 50);
  }
  // labels that would overlap shrink to a count dot (biggest areas keep their label)
  function declutter() {
    if (!map) return; var ms = [];
    layer.eachLayer(function (m) { var e = m.getElement(); if (e) ms.push({ e: e.querySelector('.ab'), p: map.latLngToContainerPoint(m.getLatLng()), n: +e.querySelector('.ab').getAttribute('data-n') }); });
    ms.sort(function (a, b) { return b.n - a.n; }); var kept = [];
    ms.forEach(function (m) {
      var hit = kept.some(function (k) { return Math.abs(k.x - m.p.x) < 150 && Math.abs(k.y - m.p.y) < 64; });
      m.e.classList.toggle('mini', hit && !m.e.classList.contains('on')); if (!hit) kept.push(m.p);
    });
  }
  if (map) map.on('zoomend', declutter);
  // ---- area sheet ----
  function open(a) {
    cur = a; draw();
    var homes = list().filter(function (l) { return l.area === a; }).sort(function (x, y) { return V.price(x) - V.price(y); });
    $('#sh-area').textContent = a;
    $('#sh-sub').textContent = T(homes.length === 1 ? '{n} place' : '{n} places', { n: homes.length }) + ' · ' + T('from') + ' KES ' + V.money(V.price(homes[0]));
    $('#sh-row').innerHTML = homes.map(function (l) {
      return '<a class="mp-h" href="home.html?id=' + encodeURIComponent(l.id) + '"><span style="' + V.photoStyle(l.photoList[0]) + '"><i>✓ ' + V.esc(T('Verified')) + '</i></span><b>KES ' + V.money(V.price(l)) + ' <small>' + V.esc(V.per(l)) + '</small></b><small>' + V.esc(V.shortDesc(l)) + (l.road ? ' · ' + V.esc(l.road) : '') + '</small></a>';
    }).join('');
    $('#sh-watch').onclick = function () { V.Reel.open(homes, { mode: 'story', title: a + ' · ' + T(homes.length === 1 ? '{n} place' : '{n} places', { n: homes.length }) }); };
    sheet(true);
    if (map && V.AREAS[a]) map.panTo(V.AREAS[a], { animate: true });
  }
  function sheet(on) { $('#mp-sheet').classList.toggle('on', !!on); $('#mp-card').style.display = on ? 'none' : ''; if (!on && cur) { cur = null; draw(); } }
  $('#mp-close').addEventListener('click', function () { sheet(null); });
  // ---- stories ----
  function seen() { try { return JSON.parse(localStorage.getItem('vs-seen') || '{}'); } catch (e) { return {}; } }
  function stories() {
    var s = seen(), arr = ALL.slice().sort(function (a, b) { return (b.photoList[0] ? 1 : 0) - (a.photoList[0] ? 1 : 0); });
    var long = arr.filter(function (l) { return l.stay !== 'short'; }), short = arr.filter(function (l) { return l.stay === 'short'; });
    var by = byArea(long), areas = Object.keys(by).sort(function (a, b) { return by[b].length - by[a].length; }).slice(0, 5);
    var S = [{ id: 'new', label: T('New today'), list: arr.slice().reverse().slice(0, 8), badge: Math.min(8, arr.length) }];
    if (short.length) S.push({ id: 'short', label: T('Short stays'), list: short });
    var cheap = long.filter(function (l) { return V.price(l) <= 30000; }); if (cheap.length) S.push({ id: 'u30', label: T('Under 30k'), list: cheap });
    areas.forEach(function (a) { S.push({ id: 'a-' + a, label: a, list: by[a] }); });
    $('#st-row').innerHTML = S.map(function (x, i) {
      return '<button type="button" class="st' + (s[x.id] ? ' seen' : '') + '" data-i="' + i + '"><span><b style="' + V.photoStyle(x.list[0].photoList[0]) + '"></b>' + (x.badge && !s[x.id] ? '<i>' + x.badge + '</i>' : '') + '</span><em>' + V.esc(x.label) + '</em></button>';
    }).join('');
    $('#st-row').onclick = function (e) {
      var b = e.target.closest('.st'); if (!b) return; var x = S[+b.getAttribute('data-i')];
      var sv = seen(); sv[x.id] = 1; try { localStorage.setItem('vs-seen', JSON.stringify(sv)); } catch (er) {}
      b.classList.add('seen'); V.Reel.open(x.list, { mode: 'story', title: x.label + ' · ' + T(x.list.length === 1 ? '{n} place' : '{n} places', { n: x.list.length }) });
    };
    if (!S.length || !arr.length) $('#st-row').style.display = 'none';
  }
  // ---- top controls ----
  $('#mp-search').addEventListener('click', function () { location.href = 'amina.html'; });
  function seg() { Array.prototype.forEach.call(document.querySelectorAll('#mp-seg [data-stay]'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-stay') === stay)); }); }
  $('#mp-seg').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-all')) { location.href = stay === 'short' ? 'homes.html?stay=short' : 'homes.html'; return; }
    stay = b.getAttribute('data-stay'); try { localStorage.setItem('vs-map-stay', stay); } catch (er) {}
    seg(); sheet(null); draw(); sub();
  });
  function sub() { var n = list().length; $('#mp-sub').textContent = stay === 'short' ? T('{n} short stays on the map · tap an area', { n: n }) : T('{n} homes on the map · tap an area', { n: n }); }
  seg();
  V.loadListings().then(function (all) {
    ALL = all; draw(); stories(); sub();
    var a = new URLSearchParams(location.search).get('area'); if (a && V.AREAS[a]) open(a);
  }).catch(function () { $('#mp-sub').textContent = T('Listings could not load. Please refresh.'); });
});
