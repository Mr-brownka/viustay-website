// Guided find-a-home flow: index (step 1) -> must-haves (2) -> matches (3) -> book (4)
document.addEventListener('DOMContentLoaded', function () {
  var V = window.V;
  var page = document.body.getAttribute('data-page') || 'landing';
  var search = V.getSearch();
  var MUSTS = ['Water 24/7', 'Security guard', 'Parking', 'Backup power', 'Lift', 'Balcony', 'Furnished', 'Pet friendly', 'Near a matatu stage'];
  var WHO = ['Just me', 'Couple', 'Family with kids', 'Sharing with friends'];
  var MAX_PICK = 3;

  function summary() {
    var parts = [];
    if (search.area) parts.push(search.area);
    if (search.bedrooms !== undefined && search.bedrooms !== '') parts.push(['Bedsitter / studio', '1 bedroom', '2 bedrooms', '3+ bedrooms'][Number(search.bedrooms)] || '');
    if (search.min || search.max) parts.push('KES ' + (search.min ? V.money(search.min) : '0') + ' – ' + (search.max ? V.money(search.max) : 'any'));
    var el = V.$('#flow-summary');
    if (el && parts.length) el.innerHTML = V.esc(parts.join(' · ')) + ' · <a href="index.html">Edit</a>';
  }

  function chip(label, pressed, onClick, square) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (square ? ' square' : '');
    b.textContent = label;
    b.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    b.addEventListener('click', onClick);
    return b;
  }

  function miniCard(l) {
    return '<a class="mini" href="home.html?id=' + encodeURIComponent(l.id) + '"><span class="thumb" style="' + V.photoStyle(l.photoList[0]) + '"></span>' +
      '<span><span style="font-weight:600">KES ' + V.money(l.rent) + ' / mo</span><small>' + V.esc(V.shortDesc(l)) + '</small></span></a>';
  }

  // ---------------- Step 1: landing ----------------
  if (page === 'landing') {
    var form = V.$('#search-form');
    if (!form) return;
    var stay = search.stay || 'long';
    V.$$('[data-stay]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-stay') === stay ? 'true' : 'false');
      b.addEventListener('click', function () {
        stay = b.getAttribute('data-stay');
        V.$$('[data-stay]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      });
    });
    if (search.area) form.area.value = search.area;
    if (search.bedrooms !== undefined) form.bedrooms.value = search.bedrooms;
    if (search.min) form.min.value = V.money(search.min);
    if (search.max) form.max.value = V.money(search.max);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var min = V.num(form.min.value), max = V.num(form.max.value);
      if (min && max && min > max) { var t = min; min = max; max = t; }
      V.setSearch({
        stay: stay, area: form.area.value.trim(), bedrooms: form.bedrooms.value, movein: form.movein.value,
        min: min, max: max, must: search.must || [], who: search.who || 'Just me', picked: []
      });
      window.location.href = 'must-haves.html';
    });
    return;
  }

  summary();

  // ---------------- Step 2: must-haves ----------------
  if (page === 'musthaves') {
    search.must = search.must || [];
    var mustBox = V.$('#must-chips'), whoBox = V.$('#who-chips');
    V.loadListings().then(function (all) {
      var base = all.filter(function (l) { return V.matches(l, { area: search.area, bedrooms: search.bedrooms, min: search.min, max: search.max }); });
      function render() {
        mustBox.innerHTML = ''; whoBox.innerHTML = '';
        MUSTS.forEach(function (m) {
          var on = search.must.indexOf(m) >= 0;
          mustBox.appendChild(chip(m, on, function () {
            if (on) search.must = search.must.filter(function (x) { return x !== m; }); else search.must.push(m);
            V.setSearch(search); render();
          }));
        });
        WHO.forEach(function (w) {
          whoBox.appendChild(chip(w, search.who === w, function () { search.who = w; V.setSearch(search); render(); }));
        });
        var hits = base.filter(function (l) { return V.matches(l, { must: search.must }); });
        var mc = V.$('#match-count'); if (mc.textContent !== String(hits.length)) { mc.textContent = hits.length; mc.classList.remove('bump'); void mc.offsetWidth; mc.classList.add('bump'); }
        V.$('#match-meter').style.width = (base.length ? Math.round(hits.length / Math.max(all.length, 1) * 100) : 0) + '%';
        V.$('#match-preview').innerHTML = hits.slice(0, 3).map(miniCard).join('') ||
          '<p style="margin:0">No exact matches yet. Remove a must-have, or <a href="request.html">let us find one for you</a>.</p>';
        var go = V.$('#to-matches');
        go.textContent = hits.length ? 'See my ' + hits.length + ' match' + (hits.length === 1 ? '' : 'es') : 'Ask us to find one';
        go.href = hits.length ? 'matches.html' : 'request.html';
      }
      render();
    }).catch(function () { V.$('#match-preview').textContent = 'Listings could not load. Please refresh.'; });
    return;
  }

  // ---------------- Step 3: matches ----------------
  if (page === 'matches') {
    search.picked = search.picked || [];
    V.loadListings().then(function (all) {
      var hits = all.filter(function (l) { return V.matches(l, search); });
      function render() {
        var sort = V.$('#sort').value;
        var list = hits.slice();
        if (sort === 'low') list.sort(function (a, b) { return a.rent - b.rent; });
        if (sort === 'high') list.sort(function (a, b) { return b.rent - a.rent; });
        V.$('#match-title').textContent = hits.length ? hits.length + ' home' + (hits.length === 1 ? '' : 's') + ' match you' : 'No exact matches yet';
        var box = V.$('#match-cards');
        box.innerHTML = '';
        if (!hits.length) {
          box.innerHTML = '<div class="panel" style="grid-column:1/-1"><h2 style="font-size:22px">We haven\'t listed a home like that yet</h2><p style="margin:0">Leave your details and we\'ll find one for you, usually within 48 hours.</p><div><a class="btn btn-primary" href="request.html">Find it for me</a></div></div>';
        }
        list.forEach(function (l) {
          var on = search.picked.indexOf(l.id) >= 0;
          var card = document.createElement('article');
          card.className = 'card' + (on ? ' selected' : '');
          card.innerHTML =
            '<a class="photo" href="home.html?id=' + encodeURIComponent(l.id) + '" style="' + V.photoStyle(l.photoList[0]) + '">' + (l.photoList[0] ? '' : 'Photo coming soon') + '<span class="badge">Verified by Viustay</span></a>' +
            '<div class="body"><span class="price">KES ' + V.money(l.rent) + ' <small>/ month</small></span>' +
            '<span class="desc">' + V.esc(V.shortDesc(l)) + '</span>' +
            '<span class="tags">' + V.esc(l.amenityList.slice(0, 3).join(' · ')) + '</span>' +
            '<a href="home.html?id=' + encodeURIComponent(l.id) + '" style="font-size:14px;font-weight:600">View details</a></div>';
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'btn ' + (on ? 'btn-dark' : 'btn-outline');
          btn.textContent = on ? 'Added to viewing' : 'Add to viewing';
          btn.setAttribute('aria-pressed', on ? 'true' : 'false');
          btn.addEventListener('click', function () {
            if (on) search.picked = search.picked.filter(function (x) { return x !== l.id; });
            else if (search.picked.length < MAX_PICK) search.picked.push(l.id);
            else { alert('You can pick up to 3 homes per viewing trip.'); return; }
            V.setSearch(search); render();
          });
          V.$('.body', card).appendChild(btn);
          box.appendChild(card);
        });
        var n = search.picked.length;
        V.$('#picked-label').textContent = n + ' of ' + MAX_PICK + ' homes picked for viewing';
        var go = V.$('#to-book');
        go.classList.toggle('hidden', n === 0);
      }
      V.$('#sort').addEventListener('change', render);
      render();
    }).catch(function () { V.$('#match-title').textContent = 'Listings could not load. Please refresh.'; });
    return;
  }

  // ---------------- Step 4: book ----------------
  if (page === 'book') {
    var params = new URLSearchParams(window.location.search);
    var ids = params.get('id') ? [params.get('id')] : (search.picked || []);
    if (params.get('id')) document.body.setAttribute('data-step', '4');
    var days = [], d = new Date();
    while (days.length < 6) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() !== 0) days.push(new Date(d)); // Mon–Sat only
    }
    var dayFmt = function (x) { return x.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); };
    var TIMES = ['9:00 AM', '10:30 AM', '12:00 PM', '2:00 PM', '3:30 PM'];
    var picked = { day: days[0], time: TIMES[1] };

    function renderChoices() {
      var dBox = V.$('#day-chips'), tBox = V.$('#time-chips');
      dBox.innerHTML = ''; tBox.innerHTML = '';
      days.forEach(function (x) { dBox.appendChild(chip(dayFmt(x), x === picked.day, function () { picked.day = x; renderChoices(); }, true)); });
      TIMES.forEach(function (t) { tBox.appendChild(chip(t, t === picked.time, function () { picked.time = t; renderChoices(); }, true)); });
      V.$('#book-when').textContent = dayFmt(picked.day) + ', ' + picked.time;
    }
    renderChoices();

    var homes = [];
    V.loadListings().then(function (all) {
      homes = all.filter(function (l) { return ids.indexOf(l.id) >= 0; });
      V.$('#book-homes').innerHTML = homes.length ? homes.map(miniCard).join('') :
        '<p style="margin:0">No homes picked yet. <a href="matches.html">Pick homes</a> or <a href="homes.html">browse all</a>.</p>';
      V.$('#book-submit').disabled = !homes.length;
    });

    var form = V.$('#book-form'), err = V.$('#book-error');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      err.classList.add('hidden');
      var name = form.name.value.trim(), phone = form.phone.value.trim();
      var problem = !homes.length ? 'Pick at least one home first.' : !name ? 'Please enter your name.' :
        !V.phoneOk(phone) ? 'Please enter a valid WhatsApp number.' : !form.consent.checked ? 'Please tick the box so we can contact you.' : '';
      if (problem) { err.textContent = problem; err.classList.remove('hidden'); return; }
      var btn = V.$('#book-submit');
      btn.disabled = true; btn.textContent = 'Booking…';
      var ref = 'VB-' + Date.now().toString(36).toUpperCase();
      var dayIso = picked.day.toISOString().slice(0, 10);
      var rows = homes.map(function (l) {
        return {
          booking_ref: ref, listing_id: l.id, building_code: l.building_code || null,
          listing_title: l.title, rent: l.rent, viewing_date: dayIso, viewing_time: picked.time,
          tenant_name: name, tenant_phone: phone, search: search
        };
      });
      V.insert('viewings', rows).then(function () {
        var when = dayFmt(picked.day) + ' at ' + picked.time;
        V.$('#book-form-wrap').classList.add('hidden');
        V.$('#book-done').classList.remove('hidden');
        V.$('#done-text').textContent = when + '. We\'ll WhatsApp you the details and your agent\'s number. Your booking number is ' + ref + '.';
        V.$('#done-wa').href = V.wa('Hi Viustay, I just booked viewing ' + ref + ' for ' + when + '.');
        V.$('#done-wa').target = '_blank';
        search.picked = []; V.setSearch(search);
        window.scrollTo(0, 0);
      }).catch(function (e2) {
        console.error(e2);
        err.textContent = 'Something went wrong saving your booking. Please try again or WhatsApp us.';
        err.classList.remove('hidden');
        btn.disabled = false; btn.textContent = 'Confirm viewing';
      });
    });
  }
});
