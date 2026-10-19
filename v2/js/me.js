// Me: picks, trip, language, look, help, owners, install.
document.addEventListener('DOMContentLoaded', function () {
  var V = window.V, T = V.t;
  var I = {
    car: '<svg viewBox="0 0 24 24"><path d="M5 16V11l2.2-4.4A2 2 0 0 1 9 5.5h6a2 2 0 0 1 1.8 1.1L19 11v5"/><path d="M3.5 16h17v2.5a1 1 0 0 1-1 1H18a1 1 0 0 1-1-1V18H7v.5a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1z"/></svg>',
    globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg>',
    wa: '<svg viewBox="0 0 24 24"><path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/></svg>',
    key: '<svg viewBox="0 0 24 24"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/></svg>',
    dl: '<svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
    q: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.5"/></svg>',
    list: '<svg viewBox="0 0 24 24"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>'
  };
  var chev = '<span class="go">›</span>';
  function row(href, ic, t, sub, extra) { return (href ? '<a class="me-row" href="' + href + '"' + (href.indexOf('http') === 0 ? ' target="_blank" rel="noopener"' : '') + '>' : '<div class="me-row">') + '<i>' + ic + '</i><span>' + V.esc(t) + (sub ? '<small>' + V.esc(sub) + '</small>' : '') + '</span>' + (extra || (href ? chev : '')) + (href ? '</a>' : '</div>'); }
  var cur = (window.VT && VT.lang && VT.lang()) || 'en';
  var langSel = '<select aria-label="' + V.esc(T('Language')) + '" onchange="VT.set(this.value)">' + Object.keys(VT.LANGS).map(function (k) { return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + VT.LANGS[k] + '</option>'; }).join('') + '</select>';
  document.getElementById('me-rows').innerHTML =
    '<p class="me-sec">' + V.esc(T('Your trips')) + '</p>' +
    row('trip.html', I.car, T('My trips & tickets'), T('Viewing trips and stays you booked')) +
    '<p class="me-sec">' + V.esc(T('Settings')) + '</p>' +
    row('', I.globe, T('Language'), '', langSel) +
    '<a class="me-row" href="#" id="me-install"><i>' + I.dl + '</i><span>' + V.esc(T('Install the app')) + '<small>' + V.esc(T('Add Viustay to your home screen')) + '</small></span>' + chev + '</a>' +
    '<p class="me-sec">' + V.esc(T('Help')) + '</p>' +
    row(V.wa(T('Hi Viustay, I need help')), I.wa, T('Chat with us on WhatsApp'), T('A real person replies')) +
    row('faq.html', I.q, T('Questions & answers'), '') +
    row('how-it-works.html', I.list, T('How Viustay works'), '') +
    '<p class="me-sec">' + V.esc(T('Own a property?')) + '</p>' +
    '<a class="me-cta" href="owners.html"><span>' + V.esc(T('Vacant units? We fill them.')) + '</span><em>' + V.esc(T('List it')) + '</em></a>' +
    row('dashboard.html', I.key, T('Owner & manager sign in'), '');
  var ins = document.getElementById('me-install');
  ins.addEventListener('click', function (e) { e.preventDefault(); var b = document.querySelector('.vs-install'); if (b) b.click(); else V.toast(T('Open the menu in your browser and tap "Add to Home screen".')); });
  function picks() {
    var ids = V.TripBasket.ids(), box = document.getElementById('me-picks');
    if (!ids.length) { box.innerHTML = '<a class="me-cta" href="amina.html"><span>' + V.esc(T('No homes picked yet')) + '<br><small style="font-weight:600;opacity:.85">' + V.esc(T('Amina finds homes for you in 1 minute')) + '</small></span><em>' + V.esc(T('Ask Amina')) + '</em></a>'; return; }
    V.loadListings().then(function (all) {
      var ls = ids.map(function (id) { return all.filter(function (x) { return x.id === id; })[0]; }).filter(Boolean);
      box.innerHTML = '<p class="me-sec">' + V.esc(T('Your viewing trip · {n}/3', { n: ls.length })) + '</p><div class="me-picks">' + ls.map(function (l) { return '<a href="home.html?id=' + encodeURIComponent(l.id) + '"><span style="' + V.photoStyle(l.photoList[0]) + '"></span><b>KES ' + V.money(V.price(l)) + '<br><small style="font-weight:600;color:#777">' + V.esc(l.area) + '</small></b></a>'; }).join('') + '</div>' +
        '<a class="me-cta" href="book.html" style="margin-top:10px"><span>' + V.esc(T('Ready to see them?')) + '</span><em>' + V.esc(T('Plan my viewing trip')) + '</em></a>';
    });
  }
  picks(); window.addEventListener('vs-trip', picks);
});
