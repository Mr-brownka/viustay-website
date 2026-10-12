// v2 booking: pickup estate (or phone location), open slots, live price, M-Pesa payment, trip code.
document.addEventListener('DOMContentLoaded', function () {
  var V = window.V, T = V.Trip;
  var $ = V.$;
  var search = V.getSearch();
  var params = new URLSearchParams(location.search);
  var ids = params.get('id') ? [params.get('id')] : (search.picked || []);
  var S = T.DEFAULTS, homes = [], slotData = null, quote = null;
  var pick = { day: null, slot: null, pickup: null };
  var STORE = 'vs-trip';

  function store(o) { try { localStorage.setItem(STORE, JSON.stringify(o)); } catch (e) {} }
  function stored() { try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { return null; } }
  function kes(n) { return 'KES ' + V.money(n); }
  function dayFmt(iso) { return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); }
  function showErr(el, t) { el.textContent = t || ''; el.classList.toggle('hidden', !t); }
  function chip(label, on, disabled, fn) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'chip square'; b.textContent = label;
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (disabled) b.disabled = true; else b.addEventListener('click', fn);
    return b;
  }
  function flash(el, text) { if (el.textContent === text) return; el.textContent = text; el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  function rpc(name, args) {
    return V.ensureDb().then(function (db) { return db.rpc(name, args || {}); }).then(function (r) { if (r.error) throw r.error; return r.data; });
  }
  var ERR = {
    slot_full: 'Sorry, that time was just taken. Please pick another time.',
    bad_date: 'That day is no longer open. Please pick another day.',
    bad_slot: 'Please pick a time.', bad_pickup: 'Please choose your estate.', bad_phone: 'Please enter a valid M-Pesa number.',
    bad_name: 'Please enter your name.', bad_homes: 'Pick 1 to 3 homes first.', bad_distance: 'We could not work out the trip. Please choose your estate again.',
    bad_mpesa: 'That doesn\'t look like an M-Pesa code. It\'s 10 letters and numbers, like SJK3ABCD12.',
    not_found: 'We couldn\'t find that booking. Please WhatsApp us.', not_open: 'This booking can\'t take a payment any more. Please WhatsApp us.'
  };
  function errText(e) { var m = (e && e.message) || ''; var k = Object.keys(ERR).filter(function (x) { return m.indexOf(x) >= 0; })[0]; return k ? ERR[k] : 'Something went wrong. Please try again or WhatsApp us.'; }

  // ---------- slots ----------
  function localSlots() {
    var now = new Date(), cut = String(S.cutoff || '18:00').split(':');
    var d = new Date(); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + ((now.getHours() * 60 + now.getMinutes()) < (+cut[0] * 60 + +(cut[1] || 0)) ? 1 : 2));
    var days = [];
    while (days.length < S.days_ahead) {
      if ((S.closed_days || []).indexOf(d.getDay()) < 0) {
        var iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        days.push({ day: iso, slots: S.slots.map(function (s) { return { slot: s, open: true }; }) });
      }
      d.setDate(d.getDate() + 1);
    }
    return { agents: -1, days: days };
  }
  function loadSlots() {
    if (V.demo) return Promise.resolve(localSlots());
    return rpc('trip_slots').catch(function (e) { console.warn('slots', e); return localSlots(); });
  }

  function renderSlots() {
    var dBox = $('#day-chips'), tBox = $('#time-chips');
    dBox.innerHTML = ''; tBox.innerHTML = '';
    if (!slotData || slotData.agents === 0) {
      dBox.innerHTML = '<p class="t-rule" style="margin:0">Viewing trips open soon: no agents are free yet. <a href="' + V.wa('Hi Viustay, I would like to book a viewing trip.') + '" target="_blank" rel="noopener">WhatsApp us</a> and we\'ll arrange it.</p>';
      return;
    }
    slotData.days.forEach(function (d) {
      var any = d.slots.some(function (x) { return x.open; });
      dBox.appendChild(chip(dayFmt(d.day) + (any ? '' : ' · Full'), d.day === pick.day, !any, function () { pick.day = d.day; pick.slot = null; firstOpenSlot(); renderSlots(); update(); }));
    });
    var day = slotData.days.filter(function (d) { return d.day === pick.day; })[0];
    (day ? day.slots : []).forEach(function (x) {
      tBox.appendChild(chip(x.slot + (x.open ? '' : ' · Full'), x.slot === pick.slot, !x.open, function () { pick.slot = x.slot; renderSlots(); update(); }));
    });
  }
  function firstOpenSlot() {
    var day = slotData && slotData.days.filter(function (d) { return d.day === pick.day; })[0];
    var open = day ? day.slots.filter(function (x) { return x.open; })[0] : null;
    pick.slot = open ? open.slot : null;
  }
  function firstOpenDay() {
    var d = slotData && slotData.days.filter(function (x) { return x.slots.some(function (y) { return y.open; }); })[0];
    pick.day = d ? d.day : null; firstOpenSlot();
  }

  // ---------- pickup ----------
  function setPickup(name) {
    pick.pickup = S.pickups.filter(function (p) { return p.name === name; })[0] || null;
    $('#pickup').value = pick.pickup ? pick.pickup.name : '';
    try { if (pick.pickup) localStorage.setItem('vs-pickup', pick.pickup.name); } catch (e) {}
    update();
  }
  $('#pickup').addEventListener('change', function (e) { $('#loc-hint').textContent = ''; setPickup(e.target.value); });
  $('#use-loc').addEventListener('click', function () {
    var btn = $('#use-loc'), hint = $('#loc-hint');
    if (!navigator.geolocation) { hint.textContent = 'This phone can\'t share its location. Please pick your estate from the list.'; return; }
    btn.disabled = true; hint.textContent = 'Finding you…';
    navigator.geolocation.getCurrentPosition(function (pos) {
      btn.disabled = false;
      var n = T.nearestPickup(pos.coords.latitude, pos.coords.longitude, S.pickups);
      if (!n) { hint.textContent = 'Please pick your estate from the list.'; return; }
      if (n.km > 15) { hint.textContent = 'You seem to be outside Nairobi (the nearest estate we cover is ' + n.pickup.name + ', ' + Math.round(n.km) + ' km away). Please pick your estate from the list.'; return; }
      setPickup(n.pickup.name);
      hint.textContent = 'Nearest estate: ' + n.pickup.name + ' (' + (n.km < 1 ? 'under 1 km' : 'about ' + n.km.toFixed(1) + ' km') + ' from you). Not right? Pick another from the list.';
    }, function () {
      btn.disabled = false;
      hint.textContent = 'Location is off, so please pick your estate from the list. We don\'t save your location.';
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  });

  // ---------- price + summary ----------
  function miniCard(l) {
    return '<a class="mini" href="home.html?id=' + encodeURIComponent(l.id) + '"><span class="thumb" style="' + V.photoStyle(l.photoList[0]) + '"></span>' +
      '<span><span style="font-weight:600">' + V.esc(l.title) + '</span><small>' + V.esc(l.area || '') + ' · KES ' + V.money(l.rent) + ' / mo</small></span></a>';
  }
  function update() {
    $('#book-when').textContent = pick.day && pick.slot ? dayFmt(pick.day) + ', ' + pick.slot : '–';
    quote = pick.pickup && homes.length ? T.quote(pick.pickup, homes, S) : null;
    var list = quote ? quote.order : homes;
    $('#book-homes').innerHTML = list.length ? list.map(miniCard).join('') :
      '<p style="margin:0">No homes picked yet. <a href="matches.html">Pick homes</a> or <a href="homes.html">browse all</a>.</p>';
    if (quote) {
      $('#t-route').innerHTML = '<span><b>' + V.esc(pick.pickup.name) + '</b> → ' + homes.length + (homes.length === 1 ? ' home' : ' homes') + (S.return_trip ? ' → back to ' + V.esc(pick.pickup.name) : '') + '</span>' +
        '<span>About ' + quote.km + ' km · ' + T.mins(quote.drive_min) + ' driving + ' + T.mins(quote.wait_min) + ' at viewings</span>';
      flash($('#p-fare'), kes(quote.fare)); flash($('#p-fee'), kes(quote.viewing_fee)); flash($('#p-total'), kes(quote.total));
      $('#p-note').textContent = (quote.guess ? 'Some homes\' exact spots are estimated. ' : '') + 'You pay by M-Pesa on the next step.';
      $('#book-submit').textContent = 'Continue to payment · ' + kes(quote.total);
    } else {
      $('#t-route').innerHTML = ''; $('#p-fare').textContent = '–'; $('#p-total').textContent = '–'; $('#p-fee').textContent = kes(S.viewing_fee);
      $('#book-submit').textContent = 'Continue to payment';
    }
    $('#book-submit').disabled = !homes.length || !slotData || slotData.agents === 0;
  }

  // ---------- payment screen ----------
  var timer = null;
  function showPay(t) {
    $('#book-form-wrap').classList.add('hidden'); $('#book-done').classList.add('hidden'); $('#pay-wrap').classList.remove('hidden');
    $('#pay-ref').textContent = t.ref;
    $('#pay-total').textContent = kes(t.total); $('#pay-amount').textContent = kes(t.total);
    $('#pay-till').textContent = S.till || '[TILL NUMBER]';
    $('#pay-name').textContent = S.pay_name ? '(' + S.pay_name + ')' : '';
    $('#pay-help').href = V.wa('Hi Viustay, I need help paying for booking ' + t.ref + '.');
    clearInterval(timer);
    function tick() {
      var left = Math.max(0, Math.round((new Date(t.expires_at) - Date.now()) / 1000));
      $('#pay-timer').innerHTML = left ? 'We\'re holding your slot for <b>' + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0') + '</b>.' :
        'Your slot is no longer held, but you can still pay: we\'ll keep it if it\'s free.';
      if (!left) clearInterval(timer);
    }
    tick(); timer = setInterval(tick, 1000);
    window.scrollTo(0, 0);
    setTimeout(function () { $('#pay-form').mpesa.focus(); }, 100);
  }
  $('#pay-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var t = stored(), code = e.target.mpesa.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase(), err = $('#pay-error');
    showErr(err);
    if (!t) { showErr(err, ERR.not_found); return; }
    if (!/^[A-Z0-9]{8,12}$/.test(code)) { showErr(err, ERR.bad_mpesa); return; }
    var btn = $('#pay-submit'); btn.disabled = true; btn.textContent = 'Checking…';
    var p = V.demo ? Promise.resolve({ ok: true, code: String(Math.floor(1000 + Math.random() * 9000)) }) : rpc('submit_payment', { p_ref: t.ref, p_phone: t.phone, p_mpesa: code });
    p.then(function (r) {
      t.paid = true; store(t);
      clearInterval(timer);
      $('#pay-wrap').classList.add('hidden'); $('#book-done').classList.remove('hidden');
      $('#done-code').textContent = r.code;
      $('#done-text').textContent = dayFmt(t.date) + ' at ' + t.slot + ', pickup in ' + t.pickup + '. Booking ' + t.ref + '.';
      $('#done-trip').href = 'trip.html?ref=' + encodeURIComponent(t.ref);
      $('#done-wa').href = V.wa('Hi Viustay, I just paid for viewing trip ' + t.ref + ' (M-Pesa ' + code + ').');
      search.picked = []; V.setSearch(search);
      window.scrollTo(0, 0);
    }).catch(function (e2) {
      console.error(e2); showErr(err, errText(e2));
    }).then(function () { btn.disabled = false; btn.textContent = 'Confirm payment'; });
  });

  // ---------- booking ----------
  $('#book-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, err = $('#book-error');
    showErr(err);
    var name = f.name.value.trim(), phone = f.phone.value.trim();
    var problem = !homes.length ? ERR.bad_homes : !pick.pickup ? ERR.bad_pickup : !pick.day ? 'Please pick a day.' : !pick.slot ? ERR.bad_slot :
      !name ? ERR.bad_name : !V.phoneOk(phone) ? ERR.bad_phone : !f.consent.checked ? 'Please tick the box to agree.' : '';
    if (problem) { showErr(err, problem); return; }
    var btn = $('#book-submit'); btn.disabled = true; btn.textContent = 'Holding your slot…';
    var payload = {
      name: name, phone: phone, date: pick.day, slot: pick.slot, pickup_area: pick.pickup.name, pickup_note: f.pickup_note.value.trim(),
      distance_km: quote.km, search: search,
      homes: quote.order.map(function (l) { return { id: l.id, title: l.title, area: l.area, rent: l.rent, building_code: l.building_code || null }; })
    };
    var p = V.demo ? Promise.resolve({ ref: 'VS-DEMO' + Math.floor(Math.random() * 90 + 10), total: quote.total, expires_at: new Date(Date.now() + S.pay_window_min * 60000).toISOString() })
      : rpc('create_trip', { p: payload });
    p.then(function (r) {
      var t = { ref: r.ref, phone: phone, total: r.total, expires_at: r.expires_at, date: pick.day, slot: pick.slot, pickup: pick.pickup.name };
      store(t); showPay(t);
    }).catch(function (e2) {
      console.error(e2); showErr(err, errText(e2));
      if (/slot_full|bad_date/.test(e2.message || '')) loadSlots().then(function (d) { slotData = d; firstOpenDay(); renderSlots(); update(); });
      btn.disabled = false; update();
    });
  });

  // ---------- start ----------
  $('#rule-text').textContent = 'Free cancellation until ' + (function (c) { var h = +String(c).split(':')[0]; return (h % 12 || 12) + (h < 12 ? ' am' : ' pm'); })(S.cutoff) + ' the evening before. After that, the viewing fee isn\'t refunded.';
  Promise.all([V.loadListings(), T.loadSettings(), loadSlots()]).then(function (res) {
    S = res[1]; slotData = res[2];
    homes = res[0].filter(function (l) { return ids.indexOf(l.id) >= 0; });
    var sel = $('#pickup');
    S.pickups.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).forEach(function (p) {
      var o = document.createElement('option'); o.value = p.name; o.textContent = p.name; sel.appendChild(o);
    });
    var last = null; try { last = localStorage.getItem('vs-pickup'); } catch (e) {}
    if (last) setPickup(last);
    $('#rule-text').textContent = $('#rule-text').textContent.replace(/until .* the evening/, 'until ' + (function (c) { var h = +String(c).split(':')[0]; return (h % 12 || 12) + (h < 12 ? ' am' : ' pm'); })(S.cutoff) + ' the evening');
    firstOpenDay(); renderSlots(); update();
    // Came back to finish paying
    var t = stored();
    if (params.get('pay') && t && !t.paid) showPay(t);
  }).catch(function (e) { console.error(e); showErr($('#book-error'), 'The booking page could not load. Please refresh.'); });
});
