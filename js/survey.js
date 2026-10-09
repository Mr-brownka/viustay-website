// Field survey inside the admin page: fill interviews, read the dashboard, manage responses.
// Data lives in Supabase table survey_responses (admins only; see supabase/add-survey.sql).
(function () {
  var V, S, root, rows = [], loaded = false, view = 'dash', dashType = 'fam', listType = 'all';
  var form = { type: 'fam', answers: {}, place: '' };
  var DRAFT = 'vs-survey-draft';

  function $(s, r) { return (r || document).querySelector(s); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function qs(type) { return S[type].sections.reduce(function (a, s) { return a.concat(s.qs); }, []); }
  function q(type, id) { return qs(type).filter(function (x) { return x.id === id; })[0]; }
  function day(iso) { try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); } catch (e) { return ''; } }
  function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }

  function toast(msg) {
    var t = $('#s-toast');
    if (!t) { t = el('div', 's-toast'); t.id = 's-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('on');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('on'); }, 2600);
  }

  // ---------- drafts ----------
  function loadDraft() { try { var d = JSON.parse(localStorage.getItem(DRAFT) || 'null'); if (d && S[d.type]) form = d; } catch (e) {} }
  function saveDraft() { try { localStorage.setItem(DRAFT, JSON.stringify(form)); } catch (e) {} }
  function clearDraft() { try { localStorage.removeItem(DRAFT); } catch (e) {} }

  // ---------- data ----------
  function load() {
    return V.db.from('survey_responses').select('*').order('created_at', { ascending: false }).limit(1000).then(function (r) {
      if (r.error) throw r.error;
      rows = r.data || []; loaded = true;
    });
  }
  function answered(rs, id) { return rs.filter(function (r) { return r.answers && r.answers[id] !== undefined && r.answers[id] !== '' && r.answers[id] !== null; }); }
  function counts(rs, qq) {
    var c = {}; qq.o.forEach(function (o) { c[o] = 0; });
    answered(rs, qq.id).forEach(function (r) { var v = r.answers[qq.id]; (Array.isArray(v) ? v : [v]).forEach(function (x) { if (x in c) c[x]++; }); });
    return c;
  }
  function top(rs, type, id, n) {
    var qq = q(type, id), c = counts(rs, qq), base = answered(rs, id).length;
    return qq.o.filter(function (o) { return c[o] > 0; }).sort(function (a, b) { return c[b] - c[a]; }).slice(0, n || 1)
      .map(function (o) { return { o: o, n: c[o], p: pct(c[o], base) }; });
  }
  function share(rs, id, ok) {
    var a = answered(rs, id); var yes = a.filter(function (r) { return ok.indexOf(r.answers[id]) >= 0; }).length;
    return { p: pct(yes, a.length), yes: yes, base: a.length };
  }

  // ---------- shell ----------
  function shell() {
    root.innerHTML =
      '<div class="s-head">' +
        '<h1>Field survey</h1>' +
        '<div class="tabs" role="tablist" aria-label="Survey views">' +
          '<button type="button" role="tab" data-v="dash">Dashboard</button>' +
          '<button type="button" role="tab" data-v="new">New interview</button>' +
          '<button type="button" role="tab" data-v="list">Responses</button>' +
        '</div>' +
      '</div>' +
      '<p class="error hidden" id="s-err" role="alert"></p>' +
      '<div id="s-view"></div>';
    Array.prototype.forEach.call(root.querySelectorAll('[data-v]'), function (b) {
      b.addEventListener('click', function () { go(b.getAttribute('data-v')); });
    });
  }
  function go(v) {
    view = v;
    try { localStorage.setItem('vs-survey-view', v); } catch (e) {}
    Array.prototype.forEach.call(root.querySelectorAll('[data-v]'), function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-v') === v)); });
    var box = $('#s-view'); box.innerHTML = '';
    if (v === 'new') return renderForm(box);
    if (!loaded) { box.appendChild(el('p', 'note', 'Loading interviews…')); return; }
    if (v === 'dash') renderDash(box); else renderList(box);
  }
  function err(msg) { var e = $('#s-err'); e.textContent = msg || ''; e.classList.toggle('hidden', !msg); }

  function segmented(opts, cur, onPick, label) {
    var w = el('div', 'tabs s-seg'); w.setAttribute('role', 'tablist'); w.setAttribute('aria-label', label);
    opts.forEach(function (o) {
      var b = el('button', '', o[1]); b.type = 'button'; b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(o[0] === cur));
      b.addEventListener('click', function () { onPick(o[0]); });
      w.appendChild(b);
    });
    return w;
  }

  // ---------- dashboard ----------
  function kpi(label, value, sub, meter) {
    var k = el('div', 's-kpi');
    k.appendChild(el('span', 's-kpi-l', label));
    k.appendChild(el('b', 's-kpi-v', value));
    if (meter !== undefined) { var m = el('div', 's-meter'); var i = el('i'); i.style.width = Math.min(100, meter) + '%'; m.appendChild(i); k.appendChild(m); }
    if (sub) k.appendChild(el('span', 's-kpi-s', sub));
    return k;
  }
  function names(list) { return list.map(function (t) { return t.o + ' (' + t.p + '%)'; }).join(', '); }

  function renderDash(box) {
    var rs = rows.filter(function (r) { return r.type === dashType; });
    var tgt = S.targets[dashType], who = dashType === 'fam' ? 'families' : 'people';
    var bar = el('div', 's-bar');
    bar.appendChild(segmented([['fam', 'Families'], ['ind', 'Agents & landlords']], dashType, function (t) { dashType = t; go('dash'); }, 'Respondent type'));
    var add = el('button', 'btn btn-dark btn-pill', 'New interview'); add.type = 'button';
    add.addEventListener('click', function () { form.type = dashType; saveDraft(); go('new'); });
    bar.appendChild(add);
    box.appendChild(bar);

    if (!rs.length) {
      var e = el('div', 'box s-empty');
      e.appendChild(el('h2', '', 'No ' + (dashType === 'fam' ? 'family' : 'agent or landlord') + ' interviews yet'));
      e.appendChild(el('p', '', 'Save your first interview and this page fills in: headline numbers at the top, then a chart for every question.'));
      box.appendChild(e);
      return;
    }

    // Headline numbers
    var k = el('div', 's-kpis');
    k.appendChild(kpi('Interviews', rs.length + ' / ' + tgt, rs.length >= tgt ? 'Target reached' : (tgt - rs.length) + ' to go by 23 Oct', rs.length / tgt * 100));
    if (dashType === 'fam') {
      var vf = share(rs, 'v_fee', ['Fair', 'Fair only if homes are verified']);
      var pf = share(rs, 'v_place', ['Fair', 'Would pay more for full service']);
      var bud = top(rs, 'fam', 'f_budget')[0];
      k.appendChild(kpi('Accept KES 950 viewing fee', vf.base ? vf.p + '%' : '–', vf.base ? vf.yes + ' of ' + vf.base + ' families' : 'Not asked yet'));
      k.appendChild(kpi('Accept 10% placement fee', pf.base ? pf.p + '%' : '–', pf.base ? pf.yes + ' of ' + pf.base + ' families' : 'Not asked yet'));
      k.appendChild(kpi('Most common budget', bud ? 'KES ' + bud.o : '–', bud ? bud.p + '% of families' : 'Not asked yet'));
    } else {
      var op = share(rs, 'i_interest', ['Yes, ready now', 'Interested, needs details']);
      var ready = answered(rs, 'i_interest').filter(function (r) { return r.answers.i_interest === 'Yes, ready now'; }).length;
      var vac = top(rs, 'ind', 'i_vacancy')[0], pk = top(rs, 'ind', 'i_peak')[0];
      k.appendChild(kpi('Open to Viustay', op.base ? op.p + '%' : '–', op.base ? ready + ' ready now' : 'Not asked yet'));
      k.appendChild(kpi('Typical vacancy', vac ? vac.o : '–', vac ? vac.p + '% said this' : 'Not asked yet'));
      k.appendChild(kpi('Busiest month', pk ? pk.o : '–', pk ? pk.p + '% named it' : 'Not asked yet'));
    }
    box.appendChild(k);

    // What we're hearing
    var f = el('div', 'box s-find'); f.appendChild(el('h2', '', "What we're hearing"));
    var ul = el('ul'), lines = [];
    function line(label, list) { if (list.length) lines.push([label, names(list)]); }
    if (dashType === 'fam') {
      line('Top must-haves', top(rs, 'fam', 'f_must', 3));
      line('Main ways they search', top(rs, 'fam', 'j_channels', 3));
      line('Biggest frustrations', top(rs, 'fam', 'j_pains', 3));
      line('Who decides', top(rs, 'fam', 'f_decider', 1));
      line('What would build trust', top(rs, 'fam', 'v_trust', 2));
    } else {
      line('Who rents most', top(rs, 'ind', 'i_who', 2));
      line('How tenants find them', top(rs, 'ind', 'i_find', 3));
      line('Their biggest problems', top(rs, 'ind', 'i_pains', 3));
    }
    lines.forEach(function (l) { var li = el('li'); li.appendChild(el('b', '', l[0] + ': ')); li.appendChild(document.createTextNode(l[1])); ul.appendChild(li); });
    if (!lines.length) ul.appendChild(el('li', '', 'Answers will show here once the tap questions are filled.'));
    f.appendChild(ul); box.appendChild(f);

    // A chart for every question
    S[dashType].sections.forEach(function (sec) {
      var h = el('div', 's-sec'); h.appendChild(el('h2', '', sec.title)); h.appendChild(el('span', '', sec.tag)); box.appendChild(h);
      var grid = el('div', 's-grid');
      sec.qs.forEach(function (qq) { if (!qq.private) grid.appendChild(chart(rs, qq, who)); });
      box.appendChild(grid);
    });
  }

  function chart(rs, qq, who) {
    var card = el('div', 'box s-chart' + (qq.type === 'long' || qq.months ? ' wide' : ''));
    card.appendChild(el('h3', '', qq.t));
    var a = answered(rs, qq.id);
    card.appendChild(el('span', 'note', a.length + ' of ' + rs.length + ' answered' + (qq.type === 'many' ? ' · could pick several' : '')));
    if (qq.type === 'text' || qq.type === 'long') {
      var ul = el('ul', 's-quotes');
      a.slice(0, qq.type === 'long' ? 6 : 8).forEach(function (r) {
        var li = el('li', '', r.answers[qq.id]); li.appendChild(el('small', '', [day(r.created_at), r.place].filter(Boolean).join(' · '))); ul.appendChild(li);
      });
      if (!a.length) ul.appendChild(el('li', 's-none', 'No answers yet'));
      card.appendChild(ul);
      return card;
    }
    if (!a.length) { card.appendChild(el('p', 's-none-p', 'No answers yet')); return card; }
    var c = counts(rs, qq), max = 0; qq.o.forEach(function (o) { max = Math.max(max, c[o]); });
    if (qq.months) {
      var cols = el('div', 's-cols');
      qq.o.forEach(function (o) {
        var col = el('div', 's-col' + (c[o] === max && max ? ' top' : ''));
        col.setAttribute('data-tip', o + ': ' + c[o] + ' of ' + a.length + ' ' + who + ' (' + pct(c[o], a.length) + '%)');
        col.tabIndex = 0;
        var bwrap = el('div', 's-colbar'); var b = el('i'); b.style.height = (max ? c[o] / max * 100 : 0) + '%'; bwrap.appendChild(b);
        col.appendChild(el('span', 's-colv', c[o] ? String(c[o]) : ''));
        col.appendChild(bwrap); col.appendChild(el('span', 's-coll', o));
        cols.appendChild(col);
      });
      card.appendChild(cols);
      return card;
    }
    var order = qq.ord ? qq.o.slice() : qq.o.slice().sort(function (x, y) { return c[y] - c[x]; });
    var list = el('div', 's-bars');
    order.forEach(function (o) {
      var row = el('div', 's-row' + (c[o] === max && max ? ' top' : ''));
      row.setAttribute('data-tip', o + ': ' + c[o] + ' of ' + a.length + ' ' + who + ' (' + pct(c[o], a.length) + '%)');
      row.tabIndex = 0;
      var lab = el('div', 's-lab'); lab.appendChild(el('span', '', o));
      var tr = el('div', 's-track'); var b = el('i'); b.style.width = (max ? c[o] / max * 100 : 0) + '%'; tr.appendChild(b); lab.appendChild(tr);
      row.appendChild(lab);
      row.appendChild(el('span', 's-val', c[o] + ' · ' + pct(c[o], a.length) + '%'));
      list.appendChild(row);
    });
    card.appendChild(list);
    return card;
  }

  // Tooltip for chart rows (hover, keyboard focus, tap)
  function tipInit() {
    var tip = el('div', 's-tip'); tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip);
    function show(t, x, y) { tip.textContent = t; tip.classList.add('on'); var w = tip.offsetWidth; tip.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x - w / 2)) + 'px'; tip.style.top = (y - tip.offsetHeight - 10) + 'px'; }
    function hide() { tip.classList.remove('on'); }
    document.addEventListener('mousemove', function (e) { var t = e.target.closest && e.target.closest('[data-tip]'); if (t && root.contains(t)) show(t.getAttribute('data-tip'), e.clientX, e.clientY); else hide(); });
    document.addEventListener('focusin', function (e) { var t = e.target.closest && e.target.closest('[data-tip]'); if (t && root.contains(t)) { var r = t.getBoundingClientRect(); show(t.getAttribute('data-tip'), r.left + r.width / 2, r.top); } else hide(); });
    document.addEventListener('click', function (e) { var t = e.target.closest && e.target.closest('[data-tip]'); if (t && root.contains(t)) { var r = t.getBoundingClientRect(); show(t.getAttribute('data-tip'), r.left + r.width / 2, r.top); } });
    window.addEventListener('scroll', hide, { passive: true });
  }

  // ---------- form ----------
  function renderForm(box) {
    var who = el('div', 's-who');
    [['fam', 'Family', 'Group B or C · looking for 2–3 bed homes'], ['ind', 'Agent, caretaker or landlord', 'People who rent homes out']].forEach(function (o) {
      var b = el('button', 's-whob'); b.type = 'button'; b.setAttribute('aria-pressed', String(form.type === o[0]));
      b.appendChild(el('b', '', o[1])); b.appendChild(el('span', '', o[2]));
      b.addEventListener('click', function () { if (form.type === o[0]) return; form = { type: o[0], answers: {}, place: form.place }; saveDraft(); go('new'); });
      who.appendChild(b);
    });
    box.appendChild(who);

    var place = el('label', 'field s-place', 'Where did you meet them?');
    var pin = document.createElement('input'); pin.type = 'text'; pin.id = 's-place'; pin.placeholder = 'e.g. Parklands, building gate on Mpaka Rd'; pin.value = form.place || '';
    pin.addEventListener('input', function () { form.place = pin.value; saveDraft(); });
    place.appendChild(pin); box.appendChild(place);

    S[form.type].sections.forEach(function (sec) {
      var h = el('div', 's-sec'); h.appendChild(el('h2', '', sec.title)); h.appendChild(el('span', '', sec.tag)); box.appendChild(h);
      sec.qs.forEach(function (qq) { box.appendChild(question(qq)); });
    });

    var c = el('label', 'check s-consent');
    var cb = document.createElement('input'); cb.type = 'checkbox'; cb.id = 's-consent';
    c.appendChild(cb); c.appendChild(document.createTextNode(" They agreed to answer, and know the answers are for Viustay's research."));
    box.appendChild(c);

    var bar = el('div', 's-save');
    var cnt = el('span', 's-count'); cnt.id = 's-count';
    var clr = el('button', 'btn btn-outline btn-pill', 'Clear'); clr.type = 'button';
    var sv = el('button', 'btn btn-dark btn-pill', 'Save interview'); sv.type = 'button'; sv.id = 's-saveb';
    var armed = false;
    clr.addEventListener('click', function () {
      if (!armed) { armed = true; clr.textContent = 'Tap again to clear'; setTimeout(function () { armed = false; clr.textContent = 'Clear'; }, 2500); return; }
      form = { type: form.type, answers: {}, place: '' }; clearDraft(); go('new'); toast('Form cleared');
    });
    sv.addEventListener('click', save);
    bar.appendChild(cnt); bar.appendChild(clr); bar.appendChild(sv);
    box.appendChild(bar);
    count();
  }

  function question(qq) {
    var box = el('div', 'box s-q');
    box.appendChild(el('span', 's-qt', qq.t));
    if (qq.max) box.appendChild(el('span', 'note', 'Pick up to ' + qq.max));
    if (qq.type === 'one' || qq.type === 'many') {
      var chips = el('div', 'chips');
      qq.o.forEach(function (o) {
        var cur = form.answers[qq.id];
        var on = qq.type === 'one' ? cur === o : Array.isArray(cur) && cur.indexOf(o) >= 0;
        var b = el('button', 'chip', o); b.type = 'button'; b.setAttribute('aria-pressed', String(on));
        b.addEventListener('click', function () {
          if (qq.type === 'one') {
            form.answers[qq.id] = form.answers[qq.id] === o ? undefined : o;
            Array.prototype.forEach.call(chips.children, function (x) { x.setAttribute('aria-pressed', String(x.textContent === form.answers[qq.id])); });
          } else {
            var arr = Array.isArray(form.answers[qq.id]) ? form.answers[qq.id].slice() : [];
            var i = arr.indexOf(o);
            if (i >= 0) arr.splice(i, 1);
            else { if (qq.max && arr.length >= qq.max) { toast('Up to ' + qq.max + ' for this one'); return; } arr.push(o); }
            form.answers[qq.id] = arr.length ? arr : undefined;
            b.setAttribute('aria-pressed', String(arr.indexOf(o) >= 0));
          }
          saveDraft(); count();
        });
        chips.appendChild(b);
      });
      box.appendChild(chips);
    } else {
      var f = el('label', 'field');
      var inp = document.createElement(qq.type === 'long' ? 'textarea' : 'input');
      if (qq.type !== 'long') inp.type = 'text'; else inp.rows = 3;
      inp.id = 's-in-' + qq.id; inp.placeholder = qq.ph || ''; inp.value = form.answers[qq.id] || '';
      inp.setAttribute('aria-label', qq.t);
      inp.addEventListener('input', function () { form.answers[qq.id] = inp.value.trim() ? inp.value : undefined; saveDraft(); count(); });
      f.appendChild(inp); box.appendChild(f);
    }
    return box;
  }
  function count() {
    var all = qs(form.type), n = all.filter(function (x) { return form.answers[x.id] !== undefined; }).length;
    var c = $('#s-count'); if (c) c.textContent = n + ' of ' + all.length + ' answered';
  }
  function save() {
    var clean = {}; Object.keys(form.answers).forEach(function (k) { if (form.answers[k] !== undefined) clean[k] = form.answers[k]; });
    if (!Object.keys(clean).length) { toast('Answer at least one question first'); return; }
    if (!$('#s-consent').checked) { toast('Tick the consent box first'); $('#s-consent').focus(); return; }
    var b = $('#s-saveb'); b.disabled = true; b.textContent = 'Saving…';
    V.db.from('survey_responses').insert({ type: form.type, place: (form.place || '').trim(), answers: clean }).then(function (r) {
      if (r.error) throw r.error;
      var t = form.type; form = { type: t, answers: {}, place: '' }; clearDraft();
      return load().then(function () {
        var n = rows.filter(function (x) { return x.type === t; }).length;
        toast('Saved. That is ' + n + ' of ' + S.targets[t] + (t === 'fam' ? ' families' : ' agents & landlords'));
        go('new'); window.scrollTo(0, 0);
      });
    }).catch(function (e) {
      console.error(e);
      err(/survey_responses/.test(e.message || '') ? 'The survey table is missing. Run supabase/add-survey.sql in Supabase first.' : 'Could not save: ' + (e.message || 'check your connection and try again.'));
      b.disabled = false; b.textContent = 'Save interview';
    });
  }

  // ---------- responses ----------
  function headline(r) {
    var a = r.answers || {};
    if (r.type === 'fam') return [a.f_seg, a.f_beds, a.f_budget ? 'KES ' + a.f_budget : ''].filter(Boolean).join(' · ') || 'Family interview';
    return [a.i_role, Array.isArray(a.i_area) ? a.i_area.join(', ') : a.i_area].filter(Boolean).join(' · ') || 'Agent / landlord interview';
  }
  function renderList(box) {
    var bar = el('div', 's-bar');
    bar.appendChild(segmented([['all', 'All'], ['fam', 'Families'], ['ind', 'Agents & landlords']], listType, function (t) { listType = t; go('list'); }, 'Filter'));
    var dl = el('button', 'btn btn-outline btn-pill', 'Download CSV'); dl.type = 'button'; dl.addEventListener('click', csv);
    bar.appendChild(dl); box.appendChild(bar);
    var rs = rows.filter(function (r) { return listType === 'all' || r.type === listType; });
    if (!rs.length) { box.appendChild(el('div', 'box s-empty', 'Saved interviews appear here, newest first.')); return; }
    rs.forEach(function (r) {
      var d = el('details', 'box s-resp');
      var s = el('summary');
      s.appendChild(el('span', 's-tag' + (r.type === 'ind' ? ' ind' : ''), r.type === 'fam' ? 'Family' : 'Agent / landlord'));
      var t = el('span', 's-rt', headline(r)); t.appendChild(el('small', '', [day(r.created_at), r.place, r.created_by].filter(Boolean).join(' · ')));
      s.appendChild(t); d.appendChild(s);
      var dlist = el('dl');
      qs(r.type).forEach(function (qq) {
        var v = r.answers && r.answers[qq.id]; if (v === undefined) return;
        dlist.appendChild(el('dt', '', qq.t)); dlist.appendChild(el('dd', '', Array.isArray(v) ? v.join(', ') : v));
      });
      d.appendChild(dlist);
      var del = el('button', 'btn-link s-del', 'Delete this interview'); del.type = 'button';
      var armed = false;
      del.addEventListener('click', function () {
        if (!armed) { armed = true; del.textContent = 'Tap again to delete'; setTimeout(function () { armed = false; del.textContent = 'Delete this interview'; }, 2500); return; }
        V.db.from('survey_responses').delete().eq('id', r.id).then(function (x) {
          if (x.error) { toast('Could not delete: ' + x.error.message); return; }
          rows = rows.filter(function (y) { return y.id !== r.id; }); toast('Deleted'); go('list');
        });
      });
      d.appendChild(del);
      box.appendChild(d);
    });
  }
  function csv() {
    var rs = rows.filter(function (r) { return listType === 'all' || r.type === listType; });
    var cols = ['fam', 'ind'].filter(function (t) { return listType === 'all' || listType === t; }).reduce(function (a, t) { return a.concat(qs(t)); }, []);
    var esc = function (v) { v = v === undefined || v === null ? '' : (Array.isArray(v) ? v.join('; ') : String(v)); return '"' + v.replace(/"/g, '""') + '"'; };
    var lines = [['date', 'type', 'place', 'interviewer'].concat(cols.map(function (c) { return c.t; })).map(esc).join(',')];
    rs.forEach(function (r) {
      lines.push([r.created_at, r.type === 'fam' ? 'Family' : 'Agent/landlord', r.place, r.created_by].concat(cols.map(function (c) { return r.answers ? r.answers[c.id] : ''; })).map(esc).join(','));
    });
    var blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'viustay-survey-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  // ---------- public ----------
  var tipped = false;
  window.VSurvey = {
    open: function () {
      V = window.V; S = window.VS_SURVEY; root = $('#s-main');
      if (!tipped) { tipInit(); tipped = true; }
      loadDraft();
      if (!root.firstChild) shell();
      try { view = localStorage.getItem('vs-survey-view') || 'dash'; } catch (e) {}
      go(view);
      load().then(function () { err(); if (view !== 'new') go(view); }).catch(function (e) {
        console.error(e);
        err(/survey_responses|relation|schema cache/.test(e.message || '') ? 'The survey table is missing. Run supabase/add-survey.sql in Supabase, then refresh.' : 'Could not load interviews: ' + e.message);
      });
    }
  };
})();
