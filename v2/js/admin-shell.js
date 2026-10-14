// Admin (item 23): 5 sections (Today, Bookings, Homes, People, Settings), the Today to-do list and the details drawer.
(function () {
  var V = window.V, $ = V.$;
  var SUBS = { bookings: ['trips', 'stays'], homes: ['buildings', 'hosts', 'properties'], people: ['agents', 'requests', 'messages'], settings: ['fares', 'survey'] };
  var sec = 'today', sel = null, todayData = null;
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function secOf(tab) { for (var k in SUBS) if (SUBS[k].indexOf(tab) >= 0) return k; return null; }
  function mark() {
    V.$$('.ad-sec').forEach(function (b) { b.setAttribute('aria-current', b.getAttribute('data-sec') === sec ? 'page' : 'false'); });
    var sub = $('#ad-sub'); sub.classList.toggle('hidden', sec === 'today' || sec === 'bookings');
    V.$$('#ad-sub [data-sec-of]').forEach(function (b) { b.classList.toggle('hidden', b.getAttribute('data-sec-of') !== sec); });
    $('#today-main').classList.toggle('hidden', sec !== 'today');
  }
  function go(s) {
    sec = s; store('vs-admin-sec', s); mark(); if (dOpen) closeDrawer();
    if (s === 'today') { ['#a-main', '#s-main', '#t-main', '#b-main'].forEach(function (id) { $(id).classList.add('hidden'); }); renderToday(true); window.scrollTo(0, 0); return; }
    var tab = load('vs-admin-sub-' + s); if (SUBS[s].indexOf(tab) < 0) tab = SUBS[s][0];
    var b = $('#ad-sub [data-tab="' + tab + '"]'); if (b) b.click();
    window.scrollTo(0, 0);
  }
  // called when a sub-tab is opened (by admin.js, or by the Viewing trips / Short stays switch)
  function sub(tab, fromSwitch) {
    var s = secOf(tab); if (!s) return;
    sec = s; store('vs-admin-sec', s); store('vs-admin-sub-' + s, tab); mark();
    if (fromSwitch) V.$$('#ad-sub [data-tab]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-tab') === tab)); });
  }

  // ---------- drawer: everything about one booking ----------
  var dOpen = null;
  function drawer(kind, id, html) {
    dOpen = { kind: kind, id: id, html: html };
    var body = html || (window.VTripsAdmin ? window.VTripsAdmin.card(kind, id) : '');
    if (!body) { closeDrawer(); return; }
    $('#ad-dbody').innerHTML = body; $('#ad-drawer').classList.remove('hidden'); document.body.classList.add('ad-noscroll');
    var x = $('#ad-drawer .ad-x'); if (x) x.focus({ preventScroll: true });
  }
  function closeDrawer() { dOpen = null; $('#ad-drawer').classList.add('hidden'); document.body.classList.remove('ad-noscroll'); }
  document.addEventListener('click', function (e) { if (e.target.closest('[data-dclose]')) closeDrawer(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && dOpen) closeDrawer(); });

  // ---------- Today ----------
  function ago(ts) { var m = Math.round((Date.now() - new Date(ts)) / 60000); return m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; }
  function dayFmt(iso) { return iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : ''; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function tripWhy(t, A) {
    var a = A.agent(t.agent_id), n = a ? a.name.split(' ')[0] : 'the agent';
    if (t.status === 'booked') return ['New booking: check the homes are free', 'Confirm'];
    if (t.status === 'paid') return ['Paid: find the M-Pesa code, then confirm', 'Confirm'];
    if (t.issue === 'no_code') return [n + ' says the client can\'t find the code', 'Open'];
    if (t.issue === 'no_show') return [n + ' reports a no-show', 'Open'];
    if (t.issue === 'unpaid') return [n + ' says the client hasn\'t paid', 'Open'];
    if (t.issue) return [n + ' reported a problem', 'Open'];
    if (!t.agent_id) return ['Needs an agent', 'Choose agent'];
    if (t.agent_response === 'declined') return [n + ' declined: pick another agent', 'Choose agent'];
    return [a ? a.name + ' hasn\'t accepted yet' : 'Waiting for the agent', 'Remind agent'];
  }
  function stayWhy(s) {
    if (s.status === 'awaiting_payment') return ['Asked for an M-Pesa request · KES ' + V.money(s.total), 'Payment received'];
    if (s.status === 'paid') return ['Paid: check M-Pesa, then confirm', 'Confirm'];
    if (s.status === 'confirmed' && !s.checkin_info) return ['Add check-in details for the guest', 'Add details'];
    if (s.status === 'confirmed') return ['Arrives ' + dayFmt(s.check_in) + ': mark checked in', 'Checked in'];
    return ['Checks out ' + dayFmt(s.check_out) + ': mark complete', 'Complete'];
  }
  function gather() {
    var A = window.VTripsAdmin, D = (window.VAdmin && window.VAdmin.data) || {};
    return Promise.all([
      A.ready(),
      V.db.from('buildings').select('id,name,area,status,created_at,visit_date').neq('status', 'live').order('created_at', { ascending: true }).then(function (r) { return r.error ? [] : r.data || []; }),
      V.db.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'available').then(function (r) { return r.error ? null : r.count; })
    ]).then(function (res) {
      var d = res[0], items = [], t0 = today(), wk = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
      d.trips.filter(A.needsAction).forEach(function (t) { var w = tripWhy(t, A); items.push({ k: 'trip', id: t.id, tag: 'Trip', at: t.created_at, who: t.client_name + ' · ' + dayFmt(t.trip_date) + ', ' + t.slot, what: w[0], btn: w[1] }); });
      (d.stays || []).filter(A.stayAction).forEach(function (s) { var w = stayWhy(s); items.push({ k: 'stay', id: s.id, tag: 'Short stay', at: s.pay_requested_at || s.created_at, who: s.guest_name + ' · ' + (s.listing_title || s.listing_id), what: w[0], btn: w[1] }); });
      res[1].forEach(function (b) { items.push({ k: 'bld', id: b.id, tag: 'Building', at: b.created_at, who: b.name + (b.area ? ' · ' + b.area : ''), what: b.visit_date ? 'Photo visit ' + dayFmt(b.visit_date) + ' · then publish' : 'Registered by manager · photos needed', btn: 'Publish' }); });
      (D.hosts || []).filter(function (h) { return h.status === 'new'; }).forEach(function (h) { items.push({ k: 'host', id: h.id, tag: 'Short stay', at: h.created_at, who: (h.title || h.unit_label || 'New short stay') + ' · ' + (h.building_name || h.area || ''), what: 'New host listing · book a photo visit', btn: 'Open' }); });
      (D.requests || []).filter(function (r) { return r.status === 'new'; }).forEach(function (r) { items.push({ k: 'req', id: r.id, tag: 'Request', at: r.created_at, who: (r.name || '') + ' · ' + (r.phone || ''), what: 'Looking for a home', btn: 'Call', phone: r.phone }); });
      (D.messages || []).filter(function (m) { return m.status === 'new'; }).forEach(function (m) { items.push({ k: 'msg', id: m.id, tag: 'Message', at: m.created_at, who: (m.name || '') + ' · ' + (m.phone || ''), what: String(m.message || '').slice(0, 80), btn: 'Reply' }); });
      items.sort(function (a, b) { return new Date(a.at) - new Date(b.at); });
      var kpi = {
        todo: items.length,
        trips: d.trips.filter(function (t) { return ['booked', 'paid', 'confirmed'].indexOf(t.status) >= 0 && t.trip_date >= t0 && t.trip_date <= wk; }).length,
        staying: (d.stays || []).filter(function (s) { return s.status === 'checked_in' || (s.status === 'confirmed' && s.check_in <= t0 && s.check_out > t0); }).length,
        live: res[2]
      };
      return { items: items, kpi: kpi };
    });
  }
  var TAGC = { trip: 't-trip', stay: 't-stay', bld: 't-bld', host: 't-stay', req: 't-ppl', msg: 't-ppl' };
  function hello() { var h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
  function renderToday(fetch) {
    var el = $('#today-main');
    if (!todayData || fetch) { if (!todayData) el.innerHTML = '<h1 style="font-size:30px">' + hello() + '</h1>' + V.skel.rows(4); }
    var p = (!todayData || fetch) ? gather().then(function (x) { todayData = x; }) : Promise.resolve();
    return p.then(function () {
      var x = todayData, n = x.items.length;
      var badge = $('#ad-n-today'); badge.textContent = n; badge.classList.toggle('hidden', !n);
      if (sec !== 'today') return;
      if (sel && !x.items.some(function (i) { return i.k + i.id === sel; })) sel = null;
      if (!sel && x.items.length && window.innerWidth >= 1100) { var f = x.items.filter(function (i) { return i.k === 'trip' || i.k === 'stay'; })[0]; if (f) sel = f.k + f.id; }
      var tile = function (l, v, tone) { return '<div class="ad-tile"><span>' + l + '</span><b style="color:' + tone + '">' + (v == null ? '–' : v) + '</b></div>'; };
      var rows = x.items.map(function (i, k) {
        return '<article class="ad-row' + (sel === i.k + i.id ? ' on' : '') + '" data-row="' + i.k + ':' + i.id + '" tabindex="0" style="--d:' + Math.min(k * .05, .5).toFixed(2) + 's"><span class="ad-tag ' + TAGC[i.k] + '">' + i.tag + '</span>' +
          '<span class="ad-rt"><b>' + V.esc(i.who) + '</b><span>' + V.esc(i.what) + ' · ' + ago(i.at) + '</span></span><button type="button" class="' + (k === 0 ? 'sun' : 'btn btn-outline') + ' ad-rb" data-row-go>' + i.btn + '</button></article>';
      }).join('');
      var detail = sel && window.innerWidth >= 1100 ? window.VTripsAdmin.card(sel.indexOf('trip') === 0 ? 'trip' : 'stay', +sel.replace(/^\D+/, '')) : '';
      el.innerHTML = '<div class="actions" style="justify-content:space-between;align-items:flex-end"><div><h1 style="font-size:30px">' + hello() + '</h1><p class="note" style="margin:2px 0 0">' +
        (n ? n + ' thing' + (n === 1 ? '' : 's') + ' need' + (n === 1 ? 's' : '') + ' you. Everything else is on track.' : 'Nothing needs you right now. Everything is on track.') + '</p></div>' +
        '<button type="button" class="btn btn-outline" data-today-refresh style="font-size:15px;padding:10px 16px">Refresh</button></div>' +
        '<div class="ad-tiles">' + tile('To do', x.kpi.todo, '#6B6B6B') + tile('Trips this week', x.kpi.trips, 'var(--emerald)') + tile('Guests staying now', x.kpi.staying, 'var(--emerald)') + tile('Live listings', x.kpi.live, 'var(--emerald)') + '</div>' +
        '<div class="ad-today"><div class="ad-list"><p class="ad-k">To do · oldest first</p>' + (rows || '<div class="ad-done"><b>All done ✓</b><span>New bookings and requests show up here.</span></div>') +
        (rows ? '<p class="note" style="margin:4px 2px 0">Done items drop off this list by themselves.</p>' : '') + '</div>' +
        (detail ? '<aside class="ad-detail">' + detail + '</aside>' : '') + '</div>';
    }).catch(function (e) { console.error(e); el.innerHTML = '<h1 style="font-size:30px">' + hello() + '</h1><p class="error">Could not load. Tap Refresh, or check the SQL files have been run.</p><button type="button" class="btn btn-outline" data-today-refresh>Refresh</button>'; });
  }
  function openItem(k, id, quick) {
    var it = (todayData ? todayData.items : []).filter(function (i) { return i.k === k && i.id === id; })[0];
    if (k === 'trip' || k === 'stay') {
      if (window.innerWidth >= 1100) { sel = k + id; renderToday(false); var d = $('#today-main .ad-detail'); if (d && quick) d.classList.add('ad-pulse'); return; }
      drawer(k, id); return;
    }
    if (k === 'bld') { go('homes'); var b = $('#ad-sub [data-tab="buildings"]'); if (b) { setTimeout(function () { window.VBuildingsAdmin.openBuilding(id); }, 30); } return; }
    if (k === 'host') { store('vs-admin-sub-homes', 'hosts'); go('homes'); return; }
    if (k === 'req') { if (quick && it && it.phone) { location.href = 'tel:' + it.phone; return; } store('vs-admin-sub-people', 'requests'); go('people'); return; }
    if (k === 'msg') { store('vs-admin-sub-people', 'messages'); go('people'); return; }
  }
  document.addEventListener('click', function (e) {
    var tm = $('#today-main'); if (!tm || !tm.contains(e.target)) return;
    if (e.target.closest('[data-today-refresh]')) { if (window.VTripsAdmin) window.VTripsAdmin.reload(); if (window.VAdmin) window.VAdmin.reload(); renderToday(true); return; }
    var row = e.target.closest('[data-row]'); if (!row) return;
    var p = row.getAttribute('data-row').split(':'), k = p[0], id = +p[1];
    // The row button opens the details as a drawer (the action buttons are inside); tapping the row selects it
    openItem(k, id, !!e.target.closest('[data-row-go]'));
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.matches && e.target.matches('.ad-row')) e.target.click(); });
  window.addEventListener('resize', function () { if (sec === 'today' && todayData) renderToday(false); });

  // Changes made anywhere refresh Today and the open drawer
  function onChange() {
    if (dOpen && !dOpen.html) { var h = window.VTripsAdmin.card(dOpen.kind, dOpen.id); if (h) $('#ad-dbody').innerHTML = h; else closeDrawer(); }
    if (todayData) { clearTimeout(onChange.t); onChange.t = setTimeout(function () { renderToday(true); }, 150); }
  }

  V.$$('.ad-sec').forEach(function (b) { b.addEventListener('click', function () { go(b.getAttribute('data-sec')); }); });
  window.VAdminShell = {
    start: function () {
      if (window.VTripsAdmin) window.VTripsAdmin.onChange(onChange);
      if (window.VAdmin) window.VAdmin.onLoad.push(function () { if (todayData) renderToday(true); });
      var s = load('vs-admin-sec'); go(SUBS[s] || s === 'today' ? s : 'today');
    },
    go: go, sub: sub, drawer: drawer, close: closeDrawer
  };
})();
