// Viustay date picker for the short-stay booking page. Same look as the home-page questions calendar
// (rounded box, amber picked day, "IN" under check-in, note line underneath), so both places feel the same.
// V.Cal.inline(el, { stage:'in'|'out', checkIn, checkOut, min, booked:[{from,to}] | fn, minNights, onIn(a), onOut(a,b) })
(function () {
  var V = window.V = window.V || {};
  function T(s, o) { return V.t ? V.t(s, o) : s; }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function addDays(s, n) { var d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); }
  function nights(a, b) { return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5); }
  function esc(s) { return V.esc ? V.esc(s) : String(s); }
  function nt(n) { return T(n === 1 ? '{n} night' : '{n} nights', { n: n }); }

  V.Cal = { inline: inline, nights: nights, addDays: addDays, iso: iso };

  function inline(el, o) {
    o = o || {};
    var min = o.min || iso(new Date()), minN = Math.max(1, o.minNights || 1), lock = false;
    var st = { stage: o.stage || 'in', a: o.checkIn || null, b: o.checkOut || null };
    var view = new Date(((st.stage === 'out' && st.a) || st.a || min) + 'T00:00:00'); view.setDate(1);
    function booked() { return typeof o.booked === 'function' ? o.booked() : (o.booked || []); }
    function taken(d) { return booked().some(function (r) { return r.from <= d && d < r.to; }); }
    function free(x, y) { for (var d = x; d < y; d = addDays(d, 1)) if (taken(d)) return false; return true; }
    var box = document.createElement('div'); box.className = 'cal'; el.innerHTML = ''; el.appendChild(box);
    function draw() {
      var y = view.getFullYear(), m = view.getMonth(), a = st.a, b = st.b, out = st.stage === 'out' && a, anyBooked = false;
      var first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate(), pad = (first.getDay() + 6) % 7;
      var t0 = new Date(min + 'T00:00:00'), minMonth = t0.getFullYear() * 12 + t0.getMonth(), cur = y * 12 + m;
      var h = '<div class="cal-head"><button type="button" class="cal-nav" data-nav="-1" aria-label="' + esc(T('Previous month')) + '"' + (cur <= minMonth ? ' disabled' : '') + '>‹</button><b>' +
        esc(V.date ? V.date(first, { month: 'long', year: 'numeric' }) : (m + 1) + '/' + y) + '</b><button type="button" class="cal-nav" data-nav="1" aria-label="' + esc(T('Next month')) + '"' + (cur >= minMonth + 11 ? ' disabled' : '') + '>›</button></div><div class="cal-dow">';
      for (var d0 = 0; d0 < 7; d0++) { var dd = new Date(2024, 0, 1 + d0); h += '<span>' + esc(V.date ? V.date(dd, { weekday: 'narrow' }) : 'MTWTFSS'[d0]) + '</span>'; }
      h += '</div><div class="cal-grid">';
      for (var p = 0; p < pad; p++) h += '<span></span>';
      for (var d = 1; d <= days; d++) {
        var di = iso(new Date(y, m, d)), off = di < min, took = false, cls = '';
        if (!off) {
          if (!out) took = taken(di);
          else if (di > a) { if (nights(a, di) < minN) off = true; else took = !free(a, di); }
          else off = true;   // days before (and on) check-in are greyed out, like the questions calendar
        }
        if (took) anyBooked = true;
        if (out && di === a) cls += ' in';
        else if (di === a && !out) cls += ' sel';
        if (b && di === b) cls += ' sel end';
        if (a && b && di > a && di < b) cls += ' mid';
        if (di === iso(new Date())) cls += ' today';
        if (took) cls += ' took';
        h += '<button type="button" class="cal-day' + cls + '" data-d="' + di + '"' + (off || took ? ' disabled' : '') + '>' + d + (out && di === a ? '<small>' + esc(T('IN')) + '</small>' : '') + '</button>';
      }
      h += '</div>';
      var note = st.stage === 'in' ? (a ? V.date(a, { weekday: 'long', day: 'numeric', month: 'long' }) : T('Tap the day you arrive')) :
        b ? nt(nights(a, b)) + ' · ' + V.date(a, { day: 'numeric', month: 'short' }) + ' → ' + V.date(b, { day: 'numeric', month: 'short' }) :
        minN > 1 ? T('Minimum stay is {n} nights.', { n: minN }) : T('Tap the day you leave');
      h += '<p class="cal-note">' + esc(note) + '</p>' + (anyBooked ? '<p class="cal-key"><i></i>' + esc(T('Booked')) + '</p>' : '');
      box.innerHTML = h;
    }
    box.addEventListener('click', function (e) {
      var btn = e.target.closest('button'); if (!btn || btn.disabled || lock) return;
      if (btn.hasAttribute('data-nav')) { view.setMonth(view.getMonth() + Number(btn.getAttribute('data-nav'))); draw(); return; }
      var di = btn.getAttribute('data-d');
      if (st.stage === 'in' || !st.a) { st.a = di; st.b = null; draw(); lock = true; setTimeout(function () { lock = false; if (o.onIn) o.onIn(di); }, 250); return; }
      st.b = di; draw(); lock = true;
      setTimeout(function () { lock = false; if (o.onOut) o.onOut(st.a, st.b); }, 450);
    });
    draw();
    return {
      set: function (stage, a, b) { st.stage = stage; st.a = a || null; st.b = b || null; var to = new Date(((stage === 'out' && st.a) ? (st.b || st.a) : (st.a || min)) + 'T00:00:00'); to.setDate(1); view = to; draw(); },
      state: function () { return st; }
    };
  }
})();
