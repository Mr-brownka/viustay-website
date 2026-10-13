// Manager dashboard: Supabase email/password login, then Home, Units, Viewings and Profile.
// Managers can mark units let/vacant, change rent, pause, add a vacancy and say how a viewing went.
// They see which agent brings each viewing, never the tenant's name or phone. No fees here (finance handles those).
document.addEventListener('DOMContentLoaded', function () {
  var V = window.V;
  var T = window.VT || function (s, v) { return v ? s.replace(/\{(\w+)\}/g, function (m, k) { return v[k] !== undefined ? v[k] : m; }) : s; };
  var params = new URLSearchParams(window.location.search);
  var mode = params.get('signup') ? 'signup' : 'login';
  var authForm = V.$('#auth-form'), err = V.$('#auth-error'), info = V.$('#auth-info');
  if (params.get('email')) authForm.email.value = params.get('email');

  function msg(el, text) { el.textContent = text || ''; el.classList.toggle('hidden', !text); }
  function setMode(m) {
    mode = m;
    V.$('#auth-title').textContent = m === 'signup' ? T('Create your login') : T('Manager log in');
    V.$('#auth-submit').textContent = m === 'signup' ? T('Create login') : T('Log in');
    V.$('#toggle-mode').textContent = m === 'signup' ? T('Already have a login? Log in') : T('New here? Create a login');
    authForm.password.setAttribute('autocomplete', m === 'signup' ? 'new-password' : 'current-password');
    msg(err); msg(info);
  }
  setMode(mode);
  V.$('#toggle-mode').addEventListener('click', function () { setMode(mode === 'signup' ? 'login' : 'signup'); });

  // ---------- State ----------
  var S = { buildings: [], units: [], views: [], profile: {}, b: null, tab: 'home', filter: 'all', week: 0, day: null };
  try { S.tab = sessionStorage.getItem('vs-md-tab') || 'home'; } catch (e) {}

  // ---------- Small helpers ----------
  var ICON = {
    phone: '<svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    bulb: '<svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/></svg>',
    wa: '<svg viewBox="0 0 24 24"><path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/></svg>'
  };
  function esc(s) { return V.esc(s == null ? '' : String(s)); }
  function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function today() { return iso(new Date()); }
  function addDays(isoStr, n) { var d = new Date(isoStr + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); }
  function daysSince(isoStr) { if (!isoStr) return 0; return Math.max(0, Math.round((new Date(today() + 'T00:00:00') - new Date(isoStr + 'T00:00:00')) / 864e5)); }
  function mins(t) { var m = /(\d+):(\d+)\s*(AM|PM)?/i.exec(t || ''); if (!m) return 0; var h = +m[1] % 12; if (m[3] && /pm/i.test(m[3])) h += 12; if (!m[3] && +m[1] === 12) h = 12; return h * 60 + +m[2]; }
  function when(v) { return new Date(v.viewing_date + 'T00:00:00').getTime() + mins(v.viewing_time) * 6e4; }
  function lang() { return (window.VT && VT.lang && VT.lang()) === 'sw' ? 'sw-KE' : 'en-GB'; }
  function dayName(isoStr, opts) { return new Date(isoStr + 'T00:00:00').toLocaleDateString(lang(), opts || { weekday: 'short', day: 'numeric', month: 'short' }); }
  function shortTime(t) { return String(t || '').replace(/\s*(AM|PM)/i, function (m, p) { return ' ' + p.toLowerCase(); }); }
  function initials(name, email) {
    var n = String(name || '').trim();
    if (n) return n.split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();
    return String(email || '··').slice(0, 2).toUpperCase();
  }
  function firstName() { var n = String(S.profile.name || '').trim(); return n ? n.split(/\s+/)[0] : ''; }
  function toast(t) { var el = V.$('#toast'); el.textContent = t; el.classList.remove('hidden'); clearTimeout(toast.h); toast.h = setTimeout(function () { el.classList.add('hidden'); }, 2400); }
  function errText(e) {
    var m = (e && (e.message || e.msg)) || '';
    var map = { bad_rent: T('Enter a rent between KES 1,000 and 5,000,000.'), bad_label: T('Enter the unit name, e.g. C2.'), bad_type: T('Choose the unit type.'),
      label_taken: T('That unit is already on your list.'), bad_phone: T('Check the phone number.'), not_found: T('We could not find that. Please refresh.') };
    for (var k in map) if (m.indexOf(k) > -1) return map[k];
    return T('Something went wrong. Please try again.');
  }
  function rpc(name, args) {
    if (V.demo) return Promise.resolve(null);
    return V.db.rpc(name, args).then(function (r) { if (r.error) throw r.error; return r.data; });
  }

  // ---------- Building filter ----------
  function units() { return S.units.filter(function (u) { return !S.b || u.building_id === S.b.id; }); }
  function views() { return S.views.filter(function (v) { return !S.b || v.building_id === S.b.id; }); }
  function unitFor(v) { return S.units.filter(function (u) { return u.listing_id && u.listing_id === v.listing_id; })[0]; }
  function unitName(v) { var u = unitFor(v); return u ? T('Unit {u}', { u: u.label }) : (v.listing_title || v.listing_id); }
  function upcoming() {
    var now = Date.now() - 30 * 6e4;
    return views().filter(function (v) { return v.status !== 'done' && when(v) >= now; }).sort(function (a, b) { return when(a) - when(b); });
  }
  function isLive() { return units().some(function (u) { return u.listing_id; }); }

  // ---------- Sheet ----------
  function sheet(html, onOpen) {
    var wrap = V.$('#sheet'), card = V.$('#sheet-card');
    card.innerHTML = html; wrap.classList.remove('hidden');
    var close = function () { wrap.classList.add('hidden'); card.innerHTML = ''; };
    V.$$('[data-close]', card).forEach(function (b) { b.addEventListener('click', close); });
    wrap.onclick = function (e) { if (e.target === wrap) close(); };
    var first = card.querySelector('input, select'); if (first) setTimeout(function () { first.focus(); }, 50);
    if (onOpen) onOpen(card, close);
  }

  // ---------- Tabs ----------
  function go(tab) {
    S.tab = tab; try { sessionStorage.setItem('vs-md-tab', tab); } catch (e) {}
    V.$$('.md [data-tab]').forEach(function (b) { if (b.getAttribute('data-tab') === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    V.$$('[data-panel]').forEach(function (p) { p.classList.toggle('hidden', p.getAttribute('data-panel') !== tab); });
    render(); window.scrollTo(0, 0);
  }
  V.$$('.md [data-tab]').forEach(function (b) { b.addEventListener('click', function () { go(b.getAttribute('data-tab')); }); });
  V.$$('[data-go]').forEach(function (b) { b.addEventListener('click', function () { go(b.getAttribute('data-go')); }); });
  V.$$('[data-logout]').forEach(function (b) { b.addEventListener('click', logout); });
  function logout() {
    try { sessionStorage.removeItem('vs-md-tab'); } catch (e) {}
    if (V.demo) { window.location.href = 'owners.html'; return; }
    V.db.auth.signOut().then(function () { window.location.href = 'owners.html'; });
  }

  // ---------- Rendering ----------
  function render() {
    var who = initials(S.profile.name, S.profile.email);
    V.$('#me-av-side').textContent = who; V.$('#me-av-top').textContent = who;
    V.$('#me-name-side').textContent = S.profile.name || S.profile.email || '';
    drawBuildingPicker();
    if (S.tab === 'home') drawHome();
    else if (S.tab === 'units') drawUnits();
    else if (S.tab === 'viewings') drawViewings();
    else drawProfile();
    if (window.VT && VT.apply) VT.apply(V.$('#dash'));
  }

  function bOptions() { return S.buildings.map(function (b) { return '<option value="' + b.id + '"' + (S.b && S.b.id === b.id ? ' selected' : '') + '>' + esc(b.name) + '</option>'; }).join(''); }
  function drawBuildingPicker() {
    var side = V.$('#bsel-side');
    if (!S.buildings.length) { side.innerHTML = ''; return; }
    side.innerHTML = '<label>' + esc(T('Building')) + (S.buildings.length > 1 ? '<select id="bsel">' + bOptions() + '</select>' : '<b>' + esc(S.b.name) + '</b>') + '</label>';
    var sel = V.$('#bsel'); if (sel) sel.onchange = function () { pickBuilding(sel.value); };
  }
  function topPicker() {
    if (!S.buildings.length) return '';
    var inner = S.buildings.length > 1 ? '<select data-bsel>' + bOptions() + '</select>' : '<b>' + esc(S.b.name) + '</b>' + (S.b.location ? '<span class="dim">· ' + esc(S.b.location) + '</span>' : '');
    return '<div class="md-bsel-top">' + inner + '</div>';
  }
  function wirePicker(root) { V.$$('[data-bsel]', root).forEach(function (s) { s.onchange = function () { pickBuilding(s.value); }; }); }
  function pickBuilding(id) { S.b = S.buildings.filter(function (b) { return String(b.id) === String(id); })[0] || S.buildings[0]; try { localStorage.setItem('vs-md-b', S.b.id); } catch (e) {} render(); }

  function hello() {
    var h = new Date().getHours(), n = firstName();
    var g = h < 12 ? T('Good morning') : h < 17 ? T('Good afternoon') : T('Good evening');
    return n ? g + ', ' + esc(n) : g;
  }

  // ----- Home -----
  function drawHome() {
    var el = V.$('[data-panel="home"]');
    var bLine = S.b ? esc(S.b.name) + (S.b.location ? ', ' + esc(S.b.location) : '') : '';
    var head = '<div class="md-head"><div><h1>' + hello() + '</h1><p>' + esc(dayName(today(), { weekday: 'long', day: 'numeric', month: 'long' })) + (bLine ? ' · ' + bLine : '') + '</p></div>' +
      (S.b ? '<button type="button" class="md-btn sun" data-add>' + ICON.plus + esc(T('Add a vacancy')) + '</button>' : '') + '</div>';
    if (!isLive()) { el.innerHTML = head + topPicker() + setupHtml(); wireHome(el); return; }

    var us = units(), vac = us.filter(function (u) { return u.status === 'vacant'; }), let_ = us.filter(function (u) { return u.status === 'let'; });
    var wkStart = addDays(today(), -((new Date().getDay() + 6) % 7)), wkEnd = addDays(wkStart, 6);
    var thisWeek = views().filter(function (v) { return v.viewing_date >= wkStart && v.viewing_date <= wkEnd; });
    var avg = vac.length ? Math.round(vac.reduce(function (s, u) { return s + daysSince(u.vacant_since); }, 0) / vac.length) : 0;
    var up = upcoming();

    var stats = '<div class="md-stats">' +
      stat(T('Vacant units'), vac.length, T('of {n}', { n: us.length })) +
      stat(T('Viewings'), thisWeek.length, T('this week')) +
      stat(T('Let units'), let_.length, T('of {n}', { n: us.length })) +
      stat(T('Days empty'), avg, T('average for vacant units')) + '</div>';

    var list = up.slice(0, 5).map(function (v) {
      var dd = v.viewing_date === today() ? T('Today') : v.viewing_date === addDays(today(), 1) ? T('Tomorrow') : dayName(v.viewing_date, { weekday: 'short' });
      return '<div class="md-row"><span class="t">' + (v.viewing_date === today() ? esc(shortTime(v.viewing_time)) : esc(dd) + '<br><span class="dim" style="font-size:13px">' + esc(shortTime(v.viewing_time)) + '</span>') + '</span>' +
        '<span class="grow"><b>' + esc(unitName(v)) + '</b></span>' + agentMini(v) + statusPill(v) + '</div>';
    }).join('') || '<p class="md-empty">' + esc(T('No viewings booked yet. We will show them here as soon as clients book.')) + '</p>';

    var longest = vac.slice().sort(function (a, b) { return daysSince(b.vacant_since) - daysSince(a.vacant_since); }).slice(0, 4).map(function (u) {
      return '<div class="md-row"><span class="md-sq">' + esc(u.label) + '</span><span class="grow"><b>' + esc(u.type) + '</b><br><span class="dim">KES ' + V.money(u.rent) + '</span></span>' +
        daysBar(u) + '<button type="button" class="md-btn sm" data-rent="' + u.id + '">' + esc(T('Edit')) + '</button></div>';
    }).join('') || '<p class="md-empty">' + esc(T('Every unit is let. Well done!')) + '</p>';

    el.innerHTML = head + topPicker() +
      '<div class="md-hero">' + nextHtml(up[0]) + stats + '</div>' +
      '<div class="md-two"><div class="md-card"><div class="md-card-head"><h2>' + esc(T('Coming viewings')) + '</h2><button type="button" class="md-link" data-go2="viewings">' + esc(T('See all')) + '</button></div>' + list + '</div>' +
      '<div class="md-card"><div class="md-card-head"><h2>' + esc(T('Empty the longest')) + '</h2><button type="button" class="md-link" data-go2="units">' + esc(T('All units')) + '</button></div>' + longest + '</div></div>' +
      tipHtml(vac);
    wireHome(el);
  }
  function stat(label, n, sub) { return '<div class="md-stat"><small>' + esc(label) + '</small><b>' + n + '</b><span>' + esc(sub) + '</span></div>'; }
  function daysBar(u) {
    var d = daysSince(u.vacant_since), hot = d > 20;
    return '<span class="md-days"><span class="bar" style="display:block"><i style="width:' + Math.min(100, Math.max(4, d * 3)) + '%;background:' + (hot ? '#E24B4A' : '#F2A93B') + '"></i></span>' +
      '<span style="color:' + (hot ? '#A32D2D' : '#9A5B05') + '">' + esc(d === 0 ? T('Empty from today') : d === 1 ? T('1 day empty') : T('{n} days empty', { n: d })) + '</span></span>';
  }
  function agentMini(v) {
    if (!v.agent_name) return '<span class="dim" style="font-size:13px;width:150px;flex:none">' + esc(T('Agent being arranged')) + '</span>';
    return '<span style="display:flex;align-items:center;gap:8px;width:150px;flex:none">' + face(v, true) + '<span style="line-height:1.25">' + esc(v.agent_name.split(' ')[0]) + (v.agent_plate ? '<br><span class="plate">' + esc(v.agent_plate) + '</span>' : '') + '</span></span>';
  }
  function face(v, sm) {
    var st = v.agent_photo ? ' style="background-image:url(\'' + esc(v.agent_photo) + '\')"' : '';
    return '<span class="face' + (sm ? ' sm' : '') + '"' + st + '>' + (v.agent_photo ? '' : esc(initials(v.agent_name))) + '</span>';
  }
  function statusPill(v) {
    if (v.status === 'done') return '<span class="pill p-ok">' + esc(T('Done')) + '</span>';
    if (v.agent_name) return '<span class="pill p-due">' + esc(T('Coming')) + '</span>';
    return '<span class="pill p-pau">' + esc(T('Booked')) + '</span>';
  }
  function countdown(v) {
    var ms = when(v) - Date.now();
    if (v.viewing_date === today()) { if (ms <= 0) return T('Now'); var h = Math.floor(ms / 36e5), m = Math.round((ms % 36e5) / 6e4); return h ? T('in {h} h {m} min', { h: h, m: m }) : T('in {m} min', { m: m }); }
    if (v.viewing_date === addDays(today(), 1)) return T('Tomorrow');
    return T('in {n} days', { n: Math.round((new Date(v.viewing_date + 'T00:00:00') - new Date(today() + 'T00:00:00')) / 864e5) });
  }
  function nextHtml(v) {
    if (!v) return '<div class="md-next none"><span class="k">' + esc(T('Next viewing')) + '</span><h2>' + esc(T('No viewings booked yet')) + '</h2><p class="dim" style="margin:0">' + esc(T('When a client books one of your units, you will see the day, time and the agent bringing them right here.')) + '</p></div>';
    var u = unitFor(v);
    var dd = v.viewing_date === today() ? T('Today') : v.viewing_date === addDays(today(), 1) ? T('Tomorrow') : dayName(v.viewing_date);
    var who = v.agent_name
      ? '<div class="who">' + face(v) + '<span><b>' + esc(T('{name} · your agent', { name: v.agent_name })) + '</b><br><span style="opacity:.85">' + esc(v.agent_car || '') + ' </span>' + (v.agent_plate ? '<span class="plate">' + esc(v.agent_plate) + '</span>' : '') + '</span>' +
        (v.agent_phone ? '<a class="call" href="tel:' + esc(v.agent_phone) + '" aria-label="' + esc(T('Call the agent')) + '">' + ICON.phone + '</a>' : '') + '</div>' +
        '<div class="tell">' + esc(T('Tell your caretaker: {name} arrives at the gate with the client.', { name: v.agent_name.split(' ')[0] })) + '</div>'
      : '<div class="who"><span class="face" style="background:rgba(255,255,255,.18);border-color:rgba(255,255,255,.4)">?</span><span>' + esc(T('We are assigning an agent. You will see their name, car and plate here.')) + '</span></div>';
    return '<div class="md-next"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span class="k">' + esc(T('Next viewing')) + '</span>' + (v.viewing_date === today() ? '<span class="cnt">' + esc(countdown(v)) + '</span>' : '') + '</div>' +
      '<h2>' + esc(dd) + ' · ' + esc(shortTime(v.viewing_time)) + '</h2><div class="sub">' + esc(unitName(v)) + (u ? ' · ' + esc(u.type) : '') + '</div>' + who + '</div>';
  }
  function tipHtml(vac) {
    var u = vac.filter(function (x) { return daysSince(x.vacant_since) >= 14; }).sort(function (a, b) { return daysSince(b.vacant_since) - daysSince(a.vacant_since); })[0];
    if (!u) return '';
    try { if (localStorage.getItem('vs-md-tip-' + u.id) === today()) return ''; } catch (e) {}
    return '<div class="md-card md-tip"><span class="md-sq">' + ICON.bulb + '</span><span class="grow"><b>' + esc(T('Tip: {u} has been empty {n} days', { u: u.label, n: daysSince(u.vacant_since) })) + '</b><br><span class="dim">' +
      esc(T('Units with a short video get more viewings. We can film it on our next visit.')) + '</span></span>' +
      '<button type="button" class="md-btn" data-tipoff="' + u.id + '">' + esc(T('Not now')) + '</button><a class="md-btn sun" target="_blank" rel="noopener" href="' +
      V.wa('Hi Viustay, please film a short video of unit ' + u.label + (S.b ? ' at ' + S.b.name : '') + '.') + '">' + esc(T('Book a video')) + '</a></div>';
  }
  function setupHtml() {
    var p = S.profile, hasB = S.buildings.length > 0 || !!p.submitted_building, hasU = units().length > 0;
    var visit = p.visit_date ? dayName(p.visit_date) : '';
    var steps = [
      ['done', T('Account created'), p.email || ''],
      [hasB ? 'done' : 'now', T('Building details sent'), hasB ? (S.b ? S.b.name : p.submitted_building) : T('Tell us about your building')],
      [hasU ? 'done' : hasB ? 'now' : 'todo', T('Photo visit'), visit ? T('{d} · our agent takes photos and a short video', { d: visit }) : T('We will call you to book a day')],
      [hasU ? 'done' : 'todo', T('Units added'), hasU ? T('{n} units · {v} vacant', { n: units().length, v: units().filter(function (u) { return u.status === 'vacant'; }).length }) : T('We add them after our visit')],
      ['todo', T('Listed on Viustay'), T('Families can book viewings')]
    ];
    var done = steps.filter(function (s) { return s[0] === 'done'; }).length;
    var next = steps.filter(function (s) { return s[0] === 'now'; })[0];
    return '<div class="md-hero"><div class="md-setup"><div style="display:flex;justify-content:space-between"><span class="k">' + esc(T('Getting set up')) + '</span><b>' + esc(T('{a} of {b}', { a: done, b: 5 })) + '</b></div>' +
      '<div class="bar"><i style="width:' + (done / 5 * 100) + '%;background:#F2A93B"></i></div>' +
      '<div style="font-size:15px;line-height:1.45">' + esc(T('Next:')) + ' <b>' + esc(next ? next[1] : '') + '</b>' + (next && next[2] ? ' · ' + esc(next[2]) : '') + '</div>' +
      '<p style="margin:12px 0 0;opacity:.85;font-size:14px">' + esc(T('Your units, viewings and agents will show here once your building is live.')) + '</p></div>' +
      '<div class="md-card md-steps">' + steps.map(function (s) {
        return '<div class="md-step s-' + s[0] + '"><i class="s-' + s[0] + '">' + (s[0] === 'done' ? '✓' : '') + '</i><span><b>' + esc(s[1]) + '</b><br><span class="dim" style="font-size:13px">' + esc(s[2]) + '</span></span></div>';
      }).join('') + '</div></div>' +
      '<a class="md-btn" style="align-self:flex-start" target="_blank" rel="noopener" href="' + V.wa('Hi Viustay, a question about setting up my building') + '">' + ICON.wa + esc(T('Questions? WhatsApp us')) + '</a>';
  }
  function wireHome(el) {
    wirePicker(el);
    V.$$('[data-go2]', el).forEach(function (b) { b.onclick = function () { go(b.getAttribute('data-go2')); }; });
    V.$$('[data-add]', el).forEach(function (b) { b.onclick = addSheet; });
    V.$$('[data-rent]', el).forEach(function (b) { b.onclick = function () { rentSheet(byId(b.getAttribute('data-rent'))); }; });
    V.$$('[data-tipoff]', el).forEach(function (b) { b.onclick = function () { try { localStorage.setItem('vs-md-tip-' + b.getAttribute('data-tipoff'), today()); } catch (e) {} render(); }; });
  }

  // ----- Units -----
  function byId(id) { return S.units.filter(function (u) { return String(u.id) === String(id); })[0]; }
  function drawUnits() {
    var el = V.$('[data-panel="units"]'), us = units();
    var c = { all: us.length, vacant: 0, let: 0, paused: 0 };
    us.forEach(function (u) { if (u.status === 'let') c.let++; else if (u.paused) c.paused++; else c.vacant++; });
    var shown = us.filter(function (u) { return S.filter === 'all' || (S.filter === 'let' ? u.status === 'let' : S.filter === 'paused' ? u.status === 'vacant' && u.paused : u.status === 'vacant' && !u.paused); })
      .sort(function (a, b) { var r = function (u) { return u.status === 'let' ? 2 : u.paused ? 1 : 0; }; return r(a) - r(b) || daysSince(b.vacant_since) - daysSince(a.vacant_since) || String(a.label).localeCompare(String(b.label)); });
    var chip = function (k, label) { return '<button type="button" data-f="' + k + '" aria-pressed="' + (S.filter === k) + '">' + esc(label) + ' ' + c[k] + '</button>'; };
    el.innerHTML = '<div class="md-head"><div><h1>' + esc(T('Units')) + '</h1><p>' + esc(S.b ? S.b.name : '') + '</p></div>' +
      (S.b ? '<button type="button" class="md-btn sun" data-add>' + ICON.plus + esc(T('Add vacancy')) + '</button>' : '') + '</div>' + topPicker() +
      '<div class="md-chips">' + chip('all', T('All')) + chip('vacant', T('Vacant')) + chip('let', T('Let')) + chip('paused', T('Paused')) + '</div>' +
      (shown.length ? '<div class="md-units">' + shown.map(unitCard).join('') + '</div>' : '<div class="md-card md-empty">' + esc(us.length ? T('No units in this list.') : T('No units yet. We add them after our visit, or tap "Add vacancy".')) + '</div>');
    wirePicker(el);
    V.$$('[data-f]', el).forEach(function (b) { b.onclick = function () { S.filter = b.getAttribute('data-f'); drawUnits(); }; });
    V.$$('[data-add]', el).forEach(function (b) { b.onclick = addSheet; });
    V.$$('[data-act]', el).forEach(function (b) {
      b.onclick = function () {
        var u = byId(b.getAttribute('data-id')), a = b.getAttribute('data-act');
        if (a === 'rent') rentSheet(u);
        else if (a === 'let') confirmSheet(T('Mark {u} as let?', { u: u.label }), T('It comes off Viustay and no new viewings are booked.'), T('Yes, it is let'), { status: 'let' }, u, T('{u} marked as let', { u: u.label }));
        else if (a === 'vacant') confirmSheet(T('Mark {u} as vacant?', { u: u.label }), T('We start bringing clients to view it again.'), T('Yes, it is vacant'), { status: 'vacant' }, u, T('{u} marked as vacant', { u: u.label }));
        else if (a === 'pause') confirmSheet(T('Pause {u}?', { u: u.label }), T('It stays vacant but we stop booking viewings until you resume.'), T('Pause viewings'), { paused: true }, u, T('{u} paused', { u: u.label }));
        else if (a === 'resume') save(u, { paused: false }, T('{u} is open for viewings again', { u: u.label }));
      };
    });
  }
  function unitCard(u) {
    var st = u.status === 'let' ? ['p-let', T('Let')] : u.paused ? ['p-pau', T('Paused')] : !u.listing_id ? ['p-new', T('Waiting for photos')] : ['p-vac', T('Vacant')];
    var next = u.listing_id ? views().filter(function (v) { return v.listing_id === u.listing_id && v.status !== 'done' && v.viewing_date >= today(); }).length : 0;
    var btn = function (a, label, cls) { return '<button type="button" class="md-btn sm' + (cls ? ' ' + cls : '') + '" data-act="' + a + '" data-id="' + u.id + '">' + esc(label) + '</button>'; };
    var acts = u.status === 'let'
      ? btn('vacant', T('Mark vacant')) + btn('rent', T('Edit rent'))
      : btn('let', T('Mark let'), 'sun') + btn('rent', T('Edit rent')) + (u.paused ? btn('resume', T('Resume')) : btn('pause', T('Pause')));
    return '<div class="md-card md-unit"><div class="top"><span class="md-sq">' + esc(u.label) + '</span><span class="grow"><b>' + esc(u.type) + '</b><br><span class="dim" style="font-size:13px">' +
      esc(T('KES {r} / month', { r: V.money(u.rent) })) + '</span></span><span class="pill ' + st[0] + '">' + esc(st[1]) + '</span></div>' +
      (u.status === 'vacant' ? '<div class="daysrow">' + daysBar(u).replace('class="md-days"', 'class="md-days" style="width:auto;flex:1;display:flex;align-items:center;gap:8px"').replace('display:block', 'display:block;flex:1') + '</div>' : '') +
      '<div class="acts">' + acts + (next ? '<span class="dim" style="font-size:13px">' + esc(next === 1 ? T('1 viewing booked') : T('{n} viewings booked', { n: next })) + '</span>' : '') + '</div></div>';
  }
  function save(u, patch, done, close) {
    var p = rpc('manager_update_unit', { p_id: u.id, p: patch });
    return p.then(function (r) {
      if (r) { u.status = r.status; u.rent = r.rent; u.paused = r.paused; u.vacant_since = r.vacant_since; }
      else { // demo
        if (patch.status) { if (patch.status !== u.status) u.vacant_since = patch.status === 'vacant' ? today() : null; u.status = patch.status; if (patch.status === 'let') u.paused = false; }
        if (patch.rent) u.rent = patch.rent; if ('paused' in patch) u.paused = patch.paused;
      }
      if (close) close(); toast(done); render();
    });
  }
  function confirmSheet(title, sub, yes, patch, u, done) {
    sheet('<h2>' + esc(title) + '</h2><p>' + esc(sub) + '</p><p class="err hidden" data-err></p><div class="row"><button type="button" class="md-btn" data-close>' + esc(T('Cancel')) + '</button><button type="button" class="md-btn dark" data-yes>' + esc(yes) + '</button></div>', function (card, close) {
      var b = V.$('[data-yes]', card);
      b.onclick = function () { b.disabled = true; save(u, patch, done, close).catch(function (e) { b.disabled = false; var er = V.$('[data-err]', card); er.textContent = errText(e); er.classList.remove('hidden'); }); };
    });
  }
  function rentSheet(u) {
    sheet('<h2>' + esc(T('Rent for {u}', { u: u.label })) + '</h2><p>' + esc(T('We update your listing with the new rent.')) + '</p>' +
      '<label>' + esc(T('Monthly rent (KES)')) + '<input type="number" inputmode="numeric" min="1000" step="500" value="' + (u.rent || '') + '" data-rentin></label><p class="err hidden" data-err></p>' +
      '<div class="row"><button type="button" class="md-btn" data-close>' + esc(T('Cancel')) + '</button><button type="button" class="md-btn dark" data-yes>' + esc(T('Save rent')) + '</button></div>', function (card, close) {
      var b = V.$('[data-yes]', card), inp = V.$('[data-rentin]', card), er = V.$('[data-err]', card);
      b.onclick = function () {
        var r = parseInt(inp.value, 10);
        if (!(r >= 1000 && r <= 5000000)) { er.textContent = errText({ message: 'bad_rent' }); er.classList.remove('hidden'); return; }
        b.disabled = true;
        save(u, { rent: r }, T('Rent saved'), close).catch(function (e) { b.disabled = false; er.textContent = errText(e); er.classList.remove('hidden'); });
      };
    });
  }
  function addSheet() {
    if (!S.b) return;
    var types = ['Bedsitter', 'Studio', '1 bedroom', '2 bedrooms', '3 bedrooms', '4+ bedrooms'];
    sheet('<h2>' + esc(T('Add a vacancy')) + '</h2><p>' + esc(T('Tell us which unit is empty. We visit to take photos, then list it.')) + '</p>' +
      '<div class="row"><label>' + esc(T('Unit')) + '<input type="text" maxlength="20" placeholder="' + esc(T('e.g. C2')) + '" data-l></label>' +
      '<label>' + esc(T('Type')) + '<select data-t>' + types.map(function (t) { return '<option>' + esc(T(t)) + '</option>'; }).join('') + '</select></label></div>' +
      '<label>' + esc(T('Monthly rent (KES)')) + '<input type="number" inputmode="numeric" min="1000" step="500" data-r></label><p class="err hidden" data-err></p>' +
      '<div class="row"><button type="button" class="md-btn" data-close>' + esc(T('Cancel')) + '</button><button type="button" class="md-btn dark" data-yes>' + esc(T('Add vacancy')) + '</button></div>', function (card, close) {
      var b = V.$('[data-yes]', card), er = V.$('[data-err]', card);
      var fail = function (code) { er.textContent = errText({ message: code }); er.classList.remove('hidden'); };
      b.onclick = function () {
        var l = V.$('[data-l]', card).value.trim().toUpperCase(), t = types[V.$('[data-t]', card).selectedIndex], r = parseInt(V.$('[data-r]', card).value, 10);
        if (!l) return fail('bad_label');
        if (!(r >= 1000 && r <= 5000000)) return fail('bad_rent');
        if (units().some(function (u) { return String(u.label).toUpperCase() === l; })) return fail('label_taken');
        b.disabled = true;
        rpc('manager_add_unit', { p_building: S.b.id, p_label: l, p_type: t, p_rent: r }).then(function (res) {
          S.units.push({ id: res ? res.id : Date.now(), building_id: S.b.id, label: l, type: t, rent: r, status: 'vacant', vacant_since: today(), listing_id: null, paused: false, added_by_manager: true });
          close(); toast(T('{u} added. We will call you to book the photo visit.', { u: l })); S.filter = 'all'; go('units');
        }).catch(function (e) { b.disabled = false; er.textContent = errText(e); er.classList.remove('hidden'); });
      };
    });
  }

  // ----- Viewings -----
  function drawViewings() {
    var el = V.$('[data-panel="viewings"]');
    var monday = addDays(today(), -((new Date().getDay() + 6) % 7) + S.week * 7);
    if (!S.day || S.day < monday || S.day > addDays(monday, 6)) {
      S.day = S.week === 0 ? today() : monday;
      if (S.week !== 0) { for (var i = 0; i < 7; i++) { if (views().some(function (v) { return v.viewing_date === addDays(monday, i); })) { S.day = addDays(monday, i); break; } } }
    }
    var vs = views();
    var week = '';
    for (var d = 0; d < 7; d++) {
      var day = addDays(monday, d), n = vs.filter(function (v) { return v.viewing_date === day; }).length;
      week += '<button type="button" class="md-day' + (day === today() ? ' today' : '') + '" data-day="' + day + '" aria-pressed="' + (day === S.day) + '"><span>' + esc(dayName(day, { weekday: 'short' })) + '</span><b>' +
        new Date(day + 'T00:00:00').getDate() + '</b><span class="dots">' + new Array(Math.min(n, 4) + 1).join('<i></i>') + '</span></button>';
    }
    var list = vs.filter(function (v) { return v.viewing_date === S.day; }).sort(function (a, b) { return mins(a.viewing_time) - mins(b.viewing_time); });
    var weekCount = vs.filter(function (v) { return v.viewing_date >= monday && v.viewing_date <= addDays(monday, 6); }).length;
    var monthName = new Date(monday + 'T00:00:00').toLocaleDateString(lang(), { month: 'long' });
    el.innerHTML = '<div class="md-head"><div><h1>' + esc(T('Viewings')) + '</h1><p>' + esc(monthName) + ' · ' + esc(T('{n} this week', { n: weekCount })) + '</p></div>' +
      (S.week !== 0 ? '<button type="button" class="md-link" data-wk="0">' + esc(T('Back to this week')) + '</button>' : '') + '</div>' + topPicker() +
      '<div class="md-week"><button type="button" class="nav" data-wk="-1" aria-label="' + esc(T('Previous week')) + '">‹</button>' + week + '<button type="button" class="nav" data-wk="1" aria-label="' + esc(T('Next week')) + '">›</button></div>' +
      '<div class="md-chips" style="justify-content:space-between;align-items:center"><span class="k">' + esc(S.day === today() ? T('Today') + ' · ' + dayName(S.day, { weekday: 'long' }) : dayName(S.day, { weekday: 'long', day: 'numeric', month: 'short' })) + '</span>' +
      '<span><button type="button" data-wk="-1" class="md-link md-wk-phone">‹ ' + esc(T('Last week')) + '</button> &nbsp; <button type="button" data-wk="1" class="md-link md-wk-phone">' + esc(T('Next week')) + ' ›</button></span></div>' +
      '<div class="md-agenda">' + (list.map(slotHtml).join('') || '<div class="md-card md-empty">' + esc(T('No viewings on this day.')) + '</div>') + '</div>' +
      '<p class="dim" style="font-size:13px;margin:0">' + esc(T('Client contacts stay with Viustay. Our agent coordinates each viewing with your caretaker.')) + '</p>';
    wirePicker(el);
    V.$$('[data-day]', el).forEach(function (b) { b.onclick = function () { S.day = b.getAttribute('data-day'); drawViewings(); }; });
    V.$$('[data-wk]', el).forEach(function (b) { b.onclick = function () { var w = +b.getAttribute('data-wk'); S.week = w === 0 ? 0 : S.week + w; S.day = null; drawViewings(); }; });
    V.$$('[data-out]', el).forEach(function (b) {
      b.onclick = function () {
        var v = S.views.filter(function (x) { return String(x.id) === b.getAttribute('data-vid'); })[0], o = b.getAttribute('data-out');
        var val = v.owner_outcome === o ? null : o;
        rpc('manager_viewing_outcome', { p_id: v.id, p_outcome: val }).then(function () { v.owner_outcome = val; drawViewings(); if (val) toast(T('Thanks, noted')); })
          .catch(function (e) { toast(errText(e)); });
      };
    });
  }
  function slotHtml(v) {
    var u = unitFor(v), past = v.status === 'done' || when(v) < Date.now();
    var agent = v.agent_name
      ? '<div class="md-agent">' + face(v, true) + '<span class="grow"><b>' + esc(v.agent_name) + '</b>' + (v.agent_car ? ' · ' + esc(v.agent_car) : '') + '<br>' + (v.agent_plate ? '<span class="plate">' + esc(v.agent_plate) + '</span>' : '') + '</span>' +
        (v.agent_phone ? '<a href="tel:' + esc(v.agent_phone) + '" aria-label="' + esc(T('Call the agent')) + '">' + ICON.phone + '</a>' : '') + '</div>'
      : '<div class="md-agent dim">' + esc(T('Agent being arranged')) + '</div>';
    var opts = [['liked', T('Liked it')], ['thinking', T('Thinking')], ['no', T('Not for them')]];
    var out = past ? '<div class="md-out-q"><span class="dim">' + esc(T('How did it go?')) + '</span><div class="opts">' + opts.map(function (o) {
      return '<button type="button" data-out="' + o[0] + '" data-vid="' + v.id + '" aria-pressed="' + (v.owner_outcome === o[0]) + '">' + esc(o[1]) + '</button>';
    }).join('') + '</div></div>' : '';
    return '<div class="md-slot"><span class="t">' + esc(shortTime(v.viewing_time)) + '</span><div class="md-card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b>' + esc(unitName(v)) + '</b>' +
      (past && v.status !== 'done' && !v.agent_name ? '<span class="pill p-pau">' + esc(T('Booked')) + '</span>' : past ? '<span class="pill p-ok">' + esc(T('Done')) + '</span>' : statusPill(v)) + '</div>' +
      '<div class="dim" style="font-size:13px;margin-top:2px">' + esc(u ? u.type + ' · KES ' + V.money(u.rent) : (v.listing_title || '')) + (v.homes > 1 ? ' · ' + esc(T('client sees {n} homes on this trip', { n: v.homes })) : '') + '</div>' + agent + out + '</div></div>';
  }

  // ----- Profile -----
  function drawProfile() {
    var el = V.$('[data-panel="profile"]'), p = S.profile;
    var sw = function (k, label, sub) { return '<div class="md-li"><span class="lbl"><b>' + esc(label) + '</b><small>' + esc(sub) + '</small></span><button type="button" class="md-sw" role="switch" aria-label="' + esc(label) + '" aria-checked="' + !!p[k] + '" data-sw="' + k + '"></button></div>'; };
    var li = function (k, label, val, extra) { return '<button type="button" class="md-li" data-edit="' + k + '"><b>' + esc(label) + '</b><span class="v">' + esc(val) + '</span><span class="chev">›</span></button>'; };
    var langs = (window.VT && VT.LANGS) || { en: 'English' }, cur = (window.VT && VT.lang && VT.lang()) || 'en';
    el.innerHTML = '<div class="md-head"><div><h1>' + esc(T('Profile & settings')) + '</h1></div></div>' +
      '<div class="md-who"><span class="md-av">' + esc(initials(p.name, p.email)) + '</span><span><h2 style="font-size:21px">' + esc(p.name || T('Add your name')) + '</h2><span class="dim" style="font-size:14px">' +
      esc(T('Manager')) + (S.buildings.length ? ' · ' + esc(S.buildings.map(function (b) { return b.name; }).join(', ')) : '') + '</span></span></div>' +
      '<div class="md-prof"><div style="display:flex;flex-direction:column;gap:8px"><span class="k">' + esc(T('Account')) + '</span><div class="md-card md-list">' +
      li('name', T('Name'), p.name || T('Add')) + li('phone', T('Phone'), p.phone || T('Add')) +
      '<div class="md-li"><b>' + esc(T('Email')) + '</b><span class="v">' + esc(p.email || '') + '</span></div>' +
      li('password', T('Password'), T('Change')) + '</div>' +
      '<div class="md-card md-list" style="margin-top:10px"><label class="md-li"><b>' + esc(T('Language')) + '</b><select data-lang>' + Object.keys(langs).map(function (k) { return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + esc(langs[k]) + '</option>'; }).join('') + '</select></label>' +
      '<a class="md-li" target="_blank" rel="noopener" href="' + V.wa('Hi Viustay, I need help with my manager dashboard') + '"><b>' + esc(T('Help')) + '</b><span class="v">' + esc(T('WhatsApp us')) + '</span><span class="chev">›</span></a></div></div>' +
      '<div style="display:flex;flex-direction:column;gap:8px"><span class="k">' + esc(T('Notify me when')) + '</span><div class="md-card md-list">' +
      sw('notify_booked', T('A viewing is booked'), T('By WhatsApp or SMS')) + sw('notify_agent', T('The agent is on the way'), T('So your caretaker is ready')) + sw('notify_weekly', T('Weekly summary'), T('Every Monday by email')) + '</div>' +
      '<button type="button" class="md-btn red wide" style="margin-top:10px" data-logout2>' + esc(T('Log out')) + '</button></div></div>';
    V.$$('[data-sw]', el).forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute('data-sw'), val = !p[k], patch = {}; patch[k] = val;
        p[k] = val; b.setAttribute('aria-checked', String(val));
        rpc('save_my_profile', { p: patch }).then(function () { toast(T('Saved')); }).catch(function (e) { p[k] = !val; b.setAttribute('aria-checked', String(!val)); toast(errText(e)); });
      };
    });
    V.$$('[data-edit]', el).forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-edit'); if (k === 'password') pwSheet(); else fieldSheet(k); }; });
    V.$('[data-lang]', el).onchange = function () { if (window.VT && VT.set) VT.set(this.value); };
    V.$('[data-logout2]', el).onclick = logout;
  }
  function fieldSheet(k) {
    var label = k === 'name' ? T('Your name') : T('Your phone');
    sheet('<h2>' + esc(label) + '</h2><label>' + esc(label) + '<input type="' + (k === 'phone' ? 'tel' : 'text') + '" maxlength="' + (k === 'phone' ? 20 : 120) + '" value="' + esc(S.profile[k] || '') + '" data-in></label><p class="err hidden" data-err></p>' +
      '<div class="row"><button type="button" class="md-btn" data-close>' + esc(T('Cancel')) + '</button><button type="button" class="md-btn dark" data-yes>' + esc(T('Save')) + '</button></div>', function (card, close) {
      var b = V.$('[data-yes]', card), er = V.$('[data-err]', card);
      b.onclick = function () {
        var val = V.$('[data-in]', card).value.trim(), patch = {}; patch[k] = val;
        if (k === 'phone' && val && !/^\+?[\d\s-]{9,20}$/.test(val)) { er.textContent = errText({ message: 'bad_phone' }); er.classList.remove('hidden'); return; }
        b.disabled = true;
        rpc('save_my_profile', { p: patch }).then(function (r) { if (r) S.profile = r; else S.profile[k] = val; close(); toast(T('Saved')); render(); })
          .catch(function (e) { b.disabled = false; er.textContent = errText(e); er.classList.remove('hidden'); });
      };
    });
  }
  function pwSheet() {
    sheet('<h2>' + esc(T('Change password')) + '</h2><label>' + esc(T('New password')) + '<input type="password" autocomplete="new-password" minlength="8" data-p1></label>' +
      '<label>' + esc(T('Type it again')) + '<input type="password" autocomplete="new-password" minlength="8" data-p2></label><p class="err hidden" data-err></p>' +
      '<div class="row"><button type="button" class="md-btn" data-close>' + esc(T('Cancel')) + '</button><button type="button" class="md-btn dark" data-yes>' + esc(T('Save password')) + '</button></div>', function (card, close) {
      var b = V.$('[data-yes]', card), er = V.$('[data-err]', card);
      var fail = function (t) { b.disabled = false; er.textContent = t; er.classList.remove('hidden'); };
      b.onclick = function () {
        var a = V.$('[data-p1]', card).value, c = V.$('[data-p2]', card).value;
        if (a.length < 8) return fail(T('Use at least 8 characters.'));
        if (a !== c) return fail(T('The two passwords do not match.'));
        b.disabled = true;
        if (V.demo) { close(); toast(T('Password changed')); return; }
        V.db.auth.updateUser({ password: a }).then(function (r) { if (r.error) throw r.error; close(); toast(T('Password changed')); }).catch(function (e) { fail(e.message || T('Something went wrong. Please try again.')); });
      };
    });
  }

  // ---------- Show ----------
  function showDash(data) {
    S.buildings = data.buildings || []; S.units = data.units || []; S.views = data.viewings || []; S.profile = data.profile || {};
    var saved = null; try { saved = localStorage.getItem('vs-md-b'); } catch (e) {}
    var most = S.buildings.slice().sort(function (a, b) { var n = function (x) { return S.units.filter(function (u) { return u.building_id === x.id; }).length; }; return n(b) - n(a); })[0];
    S.b = S.buildings.filter(function (b) { return String(b.id) === saved; })[0] || most || null;
    document.body.classList.add('md-on');
    V.$('#auth').classList.add('hidden');
    V.$('#dash').classList.remove('hidden');
    if (['home', 'units', 'viewings', 'profile'].indexOf(S.tab) < 0) S.tab = 'home';
    go(S.tab);
  }

  // ---------- Demo mode: sample data so the page can be previewed ----------
  if (V.demo) {
    var t0 = today(), wd = function (n) { return addDays(t0, n); };
    var hassan = { agent_name: 'Hassan Ali', agent_phone: '0712000111', agent_car: 'Silver Probox', agent_plate: 'KDA 123A', agent_photo: null };
    var wanjiru = { agent_name: 'Wanjiru K.', agent_phone: '0712000222', agent_car: 'White Vitz', agent_plate: 'KCB 456Z', agent_photo: null };
    var mk = function (id, d, t, lid, st, ag, extra) { var o = { id: id, building_id: 1, viewing_date: d, viewing_time: t, listing_id: lid, listing_title: '', status: st, owner_outcome: null, homes: 3 }; for (var k in (ag || {})) o[k] = ag[k]; for (var k2 in (extra || {})) o[k2] = extra[k2]; return o; };
    showDash({
      buildings: [{ id: 1, code: 'KIL-01', name: 'Sunrise Apartments', location: 'Kilimani' }],
      units: [
        { id: 1, building_id: 1, label: 'C2', type: '2 bedrooms', rent: 38000, status: 'vacant', vacant_since: wd(-24), listing_id: 'VS-007', paused: false },
        { id: 2, building_id: 1, label: 'A1', type: '2 bedrooms', rent: 35000, status: 'vacant', vacant_since: wd(-9), listing_id: 'VS-001', paused: false },
        { id: 3, building_id: 1, label: 'D3', type: 'Studio', rent: 17500, status: 'vacant', vacant_since: wd(-4), listing_id: 'VS-003', paused: true },
        { id: 4, building_id: 1, label: 'B4', type: 'Studio', rent: 18000, status: 'let', vacant_since: null, listing_id: 'VS-004', paused: false },
        { id: 5, building_id: 1, label: 'B1', type: '1 bedroom', rent: 26000, status: 'let', vacant_since: null, listing_id: 'VS-005', paused: false }
      ],
      viewings: [
        mk(1, wd(-1), '2:00 PM', 'VS-007', 'done', wanjiru, { owner_outcome: 'liked' }),
        mk(2, wd(0), '9:00 AM', 'VS-007', 'confirmed', wanjiru),
        mk(3, wd(0), '11:30 AM', 'VS-001', 'confirmed', hassan),
        mk(4, wd(0), '2:00 PM', 'VS-001', 'confirmed', hassan),
        mk(5, wd(1), '11:30 AM', 'VS-007', 'new', null),
        mk(6, wd(3), '9:00 AM', 'VS-001', 'new', null)
      ],
      profile: { email: 'amina@sunrise.co.ke', name: 'Amina Mohamed', phone: '0712 345 678', notify_booked: true, notify_agent: true, notify_weekly: false }
    });
    return;
  }

  // ---------- Live mode ----------
  V.$('#forgot').addEventListener('click', function () {
    var email = authForm.email.value.trim();
    if (!email) { msg(err, T('Type your email first, then tap "Forgot password?".')); return; }
    V.db.auth.resetPasswordForEmail(email, { redirectTo: window.location.href.split('?')[0] + '?reset=1' })
      .then(function (r) { if (r.error) throw r.error; msg(err); msg(info, T('Check your email for a reset link.')); })
      .catch(function (e) { msg(err, e.message || T('Could not send the reset email.')); });
  });

  authForm.addEventListener('submit', function (e) {
    e.preventDefault();
    msg(err); msg(info);
    var email = authForm.email.value.trim().toLowerCase(), pw = authForm.password.value;
    if (!email || pw.length < 8) { msg(err, T('Enter your email and a password of at least 8 characters.')); return; }
    var btn = V.$('#auth-submit'); btn.disabled = true;
    var p;
    if (params.get('reset') && mode === 'login') p = V.db.auth.updateUser({ password: pw });
    else if (mode === 'signup') p = V.db.auth.signUp({ email: email, password: pw, options: { emailRedirectTo: window.location.href.split('?')[0] } });
    else p = V.db.auth.signInWithPassword({ email: email, password: pw });
    p.then(function (r) {
      btn.disabled = false;
      if (r.error) throw r.error;
      if (mode === 'signup' && !r.data.session) { setMode('login'); msg(info, T('Check your email and tap the link to confirm, then log in here.')); return; }
      if (params.get('reset')) { history.replaceState(null, '', window.location.pathname); params.delete('reset'); }
      start();
    }).catch(function (e2) {
      btn.disabled = false;
      msg(err, /invalid login/i.test(e2.message || '') ? T('Wrong email or password.') : (e2.message || T('Something went wrong.')));
    });
  });

  function start() {
    V.db.auth.getSession().then(function (r) {
      var session = r.data && r.data.session;
      if (!session || params.get('reset')) {
        V.$('#auth').classList.remove('hidden'); V.$('#dash').classList.add('hidden'); document.body.classList.remove('md-on');
        if (params.get('reset') && session) { V.$('#auth-title').textContent = T('Set a new password'); V.$('#auth-submit').textContent = T('Save password'); }
        return;
      }
      V.$('#auth').classList.add('hidden');
      Promise.all([
        V.db.from('buildings').select('id, code, name, location').order('name'),
        V.db.from('units').select('id, label, type, rent, status, vacant_since, listing_id, building_id, paused, added_by_manager').order('label'),
        V.db.rpc('my_viewings_v2'),
        V.db.rpc('my_profile')
      ]).then(function (res) {
        var bad = res.filter(function (x) { return x.error; })[0];
        if (bad) throw bad.error;
        var prof = res[3].data || {}; if (!prof.email) prof.email = session.user && session.user.email;
        showDash({ buildings: res[0].data, units: res[1].data, viewings: res[2].data, profile: prof });
      }).catch(function (e) {
        console.error(e);
        document.body.classList.add('md-on');
        V.$('#dash').classList.remove('hidden');
        V.$('[data-panel="home"]').innerHTML = '<div class="md-card"><h2>' + esc(T('Could not load your dashboard')) + '</h2><p class="dim">' + esc(T('Please refresh. If it keeps happening, WhatsApp us.')) + '</p></div>';
      });
    });
  }
  start();
});
