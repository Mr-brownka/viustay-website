// Saved: the 3-home viewing shortlist (one organised trip), a side-by-side compare, and every saved home.
document.addEventListener('DOMContentLoaded', function () {
  var V = window.V, T = V.t, $ = V.$, ALL = [], showCmp = false;
  function byId(id) { return ALL.filter(function (l) { return l.id === id; })[0]; }
  function yes(v) { return /^(y|yes|true|1)$/i.test(String(v || '')); }
  function has(l, a) { return (l.amenityList || []).some(function (x) { return x.toLowerCase().indexOf(a.toLowerCase()) >= 0; }); }
  function trip() {
    var ids = V.TripBasket.ids(), ls = ids.map(byId).filter(Boolean), n = ls.length;
    var h = '<div class="sv-trip-h"><span><b>' + V.esc(T('Viewing shortlist')) + '</b><small>' + V.esc(T('One trip can visit up to 3 homes.')) + '</small></span><b class="sv-c">' + n + ' / 3</b></div><div class="sv-bars">' + [0, 1, 2].map(function (i) { return '<i class="' + (i < n ? 'on' : '') + '"></i>'; }).join('') + '</div>';
    if (!n) h += '<p class="sv-empty">' + V.esc(T('Tap "Add to trip" on any monthly home below, or let Viu AI pick for you.')) + '</p><div class="sv-acts"><a class="sv-btn sun" href="ai.html">' + V.esc(T('Ask Viu AI')) + '</a><a class="sv-btn ghost" href="homes.html">' + V.esc(T('Browse homes')) + '</a></div>';
    else {
      h += '<div class="sv-list">' + ls.map(function (l) {
        return '<div class="sv-item"><a href="home.html?id=' + encodeURIComponent(l.id) + '" style="' + V.photoStyle(l.photoList[0]) + '"></a><span><b>' + V.esc(V.shortDesc(l)) + '</b><small>' + V.esc(l.area) + ' · KES ' + V.money(V.price(l)) + ' ' + V.esc(V.per(l)) + '</small><i>✓ ' + V.esc(T('Verified')) + '</i></span><button type="button" data-rm="' + V.esc(l.id) + '" aria-label="' + V.esc(T('Remove')) + '">×</button></div>';
      }).join('') + '</div>';
      if (n === 3) h += '<p class="sv-full">' + V.esc(T('Your trip is full. Remove one to add another.')) + '</p>';
      h += '<div class="sv-acts">' + (n > 1 ? '<button type="button" class="sv-btn ghost" id="sv-cmp">' + V.esc(showCmp ? T('Hide compare') : T('Compare {n}', { n: n })) + '</button>' : '') + '<a class="sv-btn sun" href="book.html">' + V.esc(T('Plan one viewing trip')) + '</a></div>';
    }
    $('#sv-trip').innerHTML = h;
    cmp(ls);
  }
  function cmp(ls) {
    var w = $('#sv-cmp-wrap'); if (!showCmp || ls.length < 2) { w.hidden = true; return; }
    var low = Math.min.apply(null, ls.map(V.price));
    var rows = [
      [T('Rent'), function (l) { return { v: 'KES ' + V.money(V.price(l)), best: V.price(l) === low }; }],
      [T('Area'), function (l) { return { v: l.area || '—' }; }],
      [T('Bedrooms'), function (l) { return { v: l.bedrooms === '0' || l.bedrooms === 0 ? T('Studio') : (l.bedrooms || '—') }; }],
      [T('Bathrooms'), function (l) { return { v: l.bathrooms || T('Not stated'), miss: !l.bathrooms }; }],
      [T('Floor'), function (l) { return { v: l.floor || T('Not stated'), miss: !l.floor }; }],
      [T('Furnished'), function (l) { return { v: l.furnished ? (yes(l.furnished) ? T('Yes') : T('No')) : T('Not stated'), miss: !l.furnished }; }],
      [T('Water 24/7'), function (l) { return { v: has(l, 'water') ? '✓' : '—' }; }],
      [T('Security guard'), function (l) { return { v: has(l, 'security') ? '✓' : '—' }; }],
      [T('Parking'), function (l) { return { v: has(l, 'parking') ? '✓' : '—' }; }],
      [T('Backup power'), function (l) { return { v: has(l, 'power') ? '✓' : '—' }; }],
      [T('Available'), function (l) { return { v: l.available_from || T('Not stated'), miss: !l.available_from }; }],
      [T('Deposit'), function (l) { return { v: l.deposit || T('Not stated'), miss: !l.deposit }; }]
    ];
    w.innerHTML = '<div class="sv-cmp" style="--n:' + ls.length + '"><span></span>' + ls.map(function (l) { return '<span class="sv-ch"><i style="' + V.photoStyle(l.photoList[0]) + '"></i>' + V.esc(l.area) + '</span>'; }).join('') +
      rows.map(function (r) { return '<span class="k">' + V.esc(r[0]) + '</span>' + ls.map(function (l) { var c = r[1](l); return '<span class="' + (c.best ? 'best' : c.miss ? 'miss' : '') + '">' + V.esc(String(c.v)) + '</span>'; }).join(''); }).join('') +
      '</div><p class="muted sv-note">' + V.esc(T('Lowest rent is highlighted. Missing details are shown as missing; we don\'t pick a winner for you.')) + '</p>';
    w.hidden = false;
  }
  function favs() {
    var ids = V.Favs.ids(), ls = ids.map(byId).filter(Boolean);
    $('#sv-n').textContent = ls.length ? T(ls.length === 1 ? '{n} home' : '{n} homes', { n: ls.length }) : '';
    if (!ls.length) { $('#sv-favs').innerHTML = '<div class="sv-none"><b>' + V.esc(T('Nothing saved yet')) + '</b><span>' + V.esc(T('Tap the ♥ on any home to keep it here.')) + '</span><a class="sv-btn sun" href="homes.html">' + V.esc(T('Browse homes')) + '</a></div>'; return; }
    $('#sv-favs').innerHTML = ls.map(function (l) {
      var on = V.TripBasket.has(l.id), act = l.stay === 'short' ? '<a class="sv-mini" href="stay.html?id=' + encodeURIComponent(l.id) + '">' + V.esc(T('Book stay')) + '</a>' : '<button type="button" class="sv-mini' + (on ? ' on' : '') + '" data-trip="' + V.esc(l.id) + '">' + V.esc(on ? T('In your trip ✓') : T('Add to trip')) + '</button>';
      return '<div class="sv-card">' + V.cardHTML(l) + act + '</div>';
    }).join('');
  }
  function all() { trip(); favs(); }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-rm],[data-trip],#sv-cmp'); if (!t) return;
    if (t.id === 'sv-cmp') { showCmp = !showCmp; trip(); return; }
    if (t.hasAttribute('data-rm')) { V.TripBasket.remove(t.getAttribute('data-rm')); all(); return; }
    if (t.hasAttribute('data-trip')) { V.TripBasket.toggle(t.getAttribute('data-trip')); all(); }
  });
  window.addEventListener('vs-favs', favs);
  V.loadListings().then(function (a) { ALL = a; all(); }).catch(function () { $('#sv-favs').innerHTML = '<p class="muted">' + V.esc(T('Listings could not load. Please refresh.')) + '</p>'; });
});
