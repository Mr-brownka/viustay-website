// Explore (home) · v6: one Uber-style "Where do you want to live?" box (soft pill) with a 3 s amber pulse,
// area chips, a full-screen area list, then ONE question (Monthly rent / A few nights) → homes.html.
// Bedrooms, budget, dates and guests live on the results page.
document.addEventListener('DOMContentLoaded', function () {
  var V = window.V, T = V.t, $ = V.$, ALL = [], AREAS = [], BY = {}, area = '', lastFocus = null;
  Array.prototype.forEach.call(document.querySelectorAll('.ex-ai-orb'), function (o) { o.innerHTML = V.sphere(46); });
  var PIN = '<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>';
  var LOC = '<svg viewBox="0 0 24 24"><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="6"/></svg>';
  function k(n) { return n >= 1000 ? Math.round(n / 1000) + 'k' : String(n); }
  function photoFirst(a) { return a.slice().sort(function (x, y) { return (y.photoList.length ? 1 : 0) - (x.photoList.length ? 1 : 0); }); }
  function cnt(a) { var n = (BY[a] || []).length; return T(n === 1 ? '{n} home' : '{n} homes', { n: n }); }

  // 3-second amber pulse, once per page view, then it settles
  var box = $('#ex-where');
  if (!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    var pulse = function () { box.classList.add('pl'); setTimeout(function () { box.classList.remove('pl'); }, 3800); };
    if (window.VS_LAUNCHING) window.addEventListener('vs-launch-done', pulse, { once: true }); else setTimeout(pulse, 150);
  }

  // ---- area sheet
  var pick = $('#ex-pick'), ask = $('#ex-ask'), q = $('#ex-q');
  function lock(on) { document.documentElement.classList.toggle('ex-lock', on); }
  function list() {
    var t = q.value.trim().toLowerCase(), hits = AREAS.filter(function (a) { return !t || a.toLowerCase().indexOf(t) > -1; });
    var h = '';
    if (!t) h += '<button type="button" class="ex-li" data-area=""><span class="ex-lic">' + LOC + '</span><span><b>' + V.esc(T('Anywhere good')) + '</b><small>' + V.esc(T('Show me the best homes in Nairobi')) + '</small></span></button>';
    if (hits.length) h += '<div class="ex-lh">' + V.esc(t ? T('Areas') : T('Popular areas')) + '</div>';
    h += hits.map(function (a) { return '<button type="button" class="ex-li" data-area="' + V.esc(a) + '"><span class="ex-lic">' + PIN + '</span><span><b>' + V.esc(a) + '</b><small>' + V.esc(cnt(a)) + '</small></span></button>'; }).join('');
    if (t && !hits.some(function (a) { return a.toLowerCase() === t; })) h += '<button type="button" class="ex-li" data-area="' + V.esc(q.value.trim()) + '"><span class="ex-lic">' + '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg></span><span><b>' + V.esc(T('Search for “{q}”', { q: q.value.trim() })) + '</b><small>' + V.esc(T('Area, street or building')) + '</small></span></button>';
    $('#ex-list').innerHTML = h;
  }
  function openPick() {
    lastFocus = document.activeElement; q.value = ''; list();
    pick.hidden = false; lock(true);
    setTimeout(function () { q.focus(); }, 60);
  }
  function closePick() { pick.hidden = true; if (ask.hidden) { lock(false); if (lastFocus) lastFocus.focus(); } }
  box.addEventListener('click', openPick);
  $('#ex-back').addEventListener('click', closePick);
  q.addEventListener('input', list);
  $('#ex-sin').addEventListener('submit', function (e) { e.preventDefault(); var v = q.value.trim(); var m = AREAS.filter(function (a) { return a.toLowerCase() === v.toLowerCase(); })[0]; openAsk(m || v); });
  $('#ex-list').addEventListener('click', function (e) { var b = e.target.closest('[data-area]'); if (b) openAsk(b.getAttribute('data-area')); });

  // ---- one question
  function openAsk(a) {
    area = a; if (!lastFocus || pick.hidden) lastFocus = document.activeElement;
    $('#ex-ask-h').textContent = T('{a} · how long?', { a: a || T('Nairobi') });
    pick.hidden = true; ask.hidden = false; lock(true);
    setTimeout(function () { ask.querySelector('.ex-big').focus(); }, 60);
  }
  function closeAsk() { ask.hidden = true; lock(false); if (lastFocus) lastFocus.focus(); }
  ask.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) return closeAsk();
    var b = e.target.closest('.ex-big'); if (!b) return;
    var s = b.getAttribute('data-stay'), p = new URLSearchParams();
    if (s === 'short') { p.set('stay', 'short'); var sv = V.getSearch() || {}; sv.stay = 'short'; V.setSearch(sv); }
    if (area) p.set('area', area);
    location.href = 'homes.html' + (p.toString() ? '?' + p : '');
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!ask.hidden) closeAsk(); else if (!pick.hidden) closePick();
  });
  $('#ex-chips').addEventListener('click', function (e) { var b = e.target.closest('[data-area]'); if (b) { lastFocus = b; openAsk(b.getAttribute('data-area')); } });

  // ---- homes + neighbourhoods
  $('#ex-homes').innerHTML = V.skel ? V.skel.cards(3) : '';
  V.loadListings().then(function (all) {
    ALL = all;
    var hero = photoFirst(all.filter(function (l) { return l.stay !== 'short'; }))[0];
    if (hero && hero.photoList[0]) $('#ex-hero').style.setProperty('--hero', 'url(\'' + encodeURI(hero.photoList[0]).replace(/'/g, '%27') + '\')');
    all.forEach(function (l) { if (l.area) (BY[l.area] = BY[l.area] || []).push(l); });
    AREAS = Object.keys(BY).sort(function (a, b) { return BY[b].length - BY[a].length; });
    $('#ex-chips').innerHTML = AREAS.slice(0, 6).map(function (a) {
      return '<button type="button" class="ex-chip" data-area="' + V.esc(a) + '"><span class="ex-cic">' + PIN + '</span><span><b>' + V.esc(a) + '</b><small>' + V.esc(cnt(a)) + '</small></span></button>';
    }).join('');
    if (!pick.hidden) list();
    var list8 = photoFirst(all.filter(function (l) { return l.stay !== 'short'; })).slice(0, 8);
    $('#ex-homes').innerHTML = list8.map(V.cardHTML).join('') || '<p class="muted">' + V.esc(T('No homes here yet.')) + '</p>';
    $('#ex-hoods').innerHTML = AREAS.slice(0, 8).map(function (a) {
      var h = photoFirst(BY[a])[0], ls = BY[a].filter(function (l) { return l.stay !== 'short'; }), from = ls.length ? Math.min.apply(null, ls.map(V.price)) : 0;
      return '<a class="ex-hood" href="homes.html?area=' + encodeURIComponent(a) + '" style="' + V.photoStyle(h.photoList[0]) + '"><span><small>' + V.esc(T(BY[a].length === 1 ? '{n} place' : '{n} places', { n: BY[a].length })) + (from ? ' · ' + T('from') + ' ' + k(from) : '') + '</small><b>' + V.esc(a) + '</b></span></a>';
    }).join('');
  }).catch(function () { $('#ex-homes').innerHTML = '<p class="muted">' + V.esc(T('Listings could not load. Please refresh.')) + '</p>'; });
});
