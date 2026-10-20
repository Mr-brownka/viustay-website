// Single listing page: home.html?id=VS-001. Long stays book a viewing trip; short stays book like a hotel.
document.addEventListener('DOMContentLoaded', function () {
  var V = window.V, T = V.t, $ = V.$;
  var id = new URLSearchParams(window.location.search).get('id');

  $('#share-btn').addEventListener('click', function () {
    var url = window.location.href, btn = this;
    if (navigator.share) { navigator.share({ title: document.title, url: url }).catch(function () {}); return; }
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { btn.textContent = T('Link copied'); });
  });
  function row(k, v) { return '<div class="row-between"><span>' + V.esc(k) + '</span><strong>' + V.esc(v) + '</strong></div>'; }
  function how(items) { return items.map(function (x) { return '<div style="border:1px solid var(--line)"><strong style="color:var(--emerald)">' + V.esc(x[0]) + '</strong><span style="font-size:14px;color:var(--muted)">' + V.esc(x[1]) + '</span></div>'; }).join(''); }

  V.getListing(id).then(function (l) {
    $('#l-skel').classList.add('hidden');
    if (!l) { $('#not-found').classList.remove('hidden'); return; }
    var sh = l.stay === 'short';
    $('#listing').classList.remove('hidden');
    document.title = V.typeLabel(l) + ', ' + (l.road || l.area) + ' | Viustay';
    $('#l-title').textContent = V.typeLabel(l) + ', ' + (l.road || l.area);
    var sub = [l.area + ', Nairobi', V.typeLabel(l)];
    if (l.bathrooms) sub.push(T('{n} bath', { n: l.bathrooms }));
    if (sh) sub.push(T('Up to {n} guests', { n: l.max_guests }));
    else {
      if (l.floor) sub.push(T('{x} floor', { x: l.floor }));
      if (l.furnished) sub.push(/^y/i.test(l.furnished) ? T('Furnished') : T('Unfurnished'));
    }
    $('#l-sub').textContent = sub.join(' · ');
    $('#l-price').innerHTML = 'KES ' + V.money(V.price(l)) + ' <small>' + V.esc(V.per(l)) + '</small>';
    var inc = sh && l.includedList.length ? l.includedList : l.amenityList;
    $('#l-amenities').innerHTML = inc.map(function (a) { return '<span>' + V.esc(T(a)) + '</span>'; }).join('') || '<span>' + V.esc(T('Ask us for details')) + '</span>';
    if (l.notes) $('#l-notes').textContent = l.notes; else $('#l-notes-wrap').classList.add('hidden');
    $('#l-ref').textContent = T('Ref') + ' ' + l.id + (l.sample ? ' · ' + T('sample listing') : '');

    if (sh) {
      $('#l-kind').textContent = T('Short stay'); $('#l-kind').classList.remove('hidden');
      $('#l-back').href = 'homes.html?stay=short'; $('#l-back').textContent = T('Back to short stays');
      $('#l-facts').innerHTML = (l.min_nights > 1 ? row(T('Minimum stay'), T('{n} nights', { n: l.min_nights })) : '') +
        row(T('Check-in'), T('from {t}', { t: l.check_in })) + row(T('Check-out'), T('by {t}', { t: l.check_out })) +
        row(T('Cleaning fee'), l.cleaning_fee ? 'KES ' + V.money(l.cleaning_fee) : T('Included'));
      $('#l-terms-wrap').classList.remove('hidden');
      $('#l-terms').innerHTML = '<span>' + T('Check-in') + '</span><strong>' + V.esc(T('from {t}', { t: l.check_in })) + '</strong><span>' + T('Check-out') + '</span><strong>' + V.esc(T('by {t}', { t: l.check_out })) + '</strong>' +
        (l.min_nights > 1 ? '<span>' + T('Minimum stay') + '</span><span>' + V.esc(T('{n} nights', { n: l.min_nights })) + '</span>' : '') +
        '<span>' + T('Guests') + '</span><span>' + V.esc(T('Up to {n} guests', { n: l.max_guests })) + '</span>' +
        '<span>' + T('Cancellation') + '</span><span>' + V.esc(T(l.cancellation)) + '</span>' +
        '<span>' + T('Payment') + '</span><span>' + V.esc(T('Pay in full by M-Pesa when you book')) + '</span>';
      if (l.rulesList.length) { $('#l-rules-wrap').classList.remove('hidden'); $('#l-rules').innerHTML = l.rulesList.map(function (r) { return '<li>' + V.esc(T(r)) + '</li>'; }).join(''); }
      $('#l-how').innerHTML = how([['1 · ' + T('Book'), T('Pick your dates and pay by M-Pesa')], ['2 · ' + T('Get details'), T('Check-in details the day before')], ['3 · ' + T('Arrive'), T('We meet you or you check yourself in')]]);
      $('#l-loc-note').textContent = T('The exact address is shared after you book.');
      $('#l-book').href = 'stay.html?id=' + encodeURIComponent(l.id); $('#l-book').textContent = T('Book your stay');
      $('#l-wa').href = V.wa('Hi Viustay, I\'m interested in the short stay ' + l.id + ' (' + (l.road || l.area) + ').');
    } else {
      $('#l-facts').innerHTML = row(T('Deposit'), l.deposit || '–') + row(T('Available'), l.available_from || T('Now')) + row(T('Viewing fee'), V.cfg.VIEWING_FEE_TEXT || '–');
      $('#l-how').innerHTML = how([['1 · ' + T('Book'), T('Pick a day and time')], ['2 · ' + T('View'), T('Our agent walks you through')], ['3 · ' + T('Move in'), T('We handle the landlord and paperwork')]]);
      $('#l-loc-note').textContent = T('The exact location is shared after you book a viewing.');
      $('#l-book').href = 'book.html?id=' + encodeURIComponent(l.id); $('#l-book').textContent = T('Book a viewing');
      $('#l-wa').href = V.wa('Hi Viustay, I\'m interested in ' + V.typeLabel(l) + ' on ' + (l.road || l.area) + ' (ref ' + l.id + ').');
    }

    var photos = l.photoList, current = 0;
    function show() {
      var main = $('#main-photo');
      main.setAttribute('style', V.photoStyle(photos[current]));
      $('#photo-placeholder').classList.toggle('hidden', !!photos.length);
      $('#photo-counter').textContent = photos.length ? (current + 1) + ' / ' + photos.length : '';
      $('#photo-counter').classList.toggle('hidden', !photos.length);
      V.$$('#thumbs button').forEach(function (b, i) { b.setAttribute('aria-pressed', i === current ? 'true' : 'false'); });
    }
    $('#thumbs').innerHTML = '';
    photos.slice(0, 6).forEach(function (p, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', T('Photo {n}', { n: i + 1 }));
      b.setAttribute('style', V.photoStyle(p));
      b.addEventListener('click', function () { current = i; show(); });
      $('#thumbs').appendChild(b);
    });
    if (!photos.length) $('#thumbs').classList.add('hidden');
    $('#main-photo').insertAdjacentHTML('beforeend', V.heart(l.id));
    if (photos.length) { var tb = document.createElement('button'); tb.type = 'button'; tb.className = 'tour-btn'; tb.setAttribute('data-room-tour', l.id); tb.innerHTML = '\u25B6 ' + V.esc(T('Room tour')); $('#main-photo').appendChild(tb); }
    show();
  }).catch(function () { $('#l-skel').classList.add('hidden'); $('#not-found').classList.remove('hidden'); });
});

