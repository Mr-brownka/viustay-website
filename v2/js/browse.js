// All homes page with live filters
document.addEventListener('DOMContentLoaded', function () {
  var V = window.V, T = V.t;
  var BEDS = [['', 'Any'], ['0', 'Studio'], ['1', '1 bed'], ['2', '2 bed'], ['3', '3+ bed']];
  var PRICES = { long: [[0, 'Any'], [30000, 'Up to 30k'], [45000, 'Up to 45k'], [70000, 'Up to 70k'], [100000, 'Up to 100k']],
    short: [[0, 'Any'], [5000, 'Up to 5k'], [8000, 'Up to 8k'], [12000, 'Up to 12k'], [20000, 'Up to 20k']] };
  var STAYS = [['long', 'Monthly rent'], ['short', 'Short stays']];
  var params = new URLSearchParams(window.location.search);
  var state = { stay: params.get('stay') === 'short' ? 'short' : 'long', area: params.get('area') || '', beds: params.get('beds') || '', max: Number(params.get('max') || 0) };
  V.$('#browse-cards').innerHTML = V.skel.cards(6);
  var areaInput = V.$('#f-area');
  areaInput.value = state.area;

  function chips(box, list, current, set) {
    box.innerHTML = '';
    list.forEach(function (o) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = T(o[1]);
      b.setAttribute('aria-pressed', String(o[0]) === String(current) ? 'true' : 'false');
      b.addEventListener('click', function () { set(o[0]); });
      box.appendChild(b);
    });
  }

  V.loadListings().then(function (all) {
    if (all.length && all[0].sample) V.$('#sample-note').classList.remove('hidden');
    function render() {
      var sh = state.stay === 'short';
      chips(V.$('#f-stay'), STAYS, state.stay, function (v) { state.stay = v; state.max = 0; render(); });
      chips(V.$('#f-beds'), BEDS, state.beds, function (v) { state.beds = v; render(); });
      chips(V.$('#f-price'), PRICES[state.stay], state.max, function (v) { state.max = v; render(); });
      V.$('#f-price-label').textContent = sh ? T('Max per night') : T('Max rent');
      var list = all.filter(function (l) { return V.matches(l, { stay: state.stay, area: state.area, bedrooms: state.beds, max: state.max }); });
      list.sort(function (a, b) { return V.price(a) - V.price(b); });
      var n = list.length;
      V.$('#browse-title').textContent = sh ? T(n === 1 ? '{n} short stay' : '{n} short stays', { n: n }) + (state.area ? ' · ' + state.area : '') :
        T(n === 1 ? '{n} home for rent' : '{n} homes for rent', { n: n }) + (state.area ? ' · ' + state.area : '');
      V.$('#browse-empty').classList.toggle('hidden', list.length > 0);
      V.$('#browse-cards').innerHTML = list.map(function (l) {
        return '<a class="card" href="home.html?id=' + encodeURIComponent(l.id) + '">' +
          '<span class="photo" style="' + V.photoStyle(l.photoList[0]) + '">' + (l.photoList[0] ? '' : V.esc(T('Photo coming soon'))) + '<span class="badge">' + V.esc(T('Verified')) + '</span></span>' +
          '<span class="body"><span class="price">KES ' + V.money(V.price(l)) + ' <small>' + V.esc(V.per(l)) + '</small></span>' +
          '<span class="desc">' + V.esc(V.shortDesc(l)) + ' · ' + V.esc(l.area) + (sh ? ' · ' + V.esc(T('Up to {n} guests', { n: l.max_guests })) : '') + '</span>' +
          '<span class="tags">' + V.esc((sh && l.includedList.length ? l.includedList : l.amenityList).slice(0, 3).map(function (x) { return T(x); }).join(' · ')) + '</span></span></a>';
      }).join('');
      var q = new URLSearchParams();
      if (sh) q.set('stay', 'short');
      if (state.area) q.set('area', state.area);
      if (state.beds) q.set('beds', state.beds);
      if (state.max) q.set('max', state.max);
      history.replaceState(null, '', 'homes.html' + (q.toString() ? '?' + q.toString() : ''));
    }
    var t;
    areaInput.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { state.area = areaInput.value.trim(); render(); }, 200); });
    render();
  }).catch(function () { V.$('#browse-title').textContent = T('Listings could not load. Please refresh.'); V.$('#browse-cards').innerHTML = ''; });
});
