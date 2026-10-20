// Viu AI: the guided chat. One question at a time as chat bubbles + quick replies,
// then a reel of matches to swipe (right = keep), then the next step (viewing trip / book stay).
document.addEventListener('DOMContentLoaded', function () {
  var V = window.V, T = V.t, S = window.VSSearch, log = document.getElementById('am-log'), dock = document.getElementById('ai-qr');
  var av = document.getElementById('am-av'); if (av) av.innerHTML = V.sphere(42);
  var wide = window.innerWidth > 900, AV = V.sphere(30, true);
  var A = {}, HOMES = [], loaded = V.loadListings().then(function (all) { HOMES = all; return all; }).catch(function () { return []; });
  var step = -1, waiting = null;
  var q = new URLSearchParams(location.search);
  if (q.get('stay') === 'short' || q.get('stay') === 'long') A.stay = q.get('stay');
  if (q.get('area')) A.area = q.get('area');

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
  function down() { setTimeout(function () { log.scrollTo({ top: log.scrollHeight, behavior: 'smooth' }); }, 30); }
  function clearQR() { dock.innerHTML = ''; }
  function say(text, cb, delay) {
    var t = el('div', 'bb typing', '<i class="bav">' + AV + '</i><span><i></i><i></i><i></i></span>'); log.appendChild(t); down();
    setTimeout(function () { t.remove(); var b = el('div', 'bb', '<i class="bav">' + AV + '</i><span></span>'); b.lastChild.textContent = text; log.appendChild(b); down(); if (cb) cb(); }, delay || 650);
  }
  function me(text) { clearQR(); var b = el('div', 'bb me', '<span></span><i class="mav"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg></i>'); b.firstChild.textContent = text; log.appendChild(b); down(); update(); }
  function replies(opts) {
    clearQR(); var r = el('div', 'qr live');
    opts.forEach(function (o) { var b = el('button', o.cls || ''); b.type = 'button'; b.textContent = o.t; if (o.on) b.setAttribute('aria-pressed', 'true'); b.addEventListener('click', function () { o.fn(b); }); r.appendChild(b); });
    dock.appendChild(r); return r;
  }
  function short() { return A.stay === 'short'; }
  function ask(i) {
    step = i; var s = S.STEPS[i];
    update();
    if (!s) return results();
    if (A[s.k] !== undefined && s.k !== 'when') return ask(i + 1);   // already answered (from the link or typed)
    var qq = T(short() && s.qShort ? s.qShort : s.q); if (log.querySelector('.bb.me')) qq = qq.replace(/^Karibu! /, '');
    say(qq, function () {
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
  // ---------- live results: map on top (phone) or on the right with the list (laptop) ----------
  var map = null, layer = null, ring = null;
  if (wide) document.querySelector('.ai-res').appendChild(document.querySelector('.ai-mapw'));
  if (window.L) {
    map = L.map('ai-map', { zoomControl: false, attributionControl: wide, scrollWheelZoom: false }).setView([-1.287, 36.80], 12); if (wide) L.control.zoom({ position: 'topright' }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 19, attribution: '&copy; OpenStreetMap &copy; CARTO' }).addTo(map);
    layer = L.layerGroup().addTo(map);
  }
  function matches() { var B = Object.assign({}, A); delete B.when; return S.matchList(HOMES, B); }
  function update() {
    loaded.then(function () {
      var m = matches(), n = m.length, started = Object.keys(A).length > 0;
      var t = !started ? T('Answer, or type what you need') : T(n === 1 ? '{n} home matches so far' : '{n} homes match so far', { n: n });
      document.getElementById('ai-count').textContent = t;
      var chips = S.STEPS.map(function (s) { var v = s.k === 'area' && A.area === 'Anywhere' ? T('Anywhere good') : S.label(A, s.k); if (s.k === 'must' && (!A.must || !A.must.length)) v = null; if (s.k === 'when' && A.when === 'Flexible') v = null; return v; }).filter(Boolean);
      document.getElementById('ai-chips').innerHTML = chips.map(function (c) { return '<span>' + V.esc(c) + '</span>'; }).join('');
      document.getElementById('ai-top').classList.toggle('on', started);
      var list = document.getElementById('ai-list');
      if (list) list.innerHTML = started ? (m.slice(0, 12).map(function (l) {
        return '<a class="ai-h" href="' + (l.stay === 'short' ? 'stay.html' : 'home.html') + '?id=' + encodeURIComponent(l.id) + '"><span style="' + V.photoStyle(l.photoList[0]) + '"></span><span><i>✓ ' + V.esc(T('Verified')) + '</i><b>KES ' + V.money(V.price(l)) + ' <small>' + V.esc(V.per(l)) + '</small></b><small>' + V.esc(V.shortDesc(l)) + ' · ' + V.esc(l.area) + '</small></span></a>';
      }).join('') || '<p class="ai-none">' + V.esc(T('Nothing matches yet. Change an answer, or let our team find it.')) + '</p>') : '<p class="ai-none">' + V.esc(T('Homes appear here as you answer.')) + '</p>';
      if (!map) return;
      layer.clearLayers(); if (ring) { map.removeLayer(ring); ring = null; }
      var pts = [];
      m.forEach(function (l) { var p = V.pinPos(l); pts.push(p); L.marker(p, { icon: L.divIcon({ className: '', html: '<span class="pp">' + Math.round(V.price(l) / 1000) + 'k</span>', iconSize: [0, 0] }), interactive: false }).addTo(layer); });
      var ak = A.area && Object.keys(V.AREAS).filter(function (a) { return a.toLowerCase() === String(A.area).toLowerCase(); })[0];
      if (ak) ring = L.circle(V.AREAS[ak], { radius: 1100, color: '#1554D1', weight: 2, dashArray: '7 7', fillColor: '#1554D1', fillOpacity: .07, interactive: false }).addTo(map);
      setTimeout(function () { map.invalidateSize(); var sz = map.getSize(); if (started && pts.length && sz.x > 40 && sz.y > 40) map.flyToBounds(pts, { padding: [36, 36], maxZoom: 15, duration: .7 }); }, 80);
    });
  }
  document.getElementById('ai-see').addEventListener('click', function () { location.href = homesLink(); });
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

  // ---------- typed messages: understand area, size, budget, stay type and must-haves (runs in the browser, free) ----------
  function parse(v) {
    var lc = ' ' + v.toLowerCase().replace(/[,.!?]/g, ' ') + ' ', got = {};
    if (/night|bnb|weekend|few days|short stay|holiday/.test(lc)) got.stay = 'short'; else if (/month|rent|long stay|to live/.test(lc)) got.stay = 'long';
    var areas = {}; HOMES.forEach(function (l) { if (l.area) areas[l.area] = 1; }); Object.keys(V.AREAS).forEach(function (a) { areas[a] = 1; });
    Object.keys(areas).sort(function (a, b) { return b.length - a.length; }).some(function (a) { if (lc.indexOf(' ' + a.toLowerCase()) >= 0) { got.area = a; return true; } });
    if (/bedsitter|studio|single room/.test(lc)) got.beds = '0';
    var bm = lc.match(/(\d|one|two|three|four)\s*-?\s*(bed|br|bedroom|bdrm)/); if (bm) { var w = { one: 1, two: 2, three: 3, four: 4 }[bm[1]] || +bm[1]; got.beds = String(Math.min(3, w)); }
    var km = lc.match(/(under|below|less than|max|up to|budget|around|about)?\s*(?:kes|ksh|sh)?\s*(\d{1,3}(?:[ ,]?\d{3})*|\d+(?:\.\d)?)\s*(k|000|thousand)?\b/g);
    if (km) km.some(function (x) {
      var mm = x.match(/(\d+(?:[ ,]?\d{3})*(?:\.\d)?)\s*(k|000|thousand)?/); if (!mm) return false; var n = parseFloat(mm[1].replace(/[ ,]/g, ''));
      if (mm[2] === 'k' || mm[2] === 'thousand') n *= 1000; else if (mm[2] === '000') n *= 1000;
      if (n < 1000) return false; var lim = Math.round(n);
      got.budget = /around|about/.test(x) ? Math.round(lim * .8) + '-' + Math.round(lim * 1.2) : '0-' + lim; return true;
    });
    var M = [['parking', 'Parking'], ['water', 'Water 24/7'], ['security', 'Security guard'], ['guard', 'Security guard'], ['generator', 'Backup power'], ['backup', 'Backup power'], ['lift', 'Lift'], ['balcony', 'Balcony'], ['furnished', 'Furnished'], ['pet', 'Pet friendly'], ['school', 'Schools nearby']];
    var mu = []; M.forEach(function (x) { if (lc.indexOf(x[0]) >= 0 && mu.indexOf(x[1]) < 0) mu.push(x[1]); }); if (mu.length) got.must = mu.slice(0, 3);
    if (/family|kids|children/.test(lc)) got.who = 'Family with kids'; else if (/couple|wife|husband|partner/.test(lc)) got.who = 'Couple'; else if (/friends|sharing/.test(lc)) got.who = 'Sharing with friends'; else if (/just me|alone|myself/.test(lc)) got.who = 'Just me';
    if (!got.stay && got.budget) { var mx = +got.budget.split('-')[1] || 0; got.stay = mx && mx < 15000 ? 'short' : 'long'; }
    return got;
  }
  document.getElementById('am-form').addEventListener('submit', function (e) {
    e.preventDefault(); var inp = document.getElementById('am-in'), v = inp.value.trim(); if (!v) return; inp.value = '';
    var live = dock.querySelector('.qr.live'), lc = v.toLowerCase();
    if (live && lc.length < 30) { var hit = Array.prototype.filter.call(live.querySelectorAll('button'), function (b) { var t = b.textContent.toLowerCase(); return t === lc || (lc.length > 3 && t.indexOf(lc) >= 0); })[0]; if (hit) { hit.click(); return; } }
    loaded.then(function () {
      var got = parse(v), keys = Object.keys(got);
      me(v);
      if (!keys.length) { say(T('I help with homes in Nairobi. Try something like "a 2 bedroom in Kilimani under 60k with parking", or tap an answer.')); return; }
      if (got.stay && got.stay !== A.stay) { delete A.budget; }
      keys.forEach(function (k) { A[k] = got[k]; });
      var bits = S.STEPS.map(function (s) { return got[s.k] !== undefined ? S.label(A, s.k) : null; }).filter(Boolean);
      clearQR(); say(T('Got it: {x}.', { x: bits.join(' · ') }), function () { if (step < 99) ask(0); else results(); });
    });
  });

  say(T('Hi, I\'m Viu AI 👋 I\'ll find you a verified home in Nairobi in about a minute.'), function () { ask(0); }, 500);
});
