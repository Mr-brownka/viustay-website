// Short-stay booking (hotel style): dates, guests, one clear total, pay in full by M-Pesa, voucher.
document.addEventListener('DOMContentLoaded', function () {
  var V = window.V, T = V.t, $ = V.$;
  var id = new URLSearchParams(location.search).get('id');
  var L = null, S = V.Trip.DEFAULTS, booked = [], guests = 2, quote = null;
  var STORE = 'vs-stay';
  function store(o) { try { localStorage.setItem(STORE, JSON.stringify(o)); } catch (e) {} }
  function stored() { try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { return null; } }
  function kes(n) { return 'KES ' + V.money(n); }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function addDays(s, n) { var d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); }
  function nightsOf(a, b) { return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5); }
  function showErr(el, t) { el.textContent = t || ''; el.classList.toggle('hidden', !t); }
  function flash(el, text) { if (el.textContent === text) return; el.textContent = text; el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  function rpc(name, args) { return V.ensureDb().then(function (db) { return db.rpc(name, args || {}); }).then(function (r) { if (r.error) throw r.error; return r.data; }); }
  var ERR = {
    dates_taken: 'Sorry, those dates were just booked. Please pick other dates.', min_nights: 'This place has a minimum stay. Please add nights.',
    bad_dates: 'Please check your dates.', too_long: 'For stays over 60 nights, please WhatsApp us.', bad_guests: 'Please check the number of guests.',
    bad_phone: 'Please enter a valid M-Pesa number.', too_many: 'We\'ve sent several requests already. Please WhatsApp us and we\'ll help.', bad_name: 'Please enter your name.',
    bad_mpesa: 'That doesn\'t look like an M-Pesa code. It\'s 10 letters and numbers, like SJK3ABCD12.',
    not_found: 'We couldn\'t find that booking. Please WhatsApp us.', not_open: 'This booking can\'t take a payment any more. Please WhatsApp us.'
  };
  function errText(e) { var m = (e && e.message) || ''; var k = Object.keys(ERR).filter(function (x) { return m.indexOf(x) >= 0; })[0]; return T(k ? ERR[k] : 'Something went wrong. Please try again or WhatsApp us.'); }
  function overlaps(a, b) { return booked.some(function (r) { return r.from < b && r.to > a; }); }

  var f = $('#stay-form');
  function update() {
    var a = f.check_in.value, b = f.check_out.value, hint = $('#s-dates-hint'), n = a && b ? nightsOf(a, b) : 0, bad = '';
    if (a && b && n < 1) bad = T('Check-out must be after check-in.');
    else if (n && n < L.min_nights) bad = T('Minimum stay is {n} nights.', { n: L.min_nights });
    else if (n && overlaps(a, b)) bad = T('Some of these nights are already booked. Please pick other dates.');
    hint.textContent = bad || (booked.length ? T('Already booked: {list}', { list: booked.map(function (r) { return V.date(r.from, { day: 'numeric', month: 'short' }) + '–' + V.date(r.to, { day: 'numeric', month: 'short' }); }).join(', ') }) : '');
    hint.classList.toggle('t-msg', !!bad); hint.classList.toggle('bad', !!bad);
    var pick = f.pickup.checked && S.airport_pickup_fee > 0;
    $('#pickup-note-wrap').classList.toggle('hidden', !pick);
    quote = (n >= 1 && !bad) ? { nights: n, rooms: n * L.night_rate, clean: L.cleaning_fee, pick: pick ? S.airport_pickup_fee : 0 } : null;
    if (quote) quote.total = quote.rooms + quote.clean + quote.pick;
    $('#p-nights').textContent = 'KES ' + V.money(L.night_rate) + ' × ' + T(n === 1 ? '{n} night' : '{n} nights', { n: quote ? n : '–' });
    flash($('#p-rooms'), quote ? kes(quote.rooms) : '–');
    flash($('#p-clean'), L.cleaning_fee ? kes(L.cleaning_fee) : T('Included'));
    $('#p-pick-row').classList.toggle('hidden', !pick); $('#p-pick').textContent = kes(S.airport_pickup_fee || 0);
    flash($('#p-total'), quote ? kes(quote.total) : '–');
    $('#stay-submit').disabled = !quote;
    $('#stay-submit').textContent = quote ? T('Continue to payment') + ' · ' + kes(quote.total) : T('Continue to payment');
  }
  ['check_in', 'check_out'].forEach(function (k) { f[k].addEventListener('change', function () {
    if (k === 'check_in' && f.check_in.value) { var minOut = addDays(f.check_in.value, L.min_nights); f.check_out.min = addDays(f.check_in.value, 1); if (!f.check_out.value || f.check_out.value <= f.check_in.value) f.check_out.value = minOut; }
    update();
  }); });
  f.pickup.addEventListener('change', update);
  function setGuests(n) { guests = Math.max(1, Math.min(L.max_guests, n)); $('#g-n').textContent = guests; $('#g-minus').disabled = guests <= 1; $('#g-plus').disabled = guests >= L.max_guests; }
  $('#g-minus').addEventListener('click', function () { setGuests(guests - 1); });
  $('#g-plus').addEventListener('click', function () { setGuests(guests + 1); });

  // ---------- payment ----------
  // 1) Guest gives their M-Pesa number -> request_stay_payment (later this also sends the real M-Pesa prompt).
  // 2) Waiting screen ("It shows VIUSTAY") checks the booking every few seconds.
  // 3) When the booking turns paid (today: admin taps "Payment received"; later: M-Pesa tells us), the Paid moment plays.
  var timer = null, poll = null, againT = null;
  function mask(n) { var d = String(n || '').replace(/\D/g, ''); if (d.indexOf('254') === 0) d = '0' + d.slice(3); return d.length >= 9 ? d.slice(0, 2) + '•• ••• ' + d.slice(-3) : n; }
  function showPay(t) {
    $('#stay-form-wrap').classList.add('hidden'); $('#stay-done').classList.add('hidden'); $('#pay-wrap').classList.remove('hidden');
    $('#pay-ref').textContent = t.ref;
    $('#pay-h').textContent = T('Pay {x} by M-Pesa', { x: kes(t.total) });
    $('#pay-steps').innerHTML = '<li><span>' + T('Open <strong>M-Pesa</strong> and go to <b>Lipa na M-Pesa → Buy Goods and Services</b>.') + '</span></li>' +
      '<li><span>' + T('Till number:') + ' <strong>' + V.esc(S.till || '[TILL NUMBER]') + '</strong> <span class="note">' + (S.pay_name ? '(' + V.esc(S.pay_name) + ')' : '') + '</span></span></li>' +
      '<li><span>' + T('Amount:') + ' <strong>' + kes(t.total) + '</strong></span></li>' +
      '<li><span>' + T('Enter your PIN. You\'ll get an SMS from M-Pesa with a code like <b>SJK3ABCD12</b>.') + '</span></li>';
    $('#pay-help').href = V.wa('Hi Viustay, I need help paying for my stay ' + t.ref + '.');
    $('#req-form').mpesa_phone.value = t.mpesa_phone || t.phone || '';
    if (t.requested) waiting(t); else asking();
    clearInterval(timer);
    function tick() {
      var left = Math.max(0, Math.round((new Date(t.expires_at) - Date.now()) / 1000));
      $('#pay-timer').innerHTML = left ? T('We\'re holding your dates for <b>{t}</b>.', { t: Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0') }) : T('Your dates are no longer held, but you can still pay: we\'ll keep them if they\'re free.');
      if (!left) clearInterval(timer);
    }
    tick(); timer = setInterval(tick, 1000);
    window.scrollTo(0, 0);
  }
  function asking() { $('#req-form').classList.remove('hidden'); $('#pay-wait').classList.add('hidden'); clearInterval(poll); }
  function waiting(t) {
    $('#req-form').classList.add('hidden'); $('#pay-wait').classList.remove('hidden');
    $('#pw-text').innerHTML = T('We\'ve sent a request for <b>{x}</b> to <b>{n}</b>. It shows <b>VIUSTAY</b>. Enter your M-Pesa PIN to pay.', { x: kes(t.total), n: V.esc(mask(t.mpesa_phone)) });
    var again = $('#pw-again'); again.disabled = true; clearTimeout(againT); againT = setTimeout(function () { again.disabled = false; }, 30000);
    clearInterval(poll); var tries = 0;
    function check() {
      if (V.demo || ++tries > 360) { if (tries > 360) clearInterval(poll); return; }   // stop after ~30 minutes
      rpc('lookup_stay', { p_ref: t.ref, p_phone: t.phone }).then(function (r) {
        if (r && ['paid', 'confirmed', 'checked_in', 'completed'].indexOf(r.status) >= 0) { clearInterval(poll); paidNow(t, r.mpesa_code); }
        if (r && r.status === 'cancelled') { clearInterval(poll); showErr($('#req-error'), T(ERR.not_open)); asking(); }
      }).catch(function () {});
    }
    poll = setInterval(check, 5000); setTimeout(check, 1500);
  }
  function sendRequest(t, num) {
    var err = $('#req-error'), btn = $('#req-submit'); showErr(err);
    if (!V.phoneOk(num)) { showErr(err, T(ERR.bad_phone)); return Promise.resolve(); }
    btn.disabled = true; btn.textContent = T('Sending…');
    return (V.demo ? Promise.resolve({ ok: true }) : rpc('request_stay_payment', { p_ref: t.ref, p_phone: t.phone, p_mpesa_phone: num })).then(function (r) {
      t.mpesa_phone = num; t.requested = true; store(t);
      if (r && r.paid) { paidNow(t); return; }
      waiting(t);
    }).catch(function (e) { console.error(e); showErr(err, errText(e)); asking(); })
      .then(function () { btn.disabled = false; btn.textContent = T('Send payment request'); });
  }
  $('#req-form').addEventListener('submit', function (e) { e.preventDefault(); var t = stored(); if (!t) { showErr($('#req-error'), T(ERR.not_found)); return; } sendRequest(t, e.target.mpesa_phone.value.trim()); });
  $('#pw-again').addEventListener('click', function () { var t = stored(); if (t) sendRequest(t, t.mpesa_phone); });
  $('#pw-change').addEventListener('click', function () { var t = stored(); if (t) { t.requested = false; store(t); } asking(); });
  // The "Paid" moment, then the voucher
  function paidNow(t, code) {
    clearInterval(timer); clearInterval(poll);
    t.paid = true; store(t);
    var o = document.createElement('div'); o.className = 'paid-moment'; o.setAttribute('role', 'status');
    var cols = ['#F2A93B', '#FCD38A', '#9FE3C9', '#ffffff'], cf = '';
    for (var i = 0; i < 26; i++) cf += '<i class="cf" style="left:' + Math.round(Math.random() * 100) + '%;background:' + cols[i % 4] + ';animation-delay:' + (Math.random() * .6).toFixed(2) + 's"></i>';
    o.innerHTML = cf + '<span class="pm-tick"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span><h2>' + V.esc(T('Paid')) + '</h2><span class="pm-amt">' + kes(t.total) + '</span><p>' + V.esc(T('Thank you! Your stay is booked.')) + '</p>';
    document.body.appendChild(o);
    setTimeout(function () {
      $('#pay-wrap').classList.add('hidden'); $('#stay-done').classList.remove('hidden');
      voucher(t, code || t.mpesa_code_seen || '—');
      $('#done-trip').href = 'trip.html?ref=' + encodeURIComponent(t.ref);
      $('#done-wa').href = V.wa('Hi Viustay, I just paid for my stay ' + t.ref + '.');
      window.scrollTo(0, 0);
      o.style.transition = 'opacity .4s'; o.style.opacity = '0'; setTimeout(function () { o.remove(); }, 450);
    }, 2600);
  }
  function voucher(t, code) {
    $('#voucher').innerHTML = '<div class="v-top"><b>viustay</b><span>' + T('Booking voucher') + '</span></div><div class="v-body">' +
      '<span class="v-ok">✓ ' + T('Paid · we\'re confirming with the host') + '</span>' +
      '<h2>' + V.esc(t.title) + '</h2><span class="note">' + V.esc(t.area || '') + ', Nairobi</span>' +
      '<div class="v-grid"><div><small>' + T('Check-in') + '</small><strong>' + V.esc(V.date(t.check_in)) + '</strong><span class="note">' + V.esc(T('from {t}', { t: t.check_in_time })) + '</span></div>' +
      '<div><small>' + T('Check-out') + '</small><strong>' + V.esc(V.date(t.check_out)) + '</strong><span class="note">' + V.esc(T('by {t}', { t: t.check_out_time })) + '</span></div>' +
      '<div><small>' + T('Guests') + '</small><strong>' + t.guests + '</strong></div><div><small>' + T('Nights') + '</small><strong>' + t.nights + '</strong></div>' +
      '<div><small>' + T('Paid') + '</small><strong>' + kes(t.total) + '</strong>' + (code && code !== '—' ? '<span class="note">M-Pesa ' + V.esc(code) + '</span>' : '') + '</div><div><small>' + T('Booking') + '</small><strong>' + V.esc(t.ref) + '</strong></div></div>' +
      (t.pickup ? '<span>✈ ' + T('Airport pickup booked. We\'ll confirm your driver before you land.') + '</span>' : '') +
      '<div class="v-cut"></div><span>' + T('We\'ll send your check-in details (address, directions, caretaker and keys) on WhatsApp the day before you arrive.') + '</span></div>';
  }
  $('#pay-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var t = stored(), code = e.target.mpesa.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase(), err = $('#pay-error');
    showErr(err);
    if (!t) { showErr(err, T(ERR.not_found)); return; }
    if (!/^[A-Z0-9]{8,12}$/.test(code)) { showErr(err, T(ERR.bad_mpesa)); return; }
    var btn = $('#pay-submit'); btn.disabled = true; btn.textContent = T('Checking…');
    (V.demo ? Promise.resolve({ ok: true }) : rpc('submit_stay_payment', { p_ref: t.ref, p_phone: t.phone, p_mpesa: code })).then(function () {
      paidNow(t, code);
    }).catch(function (e2) { console.error(e2); showErr(err, errText(e2)); })
      .then(function () { btn.disabled = false; btn.textContent = T('Confirm payment'); });
  });
  $('#done-print').addEventListener('click', function () { window.print(); });

  // ---------- booking ----------
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var err = $('#stay-error'); showErr(err);
    var name = f.name.value.trim(), phone = f.phone.value.trim();
    var problem = !quote ? T('Please pick your dates.') : !name ? T(ERR.bad_name) : !V.phoneOk(phone) ? T(ERR.bad_phone) : !f.consent.checked ? T('Please tick the box to agree.') : '';
    if (problem) { showErr(err, problem); return; }
    var btn = $('#stay-submit'); btn.disabled = true; btn.textContent = T('Holding your dates…');
    var payload = { listing_id: L.id, title: L.title, area: L.area, name: name, phone: phone, guests: guests, check_in: f.check_in.value, check_out: f.check_out.value,
      night_rate: L.night_rate, min_nights: L.min_nights, cleaning_fee: L.cleaning_fee, pickup: f.pickup.checked && S.airport_pickup_fee > 0, pickup_note: f.pickup_note.value.trim(),
      check_in_time: L.check_in, check_out_time: L.check_out };
    var p = V.demo ? Promise.resolve({ ref: 'ST-DEMO' + Math.floor(Math.random() * 90 + 10), total: quote.total, nights: quote.nights, expires_at: new Date(Date.now() + S.pay_window_min * 60000).toISOString() }) : rpc('create_stay', { p: payload });
    p.then(function (r) {
      var t = { ref: r.ref, phone: phone, total: r.total, nights: r.nights, expires_at: r.expires_at, title: L.title, area: L.area, guests: guests,
        check_in: payload.check_in, check_out: payload.check_out, check_in_time: L.check_in, check_out_time: L.check_out, pickup: payload.pickup };
      store(t); showPay(t);
    }).catch(function (e2) {
      console.error(e2); showErr(err, errText(e2));
      if (/dates_taken/.test(e2.message || '')) loadBooked().then(update);
      update();
    });
  });

  function loadBooked() {
    if (V.demo) return Promise.resolve([]);
    return rpc('stay_booked', { p_listing: id }).then(function (r) { booked = r || []; return booked; }).catch(function () { return []; });
  }

  // ---------- start ----------
  var today = iso(new Date());
  f.check_in.min = today; f.check_out.min = addDays(today, 1);
  Promise.all([V.getListing(id), V.Trip.loadSettings(), loadBooked()]).then(function (res) {
    L = res[0]; S = res[1];
    if (!L || L.stay !== 'short') { $('#s-listing').innerHTML = '<p>' + T('This stay is no longer available.') + ' <a href="homes.html?stay=short">' + T('See other stays') + '</a></p>'; return; }
    $('#s-back').href = 'home.html?id=' + encodeURIComponent(L.id);
    $('#s-listing').innerHTML = '<a class="mini" href="home.html?id=' + encodeURIComponent(L.id) + '"><span class="thumb" style="' + V.photoStyle(L.photoList[0]) + '"></span><span><span style="font-weight:600">' + V.esc(L.title) + '</span><small>' + V.esc(L.area) + ' · ' + V.esc(V.priceText(L)) + '</small></span></a>';
    $('#g-max').textContent = T('Up to {n} guests', { n: L.max_guests });
    setGuests(Math.min(2, L.max_guests));
    $('#s-rules').textContent = [T('Check-in from {t}', { t: L.check_in }), T('check-out by {t}', { t: L.check_out }), T(L.cancellation)].concat(L.rulesList.map(function (r) { return T(r); })).join(' · ') + '.';
    if (S.airport_pickup_fee > 0) {
      $('#pickup-wrap').classList.remove('hidden');
      $('#pickup-text').textContent = T('Add airport or bus-station pickup by a Viustay agent (+{x})', { x: kes(S.airport_pickup_fee) });
    }
    // Dates picked in the search carry over
    var sc = (V.getSearch() || {}).chat || {};
    if (sc.checkin && sc.checkout && sc.checkin >= today) { f.check_in.value = sc.checkin; f.check_out.value = sc.checkout; f.check_out.min = addDays(sc.checkin, 1); }
    var t = stored();
    if (new URLSearchParams(location.search).get('pay') && t && !t.paid) { showPay(t); return; }
    update();
  }).catch(function (e) { console.error(e); showErr($('#stay-error'), T('The booking page could not load. Please refresh.')); });
});
