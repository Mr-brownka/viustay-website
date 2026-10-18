// Home page (item 24): two big doors (Rent a home / Short stay) + "Help me choose", which opens the guided questions.
(function () {
  var V = window.V, T = V.t, root = document.documentElement;
  var prev = V.getSearch() || {};
  var ask = /#ask/.test(location.hash) || !!(prev.chat && (prev.fromResults || Object.keys(prev.chat).length > 1));
  function mode(a) {
    document.body.classList.toggle('home-ask', a); document.body.classList.toggle('home-doors', !a);
    if (a && location.hash !== '#ask') history.replaceState(null, '', '#ask');
    if (!a && location.hash === '#ask') history.replaceState(null, '', location.pathname + location.search);
  }
  mode(ask);
  document.addEventListener('DOMContentLoaded', function () {
    var help = V.$('#d-help') || V.$('#d-search'), back = V.$('#d-back');
    if (help) help.addEventListener('click', function () { mode(true); window.scrollTo(0, 0); var q = V.$('#c-chat button'); if (q) q.focus({ preventScroll: true }); });
    // Both doors go straight to "Where in Nairobi…?" with the kind of stay already chosen, then the questions continue
    [['#d-rent', 'long'], ['#d-stay', 'short']].forEach(function (d) {
      var door = V.$(d[0]);
      if (door) door.addEventListener('click', function (e) {
        e.preventDefault(); mode(true); window.scrollTo(0, 0);
        if (window.VSChat) window.VSChat.preset({ stay: d[1] });
      });
    });
    if (back) back.addEventListener('click', function () { mode(false); window.scrollTo(0, 0); });
    window.addEventListener('hashchange', function () { mode(/#ask/.test(location.hash)); });
    // Header "Help me choose" on this page opens the questions instead of reloading
    V.$$('a[href="index.html#ask"]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); mode(true); window.scrollTo(0, 0); }); });
    V.loadListings().then(function (all) {
      var lo = all.filter(function (l) { return l.stay !== 'short'; }).length, sh = all.length - lo;
      if (lo) V.$('#d-long').textContent = T(lo === 1 ? '{n} home now' : '{n} homes now', { n: lo });
      if (sh) V.$('#d-short').textContent = T(sh === 1 ? '{n} place now' : '{n} places now', { n: sh });
      if (all.length) V.$('#hi-live').textContent = T('{a} homes · {b} short stays live now', { a: lo, b: sh });
      ['#hi-live', '#d-long', '#d-short'].forEach(function (s) { if (V.countUp) V.countUp(V.$(s)); });
      // Popular areas (most homes first), each tile uses a real photo from that area when there is one
      var by = {};
      all.forEach(function (l) { if (!l.area) return; (by[l.area] = by[l.area] || []).push(l); });
      var areas = Object.keys(by).sort(function (a, b) { return by[b].length - by[a].length; }).slice(0, 8);
      if (areas.length) {
        V.$('#hx-areas').innerHTML = areas.map(function (a, i) {
          var ph = (by[a].filter(function (l) { return l.photoList[0]; })[0] || {}).photoList;
          return '<a class="area-tile' + (ph ? '' : ' g' + (i % 3 + 1)) + '" href="homes.html?area=' + encodeURIComponent(a) + '" style="' + (ph ? V.photoStyle(ph[0]) : '') + '"><span><b>' + V.esc(a) + '</b><small>' + V.esc(T(by[a].length === 1 ? '{n} place' : '{n} places', { n: by[a].length })) + '</small></span></a>';
        }).join('');
        V.$('#home-areas').hidden = false;
      }
      // Fresh on Viustay: homes with photos first, newest rows of the sheet first
      var fresh = all.slice().reverse().sort(function (a, b) { return (b.photoList[0] ? 1 : 0) - (a.photoList[0] ? 1 : 0); }).slice(0, 8);
      var art = all.filter(function (l) { return l.photoList[0]; }).slice(0, 3);
      if (art.length === 3) V.$('#hero-art').innerHTML = art.map(function (l, i) { return '<a class="ha ha' + i + '" href="home.html?id=' + encodeURIComponent(l.id) + '" tabindex="-1" style="' + V.photoStyle(l.photoList[0]) + '"><span>' + V.esc(l.area) + ' · KES ' + V.money(V.price(l)) + '</span></a>'; }).join('') + '<span class="ha-badge"><b>✓</b>' + V.esc(T('Verified by Viustay')) + '</span>';
      if (fresh.length) { V.$('#hx-new').innerHTML = fresh.map(V.cardHTML).join(''); V.$('#home-new').hidden = false; }
    }).catch(function () {});
  });
})();
