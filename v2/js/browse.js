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
      // No filters yet: group by area (busiest areas first), featured homes last. With filters: one grid.
      var plain = !state.area && !state.beds && !state.max, box = V.$('#browse-cards');
      if (plain && list.length > 3) {
        var by = {}; list.forEach(function (l) { (by[l.area || T('Other')] = by[l.area || T('Other')] || []).push(l); });
        var areas = Object.keys(by).sort(function (a, b) { return by[b].length - by[a].length || a.localeCompare(b); });
        var feat = list.filter(function (l) { return /^(y|yes|true|1)$/i.test(String(l.featured || '')); });
        if (!feat.length) feat = list.filter(function (l) { return l.photoList.length; }).slice().sort(function (a, b) { return b.photoList.length - a.photoList.length || (b.amenityList || []).length - (a.amenityList || []).length; }).slice(0, 6);
        box.className = 'groups';
        box.innerHTML = areas.map(function (a) {
          return '<section class="grp"><div class="hx-h"><h2>' + V.esc(a) + ' <span class="muted" style="font-weight:600;font-size:15px">· ' + by[a].length + '</span></h2><a href="#" data-area="' + V.esc(a) + '">' + V.esc(T('See all')) + ' ›</a></div><div class="hx-row">' + by[a].map(V.cardHTML).join('') + '</div></section>';
        }).join('') + (feat.length ? '<section class="grp"><div class="hx-h"><h2>' + V.esc(T('Featured homes')) + '</h2></div><div class="hx-row">' + feat.map(V.cardHTML).join('') + '</div></section>' : '');
      } else { box.className = 'cards'; box.innerHTML = list.map(V.cardHTML).join(''); }
      // phone bar: segmented control + filters count
      V.$('#seg').classList.toggle('r', sh);
      Array.prototype.forEach.call(document.querySelectorAll('#seg button'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-stay') === state.stay)); });
      V.$('#fcount').textContent = [state.area, state.beds, state.max].filter(Boolean).length || '';
      var q = new URLSearchParams();
      if (sh) q.set('stay', 'short');
      if (state.area) q.set('area', state.area);
      if (state.beds) q.set('beds', state.beds);
      if (state.max) q.set('max', state.max);
      history.replaceState(null, '', 'homes.html' + (q.toString() ? '?' + q.toString() : ''));
    }
    var t;
    function sheet(on) { document.body.classList.toggle('f-open', on); }
    V.$('#fbtn').addEventListener('click', function () { sheet(true); });
    V.$('#f-scrim').addEventListener('click', function () { sheet(false); });
    V.$('#f-done').addEventListener('click', function () { sheet(false); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    V.$('#seg').addEventListener('click', function (e) { var b = e.target.closest('[data-stay]'); if (!b || b.getAttribute('data-stay') === state.stay) return; state.stay = b.getAttribute('data-stay'); state.max = 0; render(); });
    V.$('#browse-cards').addEventListener('click', function (e) { var a = e.target.closest('[data-area]'); if (!a) return; e.preventDefault(); state.area = a.getAttribute('data-area'); areaInput.value = state.area; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    areaInput.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { state.area = areaInput.value.trim(); render(); }, 200); });
    render();
  }).catch(function () { V.$('#browse-title').textContent = T('Listings could not load. Please refresh.'); V.$('#browse-cards').innerHTML = ''; });
});
