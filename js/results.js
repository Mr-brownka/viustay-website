// v2 results page: matching homes, a quiet "your search" bar that opens a filter sheet, and a pick bar to book.
(function () {
  var V = window.V, S = window.VSSearch, MAX = 3;
  var search = V.getSearch() || {};
  var A = search.chat || fromOld(search);
  var picked = (search.picked || []).slice();
  var HOMES = [];
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; }

  // Searches started on the old flow (or a shared link) have no chat answers: rebuild them.
  function fromOld(s) {
    var a = { stay: s.stay || 'long' };
    if (s.area) a.area = s.area;
    if (s.bedrooms !== undefined && s.bedrooms !== '') a.beds = String(Math.min(3, Number(s.bedrooms)));
    if (s.min || s.max) a.budget = (s.min || 0) + '-' + (s.max || 0);
    if (s.must) a.must = s.must;
    return a;
  }
  function save() { var s = S.toSearch(A); s.picked = picked.slice(); V.setSearch(s); }

  function barText() {
    var p = [];
    if (A.area) p.push(A.area === 'Anywhere' ? 'Anywhere' : A.area);
    if (A.beds !== undefined) p.push(S.label(A, 'beds').replace(' bedrooms', ' bed').replace(' bedroom', ' bed'));
    if (A.budget) { var l = S.label(A, 'budget'); p.push(l.indexOf('Under') === 0 ? l.replace('Under ', 'Under KES ') : 'KES ' + l); }
    if (A.must && A.must.length) p.push(A.must.length === 1 ? A.must[0] : A.must[0] + ' +' + (A.must.length - 1));
    return p.join(' · ') || 'All homes';
  }

  function render() {
    var m = S.matchList(HOMES, A), n = m.length;
    $('r-h').innerHTML = A.stay === 'short' ? 'Short stays are coming soon' : (n ? '<b>' + n + '</b> ' + (n === 1 ? 'home matches' : 'homes match') + ' your search' : 'No exact match yet');
    $('r-bar-txt').textContent = barText();
    var g = $('r-grid'); g.innerHTML = '';
    if (!n) {
      var e = el('div', 'r-none c-glass');
      e.appendChild(el('h2', '', A.stay === 'short' ? "Tell us and we'll find one" : "We haven't listed a home like that yet"));
      e.appendChild(el('p', '', "Loosen a filter, or leave your details and we'll find one for you, usually within 48 hours."));
      var row = el('div', 'actions');
      var a = el('a', 'btn btn-primary btn-pill', 'Find it for me'); a.href = 'request.html';
      var b = el('button', 'btn btn-pill btn-outline', 'Change search'); b.type = 'button'; b.addEventListener('click', openSheet);
      row.appendChild(a); row.appendChild(b); e.appendChild(row); g.appendChild(e);
    }
    m.forEach(function (h, i) {
      var on = picked.indexOf(h.id) >= 0;
      var c = el('article', 'r-card c-glass' + (on ? ' on' : '')); c.style.animationDelay = (i * 60) + 'ms';
      var ph = el('a', 'r-photo' + (h.photoList[0] ? '' : ' empty')); ph.href = 'home.html?id=' + encodeURIComponent(h.id);
      ph.setAttribute('aria-label', 'View ' + h.title);
      if (h.photoList[0]) ph.setAttribute('style', V.photoStyle(h.photoList[0]));
      ph.appendChild(el('span', 'badge', '✓ Verified by Viustay')); c.appendChild(ph);
      var body = el('div', 'r-body');
      var price = el('span', 'r-price', 'KES ' + V.money(h.rent) + ' '); price.appendChild(el('small', '', '/ month')); body.appendChild(price);
      body.appendChild(el('span', 'r-desc', V.typeLabel(h) + ' · ' + h.area + (h.road ? ' · ' + h.road : '')));
      var tags = el('span', 'r-tags'); h.amenityList.slice(0, 3).forEach(function (t) { tags.appendChild(el('span', '', t)); }); body.appendChild(tags);
      var act = el('div', 'r-act'); var d = el('a', '', 'View details'); d.href = 'home.html?id=' + encodeURIComponent(h.id); act.appendChild(d);
      var add = el('button', 'btn r-add'); add.type = 'button';
      function sync() { var o = picked.indexOf(h.id) >= 0; add.textContent = o ? '✓ Added' : 'Add to viewing'; add.setAttribute('aria-pressed', String(o)); c.classList.toggle('on', o); }
      add.addEventListener('click', function () {
        var j = picked.indexOf(h.id);
        if (j >= 0) picked.splice(j, 1);
        else { if (picked.length >= MAX) { if (add.animate) add.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }], { duration: 220 }); return; } picked.push(h.id); }
        sync(); pickbar(); save();
      });
      sync(); act.appendChild(add); body.appendChild(act); c.appendChild(body); g.appendChild(c);
    });
    pickbar();
  }
  function pickbar() {
    var n = picked.length;
    $('r-pick').classList.toggle('show', n > 0);
    $('r-picktxt').textContent = n + ' of ' + MAX + ' homes picked';
    $('r-dots').innerHTML = [0, 1, 2].map(function (i) { return '<i class="' + (i < n ? 'f' : '') + '"></i>'; }).join('');
  }

  // ---------- filter sheet ----------
  var lastFocus = null;
  function openSheet() { lastFocus = document.activeElement; build(); $('r-scrim').classList.add('open'); $('r-sheet').classList.add('open'); setTimeout(function () { $('r-done').focus(); }, 300); }
  function closeSheet() { $('r-scrim').classList.remove('open'); $('r-sheet').classList.remove('open'); if (lastFocus) lastFocus.focus(); }
  function count() { var n = S.matchList(HOMES, A).length; $('r-done').textContent = A.stay === 'short' ? 'Done' : (n ? 'Show ' + n + (n === 1 ? ' home' : ' homes') : 'Show results'); }
  function build() {
    var body = $('r-sheet-body'); body.innerHTML = '';
    S.STEPS.forEach(function (s) {
      var g = el('div', 'r-group'); g.appendChild(el('b', '', S.NAMES[s.k])); var chips = el('div', 'chips');
      var opts = s.o ? s.o.map(function (o) { return [o[0], o[1] || o[0]]; }) : s.type === 'budget' ? S.BUDGETS[A.stay || 'long'].map(function (o) { return [o[0], o[1]]; }) : S.WHEN.map(function (w) { return [w, w]; });
      if (s.type === 'budget' && A.budget && !opts.some(function (o) { return o[0] === A.budget; })) opts.unshift([A.budget, S.label(A, 'budget')]);
      if (s.type === 'when' && A.when && !opts.some(function (o) { return o[0] === A.when; })) opts.unshift([A.when, A.when]);
      if (s.k === 'area' && A.area && !opts.some(function (o) { return o[0] === A.area; })) opts.unshift([A.area, A.area]);
      function isOn(v) { return s.type === 'many' ? (A[s.k] || []).indexOf(v) >= 0 : A[s.k] === v; }
      opts.forEach(function (o) {
        var c = el('button', 'chip', o[1]); c.type = 'button'; c.setAttribute('aria-pressed', String(isOn(o[0])));
        c.addEventListener('click', function () {
          if (s.type === 'many') {
            var arr = (A[s.k] || []).slice(), j = arr.indexOf(o[0]);
            if (j >= 0) arr.splice(j, 1); else { if (arr.length >= s.max) return; arr.push(o[0]); }
            A[s.k] = arr;
          } else if (s.k !== 'stay' && A[s.k] === o[0] && s.k !== 'who' && s.k !== 'when') {
            delete A[s.k];  // tap again to clear area / bedrooms / budget
          } else {
            A[s.k] = o[0];
            if (s.k === 'stay') { delete A.budget; build(); }
          }
          Array.prototype.forEach.call(chips.children, function (x, j) { x.setAttribute('aria-pressed', String(isOn(opts[j][0]))); });
          count(); render(); save();
        });
        chips.appendChild(c);
      });
      g.appendChild(chips); body.appendChild(g);
    });
    count();
  }

  $('r-bar').addEventListener('click', openSheet);
  $('r-scrim').addEventListener('click', closeSheet);
  $('r-done').addEventListener('click', closeSheet);
  $('r-reset').addEventListener('click', function () { delete A.area; delete A.beds; delete A.budget; A.must = []; build(); render(); save(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && $('r-sheet').classList.contains('open')) closeSheet(); });
  $('r-book').addEventListener('click', function () { save(); });

  V.loadListings().then(function (all) { HOMES = all; picked = picked.filter(function (id) { return all.some(function (h) { return h.id === id; }); }); render(); })
    .catch(function () { $('r-h').textContent = 'Listings could not load. Please refresh.'; });
})();
