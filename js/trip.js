// "My trip": the client's booking status, trip code, agent details and rating.
document.addEventListener('DOMContentLoaded', function () {
  var V = window.V, $ = V.$;
  var params = new URLSearchParams(location.search);
  var saved = null; try { saved = JSON.parse(localStorage.getItem('vs-trip') || 'null'); } catch (e) {}
  var ref = (params.get('ref') || (saved && saved.ref) || '').toUpperCase();
  var phone = saved && (!params.get('ref') || saved.ref === ref) ? saved.phone : '';

  function kes(n) { return 'KES ' + V.money(n); }
  function dayFmt(iso) { return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }); }
  function intl(p) { var d = String(p || '').replace(/[^0-9]/g, ''); if (d.indexOf('0') === 0) d = '254' + d.slice(1); if (d.length === 9) d = '254' + d; return d; }
  function rpc(name, args) { return V.ensureDb().then(function (db) { return db.rpc(name, args); }).then(function (r) { if (r.error) throw r.error; return r.data; }); }

  var STAGES = ['Booked', 'Paid', 'Confirmed', 'Agent ready', 'Done'];
  function stage(t) {
    if (t.status === 'completed') return 4;
    if (t.status === 'confirmed') return t.agent ? 3 : 2;
    if (t.status === 'paid') return 1;
    return 0;
  }
  var LABEL = {
    awaiting_payment: ['warn', 'Waiting for payment'], expired: ['bad', 'Not paid in time'], paid: ['ok', 'Paid · we\'re confirming your homes'],
    confirmed: ['ok', 'Confirmed'], completed: ['ok', 'Trip done'], no_show: ['bad', 'Missed trip'], cancelled: ['bad', 'Cancelled']
  };

  function render(t) {
    var st = t.status === 'confirmed' && t.agent ? ['ok', 'Your agent is ready'] : LABEL[t.status] || ['', t.status];
    var n = stage(t), html = '';
    html += '<div class="t-card"><div class="row-between" style="flex-wrap:wrap;gap:8px"><strong style="font-size:18px">' + V.esc(t.ref) + '</strong><span class="t-badge ' + st[0] + '">' + V.esc(st[1]) + '</span></div>';
    if (['cancelled', 'expired', 'no_show'].indexOf(t.status) < 0) {
      html += '<ol class="t-progress">' + STAGES.map(function (s, i) { return '<li class="' + (i <= n ? 'on' : '') + (i === n + 1 ? ' now' : '') + '">' + s + '</li>'; }).join('') + '</ol>';
    }
    html += '<div class="t-kv"><span>When</span><strong>' + V.esc(dayFmt(t.date)) + ', ' + V.esc(t.slot) + '</strong>' +
      '<span>Pickup</span><span>' + V.esc(t.pickup_area) + (t.pickup_note ? ' · ' + V.esc(t.pickup_note) : '') + '</span>' +
      '<span>Paid</span><span>' + (t.mpesa_code ? kes(t.total) + ' · M-Pesa ' + V.esc(t.mpesa_code) : kes(t.total) + ' (not paid yet)') + '</span></div>';
    html += '<strong style="font-size:15px">Homes, in visiting order</strong><ol class="t-homes">' + (t.homes || []).map(function (h) {
      return '<li><a href="home.html?id=' + encodeURIComponent(h.id) + '">' + V.esc(h.title || h.id) + '</a>' + (h.area ? ' · ' + V.esc(h.area) : '') + '</li>';
    }).join('') + '</ol></div>';

    if (t.status === 'awaiting_payment') {
      try { localStorage.setItem('vs-trip', JSON.stringify({ ref: t.ref, phone: phone, total: t.total, expires_at: t.expires_at, date: t.date, slot: t.slot, pickup: t.pickup_area })); } catch (e) {}
      html += '<div class="t-card"><p style="margin:0">Your slot is held until you pay. Pay by M-Pesa and enter the confirmation code.</p><div><a class="btn btn-primary" href="book.html?pay=1">Finish paying</a></div></div>';
    }
    if (t.code) {
      html += '<div class="t-code"><span>Your trip code</span><b>' + V.esc(t.code) + '</b><span>Give this code to your agent at the <strong>end</strong> of your trip, not before.</span></div>';
    }
    if (t.agent) {
      var a = t.agent;
      html += '<div class="t-card"><strong style="font-size:15px">Your agent</strong><div class="t-agent"><span class="t-face" style="' + (a.photo_url ? V.photoStyle(a.photo_url) : '') + '">' + (a.photo_url ? '' : V.esc((a.name || '?').charAt(0))) + '</span>' +
        '<div class="stack-sm" style="gap:4px"><strong style="font-size:18px">' + V.esc(a.name) + '</strong><span>' + V.esc(a.car || '') + '</span>' + (a.plate ? '<span><span class="t-plate">' + V.esc(a.plate) + '</span></span>' : '') + '</div></div>' +
        (t.status === 'confirmed' ? '<div class="t-actions"><a class="btn btn-dark" href="tel:+' + intl(a.phone) + '">Call ' + V.esc(a.name.split(' ')[0]) + '</a><a class="btn btn-outline" target="_blank" rel="noopener" href="https://wa.me/' + intl(a.phone) + '">WhatsApp</a></div>' : '') +
        '<span class="note">Check the plate before you get in. Your agent never asks for cash: everything is paid to Viustay.</span></div>';
    } else if (t.status === 'paid' || t.status === 'confirmed') {
      html += '<div class="t-card"><strong style="font-size:15px">Your agent</strong><span>We\'ll show your agent\'s name, photo and car plate here the day before your trip.</span></div>';
    }
    if (t.status === 'completed' && !t.rating) {
      html += '<form class="t-card" id="rate-form"><strong style="font-size:15px">How was your agent?</strong><div class="t-stars" role="radiogroup" aria-label="Rating">' +
        [1, 2, 3, 4, 5].map(function (i) { return '<button type="button" data-r="' + i + '" aria-label="' + i + ' star' + (i > 1 ? 's' : '') + '">★</button>'; }).join('') +
        '</div><label class="field">Anything to tell us? (optional)<textarea name="note" rows="2" maxlength="500"></textarea></label><p class="t-msg" id="rate-msg"></p><div><button class="btn btn-primary" type="submit">Send rating</button></div></form>';
    } else if (t.rating) {
      html += '<div class="t-card"><span>Thanks for rating your trip ' + '★★★★★'.slice(0, t.rating) + '</span></div>';
    }
    html += '<div class="t-actions"><a class="btn btn-outline" target="_blank" rel="noopener" href="' + V.wa('Hi Viustay, about my viewing trip ' + t.ref + ': ') + '">Change or cancel on WhatsApp</a></div>';
    var view = $('#trip-view'); view.innerHTML = html; view.classList.remove('hidden'); $('#find-form').classList.add('hidden');

    var rf = $('#rate-form');
    if (rf) {
      var rating = 0;
      V.$$('.t-stars button', rf).forEach(function (b) {
        b.addEventListener('click', function () { rating = +b.getAttribute('data-r'); V.$$('.t-stars button', rf).forEach(function (x) { x.classList.toggle('on', +x.getAttribute('data-r') <= rating); }); });
      });
      rf.addEventListener('submit', function (e) {
        e.preventDefault();
        var msg = $('#rate-msg');
        if (!rating) { msg.className = 't-msg bad'; msg.textContent = 'Tap a star first.'; return; }
        (V.demo ? Promise.resolve(true) : rpc('rate_trip', { p_ref: t.ref, p_phone: phone, p_rating: rating, p_note: rf.note.value }))
          .then(function () { t.rating = rating; render(t); })
          .catch(function () { msg.className = 't-msg bad'; msg.textContent = 'Could not send. Please try again.'; });
      });
    }
  }

  function load() {
    if (V.demo) {
      render({ ref: ref || 'VS-DEMO1', status: 'confirmed', date: new Date(Date.now() + 864e5).toISOString().slice(0, 10), slot: '9:00 AM', pickup_area: 'South B', pickup_note: 'Gate B',
        homes: [{ id: 'VS-001', title: '1 bedroom, Argwings Kodhek Rd', area: 'Kilimani' }], total: 2550, mpesa_code: 'SJK3ABCD12', code: '4821',
        agent: { name: 'Hassan Ali', phone: '0712345678', car: 'Toyota Axio, silver', plate: 'KDA 123A' } });
      return;
    }
    rpc('lookup_trip', { p_ref: ref, p_phone: phone }).then(render).catch(function (e) {
      console.error(e);
      $('#find-form').classList.remove('hidden');
      var er = $('#find-error'); er.textContent = /not_found/.test(e.message || '') ? 'We couldn\'t find that booking. Check the number and phone, or WhatsApp us.' : 'Could not load your trip. Please try again.';
      er.classList.remove('hidden');
    });
  }

  $('#find-form').addEventListener('submit', function (e) {
    e.preventDefault();
    ref = e.target.ref.value.trim().toUpperCase(); phone = e.target.phone.value.trim();
    if (!ref || !V.phoneOk(phone)) { var er = $('#find-error'); er.textContent = 'Enter your booking number and phone number.'; er.classList.remove('hidden'); return; }
    try { localStorage.setItem('vs-trip', JSON.stringify({ ref: ref, phone: phone })); } catch (e2) {}
    load();
  });

  if (ref && phone) load();
  else { $('#find-form').classList.remove('hidden'); if (ref) $('#find-form').ref.value = ref; }
});
