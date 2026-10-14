// v2: the guided chat search (home page) + shared search definitions used by matches.html.
(function () {
  var V = window.V;
  var AREAS = ['Kilimani', 'Kileleshwa', 'Lavington', 'Parklands', 'South C', 'Westlands'];
  var STEPS = [
    { k: 'stay', q: 'Karibu! Are you looking for a long stay or a short stay?', type: 'one', o: [['long', 'Long stay', 'monthly rent'], ['short', 'Short stay', 'per night']] },
    { k: 'area', q: 'Where in Nairobi would you like to live?', qShort: 'Where in Nairobi would you like to stay?', type: 'one', o: AREAS.map(function (a) { return [a]; }).concat([['Anywhere', 'Anywhere good']]) },
    { k: 'beds', q: 'How many bedrooms do you need?', type: 'one', o: [['0', 'Bedsitter / studio'], ['1', '1 bedroom'], ['2', '2 bedrooms'], ['3', '3+ bedrooms']] },
    { k: 'budget', q: "What's your monthly rent budget?", qShort: "What's your budget per night?", type: 'budget' },
    { k: 'must', q: "What can't you live without?", type: 'many', max: 3, hint: 'Pick up to 3, or skip.',
      o: [['Water 24/7'], ['Security guard'], ['Parking'], ['Backup power'], ['Lift'], ['Balcony'], ['Furnished'], ['Pet friendly'], ['Schools nearby'], ['Space for kids']] },
    { k: 'who', q: "Who's moving in?", qShort: "Who's coming?", type: 'one', o: [['Just me'], ['Couple'], ['Family with kids'], ['Sharing with friends']] },
    { k: 'when', q: 'When would you like to move in?', qShort: 'When do you check in?', type: 'when' }
  ];
  var BUDGETS = {
    long: [['0-40000', 'Under 40k'], ['40000-60000', '40k–60k'], ['60000-80000', '60k–80k'], ['80000-120000', '80k–120k'], ['120000-0', '120k+']],
    short: [['0-5000', 'Under 5k'], ['5000-8000', '5k–8k'], ['8000-12000', '8k–12k'], ['12000-0', '12k+']]
  };
  var WHEN = ['This month', 'Next month', 'In 2–3 months'];
  var WHEN_SHORT = ['This week', 'Next week', 'This month'];
  var NAMES = { stay: 'Stay', area: 'Area', beds: 'Bedrooms', budget: 'Budget', must: 'Must-haves', who: 'Who', when: 'When' };

  function k(n) { return (n / 1000) + 'k'; }
  var T = V.t;
  function label(A, key) {
    var v = A[key]; if (v === undefined || v === null || v === '') return null;
    if (key === 'budget') { var p = v.split('-').map(Number); return p[1] ? (p[0] ? k(p[0]) + '–' + k(p[1]) : T('Under {x}', { x: k(p[1]) })) : k(p[0]) + '+'; }
    if (key === 'must') return v.length ? v.map(function (x) { return T(x); }).join(', ') : T('No preference');
    var s = STEPS.filter(function (x) { return x.k === key; })[0];
    if (s && s.o) { var o = s.o.filter(function (x) { return x[0] === v; })[0]; return o ? T(o[1] || o[0]) : T(v); }
    return T(v);
  }
  function name(key) { return T(NAMES[key]); }
  function toSearch(A) {
    var s = { chat: A, stay: A.stay || 'long', area: A.area && A.area !== 'Anywhere' ? A.area : '', bedrooms: A.beds !== undefined ? A.beds : '', must: A.must || [], who: A.who || '', movein: A.when || '', picked: [] };
    if (A.budget) { var p = A.budget.split('-').map(Number); s.min = p[0] || null; s.max = p[1] || null; }
    return s;
  }
  function matchList(all, A) {
    var s = toSearch(A);
    return all.filter(function (l) { return V.matches(l, s); });
  }

  // ---------- Calendar (move-in date, or check-in → check-out for short stays) ----------
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function calendar(o) {
    var start = o.start || null, end = o.end || null;
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var view = new Date((start ? new Date(start + 'T00:00:00') : o.min ? new Date(o.min + 'T00:00:00') : today)); view.setDate(1);
    var box = document.createElement('div'); box.className = 'cal';
    function nights(a, b) { return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5); }
    function draw() {
      var y = view.getFullYear(), m = view.getMonth();
      var first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate(), pad = (first.getDay() + 6) % 7;
      var minMonth = today.getFullYear() * 12 + today.getMonth(), cur = y * 12 + m;
      var h = '<div class="cal-head"><button type="button" class="cal-nav" data-nav="-1" aria-label="' + T('Previous month') + '"' + (cur <= minMonth ? ' disabled' : '') + '>‹</button><b>' +
        V.esc(V.date(first, { month: 'long', year: 'numeric' })) + '</b><button type="button" class="cal-nav" data-nav="1" aria-label="' + T('Next month') + '"' + (cur >= minMonth + 11 ? ' disabled' : '') + '>›</button></div><div class="cal-dow">';
      for (var d0 = 0; d0 < 7; d0++) { var dd = new Date(2024, 0, 1 + d0); h += '<span>' + V.esc(V.date(dd, { weekday: 'narrow' })) + '</span>'; }
      h += '</div><div class="cal-grid">';
      for (var p = 0; p < pad; p++) h += '<span></span>';
      for (var d = 1; d <= days; d++) {
        var di = iso(new Date(y, m, d)), past = new Date(y, m, d) < today || (o.min && di < o.min);
        var cls = di === start ? ' sel start' : di === end ? ' sel end' : (start && end && di > start && di < end ? ' mid' : '');
        if (o.mark && di === o.mark) { cls += ' in'; past = true; }
        if (di === iso(today)) cls += ' today';
        h += '<button type="button" class="cal-day' + cls + '" data-d="' + di + '"' + (past ? ' disabled' : '') + '>' + d + (o.mark && di === o.mark ? '<small>' + V.esc(T('IN')) + '</small>' : '') + '</button>';
      }
      h += '</div>';
      var note = o.note ? o.note : o.mode === 'range' ? (start && end ? T(nights(start, end) === 1 ? '{n} night' : '{n} nights', { n: nights(start, end) }) + ' · ' + V.date(start, { day: 'numeric', month: 'short' }) + ' → ' + V.date(end, { day: 'numeric', month: 'short' }) :
        start ? T('Now tap your check-out date') : T('Tap your check-in date, then your check-out date')) : (start ? V.date(start, { weekday: 'long', day: 'numeric', month: 'long' }) : T('Tap the day you\'d like to move in'));
      h += '<p class="cal-note">' + V.esc(note) + '</p>';
      box.innerHTML = h;
    }
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || b.disabled) return;
      if (b.hasAttribute('data-nav')) { view.setMonth(view.getMonth() + Number(b.getAttribute('data-nav'))); draw(); return; }
      var di = b.getAttribute('data-d');
      if (o.mode === 'range') {
        if (!start || end || di <= start) { start = di; end = null; draw(); return; }
        end = di; draw(); setTimeout(function () { o.onPick(start, end); }, 250); return;
      }
      start = di; draw(); setTimeout(function () { o.onPick(start); }, 200);
    });
    draw();
    return box;
  }
  function setWhen(A, a, b) {
    if (b) {
      var n = Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5);
      A.checkin = a; A.checkout = b; A.when_iso = a;
      A.when = V.date(a, { day: 'numeric', month: 'short' }) + ' → ' + V.date(b, { day: 'numeric', month: 'short' }) + ' · ' + T(n === 1 ? '{n} night' : '{n} nights', { n: n });
    } else { A.when_iso = a; delete A.checkin; delete A.checkout; A.when = V.date(a, { day: 'numeric', month: 'short', year: 'numeric' }); }
  }
  window.VSSearch = { STEPS: STEPS, BUDGETS: BUDGETS, WHEN: WHEN, WHEN_SHORT: WHEN_SHORT, NAMES: NAMES, label: label, name: name, toSearch: toSearch, matchList: matchList, calendar: calendar, setWhen: setWhen };

  var chat = document.getElementById('c-chat');
  if (!chat) return;

  // ---------------- one question card at a time ----------------
  var A = {}, cur = 0, furthest = 0, editing = false, HOMES = [], loaded = false, lastCount = null;
  var N = STEPS.length;
  var prev = V.getSearch();
  if (prev && prev.chat && prev.fromResults) { A = prev.chat; furthest = N; cur = N; }
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; }
  function question(s) { return T(A.stay === 'short' && s.qShort ? s.qShort : s.q); }
  function short() { return A.stay === 'short'; }
  function topOfStage() { var r = chat.getBoundingClientRect(); if (r.top < 70 || r.top > innerHeight * 0.5) window.scrollTo({ top: window.scrollY + r.top - 90, behavior: 'smooth' }); }

  function updatePanel() {
    var m = matchList(HOMES, A), n = m.length;
    ['c-cnt', 'c-pillcnt'].forEach(function (id) {
      var e = $(id); e.textContent = loaded ? n : '–';
      if (lastCount !== null && lastCount !== n) { e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump'); }
    });
    if (loaded) lastCount = n;
    $('c-cntlbl').textContent = short() ? (n === 1 ? T('short stay') : T('short stays')) : (n === 1 ? T('verified home') : T('verified homes'));
    $('c-pilllbl').textContent = short() ? T('stays match') : T('homes match');
    $('c-pillbtn').textContent = T('Show');
    var facts = $('c-facts'); facts.innerHTML = '';
    STEPS.forEach(function (s) { var l = label(A, s.k); if (!l) return; var li = el('li'); li.appendChild(el('span', '', name(s.k))); li.appendChild(el('span', '', l)); facts.appendChild(li); });
    var minis = $('c-minis');
    if (!loaded) { minis.innerHTML = V.skel.minis(3); return; }
    minis.innerHTML = '';
    if (!n) { var p = el('p', 'c-note'); p.innerHTML = short() ? T('No stays match yet. <a href="request.html">Tell us your dates</a> and we\'ll find one.') : T('No exact match yet. Remove a must-have, or <a href="request.html">let us find one for you</a>.'); minis.appendChild(p); return; }
    m.slice(0, 3).forEach(function (h) {
      var a = el('a', 'c-mini'); a.href = 'home.html?id=' + encodeURIComponent(h.id);
      var th = el('span', 'c-thumb'); if (h.photoList[0]) th.setAttribute('style', V.photoStyle(h.photoList[0])); a.appendChild(th);
      var t = el('span'); t.appendChild(el('span', 'c-verified', T('VERIFIED'))); t.appendChild(el('b', '', V.priceText(h))); t.appendChild(el('small', '', V.typeLabel(h) + ' · ' + h.area + (h.road ? ' · ' + h.road : '')));
      a.appendChild(t); minis.appendChild(a);
    });
  }

  function answersRow() {
    var row = el('div', 'q-chips');
    STEPS.forEach(function (s, i) {
      if (i >= furthest || i === cur) return;
      var l = label(A, s.k); if (!l) return;
      var b = el('button', 'q-ans'); b.type = 'button'; b.setAttribute('aria-label', T('Change') + ' ' + name(s.k));
      b.appendChild(el('small', '', name(s.k))); b.appendChild(el('b', '', l));
      b.addEventListener('click', function () { goTo(i, true); });
      row.appendChild(b);
    });
    return row.children.length ? row : null;
  }

  function render(dir) {
    chat.innerHTML = '';
    var r = answersRow(); if (r) chat.appendChild(r);
    chat.appendChild(cur >= N ? summary() : card(STEPS[cur], cur, dir));
    var pill = $('c-pill'); if (pill) pill.classList.toggle('hidden', cur >= N && short());
    updatePanel();
  }
  function goTo(i, edit) { cur = i; editing = !!edit; render('back'); topOfStage(); }
  function next(i) {
    if (editing) {
      // After a change, ask anything that now needs answering (e.g. budget after switching to a short stay)
      var miss = -1; for (var j = 0; j < Math.min(furthest, N); j++) { if (label(A, STEPS[j].k) === null) { miss = j; break; } }
      if (miss >= 0) cur = miss; else { editing = false; cur = furthest >= N ? N : furthest; }
    }
    else { furthest = Math.max(furthest, i + 1); cur = i + 1; }
    render('fwd'); topOfStage();
  }

  function card(s, i, dir) {
    var c = el('div', 'q-card c-glass' + (dir ? ' q-dir-' + dir : ''));
    var head = el('div', 'q-head');
    if (i > 0) {
      var back = el('button', 'q-back'); back.type = 'button';
      back.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12 4 6 10l6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      back.appendChild(document.createTextNode(T('Back')));
      back.addEventListener('click', function () { editing = false; cur = i - 1; render('back'); });
      head.appendChild(back);
    } else head.appendChild(el('span'));
    head.appendChild(el('span', 'q-count', T('Question {a} of {b}', { a: i + 1, b: N })));
    c.appendChild(head);
    var segs = el('div', 'q-segs'); segs.setAttribute('aria-hidden', 'true');
    for (var x = 0; x < N; x++) { var sg = el('i', x < i ? 'on' : x === i ? 'now' : ''); segs.appendChild(sg); }
    c.appendChild(segs);
    var h = el('h2', 'q-title', question(s)); h.id = 'q-title-' + i; c.appendChild(h);
    c.appendChild(input(s, i));
    return c;
  }

  function opt(text, on, sub) {
    var b = el('button', 'q-opt'); b.type = 'button'; b.setAttribute('aria-pressed', String(!!on));
    b.appendChild(el('span', 'q-opt-t', text)); if (sub) b.appendChild(el('small', '', sub));
    return b;
  }
  function pickAndGo(b, i, fn) { fn(); b.setAttribute('aria-pressed', 'true'); setTimeout(function () { next(i); }, 160); }

  function input(s, i) {
    var area = el('div', 'q-body');
    if (s.type === 'one') {
      var grid = el('div', 'q-opts' + (s.o.length <= 2 ? ' two' : ''));
      s.o.forEach(function (o) {
        var b = opt(T(o[1] || o[0]), A[s.k] === o[0], o[2] ? T(o[2]) : '');
        b.addEventListener('click', function () { pickAndGo(b, i, function () { if (s.k === 'stay' && A.stay !== o[0]) { delete A.budget; delete A.when; } A[s.k] = o[0]; }); });
        grid.appendChild(b);
      });
      area.appendChild(grid);
    } else if (s.type === 'many') {
      var pick = (A[s.k] || []).slice();
      area.appendChild(el('p', 'q-hint', T(s.hint)));
      var g2 = el('div', 'q-opts many');
      var go = el('button', 'btn btn-primary btn-pill', T('Continue')); go.type = 'button';
      function sync() { go.textContent = pick.length ? T('Continue with {n}', { n: pick.length }) : T('Continue'); }
      s.o.forEach(function (o) {
        var b = opt(T(o[0]), pick.indexOf(o[0]) >= 0); b.insertBefore(el('span', 'tick', '✓'), b.firstChild);
        b.addEventListener('click', function () {
          var j = pick.indexOf(o[0]);
          if (j >= 0) pick.splice(j, 1);
          else { if (pick.length >= s.max) { if (b.animate) b.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }], { duration: 220 }); return; } pick.push(o[0]); }
          b.setAttribute('aria-pressed', String(pick.indexOf(o[0]) >= 0)); A[s.k] = pick.slice(); updatePanel(); sync();
        });
        g2.appendChild(b);
      });
      area.appendChild(g2);
      var row = el('div', 'c-row'); sync();
      go.addEventListener('click', function () { A[s.k] = pick.slice(); next(i); });
      var skip = el('button', 'btn btn-pill c-ghost', T('Skip')); skip.type = 'button'; skip.addEventListener('click', function () { A[s.k] = []; next(i); });
      row.appendChild(go); row.appendChild(skip); area.appendChild(row);
    } else if (s.type === 'budget') {
      var g3 = el('div', 'q-opts');
      BUDGETS[A.stay || 'long'].forEach(function (o) {
        var b = opt(o[1].replace('Under ', T('Under') + ' '), A.budget === o[0], short() ? T('per night') : T('per month'));
        b.addEventListener('click', function () { pickAndGo(b, i, function () { A.budget = o[0]; }); });
        g3.appendChild(b);
      });
      area.appendChild(g3);
      area.appendChild(el('p', 'q-hint', T('Or type your own range (KES)')));
      var r2 = el('div', 'c-inputs');
      var f1 = el('label', 'c-field'); f1.innerHTML = '<span>' + T('Min') + '</span><input inputmode="numeric" placeholder="' + (short() ? '3,000' : '50,000') + '">';
      var f2 = el('label', 'c-field'); f2.innerHTML = '<span>' + T('Max') + '</span><input inputmode="numeric" placeholder="' + (short() ? '9,000' : '90,000') + '">';
      var ok = el('button', 'btn btn-pill c-ghost', T('Use range')); ok.type = 'button';
      ok.addEventListener('click', function () {
        var a = V.num(f1.querySelector('input').value) || 0, b = V.num(f2.querySelector('input').value) || 0;
        if (!a && !b) return; if (a && b && a > b) { var t = a; a = b; b = t; }
        A.budget = a + '-' + b; next(i);
      });
      r2.appendChild(f1); r2.appendChild(f2); r2.appendChild(ok); area.appendChild(r2);
    } else if (s.type === 'when') {
      var shortStay = short();
      var sk = el('button', 'btn btn-pill c-ghost', shortStay ? T('Not sure of my dates yet') : T('Not sure yet')); sk.type = 'button';
      sk.addEventListener('click', function () { delete A.checkin; delete A.checkout; delete A.when_iso; A.when = 'Flexible'; next(i); });
      if (shortStay) { datesFlow(area, i, sk); return area; }
      area.appendChild(calendar({ mode: 'single', start: A.when_iso, onPick: function (a) { setWhen(A, a); next(i); } }));
      area.appendChild(sk);
    }
    return area;
  }

  // Short stays: check-in calendar -> check-out calendar slides in (same card) -> "Are these your dates?"
  function datesFlow(area, i, skipBtn) {
    var ci = A.checkin || null, co = A.checkout || null;
    var title = function () { return area.parentNode && area.parentNode.querySelector('.q-title'); };
    function longDate(d) { return V.date(d, { weekday: 'short', day: 'numeric', month: 'short' }); }
    function addDay(d, n) { var x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return iso(x); }
    function nights() { return Math.round((new Date(co + 'T00:00:00') - new Date(ci + 'T00:00:00')) / 864e5); }
    function stepIn() {
      area.innerHTML = ''; area.className = 'q-body';
      var t = title(); if (t) { t.textContent = T('When do you check in?'); t.style.display = ''; }
      area.appendChild(el('p', 'q-hint', T('Pick your check-in date.')));
      area.appendChild(calendar({ mode: 'single', start: ci, note: T('Tap the day you arrive'), onPick: function (a) { ci = a; if (co && co <= ci) co = null; stepOut(true); } }));
      area.appendChild(skipBtn);
    }
    function stepOut(anim) {
      area.innerHTML = ''; area.className = 'q-body';
      var t = title(); if (t) { t.textContent = T('When do you leave?'); t.style.display = ''; }
      var strip = el('div', 'dt-strip');
      strip.innerHTML = '<span class="dt-ok">✓</span><span class="dt-txt"><small>' + V.esc(T('CHECK-IN')) + '</small><b>' + V.esc(longDate(ci)) + '</b></span>';
      var ch = el('button', 'dt-change', T('Change')); ch.type = 'button'; ch.addEventListener('click', stepIn); strip.appendChild(ch);
      area.appendChild(strip);
      var wrap = el('div', anim ? 'dt-slide' : '');
      wrap.appendChild(el('p', 'q-hint', T('Days before your check-in are greyed out.')));
      wrap.appendChild(calendar({ mode: 'single', start: co, min: addDay(ci, 1), mark: ci, note: T('Tap the day you leave'), onPick: function (b) { co = b; confirmDates(); } }));
      area.appendChild(wrap);
    }
    function tile(lbl, d, sub) {
      var dt = new Date(d + 'T00:00:00');
      return '<div class="dt-tile"><small>' + V.esc(lbl) + '</small><b>' + dt.getDate() + '</b><span>' + V.esc(V.date(d, { weekday: 'short' }) + ', ' + V.date(d, { month: 'short' })) + '</span><em>' + V.esc(sub) + '</em></div>';
    }
    function confirmDates() {
      area.innerHTML = ''; area.className = 'q-body';
      var t = title(); if (t) t.style.display = 'none';
      var n = nights(), box = el('div', 'dt-confirm');
      box.innerHTML = '<div class="dt-top"><small>' + V.esc(T('YOUR STAY')) + '</small><h3>' + V.esc(T('Are these your dates?')) + '</h3></div>' +
        '<div class="dt-tiles">' + tile(T('CHECK-IN'), ci, T('from 2:00 pm')) +
        '<div class="dt-mid"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>' + V.esc(T(n === 1 ? '{n} night' : '{n} nights', { n: n })) +
        '<svg class="dt-arrow" viewBox="0 0 44 10" aria-hidden="true"><path d="M0 5h40M36 1l4 4-4 4"/></svg></div>' +
        tile(T('CHECK-OUT'), co, T('by 11:00 am')) + '</div>';
      var acts = el('div', 'dt-acts');
      var yes = el('button', 'btn btn-primary btn-pill', T('Yes, these are my dates')); yes.type = 'button';
      yes.addEventListener('click', function () { setWhen(A, ci, co); next(i); });
      var no = el('button', 'btn btn-pill c-ghost', T('Change dates')); no.type = 'button'; no.addEventListener('click', stepIn);
      acts.appendChild(yes); acts.appendChild(no); box.appendChild(acts);
      area.appendChild(box);
    }
    // Coming back to edit: start on the confirm card if both dates are set
    if (ci && co) setTimeout(confirmDates, 0); else stepIn();
  }

  function summary() {
    var n = matchList(HOMES, A).length;
    var c = el('div', 'q-card q-sumcard c-glass q-dir-fwd');
    c.appendChild(el('h2', 'q-title', short() ? T('Here is what you chose') : T('Here\'s your search. Ready to see verified homes?')));
    var card = el('div', 'c-sum');
    STEPS.forEach(function (s, i) {
      var r = el('div', 'c-sum-row'); r.appendChild(el('span', 'k', name(s.k))); r.appendChild(el('span', 'v', label(A, s.k) || '–'));
      var b = el('button', '', T('Edit')); b.type = 'button'; b.setAttribute('aria-label', T('Edit') + ' ' + name(s.k));
      b.addEventListener('click', function () { goTo(i, true); });
      r.appendChild(b); card.appendChild(r);
    });
    var hint = el('div', 'c-sum-hint'); hint.appendChild(el('i'));
    var ht = el('span'); ht.appendChild(el('b', '', loaded ? String(n) : '…'));
    ht.appendChild(document.createTextNode(' ' + (short() ? (n === 1 ? T('stay matches') : T('stays match')) : (n === 1 ? T('verified home matches') : T('verified homes match')))));
    hint.appendChild(ht); if (!short()) card.appendChild(hint);   // short stays: no match-count box, just Find my stay
    var noMatch = loaded && !n;
    var go = el('a', 'btn btn-primary c-find'); go.href = noMatch ? 'request.html' : 'matches.html';
    go.innerHTML = '<span></span><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M3 9h11M10 4l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    go.querySelector('span').textContent = noMatch ? T('Find it for me') : (short() ? T('Find my stay') : T('Find my home'));
    go.addEventListener('click', function () { var s = toSearch(A); V.setSearch(s); });
    card.appendChild(go);
    var links = el('div', 'c-sum-links'); links.innerHTML = '<a href="request.html">' + T('Can\'t find it? We\'ll find it for you') + '</a><a class="quiet" href="owners.html">' + T('List your property') + '</a>';
    card.appendChild(links);
    c.appendChild(card);
    return c;
  }

  // Onboarding can start the chat with a choice already made (e.g. short stay)
  window.VSChat = { preset: function (p) { Object.keys(p).forEach(function (k2) { A[k2] = p[k2]; }); furthest = Math.max(furthest, 1); cur = 1; editing = false; render('fwd'); } };

  $('c-pillbtn').addEventListener('click', function () { var r = chat.querySelector('.q-sumcard') || chat.querySelector('.q-card'); if (r) r.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  render();
  V.loadListings().then(function (all) { HOMES = all; loaded = true; if (cur >= N) render(); else updatePanel(); })
    .catch(function () { loaded = true; $('c-cntlbl').textContent = T('listings could not load'); $('c-minis').innerHTML = ''; });
})();
