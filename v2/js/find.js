// Guided search as swipe cards: one question per card, an animated progress bar, then a summary card
// with a map and "Find my homes". On a laptop the map sits on the right and updates as you answer.
document.addEventListener('DOMContentLoaded', function () {
  var V = window.V, T = V.t, S = window.VSSearch, $ = V.$;
  var q = new URLSearchParams(location.search), A = {}, HOMES = [], must = [];
  if (q.get('stay') === 'short' || q.get('stay') === 'long') A.stay = q.get('stay');
  var STEPS = S.STEPS.filter(function (s) { return !(s.k === 'stay' && A.stay); });
  var N = STEPS.length, cur = 0, wide = window.innerWidth > 900, stack = $('#gx-stack');
  var KICK = { stay: 'Type of stay', area: 'Location', beds: 'Size', budget: 'Budget', must: 'Must-haves', who: 'Household', when: 'Dates' };
  function short() { return A.stay === 'short'; }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
  function title() { $('#gx-title').textContent = short() ? T('Stay a few nights') : (A.stay ? T('Monthly rent') : T('Find a home')); $('#gx-sub').textContent = T('Guided search'); }

  // ---------- progress ----------
  function progress() {
    var done = Math.min(cur, N);
    $('#gx-bar').style.width = Math.max(4, Math.round(done / N * 100)) + '%';
    $('#gx-step').textContent = cur >= N ? T('All set') : T('Question {a} of {b}', { a: cur + 1, b: N });
    $('#gx-dots').innerHTML = STEPS.map(function (s, i) { return '<i class="' + (i < cur ? 'gx-d1' : i === cur ? 'gx-d2' : '') + '"></i>'; }).join('');
    $('#gx-back').hidden = cur === 0;
  }

  // ---------- one card per question ----------
  function option(label, on, sub) {
    var b = el('button', 'gx-opt' + (on ? ' on' : '')); b.type = 'button';
    b.innerHTML = '<span><b></b>' + (sub ? '<small></small>' : '') + '</span><i></i>';
    b.querySelector('b').textContent = label; if (sub) b.querySelector('small').textContent = sub;
    return b;
  }
  function card(i) {
    var s = STEPS[i], c = el('div', 'gx-card');
    var head = '<div class="gx-kick"><span>' + V.esc(T(KICK[s.k] || '')) + '</span><span>' + V.esc(T('Question {a} of {b}', { a: i + 1, b: N })) + '</span></div><h2></h2><p class="gx-p"></p>';
    c.innerHTML = head;
    c.querySelector('h2').textContent = s.k === 'stay' ? T('Monthly rent, or stay a few nights?') : T(short() && s.qShort ? s.qShort : s.q).replace(/^Karibu! /, '');
    var sub = { stay: 'You can change this later.', area: 'Pick an area, or type one.', beds: 'Bedsitters and studios count too.', budget: short() ? 'Per night, in Kenyan shillings.' : 'Per month, in Kenyan shillings.', must: 'Pick up to 3, or skip.', who: 'So we match the right size.', when: short() ? 'Tap your check-in day.' : 'Tap the day you would like to move in.' }[s.k];
    c.querySelector('.gx-p').textContent = T(sub || '');
    var box = el('div', 'gx-opts');
    if (s.type === 'one') {
      if (s.o.length > 5) box.classList.add('two');
      s.o.forEach(function (o) {
        var lab = T(o[1] || o[0]); if (o[0] === 'Anywhere') lab = T('Anywhere good');
        var b = option(lab, A[s.k] === o[0], o[2] ? T(o[2]) : '');
        b.addEventListener('click', function () { if (s.k === 'stay' && A.stay !== o[0]) { delete A.budget; delete A.when; } A[s.k] = o[0]; b.classList.add('on'); answered(); setTimeout(function () { go(i + 1); }, 260); });
        box.appendChild(b);
      });
      c.appendChild(box);
      if (s.k === 'area') {
        var f = el('form', 'gx-type', '<input placeholder="' + V.esc(T('Or type an area, e.g. Upper Hill')) + '" list="gx-areas" aria-label="' + V.esc(T('Type an area')) + '"><datalist id="gx-areas"></datalist><button type="submit">' + V.esc(T('Use')) + '</button>');
        f.addEventListener('submit', function (e) { e.preventDefault(); var v = f.querySelector('input').value.trim(); if (!v) return; A.area = v; answered(); go(i + 1); });
        c.appendChild(f); areasList(f.querySelector('datalist'));
      }
    } else if (s.type === 'budget') {
      S.BUDGETS[A.stay || 'long'].forEach(function (o) {
        var b = option(o[1].replace('Under ', T('Under') + ' '), A.budget === o[0], short() ? T('per night') : T('per month'));
        b.addEventListener('click', function () { A.budget = o[0]; b.classList.add('on'); answered(); setTimeout(function () { go(i + 1); }, 260); });
        box.appendChild(b);
      });
      var any = option(T('Any budget'), A.budget === '', '');
      any.addEventListener('click', function () { A.budget = ''; any.classList.add('on'); answered(); setTimeout(function () { go(i + 1); }, 260); });
      box.appendChild(any); c.appendChild(box);
    } else if (s.type === 'many') {
      box.classList.add('two');
      var goBtn = el('button', 'gx-go'); goBtn.type = 'button';
      function sync() { goBtn.textContent = must.length ? T('Continue with {n}', { n: must.length }) : T('Skip'); }
      s.o.forEach(function (o) {
        var b = option(T(o[0]), must.indexOf(o[0]) >= 0, '');
        b.addEventListener('click', function () { var j = must.indexOf(o[0]); if (j >= 0) must.splice(j, 1); else if (must.length < (s.max || 3)) must.push(o[0]); else return; b.classList.toggle('on', must.indexOf(o[0]) >= 0); A.must = must.slice(); sync(); answered(); });
        box.appendChild(b);
      });
      sync(); goBtn.addEventListener('click', function () { A.must = must.slice(); go(i + 1); });
      c.appendChild(box); c.appendChild(goBtn);
    } else if (s.type === 'when') {
      var wrap = el('div', 'gx-cal'); c.appendChild(wrap);
      var skip = el('button', 'gx-skip', V.esc(short() ? T('Not sure of my dates yet') : T('Not sure yet'))); skip.type = 'button';
      skip.addEventListener('click', function () { delete A.checkin; delete A.checkout; delete A.when_iso; A.when = 'Flexible'; go(i + 1); });
      if (!short()) {
        wrap.appendChild(S.calendar({ mode: 'single', start: A.when_iso, onPick: function (a) { S.setWhen(A, a); go(i + 1); } }));
      } else {
        var ci = A.checkin || null;
        var inCal = function () { wrap.innerHTML = ''; c.querySelector('.gx-p').textContent = T('Tap your check-in day.'); wrap.appendChild(S.calendar({ mode: 'single', start: ci, note: T('Tap the day you arrive'), onPick: function (a) { ci = a; outCal(); } })); };
        var outCal = function () {
          var d = new Date(ci + 'T00:00:00'); d.setDate(d.getDate() + 1);
          var min = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
          wrap.innerHTML = ''; c.querySelector('.gx-p').innerHTML = '<b>' + V.esc(T('CHECK-IN')) + ' ✓ ' + V.esc(V.date(ci, { weekday: 'short', day: 'numeric', month: 'short' })) + '</b> · ' + V.esc(T('now tap your check-out day.'));
          var cal = S.calendar({ mode: 'single', min: min, mark: ci, note: T('Tap the day you leave'), onPick: function (b) { S.setWhen(A, ci, b); go(i + 1); } });
          cal.classList.add('dt-slide'); wrap.appendChild(cal);
        };
        inCal();
      }
      c.appendChild(skip);
    }
    if (s.type === 'one' || s.type === 'budget') c.appendChild(el('p', 'gx-hint', V.esc(T('Tap an answer · the card moves on by itself'))));
    return c;
  }

  // ---------- summary card ----------
  function link() {
    var p = new URLSearchParams(); if (short()) p.set('stay', 'short'); if (A.area && A.area !== 'Anywhere') p.set('area', A.area);
    if (A.beds !== undefined && A.beds !== '') p.set('beds', A.beds);
    if (A.budget) { var b = A.budget.split('-').map(Number); if (b[1]) p.set('max', b[1]); }
    return 'homes.html' + (p.toString() ? '?' + p : '');
  }
  function summary() {
    var m = matches(), n = m.length, c = el('div', 'gx-card gx-sum');
    var rows = S.STEPS.map(function (s) {
      var v = s.k === 'area' && A.area === 'Anywhere' ? T('Anywhere good') : S.label(A, s.k);
      if (s.k === 'budget' && A.budget === '') v = T('Any budget');
      var idx = STEPS.indexOf(s);
      return '<div class="gx-row"><span>' + V.esc(S.name(s.k)) + '</span><b>' + V.esc(v || '–') + '</b>' + (idx >= 0 ? '<button type="button" data-edit="' + idx + '">' + V.esc(T('Edit')) + '</button>' : '<button type="button" data-restay>' + V.esc(T('Change')) + '</button>') + '</div>';
    }).join('');
    c.innerHTML = (wide ? '' : '<div class="gx-summap" id="gx-summap"><span class="gx-cnt"></span></div>') +
      '<div class="gx-sumh"><div class="gx-kick"><span>' + V.esc(T('Your search')) + '</span><span></span></div><h2>' + V.esc(T('Here is what you chose')) + '</h2><p class="gx-p">' + V.esc(T(n === 1 ? '{n} home matches' : '{n} homes match', { n: n })) + (A.area && A.area !== 'Anywhere' ? ' · ' + V.esc(A.area) : '') + '</p></div>' +
      '<div class="gx-rows">' + rows + '</div>' +
      (n ? '<a class="gx-find" id="gx-find" href="' + link() + '">' + V.esc(T('Find my homes')) + ' <svg viewBox="0 0 24 24"><path d="M4 12h15M13 6l6 6-6 6"/></svg></a>' :
        '<a class="gx-find" href="request.html">' + V.esc(T('Find it for me')) + '</a><p class="gx-hint">' + V.esc(T('Nothing matches yet. Change an answer, or let our team find it.')) + '</p>');
    c.addEventListener('click', function (e) {
      var b = e.target.closest('[data-edit]'); if (b) { go(+b.getAttribute('data-edit')); return; }
      if (e.target.closest('[data-restay]')) { location.href = 'find.html?stay=' + (short() ? 'long' : 'short'); return; }
      if (e.target.closest('#gx-find')) { var s = S.toSearch(A); s.picked = V.TripBasket ? V.TripBasket.ids() : []; V.setSearch(s); }
    });
    return c;
  }

  // ---------- swipe between cards ----------
  var front = null;
  function go(i, back) {
    var dir = back || i < cur ? 'back' : 'fwd';
    cur = Math.max(0, Math.min(N, i));
    var next = cur >= N ? summary() : card(cur);
    next.classList.add(dir === 'fwd' ? 'enter' : 'enter-back');
    if (front) { var old = front; old.classList.add(dir === 'fwd' ? 'out' : 'out-back'); setTimeout(function () { old.remove(); }, 600); }
    stack.appendChild(next); front = next;
    requestAnimationFrame(function () { requestAnimationFrame(function () { next.classList.remove('enter', 'enter-back'); }); });
    progress(); title(); answered();
    if (cur >= N && !wide) setTimeout(function () { mountMap($('#gx-summap')); }, 80);
    stack.classList.toggle('sum', cur >= N);
  }
  $('#gx-back').addEventListener('click', function () { if (cur > 0) go(cur - 1, true); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && cur > 0) go(cur - 1, true); });

  // ---------- data + map ----------
  function matches() { var B = Object.assign({}, A); delete B.when; return S.matchList(HOMES, B); }
  function areasList(dl) { var seen = {}; HOMES.forEach(function (l) { if (l.area) seen[l.area] = 1; }); Object.keys(V.AREAS).forEach(function (a) { seen[a] = 1; }); dl.innerHTML = Object.keys(seen).sort().map(function (a) { return '<option value="' + V.esc(a) + '">'; }).join(''); }
  var map = null, layer = null, ring = null;
  function mountMap(box) {
    if (!window.L || !box) return;
    if (map) { map.remove(); map = null; }
    var m = el('div', 'gx-mapbox'); box.insertBefore(m, box.firstChild);
    map = L.map(m, { zoomControl: false, attributionControl: wide, scrollWheelZoom: false }).setView([-1.287, 36.80], 12); if (wide) L.control.zoom({ position: 'topright' }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 19, attribution: '&copy; OpenStreetMap &copy; CARTO' }).addTo(map);
    layer = L.layerGroup().addTo(map); answered();
  }
  function answered() {
    var m = matches(), n = m.length;
    var live = $('#gx-live'); if (live) live.innerHTML = '<b>' + V.esc(cur === 0 && !A.area ? T('Pick an area to start') : T(n === 1 ? '{n} home matches so far' : '{n} homes match so far', { n: n })) + '</b><small>' + V.esc(T('The map updates as you answer')) + '</small>';
    var cnt = document.querySelector('.gx-cnt'); if (cnt) cnt.textContent = T(n === 1 ? '{n} home matches' : '{n} homes match', { n: n });
    if (!map) return;
    layer.clearLayers(); if (ring) { map.removeLayer(ring); ring = null; }
    var pool = HOMES.filter(function (l) { return (l.stay === 'short') === short(); }), ids = {}; m.forEach(function (l) { ids[l.id] = 1; });
    var pts = [];
    pool.forEach(function (l) {
      var on = !!ids[l.id]; if (!on && !wide) return;
      var p = V.pinPos(l); if (on) pts.push(p);
      L.marker(p, { icon: L.divIcon({ className: '', html: '<span class="pp' + (on ? '' : ' off') + '">' + Math.round(V.price(l) / 1000) + 'k</span>', iconSize: [0, 0] }), interactive: false, zIndexOffset: on ? 100 : 0 }).addTo(layer);
    });
    var area = A.area && V.AREAS[Object.keys(V.AREAS).filter(function (a) { return a.toLowerCase() === String(A.area).toLowerCase(); })[0]];
    if (area) ring = L.circle(area, { radius: 1100, color: '#1554D1', weight: 2, dashArray: '7 7', fillColor: '#1554D1', fillOpacity: .07, interactive: false }).addTo(map);
    setTimeout(function () { map.invalidateSize(); var sz = map.getSize(); if (sz.x < 40 || sz.y < 40) return; if (pts.length) map.flyToBounds(pts, { padding: [50, 50], maxZoom: 15, duration: .8 }); else if (area) map.flyTo(area, 14, { duration: .8 }); }, 80);
  }
  if (wide) mountMap($('#gx-side')); else $('#gx-side').style.display = 'none';
  title(); go(0);
  V.loadListings().then(function (all) { HOMES = all; answered(); var dl = document.getElementById('gx-areas'); if (dl) areasList(dl); }).catch(function () {});
});
