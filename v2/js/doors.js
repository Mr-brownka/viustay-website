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
    var help = V.$('#d-help'), back = V.$('#d-back');
    if (help) help.addEventListener('click', function () { mode(true); window.scrollTo(0, 0); var q = V.$('#c-chat button'); if (q) q.focus({ preventScroll: true }); });
    // Rent a home -> straight to "Where in Nairobi would you like to live?" (long stay already chosen)
    var rent = V.$('#d-rent');
    if (rent) rent.addEventListener('click', function (e) {
      e.preventDefault(); mode(true); window.scrollTo(0, 0);
      if (window.VSChat) window.VSChat.preset({ stay: 'long' });
    });
    if (back) back.addEventListener('click', function () { mode(false); window.scrollTo(0, 0); });
    window.addEventListener('hashchange', function () { mode(/#ask/.test(location.hash)); });
    // Header "Help me choose" on this page opens the questions instead of reloading
    V.$$('a[href="index.html#ask"]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); mode(true); window.scrollTo(0, 0); }); });
    V.loadListings().then(function (all) {
      var lo = all.filter(function (l) { return l.stay !== 'short'; }).length, sh = all.length - lo;
      if (lo) V.$('#d-long').textContent = T(lo === 1 ? '{n} home now' : '{n} homes now', { n: lo });
      if (sh) V.$('#d-short').textContent = T(sh === 1 ? '{n} place now' : '{n} places now', { n: sh });
    }).catch(function () {});
  });
})();
