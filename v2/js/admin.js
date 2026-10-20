// Admin page: Viustay team sees and updates every lead.
document.addEventListener('DOMContentLoaded', function () {
  var V = window.V;
  var TABS = {
    hosts:      { title: 'Short-stay hosts', table: 'short_stay_submissions', statuses: ['new', 'visit booked', 'listed', 'declined'], closed: ['listed', 'declined'] },
    requests:   { title: 'Home requests', table: 'home_requests',        statuses: ['new', 'contacted', 'placed', 'closed'],  closed: ['placed', 'closed'] },
    properties: { title: 'Older property forms',    table: 'property_submissions', statuses: ['new', 'visit booked', 'listed', 'declined'], closed: ['listed', 'declined'] },
    messages:   { title: 'Messages',      table: 'contact_messages',     statuses: ['new', 'replied', 'closed'],             closed: ['replied', 'closed'] }
  };
  var current = 'requests', data = {};
  window.VAdmin = { data: data, tabs: TABS, reload: function () { return loadAll(); }, render: function () { render(); }, onLoad: [] };

  function show(id) { ['#a-auth', '#a-denied', '#a-dash'].forEach(function (s) { V.$(s).classList.toggle('hidden', s !== id); }); }
  function err(el, t) { el.textContent = t || ''; el.classList.toggle('hidden', !t); }
  function intl(phone) {
    var d = String(phone || '').replace(/[^0-9]/g, '');
    if (d.indexOf('0') === 0) d = '254' + d.slice(1);
    if (d.length === 9) d = '254' + d;
    return d;
  }
  function waLink(phone, text) { return 'https://wa.me/' + intl(phone) + '?text=' + encodeURIComponent(text); }
  function when(ts) { return ts ? new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''; }
  function day(d) { return d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '–'; }
  function searchText(s) {
    if (!s) return '';
    var p = [];
    if (s.area) p.push(s.area);
    if (s.bedrooms !== undefined && s.bedrooms !== '') p.push(['Bedsitter/studio', '1 bed', '2 bed', '3+ bed'][Number(s.bedrooms)] || '');
    if (s.min || s.max) p.push('KES ' + (s.min ? V.money(s.min) : '0') + '–' + (s.max ? V.money(s.max) : 'any'));
    if (s.must && s.must.length) p.push(s.must.join(', '));
    return p.join(' · ');
  }

  if (V.demo) { show('#a-auth'); err(V.$('#a-error'), 'The database is not connected (demo mode).'); return; }

  // ---------- Auth ----------
  V.$('#a-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    V.db.auth.signInWithPassword({ email: f.email.value.trim().toLowerCase(), password: f.password.value })
      .then(function (r) { if (r.error) throw r.error; start(); })
      .catch(function (e2) { err(V.$('#a-error'), /invalid login/i.test(e2.message || '') ? 'Wrong email or password.' : e2.message); });
  });
  function logout() { V.db.auth.signOut().then(function () { location.reload(); }); }
  V.$('#a-out').addEventListener('click', logout);
  V.$('#ad-email').textContent = '';
  V.$('#a-out2').addEventListener('click', logout);

  function start() {
    V.db.auth.getSession().then(function (r) {
      if (!r.data || !r.data.session) { show('#a-auth'); return; }
      V.db.rpc('is_admin').then(function (res) {
        if (res.error || !res.data) { show('#a-denied'); return; }
        show('#a-dash');
        var em = (r.data.session.user && r.data.session.user.email) || '';
        V.$('#ad-email').textContent = em; V.$('#ad-av').textContent = em.slice(0, 2).toUpperCase();
        loadAll();
        if (window.VAdminShell) window.VAdminShell.start();
      });
    });
  }

  // ---------- Data ----------
  function loadAll() {
    err(V.$('#a-load-error'));
    if (!data.requests) V.$('#a-list').innerHTML = V.skel.rows(4);
    var keys = Object.keys(TABS);
    return Promise.all(keys.map(function (k) {
      return V.db.from(TABS[k].table).select('*').order('created_at', { ascending: false }).limit(300);
    })).then(function (res) {
      var missing = [];
      res.forEach(function (r, i) { if (r.error) { missing.push(keys[i]); data[keys[i]] = null; } else data[keys[i]] = r.data || []; });
      if (missing.indexOf('requests') >= 0) throw new Error('requests');
      renderTabs(); if (TABS[current]) render();
      window.VAdmin.onLoad.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
    }).catch(function (e) { console.error(e); err(V.$('#a-load-error'), 'Could not load leads. Did you run supabase/add-admin.sql?'); });
  }

  function renderTabs() {
    V.$$('#ad-sub [data-tab]').forEach(function (t) {
      var k = t.getAttribute('data-tab');
      t.setAttribute('aria-pressed', k === current ? 'true' : 'false');
      if (!TABS[k]) return;
      var fresh = (data[k] || []).filter(function (x) { return x.status === 'new'; });
      var n = fresh.length;
      t.textContent = TABS[k].title + (n ? ' (' + n + ' new)' : '');
      t.setAttribute('aria-pressed', k === current ? 'true' : 'false');
    });
  }

  function statusSelect(k, ids, value) {
    var opts = TABS[k].statuses.map(function (s) { return '<option' + (s === value ? ' selected' : '') + '>' + s + '</option>'; }).join('');
    return '<select class="a-status" data-ids="' + ids.join(',') + '" aria-label="Status" style="font:inherit;padding:8px 10px;border-radius:8px;border:1px solid #D3DBE6;background:#fff">' + opts + '</select>';
  }

  function card(inner, isNew) {
    return '<article class="box" style="display:flex;flex-direction:column;gap:8px;border-left:0;' + (isNew ? 'box-shadow:inset 4px 0 0 #1554D1' : '') + '">' + inner + '</article>';
  }

  function render() {
    if (!TABS[current]) return;
    var k = current, rows = data[k] || [], hide = V.$('#a-open').checked, html = '';
    if (data[k] === null) { V.$('#a-title').textContent = TABS[k].title; V.$('#a-list').innerHTML = '<p class="t-warn">Run <strong>supabase/add-short-stay-hosts.sql</strong> in Supabase to turn this on, then tap Refresh.</p>'; return; }
    V.$('#a-title').textContent = TABS[k].title;
    var keep = function (s) { return !hide || TABS[k].closed.indexOf(s) < 0; };

    if (k === 'viewings') {
      var groups = {}, order = [];
      rows.forEach(function (r) { if (!groups[r.booking_ref]) { groups[r.booking_ref] = []; order.push(r.booking_ref); } groups[r.booking_ref].push(r); });
      order.forEach(function (ref) {
        var g = groups[ref], f = g[0];
        if (!keep(f.status)) return;
        var homes = g.map(function (r) { return V.esc(r.listing_title || r.listing_id) + ' (' + V.esc(r.listing_id) + (r.rent ? ', KES ' + V.money(r.rent) : '') + ')'; }).join('<br>');
        var msg = 'Hi ' + f.tenant_name + ', this is Viustay about your viewing ' + ref + ' on ' + day(f.viewing_date) + ' at ' + f.viewing_time + '.';
        html += card(
          '<div class="row-between" style="flex-wrap:wrap"><strong style="font-size:18px">' + V.esc(f.tenant_name) + ' · ' + V.esc(f.tenant_phone) + '</strong>' + statusSelect(k, g.map(function (r) { return r.id; }), f.status) + '</div>' +
          '<span><strong>' + day(f.viewing_date) + ', ' + V.esc(f.viewing_time) + '</strong> · ' + V.esc(ref) + ' · booked ' + when(f.created_at) + '</span>' +
          '<span style="color:var(--muted)">' + homes + '</span>' +
          (searchText(f.search) ? '<span class="note">Looking for: ' + V.esc(searchText(f.search)) + '</span>' : '') +
          '<div><a class="btn btn-dark" style="font-size:15px;padding:8px 14px;min-height:40px" target="_blank" rel="noopener" href="' + waLink(f.tenant_phone, msg) + '">WhatsApp ' + V.esc(f.tenant_name.split(' ')[0]) + '</a></div>', f.status === 'new');
      });
    } else {
      rows.forEach(function (r) {
        if (!keep(r.status)) return;
        var name = r.name || r.contact_name, phone = r.phone || r.contact_phone, body = '';
        if (k === 'requests') body = '<span>' + V.esc(searchText(r.search) || 'No search details') + '</span>' + (r.details ? '<span style="color:var(--muted)">' + V.esc(r.details) + '</span>' : '');
        if (k === 'properties') body = '<span><strong>' + V.esc(r.building_name) + '</strong> · ' + V.esc(r.location) + ' · ' + V.esc(r.role) + '</span>' +
          '<span style="color:var(--muted)">' + (r.units || []).map(function (u) { return u.count + ' × ' + V.esc(u.type) + (u.rent ? ' @ KES ' + V.money(u.rent) : ''); }).join(' · ') + '</span>' +
          '<span class="note">Visit: ' + day(r.visit_date) + (r.contact_email ? ' · ' + V.esc(r.contact_email) : '') + '</span>';
        if (k === 'hosts') body = window.VHostsAdmin ? window.VHostsAdmin.body(r) : '';
        if (k === 'messages') body = '<span class="note">' + V.esc(r.kind || '') + '</span><span>' + V.esc(r.message) + '</span>';
        html += card(
          '<div class="row-between" style="flex-wrap:wrap"><strong style="font-size:18px">' + V.esc(name) + ' · ' + V.esc(phone) + '</strong>' + statusSelect(k, [r.id], r.status) + '</div>' +
          '<span class="note">' + when(r.created_at) + '</span>' + body +
          '<div><a class="btn btn-dark" style="font-size:15px;padding:8px 14px;min-height:40px" target="_blank" rel="noopener" href="' + waLink(phone, 'Hi ' + name + ', this is Viustay.') + '">WhatsApp ' + V.esc(String(name).split(' ')[0]) + '</a></div>', r.status === 'new');
      });
    }
    V.$('#a-list').innerHTML = html || '<div class="box"><p class="note" style="margin:0">Nothing here' + (hide ? ' (finished items hidden)' : '') + '.</p></div>';

    if (k === 'hosts' && window.VHostsAdmin) window.VHostsAdmin.bind(V.$('#a-list'), rows);
    V.$$('.a-status').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var ids = sel.getAttribute('data-ids').split(',').map(Number), val = sel.value;
        sel.disabled = true;
        V.db.from(TABS[k].table).update({ status: val }).in('id', ids).then(function (r) {
          sel.disabled = false;
          if (r.error) { alert('Could not save: ' + r.error.message); return; }
          (data[k] || []).forEach(function (row) { if (ids.indexOf(row.id) >= 0) row.status = val; });
          renderTabs(); render();
        });
      });
    });
  }

  V.$$('#ad-sub [data-tab]').forEach(function (t) { t.addEventListener('click', function () {
    current = t.getAttribute('data-tab');
    var survey = current === 'survey', trips = ['trips', 'stays', 'agents', 'fares'].indexOf(current) >= 0, blds = current === 'buildings';
    if (window.VAdminShell) window.VAdminShell.sub(current);
    V.$('#a-main').classList.toggle('hidden', survey || trips || blds);
    V.$('#b-main').classList.toggle('hidden', !blds);
    V.$('#s-main').classList.toggle('hidden', !survey);
    V.$('#t-main').classList.toggle('hidden', !trips);
    try { localStorage.setItem('vs-admin-tab', current); } catch (e) {}
    renderTabs();
    if (survey) window.VSurvey.open(); else if (blds) window.VBuildingsAdmin.open(); else if (trips) window.VTripsAdmin.open(current); else render();
  }); });
  V.$('#a-open').addEventListener('change', render);
  V.$('#a-refresh').addEventListener('click', loadAll);
  start();
});
