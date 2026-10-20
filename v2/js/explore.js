// Explore (home): hero search, Long / Short stay doors, Viu AI, neighbourhoods, recommended homes, short stays.
document.addEventListener('DOMContentLoaded', function () {
  var V = window.V, T = V.t, $ = V.$;
  var orb = document.querySelector('.ex-ai-orb'); if (orb) orb.innerHTML = V.sphere(54);
  var DESC = { Kilimani: 'Central, lively', Kileleshwa: 'Quiet, leafy', Lavington: 'Family homes', Westlands: 'Offices, nightlife', Parklands: 'Busy, close to town', 'South C': 'Calm, near the airport', 'South B': 'Affordable, central', 'Upper Hill': 'Business district', Hurlingham: 'Close to everything', Karen: 'Green and spacious' };
  function k(n) { return n >= 1000 ? Math.round(n / 1000) + 'k' : String(n); }
  $('#ex-search').addEventListener('submit', function (e) {
    e.preventDefault();
    var q = $('#ex-q').value.trim(), stay = $('#ex-stay').value, p = new URLSearchParams();
    if (stay === 'short') p.set('stay', 'short'); if (q) p.set('area', q);
    location.href = 'homes.html' + (p.toString() ? '?' + p : '');
  });
  $('#ex-homes').innerHTML = V.skel ? V.skel.cards(3) : '';
  V.loadListings().then(function (all) {
    var long = all.filter(function (l) { return l.stay !== 'short'; }), short = all.filter(function (l) { return l.stay === 'short'; });
    var withPhoto = function (a) { return a.slice().sort(function (x, y) { return (y.photoList.length ? 1 : 0) - (x.photoList.length ? 1 : 0); }); };
    var hero = withPhoto(long)[0]; if (hero && hero.photoList[0]) $('#ex-hero').style.setProperty('--hero', 'url(\'' + encodeURI(hero.photoList[0]).replace(/'/g, '%27') + '\')');
    var by = {}; all.forEach(function (l) { if (l.area) (by[l.area] = by[l.area] || []).push(l); });
    var areas = Object.keys(by).sort(function (a, b) { return by[b].length - by[a].length; });
    $('#ex-areas').innerHTML = areas.map(function (a) { return '<option value="' + V.esc(a) + '">'; }).join('');
    $('#ex-hoods').innerHTML = areas.slice(0, 8).map(function (a) {
      var h = withPhoto(by[a])[0], ls = by[a].filter(function (l) { return l.stay !== 'short'; }), from = ls.length ? Math.min.apply(null, ls.map(V.price)) : 0;
      return '<a class="ex-hood" href="homes.html?area=' + encodeURIComponent(a) + '" style="' + V.photoStyle(h.photoList[0]) + '"><span><b>' + V.esc(a) + '</b><small>' + V.esc(T(DESC[a] || '')) + (DESC[a] ? ' · ' : '') + V.esc(T(by[a].length === 1 ? '{n} place' : '{n} places', { n: by[a].length })) + (from ? ' · ' + T('from') + ' ' + k(from) : '') + '</small></span></a>';
    }).join('');
    $('#ex-homes').innerHTML = withPhoto(long).slice(0, 8).map(V.cardHTML).join('') || '<p class="muted">' + V.esc(T('No homes here yet.')) + '</p>';
    if (short.length) $('#ex-short').innerHTML = withPhoto(short).slice(0, 8).map(V.cardHTML).join(''); else $('#ex-short-sec').style.display = 'none';
  }).catch(function () { $('#ex-homes').innerHTML = '<p class="muted">' + V.esc(T('Listings could not load. Please refresh.')) + '</p>'; });
  // the floating sphere says hello once
  setTimeout(function () { var f = document.querySelector('.ai-fab'); if (f) { f.classList.add('hint'); setTimeout(function () { f.classList.remove('hint'); }, 3200); } }, 1800);
});
