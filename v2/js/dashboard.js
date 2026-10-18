// Manager dashboard, buildings first.
// 1) My buildings: one card per building (or a "Register your building" start page).
// 2) Register a building: 6 short steps based on Form A (location, contacts, house types, amenities, rules, visit).
// 3) Inside a building: Home, Units (add vacancy = short Form B), Viewings, Details.
// Managers see the agent bringing each viewing, never the tenant. No fees here (finance handles them).
document.addEventListener('DOMContentLoaded', function () {
  var V = window.V;
  var T = window.VT || function (s, v) { return v ? s.replace(/\{(\w+)\}/g, function (m, k) { return v[k] !== undefined ? v[k] : m; }) : s; };
  var params = new URLSearchParams(window.location.search);
  var mode = params.get('signup') ? 'signup' : 'login';
  var authForm = V.$('#auth-form'), err = V.$('#auth-error'), info = V.$('#auth-info');
  if (params.get('email')) authForm.email.value = params.get('email');

  function msg(el, text) { el.textContent = text || ''; el.classList.toggle('hidden', !text); }
  // Sign-up in 3 steps (item 25): 1 what do you have, 2 your details, 3 Karibu (the first dashboard screen)
  var SU = { kinds: [], role: '', unit_count: '' }, suStep = 1;
  try { var su0 = JSON.parse(localStorage.getItem('vs-md-pending') || 'null'); if (su0 && su0.kinds) SU = { kinds: su0.kinds, role: su0.role || '', unit_count: su0.unit_count || '' }; } catch (e) {}
  function suDraw() {
    V.$$('.su-kind').forEach(function (b) { b.setAttribute('aria-pressed', String(SU.kinds.indexOf(b.getAttribute('data-kind')) >= 0)); });
    V.$$('[data-su]').forEach(function (g) { var k = g.getAttribute('data-su'); V.$$('button', g).forEach(function (b) { b.setAttribute('aria-pressed', String(SU[k] === b.getAttribute('data-v'))); }); });
    var lab = { monthly: T('Monthly rentals'), short: T('Short stays') };
    V.$('#su-sum').innerHTML = SU.kinds.map(function (k) { return '<span class="su-pill ' + k + '">' + esc(lab[k]) + '</span>'; }).join('') +
      ([SU.role && T(SU.role), SU.unit_count].filter(Boolean).length ? '<span class="su-pill">' + esc([SU.role && T(SU.role), SU.unit_count].filter(Boolean).join(' · ')) + '</span>' : '') +
      '<button type="button" class="btn-link" data-su-back>' + esc(T('Change')) + '</button>';
    var bk = V.$('[data-su-back]'); if (bk) bk.onclick = function () { suStep = 1; setMode('signup'); };
  }
  V.$$('.su-kind').forEach(function (b) { b.addEventListener('click', function () {
    var k = b.getAttribute('data-kind'), i = SU.kinds.indexOf(k); if (i >= 0) SU.kinds.splice(i, 1); else SU.kinds.push(k); msg(V.$('#su-error')); suDraw();
  }); });
  V.$$('[data-su] button').forEach(function (b) { b.addEventListener('click', function () { var k = b.parentNode.getAttribute('data-su'), v = b.getAttribute('data-v'); SU[k] = SU[k] === v ? '' : v; suDraw(); }); });
  V.$('#su-next').addEventListener('click', function () {
    if (!SU.kinds.length) { msg(V.$('#su-error'), T('Tick monthly rentals, short stays, or both.')); return; }
    suStep = 2; setMode('signup'); window.scrollTo(0, 0);
  });
  V.$$('[data-to-login]').forEach(function (b) { b.addEventListener('click', function () { setMode('login'); }); });
  function setMode(m) {
    mode = m;
    var su = m === 'signup';
    V.$('#su-1').classList.toggle('hidden', !(su && suStep === 1));
    V.$('#auth-main').classList.toggle('hidden', su && suStep === 1);
    ['#su-2top', '#su-sum', '#su-extra'].forEach(function (id) { V.$(id).classList.toggle('hidden', !su); });
    V.$('#auth-lede').classList.toggle('hidden', su); V.$('#auth-note').classList.toggle('hidden', su && !V.$('#auth-note').textContent);
    V.$('#auth-title').textContent = su ? T('Your details') : T('Manager log in');
    if (su) suDraw();
    V.$('#auth-submit').textContent = su ? T('Create my account') : T('Log in');
    V.$('#toggle-mode').textContent = su ? T('Already have a login? Log in') : T('New here? Create a login');
    V.$('#forgot').classList.toggle('hidden', su);
    authForm.password.setAttribute('autocomplete', su ? 'new-password' : 'current-password');
    msg(err); msg(info);
  }
  setMode(mode);
  V.$('#toggle-mode').addEventListener('click', function () { if (mode !== 'signup') suStep = 1; setMode(mode === 'signup' ? 'login' : 'signup'); });

  // ---------- State ----------
  var S = { buildings: [], units: [], views: [], profile: {}, b: null, filter: 'all', week: 0, day: null, route: { page: 'buildings' } };
  var W = null; // register wizard
  var Q = null; // "List a short stay" form (item 17)

  var AREAS = ['Kilimani', 'Kileleshwa', 'Lavington', 'Westlands', 'Parklands', 'South C', 'South B', 'Upper Hill', 'Ngong Rd'];
  var HTYPES = ['Bedsitter / studio', 'One bedroom', 'Two bedroom', 'Three bedroom', 'Four bedroom +'];
  var AMEN = [
    ['water_source', 'Water source', ['Borehole', 'City water', 'Tank']],
    ['water_supply', 'Water supply', ['Daily', 'Some days']],
    ['water_billing', 'Water billing', ['Included in rent', 'Metered']],
    ['electricity', 'Electricity', ['Token', 'Postpaid', 'Backup generator']],
    ['security', 'Security', ['Gate', 'Guards', 'CCTV', 'Electric fence']],
    ['parking', 'Parking and access', ['Parking', 'Lift']],
    ['garbage', 'Garbage collection', ['Included', 'Charged monthly']],
    ['amenities', 'Shared amenities', ['Gym', 'Pool', 'Rooftop', "Kids' play area", 'Backup water']]
  ];
  var STEPS = ['Location', 'Contacts', 'House types', 'Amenities', 'Rules', 'Visit'];

  // ---------- Helpers ----------
  var ICON = {
    phone: '<svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    bulb: '<svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/></svg>',
    wa: '<svg viewBox="0 0 24 24"><path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
    chev: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
    pin: '<svg viewBox="0 0 24 24" style="width:14px;height:14px;vertical-align:-2px"><path d="M12 21s-7-7-7-12a7 7 0 0 1 14 0c0 5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>',
    moon: '<svg viewBox="0 0 24 24"><path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z"/></svg>',
    bld: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M10 21v-4h4v4"/></svg>',
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>'
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
  function toast(t) { var el = V.$('#toast'); el.textContent = t; el.classList.remove('hidden'); clearTimeout(toast.h); toast.h = setTimeout(function () { el.classList.add('hidden'); }, 2600); }
  function errText(e) {
    var m = (e && (e.message || e.msg)) || '';
    var map = { bad_rent: T('Enter a rent between KES 1,000 and 5,000,000.'), bad_label: T('Enter the unit number, e.g. C2.'), bad_type: T('Choose the unit type.'),
      label_taken: T('That unit is already on your list.'), bad_phone: T('Check the phone number.'), not_found: T('We could not find that. Please refresh.'),
      bad_name: T('Enter the building name.'), bad_road: T('Enter the road or street.'), bad_area: T('Choose the area.'), bad_contact: T('Enter the contact person.'),
      bad_types: T('Add at least one house type.'), bad_visit: T('Choose a visit day in the next 60 days.'), bad_pin: T('That pin is outside Nairobi. Try again or skip it.'),
      bad_date: T('Choose a date in the next 6 months.'), too_many: T('You have many buildings waiting for a visit. WhatsApp us to continue.') };
    for (var k in map) if (new RegExp('\\b' + k + '\\b').test(m)) return map[k];
    return T('Something went wrong. Please try again.');
  }
  function rpc(name, args) {
    if (V.demo) return Promise.resolve(null);
    return V.db.rpc(name, args).then(function (r) { if (r.error) throw r.error; return r.data; });
  }
  function D(b) { return (b && b.details) || {}; }

  // ---------- Data views ----------
  function bUnits(b) { return S.units.filter(function (u) { return b && u.building_id === b.id; }); }
  function bViews(b) { return S.views.filter(function (v) { return b && v.building_id === b.id; }); }
  function units() { return bUnits(S.b); }
  function views() { return bViews(S.b); }
  function unitFor(v) { return S.units.filter(function (u) { return u.listing_id && u.listing_id === v.listing_id; })[0]; }
  function unitName(v) { var u = unitFor(v); return u ? T('Unit {u}', { u: u.label }) : (v.listing_title || v.listing_id); }
  function upcomingOf(list) {
    var now = Date.now() - 30 * 6e4;
    return list.filter(function (v) { return v.status !== 'done' && when(v) >= now; }).sort(function (a, b) { return when(a) - when(b); });
  }
  function isLive(b) { return b && b.status !== 'setting_up' && bUnits(b).some(function (u) { return u.listing_id; }); }
  function byId(id) { return S.units.filter(function (u) { return String(u.id) === String(id); })[0]; }

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
  function sheetErr(card, t) { var er = V.$('[data-err]', card); er.textContent = t; er.classList.remove('hidden'); }

  // ---------- Routing (#buildings, #register, #edit-ID-STEP, #b-ID-TAB, #profile) ----------
  function parse() {
    var h = (location.hash || '').replace(/^#/, ''), m;
    if (h === 'register') return { page: 'register' };
    if (h === 'profile') return { page: 'profile' };
    if ((m = /^short(?:-(\d+))?$/.exec(h))) return { page: 'short', bid: m[1] ? +m[1] : null };
    if ((m = /^edit-(\d+)-(\d)$/.exec(h))) return { page: 'register', edit: +m[1], step: +m[2] };
    if ((m = /^b-(\d+)-(home|units|viewings|details)$/.exec(h))) return { page: 'building', id: +m[1], tab: m[2] };
    return { page: 'buildings' };
  }
  function nav(hash) { if (location.hash === '#' + hash) route(); else location.hash = hash; }
  function openB(b, tab) { nav('b-' + b.id + '-' + (tab || 'home')); }
  window.addEventListener('hashchange', function () { if (!V.$('#dash').classList.contains('hidden')) route(); });
  V.$$('[data-go]').forEach(function (b) { b.addEventListener('click', function () { nav(b.getAttribute('data-go')); }); });
  V.$$('[data-btab]').forEach(function (b) { b.addEventListener('click', function () { if (S.b) openB(S.b, b.getAttribute('data-btab')); }); });
  V.$$('[data-logout]').forEach(function (b) { b.addEventListener('click', logout); });
  function logout() {
    if (V.demo) { window.location.href = 'owners.html'; return; }
    V.db.auth.signOut().then(function () { window.location.href = 'owners.html'; });
  }

  function route() {
    var r = parse();
    if (r.page === 'building') {
      S.b = S.buildings.filter(function (b) { return b.id === r.id; })[0];
      if (!S.b) { nav('buildings'); return; }
    } else if (r.page !== 'register') S.b = null;
    if (r.page === 'short') { if (!Q || (r.bid && Q.data.building_id !== r.bid && Q.step === 1)) Q = { step: 1, data: newShort(r.bid) }; } else if (Q && Q.sent) Q = null;
    if (r.page === 'register') {
      if (r.edit) {
        var eb = S.buildings.filter(function (b) { return b.id === r.edit; })[0];
        if (!eb) { nav('buildings'); return; }
        if (!W || W.id !== eb.id) W = { id: eb.id, step: r.step || 1, data: fromBuilding(eb) };
        else W.step = r.step || W.step;
        S.b = eb;
      } else if (!W || W.id) { W = { id: null, step: 1, data: loadDraft() }; }
    } else W = null;
    S.route = r;
    if (r.page === 'building' && S.lastB !== S.b.id) { S.filter = 'all'; S.week = 0; S.day = null; S.lastB = S.b.id; }
    render(); window.scrollTo(0, 0);
  }

  // ---------- Chrome (sidebar, top bar, tabs) ----------
  function chrome() {
    var r = S.route, who = initials(S.profile.name, S.profile.email);
    V.$('#me-av-side').textContent = who; V.$('#me-av-top').textContent = who;
    V.$('#me-name-side').textContent = S.profile.name || S.profile.email || '';
    V.$$('.md-nav > [data-go]').forEach(function (b) {
      var on = (b.getAttribute('data-go') === 'buildings' && (r.page === 'buildings' || r.page === 'building' || r.page === 'register' || r.page === 'short')) || (b.getAttribute('data-go') === 'profile' && r.page === 'profile');
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    var sub = V.$('#side-sub');
    if (r.page === 'building') {
      sub.innerHTML = '<b>' + esc(S.b.name) + '</b>' + [['home', T('Overview')], ['units', T('Units')], ['viewings', T('Viewings')], ['details', T('Details')]].map(function (t) {
        return '<button type="button" data-sub="' + t[0] + '"' + (r.tab === t[0] ? ' aria-current="page"' : '') + '>' + esc(t[1]) + '</button>';
      }).join('');
      V.$$('[data-sub]', sub).forEach(function (b) { b.onclick = function () { openB(S.b, b.getAttribute('data-sub')); }; });
    } else sub.innerHTML = '';
    var left = V.$('#md-top-left');
    if (r.page === 'buildings') left.innerHTML = '<a class="md-logo" href="owners.html"><img src="assets/viustay-logo-colour.svg" alt="Viustay"></a>';
    else if (r.page === 'building' && r.tab === 'details') left.innerHTML = '<button type="button" class="md-top-back" data-to="b-' + S.b.id + '-home">' + ICON.back + esc(S.b.name) + '</button>';
    else if (r.page === 'register' && W && W.id) left.innerHTML = '<button type="button" class="md-top-back" data-to="b-' + W.id + '-details">' + ICON.back + esc(T('Building details')) + '</button>';
    else left.innerHTML = '<button type="button" class="md-top-back" data-to="buildings">' + ICON.back + esc(T('My buildings')) + '</button>';
    V.$$('[data-to]', left).forEach(function (b) { b.onclick = function () { nav(b.getAttribute('data-to')); }; });
    V.$('#dash').classList.toggle('no-tabs', r.page !== 'building');
    V.$$('[data-btab]').forEach(function (b) { if (r.page === 'building' && b.getAttribute('data-btab') === r.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  }

  function render() {
    chrome();
    var el = V.$('#md-view'), r = S.route;
    if (r.page === 'buildings') drawBuildings(el);
    else if (r.page === 'register') drawWizard(el);
    else if (r.page === 'short') drawShort(el);
    else if (r.page === 'profile') drawProfile(el);
    else if (r.tab === 'units') drawUnits(el);
    else if (r.tab === 'viewings') drawViewings(el);
    else if (r.tab === 'details') drawDetails(el);
    else drawHome(el);
    if (window.VT && VT.apply) VT.apply(V.$('#dash'));
  }

  function hello() {
    var h = new Date().getHours(), n = firstName();
    var g = h < 12 ? T('Good morning') : h < 17 ? T('Good afternoon') : T('Good evening');
    return n ? g + ', ' + esc(n) : g;
  }

  // Building picture: their photo if we have one, otherwise a drawn building
  function sil() {
    var w = '', i, j;
    for (i = 0; i < 5; i++) for (j = 0; j < 3; j++) w += '<rect x="' + (94 + j * 17) + '" y="' + (24 + i * 18) + '" width="9" height="9" rx="1.5" fill="rgba(255,255,255,.55)"/>';
    for (i = 0; i < 4; i++) for (j = 0; j < 3; j++) w += '<rect x="' + (28 + j * 16) + '" y="' + (50 + i * 18) + '" width="8" height="8" rx="1.5" fill="rgba(255,255,255,.45)"/>';
    return '<svg class="sil" viewBox="0 0 200 120" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><rect x="18" y="38" width="62" height="82" rx="3" fill="rgba(255,255,255,.22)"/><rect x="84" y="12" width="70" height="108" rx="3" fill="rgba(255,255,255,.32)"/><rect x="158" y="54" width="34" height="66" rx="3" fill="rgba(255,255,255,.18)"/>' + w + '</svg>';
  }
  function photo(b, inner) {
    var url = D(b).photo_url;
    return '<div class="bphoto h' + (b.id % 3) + '"' + (url ? ' style="background-image:url(\'' + esc(url) + '\')"' : '') + '>' + (url ? '' : sil()) + (inner || '') + '</div>';
  }

  // ================= List a short stay (item 17): 4 steps =================
  var STYPES = [['Studio', 0], ['1 bedroom', 1], ['2 bedrooms', 2], ['3 bedrooms', 3], ['Whole house', null]];
  var SINC = ['Wi-Fi', 'Hot shower', 'Kitchen', 'Fridge', 'TV / Netflix', 'Parking', 'Washing machine', 'Workspace', 'Towels & sheets', 'Backup power', 'Pool', 'Gym'];
  var SRULES = [['smoking', 'Smoking inside'], ['parties', 'Parties'], ['pets', 'Pets'], ['visitors', 'Visitors after 10 PM']];
  var SMIN = [['1', 'No minimum'], ['2', '2 nights'], ['3', '3 nights'], ['7', '1 week'], ['other', 'Other…']];
  var STIMES = ['11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM'], SOUT = ['9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM'];
  function shortOk() { return (S.profile.kinds || []).indexOf('short') >= 0 || S.buildings.some(function (b) { return ((D(b).rules || {}).short_stays) === 'Allowed'; }); }
  function newShort(bid) {
    var allowed = S.buildings.filter(function (b) { return ((D(b).rules || {}).short_stays) === 'Allowed'; });
    var b = bid ? S.buildings.filter(function (x) { return x.id === bid; })[0] : (allowed[0] || S.buildings[0]);
    return { building_id: b ? b.id : null, building_name: '', area: '', unit_label: '', floor: '', type: '', max_guests: 2, beds: 1, bathrooms: 1, title: '',
      night_rate: '', cleaning_fee: '', min: '1', min_other: '', check_in: '2:00 PM', check_out: '11:00 AM', discounts: 'None',
      included: ['Wi-Fi', 'Hot shower', 'Towels & sheets'], rules: { smoking: false, parties: false, pets: false, visitors: false },
      checkin_name: (b && (D(b).contacts || {}).caretaker) || '', checkin_phone: (b && (D(b).contacts || {}).caretaker_phone) || '', keys: 'Meets guest', notes: '' };
  }
  function shortBuilding(x) { return S.buildings.filter(function (b) { return b.id === x.building_id; })[0]; }
  function shortTitle(x) { var b = shortBuilding(x); return x.title || ((x.type ? T(x.type) : T('Furnished unit')) + ', ' + (b ? (b.road || b.name) : (x.building_name || x.area || ''))); }
  function shortMin(x) { return x.min === 'other' ? parseInt(x.min_other, 10) || 1 : parseInt(x.min, 10) || 1; }
  function stepBtn(key, val, label, max) {
    return '<div class="md-stepper"><span>' + esc(label) + '</span><span class="st"><button type="button" data-sd="' + key + '" data-d="-1" aria-label="' + esc(T('Fewer')) + '"' + (val <= 1 ? ' disabled' : '') + '>−</button><b>' + val + '</b><button type="button" data-sd="' + key + '" data-d="1" aria-label="' + esc(T('More')) + '"' + (val >= max ? ' disabled' : '') + '>+</button></span></div>';
  }
  function nextList(now) {
    return '<ol class="md-steps">' + [T('You send it'), T('We call to book a photo visit'), T('Photos added, it goes live'), T('We let you know when guests book')].map(function (t, i) {
      return '<li class="' + (i < now ? 'on' : i === now ? 'now' : '') + '"><i></i>' + esc(t) + '</li>';
    }).join('') + '</ol>';
  }
  function drawShort(el) {
    var x = Q.data, n = Q.step, body = '';
    if (Q.sent) {
      el.innerHTML = '<section class="md-wiz md-short"><div class="md-done-tick pop">' + ICON.check + '</div><h1 style="font-size:26px">' + esc(T('Sent! We\'ll call you to book a photo visit.')) + '</h1>' +
        '<div class="md-card md-whatnext"><b>' + esc(T('What happens next')) + '</b>' + nextList(1) + '</div>' +
        '<div class="md-two-btn"><button type="button" class="md-btn" data-to2>' + esc(T('My buildings')) + '</button><button type="button" class="md-btn sun" data-again>' + esc(T('List another short stay')) + '</button></div></section>';
      V.$('[data-to2]', el).onclick = function () { Q = null; nav('buildings'); };
      V.$('[data-again]', el).onclick = function () { Q = { step: 1, data: newShort(x.building_id) }; render(); window.scrollTo(0, 0); };
      return;
    }
    var title = [T('Which unit is it?'), T('Price and stay rules'), T('What\'s included'), T('This is what guests will see')][n - 1];
    var sub = [T('The furnished unit guests will stay in.'), T('Guests see the total before they pay.'), T('Tap everything guests get.'), T('Check it, then send it to Viustay.')][n - 1];
    if (n === 1) {
      var opts = S.buildings.map(function (b) { return '<option value="' + b.id + '"' + (x.building_id === b.id ? ' selected' : '') + '>' + esc(b.name) + (b.location ? ' · ' + esc(b.location) : '') + '</option>'; }).join('');
      var blank = shortTitle(Object.assign({}, x, { title: '' }));
      body = '<label class="md-f" data-fk="building">' + esc(T('Building')) + '<select data-sk="building_id">' + opts + '<option value=""' + (!x.building_id ? ' selected' : '') + '>' + esc(T('Not in a registered building')) + '</option></select></label>' +
        (!x.building_id ? '<div class="md-two-f">' + inp('building_name', T('Building or house name'), x.building_name, { ph: T('e.g. Sarit View Apartments') }) +
          '<label class="md-f" data-fk="area">' + esc(T('Area')) + '<select data-sk="area"><option value="">' + esc(T('Choose')) + '</option>' + AREAS.concat(['Other']).map(function (a) { return '<option' + (x.area === a ? ' selected' : '') + '>' + esc(a) + '</option>'; }).join('') + '</select></label></div>' : '') +
        '<div class="md-two-f">' + inp('unit_label', T('Unit / door no.'), x.unit_label, { ph: 'e.g. B4', maxlength: 30, hint: T('optional') }) + floorField(x) + '</div>' +
        '<div class="md-f" data-fk="type">' + esc(T('Type')) + cs('type', STYPES.map(function (t) { return t[0]; }), x.type) + '</div>' +
        '<div class="md-card md-steppers">' + stepBtn('max_guests', x.max_guests, T('Guests (max)'), 20) + stepBtn('beds', x.beds, T('Beds'), 10) + stepBtn('bathrooms', x.bathrooms, T('Bathrooms'), 6) + '</div>' +
        inp('title', T('Name guests will see'), x.title, { ph: blank, hint: T('optional'), maxlength: 120 }) +
        '<p class="dim" style="margin:-8px 0 0;font-size:13px">' + esc(T('Leave it blank and we use: {t}', { t: blank })) + '</p>';
    } else if (n === 2) {
      var ex = (parseInt(x.night_rate, 10) || 0) * Math.max(2, shortMin(x)) + (parseInt(x.cleaning_fee, 10) || 0);
      body = '<div class="md-two-f">' + inp('night_rate', T('Price per night (KES)'), x.night_rate, { type: 'number', inputmode: 'numeric', min: 500, max: 500000 }) + inp('cleaning_fee', T('Cleaning fee (KES)'), x.cleaning_fee, { type: 'number', inputmode: 'numeric', hint: T('optional') }) + '</div>' +
        '<div class="md-card md-min" data-fk="min"><b>' + esc(T('Minimum stay')) + ' <span class="dim" style="font-weight:400">· ' + esc(T('do you have a rule?')) + '</span></b>' +
        '<div class="md-chipset" data-cs="min">' + SMIN.map(function (o) { var on = x.min === o[0]; return '<button type="button" data-v="' + o[0] + '" aria-pressed="' + on + '">' + (on ? ICON.check : '') + esc(T(o[1])) + '</button>'; }).join('') + '</div>' +
        (x.min === 'other' ? inp('min_other', T('Minimum nights'), x.min_other, { type: 'number', inputmode: 'numeric', min: 1, max: 60 }) : '') +
        '<p class="dim" style="margin:0;font-size:13px">' + esc(T('"No minimum" means guests can book 1 night. We only show a minimum on the listing if you set one.')) + '</p></div>' +
        '<div class="md-two-f"><label class="md-f">' + esc(T('Check-in from')) + '<select data-sk="check_in">' + STIMES.map(function (t) { return '<option' + (x.check_in === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></label>' +
        '<label class="md-f">' + esc(T('Check-out by')) + '<select data-sk="check_out">' + SOUT.map(function (t) { return '<option' + (x.check_out === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></label></div>' +
        '<div class="md-f">' + esc(T('Discounts')) + ' <small>' + esc(T('optional')) + '</small>' + cs('discounts', ['10% off a week', '20% off a month', 'None'], x.discounts) + '</div>' +
        (ex ? '<div class="md-ex"><span>' + esc(T('Example: {n} nights', { n: Math.max(2, shortMin(x)) })) + '</span><b>KES ' + V.money(ex) + '</b></div>' : '');
    } else if (n === 3) {
      body = '<div class="md-card md-grp"><b>' + esc(T('Included')) + '</b>' + cs('included', SINC, x.included, true) + '</div>' +
        '<div class="md-card md-grp"><b>' + esc(T('House rules')) + ' <span class="dim" style="font-weight:400;font-size:13px">· ' + esc(T('on = allowed')) + '</span></b><div class="md-rules">' + SRULES.map(function (r) {
          return '<div class="md-toggle"><span>' + esc(T(r[1])) + '</span><button type="button" role="switch" aria-checked="' + !!x.rules[r[0]] + '" aria-label="' + esc(T(r[1])) + '" data-rule="' + r[0] + '"><i></i></button></div>';
        }).join('') + '</div></div>' +
        '<div class="md-card md-grp" style="display:flex;flex-direction:column;gap:12px"><b>' + esc(T('Who checks guests in?')) + '</b><p class="dim" style="margin:-8px 0 0;font-size:13px">' + esc(T('Sent to the guest on WhatsApp the day before. Never shown publicly.')) + '</p>' +
        '<div class="md-two-f">' + inp('checkin_name', T('Name'), x.checkin_name, { ph: T('e.g. Peter (caretaker)') }) + inp('checkin_phone', T('Phone'), x.checkin_phone, { type: 'tel', maxlength: 20 }) + '</div>' +
        cs('keys', ['Meets guest', 'Key in lockbox', 'Key at reception'], x.keys) + '</div>' +
        '<label class="md-f">' + esc(T('Anything else guests should know?')) + ' <small>' + esc(T('optional')) + '</small><textarea data-k="notes" rows="3" maxlength="1000">' + esc(x.notes) + '</textarea></label>';
    } else {
      var b = shortBuilding(x), mn = shortMin(x);
      body = '<div class="md-card md-prev"><div class="bphoto h1">' + sil() + '<span class="md-prev-tag">' + esc(T('Photos after our visit')) + '</span></div>' +
        '<div class="in"><b style="font-size:18px">' + esc(shortTitle(x)) + '</b><span class="dim">' + esc([b ? b.name : x.building_name, b ? b.location : x.area, T(x.max_guests === 1 ? '{n} guest' : '{n} guests', { n: x.max_guests }), T(x.beds === 1 ? '{n} bed' : '{n} beds', { n: x.beds })].filter(Boolean).join(' · ')) + '</span>' +
        '<div class="md-prev-price"><span><b>KES ' + V.money(parseInt(x.night_rate, 10) || 0) + '</b> <span class="dim">/ ' + esc(T('night')) + '</span></span><span class="dim">' + esc(mn > 1 ? T('Minimum {n} nights', { n: mn }) : T('No minimum stay')) + '</span></div>' +
        '<span class="dim" style="font-size:13px">' + esc([T('In {t}', { t: x.check_in }), T('Out {t}', { t: x.check_out })].concat(x.included.slice(0, 3).map(function (i) { return T(i); })).join(' · ') + (x.included.length > 3 ? ' +' + (x.included.length - 3) : '')) + '</span></div></div>' +
        '<div class="md-card md-whatnext"><b>' + esc(T('What happens next')) + '</b>' + nextList(0) + '</div>';
    }
    var bars = [1, 2, 3, 4].map(function (i) { return '<i class="' + (i <= n ? 'on' : '') + '"></i>'; }).join('');
    var lab = [T('The place'), T('Price & stay'), T('What\'s included'), T('Check')];
    el.innerHTML = '<section class="md-wiz md-short"><div class="md-wiz-top"><span class="k">' + esc(T('List a short stay')) + ' · ' + esc(T('{a} of {b}', { a: n, b: 4 })) + ' · ' + esc(lab[n - 1]) + '</span></div><div class="md-bars">' + bars + '</div>' +
      '<div><h1 style="font-size:26px">' + esc(title) + '</h1><p class="dim" style="margin:4px 0 0">' + esc(sub) + '</p></div>' + body + '</section>' +
      '<div class="md-wiz-foot">' + (n > 1 ? '<button type="button" class="md-btn" data-prev>' + esc(T('Back')) + '</button>' : '<button type="button" class="md-btn" data-cancel>' + esc(T('Cancel')) + '</button>') +
      '<button type="button" class="md-btn sun" data-next>' + esc(n === 4 ? T('Send to Viustay') : T('Next: {s}', { s: lab[n] })) + '</button><span class="err hidden" data-werr></span></div>';
    wireShort(el);
  }
  function floorField(x) {
    var b = shortBuilding(x), fl = b && parseInt(b.floors, 10);
    if (!fl) return inp('floor', T('Floor'), x.floor, { hint: T('optional'), maxlength: 30 });
    var list = [T('Ground')]; for (var i = 1; i <= fl; i++) list.push(ordinal(i));
    return '<label class="md-f">' + esc(T('Floor')) + ' <small>' + esc(T('optional')) + '</small><select data-sk="floor"><option value="">' + esc(T('Choose')) + '</option>' + list.map(function (f) { return '<option' + (x.floor === f ? ' selected' : '') + '>' + esc(f) + '</option>'; }).join('') + '</select></label>';
  }
  function wireShort(el) {
    var x = Q.data, keep = function () { var y = window.scrollY; render(); window.scrollTo(0, y); };
    V.$$('[data-k]', el).forEach(function (i) {
      var k = i.getAttribute('data-k');
      i.oninput = function () { setK(k, i.value); var f = i.closest('.md-f'); if (f) f.classList.remove('bad'); };
      if (/night_rate|cleaning_fee|min_other/.test(k)) i.onchange = keep;
    });
    V.$$('[data-sk]', el).forEach(function (sel) { sel.onchange = function () {
      var k = sel.getAttribute('data-sk'), v = sel.value;
      if (k === 'building_id') {
        x.building_id = v ? +v : null; x.floor = '';
        var nb = shortBuilding(x); if (nb) { var c = D(nb).contacts || {}; if (!x.checkin_name) x.checkin_name = c.caretaker || ''; if (!x.checkin_phone) x.checkin_phone = c.caretaker_phone || ''; }
        keep(); return;
      }
      x[k] = v; var f = sel.closest('.md-f'); if (f) f.classList.remove('bad');
    }; });
    V.$$('[data-cs]', el).forEach(function (set) {
      var key = set.getAttribute('data-cs'), multi = set.hasAttribute('data-multi');
      V.$$('button', set).forEach(function (b) { b.onclick = function () {
        var v = b.getAttribute('data-v');
        if (multi) { var arr = (x[key] || []).slice(), i = arr.indexOf(v); if (i > -1) arr.splice(i, 1); else arr.push(v); x[key] = arr; }
        else x[key] = (key === 'min' || key === 'keys' || key === 'discounts') ? v : (x[key] === v ? '' : v);
        keep();
      }; });
    });
    V.$$('[data-sd]', el).forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-sd'); x[k] = Math.max(1, Math.min(20, x[k] + (+b.getAttribute('data-d')))); keep(); }; });
    V.$$('[data-rule]', el).forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-rule'); x.rules[k] = !x.rules[k]; b.setAttribute('aria-checked', String(x.rules[k])); }; });
    var prev = V.$('[data-prev]', el); if (prev) prev.onclick = function () { Q.step--; render(); window.scrollTo(0, 0); };
    var cancel = V.$('[data-cancel]', el); if (cancel) cancel.onclick = function () { Q = null; nav('buildings'); };
    V.$('[data-next]', el).onclick = function () {
      var btn = this, er = V.$('[data-werr]', el);
      var fail = function (key, t) { var f = key && V.$('[data-fk="' + key + '"]', el); if (f) { f.classList.add('bad'); f.scrollIntoView({ block: 'center', behavior: 'smooth' }); } er.textContent = t; er.classList.remove('hidden'); };
      if (Q.step === 1) {
        if (!x.building_id && x.building_name.trim().length < 2) return fail('building_name', T('Enter the building or house name.'));
        if (!x.building_id && !x.area) return fail('area', errText({ message: 'bad_area' }));
        if (!x.type) return fail('type', T('Choose the type.'));
      }
      if (Q.step === 2) {
        var r = parseInt(x.night_rate, 10);
        if (!r || r < 500 || r > 500000) return fail('night_rate', T('Enter a price per night between KES 500 and 500,000.'));
        if (x.min === 'other' && !(parseInt(x.min_other, 10) >= 1)) return fail('min_other', T('Enter the minimum number of nights.'));
      }
      if (Q.step === 3) { var dg = String(x.checkin_phone || '').replace(/\D/g, '').length; if (x.checkin_phone && (dg < 9 || dg > 13)) return fail('checkin_phone', errText({ message: 'bad_phone' })); }
      if (Q.step < 4) { Q.step++; render(); window.scrollTo(0, 0); return; }
      btn.disabled = true;
      var ty = STYPES.filter(function (t) { return t[0] === x.type; })[0];
      var p = { building_id: x.building_id, building_name: x.building_name.trim(), area: x.area, unit_label: x.unit_label.trim(), floor: x.floor, type: x.type, bedrooms: ty ? ty[1] : null,
        beds: x.beds, bathrooms: x.bathrooms, max_guests: x.max_guests, title: x.title.trim(), night_rate: parseInt(x.night_rate, 10), cleaning_fee: parseInt(x.cleaning_fee, 10) || 0,
        min_nights: shortMin(x), check_in: x.check_in, check_out: x.check_out, discounts: x.discounts === 'None' ? '' : x.discounts, included: x.included, rules: x.rules,
        checkin_name: x.checkin_name.trim(), checkin_phone: x.checkin_phone.trim(), keys: x.keys, notes: x.notes.trim() };
      rpc('manager_submit_short_stay', { p: p }).then(function (res) {
        S.shorts = [{ id: res && res.id, status: 'new', building_id: p.building_id, building_name: p.building_name || ((shortBuilding(x) || {}).name), title: shortTitle(x), night_rate: p.night_rate, min_nights: p.min_nights, type: p.type, created_at: new Date().toISOString() }].concat(S.shorts || []);
        Q.sent = true; render(); window.scrollTo(0, 0);
      }).catch(function (e) {
        btn.disabled = false;
        var m = (e && e.message) || '';
        fail('', /bad_rate/.test(m) ? T('Enter a price per night between KES 500 and 500,000.') : /not_yours/.test(m) ? T('That building is not on your login.') : /function|does not exist|schema cache/.test(m) ? T('Short stays are not switched on yet. Please WhatsApp us.') : errText(e));
      });
    };
  }
  function shortCard() {
    return '<div class="md-card md-ss"><span class="k2">' + ICON.moon + esc(T('Short stays')) + '</span><b>' + esc(T('Earn per night from a furnished unit')) + '</b><span>' + esc(T('Guests pay Viustay by M-Pesa before they arrive. You get the check-in date and their name.')) + '</span>' +
      '<button type="button" class="md-btn sun" data-short>' + ICON.plus + esc(T('List a short stay')) + '</button></div>';
  }
  function shortList() {
    var L = S.shorts || []; if (!L.length) return '';
    var ST = { 'new': [T('Sent · we\'ll call you'), 'p-due'], 'visit booked': [T('Photo visit booked'), 'p-due'], listed: [T('Live'), 'p-ok'], declined: [T('Not listed'), 'p-pau'] };
    return '<div class="md-card md-sslist"><b>' + esc(T('Your short stays')) + '</b>' + L.map(function (r) {
      var st = ST[r.status] || [r.status, 'p-pau'];
      return '<div class="row"><span><b>' + esc(r.title || T(r.type || '')) + '</b><span class="dim">' + esc((r.building_name ? r.building_name + ' · ' : '') + 'KES ' + V.money(r.night_rate || 0) + ' / ' + T('night')) + '</span></span><span class="pill ' + st[1] + '">' + esc(st[0]) + '</span></div>';
    }).join('') + '</div>';
  }

  // ================= My buildings =================
  function drawBuildings(el) {
    var bs = S.buildings;
    if (!bs.length && (S.profile.kinds || []).length) {
      var kd = S.profile.kinds, joined = S.justJoined; S.justJoined = false;
      el.innerHTML = '<section class="md-karibu">' + (joined ? '<div class="md-done-tick pop">' + ICON.check + '</div>' : '') +
        '<div class="md-head"><div><h1>' + esc(T('Karibu')) + (firstName() ? ', ' + esc(firstName()) : '') + '!</h1><p>' + esc(joined ? T('Your account is ready. Where do you want to start?') : T('Where do you want to start?')) + '</p></div></div>' +
        '<div class="md-starts">' + (kd.indexOf('monthly') >= 0 ? '<div class="md-start em"><span class="hd"><i>' + ICON.bld + '</i><b>' + esc(T('Register a building')) + '</b></span><span>' + esc(T('For monthly rentals. 6 short steps, about 5 minutes. Add vacancies after.')) + '</span><button type="button" class="md-btn sun" data-reg>' + esc(T('Register a building')) + '</button></div>' : '') +
        (kd.indexOf('short') >= 0 ? '<div class="md-start nb"><span class="hd"><i>' + ICON.moon + '</i><b>' + esc(T('List a short stay')) + '</b></span><span>' + esc(T('For furnished units. 4 steps: unit, price & minimum stay, what\'s included, check.')) + '</span><button type="button" class="md-btn sun" data-short>' + esc(T('List a short stay')) + '</button></div>' : '') +
        '</div>' + shortList() + '<p class="dim" style="text-align:center;font-size:13px">' + esc(T('You only see the cards for what you ticked. Change it any time in Profile.')) + '</p>' +
        (loadDraft().name ? '<div class="md-note">' + esc(T('You have a building half registered.')) + ' <button type="button" class="md-link" data-reg>' + esc(T('Continue')) + '</button></div>' : '') + '</section>';
    } else if (!bs.length) {
      var how = [[T('Register your building'), T('Location, contacts, house types, amenities and rules. About 5 minutes.')],
        [T('We visit and take photos'), T('Our agent checks the units and films a short video.')],
        [T('Families start viewing'), T('You see every viewing and the agent bringing them.')]];
      el.innerHTML = '<section><div class="md-head"><div><h1>' + esc(T('Karibu')) + (firstName() ? ', ' + esc(firstName()) : '') + '</h1><p>' + esc(T("Let's get your first building on Viustay.")) + '</p></div></div>' +
        '<div class="md-hero"><div class="md-card md-first">' + photo({ id: 0 }, '<span class="pill pill-live" style="position:absolute;left:16px;top:14px">' + esc(T('Step 1 of 3')) + '</span>') +
        '<div class="in"><h2 style="font-size:22px">' + esc(T('Register your building')) + '</h2><p class="dim" style="margin:4px 0 14px">' + esc(T('Tell us about the whole building once. Add vacancies any time after.')) + '</p>' +
        '<button type="button" class="md-btn sun wide" data-reg>' + ICON.plus + esc(T('Register a building')) + '</button></div></div>' +
        '<div style="display:flex;flex-direction:column;gap:14px"><span class="k">' + esc(T('How it works')) + '</span><div class="md-how">' +
        how.map(function (h, i) { return '<div><i>' + (i + 1) + '</i><span><b>' + esc(h[0]) + '</b><br><span class="dim">' + esc(h[1]) + '</span></span></div>'; }).join('') + '</div>' +
        '<div class="md-note">' + ICON.info + '<span>' + esc(T('No fees until a tenant signs a lease.')) + '</span></div>' +
        (loadDraft().name ? '<div class="md-note">' + esc(T('You have a building half registered.')) + ' <button type="button" class="md-link" data-reg>' + esc(T('Continue')) + '</button></div>' : '') +
        '</div></div></section>';
    } else {
      var allU = S.units.filter(function (u) { return bs.some(function (b) { return b.id === u.building_id; }); });
      var mon = addDays(today(), -((new Date().getDay() + 6) % 7));
      var wk = S.views.filter(function (v) { return v.viewing_date >= mon && v.viewing_date <= addDays(mon, 6); }).length;
      el.innerHTML = '<section><div class="md-head"><div><h1>' + esc(T('My buildings')) + '</h1><p>' + hello() + ' · ' + esc(T('tap a building to open it')) + '</p></div>' +
        '<button type="button" class="md-btn sun" data-reg>' + ICON.plus + esc(T('Register a building')) + '</button></div>' +
        '<div class="md-bsum"><span><b>' + bs.length + '</b>' + esc(T('Buildings')) + '</span><span><b>' + allU.length + '</b>' + esc(T('Units')) + '</span><span><b>' +
        allU.filter(function (u) { return u.status === 'vacant'; }).length + '</b>' + esc(T('Vacant')) + '</span><span><b>' + wk + '</b>' + esc(T('Viewings this week')) + '</span></div>' +
        '<div class="md-blist">' + bs.map(bCard).join('') +
        '<button type="button" class="md-addb" data-reg><i>' + ICON.plus + '</i><span><b>' + esc(T('Register another building')) + '</b><span class="dim" style="font-size:13px">' + esc(T('Takes about 5 minutes')) + '</span></span></button></div>' +
        (shortOk() ? '<div class="md-ssrow">' + shortCard() + shortList() + '</div>' : shortList()) + '</section>';
    }
    V.$$('[data-reg]', el).forEach(function (b) { b.onclick = function () { nav('register'); }; });
    V.$$('[data-short]', el).forEach(function (b) { b.onclick = function () { Q = null; nav('short'); }; });
    V.$$('[data-bid]', el).forEach(function (c) { c.onclick = function () { openB(S.buildings.filter(function (b) { return String(b.id) === c.getAttribute('data-bid'); })[0]); }; });
  }
  function bCard(b) {
    var us = bUnits(b), live = b.status !== 'setting_up';
    var vac = us.filter(function (u) { return u.status === 'vacant'; }).length;
    var nx = upcomingOf(bViews(b))[0];
    var lab = '<span class="shade"></span><span class="lab"><span class="pill ' + (live ? 'pill-live">● ' + esc(T('Live')) : 'pill-setup">' + esc(T('Setting up'))) + '</span><span class="go">' + ICON.chev + '</span></span>' +
      '<span class="nm"><b>' + esc(b.name) + '</b><span>' + ICON.pin + ' ' + esc([b.road, b.location].filter(Boolean).join(', ')) + '</span></span>';
    var body;
    if (live) {
      body = '<span class="nums"><span><b>' + us.length + '</b>' + esc(T('Units')) + '</span><span><b style="color:#6B6B6B">' + vac + '</b>' + esc(T('Vacant')) + '</span><span><b>' + bViews(b).filter(function (v) { return v.viewing_date >= today(); }).length + '</b>' + esc(T('Viewings')) + '</span></span>' +
        (nx ? '<span class="note">' + esc(T('Next viewing')) + ' <b>' + esc(nx.viewing_date === today() ? T('today') : nx.viewing_date === addDays(today(), 1) ? T('tomorrow') : dayName(nx.viewing_date)) + ' ' + esc(shortTime(nx.viewing_time)) + '</b>' + (nx.agent_name ? ' · ' + esc(nx.agent_name.split(' ')[0]) : '') + '</span>' : '');
    } else {
      var st = setupSteps(b), done = st.filter(function (s) { return s[0] === 'done'; }).length, next = st.filter(function (s) { return s[0] === 'now'; })[0];
      body = '<span class="prog"><span class="row1"><b>' + esc(next ? next[1] + (next[2] ? ' · ' + next[2] : '') : '') + '</b><span class="dim">' + esc(T('{a} of {b}', { a: done, b: st.length })) + '</span></span><span class="bar" style="display:block"><i style="width:' + (done / st.length * 100) + '%;background:#0E5E54"></i></span></span>';
    }
    return '<button type="button" class="md-bcard" data-bid="' + b.id + '">' + photo(b, lab) + body + '</button>';
  }
  function setupSteps(b) {
    var hasU = bUnits(b).length > 0, live = b.status !== 'setting_up';
    var visit = b.visit_date ? dayName(b.visit_date) + (b.visit_time ? ', ' + T(b.visit_time).toLowerCase() : '') : '';
    return [
      ['done', T('Building registered'), b.name],
      [live ? 'done' : 'now', T('Photo visit'), visit ? T('{d} · our agent takes photos and a short video', { d: visit }) : T('We will call you to book a day')],
      [hasU ? 'done' : live ? 'now' : 'todo', T('Vacancies added'), hasU ? T('{n} units · {v} vacant', { n: bUnits(b).length, v: bUnits(b).filter(function (u) { return u.status === 'vacant'; }).length }) : T('Tap "Add vacancy" for each empty unit')],
      [isLive(b) ? 'done' : 'todo', T('Listed on Viustay'), T('Families can book viewings')]
    ];
  }

  // ================= Building banner =================
  // "Bedsitters, 1 & 2 bedrooms" from the house types registered (or the units added, for older buildings)
  var BEDN = { 'Bedsitter / studio': 0, 'Studio': 0, 'Bedsitter': 0, 'One bedroom': 1, '1 bedroom': 1, 'Two bedroom': 2, '2 bedrooms': 2, 'Three bedroom': 3, '3 bedrooms': 3, 'Four bedroom +': 4, '4 bedrooms': 4, '4+ bedrooms': 4 };
  function typesText(b) {
    var list = (D(b).house_types || []).map(function (h) { return h.type; });
    if (!list.length) list = bUnits(b).map(function (u) { return u.type; });
    var nums = [];
    list.forEach(function (t) { var n = BEDN.hasOwnProperty(t) ? BEDN[t] : null; if (n !== null && nums.indexOf(n) < 0) nums.push(n); });
    nums.sort();
    var studio = nums.indexOf(0) > -1, beds = nums.filter(function (n) { return n > 0; }).map(function (n) { return n === 4 ? '4+' : String(n); });
    var bedTxt = '';
    if (beds.length) bedTxt = (beds.length > 1 ? beds.slice(0, -1).join(', ') + ' & ' + beds[beds.length - 1] : beds[0]) + ' ' + (beds.length === 1 && beds[0] === '1' ? T('bedroom') : T('bedrooms'));
    if (studio && bedTxt) return T('Bedsitters') + (beds.length > 1 ? ', ' : ' & ') + bedTxt;
    return studio ? T('Bedsitters') : bedTxt;
  }
  function ordinal(n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  function band(b, actions) {
    var us = bUnits(b), live = b.status !== 'setting_up';
    var total = b.total_units || us.length;
    var sub = [typesText(b), total ? T('{n} units total', { n: V.money(total) }) : '', b.floors ? T('{n} floors', { n: b.floors }) : ''].filter(Boolean).join(' · ');
    return '<button type="button" class="md-band" data-det>' + photo(b, '<span class="shade2"></span><span class="txt"><span class="pill ' + (live ? 'pill-live">● ' + esc(T('Live')) : 'pill-setup">' + esc(T('Setting up'))) + '</span><b>' + esc(b.name) + '</b><span class="s">' + esc(sub) + '</span></span>' +
      '<span class="act">' + (actions || '<span>' + esc(T('Building details')) + ICON.chev + '</span>') + '</span>') + '</button>';
  }
  function wireBand(el) { V.$$('[data-det]', el).forEach(function (b) { b.onclick = function () { openB(S.b, 'details'); }; }); }

  // ================= Building home =================
  function drawHome(el) {
    var b = S.b, us = units(), vac = us.filter(function (u) { return u.status === 'vacant'; });
    var addBtn = '<button type="button" class="md-btn sun" data-add>' + ICON.plus + esc(T('Add vacancy')) + '</button>';
    var vacList = vac.slice().sort(function (a, c) { return daysSince(c.vacant_since) - daysSince(a.vacant_since); }).slice(0, 5).map(function (u) {
      return '<div class="md-row"><span class="md-sq">' + esc(u.label) + '</span><span class="grow"><b>' + esc(u.type) + '</b><br><span class="dim">KES ' + V.money(u.rent) + '</span></span>' + daysBar(u) + '</div>';
    }).join('');
    var vacCard = '<div class="md-card"><div class="md-card-head"><h2>' + esc(T('Vacant now · {n}', { n: vac.length })) + '</h2>' + addBtn.replace('md-btn sun', 'md-btn sun sm') + '</div>' +
      (vacList || '<p class="md-empty">' + esc(us.length ? T('Every unit is let. Well done!') : T('No vacancies yet. Tap "Add vacancy" for each empty unit.')) + '</p>') +
      (vac.length > 5 ? '<button type="button" class="md-link" data-tab2="units">' + esc(T('All units')) + '</button>' : '') + '</div>';

    if (b.status === 'setting_up' || !isLive(b)) {
      var st = setupSteps(b), done = st.filter(function (s) { return s[0] === 'done'; }).length, next = st.filter(function (s) { return s[0] === 'now'; })[0];
      el.innerHTML = '<section>' + band(b) +
        '<div class="md-hero"><div class="md-setup"><div style="display:flex;justify-content:space-between"><span class="k">' + esc(T('Getting set up')) + '</span><b>' + esc(T('{a} of {b}', { a: done, b: st.length })) + '</b></div>' +
        '<div class="bar"><i style="width:' + (done / st.length * 100) + '%;background:#0E5E54"></i></div>' +
        '<div style="font-size:15px;line-height:1.45">' + esc(T('Next:')) + ' <b>' + esc(next ? next[1] : '') + '</b>' + (next && next[2] ? ' · ' + esc(next[2]) : '') + '</div>' +
        '<p style="margin:12px 0 0;opacity:.85;font-size:14px">' + esc(T('You can add your vacancies now. We list them after the visit.')) + '</p></div>' +
        '<div class="md-card md-steps">' + st.map(function (s) {
          return '<div class="md-step s-' + s[0] + '"><i class="s-' + s[0] + '">' + (s[0] === 'done' ? '✓' : '') + '</i><span><b>' + esc(s[1]) + '</b><br><span class="dim" style="font-size:13px">' + esc(s[2]) + '</span></span></div>';
        }).join('') + '</div></div>' + vacCard +
        '<a class="md-btn" style="align-self:flex-start" target="_blank" rel="noopener" href="' + V.wa('Hi Viustay, a question about setting up ' + b.name) + '">' + ICON.wa + esc(T('Questions? WhatsApp us')) + '</a></section>';
    } else {
      var let_ = us.filter(function (u) { return u.status === 'let'; });
      var mon = addDays(today(), -((new Date().getDay() + 6) % 7));
      var wk = views().filter(function (v) { return v.viewing_date >= mon && v.viewing_date <= addDays(mon, 6); });
      var avg = vac.length ? Math.round(vac.reduce(function (s, u) { return s + daysSince(u.vacant_since); }, 0) / vac.length) : 0;
      var up = upcomingOf(views());
      var list = up.slice(0, 5).map(function (v) {
        var dd = v.viewing_date === today() ? T('Today') : v.viewing_date === addDays(today(), 1) ? T('Tomorrow') : dayName(v.viewing_date, { weekday: 'short' });
        return '<div class="md-row"><span class="t">' + (v.viewing_date === today() ? esc(shortTime(v.viewing_time)) : esc(dd) + '<br><span class="dim" style="font-size:13px">' + esc(shortTime(v.viewing_time)) + '</span>') + '</span>' +
          '<span class="grow"><b>' + esc(unitName(v)) + '</b></span>' + agentMini(v) + statusPill(v) + '</div>';
      }).join('') || '<p class="md-empty">' + esc(T('No viewings booked yet. We will show them here as soon as clients book.')) + '</p>';
      el.innerHTML = '<section>' + band(b, '<span>' + esc(T('Building details')) + ICON.chev + '</span>') +
        '<div class="md-hero">' + nextHtml(up[0]) + '<div class="md-stats">' +
        stat(T('Vacant units'), vac.length, T('of {n}', { n: us.length })) + stat(T('Viewings'), wk.length, T('this week')) +
        stat(T('Let units'), let_.length, T('of {n}', { n: us.length })) + stat(T('Days empty'), avg, T('average for vacant units')) + '</div></div>' +
        '<div class="md-two">' + vacCard + '<div class="md-card"><div class="md-card-head"><h2>' + esc(T('Coming viewings')) + '</h2><button type="button" class="md-link" data-tab2="viewings">' + esc(T('See all')) + '</button></div>' + list + '</div></div>' +
        tipHtml(vac) + '</section>';
    }
    wireBand(el);
    V.$$('[data-add]', el).forEach(function (x) { x.onclick = addSheet; });
    V.$$('[data-tab2]', el).forEach(function (x) { x.onclick = function () { openB(b, x.getAttribute('data-tab2')); }; });
    V.$$('[data-tipoff]', el).forEach(function (x) { x.onclick = function () { try { localStorage.setItem('vs-md-tip-' + x.getAttribute('data-tipoff'), today()); } catch (e) {} render(); }; });
  }
  function stat(label, n, sub) { return '<div class="md-stat"><small>' + esc(label) + '</small><b>' + n + '</b><span>' + esc(sub) + '</span></div>'; }
  function daysBar(u) {
    var d = daysSince(u.vacant_since), hot = d > 20;
    return '<span class="md-days"><span class="bar" style="display:block"><i style="width:' + Math.min(100, Math.max(4, d * 3)) + '%;background:' + (hot ? '#E24B4A' : '#0E5E54') + '"></i></span>' +
      '<span style="color:' + (hot ? '#A32D2D' : '#6B6B6B') + '">' + esc(d === 0 ? T('Empty from today') : d === 1 ? T('1 day empty') : T('{n} days empty', { n: d })) + '</span></span>';
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
    if (ms <= 0) return T('Now');
    var h = Math.floor(ms / 36e5), m = Math.round((ms % 36e5) / 6e4);
    return h ? T('in {h} h {m} min', { h: h, m: m }) : T('in {m} min', { m: m });
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
      V.wa('Hi Viustay, please film a short video of unit ' + u.label + ' at ' + S.b.name + '.') + '">' + esc(T('Book a video')) + '</a></div>';
  }

  // ================= Units =================
  function drawUnits(el) {
    var us = units();
    var c = { all: us.length, vacant: 0, let: 0, paused: 0 };
    us.forEach(function (u) { if (u.status === 'let') c.let++; else if (u.paused) c.paused++; else c.vacant++; });
    var shown = us.filter(function (u) { return S.filter === 'all' || (S.filter === 'let' ? u.status === 'let' : S.filter === 'paused' ? u.status === 'vacant' && u.paused : u.status === 'vacant' && !u.paused); })
      .sort(function (a, b) { var r = function (u) { return u.status === 'let' ? 2 : u.paused ? 1 : 0; }; return r(a) - r(b) || daysSince(b.vacant_since) - daysSince(a.vacant_since) || String(a.label).localeCompare(String(b.label)); });
    var chip = function (k, label) { return '<button type="button" data-f="' + k + '" aria-pressed="' + (S.filter === k) + '">' + esc(label) + ' ' + c[k] + '</button>'; };
    el.innerHTML = '<section>' + band(S.b, '<span>' + esc(T('Building details')) + ICON.chev + '</span>') +
      '<div class="md-head"><div><h1>' + esc(T('Units')) + '</h1></div><button type="button" class="md-btn sun" data-add>' + ICON.plus + esc(T('Add vacancy')) + '</button></div>' +
      '<div class="md-chips">' + chip('all', T('All')) + chip('vacant', T('Vacant')) + chip('let', T('Let')) + chip('paused', T('Paused')) + '</div>' +
      (shown.length ? '<div class="md-units">' + shown.map(unitCard).join('') + '</div>' : '<div class="md-card md-empty">' + esc(us.length ? T('No units in this list.') : T('No vacancies yet. Tap "Add vacancy" for each empty unit.')) + '</div>') + '</section>';
    wireBand(el);
    V.$$('[data-f]', el).forEach(function (b) { b.onclick = function () { S.filter = b.getAttribute('data-f'); render(); }; });
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
    var extra = [u.floor ? (/^\d+$/.test(u.floor) ? T('Floor {f}', { f: u.floor }) : T('{f} floor', { f: T(u.floor) })) : '', u.furnished && u.furnished !== 'No' ? T(u.furnished + ' furnished') : '', u.available_from && u.available_from > today() ? T('Free from {d}', { d: dayName(u.available_from) }) : ''].filter(Boolean).join(' · ');
    return '<div class="md-card md-unit"><div class="top"><span class="md-sq">' + esc(u.label) + '</span><span class="grow"><b>' + esc(T(u.type)) + '</b><br><span class="dim" style="font-size:13px">' +
      esc(T('KES {r} / month', { r: V.money(u.rent) })) + (extra ? ' · ' + esc(extra) : '') + '</span></span><span class="pill ' + st[0] + '">' + esc(st[1]) + '</span></div>' +
      (u.status === 'vacant' ? '<div class="daysrow">' + daysBar(u).replace('class="md-days"', 'class="md-days" style="width:auto;flex:1;display:flex;align-items:center;gap:8px"').replace('display:block', 'display:block;flex:1') + '</div>' : '') +
      '<div class="acts">' + acts + (next ? '<span class="dim" style="font-size:13px">' + esc(next === 1 ? T('1 viewing booked') : T('{n} viewings booked', { n: next })) + '</span>' : '') + '</div></div>';
  }
  function save(u, patch, done, close) {
    return rpc('manager_update_unit', { p_id: u.id, p: patch }).then(function (r) {
      if (r) { u.status = r.status; u.rent = r.rent; u.paused = r.paused; u.vacant_since = r.vacant_since; }
      else {
        if (patch.status) { if (patch.status !== u.status) u.vacant_since = patch.status === 'vacant' ? today() : null; u.status = patch.status; if (patch.status === 'let') u.paused = false; }
        if (patch.rent) u.rent = patch.rent; if ('paused' in patch) u.paused = patch.paused;
      }
      if (close) close(); toast(done); render();
    });
  }
  function sheetBtns(yes) { return '<p class="err hidden" data-err></p><div class="row"><button type="button" class="md-btn" data-close>' + esc(T('Cancel')) + '</button><button type="button" class="md-btn dark" data-yes>' + esc(yes) + '</button></div>'; }
  function confirmSheet(title, sub, yes, patch, u, done) {
    sheet('<h2>' + esc(title) + '</h2><p>' + esc(sub) + '</p>' + sheetBtns(yes), function (card, close) {
      var b = V.$('[data-yes]', card);
      b.onclick = function () { b.disabled = true; save(u, patch, done, close).catch(function (e) { b.disabled = false; sheetErr(card, errText(e)); }); };
    });
  }
  function rentSheet(u) {
    sheet('<h2>' + esc(T('Rent for {u}', { u: u.label })) + '</h2><p>' + esc(T('We update your listing with the new rent.')) + '</p>' +
      '<label>' + esc(T('Monthly rent (KES)')) + '<input type="number" inputmode="numeric" min="1000" step="500" value="' + (u.rent || '') + '" data-rentin></label>' + sheetBtns(T('Save rent')), function (card, close) {
      var b = V.$('[data-yes]', card), inp = V.$('[data-rentin]', card);
      b.onclick = function () {
        var r = parseInt(inp.value, 10);
        if (!(r >= 1000 && r <= 5000000)) { sheetErr(card, errText({ message: 'bad_rent' })); return; }
        b.disabled = true;
        save(u, { rent: r }, T('Rent saved'), close).catch(function (e) { b.disabled = false; sheetErr(card, errText(e)); });
      };
    });
  }
  // Add a vacancy: short Form B
  function addSheet() {
    var b = S.b, hts = (D(b).house_types || []);
    // Only the house types registered for this building (older buildings without any: the full list)
    var types = hts.length ? hts.map(function (h) { return h.type; }) : HTYPES.slice();
    // Floors from registration: Ground, 1st, 2nd ... (typed in if the building has no floor count)
    var nf = parseInt(b.floors, 10), floorField;
    if (nf > 0) {
      var fl = [T('Ground')]; for (var i = 1; i <= Math.min(nf, 80); i++) fl.push(ordinal(i));
      floorField = '<select data-fl>' + fl.map(function (f) { return '<option>' + esc(f) + '</option>'; }).join('') + '</select>';
    } else floorField = '<input type="text" maxlength="20" placeholder="' + esc(T('e.g. 3')) + '" data-fl>';
    var rentFor = function (t) { var h = hts.filter(function (x) { return x.type === t; })[0]; return h && h.rent ? h.rent : ''; };
    var depFor = function (t) { var h = hts.filter(function (x) { return x.type === t; })[0]; return h && h.deposit ? h.deposit : '1 month'; };
    sheet('<h2>' + esc(T('Add a vacancy')) + '</h2><p>' + esc(T('One empty unit at {b}. We list it after our agent checks it.', { b: b.name })) + '</p>' +
      '<div class="row"><label>' + esc(T('Unit no.')) + '<input type="text" maxlength="20" placeholder="' + esc(T('e.g. C2')) + '" data-l></label>' +
      '<label>' + esc(T('Floor')) + floorField + '</label></div>' +
      '<label>' + esc(T('House type')) + '<select data-t>' + types.map(function (t) { return '<option value="' + esc(t) + '">' + esc(T(t)) + '</option>'; }).join('') + '</select>' +
      (hts.length ? '<small class="dim" style="font-weight:400">' + esc(T('Only the types you registered. Add others in Building details.')) + '</small>' : '') + '</label>' +
      '<div class="row"><label>' + esc(T('Rent (KES)')) + '<input type="number" inputmode="numeric" min="1000" step="500" data-r value="' + esc(rentFor(types[0])) + '"></label>' +
      '<label>' + esc(T('Deposit')) + '<select data-d>' + ['1 month', '2 months', 'None'].map(function (o) { return '<option value="' + o + '"' + (o === depFor(types[0]) ? ' selected' : '') + '>' + esc(T(o)) + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="row"><label>' + esc(T('Furnished')) + '<select data-fu>' + ['No', 'Semi', 'Fully'].map(function (o) { return '<option value="' + o + '">' + esc(T(o)) + '</option>'; }).join('') + '</select></label>' +
      '<label>' + esc(T('Available from')) + '<input type="date" data-af min="' + today() + '" value="' + today() + '"></label></div>' + sheetBtns(T('Add vacancy')), function (card, close) {
      var ts = V.$('[data-t]', card);
      ts.onchange = function () { V.$('[data-r]', card).value = rentFor(ts.value); V.$('[data-d]', card).value = depFor(ts.value); };
      var btn = V.$('[data-yes]', card);
      btn.onclick = function () {
        var p = { label: V.$('[data-l]', card).value.trim().toUpperCase(), floor: V.$('[data-fl]', card).value.trim(), type: ts.value, rent: parseInt(V.$('[data-r]', card).value, 10),
          deposit: V.$('[data-d]', card).value, furnished: V.$('[data-fu]', card).value, available_from: V.$('[data-af]', card).value || null };
        if (!p.label) return sheetErr(card, errText({ message: 'bad_label' }));
        if (!(p.rent >= 1000 && p.rent <= 5000000)) return sheetErr(card, errText({ message: 'bad_rent' }));
        if (units().some(function (u) { return String(u.label).toUpperCase() === p.label; })) return sheetErr(card, errText({ message: 'label_taken' }));
        btn.disabled = true;
        rpc('manager_add_vacancy', { p_building: b.id, p: p }).then(function (res) {
          S.units.push({ id: res ? res.id : Date.now(), building_id: b.id, label: p.label, type: p.type, rent: p.rent, status: 'vacant', vacant_since: today(), listing_id: null, paused: false,
            added_by_manager: true, floor: p.floor, deposit: p.deposit, furnished: p.furnished, available_from: p.available_from });
          close(); toast(T('{u} added. Our agent checks it before we list it.', { u: p.label })); S.filter = 'all';
          if (S.route.tab === 'units') render(); else openB(b, 'units');
        }).catch(function (e) { btn.disabled = false; sheetErr(card, errText(e)); });
      };
    });
  }

  // ================= Viewings =================
  function drawViewings(el) {
    var monday = addDays(today(), -((new Date().getDay() + 6) % 7) + S.week * 7);
    if (!S.day || S.day < monday || S.day > addDays(monday, 6)) {
      S.day = S.week === 0 ? today() : monday;
      if (S.week !== 0) { for (var i = 0; i < 7; i++) { if (views().some(function (v) { return v.viewing_date === addDays(monday, i); })) { S.day = addDays(monday, i); break; } } }
    }
    var vs = views(), week = '';
    for (var d = 0; d < 7; d++) {
      var day = addDays(monday, d), n = vs.filter(function (v) { return v.viewing_date === day; }).length;
      week += '<button type="button" class="md-day' + (day === today() ? ' today' : '') + '" data-day="' + day + '" aria-pressed="' + (day === S.day) + '"><span>' + esc(dayName(day, { weekday: 'short' })) + '</span><b>' +
        new Date(day + 'T00:00:00').getDate() + '</b><span class="dots">' + new Array(Math.min(n, 4) + 1).join('<i></i>') + '</span></button>';
    }
    var list = vs.filter(function (v) { return v.viewing_date === S.day; }).sort(function (a, b) { return mins(a.viewing_time) - mins(b.viewing_time); });
    var weekCount = vs.filter(function (v) { return v.viewing_date >= monday && v.viewing_date <= addDays(monday, 6); }).length;
    var monthName = new Date(monday + 'T00:00:00').toLocaleDateString(lang(), { month: 'long' });
    el.innerHTML = '<section>' + band(S.b, '<span>' + esc(T('Building details')) + ICON.chev + '</span>') +
      '<div class="md-head"><div><h1>' + esc(T('Viewings')) + '</h1><p>' + esc(monthName) + ' · ' + esc(T('{n} this week', { n: weekCount })) + '</p></div>' +
      (S.week !== 0 ? '<button type="button" class="md-link" data-wk="0">' + esc(T('Back to this week')) + '</button>' : '') + '</div>' +
      '<div class="md-week"><button type="button" class="nav" data-wk="-1" aria-label="' + esc(T('Previous week')) + '">‹</button>' + week + '<button type="button" class="nav" data-wk="1" aria-label="' + esc(T('Next week')) + '">›</button></div>' +
      '<div class="md-chips" style="justify-content:space-between;align-items:center"><span class="k">' + esc(S.day === today() ? T('Today') + ' · ' + dayName(S.day, { weekday: 'long' }) : dayName(S.day, { weekday: 'long', day: 'numeric', month: 'short' })) + '</span>' +
      '<span><button type="button" data-wk="-1" class="md-link md-wk-phone">‹ ' + esc(T('Last week')) + '</button> &nbsp; <button type="button" data-wk="1" class="md-link md-wk-phone">' + esc(T('Next week')) + ' ›</button></span></div>' +
      '<div class="md-agenda">' + (list.map(slotHtml).join('') || '<div class="md-card md-empty">' + esc(T('No viewings on this day.')) + '</div>') + '</div>' +
      '<p class="dim" style="font-size:13px;margin:0">' + esc(T('Client contacts stay with Viustay. Our agent coordinates each viewing with your caretaker.')) + '</p></section>';
    wireBand(el);
    V.$$('[data-day]', el).forEach(function (b) { b.onclick = function () { S.day = b.getAttribute('data-day'); render(); }; });
    V.$$('[data-wk]', el).forEach(function (b) { b.onclick = function () { var w = +b.getAttribute('data-wk'); S.week = w === 0 ? 0 : S.week + w; S.day = null; render(); }; });
    V.$$('[data-out]', el).forEach(function (b) {
      b.onclick = function () {
        var v = S.views.filter(function (x) { return String(x.id) === b.getAttribute('data-vid'); })[0], o = b.getAttribute('data-out');
        var val = v.owner_outcome === o ? null : o;
        rpc('manager_viewing_outcome', { p_id: v.id, p_outcome: val }).then(function () { v.owner_outcome = val; render(); if (val) toast(T('Thanks, noted')); })
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
      '<div class="dim" style="font-size:13px;margin-top:2px">' + esc(u ? T(u.type) + ' · KES ' + V.money(u.rent) : (v.listing_title || '')) + (v.homes > 1 ? ' · ' + esc(T('client sees {n} homes on this trip', { n: v.homes })) : '') + '</div>' + agent + out + '</div></div>';
  }

  // ================= Building details =================
  function drawDetails(el) {
    var b = S.b, d = D(b), c = d.contacts || {}, sv = d.services || {}, ru = d.rules || {};
    var kv = function (k, v) { return v ? '<div class="md-kv"><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>' : ''; };
    var sec = function (title, step, inner) {
      return '<div class="md-card"><div class="md-card-head"><h2>' + esc(title) + '</h2><button type="button" class="md-link" data-edit="' + step + '">' + esc(T('Edit')) + '</button></div>' + (inner || '<p class="md-empty" style="padding:6px 0">' + esc(T('Not filled in yet')) + '</p>') + '</div>';
    };
    var tags = function (list) { return list.length ? '<div class="md-tags">' + list.map(function (t) { return '<span>' + esc(T(t)) + '</span>'; }).join('') + '</div>' : ''; };
    var amen = AMEN.map(function (g) { var v = sv[g[0]] || []; return v.length ? '<div style="margin-top:8px"><small class="dim" style="font-weight:600">' + esc(T(g[1])) + '</small>' + tags(v) + '</div>' : ''; }).join('') +
      (sv.other ? '<div style="margin-top:8px"><small class="dim" style="font-weight:600">' + esc(T('Other')) + '</small><div>' + esc(sv.other) + '</div></div>' : '') +
      (sv.parking_slots ? kv(T('Parking slots per unit'), sv.parking_slots) : '') + (sv.water_rate ? kv(T('Water rate per unit (KES)'), sv.water_rate) : '') + (sv.garbage_fee ? kv(T('Garbage per month (KES)'), sv.garbage_fee) : '');
    var hts = (d.house_types || []).map(function (h) {
      return '<div class="md-kv"><span>' + esc(T(h.type)) + '</span><b>' + esc([h.units ? T('{n} units', { n: h.units }) : '', h.rent ? 'KES ' + V.money(h.rent) : '', h.deposit ? T('deposit {d}', { d: T(h.deposit) }) : ''].filter(Boolean).join(' · ')) + '</b></div>';
    }).join('') + kv(T('Service charge (KES / month)'), d.service_charge ? V.money(d.service_charge) : '');
    el.innerHTML = '<section>' + band(b, '<span>' + ICON.back + esc(T('Overview')) + '</span>').replace('data-det', 'data-ov') +
      '<div class="md-head"><div><h1>' + esc(T('Building details')) + '</h1><p>' + esc(b.status === 'setting_up' ? T('Waiting for our photo visit') : T('Live on Viustay')) + (b.code ? ' · ' + esc(T('Ref {c}', { c: b.code })) : '') + '</p></div></div>' +
      '<div class="md-det">' +
      sec(T('Location'), 1, kv(T('Building'), b.name) + kv(T('Road / street'), b.road) + kv(T('Area'), b.location) + kv(T('Landmark'), b.landmark) + kv(T('Floors'), b.floors) + kv(T('Total units'), b.total_units) + (b.lat ? kv(T('Pin'), T('Saved')) : '')) +
      sec(T('Contacts'), 2, kv(T('Management / agent'), c.management) + kv(T('Office phone'), c.office_phone) + kv(T('Contact person'), c.person) + kv(T('Phone'), c.phone) + kv(T('Email'), c.email) +
        kv(T('Caretaker'), [c.caretaker, c.caretaker_phone].filter(Boolean).join(' · ')) + kv(T('Who can let the units'), c.who_lets ? T(c.who_lets) : '') +
        kv(T('Best time for viewings'), (c.viewing_times || []).map(function (x) { return T(x); }).join(', ')) + kv(T('Notice before a viewing'), c.notice_hours ? T('{n} hours', { n: c.notice_hours }) : '')) +
      sec(T('House types and rent'), 3, hts) +
      sec(T('Services and amenities'), 4, amen) +
      sec(T('House rules'), 5, kv(T('Pets'), ru.pets ? T(ru.pets) : '') + kv(T('Max occupants per unit'), ru.max_occupants) + kv(T('Notice to vacate'), ru.notice ? T(ru.notice) : '') +
        kv(T('Move-in needs'), (ru.move_in || []).map(function (x) { return T(x); }).join(', ')) + kv(T('Short stays / Airbnb'), ru.short_stays ? T(ru.short_stays) : '')) +
      '</div></section>';
    V.$$('[data-ov]', el).forEach(function (x) { x.onclick = function () { openB(b, 'home'); }; });
    V.$$('[data-edit]', el).forEach(function (x) { x.onclick = function () { W = null; nav('edit-' + b.id + '-' + x.getAttribute('data-edit')); }; });
  }

  // ================= Register / edit wizard (Form A) =================
  function blank() {
    return { name: '', road: '', area: '', area_other: '', landmark: '', floors: '', total_units: '', lat: '', lng: '',
      contacts: { management: '', office_phone: '', person: S.profile.name || '', phone: S.profile.phone || '', email: S.profile.email || '', caretaker: '', caretaker_phone: '', who_lets: '', viewing_times: [], notice_hours: '' },
      house_types: [], service_charge: '', services: {}, rules: { pets: '', max_occupants: '', notice: '', move_in: [], short_stays: '' }, visit_date: '', visit_time: '' };
  }
  function loadDraft() { var d = null; try { d = JSON.parse(localStorage.getItem('vs-md-draft') || 'null'); } catch (e) {} return d && d.contacts ? d : blank(); }
  function saveDraft() { if (W && !W.id) { try { localStorage.setItem('vs-md-draft', JSON.stringify(W.data)); } catch (e) {} } }
  function fromBuilding(b) {
    var d = D(b), x = blank();
    x.name = b.name || ''; x.road = b.road || ''; x.landmark = b.landmark || ''; x.floors = b.floors || ''; x.total_units = b.total_units || ''; x.lat = b.lat || ''; x.lng = b.lng || '';
    if (AREAS.indexOf(b.location) > -1) x.area = b.location; else { x.area = b.location ? 'Other' : ''; x.area_other = b.location || ''; }
    for (var k in (d.contacts || {})) x.contacts[k] = d.contacts[k];
    x.house_types = (d.house_types || []).slice(); x.service_charge = d.service_charge || ''; x.services = JSON.parse(JSON.stringify(d.services || {}));
    for (var r in (d.rules || {})) x.rules[r] = d.rules[r];
    x.visit_date = b.visit_date || ''; x.visit_time = b.visit_time || '';
    return x;
  }
  function payload(x) {
    var num = function (v) { var n = parseInt(v, 10); return isNaN(n) ? null : n; };
    return {
      name: x.name.trim(), road: x.road.trim(), area: x.area === 'Other' ? x.area_other.trim() : x.area, landmark: x.landmark.trim(),
      floors: num(x.floors), total_units: num(x.total_units), lat: x.lat || null, lng: x.lng || null, visit_date: x.visit_date || null, visit_time: x.visit_time || null,
      details: { contacts: x.contacts, house_types: x.house_types.map(function (h) { return { type: h.type, units: num(h.units), rent: num(h.rent), deposit: h.deposit || '', vacant: num(h.vacant) }; }),
        service_charge: num(x.service_charge), services: x.services, rules: x.rules }
    };
  }
  function cs(group, opts, sel, multi) {
    return '<div class="md-chipset" data-cs="' + group + '"' + (multi ? ' data-multi' : '') + '>' + opts.map(function (o) {
      var on = multi ? (sel || []).indexOf(o) > -1 : sel === o;
      return '<button type="button" data-v="' + esc(o) + '" aria-pressed="' + on + '">' + (on ? ICON.check : '') + esc(T(o)) + '</button>';
    }).join('') + '</div>';
  }
  function inp(key, label, val, opts) {
    opts = opts || {};
    return '<label class="md-f" data-fk="' + key + '">' + esc(label) + (opts.hint ? ' <small>' + esc(opts.hint) + '</small>' : '') +
      '<input data-k="' + key + '" type="' + (opts.type || 'text') + '"' + (opts.inputmode ? ' inputmode="' + opts.inputmode + '"' : '') + (opts.min ? ' min="' + opts.min + '"' : '') + (opts.max ? ' max="' + opts.max + '"' : '') +
      ' maxlength="' + (opts.maxlength || 160) + '" value="' + esc(val == null ? '' : val) + '"' + (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : '') + '></label>';
  }
  function getK(path) { var o = S.route.page === 'short' ? Q.data : W.data, p = path.split('.'); for (var i = 0; i < p.length - 1; i++) o = o[p[i]]; return [o, p[p.length - 1]]; }
  function setK(path, v) { var r = getK(path); r[0][r[1]] = v; }
  function valK(path) { var r = getK(path); return r[0][r[1]]; }

  function drawWizard(el) {
    var x = W.data, n = W.step, edit = !!W.id, body = '';
    var title = [T('Where is your building?'), T('Who do we deal with?'), T('House types and rent'), T('Services and amenities'), T('House rules'), edit ? T('Photo visit') : T('Book our photo visit')][n - 1];
    var sub = [T('This is how families and our agents find it.'), T('Management signs. The caretaker opens the doors.'), T('One row per house type. Add exact vacant units later.'),
      T('Tap everything your building has.'), T('What tenants and guests must know.'), edit ? T('When our agent comes to take photos.') : T('Our agent visits, checks the units and takes photos and a short video.')][n - 1];
    if (n === 1) {
      body = inp('name', T('Building name'), x.name, { ph: T('e.g. Sunrise Apartments') }) + inp('road', T('Road / street'), x.road, { ph: T('e.g. Argwings Kodhek Rd') }) +
        '<div class="md-f" data-fk="area">' + esc(T('Area')) + cs('area', AREAS.concat(['Other']), x.area) + '</div>' +
        (x.area === 'Other' ? inp('area_other', T('Which area?'), x.area_other, { maxlength: 80 }) : '') +
        '<div class="md-two-f">' + inp('floors', T('Floors'), x.floors, { type: 'number', inputmode: 'numeric', min: 0, max: 80 }) + inp('total_units', T('Total units'), x.total_units, { type: 'number', inputmode: 'numeric', min: 1, max: 2000 }) + '</div>' +
        inp('landmark', T('Landmark nearby'), x.landmark, { hint: T('optional'), ph: T('e.g. opposite Yaya Centre') }) +
        '<div class="md-card" style="display:flex;align-items:center;gap:12px;padding:12px 14px"><span class="md-sq">' + ICON.pin.replace('style="width:14px;height:14px;vertical-align:-2px"', '') + '</span><span class="grow" style="flex:1;font-size:14px"><b>' + esc(T('Pin on the map')) + '</b><br><span class="dim">' +
        esc(x.lat ? T('Saved. Thank you!') : T('Stand at the building and tap. Optional.')) + '</span></span><button type="button" class="md-btn sm" data-geo>' + esc(x.lat ? T('Update') : T('Use my location')) + '</button></div>';
    } else if (n === 2) {
      var c = x.contacts;
      body = '<div class="md-card md-grp" style="display:flex;flex-direction:column;gap:12px"><b>' + esc(T('Management')) + '</b>' +
        inp('contacts.management', T('Management company / agent'), c.management, { hint: T('optional') }) + inp('contacts.office_phone', T('Office phone'), c.office_phone, { type: 'tel', maxlength: 20, hint: T('optional') }) +
        inp('contacts.person', T('Contact person'), c.person) + '<div class="md-two-f">' + inp('contacts.phone', T('Phone'), c.phone, { type: 'tel', maxlength: 20 }) + inp('contacts.email', T('Email'), c.email, { type: 'email', hint: T('optional') }) + '</div></div>' +
        '<div class="md-card md-grp" style="display:flex;flex-direction:column;gap:12px"><b>' + esc(T('Caretaker')) + '</b><div class="md-two-f">' + inp('contacts.caretaker', T('Name'), c.caretaker) + inp('contacts.caretaker_phone', T('Phone'), c.caretaker_phone, { type: 'tel', maxlength: 20 }) + '</div></div>' +
        '<div class="md-f">' + esc(T('Who can let the units?')) + cs('contacts.who_lets', ['Management company', 'Agent', 'Owner'], c.who_lets) + '</div>' +
        '<div class="md-f">' + esc(T('Best time for viewings')) + cs('contacts.viewing_times', ['Weekday mornings', 'Weekday afternoons', 'Saturdays', 'Any time'], c.viewing_times, true) + '</div>' +
        inp('contacts.notice_hours', T('Notice needed before a viewing (hours)'), c.notice_hours, { type: 'number', inputmode: 'numeric', min: 0, max: 72 });
    } else if (n === 3) {
      body = '<div data-fk="types" style="display:flex;flex-direction:column;gap:10px">' + HTYPES.map(function (t) {
        var h = x.house_types.filter(function (y) { return y.type === t; })[0];
        if (!h) return '<button type="button" class="md-card md-ht off" data-ht-add="' + esc(t) + '"><span class="h3row"><b>' + esc(T(t)) + '</b><span style="display:inline-flex;align-items:center;gap:4px;font-weight:600">' + ICON.plus + esc(T('Add')) + '</span></span></button>';
        var i = x.house_types.indexOf(h);
        return '<div class="md-card md-ht"><div class="h3row"><b>' + esc(T(t)) + '</b><button type="button" class="md-link" style="color:#A32D2D" data-ht-rm="' + i + '">' + esc(T('Remove')) + '</button></div><div class="grid">' +
          '<label>' + esc(T('Units')) + '<input type="number" inputmode="numeric" min="0" data-ht="' + i + '.units" value="' + esc(h.units || '') + '"></label>' +
          '<label>' + esc(T('Rent (KES)')) + '<input type="number" inputmode="numeric" min="0" step="500" data-ht="' + i + '.rent" value="' + esc(h.rent || '') + '"></label>' +
          '<label>' + esc(T('Deposit')) + '<select data-ht="' + i + '.deposit">' + ['1 month', '2 months', 'None'].map(function (o) { return '<option value="' + o + '"' + ((h.deposit || '1 month') === o ? ' selected' : '') + '>' + esc(T(o)) + '</option>'; }).join('') + '</select></label>' +
          '<label>' + esc(T('Vacant now')) + '<input type="number" inputmode="numeric" min="0" data-ht="' + i + '.vacant" value="' + esc(h.vacant || '') + '"></label></div></div>';
      }).join('') + '</div>' + inp('service_charge', T('Service charge per month (KES)'), x.service_charge, { type: 'number', inputmode: 'numeric', min: 0, hint: T('optional') });
    } else if (n === 4) {
      var sv = x.services;
      body = AMEN.map(function (g) {
        var extra = '';
        if (g[0] === 'water_billing' && (sv.water_billing || []).indexOf('Metered') > -1) extra = inp('services.water_rate', T('Rate per unit (KES)'), sv.water_rate, { type: 'number', inputmode: 'numeric', min: 0 });
        if (g[0] === 'parking' && (sv.parking || []).indexOf('Parking') > -1) extra = inp('services.parking_slots', T('Parking slots per unit'), sv.parking_slots, { type: 'number', inputmode: 'numeric', min: 0, max: 10 });
        if (g[0] === 'garbage' && (sv.garbage || []).indexOf('Charged monthly') > -1) extra = inp('services.garbage_fee', T('Garbage per month (KES)'), sv.garbage_fee, { type: 'number', inputmode: 'numeric', min: 0 });
        if (g[0] === 'amenities') extra = inp('services.other', T('Other amenities'), sv.other, { hint: T('optional'), maxlength: 120 });
        return '<div class="md-card md-grp"><b>' + esc(T(g[1])) + '</b>' + cs('services.' + g[0], g[2], sv[g[0]] || [], true) + (extra ? '<div style="margin-top:10px">' + extra + '</div>' : '') + '</div>';
      }).join('');
    } else if (n === 5) {
      var ru = x.rules;
      body = '<div class="md-f">' + esc(T('Pets')) + cs('rules.pets', ['Allowed', 'Not allowed'], ru.pets) + '</div>' +
        inp('rules.max_occupants', T('Max occupants per unit'), ru.max_occupants, { type: 'number', inputmode: 'numeric', min: 1, max: 20, hint: T('optional') }) +
        '<div class="md-f">' + esc(T('Notice to vacate')) + cs('rules.notice', ['1 month', '2 months', 'Other'], ru.notice) + '</div>' +
        '<div class="md-f">' + esc(T('Move-in needs')) + cs('rules.move_in', ['ID', 'KRA PIN', 'Signed lease', 'Deposit paid'], ru.move_in, true) + '</div>' +
        '<div class="md-f">' + esc(T('Short stays / Airbnb')) + cs('rules.short_stays', ['Allowed', 'Not allowed'], ru.short_stays) + '</div>';
    } else {
      var tmr = addDays(today(), 1);
      body = '<div class="md-two-f">' + inp('visit_date', T('Day'), x.visit_date, { type: 'date', min: tmr, max: addDays(today(), 60) }) +
        '<div class="md-f">' + esc(T('Time')) + cs('visit_time', ['Morning', 'Afternoon'], x.visit_time) + '</div></div>' +
        '<div class="md-note">' + ICON.info + '<span>' + esc(T('We confirm the visit by phone. If you skip this, we call you to book a day.')) + '</span></div>' +
        (edit ? '' : '<div class="md-card md-review"><div class="md-card-head"><h2>' + esc(T('Check before you send')) + '</h2></div>' +
          '<div class="md-kv"><span>' + esc(T('Building')) + '</span><b>' + esc(x.name) + '</b></div>' +
          '<div class="md-kv"><span>' + esc(T('Where')) + '</span><b>' + esc([x.road, x.area === 'Other' ? x.area_other : x.area].filter(Boolean).join(', ')) + '</b></div>' +
          '<div class="md-kv"><span>' + esc(T('Contact')) + '</span><b>' + esc([x.contacts.person, x.contacts.phone].filter(Boolean).join(' · ')) + '</b></div>' +
          '<div class="md-kv"><span>' + esc(T('House types')) + '</span><b>' + esc(x.house_types.map(function (h) { return T(h.type); }).join(', ')) + '</b></div>' +
          '<div class="md-kv"><span>' + esc(T('Amenities')) + '</span><b>' + esc([].concat.apply([], AMEN.map(function (g) { return (x.services[g[0]] || []); })).length + ' ' + T('selected')) + '</b></div></div>');
    }
    var bars = STEPS.map(function (s, i) { return '<i class="' + (i < n ? 'on' : '') + '"></i>'; }).join('');
    var last = n === 6;
    el.innerHTML = '<section class="md-wiz"><div class="md-wiz-top"><span class="k">' + esc(edit ? T('Edit building') : T('Register a building')) + ' · ' + esc(T('{a} of {b}', { a: n, b: 6 })) + ' · ' + esc(T(STEPS[n - 1])) + '</span>' +
      (edit ? '' : '<button type="button" class="md-link" data-later>' + esc(T('Save & finish later')) + '</button>') + '</div><div class="md-bars">' + bars + '</div>' +
      '<div><h1 style="font-size:26px">' + esc(title) + '</h1><p class="dim" style="margin:4px 0 0">' + esc(sub) + '</p></div>' + body + '</section>' +
      '<div class="md-wiz-foot">' + (n > 1 && !edit ? '<button type="button" class="md-btn" data-prev>' + esc(T('Back')) + '</button>' : '') +
      (edit ? '<button type="button" class="md-btn" data-cancel>' + esc(T('Cancel')) + '</button>' : '') +
      '<button type="button" class="md-btn sun" data-next>' + esc(edit ? T('Save changes') : last ? T('Register building') : T('Next: {s}', { s: T(STEPS[n]) })) + '</button><span class="err hidden" data-werr></span></div>';
    wireWizard(el);
  }
  function wireWizard(el) {
    var x = W.data;
    V.$$('[data-k]', el).forEach(function (i) { i.oninput = function () { setK(i.getAttribute('data-k'), i.value); saveDraft(); var f = i.closest('.md-f'); if (f) f.classList.remove('bad'); }; });
    V.$$('[data-cs]', el).forEach(function (set) {
      var key = set.getAttribute('data-cs'), multi = set.hasAttribute('data-multi');
      V.$$('button', set).forEach(function (b) {
        b.onclick = function () {
          var v = b.getAttribute('data-v');
          if (multi) { var arr = (valK(key) || []).slice(), i = arr.indexOf(v); if (i > -1) arr.splice(i, 1); else arr.push(v); setK(key, arr); }
          else setK(key, valK(key) === v ? '' : v);
          saveDraft(); var y = window.scrollY; render(); window.scrollTo(0, y);
        };
      });
    });
    V.$$('[data-ht-add]', el).forEach(function (b) { b.onclick = function () { x.house_types.push({ type: b.getAttribute('data-ht-add'), units: '', rent: '', deposit: '1 month', vacant: '' }); x.house_types.sort(function (a, c) { return HTYPES.indexOf(a.type) - HTYPES.indexOf(c.type); }); saveDraft(); var y = window.scrollY; render(); window.scrollTo(0, y); }; });
    V.$$('[data-ht-rm]', el).forEach(function (b) { b.onclick = function () { x.house_types.splice(+b.getAttribute('data-ht-rm'), 1); saveDraft(); var y = window.scrollY; render(); window.scrollTo(0, y); }; });
    V.$$('[data-ht]', el).forEach(function (i) { var p = i.getAttribute('data-ht').split('.'); var f = function () { x.house_types[+p[0]][p[1]] = i.value; saveDraft(); }; i.oninput = f; i.onchange = f; });
    var geo = V.$('[data-geo]', el);
    if (geo) geo.onclick = function () {
      if (!navigator.geolocation) { toast(T('Your phone could not share its location.')); return; }
      geo.disabled = true;
      navigator.geolocation.getCurrentPosition(function (p) {
        var la = p.coords.latitude, ln = p.coords.longitude;
        if (la < -1.75 || la > -0.95 || ln < 36.45 || ln > 37.25) { geo.disabled = false; toast(errText({ message: 'bad_pin' })); return; }
        x.lat = la.toFixed(6); x.lng = ln.toFixed(6); saveDraft(); render();
      }, function () { geo.disabled = false; toast(T('Your phone could not share its location.')); }, { enableHighAccuracy: true, timeout: 12000 });
    };
    var later = V.$('[data-later]', el); if (later) later.onclick = function () { saveDraft(); toast(T('Saved. Finish any time from My buildings.')); nav('buildings'); };
    var prev = V.$('[data-prev]', el); if (prev) prev.onclick = function () { W.step--; render(); window.scrollTo(0, 0); };
    var cancel = V.$('[data-cancel]', el); if (cancel) cancel.onclick = function () { nav('b-' + W.id + '-details'); };
    V.$('[data-next]', el).onclick = function () { next(el); };
  }
  function bad(el, key, t) {
    var f = V.$('[data-fk="' + key + '"]', el); if (f) { f.classList.add('bad'); f.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    var e = V.$('[data-werr]', el); e.textContent = t; e.classList.remove('hidden');
    return false;
  }
  function checkStep(el, n) {
    var x = W.data, digits = function (s) { return String(s || '').replace(/\D/g, '').length; };
    if (n === 1) {
      if (x.name.trim().length < 2) return bad(el, 'name', errText({ message: 'bad_name' }));
      if (x.road.trim().length < 2) return bad(el, 'road', errText({ message: 'bad_road' }));
      if (!x.area || (x.area === 'Other' && x.area_other.trim().length < 2)) return bad(el, x.area === 'Other' ? 'area_other' : 'area', errText({ message: 'bad_area' }));
    }
    if (n === 2) {
      if (x.contacts.person.trim().length < 2) return bad(el, 'contacts.person', errText({ message: 'bad_contact' }));
      if (digits(x.contacts.phone) < 9 || digits(x.contacts.phone) > 13) return bad(el, 'contacts.phone', errText({ message: 'bad_phone' }));
      if (x.contacts.caretaker_phone && (digits(x.contacts.caretaker_phone) < 9 || digits(x.contacts.caretaker_phone) > 13)) return bad(el, 'contacts.caretaker_phone', errText({ message: 'bad_phone' }));
    }
    if (n === 3 && !x.house_types.length) return bad(el, 'types', errText({ message: 'bad_types' }));
    return true;
  }
  function next(el) {
    var n = W.step;
    if (!checkStep(el, n)) return;
    if (W.id) { // edit: save straight away
      for (var s = 1; s <= 3; s++) if (!checkStep(el, s)) { W.step = s; render(); return; }
      var btn = V.$('[data-next]', el); btn.disabled = true;
      var p = payload(W.data);
      rpc('manager_update_building', { p_id: W.id, p: p }).then(function () {
        var b = S.buildings.filter(function (y) { return y.id === W.id; })[0];
        b.name = p.name; b.road = p.road; b.location = p.area; b.landmark = p.landmark; b.floors = p.floors; b.total_units = p.total_units;
        if (p.lat) { b.lat = p.lat; b.lng = p.lng; }
        if (b.status === 'setting_up' && p.visit_date) { b.visit_date = p.visit_date; b.visit_time = p.visit_time; }
        b.details = p.details; var id = W.id; W = null; toast(T('Saved')); nav('b-' + id + '-details');
      }).catch(function (e) { btn.disabled = false; var er = V.$('[data-werr]', el); er.textContent = errText(e); er.classList.remove('hidden'); });
      return;
    }
    if (n < 6) { W.step++; saveDraft(); render(); window.scrollTo(0, 0); return; }
    for (var k = 1; k <= 3; k++) if (!checkStep(el, k)) { W.step = k; render(); setTimeout(function () { checkStep(V.$('#md-view'), W.step); }, 0); return; }
    var b2 = V.$('[data-next]', el); b2.disabled = true;
    var pl = payload(W.data);
    rpc('manager_register_building', { p: pl }).then(function (r) {
      var nb = { id: r ? r.id : Date.now() % 100000, code: r ? r.code : 'NEW-001', name: pl.name, location: pl.area, road: pl.road, landmark: pl.landmark, floors: pl.floors, total_units: pl.total_units,
        lat: pl.lat, lng: pl.lng, status: 'setting_up', visit_date: pl.visit_date, visit_time: pl.visit_time, details: pl.details };
      S.buildings.push(nb);
      try { localStorage.removeItem('vs-md-draft'); } catch (e) {}
      W = null; done(T('Building registered'), function () { openB(nb, 'home'); });
    }).catch(function (e) { b2.disabled = false; var er = V.$('[data-werr]', el); er.textContent = errText(e); er.classList.remove('hidden'); });
  }
  function done(text, then) {
    var o = document.createElement('div');
    o.className = 'bk-made';
    o.setAttribute('role', 'status');
    o.style.cssText = 'position:fixed;inset:0;z-index:80;background:linear-gradient(150deg,#1F1F1F,#111111);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;font:600 26px Plus Jakarta Sans,sans-serif;text-align:center;padding:24px';
    o.innerHTML = '<span style="width:84px;height:84px;border-radius:50%;background:#0E5E54;color:#FFFFFF;display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" style="width:44px;height:44px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round"><path d="M5 12l5 5 9-10"/></svg></span>' +
      esc(text) + '<span style="font:400 16px \'Plus Jakarta Sans\',sans-serif;opacity:.9;max-width:320px">' + esc(T('Next, add your vacancies. We call you to confirm the photo visit.')) + '</span>';
    document.body.appendChild(o);
    setTimeout(function () { o.remove(); then(); }, 2200);
  }

  // ================= Profile =================
  function drawProfile(el) {
    var p = S.profile;
    var sw = function (k, label, sub) { return '<div class="md-li"><span class="lbl"><b>' + esc(label) + '</b><small>' + esc(sub) + '</small></span><button type="button" class="md-sw" role="switch" aria-label="' + esc(label) + '" aria-checked="' + !!p[k] + '" data-sw="' + k + '"></button></div>'; };
    var li = function (k, label, val) { return '<button type="button" class="md-li" data-pedit="' + k + '"><b>' + esc(label) + '</b><span class="v">' + esc(val) + '</span><span class="chev">›</span></button>'; };
    var langs = (window.VT && VT.LANGS) || { en: 'English' }, cur = (window.VT && VT.lang && VT.lang()) || 'en';
    el.innerHTML = '<section><div class="md-head"><div><h1>' + esc(T('Profile & settings')) + '</h1></div></div>' +
      '<div class="md-who"><span class="md-av">' + esc(initials(p.name, p.email)) + '</span><span><h2 style="font-size:21px">' + esc(p.name || T('Add your name')) + '</h2><span class="dim" style="font-size:14px">' +
      esc(T('Manager')) + (S.buildings.length ? ' · ' + esc(S.buildings.map(function (b) { return b.name; }).join(', ')) : '') + '</span></span></div>' +
      '<div class="md-prof"><div style="display:flex;flex-direction:column;gap:8px"><span class="k">' + esc(T('Account')) + '</span><div class="md-card md-list">' +
      li('name', T('Name'), p.name || T('Add')) + li('phone', T('Phone'), p.phone || T('Add')) +
      '<div class="md-li"><b>' + esc(T('Email')) + '</b><span class="v">' + esc(p.email || '') + '</span></div>' +
      li('password', T('Password'), T('Change')) + '</div>' +
      '<div class="md-card md-list" style="margin-top:10px"><div class="md-li" style="flex-direction:column;align-items:stretch;gap:8px"><b>' + esc(T('What do you have?')) + '</b>' +
      '<div class="md-chipset" data-kinds>' + [['monthly', T('Monthly rentals')], ['short', T('Furnished short stays')]].map(function (o) { var on = (p.kinds || []).indexOf(o[0]) >= 0; return '<button type="button" data-v="' + o[0] + '" aria-pressed="' + on + '">' + (on ? ICON.check : '') + esc(o[1]) + '</button>'; }).join('') + '</div></div></div>' +
      '<div class="md-card md-list" style="margin-top:10px"><label class="md-li"><b>' + esc(T('Language')) + '</b><select data-lang>' + Object.keys(langs).map(function (k) { return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + esc(langs[k]) + '</option>'; }).join('') + '</select></label>' +
      '<a class="md-li" target="_blank" rel="noopener" href="' + V.wa('Hi Viustay, I need help with my manager dashboard') + '"><b>' + esc(T('Help')) + '</b><span class="v">' + esc(T('WhatsApp us')) + '</span><span class="chev">›</span></a></div></div>' +
      '<div style="display:flex;flex-direction:column;gap:8px"><span class="k">' + esc(T('Notify me when')) + '</span><div class="md-card md-list">' +
      sw('notify_booked', T('A viewing is booked'), T('By WhatsApp or SMS')) + sw('notify_agent', T('The agent is on the way'), T('So your caretaker is ready')) + sw('notify_weekly', T('Weekly summary'), T('Every Monday by email')) + '</div>' +
      '<button type="button" class="md-btn red wide" style="margin-top:10px" data-logout2>' + esc(T('Log out')) + '</button></div></div></section>';
    V.$$('[data-sw]', el).forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute('data-sw'), val = !p[k], patch = {}; patch[k] = val;
        p[k] = val; b.setAttribute('aria-checked', String(val));
        rpc('save_my_profile', { p: patch }).then(function () { toast(T('Saved')); }).catch(function (e) { p[k] = !val; b.setAttribute('aria-checked', String(!val)); toast(errText(e)); });
      };
    });
    V.$$('[data-pedit]', el).forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-pedit'); if (k === 'password') pwSheet(); else fieldSheet(k); }; });
    V.$$('[data-kinds] button', el).forEach(function (b) { b.onclick = function () {
      var k = b.getAttribute('data-v'), arr = (p.kinds || []).slice(), i = arr.indexOf(k); if (i >= 0) arr.splice(i, 1); else arr.push(k);
      if (!arr.length) { toast(T('Keep at least one.')); return; }
      p.kinds = arr; render();
      rpc('save_my_profile', { p: { kinds: arr } }).then(function () { toast(T('Saved')); }).catch(function (e) { toast(errText(e)); });
    }; });
    V.$('[data-lang]', el).onchange = function () { if (window.VT && VT.set) VT.set(this.value); };
    V.$('[data-logout2]', el).onclick = logout;
  }
  function fieldSheet(k) {
    var label = k === 'name' ? T('Your name') : T('Your phone');
    sheet('<h2>' + esc(label) + '</h2><label>' + esc(label) + '<input type="' + (k === 'phone' ? 'tel' : 'text') + '" maxlength="' + (k === 'phone' ? 20 : 120) + '" value="' + esc(S.profile[k] || '') + '" data-in enterkeyhint="done"></label>' + sheetBtns(T('Save')), function (card, close) {
      var b = V.$('[data-yes]', card), inp2 = V.$('[data-in]', card);
      var go = function () {
        var val = inp2.value.trim(), patch = {}; patch[k] = val;
        if (k === 'phone' && val && !/^\+?[\d\s-]{9,20}$/.test(val)) { sheetErr(card, errText({ message: 'bad_phone' })); return; }
        b.disabled = true;
        rpc('save_my_profile', { p: patch }).then(function (r) { if (r) S.profile = r; else S.profile[k] = val; close(); toast(T('Saved')); render(); })
          .catch(function (e) { b.disabled = false; sheetErr(card, errText(e)); });
      };
      b.onclick = go;
      inp2.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } };
    });
  }
  function pwSheet() {
    sheet('<h2>' + esc(T('Change password')) + '</h2><label>' + esc(T('New password')) + '<input type="password" autocomplete="new-password" minlength="8" data-p1></label>' +
      '<label>' + esc(T('Type it again')) + '<input type="password" autocomplete="new-password" minlength="8" data-p2></label>' + sheetBtns(T('Save password')), function (card, close) {
      var b = V.$('[data-yes]', card);
      var fail = function (t) { b.disabled = false; sheetErr(card, t); };
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
    S.buildings = (data.buildings || []).map(function (b) { if (!b.details) b.details = {}; if (!b.status) b.status = 'live'; return b; });
    S.units = data.units || []; S.views = data.viewings || []; S.profile = data.profile || {};
    document.body.classList.add('md-on');
    V.$('#auth').classList.add('hidden');
    V.$('#dash').classList.remove('hidden');
    route();
  }

  // ---------- Demo mode: sample data so the page can be previewed ----------
  if (V.demo) {
    var t0 = today(), wd = function (n) { return addDays(t0, n); };
    var hassan = { agent_name: 'Hassan Ali', agent_phone: '0712000111', agent_car: 'Silver Probox', agent_plate: 'KDA 123A', agent_photo: null };
    var mk = function (id, d, t, lid, st, ag) { var o = { id: id, building_id: 1, viewing_date: d, viewing_time: t, listing_id: lid, listing_title: '', status: st, owner_outcome: null, homes: 3 }; for (var k in (ag || {})) o[k] = ag[k]; return o; };
    showDash({
      buildings: [
        { id: 1, code: 'KIL-101', name: 'Sunrise Apartments', location: 'Kilimani', road: 'Argwings Kodhek Rd', floors: 6, total_units: 12, status: 'live',
          details: { contacts: { person: 'Amina Mohamed', phone: '0712 345 678', caretaker: 'Joseph', caretaker_phone: '0722 111 222', viewing_times: ['Weekday mornings', 'Saturdays'], notice_hours: 2 },
            house_types: [{ type: 'One bedroom', units: 4, rent: 26000, deposit: '1 month' }, { type: 'Two bedroom', units: 8, rent: 38000, deposit: '2 months' }],
            services: { water_source: ['Borehole', 'City water'], electricity: ['Token', 'Backup generator'], security: ['Gate', 'Guards', 'CCTV'], parking: ['Parking', 'Lift'], amenities: ['Rooftop'] },
            rules: { pets: 'Not allowed', notice: '1 month', short_stays: 'Not allowed', move_in: ['ID', 'Signed lease'] } } },
        { id: 2, code: 'WES-202', name: 'Palm Court', location: 'Westlands', road: 'Rhapta Rd', status: 'setting_up', visit_date: wd(3), visit_time: 'Morning', details: { house_types: [{ type: 'One bedroom', units: 6, rent: 28000 }] } }
      ],
      units: [
        { id: 1, building_id: 1, label: 'C2', type: 'Two bedroom', rent: 38000, status: 'vacant', vacant_since: wd(-24), listing_id: 'VS-007', paused: false },
        { id: 2, building_id: 1, label: 'A1', type: 'Two bedroom', rent: 35000, status: 'vacant', vacant_since: wd(-9), listing_id: 'VS-001', paused: false },
        { id: 4, building_id: 1, label: 'B4', type: 'One bedroom', rent: 26000, status: 'let', vacant_since: null, listing_id: 'VS-004', paused: false }
      ],
      viewings: [mk(2, wd(0), '9:00 AM', 'VS-007', 'done', hassan), mk(3, wd(1), '11:30 AM', 'VS-001', 'confirmed', hassan), mk(5, wd(2), '11:30 AM', 'VS-007', 'new', null)],
      profile: { email: 'amina@sunrise.co.ke', name: 'Amina Mohamed', phone: '0712 345 678', notify_booked: true, notify_agent: true, notify_weekly: false }
    });
    return;
  }

  // ---------- Live mode ----------
  V.$('#forgot').addEventListener('click', function () {
    var email = authForm.email.value.trim();
    if (!email) { msg(err, T('Type your email first, then tap "Forgot password?".')); return; }
    V.db.auth.resetPasswordForEmail(email, { redirectTo: window.location.href.split('?')[0].split('#')[0] + '?reset=1' })
      .then(function (r) { if (r.error) throw r.error; msg(err); msg(info, T('Check your email for a reset link.')); })
      .catch(function (e) { msg(err, e.message || T('Could not send the reset email.')); });
  });

  authForm.addEventListener('submit', function (e) {
    e.preventDefault();
    msg(err); msg(info);
    var email = authForm.email.value.trim().toLowerCase(), pw = authForm.password.value;
    if (!email || pw.length < 8) { msg(err, T('Enter your email and a password of at least 8 characters.')); return; }
    var pending = null;
    if (mode === 'signup') {
      var nm = authForm.name.value.trim(), ph = authForm.phone.value.trim(), dg = ph.replace(/\D/g, '').length;
      if (nm.length < 2) { msg(err, T('Enter your full name.')); authForm.name.focus(); return; }
      if (dg < 9 || dg > 13) { msg(err, T('Check the phone number.')); authForm.phone.focus(); return; }
      pending = { name: nm, phone: ph, company: authForm.company.value.trim(), kinds: SU.kinds, role: SU.role, unit_count: SU.unit_count };
      try { localStorage.setItem('vs-md-pending', JSON.stringify(pending)); } catch (x) {}
    }
    var btn = V.$('#auth-submit'); btn.disabled = true;
    var p;
    if (params.get('reset') && mode === 'login') p = V.db.auth.updateUser({ password: pw });
    else if (mode === 'signup') p = V.db.auth.signUp({ email: email, password: pw, options: { emailRedirectTo: window.location.href.split('?')[0].split('#')[0], data: { vs_profile: pending } } });
    else p = V.db.auth.signInWithPassword({ email: email, password: pw });
    p.then(function (r) {
      btn.disabled = false;
      if (r.error) throw r.error;
      if (mode === 'signup' && !r.data.session) { setMode('login'); msg(info, T('Check your email and tap the link to confirm, then log in here.')); return; }
      if (mode === 'signup') S.justJoined = true;
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
      var pend = null; try { pend = JSON.parse(localStorage.getItem('vs-md-pending') || 'null'); } catch (e) {}
      if (!pend && session.user && session.user.user_metadata && session.user.user_metadata.vs_profile && !session.user.user_metadata.vs_applied) pend = session.user.user_metadata.vs_profile;
      var first = pend ? V.db.rpc('save_my_profile', { p: pend }).then(function (r) {
        if (!r.error) { try { localStorage.removeItem('vs-md-pending'); } catch (e) {} S.justJoined = true; V.db.auth.updateUser({ data: { vs_applied: true } }).catch(function () {}); }
      }) : Promise.resolve();
      first.then(function () { return Promise.all([
        V.db.from('buildings').select('id, code, name, location, road, landmark, floors, total_units, lat, lng, status, visit_date, visit_time, details').order('name'),
        V.db.from('units').select('id, label, type, rent, status, vacant_since, listing_id, building_id, paused, added_by_manager, floor, deposit, furnished, available_from').order('label'),
        V.db.rpc('my_viewings_v2'),
        V.db.rpc('my_profile'),
        V.db.rpc('my_short_stays').then(function (r) { return { data: r.error ? [] : (r.data || []) }; })
      ]); }).then(function (res) {
        var bad2 = res.filter(function (x) { return x.error; })[0];
        if (bad2) throw bad2.error;
        var prof = res[3].data || {}; if (!prof.email) prof.email = session.user && session.user.email;
        S.shorts = res[4].data || [];
        showDash({ buildings: res[0].data, units: res[1].data, viewings: res[2].data, profile: prof });
      }).catch(function (e) {
        console.error(e);
        document.body.classList.add('md-on');
        V.$('#dash').classList.remove('hidden');
        V.$('#md-view').innerHTML = '<div class="md-card"><h2>' + esc(T('Could not load your dashboard')) + '</h2><p class="dim">' + esc(T('Please refresh. If it keeps happening, WhatsApp us.')) + '</p></div>';
      });
    });
  }
  start();
});
