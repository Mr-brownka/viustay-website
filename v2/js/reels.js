// Reels tab: a vertical, full-screen feed of every verified home. Double-tap = add to trip.
document.addEventListener('DOMContentLoaded', function () {
  var V = window.V, T = V.t, fd = document.getElementById('fd'), ALL = [], stay = 'long';
  try { stay = localStorage.getItem('vs-reels-stay') === 'short' ? 'short' : 'long'; } catch (e) {}
  var I = {
    heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
    chat: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
    cam: '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7l1.5-3h5L16 7"/><circle cx="12" cy="13.5" r="3.5"/></svg>',
    car: '<svg viewBox="0 0 24 24"><path d="M5 16V11l2.2-4.4A2 2 0 0 1 9 5.5h6a2 2 0 0 1 1.8 1.1L19 11v5"/><path d="M3.5 16h17v2.5a1 1 0 0 1-1 1H18a1 1 0 0 1-1-1V18H7v.5a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1z"/></svg>',
    moon: '<svg viewBox="0 0 24 24"><path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z"/></svg>'
  };
  function bg(u) { return u ? 'background-image:url(\'' + encodeURI(u).replace(/'/g, '%27') + '\')' : ''; }
  function slide(l) {
    var sh = l.stay === 'short', on = V.TripBasket.has(l.id), id = V.esc(l.id), href = (sh ? 'stay.html' : 'home.html') + '?id=' + encodeURIComponent(l.id);
    return '<section class="fd-s" data-id="' + id + '"><div class="rl-bg' + (l.photoList[0] ? '' : ' nop') + '" style="' + bg(l.photoList[0]) + '">' + (l.photoList[0] ? '' : '<span class="rl-nophoto">' + V.esc(T('Photo coming soon')) + '</span>') + '</div><div class="rl-shade"></div>' +
      '<div class="fd-rail">' +
      (sh ? '' : '<button type="button" data-trip="' + id + '" class="' + (on ? 'on' : '') + '"><b>' + I.heart + '</b><span>' + V.esc(on ? T('In trip') : T('Save')) + '</span></button>') +
      '<button type="button" data-room-tour="' + id + '"><b>' + I.cam + '</b><span>' + V.esc(T('Tour')) + '</span></button>' +
      '<a href="index.html?area=' + encodeURIComponent(l.area) + '"><b>' + I.pin + '</b><span>' + V.esc(T('Map')) + '</span></a>' +
      '<a href="ai.html?stay=' + (sh ? 'short' : 'long') + '&area=' + encodeURIComponent(l.area) + '"><b>' + I.chat + '</b><span>' + V.esc(T('Ask')) + '</span></a></div>' +
      '<div class="rl-info"><span class="rl-badge">✓ ' + V.esc(T('Verified by Viustay')) + '</span><b class="rl-price">KES ' + V.money(V.price(l)) + '<small> ' + V.esc(V.per(l)) + '</small></b><span class="rl-what">' + V.esc(V.shortDesc(l)) + ' · ' + V.esc(l.area) + '</span>' +
      '<span class="rl-tags">' + V.esc(((sh && l.includedList && l.includedList.length) ? l.includedList : (l.amenityList || [])).slice(0, 3).map(T).join(' · ')) + '</span></div>' +
      '<div class="rl-acts">' + (sh ? '<a class="rl-btn am" href="' + href + '">' + I.moon + V.esc(T('Book stay')) + '</a>' : '<button type="button" class="rl-btn am" data-trip="' + id + '">' + I.car + '<span>' + V.esc(on ? T('In your trip') : T('Add to trip')) + '</span></button>') + '<a class="rl-btn gl" href="' + href + '">' + V.esc(T('Details')) + '</a></div></section>';
  }
  var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (es) { es.forEach(function (e) { e.target.classList.toggle('on', e.isIntersecting); }); }, { root: fd, threshold: .6 }) : null;
  function draw() {
    var arr = ALL.filter(function (l) { return (l.stay === 'short') === (stay === 'short'); }).sort(function (a, b) { return (b.photoList[0] ? 1 : 0) - (a.photoList[0] ? 1 : 0); });
    fd.innerHTML = arr.length ? arr.map(slide).join('') : '<section class="fd-s"><div class="rl-info"><b class="rl-price">' + V.esc(T('No homes here yet.')) + '</b></div></section>';
    fd.scrollTop = 0;
    if (io) Array.prototype.forEach.call(fd.querySelectorAll('.fd-s'), function (s) { io.observe(s); });
    Array.prototype.forEach.call(document.querySelectorAll('#fd-seg button'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-stay') === stay)); });
  }
  function trip() { var n = V.TripBasket.ids().length; document.getElementById('fd-trip').textContent = n ? T('Trip · {n}/3', { n: n }) : ''; }
  function sync(id) {
    var on = V.TripBasket.has(id);
    Array.prototype.forEach.call(fd.querySelectorAll('[data-trip="' + id + '"]'), function (b) {
      if (b.classList.contains('rl-btn')) b.lastChild.textContent = on ? T('In your trip') : T('Add to trip');
      else { b.classList.toggle('on', on); b.lastChild.textContent = on ? T('In trip') : T('Save'); }
    });
  }
  fd.addEventListener('click', function (e) {
    var b = e.target.closest('[data-trip]'); if (!b) return;
    var id = b.getAttribute('data-trip'); V.TripBasket.toggle(id); sync(id); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
  });
  // double tap the photo to save
  var lastTap = 0;
  fd.addEventListener('pointerup', function (e) {
    if (e.target.closest('button, a')) return;
    var now = Date.now(), s = e.target.closest('.fd-s'); if (!s || !s.getAttribute('data-id')) return;
    if (now - lastTap < 320) {
      var id = s.getAttribute('data-id'), l = ALL.filter(function (x) { return x.id === id; })[0];
      if (l && l.stay !== 'short' && !V.TripBasket.has(id)) { V.TripBasket.add(id); sync(id); }
      var h = document.createElement('i'); h.className = 'heartbig'; h.innerHTML = I.heart; h.style.left = e.clientX + 'px'; h.style.top = e.clientY + 'px'; s.appendChild(h); setTimeout(function () { h.remove(); }, 900);
      lastTap = 0;
    } else lastTap = now;
  });
  document.getElementById('fd-seg').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return; stay = b.getAttribute('data-stay');
    try { localStorage.setItem('vs-reels-stay', stay); } catch (er) {} draw();
  });
  window.addEventListener('vs-trip', trip); trip();
  V.loadListings().then(function (all) {
    ALL = all; var id = new URLSearchParams(location.search).get('id');
    var l = id && all.filter(function (x) { return x.id === id; })[0]; if (l) stay = l.stay === 'short' ? 'short' : 'long';
    draw();
    if (l) { var s = fd.querySelector('[data-id="' + CSS.escape(id) + '"]'); if (s) fd.scrollTop = s.offsetTop; }
  }).catch(function () { fd.innerHTML = '<section class="fd-s"><div class="rl-info"><b class="rl-price">' + V.esc(T('Listings could not load. Please refresh.')) + '</b></div></section>'; });
});
