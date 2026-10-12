// "My bookings": viewing trips (VS-…) and short stays (ST-…), saved on this phone or found by number + phone.
document.addEventListener('DOMContentLoaded', function () {
  var V = window.V, T = V.t, $ = V.$;
  var params = new URLSearchParams(location.search);
  function get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function kes(n) { return 'KES ' + V.money(n); }
  function long(iso) { return V.date(iso, { weekday: 'long', day: 'numeric', month: 'long' }); }
  function intl(p) { var d = String(p || '').replace(/[^0-9]/g, ''); if (d.indexOf('0') === 0) d = '254' + d.slice(1); if (d.length === 9) d = '254' + d; return d; }
  function rpc(name, args) { return V.ensureDb().then(function (db) { return db.rpc(name, args); }).then(function (r) { if (r.error) throw r.error; return r.data; }); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function isStay(ref) { return /^ST-/i.test(ref || ''); }

  // Which bookings to show
  var list = [], trip = get('vs-trip'), stay = get('vs-stay'), qref = (params.get('ref') || '').toUpperCase();
  if (qref) {
    var saved = [trip, stay].filter(function (x) { return x && x.ref === qref; })[0];
    if (saved) list.push(saved); else { $('#find-form').ref.value = qref; }
  } else { if (stay) list.push(stay); if (trip) list.push(trip); }

  function progress(stages, n) {
    return '<ol class="t-progress">' + stages.map(function (s, i) { return '<li class="' + (i <= n ? 'on' : '') + (i === n + 1 ? ' now' : '') + '">' + T(s) + '</li>'; }).join('') + '</ol>';
  }
  function rating(box, kind, b, phone) {
    var f = box.querySelector('.rate-form'); if (!f) return;
    var r = 0;
    V.$$('.t-stars button', f).forEach(function (x) { x.addEventListener('click', function () { r = +x.getAttribute('data-r'); V.$$('.t-stars button', f).forEach(function (y) { y.classList.toggle('on', +y.getAttribute('data-r') <= r); }); }); });
    f.addEventListener('submit', function (e) {
      e.preventDefault(); var msg = f.querySelector('.t-msg');
      if (!r) { msg.className = 't-msg bad'; msg.textContent = T('Tap a star first.'); return; }
      (V.demo ? Promise.resolve(true) : rpc(kind === 'stay' ? 'rate_stay' : 'rate_trip', { p_ref: b.ref, p_phone: phone, p_rating: r, p_note: f.note.value }))
        .then(function () { b.rating = r; draw(box, b, phone); })
        .catch(function () { msg.className = 't-msg bad'; msg.textContent = T('Could not send. Please try again.'); });
    });
  }
  function rateForm(q) {
    return '<form class="t-card rate-form"><strong style="font-size:15px">' + T(q) + '</strong><div class="t-stars" role="radiogroup" aria-label="' + T('Rating') + '">' +
      [1, 2, 3, 4, 5].map(function (i) { return '<button type="button" data-r="' + i + '" aria-label="' + i + '">★</button>'; }).join('') +
      '</div><label class="field">' + T('Anything to tell us? (optional)') + '<textarea name="note" rows="2" maxlength="500"></textarea></label><p class="t-msg"></p><div><button class="btn btn-primary" type="submit">' + T('Send rating') + '</button></div></form>';
  }

  // ---------- viewing trip ----------
  var TRIP = { booked: ['ok', 'Booked · we\'re confirming your homes'], awaiting_payment: ['warn', 'Waiting for payment'], expired: ['bad', 'Not paid in time'], paid: ['ok', 'Paid · we\'re confirming your homes'],
    confirmed: ['ok', 'Confirmed'], completed: ['ok', 'Trip done'], no_show: ['bad', 'Missed trip'], cancelled: ['bad', 'Cancelled'] };
  function drawTrip(box, t, phone) {
    var st = t.status === 'confirmed' && t.agent ? ['ok', 'Your agent is ready'] : TRIP[t.status] || ['', t.status];
    var after = !!t.pay_after;
    var n = after ? (t.status === 'completed' ? 3 : t.status === 'confirmed' ? (t.agent ? 2 : 1) : 0)
      : t.status === 'completed' ? 4 : t.status === 'confirmed' ? (t.agent ? 3 : 2) : t.status === 'paid' ? 1 : 0;
    if (after && t.status === 'completed') st = ['ok', 'Trip done · paid'];
    var h = '<div class="t-card"><div class="row-between" style="flex-wrap:wrap;gap:8px"><span><span class="kicker">' + T('Viewing trip') + '</span><br><strong style="font-size:18px">' + V.esc(t.ref) + '</strong></span><span class="t-badge ' + st[0] + '">' + V.esc(T(st[1])) + '</span></div>';
    if (['cancelled', 'expired', 'no_show'].indexOf(t.status) < 0) h += progress(after ? ['Booked', 'Confirmed', 'Agent ready', 'Done'] : ['Booked', 'Paid', 'Confirmed', 'Agent ready', 'Done'], n);
    h += '<div class="t-kv"><span>' + T('When') + '</span><strong>' + V.esc(long(t.date)) + ', ' + V.esc(t.slot) + '</strong>' +
      '<span>' + T('Pickup') + '</span><span>' + V.esc(t.pickup_area) + (t.pickup_note ? ' · ' + V.esc(t.pickup_note) : '') + '</span>' +
      '<span>' + T(after && !t.mpesa_code ? 'To pay' : 'Paid') + '</span><span>' + (t.mpesa_code ? kes(t.total) + ' · M-Pesa ' + V.esc(t.mpesa_code) : kes(t.total) + ' (' + T(after ? 'after the trip' : 'not paid yet') + ')') + '</span></div>' +
      '<strong style="font-size:15px">' + T('Homes, in visiting order') + '</strong><ol class="t-homes">' + (t.homes || []).map(function (x) { return '<li><a href="home.html?id=' + encodeURIComponent(x.id) + '">' + V.esc(x.title || x.id) + '</a>' + (x.area ? ' · ' + V.esc(x.area) : '') + '</li>'; }).join('') + '</ol></div>';
    if (t.status === 'awaiting_payment') {
      try { localStorage.setItem('vs-trip', JSON.stringify({ ref: t.ref, phone: phone, total: t.total, expires_at: t.expires_at, date: t.date, slot: t.slot, pickup: t.pickup_area })); } catch (e) {}
      h += '<div class="t-card"><p style="margin:0">' + T('Your slot is held until you pay. Pay by M-Pesa and enter the confirmation code.') + '</p><div><a class="btn btn-primary" href="book.html?pay=1">' + T('Finish paying') + '</a></div></div>';
    }
    var day = t.today || today();
    if (after && t.status === 'confirmed' && !t.mpesa_code && t.date <= day) {
      h += '<form class="t-card pay-after-form"><strong style="font-size:17px">' + T('Pay after your viewing') + '</strong>' +
        (t.till ? '<ol class="t-steps"><li><span>' + T('Open <strong>M-Pesa</strong> and go to <b>Lipa na M-Pesa → Buy Goods and Services</b>.') + '</span></li><li><span>' + T('Till number:') + ' <strong>' + V.esc(t.till) + '</strong> ' + (t.pay_name ? '<span class="note">(' + V.esc(t.pay_name) + ')</span>' : '') + '</span></li><li><span>' + T('Amount:') + ' <strong>' + kes(t.total) + '</strong></span></li></ol>'
          : '<span>' + T('Your agent will show you how to pay {x} by M-Pesa.', { x: kes(t.total) }) + '</span>') +
        '<label class="field">' + T('M-Pesa confirmation code') + '<input name="mpesa" autocomplete="off" autocapitalize="characters" maxlength="14" placeholder="e.g. SJK3ABCD12"></label><p class="t-msg"></p><div><button class="btn btn-primary" type="submit">' + T('I\'ve paid') + '</button></div></form>';
    }
    if (t.code) h += '<div class="t-code"><span>' + T('Your trip code') + '</span><b>' + V.esc(t.code) + '</b><span>' + T('Give this code to your agent at the <strong>end</strong> of your trip, not before.') + '</span></div>';
    if (t.agent) {
      var a = t.agent;
      h += '<div class="t-card"><strong style="font-size:15px">' + T('Your agent') + '</strong><div class="t-agent"><span class="t-face" style="' + (a.photo_url ? V.photoStyle(a.photo_url) : '') + '">' + (a.photo_url ? '' : V.esc((a.name || '?').charAt(0))) + '</span>' +
        '<div class="stack-sm" style="gap:4px"><strong style="font-size:18px">' + V.esc(a.name) + '</strong><span>' + V.esc(a.car || '') + '</span>' + (a.plate ? '<span><span class="t-plate">' + V.esc(a.plate) + '</span></span>' : '') + '</div></div>' +
        (t.status === 'confirmed' ? '<div class="t-actions"><a class="btn btn-dark" href="tel:+' + intl(a.phone) + '">' + T('Call {name}', { name: V.esc(a.name.split(' ')[0]) }) + '</a><a class="btn btn-outline" target="_blank" rel="noopener" href="https://wa.me/' + intl(a.phone) + '">WhatsApp</a></div>' : '') +
        '<span class="note">' + T('Check the plate before you get in. Your agent never asks for cash: everything is paid to Viustay.') + '</span></div>';
    } else if (t.status === 'paid' || t.status === 'confirmed' || t.status === 'booked') {
      h += '<div class="t-card"><strong style="font-size:15px">' + T('Your agent') + '</strong><span>' + T('We\'ll show your agent\'s name, photo and car plate here the day before your trip.') + '</span></div>';
    }
    if (t.status === 'completed' && !t.rating) h += rateForm('How was your agent?');
    else if (t.rating) h += '<div class="t-card"><span>' + T('Thanks for your rating') + ' ' + '★★★★★'.slice(0, t.rating) + '</span></div>';
    h += '<div class="t-actions"><a class="btn btn-outline" target="_blank" rel="noopener" href="' + V.wa('Hi Viustay, about my viewing trip ' + t.ref + ': ') + '">' + T('Change or cancel on WhatsApp') + '</a></div>';
    box.innerHTML = h; rating(box, 'trip', t, phone);
    var pf = box.querySelector('.pay-after-form');
    if (pf) pf.addEventListener('submit', function (e) {
      e.preventDefault();
      var code = pf.mpesa.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase(), msg = pf.querySelector('.t-msg'), btn = pf.querySelector('button');
      if (!/^[A-Z0-9]{8,12}$/.test(code)) { msg.className = 't-msg bad'; msg.textContent = T('That doesn\'t look like an M-Pesa code. It\'s 10 letters and numbers, like SJK3ABCD12.'); return; }
      btn.disabled = true;
      (V.demo ? Promise.resolve({ ok: true }) : rpc('submit_payment', { p_ref: t.ref, p_phone: phone, p_mpesa: code })).then(function () {
        t.mpesa_code = code; t.status = 'completed'; draw(box, t, phone);
      }).catch(function (e2) {
        btn.disabled = false; msg.className = 't-msg bad';
        msg.textContent = /used_mpesa/.test(e2.message || '') ? T('That M-Pesa code was already used. Please check it, or WhatsApp us.') : T('Could not send. Please try again.');
      });
    });
  }

  // ---------- short stay ----------
  var STAY = { awaiting_payment: ['warn', 'Waiting for payment'], expired: ['bad', 'Not paid in time'], paid: ['ok', 'Paid · we\'re confirming with the host'],
    confirmed: ['ok', 'Confirmed'], checked_in: ['ok', 'Checked in · enjoy your stay'], completed: ['ok', 'Stay complete'], cancelled: ['bad', 'Cancelled'] };
  function drawStay(box, s, phone) {
    var st = STAY[s.status] || ['', s.status];
    var n = { awaiting_payment: 0, paid: 1, confirmed: 2, checked_in: 3, completed: 4 }[s.status];
    var h = '<div class="t-card"><div class="row-between" style="flex-wrap:wrap;gap:8px"><span><span class="kicker">' + T('Short stay') + '</span><br><strong style="font-size:18px">' + V.esc(s.ref) + '</strong></span><span class="t-badge ' + st[0] + '">' + V.esc(T(st[1])) + '</span></div>';
    if (n !== undefined) h += progress(['Booked', 'Paid', 'Confirmed', 'Checked in', 'Done'], n);
    h += '<h2 style="font-size:20px;margin:0"><a href="home.html?id=' + encodeURIComponent(s.listing_id) + '">' + V.esc(s.title || s.listing_id) + '</a></h2>' +
      '<div class="t-kv"><span>' + T('Check-in') + '</span><strong>' + V.esc(long(s.check_in)) + ' · ' + V.esc(T('from {t}', { t: s.check_in_time || '2:00 PM' })) + '</strong>' +
      '<span>' + T('Check-out') + '</span><strong>' + V.esc(long(s.check_out)) + ' · ' + V.esc(T('by {t}', { t: s.check_out_time || '11:00 AM' })) + '</strong>' +
      '<span>' + T('Guests') + '</span><span>' + s.guests + ' · ' + V.esc(T(s.nights === 1 ? '{n} night' : '{n} nights', { n: s.nights })) + '</span>' +
      (s.pickup ? '<span>' + T('Airport pickup') + '</span><span>' + T('Booked') + '</span>' : '') +
      '<span>' + T('Paid') + '</span><span>' + (s.mpesa_code ? kes(s.total) + ' · M-Pesa ' + V.esc(s.mpesa_code) : kes(s.total) + ' (' + T('not paid yet') + ')') + '</span></div></div>';
    if (s.status === 'awaiting_payment') {
      h += '<div class="t-card"><p style="margin:0">' + T('Your dates are held until you pay. Pay by M-Pesa and enter the confirmation code.') + '</p><div><a class="btn btn-primary" href="stay.html?id=' + encodeURIComponent(s.listing_id) + '&pay=1">' + T('Finish paying') + '</a></div></div>';
    }
    if (s.checkin_info) h += '<div class="t-card"><strong style="font-size:15px">' + T('Your check-in details') + '</strong><div class="t-info">' + V.esc(s.checkin_info) + '</div></div>';
    else if (s.status === 'paid' || s.status === 'confirmed') h += '<div class="t-card"><strong style="font-size:15px">' + T('Your check-in details') + '</strong><span>' + T('We\'ll send your check-in details (address, directions, caretaker and keys) on WhatsApp the day before you arrive.') + '</span></div>';
    if ((s.status === 'checked_in' || s.status === 'confirmed') && s.check_out === today()) h += '<p class="t-warn">' + T('Check-out is today by {t}. Leave the keys as agreed with the caretaker. Safe travels!', { t: s.check_out_time || '11:00 AM' }) + '</p>';
    if ((s.status === 'completed' || s.status === 'checked_in') && !s.rating) h += rateForm('How was your stay?');
    else if (s.rating) h += '<div class="t-card"><span>' + T('Thanks for your rating') + ' ' + '★★★★★'.slice(0, s.rating) + '</span></div>';
    h += '<div class="t-actions"><a class="btn btn-dark" target="_blank" rel="noopener" href="' + V.wa('Hi Viustay, I\'m a guest on stay ' + s.ref + ': ') + '">' + T('Guest support on WhatsApp') + '</a></div>';
    box.innerHTML = h; rating(box, 'stay', s, phone);
  }

  function draw(box, b, phone) { if (b.kind === 'stay' || isStay(b.ref)) drawStay(box, b, phone); else drawTrip(box, b, phone); }

  function demoData(ref) {
    if (isStay(ref)) return { ref: ref, kind: 'stay', status: 'confirmed', listing_id: 'VS-102', title: '1 bedroom, Off Waiyaki Way', area: 'Westlands', guests: 2, nights: 3,
      check_in: today(), check_out: today(), check_in_time: '2:00 PM', check_out_time: '11:00 AM', total: 25000, mpesa_code: 'QWE123RTY9', checkin_info: 'Sarit View Apartments, Block B, 6th floor.\nCaretaker: John, 0712 000 000.' };
    return { ref: ref, status: 'confirmed', date: today(), slot: '9:00 AM', pickup_area: 'South B', pickup_note: 'Gate B', homes: [{ id: 'VS-001', title: '1 bedroom, Argwings Kodhek Rd', area: 'Kilimani' }],
      total: 2550, pay_after: true, till: '123456', pay_name: 'Viustay', agent: { name: 'Hassan Ali', phone: '0712345678', car: 'Toyota Axio, silver', plate: 'KDA 123A' } };
  }
  function load(ref, phone) {
    var box = document.createElement('div'); box.className = 'stack-sm'; box.style.gap = '14px';
    box.innerHTML = V.skel.rows(2);
    $('#trip-view').appendChild(box); $('#trip-view').classList.remove('hidden');
    if (V.demo) { draw(box, demoData(ref), phone); return Promise.resolve(); }
    return rpc(isStay(ref) ? 'lookup_stay' : 'lookup_trip', { p_ref: ref, p_phone: phone }).then(function (b) { draw(box, b, phone); }).catch(function (e) {
      console.error(e); box.parentNode.removeChild(box);
      $('#find-form').classList.remove('hidden');
      var er = $('#find-error'); er.textContent = /not_found/.test(e.message || '') ? T('We couldn\'t find that booking. Check the number and phone, or WhatsApp us.') : T('Could not load your booking. Please try again.');
      er.classList.remove('hidden');
    });
  }

  $('#find-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var ref = e.target.ref.value.trim().toUpperCase(), phone = e.target.phone.value.trim(), er = $('#find-error');
    if (!ref || !V.phoneOk(phone)) { er.textContent = T('Enter your booking number and phone number.'); er.classList.remove('hidden'); return; }
    er.classList.add('hidden');
    try { localStorage.setItem(isStay(ref) ? 'vs-stay' : 'vs-trip', JSON.stringify({ ref: ref, phone: phone })); } catch (e2) {}
    $('#trip-view').innerHTML = ''; $('#find-form').classList.add('hidden');
    load(ref, phone);
  });

  if (list.length) list.forEach(function (b) { load(b.ref, b.phone); });
  $('#find-form').classList.toggle('hidden', !!list.length);
  $('#find-again').addEventListener('click', function () { $('#find-form').classList.remove('hidden'); $('#find-form').scrollIntoView({ behavior: 'smooth' }); });
});
