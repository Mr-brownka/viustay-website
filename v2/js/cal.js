// Viustay calendars.
// V.Cal.inline(el, o): a month calendar inside a card (short-stay booking, option C).
// V.Cal.open(o): the same calendar in a sheet (phone: slides up with a bounce; laptop: pops out in the middle).
// Days ripple in, the picked day pops, and the stay draws across like a road with an "N nights" bubble.
// o: { stage:'in'|'out', checkIn, checkOut, min, booked:[{from,to}], minNights, onIn(a), onOut(a,b) }
(function () {
  var V = window.V = window.V || {};
  function T(s, o) { return V.t ? V.t(s, o) : s; }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function addDays(s, n) { var d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); }
  function nights(a, b) { return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5); }
  function fmt(s, o) { return V.date ? V.date(s, o || { weekday: 'short', day: 'numeric', month: 'short' }) : s; }
  function calm() { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function nt(n) { return T(n === 1 ? '{n} night' : '{n} nights', { n: n }); }

  V.Cal = { inline: inline, open: open, nights: nights, addDays: addDays, iso: iso };

  // ---------- the month grid (shared) ----------
  function inline(el, o) {
    o = o || {};
    var min = o.min || iso(new Date()), minN = Math.max(1, o.minNights || 1), drawn = false, lock = false;
    var st = { stage: o.stage || 'in', a: o.checkIn || null, b: o.checkOut || null };
    var show = new Date(((st.stage === 'out' && st.a) || st.a || min) + 'T00:00:00'); show.setDate(1);
    function booked() { return typeof o.booked === 'function' ? o.booked() : (o.booked || []); }
    function taken(d) { return booked().some(function (r) { return r.from <= d && d < r.to; }); }
    function free(x, y) { for (var d = x; d < y; d = addDays(d, 1)) if (taken(d)) return false; return true; }
    el.classList.add('cal');
    var dow = '', mon = new Date(2026, 0, 5);
    for (var i = 0; i < 7; i++) { var dd = new Date(mon); dd.setDate(5 + i); dow += '<span>' + (V.date ? V.date(dd, { weekday: 'narrow' }) : 'MTWTFSS'[i]) + '</span>'; }
    el.innerHTML = '<div class="cal-head"><button type="button" class="cal-nav" data-m="-1" aria-label="' + T('Previous month') + '">‹</button><strong class="cal-month"></strong><button type="button" class="cal-nav" data-m="1" aria-label="' + T('Next month') + '">›</button></div>' +
      '<div class="cal-dow" aria-hidden="true">' + dow + '</div><div class="cal-grid" role="grid"></div>' +
      '<div class="cal-key"><span><i></i>' + T('Booked') + '</span>' + (minN > 1 && st.stage === 'out' ? '<span>' + T('Minimum stay is {n} nights.', { n: minN }) + '</span>' : '') + '</div>';
    var grid = el.querySelector('.cal-grid');
    function draw(dir) {
      var y = show.getFullYear(), m = show.getMonth(), a = st.a, b = st.b, out = st.stage === 'out' && a;
      el.querySelector('.cal-month').textContent = V.date ? V.date(show, { month: 'long', year: 'numeric' }) : (m + 1) + '/' + y;
      var first = (new Date(y, m, 1).getDay() + 6) % 7, count = new Date(y, m + 1, 0).getDate(), html = '';
      el.querySelector('[data-m="-1"]').disabled = iso(new Date(y, m, 0)) < min;
      for (var e = 0; e < first; e++) html += '<span class="cal-pad"></span>';
      for (var d = 1; d <= count; d++) {
        var s = iso(new Date(y, m, d)), cls = 'cal-d', dis = false;
        if (s < min) { cls += ' past'; dis = true; }
        else if (!out) { if (taken(s)) { cls += ' took'; dis = true; } }
        else if (s > a) { if (nights(a, s) < minN) { cls += ' short'; dis = true; } else if (!free(a, s)) { cls += ' took'; dis = true; } }
        else if (taken(s)) { cls += ' took'; dis = true; }
        if (s === a) cls += ' in';
        if (b && s === b) cls += ' out';
        if (a && b && s > a && s < b) cls += ' mid';
        if (a && b && (s === a || s === b)) cls += ' end';
        if (out && !b && s === a) cls += ' anchor';
        if (s === iso(new Date())) cls += ' today';
        html += '<button type="button" class="' + cls + '" data-d="' + s + '" data-c="' + ((first + d - 1) % 7) + '"' + (dis ? ' disabled' : '') +
          ' style="--i:' + (first + d - 1) + '" aria-label="' + fmt(s, { weekday: 'long', day: 'numeric', month: 'long' }) + '"' + (s === a || s === b ? ' aria-pressed="true"' : '') + '><span>' + d + '</span>' +
          (b && s === b ? '<em class="cal-bub">' + nt(nights(a, b)) + '</em>' : '') + '</button>';
      }
      grid.innerHTML = html;
      var ai = a && a.slice(0, 7) === iso(show).slice(0, 7) ? first + (+a.slice(8)) - 1 : -1;
      grid.style.setProperty('--a', ai);
      grid.className = 'cal-grid' + (dir ? ' slide' + (dir > 0 ? 'L' : 'R') : '') + (!drawn && o.ripple !== false ? ' ripple' : '');
      drawn = true;
    }
    function pick(s) {
      if (lock) return;
      if (st.stage === 'in' || !st.a || s <= st.a) {
        st.a = s; st.b = null; draw();
        var c = grid.querySelector('[data-d="' + s + '"]'); if (c) c.classList.add('pop');
        if (o.onIn) setTimeout(function () { o.onIn(s); }, calm() ? 0 : 260);
        return;
      }
      st.b = s; draw(); grid.classList.add('drawRoad'); lock = true;
      setTimeout(function () { lock = false; if (o.onOut) o.onOut(st.a, st.b); }, calm() ? 150 : 900);
    }
    grid.addEventListener('click', function (e) { var c = e.target.closest('.cal-d'); if (c && !c.disabled) pick(c.getAttribute('data-d')); });
    grid.addEventListener('keydown', function (e) {
      var c = e.target.closest('.cal-d'); if (!c) return;
      var k = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key]; if (!k) return;
      e.preventDefault(); var t = addDays(c.getAttribute('data-d'), k), x = grid.querySelector('[data-d="' + t + '"]');
      if (!x) { show.setMonth(show.getMonth() + (k > 0 ? 1 : -1)); draw(k); x = grid.querySelector('[data-d="' + t + '"]'); }
      if (x) x.focus();
    });
    el.querySelector('.cal-head').addEventListener('click', function (e) { var n = e.target.closest('[data-m]'); if (!n || n.disabled) return; var k = +n.getAttribute('data-m'); show.setMonth(show.getMonth() + k); draw(k); });
    draw();
    return {
      set: function (stage, a, b) { st.stage = stage; st.a = a || null; st.b = b || null; var to = new Date(((stage === 'out' && st.a) ? (st.b || st.a) : (st.a || min)) + 'T00:00:00'); to.setDate(1); show = to; draw(); },
      ripple: function () { drawn = false; draw(); },
      state: function () { return st; }
    };
  }

  // ---------- the same calendar in a sheet ----------
  function open(o) {
    o = o || {};
    var last = document.activeElement, closing = false;
    var wrap = document.createElement('div'); wrap.className = 'cal-wrap';
    wrap.innerHTML = '<div class="cal-scrim" data-x></div><div class="cal-sheet" role="dialog" aria-modal="true" aria-labelledby="cal-h">' +
      '<div class="cal-grab" aria-hidden="true"><i></i></div><button type="button" class="cal-x" data-x aria-label="' + T('Close') + '">×</button>' +
      '<div class="cal-titles"><h2 id="cal-h"></h2><p class="cal-sub" aria-live="polite"></p></div><div class="cal-body"></div></div>';
    document.body.appendChild(wrap); document.documentElement.classList.add('cal-open');
    var h = wrap.querySelector('#cal-h'), sub = wrap.querySelector('.cal-sub'), stage = o.stage || (o.checkIn ? 'out' : 'in'), a = o.checkIn, b = o.checkOut;
    function titles() {
      var t = stage === 'in' ? T('When do you arrive?') : T('When do you leave?');
      if (h.textContent !== t) { h.textContent = t; h.classList.remove('cal-swap'); void h.offsetWidth; h.classList.add('cal-swap'); }
      sub.textContent = stage === 'in' ? T('Tap the day you arrive') : a ? T('Check-in') + ': ' + fmt(a) : '';
    }
    var cal = inline(wrap.querySelector('.cal-body'), { stage: stage, checkIn: a, checkOut: b, min: o.min, booked: o.booked, minNights: o.minNights,
      onIn: function (x) { a = x; b = null; stage = 'out'; cal.set('out', a, null); titles(); if (o.onIn) o.onIn(x); },
      onOut: function (x, y) { a = x; b = y; if (o.onOut) o.onOut(x, y); close(); } });
    titles();
    Array.prototype.forEach.call(wrap.querySelectorAll('[data-x]'), function (x) { x.addEventListener('click', close); });
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    var sheet = wrap.querySelector('.cal-sheet'), y0 = null, dy = 0;
    [wrap.querySelector('.cal-grab'), wrap.querySelector('.cal-titles')].forEach(function (g) {
      g.addEventListener('touchstart', function (e) { y0 = e.touches[0].clientY; dy = 0; sheet.style.transition = 'none'; }, { passive: true });
      g.addEventListener('touchmove', function (e) { if (y0 === null) return; dy = Math.max(0, e.touches[0].clientY - y0); sheet.style.transform = 'translateY(' + dy + 'px)'; }, { passive: true });
      g.addEventListener('touchend', function () { if (y0 === null) return; y0 = null; sheet.style.transition = ''; sheet.style.transform = ''; if (dy > 90) close(); });
    });
    function close() {
      if (closing) return; closing = true; document.removeEventListener('keydown', onKey); wrap.classList.add('out');
      setTimeout(function () { wrap.remove(); document.documentElement.classList.remove('cal-open'); if (o.onClose) o.onClose(a, b); else if (last && last.focus) last.focus({ preventScroll: true }); }, calm() ? 0 : 280);
    }
    requestAnimationFrame(function () { wrap.classList.add('in'); });
    return { close: close };
  }
})();
