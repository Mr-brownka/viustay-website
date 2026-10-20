// Agent page: accept trips, see pickup details, finish a trip with the client's code, flag problems, see pay.
document.addEventListener('DOMContentLoaded', function () {
  var V = window.V, $ = V.$;
  var me = null, trips = [], vouchers = [], view = 'trips', S = V.Trip.DEFAULTS;
  var signup = false;

  function show(id) { ['#g-auth', '#g-denied', '#g-dash'].forEach(function (s) { $(s).classList.toggle('hidden', s !== id); }); }
  function err(el, t) { el.textContent = t || ''; el.classList.toggle('hidden', !t); }
  function kes(n) { return 'KES ' + V.money(n); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function dayFmt(iso) { return iso === today() ? 'Today' : new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); }
  function intl(p) { var d = String(p || '').replace(/[^0-9]/g, ''); if (d.indexOf('0') === 0) d = '254' + d.slice(1); if (d.length === 9) d = '254' + d; return d; }
  function rpc(name, args) { return V.db.rpc(name, args || {}).then(function (r) { if (r.error) throw r.error; return r.data; }); }
  function weekStart() { var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; }

  // ---------- demo data ----------
  function demo() {
    var t = today(), tm = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
    me = { name: 'Hassan Ali' };
    trips = [
      { id: 1, ref: 'VS-7KQ2PA', date: tm, slot: '9:00 AM', status: 'confirmed', response: 'pending', pickup_area: 'South B', pickup_note: 'Gate B, Capital Centre side', homes: [{ title: '1 bedroom, Argwings Kodhek Rd', area: 'Kilimani' }, { title: '2 bedroom, James Gichuru Rd', area: 'Lavington' }], pay: 1600, km: 24.3, drive_min: 66, wait_min: 40, client: 'Halima', attempts_left: 5 },
      { id: 2, ref: 'VS-3MD9TE', date: t, slot: '11:30 AM', status: 'confirmed', response: 'accepted', pickup_area: 'Kilimani', pickup_note: '', homes: [{ title: 'Studio, Yaya area', area: 'Kilimani' }], pay: 700, km: 6.1, drive_min: 17, wait_min: 20, client: 'Brian', phone: '0722000111', attempts_left: 5, pay_after: true, total: 1650, lat: -1.3201, lng: 36.8269 },
      { id: 3, ref: 'VS-9PLX2B', date: '2026-10-09', slot: '2:00 PM', status: 'completed', response: 'accepted', pickup_area: 'Parklands', homes: [{ title: '1 bedroom, Parklands', area: 'Parklands' }], pay: 650, km: 4, drive_min: 11, wait_min: 20, client: 'Fatma', attempts_left: 5 }
    ];
    vouchers = [{ id: 1, created_at: new Date().toISOString(), kind: 'trip', amount: 650, status: 'approved', trip_ref: 'VS-9PLX2B' }];
    show('#g-dash'); render();
  }

  // ---------- auth ----------
  $('#g-switch').addEventListener('click', function (e) {
    e.preventDefault(); signup = !signup;
    $('#g-auth-title').textContent = signup ? 'Create your password' : 'Agent log in';
    $('#g-submit').textContent = signup ? 'Create password' : 'Log in';
    $('#g-switch').textContent = signup ? 'Already have a password? Log in' : 'First time? Create your password';
    err($('#g-error')); $('#g-ok').classList.add('hidden');
  });
  $('#g-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, email = f.email.value.trim().toLowerCase(), pw = f.password.value;
    err($('#g-error')); $('#g-ok').classList.add('hidden');
    if (!email || pw.length < 6) { err($('#g-error'), 'Enter your email and a password of at least 6 characters.'); return; }
    var p = signup ? V.db.auth.signUp({ email: email, password: pw }) : V.db.auth.signInWithPassword({ email: email, password: pw });
    p.then(function (r) {
      if (r.error) throw r.error;
      if (signup && !r.data.session) { var ok = $('#g-ok'); ok.textContent = 'Done. Check your email for a confirmation link, then come back and log in.'; ok.classList.remove('hidden'); return; }
      start();
    }).catch(function (e2) { err($('#g-error'), /invalid login/i.test(e2.message || '') ? 'Wrong email or password.' : e2.message); });
  });
  function logout() { V.db.auth.signOut().then(function () { location.reload(); }); }
  $('#g-out').addEventListener('click', function () { if (V.demo) location.reload(); else logout(); });
  $('#g-out2').addEventListener('click', logout);

  function start() {
    V.db.auth.getSession().then(function (r) {
      if (!r.data || !r.data.session) { show('#g-auth'); return; }
      var email = r.data.session.user.email;
      V.db.from('agents').select('id,name,active').ilike('email', email).maybeSingle().then(function (a) {
        if (a.error || !a.data || !a.data.active) { show('#g-denied'); return; }
        me = a.data; show('#g-dash'); load();
      });
    });
  }

  function load() {
    err($('#g-load-error'));
    if (!trips.length) $('#g-list').innerHTML = V.skel.rows(3);
    Promise.all([rpc('agent_trips'), V.db.from('vouchers').select('*').order('created_at', { ascending: false }).limit(200), V.Trip.loadSettings()])
      .then(function (res) {
        trips = res[0] || [];
        if (res[1].error) throw res[1].error;
        S = res[2];
        var refs = {}; trips.forEach(function (t) { refs[t.id] = t.ref; });
        vouchers = (res[1].data || []).map(function (v) { v.trip_ref = refs[v.trip_id] || ''; return v; });
        render();
      }).catch(function (e) { console.error(e); err($('#g-load-error'), 'Could not load your trips. Check your connection and tap Refresh.'); });
  }
  $('#g-refresh').addEventListener('click', function () { if (V.demo) render(); else load(); });

  // ---------- render ----------
  function summary() {
    var owed = vouchers.filter(function (v) { return v.status === 'claimed' || v.status === 'approved'; }).reduce(function (a, v) { return a + v.amount; }, 0);
    var ws = weekStart();
    var week = trips.filter(function (t) { return t.status === 'completed' && new Date(t.date + 'T00:00:00') >= ws; }).length;
    var paid = vouchers.filter(function (v) { return v.status === 'paid'; }).reduce(function (a, v) { return a + v.amount; }, 0);
    $('#g-hello').textContent = 'Hello ' + String(me.name || '').split(' ')[0];
    $('#g-sum').innerHTML = '<div><b>' + kes(owed) + '</b><span>To be paid ' + V.esc(S.payout_day || 'Friday') + '</span></div>' +
      '<div><b>' + week + '</b><span>Trips done this week</span></div><div><b>' + kes(paid) + '</b><span>Paid to you so far</span></div>';
  }

  function tripCard(t) {
    var homes = '<ol class="t-homes">' + (t.homes || []).map(function (h) { return '<li>' + V.esc(h.title || h.id) + (h.area ? ' · ' + V.esc(h.area) : '') + '</li>'; }).join('') + '</ol>';
    var badge = t.status === 'completed' ? '<span class="t-badge ok">Done · voucher claimed</span>' : t.status === 'no_show' ? '<span class="t-badge bad">Client didn\'t come</span>' :
      t.response === 'pending' ? '<span class="t-badge warn">New: please accept</span>' : t.issue ? (t.issue === 'unpaid' ? '<span class="t-badge warn">Not paid yet · Viustay is following up</span>' : '<span class="t-badge warn">Reported · Viustay is checking</span>') : '<span class="t-badge ok">Accepted</span>';
    var h = '<article class="t-card" data-id="' + t.id + '"><div class="row-between" style="flex-wrap:wrap;gap:8px"><strong style="font-size:18px">' + dayFmt(t.date) + ', ' + V.esc(t.slot) + '</strong>' + badge + '</div>' +
      '<div class="t-kv"><span>Pickup</span><span><strong>' + V.esc(t.pickup_area) + '</strong>' + (t.pickup_note ? ' · ' + V.esc(t.pickup_note) : '') + (t.lat ? '<br><a target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=' + t.lat + ',' + t.lng + '">Open the exact pin in Maps</a>' : '') + '</span>' +
      '<span>Client</span><span>' + V.esc(t.client || '') + (t.phone ? ' · ' + V.esc(t.phone) : '') + '</span>' +
      '<span>Trip</span><span>About ' + t.km + ' km · ' + V.Trip.mins(t.drive_min) + ' driving + ' + V.Trip.mins(t.wait_min) + ' viewing</span>' +
      '<span>Your pay</span><strong>' + kes(t.pay) + '</strong></div>' + homes;
    if (t.status === 'confirmed' && t.response === 'pending') {
      h += '<div class="t-actions"><button class="btn btn-primary" data-act="accept">Accept trip</button><button class="btn btn-outline" data-act="decline">Can\'t do it</button></div>';
    } else if (t.status === 'confirmed' && t.response === 'accepted') {
      if (t.phone) h += '<div class="t-actions"><a class="btn btn-dark" href="tel:+' + intl(t.phone) + '">Call ' + V.esc(t.client) + '</a><a class="btn btn-outline" target="_blank" rel="noopener" href="https://wa.me/' + intl(t.phone) + '?text=' + encodeURIComponent('Hi ' + t.client + ', this is your Viustay agent for today\'s viewing trip.') + '">WhatsApp</a></div>';
      if (t.pay_after && t.date <= today() && !t.issue) {
        h += '<div class="stack-sm" style="border-top:1px solid var(--line);padding-top:12px"><strong style="font-size:15px">End the trip</strong>' +
          '<span class="note">After the last viewing, the client pays <strong>' + kes(t.total) + '</strong> by M-Pesa' + (S.till ? ' to Till <strong>' + V.esc(S.till) + '</strong> (' + V.esc(S.pay_name || 'Viustay') + ')' : '') + '. Type the code from their M-Pesa SMS.</span>' +
          '<div class="t-codebox"><input maxlength="14" autocapitalize="characters" autocomplete="off" placeholder="e.g. SJK3ABCD12" aria-label="Client\'s M-Pesa code" data-code><button class="btn btn-primary" data-act="claim">Release client</button></div><p class="t-msg" data-msg></p>' +
          '<div class="t-actions"><button class="btn btn-outline" data-act="unpaid">Client can\'t pay now</button><button class="btn btn-outline" data-act="no_show">Client didn\'t come</button></div></div>';
      } else if (t.date <= today() && !t.issue) {
        h += '<div class="stack-sm" style="border-top:1px solid var(--line);padding-top:12px"><strong style="font-size:15px">Finish the trip</strong><span class="note">After the last viewing, ask the client for their 4-digit trip code.</span>' +
          '<div class="t-codebox"><input inputmode="numeric" maxlength="4" pattern="[0-9]*" aria-label="Trip code" data-code><button class="btn btn-primary" data-act="claim">Claim voucher</button></div><p class="t-msg" data-msg></p>' +
          '<div class="t-actions"><button class="btn btn-outline" data-act="no_code">Client can\'t find the code</button><button class="btn btn-outline" data-act="no_show">Client didn\'t come</button></div></div>';
      } else if (t.date > today()) {
        h += '<span class="note">' + (t.pay_after ? 'On the day, you end the trip when the client has paid by M-Pesa.' : 'You\'ll finish this trip with the client\'s code on the day.') + '</span>';
      }
    }
    return h + '</article>';
  }

  function render() {
    summary();
    V.$$('[data-g]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-g') === view)); });
    var list = $('#g-list'), html = '';
    if (view === 'trips') {
      var groups = [
        ['New requests', trips.filter(function (t) { return t.status === 'confirmed' && t.response === 'pending'; })],
        ['Today and coming up', trips.filter(function (t) { return t.status === 'confirmed' && t.response === 'accepted'; })],
        ['Done', trips.filter(function (t) { return t.status !== 'confirmed'; }).reverse().slice(0, 15)]
      ];
      groups.forEach(function (g) { if (g[1].length) html += '<h2 style="font-size:18px;margin:6px 0 0">' + g[0] + '</h2>' + g[1].map(tripCard).join(''); });
      list.innerHTML = html || '<div class="t-card"><span>No trips yet. Viustay will send you trips here.</span></div>';
    } else {
      var LBL = { trip: 'Trip', callout: 'Call-out (no-show)', placement: 'Placement bonus', adjustment: 'Adjustment' };
      var BADGE = { claimed: ['warn', 'Claimed'], approved: ['ok', 'Approved'], held: ['bad', 'On hold'], paid: ['ok', 'Paid'] };
      html = '<p class="t-rule" style="margin:0">Vouchers approved by Thursday night are paid on ' + V.esc(S.payout_day || 'Friday') + ' by M-Pesa.</p>';
      html += vouchers.length ? '<div class="t-card t-scroll"><table class="t-table"><thead><tr><th>Date</th><th>What</th><th>Amount</th><th>Status</th></tr></thead><tbody>' +
        vouchers.map(function (v) {
          var b = BADGE[v.status] || ['', v.status];
          return '<tr><td>' + new Date(v.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + '</td><td>' + V.esc(LBL[v.kind] || v.kind) + (v.trip_ref ? '<br><span class="note">' + V.esc(v.trip_ref) + '</span>' : '') + (v.note ? '<br><span class="note">' + V.esc(v.note) + '</span>' : '') + '</td>' +
            '<td><strong>' + kes(v.amount) + '</strong></td><td><span class="t-badge ' + b[0] + '">' + b[1] + '</span>' + (v.payout_ref ? '<br><span class="note">' + V.esc(v.payout_ref) + '</span>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="t-card"><span>No vouchers yet. Finish a trip with the client\'s code to claim one.</span></div>';
      list.innerHTML = html;
    }
  }

  V.$$('[data-g]').forEach(function (b) { b.addEventListener('click', function () { view = b.getAttribute('data-g'); render(); }); });

  // ---------- actions ----------
  $('#g-list').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]'); if (!btn) return;
    var card = btn.closest('[data-id]'), id = +card.getAttribute('data-id'), act = btn.getAttribute('data-act');
    var t = trips.filter(function (x) { return x.id === id; })[0];
    var msg = card.querySelector('[data-msg]');
    function say(cls, text) { if (msg) { msg.className = 't-msg ' + cls; msg.textContent = text; } else alert(text); }

    if (act === 'accept' || act === 'decline') {
      if (act === 'decline' && !confirm('Tell Viustay you can\'t do this trip?')) return;
      btn.disabled = true;
      (V.demo ? Promise.resolve(true) : rpc('agent_respond', { p_trip: id, p_accept: act === 'accept' })).then(function (ok) {
        if (!ok) { alert('This trip changed. Tap Refresh.'); return; }
        if (act === 'decline') trips = trips.filter(function (x) { return x.id !== id; }); else { t.response = 'accepted'; if (V.demo) t.phone = '0722000111'; }
        if (V.demo) render(); else load();
      }).catch(function () { btn.disabled = false; alert('Could not save. Try again.'); });
    }

    if (act === 'claim') {
      var raw = card.querySelector('[data-code]').value || '';
      var code = t.pay_after ? raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase() : raw.replace(/[^0-9]/g, '');
      if (t.pay_after && !/^[A-Z0-9]{8,12}$/.test(code)) { say('bad', 'Type the M-Pesa code from the client\'s SMS, like SJK3ABCD12.'); return; }
      if (!t.pay_after && code.length !== 4) { say('bad', 'Enter the 4-digit code from the client.'); return; }
      btn.disabled = true;
      var p = V.demo ? Promise.resolve(code === '1234' || t.pay_after ? { ok: true, amount: t.pay } : { ok: false, error: 'wrong', left: 4 }) : rpc('claim_trip', { p_trip: id, p_code: code });
      p.then(function (r) {
        btn.disabled = false;
        if (r.ok) {
          t.status = 'completed';
          vouchers.unshift({ created_at: new Date().toISOString(), kind: 'trip', amount: r.amount, status: 'claimed', trip_ref: t.ref });
          render();
          var c = $('[data-id="' + id + '"]'); if (c) c.insertAdjacentHTML('afterbegin', '<p class="t-msg ok"><strong>' + (t.pay_after ? 'Client released. ' : '') + 'Voucher claimed: ' + kes(r.amount) + '.</strong> Thank you!</p>');
          return;
        }
        var E = { wrong: 'That code is wrong. ' + r.left + ' tries left. Ask the client to check their booking message.', locked: 'Too many wrong codes. Tap "Client can\'t find the code" and Viustay will check.',
          too_early: 'You can finish this trip on the day.', bad_mpesa: 'That doesn\'t look like an M-Pesa code. Check the client\'s SMS.', used_mpesa: 'That M-Pesa code was already used for another trip.', not_open: 'This trip is closed. Tap Refresh.', not_yours: 'This trip isn\'t assigned to you.' };
        say('bad', E[r.error] || 'Could not claim. Try again.');
      }).catch(function () { btn.disabled = false; say('bad', 'No connection. Try again.'); });
    }

    if (act === 'no_code' || act === 'no_show' || act === 'unpaid') {
      var q = act === 'unpaid' ? 'Tell Viustay the client hasn\'t paid? We\'ll call them. You still get your pay once they do.' : act === 'no_show' ? 'Report that the client didn\'t come? Do this at the pickup point: your location will be saved with the report.' : 'Report that the client can\'t find the code? Viustay will call them to confirm the trip.';
      if (!confirm(q)) return;
      btn.disabled = true;
      var send = function (lat, lng) {
        (V.demo ? Promise.resolve(true) : rpc('agent_report', { p_trip: id, p_issue: act, p_note: null, p_lat: lat, p_lng: lng })).then(function (ok) {
          if (!ok) { alert('This trip changed. Tap Refresh.'); return; }
          t.issue = act; render();
        }).catch(function () { btn.disabled = false; alert('Could not send. Try again.'); });
      };
      if (act === 'no_show' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function (pos) { send(+pos.coords.latitude.toFixed(6), +pos.coords.longitude.toFixed(6)); }, function () { send(null, null); }, { timeout: 8000 });
      } else send(null, null);
    }
  });

  if (V.demo) { demo(); return; }
  start();
});
