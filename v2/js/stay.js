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

  var today = iso(new Date());
  var f = $('#stay-form'), G = V.Guide, guestsOk = false, cur = -1, details = $('#sv-details'), calIn = null, calOut = null;
  var cards = Array.prototype.slice.call(document.querySelectorAll('.sc-card')), view = $('#sc-view');
  // Option C: one card at a time. Done steps fold into ✓ pills at the top; the stay card rises in at the end.
  function fit() { view.style.height = cur >= 3 ? '0px' : cards[cur].offsetHeight + 'px'; }
  view.addEventListener('scroll', function () { if (view.scrollLeft) view.scrollLeft = 0; });
  function go(i, byUser) {
    var was = cur; cur = i; view.scrollLeft = 0;
    $('#sc-track').style.transform = 'translateX(calc(' + (-Math.min(i, 2) * 100) + '% - ' + (Math.min(i, 2) * 24) + 'px))';
    cards.forEach(function (c, k) { c.inert = k !== i; c.setAttribute('aria-hidden', k !== i ? 'true' : 'false'); });
    $('#sv-c').classList.toggle('folded', i >= 3);
    fit();
    $('#sc-fill').style.width = (i >= 3 ? 100 : (i + 1) * 25) + '%';
    if (i > was && was >= 0) showErr($('#stay-error'));
    if (!(quote && guestsOk)) $('#sv-break').textContent = T(['Step 1 of 3', 'Step 2 of 3', 'Step 3 of 3'][Math.min(i, 2)]);
    if (i < 3 && was !== i && was >= 0) { setTimeout(function () { var h = cards[i].querySelector('h2'); if (byUser) G.scrollTo($('#sv-c'), 'start'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } }, 380); }
    pills();
  }
  if (window.ResizeObserver) new ResizeObserver(function () { if (cur >= 0) fit(); }).observe($('#sc-track'));
  window.addEventListener('resize', function () { if (cur >= 0) fit(); });
  function pills() {
    var a = f.check_in.value, b = f.check_out.value, dd = function (v) { return V.date(v, { weekday: 'short', day: 'numeric' }); }, box = $('#sc-pills');
    var list = [a && cur !== 0 ? [0, T('In') + ' ' + dd(a)] : null, b && cur > 1 ? [1, T('Out') + ' ' + dd(b)] : null, guestsOk && cur >= 3 ? [2, T(guests === 1 ? '{n} guest' : '{n} guests', { n: guests })] : null].filter(Boolean);
    var had = {}; Array.prototype.forEach.call(box.children, function (p) { had[p.getAttribute('data-go')] = p.textContent; });
    box.innerHTML = list.map(function (p) { return '<button type="button" class="sc-pill' + (had[p[0]] === undefined ? ' new' : '') + '" data-go="' + p[0] + '" aria-label="' + V.esc(T('Change')) + ': ' + V.esc(p[1]) + '"><i>✓</i>' + V.esc(p[1]) + '</button>'; }).join('');
  }
  $('#sc-in-change').addEventListener('click', function () { go(0, true); });
  $('#sc-pills').addEventListener('click', function (e) { var p = e.target.closest('[data-go]'); if (p) go(+p.getAttribute('data-go'), true); });
  function update() {
    var a = f.check_in.value, b = f.check_out.value, hint = $('#s-dates-hint'), n = a && b ? nightsOf(a, b) : 0, bad = '';
    if (a && b && n < 1) bad = T('Check-out must be after check-in.');
    else if (n && n < L.min_nights) bad = T('Minimum stay is {n} nights.', { n: L.min_nights });
    else if (n && overlaps(a, b)) bad = T('Some of these nights are already booked. Please pick other dates.');
    hint.textContent = bad; hint.classList.toggle('t-msg', !!bad); hint.classList.toggle('bad', !!bad);
    var pick = f.pickup.checked && S.airport_pickup_fee > 0;
    $('#pickup-note-wrap').classList.toggle('hidden', !pick);
    quote = (n >= 1 && !bad) ? { nights: n, rooms: n * L.night_rate, clean: L.cleaning_fee, pick: pick ? S.airport_pickup_fee : 0 } : null;
    if (quote) quote.total = quote.rooms + quote.clean + quote.pick;
    var ready = !!quote && guestsOk;
    $('#sc-in-date').textContent = a ? V.date(a, { weekday: 'short', day: 'numeric', month: 'short' }) : '–';
    // The stay card and the totals only fill once dates and guests are set
    var nt = function (x) { return T(x === 1 ? '{n} night' : '{n} nights', { n: x }); };
    $('#sv-stay').classList.toggle('ready', ready);
    $('#sv-sum').textContent = ready ? nt(n) + ' · ' + T(guests === 1 ? '{n} guest' : '{n} guests', { n: guests }) : '';
    $('#sv-break-c').textContent = ready ? ['KES ' + V.money(L.night_rate) + ' × ' + nt(n)].concat(quote.clean ? [V.money(quote.clean) + ' ' + T('cleaning')] : [], quote.pick ? [V.money(quote.pick) + ' ' + T('pickup')] : []).join(' + ') : '';
    flash($('#sv-total-c'), ready ? kes(quote.total) : '–');
    $('#p-nights').textContent = 'KES ' + V.money(L.night_rate) + ' × ' + T(n === 1 ? '{n} night' : '{n} nights', { n: ready ? n : '–' });
    flash($('#p-rooms'), ready ? kes(quote.rooms) : '–');
    flash($('#p-clean'), L.cleaning_fee ? kes(L.cleaning_fee) : T('Included'));
    $('#p-pick-row').classList.toggle('hidden', !pick); $('#p-pick').textContent = kes(S.airport_pickup_fee || 0);
    flash($('#p-total'), ready ? kes(quote.total) : '–');
    flash($('#sv-total'), ready ? kes(quote.total) : '–');
    $('#sv-break').textContent = ready ? nt(n) + (quote.clean ? ' + ' + T('cleaning') : '') + (quote.pick ? ' + ' + T('pickup') : '') : T(['Step 1 of 3', 'Step 2 of 3', 'Step 3 of 3', 'Step 3 of 3'][Math.max(0, cur)]);
    if (ready && details.classList.contains('hidden')) details.classList.remove('hidden');
    if (details._guide) details._guide.refresh(false);
    if (cur >= 0) pills();
    return ready;
  }
  function setIn(x) { f.check_in.value = x; f.check_out.value = ''; update(); calOut.set('out', x, null); calIn.set('in', x, null); go(1, true); }
  function startCals() {
    var o = { min: today, booked: function () { return booked; }, minNights: L.min_nights };
    calIn = V.Cal.inline($('#cal-in'), Object.assign({ stage: 'in', checkIn: f.check_in.value || null, checkOut: f.check_out.value || null, onIn: setIn }, o));
    calOut = V.Cal.inline($('#cal-out'), Object.assign({ stage: 'out', checkIn: f.check_in.value || null, checkOut: f.check_out.value || null, ripple: false, onIn: setIn,
      onOut: function (x, y) {
        f.check_in.value = x; f.check_out.value = y; calIn.set('in', x, y);
        if (update() && guestsOk) { go(3, true); showDetails(); } else go(2, true);
      } }, o));
  }
  function showDetails() { setTimeout(function () { G.scrollTo(details, 'start'); if (details._guide) details._guide.start(); }, 450); }
  f.pickup.addEventListener('change', function () { update(); });
  function setGuests(n) { guests = Math.max(1, Math.min(L.max_guests, n)); var g = $('#g-n'); g.textContent = guests; g.classList.remove('bump'); void g.offsetWidth; g.classList.add('bump'); $('#g-minus').disabled = guests <= 1; $('#g-plus').disabled = guests >= L.max_guests; if (L) update(); }
  $('#g-minus').addEventListener('click', function () { setGuests(guests - 1); });
  $('#g-plus').addEventListener('click', function () { setGuests(guests + 1); });
  $('#g-ok').addEventListener('click', function () {
    if (!quote) { go(f.check_in.value ? 1 : 0, true); return; }
    guestsOk = true; update(); go(3, true); showDetails();
  });
  G.form(details, { button: $('#stay-submit'), ready: function () { return !!quote && guestsOk; },
    blocked: function () { if (quote && guestsOk) return false; var c = cards[Math.min(Math.max(cur, 0), 2)]; G.shake(c); G.scrollTo($('#sv-c'), 'start'); return true; } });

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
    var cols = ['#1554D1', '#F4F6F9', '#DDDDDD', '#ffffff'], cf = '';
    for (var i = 0; i < 26; i++) cf += '<i class="cf" style="left:' + Math.round(Math.random() * 100) + '%;background:' + cols[i % 4] + ';animation-delay:' + (Math.random() * .6).toFixed(2) + 's"></i>';
    o.innerHTML = cf + '<span class="pm-tick"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span><h2>' + V.esc(T('Paid')) + '</h2><span class="pm-amt">' + kes(t.total) + '</span><p>' + V.esc(T('Thank you! Your stay is booked.')) + '</p>';
    document.body.appendChild(o);
    setTimeout(function () {
      $('#pay-wrap').classList.add('hidden'); $('#stay-done').classList.remove('hidden');
      t.status = 'paid'; t.mpesa_code = code || t.mpesa_code || '';
      $('#voucher').innerHTML = V.Ticket.html(t, { live: true });
      V.Ticket.start($('#voucher'));
      $('#done-trip').href = 'trip.html?ref=' + encodeURIComponent(t.ref);
      $('#done-wa').href = V.wa('Hi Viustay, I just paid for my stay ' + t.ref + '.');
      window.scrollTo(0, 0);
      o.style.transition = 'opacity .4s'; o.style.opacity = '0'; setTimeout(function () { o.remove(); }, 450);
    }, 2600);
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
  $('#done-mail').addEventListener('click', function () { $('#mail-note').classList.remove('hidden'); });

  // ---------- booking ----------
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var err = $('#stay-error'); showErr(err);
    var name = f.name.value.trim(), phone = f.phone.value.trim();
    var problem = !quote ? T('Please pick your dates.') : !name ? T(ERR.bad_name) : !V.phoneOk(phone) ? T(ERR.bad_phone) : !f.consent.checked ? T('Please tick the box to agree.') : '';
    if (!guestsOk && quote) problem = T('Please confirm the number of guests.');
    if (problem) { showErr(err, problem); return; }
    var btn = $('#stay-submit'); btn.disabled = true; btn.textContent = T('Holding your dates…');
    var payload = { listing_id: L.id, title: L.title, area: L.area, name: name, phone: phone, guests: guests, check_in: f.check_in.value, check_out: f.check_out.value,
      night_rate: L.night_rate, min_nights: L.min_nights, cleaning_fee: L.cleaning_fee, pickup: f.pickup.checked && S.airport_pickup_fee > 0, pickup_note: f.pickup_note.value.trim(),
      check_in_time: L.check_in, check_out_time: L.check_out };
    var p = V.demo ? Promise.resolve({ ref: 'ST-DEMO' + Math.floor(Math.random() * 90 + 10), total: quote.total, nights: quote.nights, expires_at: new Date(Date.now() + S.pay_window_min * 60000).toISOString() }) : rpc('create_stay', { p: payload });
    p.then(function (r) {
      var t = { ref: r.ref, phone: phone, total: r.total, nights: r.nights, expires_at: r.expires_at, title: L.title, area: L.area, guests: guests,
        check_in: payload.check_in, check_out: payload.check_out, check_in_time: L.check_in, check_out_time: L.check_out, pickup: payload.pickup, name: name, listing_id: L.id, kind: 'stay' };
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
  Promise.all([V.getListing(id), V.Trip.loadSettings(), loadBooked()]).then(function (res) {
    L = res[0]; S = res[1];
    if (!L || L.stay !== 'short') { $('#s-listing').innerHTML = '<p>' + T('This stay is no longer available.') + ' <a href="homes.html?stay=short">' + T('See other stays') + '</a></p>'; return; }
    $('#s-back').href = 'home.html?id=' + encodeURIComponent(L.id);
    var link = 'home.html?id=' + encodeURIComponent(L.id);
    $('#sv-photo').href = link; $('#sv-thumb').setAttribute('style', V.photoStyle(L.photoList[0]));
    $('#sv-title').textContent = L.title; $('#sv-sub').textContent = L.area + ' · ' + V.priceText(L);
    if (L.min_nights > 1) { $('#sv-min').textContent = T('Minimum stay: {n} nights', { n: L.min_nights }); $('#sv-min').classList.remove('hidden'); }
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
    if (sc.checkin && sc.checkout && sc.checkin >= today) { f.check_in.value = sc.checkin; f.check_out.value = sc.checkout; }
    var t = stored();
    if (new URLSearchParams(location.search).get('pay') && t && !t.paid) { showPay(t); return; }
    startCals();
    update();
    go(quote ? 2 : f.check_in.value ? 1 : 0);
  }).catch(function (e) { console.error(e); showErr($('#stay-error'), T('The booking page could not load. Please refresh.')); });
});
