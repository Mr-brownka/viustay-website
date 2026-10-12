// v2 booking: one screen at a time. Intro -> pickup pin -> day & time -> who -> fee sheet -> booked.
// Nothing is paid now: the client pays by M-Pesa when the trip ends.
document.addEventListener('DOMContentLoaded', function () {
  var V = window.V, T = V.Trip, t_ = V.t, $ = V.$;
  var search = V.getSearch();
  var params = new URLSearchParams(location.search);
  var ids = params.get('id') ? [params.get('id')] : (search.picked || []);
  var S = T.DEFAULTS, homes = [], cal = null, quote = null;
  var pick = { lat: null, lng: null, area: null, acc: null, how: null, day: null, slot: null };
  var NAIROBI = [-1.2864, 36.8172];
  var map = null, mapMode = false, step = null, introDone = false, dataReady = false;
  var PEOPLE = 'vs-people';

  function kes(n) { return 'KES ' + V.money(n); }
  function showErr(el, t) { el.textContent = t || ''; el.classList.toggle('hidden', !t); }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function dayObj(s) { return new Date(s + 'T00:00:00'); }
  function wd(s) { return V.date(s, { weekday: 'short' }); }
  function dayLong(s) { return V.date(s, { weekday: 'short', day: 'numeric', month: 'short' }); }
  function rpc(name, args) {
    return V.ensureDb().then(function (db) { return db.rpc(name, args || {}); }).then(function (r) { if (r.error) throw r.error; return r.data; });
  }
  function getLS(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function setLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var ERR = {
    slot_full: 'Sorry, that time was just taken. Please pick another time.',
    bad_date: 'That day is no longer open. Please pick another day.',
    bad_slot: 'Please pick a time.', bad_pickup: 'Please set your pickup spot again.', bad_phone: 'Please enter a valid phone number.',
    bad_name: 'Please enter your name.', bad_homes: 'Pick 1 to 3 homes first.', bad_distance: 'We could not work out the trip. Please set your pickup spot again.'
  };
  function errText(e) { var m = (e && e.message) || ''; var k = Object.keys(ERR).filter(function (x) { return m.indexOf(x) >= 0; })[0]; return t_(k ? ERR[k] : 'Something went wrong. Please try again or WhatsApp us.'); }

  // ---------- screens ----------
  var SCREENS = { pickup: '#s-pickup', when: '#s-when', who: '#s-who', done: '#s-done', empty: '#s-empty' };
  var ORDER = ['pickup', 'when', 'who'];
  function show(name, dir) {
    var prev = step; step = name;
    Object.keys(SCREENS).forEach(function (k) { $(SCREENS[k]).classList.toggle('hidden', k !== name); });
    var el = $(SCREENS[name]);
    el.classList.remove('in-right', 'in-left'); void el.offsetWidth;
    if (prev) el.classList.add(dir === 'back' ? 'in-left' : 'in-right');
    var n = ORDER.indexOf(name) + 1;
    $('#bk-head').classList.toggle('hidden', !n);
    if (n) {
      $('#bk-steptext').textContent = t_('Step {n} of 3', { n: n });
      V.$$('.bk-segs i').forEach(function (s, i) { s.classList.toggle('on', i < n); });
    }
    window.scrollTo(0, 0);
    if (name === 'pickup' && map) setTimeout(function () { map.invalidateSize(); }, 50);
  }
  function go(name) { try { history.pushState({ bk: name }, ''); } catch (e) {} show(name, 'fwd'); }
  window.addEventListener('popstate', function (e) {
    closeSheets();
    var s = e.state && e.state.bk;
    if (step === 'done') { location.href = 'index.html'; return; }
    if (s && ORDER.indexOf(s) >= 0) show(s, 'back');
  });
  $('#bk-back').addEventListener('click', function () {
    if (step === 'pickup') { if (document.referrer && history.length > 2) history.go(-1); else location.href = 'matches.html'; return; }
    history.back();
  });

  // ---------- 1. intro ----------
  $('#bk-you').textContent = t_('You');
  function start() {
    if (!introDone || !dataReady) return;
    var intro = $('#bk-intro'); intro.classList.add('out');
    setTimeout(function () { intro.classList.add('hidden'); }, 450);
    if (!homes.length) { show('empty'); return; }
    try { history.replaceState({ bk: 'pickup' }, ''); } catch (e) {}
    show('pickup');
  }
  setTimeout(function () { introDone = true; start(); }, 3300);

  // ---------- 2. pickup ----------
  function initMap() {
    if (!window.L || map) return;
    try {
      var box = document.createElement('div'); box.className = 'bk-map-leaflet';
      $('#bk-map').insertBefore(box, $('#bk-map').firstChild);
      map = L.map(box, { zoomControl: false, attributionControl: true }).setView(NAIROBI, 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
      map.on('movestart', function () { if (mapMode) $('#bk-map').classList.add('moving'); });
      map.on('moveend', function () {
        $('#bk-map').classList.remove('moving');
        if (mapMode) { var c = map.getCenter(); if (pick.lat === null || T.km([c.lat, c.lng], [pick.lat, pick.lng]) > 0.003) setPin(c.lat, c.lng, null, 'map'); }
      });
      $('.bk-map-fallback').classList.add('hidden');
    } catch (e) { console.warn('map', e); map = null; }
  }
  function setPin(lat, lng, acc, how) {
    var n = T.nearestPickup(lat, lng, S.pickups);
    var hint = $('#bk-loc-hint');
    if (!n || n.km > 15) {
      pick.lat = null; pick.area = null;
      hint.textContent = t_('That spot is outside the areas we cover in Nairobi. Move the pin closer, or WhatsApp us.');
      $('#bk-mapcard').classList.add('hidden'); $('#go-when').disabled = true;
      return false;
    }
    pick.lat = +lat.toFixed(6); pick.lng = +lng.toFixed(6); pick.area = n.pickup.name; pick.acc = acc; pick.how = how;
    $('#bk-loc-title').textContent = t_('Near {x}', { x: n.pickup.name });
    $('#bk-loc-sub').textContent = how === 'gps' ? t_('Your location · accurate to {m} m', { m: Math.max(5, Math.round(acc || 20)) }) : t_('Pin on the map · drag the map to adjust');
    $('#bk-mapcard').classList.remove('hidden');
    $('#bk-centerpin').classList.remove('hidden'); $('#bk-gps').classList.add('hidden');
    $('#bk-locbtns').classList.add('hidden'); $('#bk-after').classList.remove('hidden');
    $('#go-when').disabled = false;
    hint.textContent = how === 'map' ? t_('Move the map so the pin sits on your pickup spot.') : '';
    return true;
  }
  function dropPin() { var p = $('#bk-centerpin'); p.classList.remove('drop'); void p.offsetWidth; p.classList.add('drop'); }
  $('#bk-useloc').addEventListener('click', function () {
    var btn = $('#bk-useloc'), hint = $('#bk-loc-hint');
    if (!navigator.geolocation) { hint.textContent = t_('This phone can\'t share its location. Drop a pin on the map instead.'); return; }
    btn.disabled = true; hint.textContent = t_('Finding you…');
    navigator.geolocation.getCurrentPosition(function (pos) {
      btn.disabled = false;
      var c = pos.coords;
      mapMode = false;
      if (map) map.setView([c.latitude, c.longitude], 17, { animate: true });
      if (setPin(c.latitude, c.longitude, c.accuracy, 'gps')) { dropPin(); setTimeout(function () { mapMode = true; }, 900); }
    }, function () {
      btn.disabled = false;
      hint.textContent = t_('Location is off. Turn it on and try again, or drop a pin on the map.');
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  });
  function useMap() {
    if (!map) { $('#bk-loc-hint').textContent = t_('The map couldn\'t load. Please use your location, or WhatsApp us.'); return; }
    mapMode = true;
    if (pick.lat === null) map.setView(map.getCenter(), Math.max(map.getZoom(), 14));
    var c = map.getCenter();
    if (setPin(c.lat, c.lng, null, 'map')) dropPin();
  }
  $('#bk-usemap').addEventListener('click', useMap);
  $('#bk-move').addEventListener('click', useMap);
  $('#go-when').addEventListener('click', function () { if (pick.lat !== null) go('when'); });

  // ---------- 3. day & time ----------
  function localCal() {
    var now = new Date(), cut = String(S.cutoff || '18:00').split(':');
    var d = new Date(); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + ((now.getHours() * 60 + now.getMinutes()) < (+cut[0] * 60 + +(cut[1] || 0)) ? 1 : 2));
    var days = [];
    for (var i = 0; i < (S.calendar_days || 60); i++) {
      if ((S.closed_days || []).indexOf(d.getDay()) < 0) days.push({ day: iso(d), slots: S.slots.map(function (s) { return { slot: s, open: true }; }) });
      d.setDate(d.getDate() + 1);
    }
    return { agents: -1, days: days };
  }
  function loadCal() {
    if (V.demo) return Promise.resolve(localCal());
    return rpc('trip_calendar').catch(function () { return rpc('trip_slots'); }).catch(function (e) { console.warn('slots', e); return localCal(); });
  }
  function isOpen(d) { return d && d.slots.some(function (x) { return x.open; }); }
  function dayData(s) { return cal && cal.days.filter(function (d) { return d.day === s; })[0]; }
  function strip() { return cal.days.filter(isOpen).slice(0, 7); }

  function renderWhen() {
    var box = $('#bk-days'), tBox = $('#bk-times');
    box.innerHTML = ''; tBox.innerHTML = '';
    $('#bk-noagents').innerHTML = '';
    if (!cal || cal.agents === 0 || !cal.days.some(isOpen)) {
      box.innerHTML = '';
      $('#bk-noagents').innerHTML = t_('Viewing trips open soon: no agents are free yet.') + ' <a href="' + V.wa('Hi Viustay, I would like to book a viewing trip.') + '" target="_blank" rel="noopener">' + t_('WhatsApp us and we\'ll arrange it.') + '</a>';
      $('#bk-calbtn').classList.add('hidden'); $('#go-who').disabled = true; return;
    }
    var days = strip(), inStrip = days.some(function (d) { return d.day === pick.day; });
    days.forEach(function (d) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'bk-day';
      b.setAttribute('aria-pressed', String(d.day === pick.day));
      b.innerHTML = '<small>' + V.esc(wd(d.day)) + '</small><b>' + dayObj(d.day).getDate() + '</b><small>' + V.esc(V.date(d.day, { month: 'short' })) + '</small>';
      b.setAttribute('aria-label', dayLong(d.day));
      b.addEventListener('click', function () { pickDay(d.day); });
      box.appendChild(b);
    });
    // full days skipped inside the strip
    var last = days[days.length - 1].day;
    var full = cal.days.filter(function (d) { return d.day < last && !isOpen(d); }).map(function (d) { return dayLong(d.day); });
    $('#bk-fullnote').textContent = full.length ? t_(full.length === 1 ? '{x} is fully booked, so the next open day was added.' : '{x} are fully booked, so the next open days were added.', { x: full.join(', ') }) : '';
    $('#bk-custom').classList.toggle('hidden', inStrip || !pick.day);
    if (!inStrip && pick.day) $('#bk-custom-text').textContent = dayLong(pick.day);
    var day = dayData(pick.day);
    (day ? day.slots : []).forEach(function (x) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'bk-time';
      b.textContent = x.slot + (x.open ? '' : ' · ' + t_('Full'));
      b.setAttribute('aria-pressed', String(x.slot === pick.slot));
      if (!x.open) b.disabled = true; else b.addEventListener('click', function () { pick.slot = x.slot; renderWhen(); });
      tBox.appendChild(b);
    });
    $('#go-who').disabled = !(pick.day && pick.slot);
  }
  function pickDay(s) {
    pick.day = s;
    var d = dayData(s), open = d ? d.slots.filter(function (x) { return x.open; }) : [];
    if (!open.some(function (x) { return x.slot === pick.slot; })) pick.slot = open[0] ? open[0].slot : null;
    renderWhen();
  }
  $('#go-who').addEventListener('click', function () { if (pick.day && pick.slot) { renderSaved(); go('who'); } });

  // calendar sheet
  var calMonth = null;
  function monthsRange() { var a = dayObj(cal.days[0].day), b = dayObj(cal.days[cal.days.length - 1].day); return [new Date(a.getFullYear(), a.getMonth(), 1), new Date(b.getFullYear(), b.getMonth(), 1)]; }
  function renderCal() {
    var r = monthsRange(), m = calMonth, y = m.getFullYear(), mo = m.getMonth();
    $('#cal-title').textContent = V.date(iso(m), { month: 'long', year: 'numeric' });
    $('#cal-prev').disabled = m <= r[0]; $('#cal-next').disabled = m >= r[1];
    var wdBox = $('#cal-wd'); wdBox.innerHTML = '';
    for (var w = 0; w < 7; w++) { var s = document.createElement('span'); s.textContent = V.date(iso(new Date(2026, 9, 5 + w)), { weekday: 'narrow' }); wdBox.appendChild(s); }
    var g = $('#cal-grid'); g.innerHTML = '';
    var lead = (new Date(y, mo, 1).getDay() + 6) % 7;
    for (var i = 0; i < lead; i++) { var bl = document.createElement('span'); bl.className = 'blank'; g.appendChild(bl); }
    var n = new Date(y, mo + 1, 0).getDate();
    for (var dd = 1; dd <= n; dd++) {
      (function (ds) {
        var b = document.createElement('button'), d = dayData(ds), open = isOpen(d);
        b.type = 'button'; b.textContent = dayObj(ds).getDate();
        b.setAttribute('aria-label', dayLong(ds) + (open ? '' : ' · ' + t_(d ? 'Full' : 'Closed')));
        if (!open) { b.disabled = true; if (d) b.className = 'full'; }
        else b.addEventListener('click', function () { pickDay(ds); closeSheets(); });
        b.setAttribute('aria-pressed', String(ds === pick.day));
        g.appendChild(b);
      })(iso(new Date(y, mo, dd)));
    }
  }
  $('#bk-calbtn').addEventListener('click', function () {
    var base = pick.day ? dayObj(pick.day) : dayObj(cal.days[0].day);
    calMonth = new Date(base.getFullYear(), base.getMonth(), 1);
    renderCal(); openSheet('#cal-wrap');
  });
  $('#cal-prev').addEventListener('click', function () { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); renderCal(); });
  $('#cal-next').addEventListener('click', function () { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); renderCal(); });

  // ---------- sheets ----------
  function openSheet(id) { $(id).classList.remove('hidden'); var f = $(id).querySelector('h2'); if (f) { f.setAttribute('tabindex', '-1'); f.focus({ preventScroll: true }); } }
  function closeSheets() { V.$$('.bk-sheet-wrap').forEach(function (w) { w.classList.add('hidden'); }); }
  V.$$('[data-close]').forEach(function (b) { b.addEventListener('click', closeSheets); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheets(); });

  // ---------- 4. who ----------
  function people() { var p = getLS(PEOPLE); return Array.isArray(p) ? p.filter(function (x) { return x && x.name && x.phone; }).slice(0, 3) : []; }
  function renderSaved() {
    var list = people(), box = $('#bk-saved');
    $('#bk-saved-wrap').classList.toggle('hidden', !list.length);
    box.innerHTML = '';
    var name = $('#bk-name').value.trim(), phone = $('#bk-phone').value.trim();
    list.forEach(function (p) {
      var on = p.name === name && p.phone === phone;
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'bk-saved-item'; b.setAttribute('aria-pressed', String(on));
      b.innerHTML = '<span class="bk-face">' + V.esc(p.name.charAt(0).toUpperCase()) + '</span><span class="bk-who"><b>' + V.esc(p.name) + '</b><span>' + V.esc(p.phone) + '</span></span><span class="bk-use">' + t_(on ? 'Selected' : 'Use') + '</span>';
      b.addEventListener('click', function () { $('#bk-name').value = p.name; $('#bk-phone').value = p.phone; showErr($('#bk-error')); renderSaved(); });
      box.appendChild(b);
    });
  }
  ['#bk-name', '#bk-phone'].forEach(function (s) { $(s).addEventListener('input', function () { if (people().length) renderSaved(); }); });
  function remember(name, phone) {
    var list = people().filter(function (p) { return p.phone.replace(/\D/g, '') !== phone.replace(/\D/g, ''); });
    list.unshift({ name: name, phone: phone }); setLS(PEOPLE, list.slice(0, 3));
  }

  $('#go-fee').addEventListener('click', function () {
    var name = $('#bk-name').value.trim(), phone = $('#bk-phone').value.trim(), err = $('#bk-error');
    var problem = !name ? ERR.bad_name : !V.phoneOk(phone) ? ERR.bad_phone : '';
    showErr(err, problem ? t_(problem) : '');
    if (problem) { (name ? $('#bk-phone') : $('#bk-name')).focus(); return; }
    quote = T.quote({ lat: pick.lat, lng: pick.lng }, homes, S);
    $('#fee-fare').textContent = kes(quote.fare); $('#fee-fee').textContent = kes(quote.viewing_fee); $('#fee-total').textContent = kes(quote.total);
    showErr($('#fee-error'));
    openSheet('#fee-wrap');
  });

  // ---------- 5. confirm ----------
  $('#fee-confirm').addEventListener('click', function () {
    var btn = $('#fee-confirm'), name = $('#bk-name').value.trim(), phone = $('#bk-phone').value.trim();
    btn.disabled = true; btn.textContent = t_('Booking…');
    var payload = {
      name: name, phone: phone, date: pick.day, slot: pick.slot, pickup_area: pick.area, pickup_lat: pick.lat, pickup_lng: pick.lng,
      pickup_note: $('#bk-note').value.trim(), distance_km: quote.km, search: search,
      homes: quote.order.map(function (l) { return { id: l.id, title: l.title, area: l.area, rent: l.rent, building_code: l.building_code || null }; })
    };
    var p = V.demo ? Promise.resolve({ ref: 'VS-DEMO' + Math.floor(Math.random() * 90 + 10), total: quote.total }) : rpc('create_trip', { p: payload });
    p.then(function (r) {
      remember(name, phone);
      setLS('vs-trip', { ref: r.ref, phone: phone });
      search.picked = []; V.setSearch(search);
      closeSheets(); done(r, name);
    }).catch(function (e) {
      console.error(e);
      var m = (e && e.message) || '';
      if (/slot_full|bad_date/.test(m)) {
        closeSheets();
        loadCal().then(function (d) { cal = d; pickDay(pick.day); });
        show('when', 'back'); $('#bk-fullnote').textContent = errText(e);
      } else showErr($('#fee-error'), errText(e));
    }).then(function () { btn.disabled = false; btn.textContent = t_('Confirm booking'); });
  });

  // ---------- 6. done ----------
  function done(r, name) {
    try { history.replaceState({ bk: 'done' }, ''); } catch (e) {}
    show('done');
    $('#bk-thanks').textContent = t_('Thank you, {name}. We\'ll take care of the rest.', { name: name.split(' ')[0] });
    var note = $('#bk-note').value.trim();
    $('#bk-summary').innerHTML =
      '<div><span>' + t_('When') + '</span><b>' + V.esc(dayLong(pick.day)) + ', ' + V.esc(pick.slot) + '</b></div>' +
      '<div><span>' + t_('Pickup') + '</span><b>' + V.esc(t_('Near {x}', { x: pick.area })) + (note ? '<br><small style="font-weight:400">' + V.esc(note) + '</small>' : '') + '</b></div>' +
      '<div><span>' + t_('Homes') + '</span><b>' + V.esc(t_(homes.length === 1 ? '{n} home' : '{n} homes', { n: homes.length })) + '</b></div>' +
      '<div><span>' + t_('Booking') + '</span><b>' + V.esc(r.ref) + '</b></div>' +
      '<div class="bk-sumpay"><span>' + t_('Pay after the trip') + '</span><b>' + kes(r.total || quote.total) + '</b></div>';
    $('#bk-see').href = 'trip.html?ref=' + encodeURIComponent(r.ref);
  }

  // ---------- load ----------
  function feeRule() {
    var h = +String(S.cutoff || '18:00').split(':')[0];
    $('#fee-rule').innerHTML = t_('Free to cancel until {t} the day before.', { t: (h % 12 || 12) + (h < 12 ? ' am' : ' pm') }) + ' ' +
      t_('By booking you agree to our <a href="terms.html" target="_blank">terms</a> and <a href="privacy.html" target="_blank">privacy notice</a>.');
  }
  initMap();
  Promise.all([V.loadListings(), T.loadSettings()]).then(function (res) {
    S = res[1];
    homes = res[0].filter(function (l) { return ids.indexOf(l.id) >= 0; }).slice(0, 3);
    feeRule();
    return loadCal();
  }).then(function (d) {
    cal = d;
    var first = cal && cal.days.filter(isOpen)[0];
    if (first) pickDay(first.day); else renderWhen();
  }).catch(function (e) {
    console.error(e); cal = { agents: 0, days: [] }; renderWhen();
  }).then(function () { dataReady = true; start(); });
});
