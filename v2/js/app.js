// Viustay app layer (Oct 2026): trip basket, Nairobi area map points, and the reel player
// used by stories (map), Amina's swipe reel, the Reels tab and room tours.
(function () {
  var V = window.V, T = V.t;
  function esc(s) { return V.esc(s); }
  function calm() { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
  var EM = '#1554D1', AM = '#FFB020';

  // ---------- Trip basket (homes picked for one viewing trip; max 3, monthly homes only) ----------
  var MAX = 3;
  var Trip = V.TripBasket = {
    MAX: MAX,
    ids: function () { return ((V.getSearch() || {}).picked || []).slice(); },
    has: function (id) { return Trip.ids().indexOf(id) >= 0; },
    set: function (ids) { var s = V.getSearch() || {}; s.picked = ids.slice(0, MAX); V.setSearch(s); try { localStorage.setItem('vs-trip', JSON.stringify(s.picked)); } catch (e) {} fire(); },
    add: function (id) { var a = Trip.ids(); if (a.indexOf(id) >= 0) return true; if (a.length >= MAX) { toast(T('Your trip is full (3 homes). Remove one first.')); return false; } a.push(id); Trip.set(a); toast(T('Added to your viewing trip') + ' · ' + a.length + '/' + MAX); return true; },
    remove: function (id) { Trip.set(Trip.ids().filter(function (x) { return x !== id; })); },
    toggle: function (id) { return Trip.has(id) ? (Trip.remove(id), false) : Trip.add(id); }
  };
  // bring picks back if the app was closed (sessionStorage is cleared, localStorage is not)
  try { var s0 = V.getSearch() || {}; if (!(s0.picked || []).length) { var kept = JSON.parse(localStorage.getItem('vs-trip') || '[]'); if (kept.length) { s0.picked = kept; V.setSearch(s0); } } } catch (e) {}
  function fire() { try { window.dispatchEvent(new CustomEvent('vs-trip', { detail: Trip.ids() })); } catch (e) {} }

  var tt = null;
  function toast(msg) {
    var t = document.querySelector('.app-toast'); if (!t) { t = document.createElement('div'); t.className = 'app-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.remove('on'); void t.offsetWidth; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('on'); }, 2200);
  }
  V.toast = toast;

  // ---------- Nairobi areas (map positions) ----------
  V.AREAS = {
    'Westlands': [-1.2676, 36.8108], 'Parklands': [-1.2614, 36.8141], 'Kileleshwa': [-1.2817, 36.7846], 'Kilimani': [-1.2921, 36.7848], 'Lavington': [-1.2780, 36.7685],
    'Upper Hill': [-1.2990, 36.8152], 'Hurlingham': [-1.2967, 36.7953], 'Ngong Rd': [-1.3000, 36.7800], 'Ngong Road': [-1.3000, 36.7800], 'South B': [-1.3115, 36.8360], 'South C': [-1.3203, 36.8263],
    'Karen': [-1.3197, 36.7073], 'Langata': [-1.3420, 36.7680], 'Lang\'ata': [-1.3420, 36.7680], 'Kasarani': [-1.2219, 36.8960], 'Roysambu': [-1.2180, 36.8870], 'Embakasi': [-1.3196, 36.8941],
    'Ruaka': [-1.2045, 36.7808], 'Rongai': [-1.3960, 36.7440], 'Syokimau': [-1.3618, 36.9238], 'Kitengela': [-1.4730, 36.9600], 'Riverside': [-1.2700, 36.7980], 'Spring Valley': [-1.2550, 36.7930],
    'Runda': [-1.2180, 36.8100], 'Gigiri': [-1.2330, 36.8030], 'Muthaiga': [-1.2490, 36.8330], 'Donholm': [-1.2950, 36.8890], 'Buruburu': [-1.2860, 36.8780], 'Thika Rd': [-1.2300, 36.8800], 'CBD': [-1.2864, 36.8172]
  };

  // approximate pin for a home: its area centre plus a small fixed offset (we never invent exact addresses)
  V.pinPos = function (l) {
    var c = V.AREAS[l.area] || [-1.2864, 36.8172], h = 2166136261, id = String(l.id || '');
    for (var i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 16; h = Math.imul(h, 0x45d9f3b); h ^= h >>> 16; h >>>= 0;
    return [c[0] + ((h & 1023) / 1023 - .5) * .012, c[1] + (((h >>> 10) & 1023) / 1023 - .5) * .014];
  };

  // ---------- Reel player ----------
  // V.Reel.open(list, { mode: 'story' | 'swipe' | 'tour', title, start, onDone(kept) })
  var ICON = {
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>', heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
    car: '<svg viewBox="0 0 24 24"><path d="M5 16V11l2.2-4.4A2 2 0 0 1 9 5.5h6a2 2 0 0 1 1.8 1.1L19 11v5"/><path d="M3.5 16h17v2.5a1 1 0 0 1-1 1H18a1 1 0 0 1-1-1V18H7v.5a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1z"/></svg>',
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>', moon: '<svg viewBox="0 0 24 24"><path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z"/></svg>'
  };
  function photosOf(l) { return (l.photoList && l.photoList.length) ? l.photoList : ['']; }
  function info(l) {
    var sh = l.stay === 'short';
    return '<span class="rl-badge">✓ ' + esc(T('Verified by Viustay')) + '</span>' +
      '<b class="rl-price">KES ' + V.money(V.price(l)) + '<small> ' + esc(V.per(l)) + '</small></b>' +
      '<span class="rl-what">' + esc(V.shortDesc(l)) + ' · ' + esc(l.area) + '</span>' +
      '<span class="rl-tags">' + esc(((sh && l.includedList && l.includedList.length) ? l.includedList : (l.amenityList || [])).slice(0, 3).map(function (x) { return T(x); }).join(' · ')) + '</span>';
  }
  function cta(l) {
    if (l.stay === 'short') return '<a class="rl-btn am" href="stay.html?id=' + encodeURIComponent(l.id) + '">' + ICON.moon + esc(T('Book stay')) + '</a>';
    var on = Trip.has(l.id);
    return '<button type="button" class="rl-btn am" data-trip="' + esc(l.id) + '" aria-pressed="' + on + '">' + ICON.car + esc(on ? T('In your trip') : T('Add to trip')) + '</button>';
  }
  function bg(url) { return url ? 'background-image:url(\'' + encodeURI(url).replace(/'/g, '%27') + '\')' : ''; }

  var Reel = V.Reel = {};
  Reel.open = function (list, o) {
    o = o || {}; list = (list || []).filter(Boolean); if (!list.length) { toast(T('No homes here yet.')); return; }
    var mode = o.mode || 'story', i = Math.max(0, Math.min(list.length - 1, o.start || 0)), kept = [], frames = [], fi = 0, timer = null, paused = false, DUR = 5200;
    var w = document.createElement('div'); w.className = 'rl rl-' + mode; w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true');
    document.body.appendChild(w); document.documentElement.classList.add('rl-open');
    var last = document.activeElement;
    function close(done) {
      clearTimeout(timer); w.classList.add('out'); document.removeEventListener('keydown', onKey);
      setTimeout(function () { w.remove(); document.documentElement.classList.remove('rl-open'); if (last && last.focus) try { last.focus({ preventScroll: true }); } catch (e) {} }, 260);
      if (o.onDone && done !== false) o.onDone(kept);
    }
    function onKey(e) { if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') step(1); if (e.key === 'ArrowLeft') step(-1); }
    document.addEventListener('keydown', onKey);

    // --- story + tour: frames that play with a timer bar ---
    function buildFrames() {
      frames = [];
      if (mode === 'tour') photosOf(list[i]).forEach(function (p, k) { frames.push({ l: list[i], p: p, k: k }); });
      else list.forEach(function (l) { frames.push({ l: l, p: photosOf(l)[0] }); });
    }
    function drawStory() {
      var f = frames[fi], l = f.l, n = frames.length;
      var bars = ''; for (var b = 0; b < n; b++) bars += '<i class="' + (b < fi ? 'done' : b === fi ? 'now' : '') + '"><b></b></i>';
      w.innerHTML = '<div class="rl-bg kb" style="' + bg(f.p) + '">' + (f.p ? '' : '<span class="rl-nophoto">' + esc(T('Photo coming soon')) + '</span>') + '</div><div class="rl-shade"></div>' +
        '<div class="rl-bars">' + bars + '</div>' +
        '<div class="rl-top"><span class="rl-av" style="' + bg(photosOf(list[0])[0]) + '"></span><b>' + esc(o.title || '') + '</b><button type="button" class="rl-x" aria-label="' + esc(T('Close')) + '">' + ICON.x + '</button></div>' +
        '<button type="button" class="rl-tap l" aria-label="' + esc(T('Previous')) + '"></button><button type="button" class="rl-tap r" aria-label="' + esc(T('Next')) + '"></button>' +
        '<div class="rl-info">' + (mode === 'tour' ? '<span class="k">' + esc(T('Photo {a} of {b}', { a: fi + 1, b: n })) + '</span>' : '') + info(l) + '</div>' +
        '<div class="rl-acts">' + cta(l) + (mode === 'tour' ? '<a class="rl-btn gl" href="home.html?id=' + encodeURIComponent(l.id) + '">' + esc(T('Details')) + '</a>' : '<button type="button" class="rl-btn gl" data-tour="' + esc(l.id) + '">' + esc(T('Room tour')) + '</button>') + '</div>';
      var bar = w.querySelector('.rl-bars .now b'); if (bar && !calm()) { bar.style.animationDuration = DUR + 'ms'; }
      clearTimeout(timer); if (!paused) timer = setTimeout(function () { step(1); }, DUR);
    }
    function step(d) {
      if (mode === 'swipe') return;
      fi += d; if (fi < 0) fi = 0;
      if (fi >= frames.length) { close(); return; }
      drawStory();
    }
    // --- swipe: a card stack, right keeps, left skips ---
    function drawSwipe() {
      if (i >= list.length) {
        w.innerHTML = '<div class="rl-end"><b>' + esc(T(kept.length === 1 ? 'You kept {n} home' : 'You kept {n} homes', { n: kept.length })) + '</b><span>' + esc(T('Amina will plan the next step with you.')) + '</span><button type="button" class="rl-btn am" data-done>' + esc(T('Back to Amina')) + '</button></div>';
        return;
      }
      var l = list[i], nx = list[i + 1];
      w.innerHTML = '<div class="rl-bg blur" style="' + bg(photosOf(l)[0]) + '"></div>' +
        '<div class="rl-top"><b>' + esc(T('{a} of {b}', { a: i + 1, b: list.length })) + ' · <span style="color:' + AM + '">' + esc(T('{n} kept', { n: kept.length })) + '</span></b><button type="button" class="rl-x" aria-label="' + esc(T('Close')) + '">' + ICON.x + '</button></div>' +
        (nx ? '<div class="sw-card next" style="' + bg(photosOf(nx)[0]) + '"></div>' : '') +
        '<div class="sw-card" id="sw" style="' + bg(photosOf(l)[0]) + '"><i class="sw-st keep">' + esc(T('KEEP')) + '</i><i class="sw-st skip">' + esc(T('SKIP')) + '</i><div class="sw-info">' + info(l) + '</div></div>' +
        '<div class="sw-btns"><button type="button" class="sw-b no" data-sw="-1" aria-label="' + esc(T('Skip')) + '">' + ICON.x + '</button><button type="button" class="sw-b mid" data-tour="' + esc(l.id) + '" aria-label="' + esc(T('Room tour')) + '">' + ICON.info + '</button><button type="button" class="sw-b yes" data-sw="1" aria-label="' + esc(T('Keep')) + '">' + ICON.heart + '</button></div>' +
        (i === 0 ? '<div class="sw-hint">' + esc(T('Swipe right to keep · left to skip')) + '</div>' : '');
      dragable(w.querySelector('#sw'));
    }
    function swipe(dir) {
      var c = w.querySelector('#sw'); if (!c) return;
      if (dir > 0) kept.push(list[i]);
      c.style.transition = 'transform .38s cubic-bezier(.3,.6,.4,1), opacity .38s'; c.style.transform = 'translateX(' + (dir * 520) + 'px) rotate(' + (dir * 22) + 'deg)'; c.style.opacity = '0';
      c.querySelector(dir > 0 ? '.keep' : '.skip').style.opacity = 1;
      setTimeout(function () { i++; drawSwipe(); }, calm() ? 0 : 300);
    }
    function dragable(c) {
      if (!c) return; var x0 = null, dx = 0;
      c.addEventListener('pointerdown', function (e) { x0 = e.clientX; dx = 0; c.setPointerCapture(e.pointerId); c.style.transition = 'none'; });
      c.addEventListener('pointermove', function (e) { if (x0 === null) return; dx = e.clientX - x0; c.style.transform = 'translateX(' + dx + 'px) rotate(' + dx / 18 + 'deg)'; c.querySelector('.keep').style.opacity = Math.max(0, dx / 110); c.querySelector('.skip').style.opacity = Math.max(0, -dx / 110); });
      function up() { if (x0 === null) return; x0 = null; if (Math.abs(dx) > 100) swipe(dx > 0 ? 1 : -1); else { c.style.transition = 'transform .3s'; c.style.transform = ''; c.querySelector('.keep').style.opacity = 0; c.querySelector('.skip').style.opacity = 0; } }
      c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    }
    // --- shared clicks ---
    w.addEventListener('click', function (e) {
      var t = e.target.closest('button, a'); if (!t) return;
      if (t.classList.contains('rl-x')) { close(); return; }
      if (t.hasAttribute('data-done')) { close(); return; }
      if (t.classList.contains('rl-tap')) { step(t.classList.contains('r') ? 1 : -1); return; }
      if (t.hasAttribute('data-sw')) { swipe(+t.getAttribute('data-sw')); return; }
      if (t.hasAttribute('data-trip')) { var id = t.getAttribute('data-trip'), on = Trip.toggle(id); t.setAttribute('aria-pressed', String(Trip.has(id))); t.lastChild.textContent = Trip.has(id) ? T('In your trip') : T('Add to trip'); pulse(t); return; }
      if (t.hasAttribute('data-tour')) { var tl = list.filter(function (x) { return x.id === t.getAttribute('data-tour'); })[0]; clearTimeout(timer); paused = true; Reel.open([tl], { mode: 'tour', title: T('Room tour'), onDone: function () { paused = false; if (mode !== 'swipe') drawStory(); } }); return; }
    });
    // hold to pause (story/tour)
    w.addEventListener('pointerdown', function (e) { if (mode === 'swipe' || e.target.closest('button,a')) return; paused = true; clearTimeout(timer); w.classList.add('paused'); });
    w.addEventListener('pointerup', function () { if (mode === 'swipe' || !paused) return; paused = false; w.classList.remove('paused'); timer = setTimeout(function () { step(1); }, DUR / 2); });
    function pulse(el) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }

    if (mode === 'swipe') drawSwipe(); else { buildFrames(); fi = mode === 'tour' ? 0 : i; drawStory(); }
    requestAnimationFrame(function () { w.classList.add('in'); });
    return { close: close };
  };

  // Room tour buttons anywhere: <button data-room-tour="ID">
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-room-tour]'); if (!b) return;
    e.preventDefault(); var id = b.getAttribute('data-room-tour');
    V.loadListings().then(function (all) { var l = all.filter(function (x) { return x.id === id; })[0]; if (l) Reel.open([l], { mode: 'tour', title: T('Room tour') }); });
  });
})();
