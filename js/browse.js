// All homes page with live filters
document.addEventListener('DOMContentLoaded', function () {
  var V = window.V;
  var BEDS = [['', 'Any'], ['0', 'Studio'], ['1', '1 bed'], ['2', '2 bed'], ['3', '3+ bed']];
  var PRICES = [[0, 'Any'], [30000, 'Up to 30k'], [45000, 'Up to 45k'], [70000, 'Up to 70k'], [100000, 'Up to 100k']];
  var params = new URLSearchParams(window.location.search);
  var state = { area: params.get('area') || '', beds: params.get('beds') || '', max: Number(params.get('max') || 0) };
  var areaInput = V.$('#f-area');
  areaInput.value = state.area;

  function chips(box, list, current, set) {
    box.innerHTML = '';
    list.forEach(function (o) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = o[1];
      b.setAttribute('aria-pressed', String(o[0]) === String(current) ? 'true' : 'false');
      b.addEventListener('click', function () { set(o[0]); });
      box.appendChild(b);
    });
  }

  V.loadListings().then(function (all) {
    if (all.length && all[0].sample) V.$('#sample-note').classList.remove('hidden');
    function render() {
      chips(V.$('#f-beds'), BEDS, state.beds, function (v) { state.beds = v; render(); });
      chips(V.$('#f-price'), PRICES, state.max, function (v) { state.max = v; render(); });
      var list = all.filter(function (l) { return V.matches(l, { area: state.area, bedrooms: state.beds, max: state.max }); });
      list.sort(function (a, b) { return a.rent - b.rent; });
      V.$('#browse-title').textContent = list.length + ' home' + (list.length === 1 ? '' : 's') + (state.area ? ' in ' + state.area : ' for rent');
      V.$('#browse-empty').classList.toggle('hidden', list.length > 0);
      V.$('#browse-cards').innerHTML = list.map(function (l) {
        return '<a class="card" href="home.html?id=' + encodeURIComponent(l.id) + '">' +
          '<span class="photo" style="' + V.photoStyle(l.photoList[0]) + '">' + (l.photoList[0] ? '' : 'Photo coming soon') + '<span class="badge">Verified</span></span>' +
          '<span class="body"><span class="price">KES ' + V.money(l.rent) + ' <small>/ month</small></span>' +
          '<span class="desc">' + V.esc(V.shortDesc(l)) + ' · ' + V.esc(l.area) + '</span>' +
          '<span class="tags">' + V.esc(l.amenityList.slice(0, 3).join(' · ')) + '</span></span></a>';
      }).join('');
      var q = new URLSearchParams();
      if (state.area) q.set('area', state.area);
      if (state.beds) q.set('beds', state.beds);
      if (state.max) q.set('max', state.max);
      history.replaceState(null, '', 'homes.html' + (q.toString() ? '?' + q.toString() : ''));
    }
    var t;
    areaInput.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { state.area = areaInput.value.trim(); render(); }, 200); });
    render();
  }).catch(function () { V.$('#browse-title').textContent = 'Listings could not load. Please refresh.'; });
});
