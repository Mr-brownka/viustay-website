// Viu AI: the guided chat. One question at a time as chat bubbles + quick replies,
// then a reel of matches to swipe (right = keep), then the next step (viewing trip / book stay).
document.addEventListener('DOMContentLoaded', function () {
  var V = window.V, T = V.t, S = window.VSSearch, log = document.getElementById('am-log');
  var av = document.getElementById('am-av'); if (av) av.innerHTML = V.sphere(42);
  var mapCard = null;
  var A = {}, HOMES = [], loaded = V.loadListings().then(function (all) { HOMES = all; return all; }).catch(function () { return []; });
  var step = -1, waiting = null;
  var q = new URLSearchParams(location.search);
  if (q.get('stay') === 'short' || q.get('stay') === 'long') A.stay = q.get('stay');
  if (q.get('area')) A.area = q.get('area');

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
  function down() { setTimeout(function () { window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); }, 30); }
  function clearQR() { Array.prototype.forEach.call(log.querySelectorAll('.qr.live'), function (x) { x.remove(); }); }
  function say(text, cb, delay) {
    var t = el('div', 'bb typing', '<span><i></i><i></i><i></i></span>'); log.appendChild(t); down();
    setTimeout(function () { t.remove(); var b = el('div', 'bb', '<span></span>'); b.firstChild.textContent = text; log.appendChild(b); down(); if (cb) cb(); }, delay || 650);
  }
  function me(text) { clearQR(); var b = el('div', 'bb me', '<span></span>'); b.firstChild.textContent = text; log.appendChild(b); down(); }
  function replies(opts) {
    var r = el('div', 'qr live');
    opts.forEach(function (o) { var b = el('button', o.cls || ''); b.type = 'button'; b.textContent = o.t; if (o.on) b.setAttribute('aria-pressed', 'true'); b.addEventListener('click', function () { o.fn(b); }); r.appendChild(b); });
    log.appendChild(r); down(); return r;
  }
  function short() { return A.stay === 'short'; }
  function ask(i) {
    step = i; var s = S.STEPS[i];
    if (i > 1) liveMap();
    if (!s) return results();
    if (A[s.k] !== undefined && s.k !== 'when' && i < 2 && (s.k === 'stay' || s.k === 'area')) return ask(i + 1);   // came with ?stay= / ?area=
    say(T(short() && s.qShort ? s.qShort : s.q), function () {
      if (s.type === 'one') replies(s.o.map(function (o) { return { t: T(o[1] || o[0]), fn: function () { if (s.k === 'stay' && A.stay !== o[0]) { delete A.budget; delete A.when; } A[s.k] = o[0]; me(T(o[1] || o[0])); ask(i + 1); } }; }));
      else if (s.type === 'budget') replies(S.BUDGETS[A.stay || 'long'].map(function (o) { return { t: o[1].replace('Under ', T('Under') + ' '), fn: function () { A.budget = o[0]; me(o[1].replace('Under ', T('Under') + ' ') + ' ' + (short() ? T('per night') : T('per month'))); ask(i + 1); } }; }).concat([{ t: T('Any budget'), cls: 'ghost', fn: function () { delete A.budget; me(T('Any budget')); ask(i + 1); } }]));
      else if (s.type === 'many') {
        var pick = [];
        var r = replies(s.o.map(function (o) { return { t: T(o[0]), fn: function (b) { var j = pick.indexOf(o[0]); if (j >= 0) pick.splice(j, 1); else if (pick.length < s.max) pick.push(o[0]); b.setAttribute('aria-pressed', String(pick.indexOf(o[0]) >= 0)); go.textContent = pick.length ? T('Continue with {n}', { n: pick.length }) : T('Skip'); } }; }));
        var go = el('button', 'go'); go.type = 'button'; go.textContent = T('Skip');
        go.addEventListener('click', function () { A.must = pick.slice(); me(pick.length ? pick.map(T).join(', ') : T('No preference')); ask(i + 1); });
        r.appendChild(go);
      } else if (s.type === 'when') when(i);
    });
  }
  function when(i) {
    var card = el('div', 'am-card'), skip = { t: short() ? T('Not sure of my dates yet') : T('Not sure yet'), cls: 'ghost', fn: function () { card.remove(); A.when = 'Flexible'; me(T('Not sure yet')); ask(i + 1); } };
    if (!short()) {
      card.appendChild(el('span', 'k', V.esc(T('Move-in day'))));
      card.appendChild(S.calendar({ mode: 'single', start: A.when_iso, onPick: function (a) { S.setWhen(A, a); card.remove(); me(A.when); ask(i + 1); } }));
      log.appendChild(card); replies([skip]); return;
    }
    var ci = null;
    function inCal() {
      card.innerHTML = ''; card.appendChild(el('span', 'k', V.esc(T('CHECK-IN'))));
      card.appendChild(S.calendar({ mode: 'single', note: T('Tap the day you arrive'), onPick: function (a) { ci = a; outCal(); } }));
    }
    function outCal() {
      var d = new Date(ci + 'T00:00:00'); d.setDate(d.getDate() + 1);
      var min = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      card.innerHTML = ''; var k = el('span', 'k', V.esc(T('CHECK-IN')) + ' · ' + V.esc(V.date(ci, { weekday: 'short', day: 'numeric', month: 'short' })) + ' ✓ &nbsp;→&nbsp; ' + V.esc(T('CHECK-OUT')));
      card.appendChild(k);
      var c = S.calendar({ mode: 'single', min: min, mark: ci, note: T('Tap the day you leave'), onPick: function (b) { S.setWhen(A, ci, b); card.remove(); me(A.when); ask(i + 1); } });
      c.classList.add('dt-slide'); card.appendChild(c);
    }
    inCal(); log.appendChild(card); down(); replies([skip]);
  }
  // a small live map inside the chat: shows the chosen area, pins shrink as answers narrow it down
  function liveMap() {
    if (!window.L || !A.area || A.area === 'Anywhere' || !V.AREAS[A.area]) return;
    loaded.then(function () {
      var B = Object.assign({}, A); delete B.when; var m = S.matchList(HOMES, B), inArea = HOMES.filter(function (l) { return l.area === A.area && (l.stay === 'short') === short(); });
      if (!mapCard) {
        var w = el('div', 'bb'); w.style.display = 'block';
        w.innerHTML = '<div class="am-map"><div class="am-map-m"></div><div class="am-map-t"></div></div>'; log.appendChild(w); down();
        var box = w.querySelector('.am-map-m');
        var map = L.map(box, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, keyboard: false }).setView(V.AREAS[A.area], 14);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 19 }).addTo(map);
        L.circle(V.AREAS[A.area], { radius: 900, color: '#1554D1', weight: 2, dashArray: '6 6', fillOpacity: .07 }).addTo(map);
        mapCard = { w: w, map: map, layer: L.layerGroup().addTo(map) };
        w.querySelector('.am-map').addEventListener('click', function () { location.href = homesLink(); });
      }
      mapCard.layer.clearLayers();
      m.filter(function (l) { return l.area === A.area; }).forEach(function (l) {
        mapCard.layer.addLayer(L.marker(V.pinPos(l), { icon: L.divIcon({ className: '', html: '<span class="pp">' + Math.round(V.price(l) / 1000) + 'k</span>', iconSize: [0, 0] }), interactive: false }));
      });
      var n = m.filter(function (l) { return l.area === A.area; }).length;
      mapCard.w.querySelector('.am-map-t').innerHTML = '<b>' + V.esc(T(n === 1 ? '{a} has {n} match so far' : '{a} has {n} matches so far', { a: A.area, n: n })) + '</b> <span>' + V.esc(T('of {n} verified places', { n: inArea.length })) + ' · ' + V.esc(T('Tap to see them on the map')) + '</span>';
    });
  }
  function homesLink() {
    var p = new URLSearchParams(); if (short()) p.set('stay', 'short'); if (A.area && A.area !== 'Anywhere') p.set('area', A.area); if (A.beds !== undefined && A.beds !== '') p.set('beds', A.beds);
    if (A.budget) { var b = A.budget.split('-').map(Number); if (b[1]) p.set('max', b[1]); }
    return 'homes.html' + (p.toString() ? '?' + p : '');
  }
  function results() {
    step = 99; var s = S.toSearch(A); V.setSearch(Object.assign({}, V.getSearch() || {}, s, { picked: V.TripBasket.ids(), fromResults: true }));
    say(T('Give me a second, checking verified homes…'), function () {
      loaded.then(function () {
        var m = S.matchList(HOMES, A), close = false;
        if (!m.length) { var B = Object.assign({}, A); delete B.must; delete B.budget; m = S.matchList(HOMES, B); close = true; }
        if (!m.length) { var C = { stay: A.stay }; m = S.matchList(HOMES, C).slice(0, 8); }
        if (!m.length) {
          say(T('Nothing matches yet. Tell me what you need and our team will find it for you.'), function () { replies([{ t: T('Find it for me'), cls: 'go', fn: function () { location.href = 'request.html'; } }, { t: T('Start over'), cls: 'ghost', fn: restart }]); });
          return;
        }
        var msg = close ? T('No exact match, but these {n} are close.', { n: m.length }) : T(short() ? 'I found {n} stays for you.' : 'I found {n} homes for you.', { n: m.length });
        say(msg + ' ' + T('Watch them and swipe right on the ones you like.'), function () { reelCard(m); }, 900);
      });
    }, 500);
  }
  function reelCard(m) {
    var b = el('button', 'am-reel'); b.type = 'button';
    b.setAttribute('style', V.photoStyle(m[0].photoList[0]));
    b.innerHTML = '<span class="faces">' + m.slice(1, 4).map(function (l) { return '<i style="' + V.photoStyle(l.photoList[0]) + '"></i>'; }).join('') + '</span><span class="play">▶</span><span class="cap"><b>' + V.esc(T(short() ? (m.length === 1 ? '{n} stay for you' : '{n} stays for you') : (m.length === 1 ? '{n} home for you' : '{n} homes for you'), { n: m.length })) + '</b><small>' + V.esc(T('Tap to watch · swipe right to keep')) + '</small></span>';
    b.addEventListener('click', function () { V.Reel.open(m, { mode: 'swipe', onDone: function (kept) { picked(kept, m); } }); });
    var w = el('div', 'bb'); w.appendChild(b); w.style.display = 'block'; log.appendChild(w); down();
    replies([{ t: T('See them on the map'), cls: 'ghost', fn: function () { location.href = homesLink(); } }, { t: T('Start over'), cls: 'ghost', fn: restart }]);
  }
  function picked(kept, all) {
    clearQR();
    if (!kept.length) { say(T('None caught your eye? No problem.'), function () { replies([{ t: T('Watch again'), cls: 'go', fn: function () { me(T('Watch again')); V.Reel.open(all, { mode: 'swipe', onDone: function (k) { picked(k, all); } }); } }, { t: T('Change my answers'), cls: 'ghost', fn: restart }, { t: T('See them on the map'), cls: 'ghost', fn: function () { location.href = homesLink(); } }]); }); return; }
    me(T(kept.length === 1 ? 'Kept {n} home' : 'Kept {n} homes', { n: kept.length }) + ' ♥');
    var strip = el('div', 'am-kept');
    strip.innerHTML = kept.map(function (l) { return '<a href="' + (l.stay === 'short' ? 'stay.html' : 'home.html') + '?id=' + encodeURIComponent(l.id) + '"><span style="' + V.photoStyle(l.photoList[0]) + '"></span><b>KES ' + V.money(V.price(l)) + '</b><small>' + V.esc(V.shortDesc(l) + ' · ' + l.area) + '</small></a>'; }).join('');
    if (short()) {
      say(T('Lovely choices. Pick one to book. You pay with M-Pesa and get your ticket right away.'), function () {
        log.appendChild(strip);
        replies(kept.slice(0, 3).map(function (l) { return { t: T('Book') + ' · ' + l.area + ' · KES ' + V.money(V.price(l)), cls: 'go', fn: function () { location.href = 'stay.html?id=' + encodeURIComponent(l.id); } }; }).concat([{ t: T('Start over'), cls: 'ghost', fn: restart }]));
      });
      return;
    }
    var ids = kept.slice(0, V.TripBasket.MAX).map(function (l) { return l.id; });
    var s = V.getSearch() || {}; s.picked = ids; V.setSearch(s); V.TripBasket.set(ids);
    say(kept.length > V.TripBasket.MAX ? T('You kept {n}. I put your first 3 in one viewing trip.', { n: kept.length }) : T('Great picks! I can take you to see them in one trip, with a car and a guide.'), function () {
      log.appendChild(strip);
      replies([{ t: T('Plan my viewing trip'), cls: 'go', fn: function () { location.href = 'book.html'; } }, { t: T('See them on the map'), cls: 'ghost', fn: function () { location.href = homesLink(); } }, { t: T('Start over'), cls: 'ghost', fn: restart }]);
    });
  }
  function restart() { me(T('Start over')); A = {}; say(T('Okay, let\'s start again.'), function () { ask(0); }, 400); }

  // typed messages: match an option, an area name, or nudge to the buttons
  document.getElementById('am-form').addEventListener('submit', function (e) {
    e.preventDefault(); var inp = document.getElementById('am-in'), v = inp.value.trim(); if (!v) return; inp.value = '';
    var live = log.querySelector('.qr.live'), lc = v.toLowerCase();
    if (live) { var hit = Array.prototype.filter.call(live.querySelectorAll('button'), function (b) { return b.textContent.toLowerCase().indexOf(lc) >= 0 || lc.indexOf(b.textContent.toLowerCase()) >= 0; })[0]; if (hit) { hit.click(); return; } }
    var area = Object.keys(V.AREAS).filter(function (a) { return lc.indexOf(a.toLowerCase()) >= 0; })[0];
    if (area && step <= 1) { A.area = area; if (lc.indexOf('night') >= 0 || lc.indexOf('short') >= 0) A.stay = 'short'; me(v); ask(step < 0 ? 0 : step + 1); return; }
    me(v); say(T('Got it! Tap one of the options above and I\'ll keep going.'));
  });

  say(T('Hi, I\'m Viu AI 👋 I\'ll find you a verified home in Nairobi in about a minute.'), function () { ask(0); }, 500);
});
