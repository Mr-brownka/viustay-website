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
  var NAMES = { stay: 'Stay', area: 'Area', beds: 'Bedrooms', budget: 'Budget', must: 'Must-haves', who: 'Moving in', when: 'Move-in' };

  function k(n) { return (n / 1000) + 'k'; }
  function label(A, key) {
    var v = A[key]; if (v === undefined || v === null || v === '') return null;
    if (key === 'budget') { var p = v.split('-').map(Number); return p[1] ? (p[0] ? k(p[0]) + '–' + k(p[1]) : 'Under ' + k(p[1])) : k(p[0]) + '+'; }
    if (key === 'must') return v.length ? v.join(', ') : 'No preference';
    var s = STEPS.filter(function (x) { return x.k === key; })[0];
    if (s && s.o) { var o = s.o.filter(function (x) { return x[0] === v; })[0]; return o ? (o[1] || o[0]) : v; }
    return v;
  }
  function toSearch(A) {
    var s = { chat: A, stay: A.stay || 'long', area: A.area && A.area !== 'Anywhere' ? A.area : '', bedrooms: A.beds !== undefined ? A.beds : '', must: A.must || [], who: A.who || '', movein: A.when || '', picked: [] };
    if (A.budget) { var p = A.budget.split('-').map(Number); s.min = p[0] || null; s.max = p[1] || null; }
    return s;
  }
  function matchList(all, A) {
    if (A.stay === 'short') return [];
    var s = toSearch(A);
    return all.filter(function (l) { return V.matches(l, s); });
  }
  window.VSSearch = { STEPS: STEPS, BUDGETS: BUDGETS, WHEN: WHEN, NAMES: NAMES, label: label, toSearch: toSearch, matchList: matchList };

  var chat = document.getElementById('c-chat');
  if (!chat) return;

  // ---------------- chat ----------------
  var A = {}, cur = 0, furthest = 0, editing = false, HOMES = [], lastCount = null;
  var prev = V.getSearch();
  if (prev && prev.chat && prev.fromResults) { A = prev.chat; furthest = STEPS.length; cur = STEPS.length; }
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; }
  function question(s) { return A.stay === 'short' && s.qShort ? s.qShort : s.q; }
  var LOGO = '<svg viewBox="0 0 40 46" aria-hidden="true"><path d="M10.5 17 20 9.5l9.5 7.5" fill="none" stroke="#F2A93B" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="m13.5 19.5 6.5 9.5 6.5-9.5" fill="none" stroke="#F4F1EB" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function botMsg(text, typing) {
    var b = el('div', 'c-bot'); var av = el('span', 'c-avatar'); av.innerHTML = LOGO; b.appendChild(av);
    if (typing) { var t = el('div', 'c-bubble c-typing'); t.innerHTML = '<i></i><i></i><i></i>'; b.appendChild(t); }
    else b.appendChild(el('div', 'c-bubble', text));
    return b;
  }
  function soft(n) { if (!n) return; var r = n.getBoundingClientRect(); if (r.bottom > innerHeight - 90 || r.top < 90) n.scrollIntoView({ behavior: 'smooth', block: 'center' }); }

  function updatePanel() {
    var m = matchList(HOMES, A), n = m.length;
    ['c-cnt', 'c-pillcnt'].forEach(function (id) {
      var e = $(id); e.textContent = HOMES.length ? n : '–';
      if (lastCount !== null && lastCount !== n) { e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump'); }
    });
    if (HOMES.length) lastCount = n;
    $('c-cntlbl').textContent = A.stay === 'short' ? 'short stays listed yet' : (n === 1 ? 'verified home' : 'verified homes');
    var facts = $('c-facts'); facts.innerHTML = '';
    STEPS.forEach(function (s) { var l = label(A, s.k); if (!l) return; var li = el('li'); li.appendChild(el('span', '', NAMES[s.k])); li.appendChild(el('span', '', l)); facts.appendChild(li); });
    var minis = $('c-minis'); minis.innerHTML = '';
    if (A.stay === 'short') { minis.appendChild(el('p', 'c-note', "We're onboarding short stays now. Finish the questions and we'll find one for you, usually within 48 hours.")); return; }
    if (HOMES.length && !n) { var p = el('p', 'c-note'); p.innerHTML = 'No exact match yet. Remove a must-have, or <a href="request.html">let us find one for you</a>.'; minis.appendChild(p); return; }
    m.slice(0, 3).forEach(function (h) {
      var a = el('a', 'c-mini'); a.href = 'home.html?id=' + encodeURIComponent(h.id);
      var th = el('span', 'c-thumb'); if (h.photoList[0]) th.setAttribute('style', V.photoStyle(h.photoList[0])); a.appendChild(th);
      var t = el('span'); t.appendChild(el('span', 'c-verified', 'VERIFIED')); t.appendChild(el('b', '', 'KES ' + V.money(h.rent) + ' / mo')); t.appendChild(el('small', '', V.typeLabel(h) + ' · ' + h.area + (h.road ? ' · ' + h.road : '')));
      a.appendChild(t); minis.appendChild(a);
    });
  }
  function progress() {
    var done = Math.min(furthest, STEPS.length);
    $('c-prog').style.width = (done / STEPS.length * 100) + '%';
    $('c-progtxt').textContent = done >= STEPS.length && !editing ? 'All set' : 'Question ' + (Math.min(cur, STEPS.length - 1) + 1) + ' of ' + STEPS.length;
  }

  function render(animate) {
    chat.innerHTML = '';
    var upto = Math.min(furthest, STEPS.length), finished = furthest >= STEPS.length;
    STEPS.forEach(function (s, i) {
      if (i > upto) return;
      var turn = el('div', 'c-turn');
      if (i === cur && !(finished && !editing)) {
        if (animate) {
          turn.appendChild(botMsg('', true)); chat.appendChild(turn);
          setTimeout(function () { turn.innerHTML = ''; turn.appendChild(botMsg(question(s))); turn.appendChild(input(s, i)); soft(turn); }, 650);
          return;
        }
        turn.appendChild(botMsg(question(s))); turn.appendChild(input(s, i)); chat.appendChild(turn); return;
      }
      if (i < upto || finished) {
        turn.appendChild(botMsg(question(s)));
        var mine = el('div', 'c-mine'); var e = el('button', '', 'Change'); e.type = 'button';
        e.addEventListener('click', function () { cur = i; editing = true; render(false); soft(chat.children[i]); });
        mine.appendChild(e); mine.appendChild(el('span', 'ans', label(A, s.k))); turn.appendChild(mine); chat.appendChild(turn);
      }
    });
    if (finished && !editing) chat.appendChild(summary());
    progress(); updatePanel();
  }
  function next(i) {
    if (editing) { editing = false; cur = Math.min(furthest, STEPS.length); render(false); soft(chat.lastChild); return; }
    furthest = Math.max(furthest, i + 1); cur = i + 1;
    if (cur >= STEPS.length) { render(false); soft(chat.lastChild); } else render(true);
  }
  function chip(text, on) { var c = el('button', 'chip c-chip', text); c.type = 'button'; c.setAttribute('aria-pressed', String(!!on)); return c; }

  function input(s, i) {
    var area = el('div', 'c-answer');
    if (s.type === 'one') {
      var chips = el('div', 'chips');
      s.o.forEach(function (o) {
        var c = chip(o[1] || o[0], A[s.k] === o[0]); if (o[2]) c.appendChild(el('small', '', o[2]));
        c.addEventListener('click', function () { A[s.k] = o[0]; if (s.k === 'stay') delete A.budget; c.setAttribute('aria-pressed', 'true'); setTimeout(function () { next(i); }, 180); });
        chips.appendChild(c);
      });
      area.appendChild(chips);
    } else if (s.type === 'many') {
      var pick = (A[s.k] || []).slice();
      area.appendChild(el('span', 'c-hint', s.hint));
      var wrap = el('div', 'chips');
      var go = el('button', 'btn btn-primary btn-pill', 'Continue'); go.type = 'button';
      function sync() { go.textContent = pick.length ? 'Continue with ' + pick.length : 'Continue'; }
      s.o.forEach(function (o) {
        var c = chip('', pick.indexOf(o[0]) >= 0); c.appendChild(el('span', 'tick', '✓')); c.appendChild(document.createTextNode(' ' + o[0]));
        c.addEventListener('click', function () {
          var j = pick.indexOf(o[0]);
          if (j >= 0) pick.splice(j, 1);
          else { if (pick.length >= s.max) { if (c.animate) c.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }], { duration: 220 }); return; } pick.push(o[0]); }
          c.setAttribute('aria-pressed', String(pick.indexOf(o[0]) >= 0)); A[s.k] = pick.slice(); updatePanel(); sync();
        });
        wrap.appendChild(c);
      });
      area.appendChild(wrap);
      var row = el('div', 'c-row'); sync();
      go.addEventListener('click', function () { A[s.k] = pick.slice(); next(i); });
      var skip = el('button', 'btn btn-pill c-ghost', 'Skip'); skip.type = 'button'; skip.addEventListener('click', function () { A[s.k] = []; next(i); });
      row.appendChild(go); row.appendChild(skip); area.appendChild(row);
    } else if (s.type === 'budget') {
      var bc = el('div', 'chips');
      BUDGETS[A.stay || 'long'].forEach(function (o) {
        var c = chip(o[1], A.budget === o[0]);
        c.addEventListener('click', function () { A.budget = o[0]; c.setAttribute('aria-pressed', 'true'); setTimeout(function () { next(i); }, 180); });
        bc.appendChild(c);
      });
      area.appendChild(bc);
      area.appendChild(el('span', 'c-hint', 'Or type your own range (KES)'));
      var r2 = el('div', 'c-inputs');
      var f1 = el('label', 'c-field'); f1.innerHTML = '<span>Min</span><input id="c-bmin" inputmode="numeric" placeholder="50,000">';
      var f2 = el('label', 'c-field'); f2.innerHTML = '<span>Max</span><input id="c-bmax" inputmode="numeric" placeholder="90,000">';
      var ok = el('button', 'btn btn-pill c-ghost', 'Use range'); ok.type = 'button';
      ok.addEventListener('click', function () {
        var a = V.num(f1.querySelector('input').value) || 0, b = V.num(f2.querySelector('input').value) || 0;
        if (!a && !b) return; if (a && b && a > b) { var t = a; a = b; b = t; }
        A.budget = a + '-' + b; next(i);
      });
      r2.appendChild(f1); r2.appendChild(f2); r2.appendChild(ok); area.appendChild(r2);
    } else if (s.type === 'when') {
      var wc = el('div', 'chips');
      WHEN.forEach(function (w) { var c = chip(w, A.when === w); c.addEventListener('click', function () { A.when = w; c.setAttribute('aria-pressed', 'true'); setTimeout(function () { next(i); }, 180); }); wc.appendChild(c); });
      area.appendChild(wc);
      var r3 = el('div', 'c-inputs'); var f = el('label', 'c-field'); f.innerHTML = '<span>Pick a date</span><input type="date" id="c-date" style="width:150px">';
      f.querySelector('input').addEventListener('change', function (e) { if (!e.target.value) return; A.when = new Date(e.target.value + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); next(i); });
      r3.appendChild(f); area.appendChild(r3);
    }
    return area;
  }

  function summary() {
    var turn = el('div', 'c-turn');
    var n = matchList(HOMES, A).length;
    turn.appendChild(botMsg(A.stay === 'short' ? "Thanks! Here's your search. Short stays are coming soon, and we'll find one for you." : "Here's your search. Ready to see verified homes?"));
    var area = el('div', 'c-answer');
    var card = el('div', 'c-sum');
    STEPS.forEach(function (s, i) {
      var r = el('div', 'c-sum-row'); r.appendChild(el('span', 'k', NAMES[s.k])); r.appendChild(el('span', 'v', label(A, s.k) || '–'));
      var b = el('button', '', 'Edit'); b.type = 'button'; b.setAttribute('aria-label', 'Edit ' + NAMES[s.k]);
      b.addEventListener('click', function () { cur = i; editing = true; render(false); soft(chat.children[i]); });
      r.appendChild(b); card.appendChild(r);
    });
    var hint = el('div', 'c-sum-hint'); hint.appendChild(el('i'));
    var ht = el('span'); ht.appendChild(el('b', '', A.stay === 'short' ? '0' : (HOMES.length ? String(n) : '…')));
    ht.appendChild(document.createTextNode(' ' + (A.stay === 'short' ? 'short stays listed yet' : (n === 1 ? 'verified home matches' : 'verified homes match'))));
    hint.appendChild(ht); card.appendChild(hint);
    var noMatch = A.stay === 'short' || (HOMES.length && !n);
    var go = el('a', 'btn btn-primary c-find'); go.href = noMatch ? 'request.html' : 'matches.html';
    go.innerHTML = '<span></span><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M3 9h11M10 4l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    go.querySelector('span').textContent = noMatch ? 'Find it for me' : 'Find my home';
    go.addEventListener('click', function () { var s = toSearch(A); V.setSearch(s); });
    card.appendChild(go);
    var links = el('div', 'c-sum-links'); links.innerHTML = '<a href="request.html">Can\'t find it? We\'ll find it for you</a><a class="quiet" href="owners.html">List your property</a>';
    card.appendChild(links);
    area.appendChild(card); turn.appendChild(area);
    return turn;
  }

  document.getElementById('c-pillbtn').addEventListener('click', function () { var r = chat.querySelector('.c-sum') || chat.lastChild; if (r) r.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  render(!furthest);
  V.loadListings().then(function (all) { HOMES = all; updatePanel(); if (furthest >= STEPS.length && !editing) render(false); })
    .catch(function () { $('c-cntlbl').textContent = 'listings could not load'; });
})();
