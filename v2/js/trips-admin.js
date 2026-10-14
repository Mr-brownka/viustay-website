// Admin: viewing trips (payments, agents, problems), agents and their pay, fare settings.
(function () {
  var V = window.V, $ = V.$;
  var A = {}; window.VTripsAdmin = A;
  var data = { trips: [], agents: [], vouchers: [], stays: [] }, S = null, section = 'trips', filter = 'action', loaded = false;
  var main = function () { return $('#t-main'); };

  function kes(n) { return 'KES ' + V.money(n); }
  function dayFmt(iso) { return iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '–'; }
  function when(ts) { return ts ? new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''; }
  function intl(p) { var d = String(p || '').replace(/[^0-9]/g, ''); if (d.indexOf('0') === 0) d = '254' + d.slice(1); if (d.length === 9) d = '254' + d; return d; }
  function wa(p, text) { return 'https://wa.me/' + intl(p) + '?text=' + encodeURIComponent(text); }
  function agent(id) { return data.agents.filter(function (a) { return a.id === id; })[0]; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function siteUrl() { return location.href.replace(/admin\.html.*$/, ''); }
  function db() { return V.db; }
  function check(r) { if (r.error) throw r.error; return r; }
  function fail(e) { console.error(e); alert('Could not save: ' + (e.message || e)); }

  function loadAll() {
    main().innerHTML = V.skel.rows(4);
    return Promise.all([
      db().from('trips').select('*').order('trip_date', { ascending: false }).order('created_at', { ascending: false }).limit(400),
      db().from('agents').select('*').order('created_at'),
      db().from('vouchers').select('*').order('created_at', { ascending: false }).limit(1000),
      db().from('app_settings').select('value').eq('key', 'trip').maybeSingle()
    ]).then(function (res) {
      res.forEach(check);
      data.trips = res[0].data || []; data.agents = res[1].data || []; data.vouchers = res[2].data || [];
      S = Object.assign({}, V.Trip.DEFAULTS, (res[3].data && res[3].data.value) || {});
      return db().from('stays').select('*').order('check_in', { ascending: false }).limit(400).then(function (r) {
        data.stays = r.error ? null : (r.data || []);   // null = add-stays.sql not run yet
        loaded = true; render();
      });
    }).catch(function (e) {
      console.error(e);
      main().innerHTML = '<p class="error">Could not load trips. Did you run <strong>supabase/add-agents.sql</strong> in Supabase?</p>';
    });
  }

  A.open = function (sec) { section = sec || section; if (!loaded) loadAll(); else render(); };

  // ---------- shared header ----------
  function head(title, extra) {
    return '<div class="actions" style="justify-content:space-between"><h1 style="font-size:30px">' + title + '</h1><div class="actions" style="gap:10px">' + (extra || '') +
      '<button type="button" class="btn btn-outline" data-t="refresh" style="font-size:15px;padding:10px 16px">Refresh</button></div></div>';
  }

  function render() {
    if (section === 'trips') renderTrips();
    if (section === 'stays') renderStays();
    if (section === 'agents') renderAgents();
    if (section === 'fares') renderSettings();
  }

  // ---------- trips ----------
  function needsAction(t) {
    return t.status === 'paid' || t.status === 'booked' || (t.status === 'confirmed' && (!t.agent_id || t.agent_response !== 'accepted')) || (t.status === 'confirmed' && t.issue);
  }
  var STATUS = { booked: ['warn', 'Booked: check homes'], awaiting_payment: ['warn', 'Waiting for payment'], paid: ['warn', 'Paid: check M-Pesa'], confirmed: ['ok', 'Confirmed'], completed: ['ok', 'Completed'], no_show: ['bad', 'No-show'], cancelled: ['bad', 'Cancelled'], expired: ['bad', 'Expired'] };

  function tripCard(t) {
    var a = agent(t.agent_id), st = STATUS[t.status] || ['', t.status];
    var unpaidOld = t.status === 'awaiting_payment' && (Date.now() - new Date(t.created_at)) > (S.pay_window_min || 30) * 60000;
    if (unpaidOld) st = ['bad', 'Not paid in time'];
    var h = '<article class="t-card" data-trip="' + t.id + '"' + (needsAction(t) ? ' style="box-shadow:inset 4px 0 0 #F2A93B"' : '') + '>' +
      '<div class="row-between" style="flex-wrap:wrap;gap:8px"><strong style="font-size:18px">' + V.esc(t.client_name) + ' · ' + V.esc(t.client_phone) + '</strong><span class="t-badge ' + st[0] + '">' + st[1] + '</span></div>' +
      '<div class="t-kv"><span>Trip</span><strong>' + dayFmt(t.trip_date) + ', ' + V.esc(t.slot) + ' · ' + V.esc(t.booking_ref) + '</strong>' +
      '<span>Pickup</span><span>' + V.esc(t.pickup_area) + (t.pickup_note ? ' · ' + V.esc(t.pickup_note) : '') + (t.pickup_lat ? ' · <a target="_blank" rel="noopener" href="https://www.google.com/maps?q=' + t.pickup_lat + ',' + t.pickup_lng + '">exact pin</a>' : '') + '</span>' +
      '<span>Money</span><span>' + kes(t.total) + ' = ' + kes(t.fare) + ' agent + ' + kes(t.viewing_fee) + ' fee' + (t.mpesa_code ? ' · M-Pesa <strong>' + V.esc(t.mpesa_code) + '</strong> ' + when(t.paid_at) : t.pay_after ? ' · <em>client pays after the trip</em>' : '') + '</span>' +
      (t.changed_at ? '<span>Changed</span><span><span class="t-badge warn">by the client ' + when(t.changed_at) + '</span></span>' : '') +
      '<span>Route</span><span>' + t.distance_km + ' km · ' + V.Trip.mins(t.drive_min) + ' driving + ' + V.Trip.mins(t.wait_min) + ' viewing</span>' +
      (t.pay_after ? '' : '<span>Code</span><span>' + V.esc(t.trip_code) + '</span>') +
      (t.rating ? '<span>Rating</span><span>' + '★★★★★'.slice(0, t.rating) + (t.rating_note ? ' · ' + V.esc(t.rating_note) : '') + '</span>' : '') +
      '</div><ol class="t-homes">' + (t.homes || []).map(function (x) { return '<li>' + V.esc(x.title || x.id) + ' (' + V.esc(x.id) + (x.area ? ', ' + V.esc(x.area) : '') + ')</li>'; }).join('') + '</ol>';

    var act = '';
    if (t.status === 'paid') {
      act += '<p class="t-warn">Find <strong>' + V.esc(t.mpesa_code) + '</strong> for <strong>' + kes(t.total) + '</strong> in your M-Pesa statement, call the buildings to check the homes are still free, then confirm.</p>' +
        '<div class="t-actions"><button class="btn btn-primary" data-t="confirm">Payment checked: confirm trip</button><button class="btn btn-outline" data-t="cancel">Payment not found: cancel</button></div>';
    }
    if (t.status === 'booked') {
      act += '<p class="t-warn">New booking, nothing paid yet (the client pays ' + kes(t.total) + ' after the trip). Call the buildings to check the homes are still free, then confirm.</p>' +
        '<div class="t-actions"><button class="btn btn-primary" data-t="confirm">Homes checked: confirm trip</button></div>';
    }
    if (t.status === 'confirmed') {
      var opts = data.agents.filter(function (x) { return x.active || x.id === t.agent_id; }).map(function (x) { return '<option value="' + x.id + '"' + (x.id === t.agent_id ? ' selected' : '') + '>' + V.esc(x.name) + '</option>'; }).join('');
      var resp = !t.agent_id ? '<span class="t-badge warn">No agent yet</span>' : t.agent_response === 'accepted' ? '<span class="t-badge ok">' + V.esc(a ? a.name : '') + ' accepted</span>' :
        t.agent_response === 'declined' ? '<span class="t-badge bad">' + V.esc(a ? a.name : '') + ' declined: pick another</span>' : '<span class="t-badge warn">Waiting for ' + V.esc(a ? a.name : '') + '</span>';
      act += '<div class="t-inline"><select data-agent aria-label="Agent"><option value="">Choose agent</option>' + opts + '</select><button class="btn btn-outline" data-t="assign" style="font-size:14px;padding:8px 12px;min-height:38px">' + (t.agent_id ? 'Change agent' : 'Assign') + '</button>' + resp + '</div>';
      if (t.issue === 'no_code') act += '<p class="t-warn">' + V.esc(a ? a.name : 'Agent') + ' says the client can\'t find the code. Call ' + V.esc(t.client_name) + ' to confirm the trip happened.</p><div class="t-actions"><button class="btn btn-primary" data-t="complete">Client confirmed: complete trip</button><button class="btn btn-outline" data-t="clear">Clear report</button></div>';
      if (t.issue === 'no_show') act += '<p class="t-warn">' + V.esc(a ? a.name : 'Agent') + ' reports the client didn\'t come (' + when(t.issue_at) + ')' + (t.issue_lat ? ' · <a target="_blank" rel="noopener" href="https://www.google.com/maps?q=' + t.issue_lat + ',' + t.issue_lng + '">where the agent was</a>' : '') + '.</p><div class="t-actions"><button class="btn btn-primary" data-t="noshow">Confirm no-show (' + kes(S.callout_fee) + ' call-out to agent)</button><button class="btn btn-outline" data-t="clear">Not a no-show</button></div>';
      if (t.issue === 'unpaid') act += '<p class="t-warn">' + V.esc(a ? a.name : 'Agent') + ' says ' + V.esc(t.client_name) + ' hasn\'t paid ' + kes(t.total) + ' (' + when(t.issue_at) + '). Call them. When the money is in, enter the M-Pesa code.</p><div class="t-actions"><button class="btn btn-primary" data-t="paidcode">Client paid: enter M-Pesa code</button><button class="btn btn-outline" data-t="clear">Clear report</button></div>';
      if (t.issue === 'other') act += '<p class="t-warn">Agent reported a problem: ' + V.esc(t.issue_note || '') + '</p>';
      if (a && t.agent_response === 'accepted') {
        var msg = 'Hi ' + t.client_name.split(' ')[0] + ', your Viustay viewing trip ' + t.booking_ref + ' is confirmed for ' + dayFmt(t.trip_date) + ' at ' + t.slot + '. Pickup: ' + t.pickup_area + (t.pickup_note ? ' (' + t.pickup_note + ')' : '') +
          '. Your agent: ' + a.name + (a.car ? ', ' + a.car : '') + (a.plate ? ', ' + a.plate : '') + (t.pay_after ? '. Nothing to pay before: at the end of the trip you pay ' + kes(t.total) + ' by M-Pesa' + (S.till ? ' to Till ' + S.till + ' (' + (S.pay_name || 'Viustay') + ')' : '') + '. See your trip: ' : '. Your trip code is ' + t.trip_code + ': give it to the agent at the END of the trip. See your trip: ') + siteUrl() + 'trip.html?ref=' + t.booking_ref;
        act += '<div class="t-actions"><a class="btn btn-dark" target="_blank" rel="noopener" href="' + wa(t.client_phone, msg) + '">Send confirmation to ' + V.esc(t.client_name.split(' ')[0]) + '</a></div>';
      }
    }
    if (t.status === 'completed' && t.agent_id && !data.vouchers.some(function (v) { return v.trip_id === t.id && v.kind === 'placement'; })) {
      act += '<div class="t-actions"><button class="btn btn-outline" data-t="placement">Client signed: add placement bonus</button></div>';
    }
    if (['booked', 'awaiting_payment', 'paid', 'confirmed'].indexOf(t.status) >= 0) {
      act += '<div class="t-actions"><button class="btn btn-outline" data-t="cancel" style="font-size:14px;padding:6px 12px;min-height:34px">Cancel trip</button><a class="btn btn-outline" style="font-size:14px;padding:6px 12px;min-height:34px" target="_blank" rel="noopener" href="' + wa(t.client_phone, 'Hi ' + t.client_name.split(' ')[0] + ', this is Viustay about your viewing trip ' + t.booking_ref + '.') + '">WhatsApp client</a></div>';
    }
    return h + act + '</article>';
  }

  function renderTrips() {
    var active = data.agents.filter(function (a) { return a.active; }).length;
    var lists = {
      action: data.trips.filter(needsAction),
      upcoming: data.trips.filter(function (t) { return ['booked', 'paid', 'confirmed'].indexOf(t.status) >= 0 && t.trip_date >= today(); }).reverse(),
      unpaid: data.trips.filter(function (t) { return t.status === 'awaiting_payment'; }),
      all: data.trips
    };
    var names = { action: 'Needs action', upcoming: 'Upcoming', unpaid: 'Not paid', all: 'All' };
    var html = head('Viewing trips') +
      (active ? '' : '<p class="t-warn">No active agents, so clients can\'t book trips. Add one under <strong>Agents &amp; pay</strong>.</p>') +
      '<div class="t-tabs">' + Object.keys(names).map(function (k) { return '<button type="button" class="chip" data-f="' + k + '" aria-pressed="' + (k === filter) + '">' + names[k] + ' (' + lists[k].length + ')</button>'; }).join('') + '</div>' +
      '<div class="stack-sm" style="gap:14px">' + (lists[filter].map(tripCard).join('') || '<div class="box"><p class="note" style="margin:0">Nothing here.</p></div>') + '</div>';
    main().innerHTML = html;
  }

  function setTrip(t, patch, viewing) {
    return db().from('trips').update(patch).eq('id', t.id).then(check).then(function () {
      Object.assign(t, patch);
      if (viewing) return db().from('viewings').update({ status: viewing }).eq('booking_ref', t.booking_ref);
    });
  }
  function addVoucher(v) {
    return db().from('vouchers').insert(Object.assign({ status: 'approved', approved_at: new Date().toISOString() }, v)).select().single().then(check).then(function (r) { data.vouchers.unshift(r.data); });
  }

  function tripAction(t, act, card) {
    var p = null;
    if (act === 'confirm') p = setTrip(t, { status: 'confirmed' }, 'confirmed');
    if (act === 'cancel') { if (!confirm('Cancel trip ' + t.booking_ref + '? Refund the client yourself if they paid.')) return; p = setTrip(t, { status: 'cancelled' }, 'cancelled'); }
    if (act === 'assign') {
      var id = +card.querySelector('[data-agent]').value;
      if (!id) { alert('Choose an agent first.'); return; }
      p = setTrip(t, { agent_id: id, agent_response: 'pending', code_attempts: 0 });
    }
    if (act === 'complete') p = setTrip(t, { status: 'completed', issue: null }, 'done').then(function () { return addVoucher({ trip_id: t.id, agent_id: t.agent_id, kind: 'trip', amount: t.fare, note: 'Code confirmed by phone' }); });
    if (act === 'noshow') p = setTrip(t, { status: 'no_show' }, 'cancelled').then(function () { return addVoucher({ trip_id: t.id, agent_id: t.agent_id, kind: 'callout', amount: S.callout_fee }); });
    if (act === 'paidcode') {
      var code = (prompt('M-Pesa code for ' + kes(t.total) + ' from ' + t.client_name + ':', '') || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      if (!code) return;
      if (!/^[A-Z0-9]{8,12}$/.test(code)) { alert('That doesn\'t look like an M-Pesa code.'); return; }
      p = setTrip(t, { mpesa_code: code, paid_at: new Date().toISOString(), status: 'completed', issue: null }, 'done').then(function () { return t.agent_id ? addVoucher({ trip_id: t.id, agent_id: t.agent_id, kind: 'trip', amount: t.fare, note: 'Client paid: M-Pesa ' + code }) : null; });
    }
    if (act === 'clear') p = setTrip(t, { issue: null, issue_note: null });
    if (act === 'placement') {
      var fee = V.num(prompt('Placement fee the client paid Viustay (KES)?', ''));
      if (!fee) return;
      var amt = Math.round(fee * (S.placement_bonus_pct || 0) / 100);
      if (!confirm('Add a placement bonus of ' + kes(amt) + ' (' + S.placement_bonus_pct + '% of ' + kes(fee) + ') for ' + (agent(t.agent_id) || {}).name + '?')) return;
      p = addVoucher({ trip_id: t.id, agent_id: t.agent_id, kind: 'placement', amount: amt, note: S.placement_bonus_pct + '% of ' + kes(fee) });
    }
    if (p) p.then(render).catch(fail);
  }


  // ---------- short stays ----------
  var SST = { awaiting_payment: ['warn', 'Waiting for payment'], paid: ['warn', 'Paid: check M-Pesa'], confirmed: ['ok', 'Confirmed'], checked_in: ['ok', 'Checked in'], completed: ['ok', 'Completed'], cancelled: ['bad', 'Cancelled'], expired: ['bad', 'Expired'] };
  var stayFilter = 'action';
  function stayAction(s) { return (s.status === 'awaiting_payment' && s.pay_requested_at && (Date.now() - new Date(s.pay_requested_at)) < 2 * 3600000) || s.status === 'paid' || (s.status === 'confirmed' && !s.checkin_info) || (s.status === 'confirmed' && s.check_in <= today()) || (s.status === 'checked_in' && s.check_out <= today()); }
  function stayCard(s) {
    var st = SST[s.status] || ['', s.status];
    if (s.status === 'awaiting_payment' && (Date.now() - new Date(s.created_at)) > (S.pay_window_min || 30) * 60000) st = ['bad', 'Not paid in time'];
    var first = s.guest_name.split(' ')[0];
    var h = '<article class="t-card" data-stay="' + s.id + '"' + (stayAction(s) ? ' style="box-shadow:inset 4px 0 0 #F2A93B"' : '') + '>' +
      '<div class="row-between" style="flex-wrap:wrap;gap:8px"><strong style="font-size:18px">' + V.esc(s.guest_name) + ' · ' + V.esc(s.guest_phone) + '</strong><span class="t-badge ' + st[0] + '">' + st[1] + '</span></div>' +
      '<div class="t-kv"><span>Stay</span><strong>' + V.esc(s.listing_title || s.listing_id) + ' (' + V.esc(s.listing_id) + ') · ' + V.esc(s.booking_ref) + '</strong>' +
      '<span>Dates</span><span>' + dayFmt(s.check_in) + ' → ' + dayFmt(s.check_out) + ' · ' + s.nights + ' night' + (s.nights === 1 ? '' : 's') + ' · ' + s.guests + ' guest' + (s.guests === 1 ? '' : 's') + '</span>' +
      '<span>Money</span><span>' + kes(s.total) + ' = ' + s.nights + ' × ' + kes(s.night_rate) + (s.cleaning_fee ? ' + ' + kes(s.cleaning_fee) + ' cleaning' : '') + (s.pickup_fee ? ' + ' + kes(s.pickup_fee) + ' pickup' : '') + (s.mpesa_code ? ' · M-Pesa <strong>' + V.esc(s.mpesa_code) + '</strong> ' + when(s.paid_at) : '') + '</span>' +
      (s.pickup ? '<span>Pickup</span><span><strong>Airport / bus pickup booked</strong>' + (s.pickup_note ? ': ' + V.esc(s.pickup_note) : '') + '</span>' : '') +
      (s.rating ? '<span>Rating</span><span>' + '★★★★★'.slice(0, s.rating) + (s.rating_note ? ' · ' + V.esc(s.rating_note) : '') + '</span>' : '') + '</div>';
    if (s.status === 'awaiting_payment' && s.mpesa_phone) h += '<p class="t-warn">M-Pesa request: <strong>' + kes(s.total) + '</strong> from <strong>' + V.esc(s.mpesa_phone) + '</strong> (asked ' + when(s.pay_requested_at) + (s.pay_requests > 1 ? ', ' + s.pay_requests + ' times' : '') + '). Send the request from the till app, or call them. When the money arrives, tap <strong>Payment received</strong>: the guest\'s screen turns to Paid by itself.</p>' +
      '<div class="t-actions"><button class="btn btn-primary" data-s="received">Payment received</button><a class="btn btn-outline" href="tel:' + V.esc(s.mpesa_phone) + '">Call ' + V.esc(s.mpesa_phone) + '</a></div>';
    if (s.status === 'paid') h += '<p class="t-warn">Find <strong>' + V.esc(s.mpesa_code) + '</strong> for <strong>' + kes(s.total) + '</strong> in your M-Pesa statement and confirm the dates with the host, then confirm.</p>' +
      '<div class="t-actions"><button class="btn btn-primary" data-s="confirm">Payment checked: confirm stay</button><button class="btn btn-outline" data-s="cancel">Payment not found: cancel</button></div>';
    if (['confirmed', 'checked_in'].indexOf(s.status) >= 0) {
      h += '<label class="field">Check-in details for the guest (address, directions, caretaker, keys, Wi-Fi)<textarea data-info rows="4" maxlength="1500">' + V.esc(s.checkin_info || '') + '</textarea></label>' +
        '<div class="t-actions"><button class="btn btn-outline" data-s="info">Save check-in details</button>';
      if (s.checkin_info) {
        var msg = 'Hi ' + first + ', welcome to your Viustay stay ' + s.booking_ref + '! Check-in: ' + dayFmt(s.check_in) + ' from ' + (s.check_in_time || '2:00 PM') + '.\n\n' + s.checkin_info + '\n\nWe\'re on WhatsApp for anything you need. Your booking: ' + siteUrl() + 'trip.html?ref=' + s.booking_ref;
        h += '<a class="btn btn-dark" target="_blank" rel="noopener" href="' + wa(s.guest_phone, msg) + '">Send check-in details to ' + V.esc(first) + '</a>';
      }
      h += '</div>';
      if (s.status === 'confirmed') h += '<div class="t-actions"><button class="btn btn-primary" data-s="checkin">Guest has checked in</button></div>';
      if (s.status === 'checked_in') h += '<div class="t-actions"><a class="btn btn-outline" target="_blank" rel="noopener" href="' + wa(s.guest_phone, 'Hi ' + first + ', a reminder that check-out is ' + dayFmt(s.check_out) + ' by ' + (s.check_out_time || '11:00 AM') + '. Thank you for staying with Viustay! We\'d love your rating: ' + siteUrl() + 'trip.html?ref=' + s.booking_ref) + '">Send check-out reminder</a><button class="btn btn-primary" data-s="complete">Stay complete</button></div>';
    }
    if (['awaiting_payment', 'paid', 'confirmed'].indexOf(s.status) >= 0) h += '<div class="t-actions"><button class="btn btn-outline" data-s="cancel" style="font-size:14px;padding:6px 12px;min-height:34px">Cancel stay</button><a class="btn btn-outline" style="font-size:14px;padding:6px 12px;min-height:34px" target="_blank" rel="noopener" href="' + wa(s.guest_phone, 'Hi ' + first + ', this is Viustay about your stay ' + s.booking_ref + '.') + '">WhatsApp guest</a></div>';
    return h + '</article>';
  }
  function renderStays() {
    if (data.stays === null) { main().innerHTML = head('Short stays') + '<p class="t-warn">Run <strong>supabase/add-stays.sql</strong> in Supabase to turn on short-stay bookings, then tap Refresh.</p>'; return; }
    var lists = {
      action: data.stays.filter(stayAction),
      upcoming: data.stays.filter(function (s) { return ['paid', 'confirmed', 'checked_in'].indexOf(s.status) >= 0; }).reverse(),
      unpaid: data.stays.filter(function (s) { return s.status === 'awaiting_payment'; }),
      all: data.stays
    };
    var names = { action: 'Needs action', upcoming: 'Upcoming & in-house', unpaid: 'Not paid', all: 'All' };
    main().innerHTML = head('Short stays') +
      '<div class="t-tabs">' + Object.keys(names).map(function (k) { return '<button type="button" class="chip" data-sf="' + k + '" aria-pressed="' + (k === stayFilter) + '">' + names[k] + ' (' + lists[k].length + ')</button>'; }).join('') + '</div>' +
      '<div class="stack-sm" style="gap:14px">' + (lists[stayFilter].map(stayCard).join('') || '<div class="box"><p class="note" style="margin:0">Nothing here.</p></div>') + '</div>';
  }
  function setStay(s, patch) { return db().from('stays').update(patch).eq('id', s.id).then(check).then(function () { Object.assign(s, patch); render(); }).catch(fail); }
  function stayDo(s, act, card) {
    if (act === 'confirm') setStay(s, { status: 'confirmed' });
    if (act === 'received') {
      var code = prompt('M-Pesa code for ' + kes(s.total) + ' from ' + s.mpesa_phone + ' (optional, e.g. SJK3ABCD12):', '');
      if (code === null) return;
      code = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      setStay(s, { status: 'paid', paid_at: new Date().toISOString(), mpesa_code: code || null });
    }
    if (act === 'cancel') { if (confirm('Cancel stay ' + s.booking_ref + '? Refund the guest yourself if they paid.')) setStay(s, { status: 'cancelled' }); }
    if (act === 'info') setStay(s, { checkin_info: card.querySelector('[data-info]').value.trim() || null });
    if (act === 'checkin') setStay(s, { status: 'checked_in' });
    if (act === 'complete') setStay(s, { status: 'completed' });
  }

  // ---------- agents & pay ----------
  function renderAgents() {
    var html = head('Agents &amp; pay');
    var rows = data.agents.map(function (a) {
      var vs = data.vouchers.filter(function (v) { return v.agent_id === a.id; });
      var sum = function (st) { return vs.filter(function (v) { return v.status === st; }).reduce(function (x, v) { return x + v.amount; }, 0); };
      return { a: a, vs: vs, claimed: sum('claimed'), approved: sum('approved'), held: sum('held'), paid: sum('paid') };
    });
    html += '<p class="t-rule" style="margin:0">Approve claimed vouchers, then pay each agent the approved total by M-Pesa on ' + V.esc(S.payout_day || 'Friday') + ' and tap <strong>Mark paid</strong>.</p>';
    html += '<div class="t-card t-scroll"><table class="t-table"><thead><tr><th>Agent</th><th>To check</th><th>To pay</th><th>On hold</th><th>Paid so far</th><th></th></tr></thead><tbody>' +
      (rows.map(function (r) {
        return '<tr data-agent-row="' + r.a.id + '"><td><strong>' + V.esc(r.a.name) + '</strong>' + (r.a.active ? '' : ' <span class="t-badge bad">inactive</span>') + '<br><span class="note">' + V.esc(r.a.phone) + ' · ' + V.esc(r.a.email || 'no login email') + '</span><br><span class="note">' + V.esc(r.a.car || '') + ' ' + V.esc(r.a.plate || '') + '</span></td>' +
          '<td>' + kes(r.claimed) + (r.claimed ? '<br><button class="btn btn-outline" data-a="approve-all" style="font-size:13px;padding:4px 10px;min-height:30px">Approve all</button>' : '') + '</td>' +
          '<td><strong>' + kes(r.approved) + '</strong>' + (r.approved ? '<br><button class="btn btn-primary" data-a="pay" style="font-size:13px;padding:4px 10px;min-height:30px">Mark paid</button>' : '') + '</td>' +
          '<td>' + kes(r.held) + '</td><td>' + kes(r.paid) + '</td>' +
          '<td><button class="btn btn-outline" data-a="edit" style="font-size:13px;padding:4px 10px;min-height:30px">Edit</button></td></tr>';
      }).join('') || '<tr><td colspan="6" class="note">No agents yet. Add your first agent below.</td></tr>') + '</tbody></table></div>';

    var open = data.vouchers.filter(function (v) { return v.status === 'claimed' || v.status === 'held'; });
    if (open.length) {
      var LBL = { trip: 'Trip', callout: 'Call-out', placement: 'Placement bonus', adjustment: 'Adjustment' };
      html += '<h2 style="font-size:20px;margin:6px 0 0">Vouchers to check</h2><div class="t-card t-scroll"><table class="t-table"><thead><tr><th>Date</th><th>Agent</th><th>What</th><th>Amount</th><th></th></tr></thead><tbody>' +
        open.map(function (v) {
          var t = data.trips.filter(function (x) { return x.id === v.trip_id; })[0];
          return '<tr data-voucher="' + v.id + '"><td>' + when(v.created_at) + '</td><td>' + V.esc((agent(v.agent_id) || {}).name || '') + '</td><td>' + (LBL[v.kind] || v.kind) + (t ? '<br><span class="note">' + V.esc(t.booking_ref) + ' · ' + V.esc(t.client_name) + (t.rating ? ' · ' + '★★★★★'.slice(0, t.rating) : '') + '</span>' : '') + (v.status === 'held' ? ' <span class="t-badge bad">on hold</span>' : '') + '</td>' +
            '<td><strong>' + kes(v.amount) + '</strong></td><td class="t-inline"><button class="btn btn-primary" data-v="approved" style="font-size:13px;padding:4px 10px;min-height:30px">Approve</button>' + (v.status !== 'held' ? '<button class="btn btn-outline" data-v="held" style="font-size:13px;padding:4px 10px;min-height:30px">Hold</button>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }

    html += '<h2 style="font-size:20px;margin:6px 0 0" id="ag-form-title">Add an agent</h2>' +
      '<form class="t-card" id="ag-form" novalidate><input type="hidden" name="agent_id"><div class="t-set">' +
      '<label class="field">Full name<input name="name" required></label><label class="field">Phone (M-Pesa)<input name="phone" type="tel" required></label>' +
      '<label class="field">Login email<input name="email" type="email"></label><label class="field">Car<input name="car" placeholder="Toyota Axio, silver"></label>' +
      '<label class="field">Plate<input name="plate" placeholder="KDA 123A"></label><label class="field">Photo link (optional)<input name="photo_url" type="url"></label>' +
      '<label class="field">Notes<input name="notes" placeholder="Police clearance, PSV insurance…"></label><label class="check" style="align-items:center;align-self:end"><input type="checkbox" name="active" checked> Active (can get trips)</label>' +
      '</div><p class="note" style="margin:0">The agent opens <strong>' + V.esc(siteUrl()) + 'agent.html</strong>, taps "First time? Create your password" and uses this email.</p>' +
      '<div class="t-actions"><button class="btn btn-primary" type="submit">Save agent</button><button class="btn btn-outline hidden" type="button" data-a="new">Add a new agent instead</button></div></form>';
    main().innerHTML = html;
  }

  function agentAction(btn) {
    var row = btn.closest('[data-agent-row]'), a = row && agent(+row.getAttribute('data-agent-row')), act = btn.getAttribute('data-a');
    if (act === 'edit') {
      var f = $('#ag-form'); ['name', 'phone', 'email', 'car', 'plate', 'photo_url', 'notes'].forEach(function (k) { f[k].value = a[k] || ''; }); f.agent_id.value = a.id;
      f.active.checked = a.active; $('#ag-form-title').textContent = 'Edit ' + a.name; f.querySelector('[data-a="new"]').classList.remove('hidden');
      f.scrollIntoView({ behavior: 'smooth' }); return;
    }
    if (act === 'new') { renderAgents(); return; }
    var mine = data.vouchers.filter(function (v) { return v.agent_id === a.id; });
    if (act === 'approve-all') {
      var ids = mine.filter(function (v) { return v.status === 'claimed'; }).map(function (v) { return v.id; });
      db().from('vouchers').update({ status: 'approved', approved_at: new Date().toISOString() }).in('id', ids).then(check).then(function () {
        mine.forEach(function (v) { if (ids.indexOf(v.id) >= 0) v.status = 'approved'; }); render();
      }).catch(fail);
    }
    if (act === 'pay') {
      var due = mine.filter(function (v) { return v.status === 'approved'; });
      var total = due.reduce(function (x, v) { return x + v.amount; }, 0);
      var ref = prompt('You sent ' + kes(total) + ' to ' + a.name + ' (' + a.phone + ')?\nType the M-Pesa transaction code:', '');
      if (!ref) return;
      var now = new Date().toISOString();
      db().from('vouchers').update({ status: 'paid', paid_at: now, payout_ref: ref.trim().toUpperCase() }).in('id', due.map(function (v) { return v.id; })).then(check).then(function () {
        due.forEach(function (v) { v.status = 'paid'; v.paid_at = now; v.payout_ref = ref.trim().toUpperCase(); }); render();
      }).catch(fail);
    }
  }

  function saveAgent(f) {
    var row = { name: f.name.value.trim(), phone: f.phone.value.trim(), email: f.email.value.trim().toLowerCase() || null, car: f.car.value.trim() || null,
      plate: f.plate.value.trim().toUpperCase() || null, photo_url: f.photo_url.value.trim() || null, notes: f.notes.value.trim() || null, active: f.active.checked };
    if (!row.name || !V.phoneOk(row.phone)) { alert('Enter the agent\'s name and phone number.'); return; }
    var id = +f.agent_id.value;
    var q = id ? db().from('agents').update(row).eq('id', id).select().single() : db().from('agents').insert(row).select().single();
    q.then(check).then(function (r) {
      if (id) data.agents = data.agents.map(function (a) { return a.id === id ? r.data : a; }); else data.agents.push(r.data);
      renderAgents();
    }).catch(function (e) { fail(/duplicate/.test(e.message || '') ? { message: 'That email is already used by another agent.' } : e); });
  }

  // ---------- fare settings ----------
  var FIELDS = [
    ['base', 'Base fare (KES)'], ['per_km', 'Per km (KES)'], ['per_min', 'Per minute driving (KES)'], ['wait_per_hour', 'Waiting per hour (KES)'],
    ['view_min', 'Minutes per viewing'], ['min_fare', 'Minimum fare (KES)'], ['round_to', 'Round fare up to (KES)'], ['viewing_fee', 'Viewing fee (KES)'],
    ['road_factor', 'Road factor (× straight line)'], ['speed_kmh', 'Average speed (km/h)'], ['trips_per_agent_day', 'Trips per agent per day'], ['calendar_days', 'How many days ahead clients can book'], ['change_lock_hours', 'Clients can change/cancel up to (hours before)'],
    ['pay_window_min', 'Minutes to pay before slot is freed'], ['callout_fee', 'No-show call-out to agent (KES)'], ['placement_bonus_pct', 'Agent placement bonus (% of fee)'],
    ['airport_pickup_fee', 'Short stays: airport pickup (KES, 0 = off)']
  ];
  function renderSettings() {
    var s = S, DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var html = head('Fare settings') +
      (s.rates_are_placeholders ? '<p class="t-warn">These rates are <strong>placeholders</strong>. Set the real ones with your driver partner, then untick the box at the bottom.</p>' : '') +
      '<form class="stack-sm" id="set-form" novalidate style="gap:16px">' +
      '<div class="t-card"><strong>Fare formula</strong><span class="note">Fare = base + per km × distance + per minute × driving time + waiting per hour × viewing time, then rounded up. The client pays fare + viewing fee. The agent gets the fare.</span><div class="t-set">' +
      FIELDS.map(function (f) { return '<label class="field">' + f[1] + '<input name="' + f[0] + '" type="number" step="any" min="0" value="' + V.esc(s[f[0]]) + '"></label>'; }).join('') +
      '</div><label class="check"><input type="checkbox" name="return_trip"' + (s.return_trip ? ' checked' : '') + '> Agent drives the client back to pickup (adds the return leg)</label>' +
      '<div class="t-rule" id="set-example"></div></div>' +
      '<div class="t-card"><strong>Times and payment</strong><div class="t-set">' +
      '<label class="field">Time slots (comma separated)<input name="slots" value="' + V.esc((s.slots || []).join(', ')) + '"></label>' +
      '<label class="field">Booking cutoff the day before<input name="cutoff" type="time" value="' + V.esc(s.cutoff) + '"></label>' +
      '<label class="field">M-Pesa till number<input name="till" value="' + V.esc(s.till || '') + '" placeholder="e.g. 123456"></label>' +
      '<label class="field">Name on the till<input name="pay_name" value="' + V.esc(s.pay_name || '') + '"></label>' +
      '<label class="field">Agent payout day<input name="payout_day" value="' + V.esc(s.payout_day || '') + '"></label></div>' +
      '<span class="note">Closed days (no trips):</span><div class="t-inline">' + DAYS.map(function (d, i) { return '<label class="check" style="align-items:center"><input type="checkbox" name="closed" value="' + i + '"' + ((s.closed_days || []).indexOf(i) >= 0 ? ' checked' : '') + '> ' + d + '</label>'; }).join('') + '</div></div>' +
      '<div class="t-card"><strong>Pickup estates</strong><span class="note">One per line: name, latitude, longitude. Get the numbers by long-pressing the spot in Google Maps.</span>' +
      '<label class="field"><textarea name="pickups" rows="10" style="font-family:monospace;font-size:14px">' + V.esc((s.pickups || []).map(function (p) { return p.name + ', ' + p.lat + ', ' + p.lng; }).join('\n')) + '</textarea></label></div>' +
      '<label class="check"><input type="checkbox" name="rates_are_placeholders"' + (s.rates_are_placeholders ? ' checked' : '') + '> Rates are still placeholders</label>' +
      '<p class="error hidden" id="set-error" role="alert"></p><p class="t-msg ok hidden" id="set-ok">Saved. New bookings use these settings now.</p>' +
      '<div><button class="btn btn-primary" type="submit">Save settings</button></div></form>';
    main().innerHTML = html;
    example();
  }
  function readSettings(f) {
    var s = Object.assign({}, S), bad = [];
    FIELDS.forEach(function (x) { var n = parseFloat(f[x[0]].value); if (isNaN(n) || n < 0) bad.push(x[1]); else s[x[0]] = n; });
    s.return_trip = f.return_trip.checked;
    s.slots = f.slots.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    s.cutoff = f.cutoff.value || '18:00'; s.till = f.till.value.trim(); s.pay_name = f.pay_name.value.trim(); s.payout_day = f.payout_day.value.trim() || 'Friday';
    s.closed_days = V.$$('input[name="closed"]', f).filter(function (c) { return c.checked; }).map(function (c) { return +c.value; });
    s.pickups = [];
    f.pickups.value.split('\n').forEach(function (line, i) {
      if (!line.trim()) return;
      var p = line.split(',').map(function (x) { return x.trim(); });
      var lat = parseFloat(p[1]), lng = parseFloat(p[2]);
      if (!p[0] || isNaN(lat) || isNaN(lng) || Math.abs(lat) > 5 || lng < 30 || lng > 45) bad.push('Pickup line ' + (i + 1)); else s.pickups.push({ name: p[0], lat: lat, lng: lng });
    });
    if (!s.slots.length) bad.push('Time slots');
    if (!s.pickups.length) bad.push('Pickup estates');
    s.rates_are_placeholders = f.rates_are_placeholders.checked;
    return { s: s, bad: bad };
  }
  function example() {
    var f = $('#set-form'); if (!f) return;
    var r = readSettings(f), s = r.s, el = $('#set-example');
    var from = s.pickups.filter(function (p) { return p.name === 'South B'; })[0] || s.pickups[0];
    if (!from) { el.textContent = ''; return; }
    var homes = [{ area: 'Kilimani' }, { area: 'Lavington' }];
    var q = V.Trip.quote(from, homes, s);
    el.innerHTML = '<strong>Example:</strong> ' + V.esc(from.name) + ' → 1 home in Kilimani + 1 in Lavington' + (s.return_trip ? ' → back' : '') + ': about ' + q.km + ' km, ' + V.Trip.mins(q.drive_min) + ' driving, ' + V.Trip.mins(q.wait_min) + ' viewing. ' +
      'Agent gets <strong>' + kes(q.fare) + '</strong>, client pays <strong>' + kes(q.total) + '</strong>.';
  }
  function saveSettings(f) {
    var r = readSettings(f);
    var e = $('#set-error'); e.classList.add('hidden'); $('#set-ok').classList.add('hidden');
    if (r.bad.length) { e.textContent = 'Check: ' + r.bad.join(', ') + '.'; e.classList.remove('hidden'); return; }
    db().from('app_settings').update({ value: r.s, updated_at: new Date().toISOString() }).eq('key', 'trip').select().then(check).then(function (res) {
      if (!res.data || !res.data.length) throw new Error('Not saved: is this account an admin?');
      S = r.s; $('#set-ok').classList.remove('hidden');
    }).catch(function (x) { e.textContent = x.message; e.classList.remove('hidden'); });
  }

  // ---------- events ----------
  document.addEventListener('click', function (e) {
    var m = main(); if (!m || !m.contains(e.target)) return;
    var b = e.target.closest('button'); if (!b) return;
    if (b.getAttribute('data-t') === 'refresh') { loadAll(); return; }
    if (b.hasAttribute('data-f')) { filter = b.getAttribute('data-f'); renderTrips(); return; }
    if (b.hasAttribute('data-sf')) { stayFilter = b.getAttribute('data-sf'); renderStays(); return; }
    var sc = b.closest('[data-stay]');
    if (sc && b.hasAttribute('data-s')) { var st = data.stays.filter(function (x) { return x.id === +sc.getAttribute('data-stay'); })[0]; stayDo(st, b.getAttribute('data-s'), sc); return; }
    var card = b.closest('[data-trip]');
    if (card && b.hasAttribute('data-t')) {
      var t = data.trips.filter(function (x) { return x.id === +card.getAttribute('data-trip'); })[0];
      b.disabled = true; tripAction(t, b.getAttribute('data-t'), card); setTimeout(function () { b.disabled = false; }, 1500); return;
    }
    if (b.hasAttribute('data-a')) { agentAction(b); return; }
    if (b.hasAttribute('data-v')) {
      var id = +b.closest('[data-voucher]').getAttribute('data-voucher'), st = b.getAttribute('data-v');
      var patch = { status: st }; if (st === 'approved') patch.approved_at = new Date().toISOString();
      db().from('vouchers').update(patch).eq('id', id).then(check).then(function () {
        data.vouchers.forEach(function (v) { if (v.id === id) v.status = st; }); render();
      }).catch(fail);
    }
  });
  document.addEventListener('submit', function (e) {
    if (e.target.getAttribute('id') === 'ag-form') { e.preventDefault(); saveAgent(e.target); }
    if (e.target.getAttribute('id') === 'set-form') { e.preventDefault(); saveSettings(e.target); }
  });
  document.addEventListener('input', function (e) { if (e.target.closest && e.target.closest('#set-form')) example(); });
})();