// UI 2.0: on phones a floating price + Book bar follows you while the real booking box is out of view.
document.addEventListener('DOMContentLoaded', function () {
  var V = window.V, book = document.getElementById('l-book'); if (!book || !window.IntersectionObserver) return;
  var bar = document.createElement('div'); bar.className = 'l-cta'; bar.setAttribute('aria-hidden', 'true');
  bar.innerHTML = '<span><b id="l-cta-p"></b><small id="l-cta-s"></small></span><a class="btn btn-primary btn-pill" href="#" id="l-cta-b"></a>';
  document.body.appendChild(bar);
  function sync() {
    var p = document.getElementById('l-price'); if (!p) return;
    var txt = (p.textContent || '').trim(); var m = txt.match(/^(KES\s?[\d,]+)\s*(.*)$/);
    document.getElementById('l-cta-p').textContent = m ? m[1] : txt; document.getElementById('l-cta-s').textContent = m ? m[2] : '';
    var b = document.getElementById('l-cta-b'); b.textContent = book.textContent; b.href = book.getAttribute('href') || '#';
  }
  document.getElementById('l-cta-b').addEventListener('click', function (e) { if (!book.getAttribute('href') || book.getAttribute('href') === '#') { e.preventDefault(); book.click(); } });
  new IntersectionObserver(function (es) { es.forEach(function (en) { sync(); bar.classList.toggle('on', !en.isIntersecting && !!book.offsetParent); }); }).observe(book);
  setTimeout(sync, 1500);
});
