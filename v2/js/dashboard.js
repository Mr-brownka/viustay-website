// Manager dashboard: Supabase email/password login + read-only view of the
// manager's buildings, units, viewings (no tenant contacts) and placement fees.
document.addEventListener('DOMContentLoaded', function () {
  var V = window.V;
  var params = new URLSearchParams(window.location.search);
  var mode = params.get('signup') ? 'signup' : 'login';
  var authForm = V.$('#auth-form'), err = V.$('#auth-error'), info = V.$('#auth-info');
  if (params.get('email')) authForm.email.value = params.get('email');

  function msg(el, text) { el.textContent = text || ''; el.classList.toggle('hidden', !text); }
  function setMode(m) {
    mode = m;
    V.$('#auth-title').textContent = m === 'signup' ? 'Create your login' : 'Manager log in';
    V.$('#auth-submit').textContent = m === 'signup' ? 'Create login' : 'Log in';
    V.$('#toggle-mode').textContent = m === 'signup' ? 'Already have a login? Log in' : 'New here? Create a login';
    authForm.password.setAttribute('autocomplete', m === 'signup' ? 'new-password' : 'current-password');
    msg(err); msg(info);
  }
  setMode(mode);
  V.$('#toggle-mode').addEventListener('click', function () { setMode(mode === 'signup' ? 'login' : 'signup'); });

  // ---------- Demo mode: show sample data so the page can be previewed ----------
  if (V.demo) {
    V.$('#auth').classList.add('hidden');
    showDash({
      buildings: [{ name: 'Sunrise Apartments (sample)', location: 'Kilimani' }],
      units: [
        { label: 'A1', type: '1 bedroom', rent: 38000, status: 'vacant', vacant_since: daysAgo(9), listing_id: 'VS-001' },
        { label: 'B3', type: '1 bedroom', rent: 38000, status: 'vacant', vacant_since: daysAgo(4), listing_id: 'VS-003' },
        { label: 'C2', type: '2 bedrooms', rent: 55000, status: 'vacant', vacant_since: daysAgo(21), listing_id: 'VS-007' },
        { label: 'A4', type: '1 bedroom', rent: 38000, status: 'let', vacant_since: null, listing_id: null }
      ],
      viewings: [
        { viewing_date: daysAhead(1), viewing_time: '10:30 AM', listing_title: '1 bedroom, Argwings Kodhek Rd', listing_id: 'VS-001', status: 'confirmed' },
        { viewing_date: daysAhead(1), viewing_time: '12:00 PM', listing_title: '1 bedroom, Lenana Rd', listing_id: 'VS-003', status: 'confirmed' },
        { viewing_date: daysAhead(3), viewing_time: '2:00 PM', listing_title: '1 bedroom, Argwings Kodhek Rd', listing_id: 'VS-001', status: 'new' }
      ],
      placements: [
        { unit_label: 'A4', lease_signed: daysAgo(2), move_in: daysAhead(20), fee_amount: null, status: 'due' },
        { unit_label: 'B1', lease_signed: daysAgo(16), move_in: daysAgo(8), fee_amount: null, status: 'paid' }
      ]
    });
    return;
  }

  // ---------- Live mode ----------
  V.$('#forgot').addEventListener('click', function () {
    var email = authForm.email.value.trim();
    if (!email) { msg(err, 'Type your email first, then tap "Forgot password?".'); return; }
    V.db.auth.resetPasswordForEmail(email, { redirectTo: window.location.href.split('?')[0] + '?reset=1' })
      .then(function (r) { if (r.error) throw r.error; msg(err); msg(info, 'Check your email for a reset link.'); })
      .catch(function (e) { msg(err, e.message || 'Could not send the reset email.'); });
  });

  authForm.addEventListener('submit', function (e) {
    e.preventDefault();
    msg(err); msg(info);
    var email = authForm.email.value.trim().toLowerCase(), pw = authForm.password.value;
    if (!email || pw.length < 8) { msg(err, 'Enter your email and a password of at least 8 characters.'); return; }
    var btn = V.$('#auth-submit'); btn.disabled = true;
    var p;
    if (params.get('reset') && mode === 'login') p = V.db.auth.updateUser({ password: pw });
    else if (mode === 'signup') p = V.db.auth.signUp({ email: email, password: pw, options: { emailRedirectTo: window.location.href.split('?')[0] } });
    else p = V.db.auth.signInWithPassword({ email: email, password: pw });
    p.then(function (r) {
      btn.disabled = false;
      if (r.error) throw r.error;
      if (mode === 'signup' && !r.data.session) { msg(info, 'Almost done: check your email and tap the link to confirm, then log in.'); setTimeout(function () { setMode('login'); msg(info, 'Check your email and tap the link to confirm, then log in here.'); }, 50); return; }
      start();
    }).catch(function (e2) {
      btn.disabled = false;
      msg(err, /invalid login/i.test(e2.message || '') ? 'Wrong email or password.' : (e2.message || 'Something went wrong.'));
    });
  });

  V.$('#logout').addEventListener('click', function () { V.db.auth.signOut().then(function () { window.location.href = 'owners.html'; }); });

  function start() {
    V.db.auth.getSession().then(function (r) {
      var session = r.data && r.data.session;
      if (!session || params.get('reset')) {
        V.$('#auth').classList.remove('hidden'); V.$('#dash').classList.add('hidden');
        if (params.get('reset') && session) { V.$('#auth-title').textContent = 'Set a new password'; V.$('#auth-submit').textContent = 'Save password'; }
        return;
      }
      V.$('#auth').classList.add('hidden');
      Promise.all([
        V.db.from('buildings').select('id, code, name, location'),
        V.db.from('units').select('label, type, rent, status, vacant_since, listing_id, building_id').order('label'),
        V.db.rpc('my_viewings'),
        V.db.from('placements').select('unit_label, lease_signed, move_in, fee_amount, status').order('lease_signed', { ascending: false })
      ]).then(function (res) {
        var bad = res.filter(function (x) { return x.error; })[0];
        if (bad) throw bad.error;
        showDash({ buildings: res[0].data, units: res[1].data, viewings: res[2].data, placements: res[3].data });
      }).catch(function (e) {
        console.error(e);
        V.$('#dash').classList.remove('hidden');
        V.$('#empty-state').classList.remove('hidden');
        V.$('#empty-state').innerHTML = '<h2 style="font-size:20px">Could not load your dashboard</h2><p style="margin:6px 0 0">Please refresh. If it keeps happening, WhatsApp us.</p>';
      });
    });
  }
  start();

  // ---------- Rendering (shared by demo and live) ----------
  function daysAgo(n) { var d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
  function daysAhead(n) { var d = new Date(); d.setDate(d.getDate() + n); if (d.getDay() === 0) d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }
  function since(iso) { if (!iso) return '–'; return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 864e5)); }
  function fmtDate(iso) { return iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '–'; }
  function pill(text, ok) { return '<span class="status' + (ok ? ' ok' : '') + '">' + V.esc(text) + '</span>'; }

  function showDash(data) {
    V.$('#dash').classList.remove('hidden');
    var b = data.buildings || [], units = data.units || [], views = data.viewings || [], fees = data.placements || [];
    V.$('#dash-building').textContent = b.map(function (x) { return x.name + (x.location ? ' · ' + x.location : ''); }).join(' | ');
    if (!b.length) { V.$('#empty-state').classList.remove('hidden'); }
    var today = new Date().toISOString().slice(0, 10);
    var upcoming = views.filter(function (v) { return v.viewing_date >= today; }).sort(function (a, c) { return a.viewing_date < c.viewing_date ? -1 : 1; });
    var vacant = units.filter(function (u) { return u.status === 'vacant'; });
    var filled = fees.length;
    var lead = units.filter(function (u) { return u.status === 'vacant' && u.vacant_since; });
    var avg = vacant.length ? Math.round(vacant.reduce(function (s, u) { return s + (Number(since(u.vacant_since)) || 0); }, 0) / vacant.length) : 0;

    V.$('#stats').innerHTML =
      '<div class="stat"><small>Vacant units</small><b>' + vacant.length + '</b></div>' +
      '<div class="stat"><small>Upcoming viewings</small><b>' + upcoming.length + '</b></div>' +
      '<div class="stat"><small>Tenants placed</small><b>' + filled + '</b></div>' +
      '<div class="stat"><small>Avg. days vacant</small><b>' + avg + '</b></div>';
    V.$('#upcoming').innerHTML = upcoming.slice(0, 5).map(function (v) {
      return '<div class="row-between" style="padding:10px 0;border-bottom:1px solid #EEE9E0"><span><strong>' + fmtDate(v.viewing_date) + ', ' + V.esc(v.viewing_time) + '</strong> · ' + V.esc(v.listing_title || v.listing_id) + '</span></div>';
    }).join('') || '<p class="note">No viewings booked yet.</p>';
    V.$('#longest').innerHTML = lead.sort(function (a, c) { return since(c.vacant_since) - since(a.vacant_since); }).slice(0, 5).map(function (u) {
      return '<div class="row-between" style="padding:10px 0;border-bottom:1px solid #EEE9E0"><span><strong>' + V.esc(u.label) + '</strong> · ' + V.esc(u.type) + '</span><span>' + since(u.vacant_since) + ' days</span></div>';
    }).join('') || '<p class="note">No vacant units.</p>';

    V.$('#units-body').innerHTML = units.map(function (u) {
      var n = views.filter(function (v) { return u.listing_id && v.listing_id === u.listing_id && v.viewing_date >= today; }).length;
      return '<tr><td><strong>' + V.esc(u.label) + '</strong></td><td>' + V.esc(u.type) + '</td><td>' + V.money(u.rent) + '</td><td>' +
        pill(u.status === 'vacant' ? 'Vacant' : 'Let', u.status !== 'vacant') + '</td><td>' + (u.status === 'vacant' ? since(u.vacant_since) : '–') + '</td><td>' + (u.status === 'vacant' ? n + ' booked' : '–') + '</td></tr>';
    }).join('') || '<tr><td colspan="6" class="note">No units yet.</td></tr>';
    V.$('#viewings-body').innerHTML = views.slice().sort(function (a, c) { return a.viewing_date < c.viewing_date ? 1 : -1; }).map(function (v) {
      return '<tr><td>' + fmtDate(v.viewing_date) + '</td><td>' + V.esc(v.viewing_time) + '</td><td>' + V.esc(v.listing_title || v.listing_id) + '</td><td>' +
        pill(v.status === 'confirmed' ? 'Confirmed' : v.status === 'done' ? 'Done' : 'Being arranged', v.status === 'confirmed' || v.status === 'done') + '</td></tr>';
    }).join('') || '<tr><td colspan="4" class="note">No viewings yet.</td></tr>';
    V.$('#fees-body').innerHTML = fees.map(function (f) {
      return '<tr><td><strong>' + V.esc(f.unit_label) + '</strong></td><td>' + fmtDate(f.lease_signed) + '</td><td>' + fmtDate(f.move_in) + '</td><td>' +
        (f.fee_amount ? V.money(f.fee_amount) : V.esc(V.cfg.PLACEMENT_FEE_TEXT)) + '</td><td>' + pill(f.status === 'paid' ? 'Paid' : 'Due on move-in', f.status === 'paid') + '</td></tr>';
    }).join('') || '<tr><td colspan="5" class="note">No placements yet.</td></tr>';

    V.$$('.dash-nav [data-tab]').forEach(function (t) {
      t.addEventListener('click', function () {
        var name = t.getAttribute('data-tab');
        V.$$('.dash-nav [data-tab]').forEach(function (x) { x.setAttribute('aria-pressed', x === t ? 'true' : 'false'); });
        V.$$('[data-panel]').forEach(function (p) { p.classList.toggle('hidden', p.getAttribute('data-panel') !== name); });
        V.$('#dash-title').textContent = t.textContent;
      });
    });
  }
});
