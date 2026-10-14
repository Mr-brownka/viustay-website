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

  // Which bookings to show: every booking saved on this phone (vs-bookings), plus the last trip / stay.
  var qref = (params.get('ref') || '').toUpperCase();
  function savedList() {
    var all = (get('vs-bookings') || []).concat([get('vs-stay'), get('vs-trip')]).filter(function (x) { return x && x.ref && x.phone; }), seen = {};
    return all.filter(function (x) { x.ref = String(x.ref).toUpperCase(); if (seen[x.ref]) return false; seen[x.ref] = 1; return true; });
  }
  function remember(ref, phone) {
    var a = (get('vs-bookings') || []).filter(function (x) { return x && x.ref !== ref; }); a.unshift({ ref: ref, phone: phone });
    try { localStorage.setItem('vs-bookings', JSON.stringify(a.slice(0, 12))); } catch (e) {}
  }
  var list = savedList();
  if (qref && !list.filter(function (x) { return x.ref === qref; }).length) { $('#find-form').ref.value = qref; list = []; }

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
  var LISTINGS = null;
  function listings() { if (!LISTINGS) LISTINGS = V.loadListings().catch(function () { return []; }); return LISTINGS; }
  function countdown(date, base) {
    var d = Math.round((new Date(date + 'T00:00:00') - new Date(base + 'T00:00:00')) / 864e5);
    return d === 0 ? T('Today') : d === 1 ? T('Tomorrow') : d > 1 ? T('In {n} days', { n: d }) : '';
  }
  function bigDate(date, base) {
    var d = Math.round((new Date(date + 'T00:00:00') - new Date(base + 'T00:00:00')) / 864e5);
    return d === 0 ? T('Today') : d === 1 ? T('Tomorrow') : V.date(date, { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function sheet(inner) {
    var w = document.createElement('div'); w.className = 'mb-sheet-wrap';
    w.innerHTML = '<div class="mb-scrim" data-close></div><div class="mb-sheet" role="dialog" aria-modal="true"><span class="mb-grab"></span>' + inner + '<button type="button" class="mb-close" data-close>' + T('Close') + '</button></div>';
    document.body.appendChild(w);
    V.$$('[data-close]', w).forEach(function (x) { x.addEventListener('click', function () { w.remove(); }); });
    return w;
  }
  function whenText(t) { return V.date(t.date, { weekday: 'short', day: 'numeric', month: 'short' }) + ', ' + t.slot; }
  function callBtns(t, msg) {
    var num = (V.cfg && V.cfg.WHATSAPP_NUMBER) || '';
    return '<div class="mb-two"><a class="btn btn-dark" target="_blank" rel="noopener" href="' + V.wa(msg) + '">WhatsApp</a>' + (num ? '<a class="btn btn-outline" href="tel:+' + num + '">' + T('Call us') + '</a>' : '') + '</div>';
  }
  function helpSheet(t) {
    sheet('<h2>' + T('Need help?') + '</h2><p>' + T('Booking {ref} · {when}', { ref: V.esc(t.ref), when: V.esc(whenText(t)) }) + '</p>' +
      callBtns(t, 'Hi Viustay, I have a question about my viewing trip ' + t.ref + ' (' + whenText(t) + ').'));
  }
  function changeSheet(t, phone, box) {
    var hrs = t.lock_hours || 36;
    if (!t.can_change) {
      sheet('<h2>' + T('Change or cancel') + '</h2><p>' + T('Your trip is less than {h} hours away and your agent has been told, so changes are made with us directly.', { h: hrs }) + '</p>' +
        callBtns(t, 'Hi Viustay, I need to change my viewing trip ' + t.ref + ' (' + whenText(t) + ').'));
      return;
    }
    var w = sheet('<h2>' + T('Change or cancel') + '</h2><p>' + T('You can do this here until {when}.', { when: V.esc(V.date(t.change_until, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })) }) + '</p>' +
      '<a class="mb-opt" href="book.html?edit=' + encodeURIComponent(t.ref) + '"><b>' + T('Change my trip') + '</b><span>' + T('Day, time, pickup or your details') + '</span></a>' +
      '<button type="button" class="mb-opt mb-cancel"><b>' + T('Cancel my trip') + '</b><span>' + T('No fee: you haven\'t paid anything') + '</span></button>');
    w.querySelector('.mb-cancel').addEventListener('click', function () {
      var sh = w.querySelector('.mb-sheet');
      sh.innerHTML = '<span class="mb-grab"></span><h2>' + T('Cancel this trip?') + '</h2><p>' + T('{when} · pickup near {x}. You can book again any time.', { when: V.esc(whenText(t)), x: V.esc(t.pickup_area) }) + '</p><p class="t-msg"></p>' +
        '<div class="mb-two"><button type="button" class="btn btn-outline mb-yes" style="color:#B3261E;border-color:rgba(179,38,30,.4)">' + T('Yes, cancel trip') + '</button><button type="button" class="btn btn-dark" data-close>' + T('Keep my trip') + '</button></div>';
      V.$$('[data-close]', sh).forEach(function (x) { x.addEventListener('click', function () { w.remove(); }); });
      sh.querySelector('.mb-yes').addEventListener('click', function () {
        var btn = this; btn.disabled = true;
        (V.demo ? Promise.resolve(true) : rpc('cancel_trip', { p_ref: t.ref, p_phone: phone })).then(function () {
          w.remove(); t.status = 'cancelled'; t.can_change = false;
          madeOverlay(T('Trip cancelled'), function () { draw(box, t, phone); });
        }).catch(function (e) {
          btn.disabled = false; var m = sh.querySelector('.t-msg'); m.className = 't-msg bad';
          m.textContent = /locked/.test(e.message || '') ? T('It\'s now less than {h} hours to your trip. Please WhatsApp or call us.', { h: hrs }) : T('Could not cancel. Please try again.');
        });
      });
    });
  }
  function madeOverlay(title, after) {
    var o = document.createElement('div'); o.className = 'mb-made';
    o.innerHTML = '<div class="mb-made-check"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#F4F4F2" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5 10 17l9-10"/></svg></div><h1>' + V.esc(title) + '</h1>';
    document.body.appendChild(o);
    setTimeout(function () { o.classList.add('out'); if (after) after(); setTimeout(function () { o.remove(); }, 400); }, 1800);
  }
  function drawTrip(box, t, phone) {
    var after = !!t.pay_after, base = t.today || today();
    var dead = ['cancelled', 'expired', 'no_show'].indexOf(t.status) >= 0;
    var done = t.status === 'completed';
    var agentReady = t.status === 'confirmed' && !!t.agent;
    var n = done ? 3 : agentReady ? 2 : (t.status === 'confirmed' || t.status === 'paid') ? 1 : 0;
    var isToday = t.date === base;
    var pill = dead ? '<span class="mb-pill bad">' + T(t.status === 'cancelled' ? 'Cancelled' : t.status === 'no_show' ? 'Missed trip' : 'Not paid in time') + '</span>'
      : done ? '<span class="mb-pill ok">' + T('Trip done') + '</span>'
      : isToday && agentReady ? '<span class="mb-pill live"><i></i>' + T('Your agent is ready') + '</span>'
      : '<span class="mb-pill">' + V.esc(countdown(t.date, base) || '') + '</span>';
    var h = backLink() + ticketCard(t, true);
    if (!dead) h += stepList(t);
    if (t.agent) {
      var a = t.agent;
      h += '<div class="mb-agent"><div class="mb-agent-row"><span class="mb-face" style="' + (a.photo_url ? V.photoStyle(a.photo_url) : '') + '">' + (a.photo_url ? '' : V.esc((a.name || '?').charAt(0))) + '</span>' +
        '<div><b>' + V.esc(a.name) + '</b><span>' + V.esc(a.car || '') + '</span>' + (a.plate ? '<span class="t-plate">' + V.esc(a.plate) + '</span>' : '') + '</div></div>' +
        (t.status === 'confirmed' ? '<div class="mb-two"><a class="btn btn-dark" href="tel:+' + intl(a.phone) + '">' + T('Call {name}', { name: V.esc(a.name.split(' ')[0]) }) + '</a><a class="btn btn-outline" target="_blank" rel="noopener" href="https://wa.me/' + intl(a.phone) + '">WhatsApp</a></div>' : '') + '</div>';
    } else if (!dead && !done) {
      h += '<div class="mb-agent empty"><span class="mb-face">?</span><span>' + T('Your agent\'s name, photo and car plate show here <b>the day before</b>.') + '</span></div>';
    }
    h += '<div class="mb-homes"><div class="mb-sub"><span>' + T('Homes, in visiting order') + '</span></div><div class="mb-home-row">' + (t.homes || []).map(function (x, i) {
      return '<a class="mb-home" href="home.html?id=' + encodeURIComponent(x.id) + '" data-hid="' + V.esc(x.id) + '"><span class="ph"><i>' + (i + 1) + '</i></span><span class="tx"><b>' + V.esc(x.title || x.id) + '</b><small>' + V.esc(x.area || '') + (x.rent ? ' · KES ' + V.money(x.rent) : '') + '</small></span></a>';
    }).join('') + '</div></div>';
    var payNow = after && t.status === 'confirmed' && !t.mpesa_code && t.date <= base;
    if (after && !dead && !payNow) {
      h += '<div class="mb-pay' + (t.mpesa_code ? ' paid' : '') + '"><div><b>' + T(t.mpesa_code ? 'Paid' : 'Pay after your viewing') + '</b><span>' +
        (t.mpesa_code ? 'M-Pesa ' + V.esc(t.mpesa_code) : T('Transport {a} + viewing fee {b}', { a: V.money(t.fare), b: V.money(t.viewing_fee) })) + '</span></div><strong>' + kes(t.total) + '</strong></div>';
    } else if (!after && !dead) {
      h += '<div class="mb-pay' + (t.mpesa_code ? ' paid' : '') + '"><div><b>' + T(t.mpesa_code ? 'Paid' : 'Not paid yet') + '</b><span>' + (t.mpesa_code ? 'M-Pesa ' + V.esc(t.mpesa_code) : '') + '</span></div><strong>' + kes(t.total) + '</strong></div>';
    }
    if (t.status === 'awaiting_payment') {
      try { localStorage.setItem('vs-trip', JSON.stringify({ ref: t.ref, phone: phone, total: t.total, expires_at: t.expires_at, date: t.date, slot: t.slot, pickup: t.pickup_area })); } catch (e) {}
      h += '<div class="t-card"><p style="margin:0">' + T('Your slot is held until you pay. Pay by M-Pesa and enter the confirmation code.') + '</p><div><a class="btn btn-primary" href="book.html?pay=1">' + T('Finish paying') + '</a></div></div>';
    }
    if (after && t.status === 'confirmed' && !t.mpesa_code && t.date <= base) {
      h += '<form class="t-card pay-after-form"><strong style="font-size:17px">' + T('Pay after your viewing') + '</strong>' +
        (t.till ? '<ol class="t-steps"><li><span>' + T('Open <strong>M-Pesa</strong> and go to <b>Lipa na M-Pesa → Buy Goods and Services</b>.') + '</span></li><li><span>' + T('Till number:') + ' <strong>' + V.esc(t.till) + '</strong> ' + (t.pay_name ? '<span class="note">(' + V.esc(t.pay_name) + ')</span>' : '') + '</span></li><li><span>' + T('Amount:') + ' <strong>' + kes(t.total) + '</strong></span></li></ol>'
          : '<span>' + T('Your agent will show you how to pay {x} by M-Pesa.', { x: kes(t.total) }) + '</span>') +
        '<label class="field">' + T('M-Pesa confirmation code') + '<input name="mpesa" autocomplete="off" autocapitalize="characters" maxlength="14" placeholder="e.g. SJK3ABCD12"></label><p class="t-msg"></p><div><button class="btn btn-primary" type="submit">' + T('I\'ve paid') + '</button></div></form>';
    }
    if (t.code) h += '<div class="t-code"><span>' + T('Your trip code') + '</span><b>' + V.esc(t.code) + '</b><span>' + T('Give this code to your agent at the <strong>end</strong> of your trip, not before.') + '</span></div>';
    if (done && !t.rating) h += rateForm('How was your agent?');
    else if (t.rating) h += '<div class="t-card"><span>' + T('Thanks for your rating') + ' ' + '★★★★★'.slice(0, t.rating) + '</span></div>';
    h += '<div class="mb-actions">' + (!dead && !done ? '<button type="button" class="btn btn-dark mb-change">' + T('Change booking') + '</button>' : '') + '<button type="button" class="btn btn-outline mb-help">' + T('Need help?') + '</button></div>';
    if (!dead && !done && t.can_change !== undefined) h += '<p class="mb-lock">' + (t.can_change ? T('Change or cancel in the app up to {h} hours before your trip.', { h: t.lock_hours || 36 }) : T('Less than {h} hours to go: changes are made with us on WhatsApp or by phone.', { h: t.lock_hours || 36 })) + '</p>';
    box.innerHTML = h; box.classList.add('mb-view'); rating(box, 'trip', t, phone);
    var ch = box.querySelector('.mb-change'); if (ch) ch.addEventListener('click', function () { changeSheet(t, phone, box); });
    box.querySelector('.mb-help').addEventListener('click', function () { helpSheet(t); });
    // home photos from the listings sheet
    listings().then(function (all) {
      V.$$('.mb-home', box).forEach(function (el) {
        var l = all.filter(function (x) { return x.id === el.getAttribute('data-hid'); })[0];
        if (l && l.photoList && l.photoList[0]) { var ph = el.querySelector('.ph'); ph.setAttribute('style', V.photoStyle(l.photoList[0])); ph.classList.add('has'); }
      });
    });
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
  function drawStay(box, s, phone) {
    var dead = ['cancelled', 'expired'].indexOf(s.status) >= 0, paid = ['paid', 'confirmed', 'checked_in', 'completed'].indexOf(s.status) >= 0;
    var h = backLink() + ticketCard(s, true);
    if (paid && s.status !== 'completed') h += '<button type="button" class="btn btn-primary mb-show">☀ ' + T('Show ticket at reception') + '</button>';
    if (!dead) h += stepList(s);
    if (s.status === 'awaiting_payment') {
      h += '<div class="t-card"><p style="margin:0">' + T('Your dates are held until you pay.') + '</p><div><a class="btn btn-primary" href="stay.html?id=' + encodeURIComponent(s.listing_id) + '&pay=1">' + T('Finish paying') + '</a></div></div>';
    }
    if (paid && s.status !== 'completed') {
      h += '<div class="mb-ci"><b>' + T('Your check-in details') + '</b>' + (s.checkin_info ? '<div class="t-info">' + V.esc(s.checkin_info) + '</div>' :
        '<ul><li><i class="ic-pin"></i><span>' + T('Exact address & gate') + '</span><em>' + T('the day before') + '</em></li><li><i class="ic-user"></i><span>' + T('Caretaker & keys') + '</span><em>' + T('the day before') + '</em></li><li><i class="ic-wifi"></i><span>' + T('Wi-Fi name & password') + '</span><em>' + T('at check-in') + '</em></li></ul>') + '</div>';
    }
    if ((s.status === 'checked_in' || s.status === 'confirmed') && s.check_out === today()) h += '<p class="t-warn">' + T('Check-out is today by {t}. Leave the keys as agreed with the caretaker. Safe travels!', { t: s.check_out_time || '11:00 AM' }) + '</p>';
    h += '<a class="mb-place" href="home.html?id=' + encodeURIComponent(s.listing_id) + '" data-hid="' + V.esc(s.listing_id) + '"><span class="ph"></span><span class="tx"><b>' + V.esc(s.title || s.listing_id) + '</b><small>' + V.esc(s.area || '') + (s.mpesa_code ? ' · ' + T('Paid') + ' · M-Pesa ' + V.esc(s.mpesa_code) : '') + '</small></span></a>';
    if ((s.status === 'completed' || s.status === 'checked_in') && !s.rating) h += rateForm('How was your stay?');
    else if (s.rating) h += '<div class="t-card"><span>' + T('Thanks for your rating') + ' ' + '★★★★★'.slice(0, s.rating) + '</span></div>';
    h += '<div class="mb-two">' + (paid ? '<button type="button" class="btn btn-outline mb-mail">' + T('Email my ticket') + '</button>' : '') +
      (s.checkin_info ? '<a class="btn btn-outline" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent((s.title || '') + ' ' + (s.area || '') + ' Nairobi') + '">' + T('Directions') + '</a>' : '') + '</div>' +
      '<p class="note hidden mb-mailnote" role="status">' + T('Email tickets are coming soon. For now, tap "Show ticket at reception" when you arrive.') + '</p>' +
      '<p class="mb-helpline">' + T('Need help?') + ' <a target="_blank" rel="noopener" href="' + V.wa('Hi Viustay, I\'m a guest on stay ' + s.ref + ': ') + '">' + T('Chat on WhatsApp') + '</a></p>';
    box.innerHTML = h; box.classList.add('mb-view'); rating(box, 'stay', s, phone);
    var sh = box.querySelector('.mb-show'); if (sh) sh.addEventListener('click', function () { V.Ticket.show(Object.assign({ phone: phone }, s)); });
    var ml = box.querySelector('.mb-mail'); if (ml) ml.addEventListener('click', function () { box.querySelector('.mb-mailnote').classList.remove('hidden'); });
    listings().then(function (all) {
      var l = all.filter(function (x) { return x.id === s.listing_id; })[0], ph = box.querySelector('.mb-place .ph');
      if (l && l.photoList && l.photoList[0] && ph) ph.setAttribute('style', V.photoStyle(l.photoList[0]));
    });
  }

  // ---------- one ticket card for both kinds (item 21) ----------
  function kindOf(b) { return b.kind === 'stay' || isStay(b.ref) ? 'stay' : 'trip'; }
  function info(b) {
    var base = b.today || today(), k = kindOf(b);
    if (k === 'stay') {
      var dead = ['cancelled', 'expired'].indexOf(b.status) >= 0, done = b.status === 'completed';
      var reach = { awaiting_payment: 1, paid: 2, confirmed: b.checkin_info ? 4 : 3, checked_in: 5, completed: 5 }[b.status] || 1;
      var paidS = ['paid', 'confirmed', 'checked_in', 'completed'].indexOf(b.status) >= 0;
      var next = b.status === 'awaiting_payment' ? T('Waiting for payment · finish paying') : b.status === 'paid' ? T('Paid · we\'re confirming with the host')
        : b.status === 'confirmed' ? (b.checkin_info ? T('Your check-in details are ready') : T('Confirmed · check-in details come the day before'))
        : b.status === 'checked_in' ? T('Checked in · enjoy your stay') : done ? T('Stay complete') : T(b.status === 'expired' ? 'Not paid in time' : 'Cancelled');
      return { k: k, dead: dead, done: done, date: b.check_in, time: b.check_in_time || '2:00 PM', reach: reach, steps: 5, next: next,
        l1: b.title || b.listing_id, l2: [b.area, T(b.nights === 1 ? '{n} night' : '{n} nights', { n: b.nights }), T(b.guests === 1 ? '{n} guest' : '{n} guests', { n: b.guests })].filter(Boolean).join(' · '),
        r1: paidS ? T('Paid') : T('Not paid yet'), r2: kes(b.total), label: T('Short stay'), base: base };
    }
    var deadT = ['cancelled', 'expired', 'no_show'].indexOf(b.status) >= 0, doneT = b.status === 'completed', ready = b.status === 'confirmed' && !!b.agent;
    var reachT = doneT ? 4 : ready ? 3 : b.status === 'confirmed' ? 2 : 1;
    var nextT = deadT ? T(b.status === 'cancelled' ? 'Cancelled' : b.status === 'no_show' ? 'Missed trip' : 'Not paid in time') : doneT ? T('Trip done') : ready ? T('{name} is your agent', { name: b.agent.name.split(' ')[0] })
      : b.status === 'confirmed' ? T('Confirmed · your agent shows here the day before') : T('Booked · we\'re checking the homes are still free');
    var nh = (b.homes || []).length;
    return { k: 'trip', dead: deadT, done: doneT, date: b.date, time: b.slot, reach: reachT, steps: 4, next: nextT,
      l1: T('Pickup: near {x}', { x: b.pickup_area }), l2: [(b.pickup_note || '').trim(), T(nh === 1 ? '{n} home' : '{n} homes', { n: nh })].filter(Boolean).join(' · '),
      r1: b.mpesa_code ? T('Paid') : b.pay_after ? T('Pay after') : T('Not paid yet'), r2: kes(b.total), label: T('Viewing trip'), base: base };
  }
  function ticketCard(b, big) {
    var x = info(b), cd = countdown(x.date, x.base);
    var pill = x.dead ? '<span class="mb-pill bad">' + V.esc(x.next) + '</span>' : x.done ? '<span class="mb-pill ok">' + V.esc(x.next) + '</span>' : cd ? '<span class="mb-pill">' + V.esc(cd) + '</span>' : '';
    var bar = ''; for (var i = 0; i < x.steps; i++) bar += '<i class="' + (i < x.reach ? 'on' : '') + '"></i>';
    var icon = x.k === 'stay' ? '<svg viewBox="0 0 24 24"><path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M5 16V11l2-5h10l2 5v5M3 16h18M7 19v-3M17 19v-3"/></svg>';
    return '<div class="mb-tk ' + x.k + (big ? ' big' : '') + (x.dead ? ' dead' : '') + '">' +
      '<div class="mb-tk-top"><span class="mb-kind"><i>' + icon + '</i>' + V.esc(x.label) + ' · ' + V.esc(b.ref) + '</span>' + pill + '</div>' +
      '<div class="mb-tk-when"><b>' + V.esc(bigDate(x.date, x.base)) + '</b><span>' + V.esc(x.time || '') + '</span></div>' +
      '<div class="mb-tk-cut"></div>' +
      '<div class="mb-tk-foot"><span><b>' + V.esc(x.l1) + '</b><em>' + V.esc(x.l2) + '</em></span><span class="r"><b>' + V.esc(x.r1) + '</b><em>' + V.esc(x.r2) + '</em></span></div>' +
      (x.dead ? '' : '<div class="mb-tk-bar">' + bar + '</div>') + '</div>';
  }
  function stepList(b) {
    var x = info(b), labels = x.k === 'stay' ? ['Booked', 'Paid', 'Confirmed', 'Check-in details', 'Checked in'] : ['Booked', 'Homes confirmed', 'Agent ready', 'Trip done'];
    var sub = x.k === 'stay' ? ['', b.total ? kes(b.total) : '', T('by Viustay'), b.checkin_info ? T('ready') : T('the day before'), V.date(b.check_in, { weekday: 'short', day: 'numeric' }) + ' · ' + (b.check_in_time || '')]
      : ['', T('by Viustay'), b.agent ? b.agent.name.split(' ')[0] : T('the day before'), b.pay_after ? T('pay after') : ''];
    return '<ol class="mb-stepl">' + labels.map(function (l, i) {
      var st = i < x.reach ? 'on' : i === x.reach && !x.done ? 'now' : '';
      return '<li class="' + st + '"><i></i><b>' + T(l) + '</b><span>' + V.esc(sub[i] || '') + '</span></li>';
    }).join('') + '</ol><p class="mb-next">' + V.esc(x.next) + '</p>';
  }
  function backLink() { return '<a class="mb-back" href="#">‹ ' + T('My bookings') + '</a>'; }

  function draw(box, b, phone) { if (b.kind === 'stay' || isStay(b.ref)) drawStay(box, b, phone); else drawTrip(box, b, phone); }

  function demoData(ref) {
    if (isStay(ref)) return { ref: ref, kind: 'stay', status: 'confirmed', listing_id: 'VS-102', title: '1 bedroom, Off Waiyaki Way', area: 'Westlands', guests: 2, nights: 3,
      check_in: today(), check_out: today(), check_in_time: '2:00 PM', check_out_time: '11:00 AM', total: 25000, mpesa_code: 'QWE123RTY9', checkin_info: 'Sarit View Apartments, Block B, 6th floor.\nCaretaker: John, 0712 000 000.' };
    return { ref: ref, status: 'confirmed', date: today(), slot: '9:00 AM', pickup_area: 'South B', pickup_note: 'Gate B', homes: [{ id: 'VS-001', title: '1 bedroom, Argwings Kodhek Rd', area: 'Kilimani', rent: 38000 }], fare: 1600, viewing_fee: 950,
      total: 2550, pay_after: true, till: '123456', pay_name: 'Viustay', agent: { name: 'Hassan Ali', phone: '0712345678', car: 'Toyota Axio, silver', plate: 'KDA 123A' } };
  }
  // ---------- list of bookings + one booking opened ----------
  var data = {}, filter = 'all';
  function fetchOne(ref, phone) {
    if (V.demo) return Promise.resolve(demoData(ref));
    return rpc(isStay(ref) ? 'lookup_stay' : 'lookup_trip', { p_ref: ref, p_phone: phone });
  }
  function drawList() {
    var view = $('#trip-view'), refs = list.map(function (x) { return x.ref; }).filter(function (r) { return data[r]; });
    var items = refs.map(function (r) { return data[r]; });
    var kinds = {}; items.forEach(function (b) { kinds[kindOf(b)] = 1; });
    var both = kinds.stay && kinds.trip;
    if (!both) filter = 'all';
    var show = items.filter(function (b) { return filter === 'all' || kindOf(b) === filter; });
    var act = show.filter(function (b) { var x = info(b); return !x.dead && !x.done; }).sort(function (p, q) { return info(p).date < info(q).date ? -1 : 1; });
    var past = show.filter(function (b) { var x = info(b); return x.dead || x.done; });
    var h = '';
    if (both) h += '<div class="mb-chips" role="group" aria-label="' + T('Show') + '">' + [['all', T('All') + ' · ' + items.length], ['stay', T('Short stays')], ['trip', T('Viewing trips')]].map(function (c) {
      return '<button type="button" class="mb-chip ' + c[0] + (filter === c[0] ? ' on' : '') + '" data-f="' + c[0] + '" aria-pressed="' + (filter === c[0]) + '"><i></i>' + V.esc(c[1]) + '</button>';
    }).join('') + '</div>';
    if (act.length) h += '<p class="mb-kick">' + T('Coming up · soonest first') + '</p>';
    h += act.map(function (b, i) { var x = info(b); return '<a class="mb-item" href="#' + V.esc(b.ref) + '" style="--d:' + (i * .08).toFixed(2) + 's">' + ticketCard(b) + '<span class="mb-nextl ' + x.k + '">' + V.esc(x.next) + ' →</span></a>'; }).join('');
    if (!act.length && items.length) h += '<p class="mb-empty">' + T('No upcoming bookings.') + ' <a href="index.html">' + T('Find a home') + '</a></p>';
    if (past.length) h += '<details class="mb-past"><summary><b>' + T('Past bookings') + '</b> · ' + past.length + '</summary>' + past.map(function (b) { return '<a class="mb-item" href="#' + V.esc(b.ref) + '">' + ticketCard(b) + '</a>'; }).join('') + '</details>';
    h += '<a class="mb-helprow" target="_blank" rel="noopener" href="' + V.wa('Hi Viustay, I have a question about my booking.') + '"><svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 10h8"/></svg><span><b>' + T('Need help?') + '</b> ' + T('We reply on WhatsApp') + '</span><b>' + T('Chat') + '</b></a>';
    view.innerHTML = h; view.classList.remove('hidden');
    V.$$('.mb-chip', view).forEach(function (c) { c.addEventListener('click', function () { filter = c.getAttribute('data-f'); drawList(); }); });
  }
  function openOne(ref) {
    var b = data[ref], e = list.filter(function (x) { return x.ref === ref; })[0];
    if (!b || !e) return false;
    var view = $('#trip-view'); view.innerHTML = '';
    var box = document.createElement('div'); box.className = 'stack-sm mb-detail'; box.style.gap = '14px'; view.appendChild(box);
    draw(box, b, e.phone);
    var back = box.querySelector('.mb-back'); if (back) back.addEventListener('click', function (ev) { ev.preventDefault(); history.pushState(null, '', location.pathname); route(); });
    window.scrollTo(0, 0);
    return true;
  }
  function route() {
    var ref = decodeURIComponent((location.hash || '').slice(1)).toUpperCase();
    if (ref && openOne(ref)) return;
    drawList();
  }
  window.addEventListener('hashchange', route);
  var sig = '';
  function loadAll(quiet) {
    if (!list.length) return Promise.resolve();
    if (!quiet) { $('#trip-view').innerHTML = V.skel.rows(2); $('#trip-view').classList.remove('hidden'); }
    return Promise.all(list.map(function (e) {
      return fetchOne(e.ref, e.phone).then(function (b) { data[e.ref] = b; }).catch(function (err) {
        console.error(err); if (/not_found/.test((err && err.message) || '')) list = list.filter(function (x) { return x.ref !== e.ref; });
      });
    })).then(function () {
      var now = JSON.stringify(data);
      if (quiet && now === sig) return;   // nothing changed: leave the screen alone
      var open = document.activeElement && document.activeElement.closest && document.activeElement.closest('form');
      if (quiet && open) return;          // don't redraw while they're typing
      sig = now;
      if (!list.length) { $('#trip-view').classList.add('hidden'); $('#find-form').classList.remove('hidden'); return; }
      route();
    });
  }
  // Updates show by themselves (item 22): every 30 s while open, and when the app comes back to the front.
  setInterval(function () { if (document.visibilityState === 'visible') loadAll(true); }, 30000);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') loadAll(true); });
  window.addEventListener('vs-refresh', function (e) { e.preventDefault && e.preventDefault(); loadAll(true); });

  $('#find-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var ref = e.target.ref.value.trim().toUpperCase(), phone = e.target.phone.value.trim(), er = $('#find-error');
    if (!ref || !V.phoneOk(phone)) { er.textContent = T('Enter your booking number and phone number.'); er.classList.remove('hidden'); return; }
    er.classList.add('hidden');
    var btn = e.target.querySelector('button'); btn.disabled = true;
    fetchOne(ref, phone).then(function (b) {
      remember(ref, phone); data[ref] = b;
      list = list.filter(function (x) { return x.ref !== ref; }); list.unshift({ ref: ref, phone: phone });
      $('#find-form').classList.add('hidden'); sig = JSON.stringify(data);
      if (location.hash === '#' + ref) route(); else location.hash = ref;
    }).catch(function (err) {
      er.textContent = /not_found/.test((err && err.message) || '') ? T('We couldn\'t find that booking. Check the number and phone, or WhatsApp us.') : T('Could not load your booking. Please try again.');
      er.classList.remove('hidden');
    }).then(function () { btn.disabled = false; });
  });

  list.forEach(function (x) { remember(x.ref, x.phone); });
  if (qref && list.filter(function (x) { return x.ref === qref; }).length && !location.hash) history.replaceState(null, '', '#' + qref);
  loadAll(false);
  $('#find-form').classList.toggle('hidden', !!list.length);
  $('#find-again').addEventListener('click', function () { $('#find-form').classList.remove('hidden'); $('#find-form').scrollIntoView({ behavior: 'smooth' }); });
});
