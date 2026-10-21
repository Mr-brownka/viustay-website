// Explore (home): short hero, one search card with the Monthly rent / Stay a few nights switch,
// verified homes first, one Viu AI card, then neighbourhoods.
document.addEventListener('DOMContentLoaded', function () {
  var V = window.V, T = V.t, $ = V.$, ALL = [], stay = 'long';
  try { if (localStorage.getItem('vs-ex-stay') === 'short') stay = 'short'; } catch (e) {}
  var orb = document.querySelector('.ex-ai-orb'); if (orb) orb.innerHTML = V.sphere(46);
  function k(n) { return n >= 1000 ? Math.round(n / 1000) + 'k' : String(n); }
  function photoFirst(a) { return a.slice().sort(function (x, y) { return (y.photoList.length ? 1 : 0) - (x.photoList.length ? 1 : 0); }); }
  // today as the earliest check-in
  var d = new Date(), iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  $('#ex-in').min = iso;

  function setStay(s) {
    stay = s; try { localStorage.setItem('vs-ex-stay', s); } catch (e) {}
    Array.prototype.forEach.call(document.querySelectorAll('.ex-seg button'), function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-stay') === s)); });
    $('.ex-seg').classList.toggle('r', s === 'short');
    $('#ex-long').hidden = s === 'short'; $('#ex-short').hidden = s !== 'short';
    $('#ex-where-l').textContent = s === 'short' ? T('Where do you want to stay?') : T('Where do you want to live?');
    $('#ex-go-t').textContent = s === 'short' ? T('Search stays') : T('Search homes');
    $('#ex-guide').href = 'find.html?stay=' + s;
    homes();
  }
  $('.ex-seg').addEventListener('click', function (e) { var b = e.target.closest('[data-stay]'); if (b) setStay(b.getAttribute('data-stay')); });
  $('#ex-sc').addEventListener('submit', function (e) {
    e.preventDefault();
    var p = new URLSearchParams(), q = $('#ex-q').value.trim();
    if (stay === 'short') p.set('stay', 'short');
    if (q) p.set('area', q);
    if (stay === 'long') { if ($('#ex-beds').value) p.set('beds', $('#ex-beds').value); if ($('#ex-max').value) p.set('max', $('#ex-max').value); }
    else { var s = V.getSearch() || {}; s.stay = 'short'; if ($('#ex-in').value) s.checkin = $('#ex-in').value; s.guests = $('#ex-guests').value; V.setSearch(s); }
    location.href = 'homes.html' + (p.toString() ? '?' + p : '');
  });

  function homes() {
    var sh = stay === 'short', list = photoFirst(ALL.filter(function (l) { return (l.stay === 'short') === sh; })).slice(0, 8);
    $('#ex-homes-h').textContent = sh ? T('Stay a few nights') : T('Verified homes for monthly rent');
    $('#ex-homes-s').textContent = sh ? T('Furnished · pay by M-Pesa') : T('Visited and checked by Viustay');
    $('#ex-homes-all').href = sh ? 'homes.html?stay=short' : 'homes.html';
    if (!ALL.length) return;
    $('#ex-homes').innerHTML = list.map(V.cardHTML).join('') || '<p class="muted">' + V.esc(T('No homes here yet.')) + '</p>';
  }
  $('#ex-homes').innerHTML = V.skel ? V.skel.cards(3) : '';
  setStay(stay);
  V.loadListings().then(function (all) {
    ALL = all;
    var hero = photoFirst(all.filter(function (l) { return l.stay !== 'short'; }))[0];
    if (hero && hero.photoList[0]) $('#ex-hero').style.setProperty('--hero', 'url(\'' + encodeURI(hero.photoList[0]).replace(/'/g, '%27') + '\')');
    var by = {}; all.forEach(function (l) { if (l.area) (by[l.area] = by[l.area] || []).push(l); });
    var areas = Object.keys(by).sort(function (a, b) { return by[b].length - by[a].length; });
    $('#ex-areas').innerHTML = areas.map(function (a) { return '<option value="' + V.esc(a) + '">'; }).join('');
    $('#ex-hoods').innerHTML = areas.slice(0, 8).map(function (a) {
      var h = photoFirst(by[a])[0], ls = by[a].filter(function (l) { return l.stay !== 'short'; }), from = ls.length ? Math.min.apply(null, ls.map(V.price)) : 0;
      return '<a class="ex-hood" href="homes.html?area=' + encodeURIComponent(a) + '" style="' + V.photoStyle(h.photoList[0]) + '"><span><small>' + V.esc(T(by[a].length === 1 ? '{n} place' : '{n} places', { n: by[a].length })) + (from ? ' · ' + T('from') + ' ' + k(from) : '') + '</small><b>' + V.esc(a) + '</b></span></a>';
    }).join('');
    homes();
  }).catch(function () { $('#ex-homes').innerHTML = '<p class="muted">' + V.esc(T('Listings could not load. Please refresh.')) + '</p>'; });
});
