// Short-stay ticket to show at reception (item 19): guest, dates, QR, PAID stamp, live clock + moving shine.
// Used by stay.js (right after paying) and trip.js (My bookings -> "Show ticket at reception").
(function () {
  var V = window.V, T = V.t;
  function kes(n) { return 'KES ' + V.money(n); }
  function mask(n) { var d = String(n || '').replace(/\D/g, ''); if (d.indexOf('254') === 0) d = '0' + d.slice(3); return d.length >= 9 ? d.slice(0, 4) + ' ••• ' + d.slice(-3) : ''; }
  function nightsOf(a, b) { return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5); }
  var PAID = ['paid', 'confirmed', 'checked_in', 'completed'];
  function qrSvg(text) {
    if (typeof window.qrcode !== 'function') return '';
    var q = window.qrcode(0, 'M'); q.addData(text); q.make();
    var n = q.getModuleCount(), r = '';
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (q.isDark(y, x)) r += 'M' + x + ' ' + y + 'h1v1h-1z';
    return '<svg viewBox="0 0 ' + n + ' ' + n + '" shape-rendering="crispEdges" aria-label="' + V.esc(T('QR code for booking {ref}', { ref: '' })) + '"><path d="' + r + '"/></svg>';
  }
  function link(ref) { return location.href.split('/').slice(0, -1).join('/') + '/trip.html?ref=' + encodeURIComponent(ref); }

  function html(t) {
    var paid = PAID.indexOf(t.status || (t.paid ? 'paid' : '')) >= 0 || t.paid;
    var n = t.nights || nightsOf(t.check_in, t.check_out);
    var day = function (d) { return new Date(d + 'T00:00:00'); };
    var ci = day(t.check_in), co = day(t.check_out);
    var wd = function (d) { return V.date(iso(d), { weekday: 'short' }) + ', ' + V.date(iso(d), { month: 'short' }); };
    var who = [T(t.guests === 1 ? '{n} guest' : '{n} guests', { n: t.guests || 1 })].concat(mask(t.phone) ? [mask(t.phone)] : []).join(' · ');
    return '<div class="tk" data-tk>' +
      '<div class="tk-top"><i class="tk-shine"></i><div class="tk-brand"><img src="assets/viustay-logo-white.svg" alt="Viustay"><span>' + T('Stay ticket') + '</span></div>' +
      '<small>' + T('Guest') + '</small><b class="tk-name">' + V.esc(t.name || t.guest_name || T('Guest')) + '</b><span class="tk-who">' + V.esc(who) + '</span></div>' +
      '<div class="tk-dates"><div><small>' + T('Check-in') + '</small><b>' + ci.getDate() + '</b><span>' + V.esc(wd(ci)) + '</span><em>' + V.esc(T('from {t}', { t: t.check_in_time || '2:00 PM' })) + '</em></div>' +
      '<div class="tk-n">' + V.esc(T(n === 1 ? '{n} night' : '{n} nights', { n: n })) + '<i>→</i></div>' +
      '<div class="r"><small>' + T('Check-out') + '</small><b>' + co.getDate() + '</b><span>' + V.esc(wd(co)) + '</span><em>' + V.esc(T('by {t}', { t: t.check_out_time || '11:00 AM' })) + '</em></div></div>' +
      '<div class="tk-place"><b>' + V.esc(t.title || '') + '</b><span>' + V.esc((t.area ? t.area + ', ' : '') + 'Nairobi') + '</span></div>' +
      '<div class="tk-cut"></div>' +
      '<div class="tk-qr"><span class="tk-code">' + qrSvg(link(t.ref)) + '</span><span class="tk-ref"><small>' + T('Booking') + '</small><b>' + V.esc(t.ref) + '</b><span>' + T('Reception scans to check') + '</span>' +
      '<span class="tk-live"><i></i>' + T('Live') + ' · <time data-clock></time></span></span>' +
      (paid ? '<span class="tk-stamp">' + T('PAID') + '</span>' : '<span class="tk-stamp no">' + T('NOT PAID') + '</span>') + '</div>' +
      '<div class="tk-foot"><span>' + kes(t.total) + (t.mpesa_code ? ' · M-Pesa ' + V.esc(t.mpesa_code) : '') + '</span><b>' + V.esc(T(t.status === 'confirmed' || t.status === 'checked_in' ? 'Confirmed' : paid ? 'Paid' : 'Waiting for payment')) + '</b></div></div>';
  }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function start(root) {
    var els = (root || document).querySelectorAll('[data-clock]');
    function tick() { var d = new Date(); Array.prototype.forEach.call(els, function (e) { e.textContent = [d.getHours(), d.getMinutes(), d.getSeconds()].map(function (x) { return String(x).padStart(2, '0'); }).join(':'); }); }
    tick(); var id = setInterval(function () { if (!document.body.contains(els[0])) { clearInterval(id); return; } tick(); }, 1000);
  }
  // Full screen, dark, for reception
  function show(t) {
    var o = document.createElement('div'); o.className = 'tk-screen'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', T('Stay ticket'));
    o.innerHTML = '<div class="tk-bar"><button type="button" class="tk-x" data-close>‹ ' + T('Close') + '</button><span>☀ ' + T('Turn your brightness up') + '</span></div>' + html(t) +
      '<p class="tk-hint">' + T('Show this at reception. The moving shine and live clock show it\'s not a screenshot.') + '</p>' +
      '<div class="tk-two"><button type="button" class="tk-w" data-mail>' + T('Email my ticket') + '</button><button type="button" class="tk-w" data-save>' + T('Save as PDF') + '</button></div><p class="tk-hint hidden" data-mailnote>' + T('Email tickets are coming soon. For now, show this screen or save it as a PDF.') + '</p>';
    document.body.appendChild(o); document.body.classList.add('tk-open');
    start(o);
    function close() { o.remove(); document.body.classList.remove('tk-open'); document.removeEventListener('keydown', esc); }
    function esc(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', esc);
    o.querySelector('[data-close]').addEventListener('click', close);
    o.querySelector('[data-mail]').addEventListener('click', function () { o.querySelector('[data-mailnote]').classList.remove('hidden'); });
    o.querySelector('[data-save]').addEventListener('click', function () { window.print(); });
    o.querySelector('[data-close]').focus();
    return o;
  }
  V.Ticket = { html: html, start: start, show: show };
})();
