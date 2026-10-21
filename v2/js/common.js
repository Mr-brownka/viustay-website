// Shared helpers: Supabase client, listings loader, small utilities.
(function () {
  var cfg = window.VIUSTAY_CONFIG || {};
  var V = {};
  window.V = V;

  V.cfg = cfg;
  var T = window.VT || function (x, v) { return v ? x.replace(/\{(\w+)\}/g, function (m, k) { return v[k] !== undefined ? v[k] : m; }) : x; };
  V.t = T;
  // Speed: browsing pages don't load the database library at all. Pages that save
  // (booking, requests, owners, dashboards) include it, and V.ensureDb() loads it on demand anywhere else.
  var SB_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';
  V.demo = !(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  V.db = (!V.demo && window.supabase) ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  var dbPromise = null;
  V.ensureDb = function () {
    if (V.db || V.demo) return Promise.resolve(V.db);
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var sc = document.createElement('script'); sc.src = SB_URL; sc.async = true;
      sc.onload = function () { V.db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY); resolve(V.db); };
      sc.onerror = function () { dbPromise = null; reject(new Error('Could not reach the database')); };
      document.head.appendChild(sc);
    });
    return dbPromise;
  };

  // ---------- tiny DOM helpers ----------
  V.$ = function (sel, root) { return (root || document).querySelector(sel); };
  V.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  V.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  V.money = function (n) { return Number(n || 0).toLocaleString('en-US'); };
  V.num = function (s) { var n = parseInt(String(s || '').replace(/[^0-9]/g, ''), 10); return isNaN(n) ? null : n; };
  V.phoneOk = function (s) { var d = String(s || '').replace(/[^0-9]/g, ''); return d.length >= 9 && d.length <= 13; };
  V.wa = function (text) { return 'https://wa.me/' + cfg.WHATSAPP_NUMBER + '?text=' + encodeURIComponent(text); };

  // ---------- Shared header / footer ----------
  // <body data-header="main|owners|flow" data-steps="4" data-step="2">
  V.renderChrome = function () {
    var body = document.body;
    var kind = body.getAttribute('data-header');
    var slot = V.$('#site-header');
    if (slot && kind) {
      if (kind === 'flow') {
        var steps = Number(body.getAttribute('data-steps') || 0), step = Number(body.getAttribute('data-step') || 0);
        var bars = '';
        for (var i = 1; i <= steps; i++) bars += '<span class="' + (i <= step ? 'on' : '') + '"></span>';
        var home = body.getAttribute('data-home') || 'index.html';
        slot.className = 'light-header';
        slot.innerHTML =
          '<div class="container" style="display:flex;flex-wrap:wrap;align-items:center;gap:12px 16px;padding-top:14px;padding-bottom:14px">' +
          '<a class="brand" href="' + home + '"><img class="logo-pearl" src="assets/viustay-logo-colour.svg" alt="Viustay home"><img class="logo-night" src="assets/viustay-logo-white.svg" alt="Viustay home"></a>' +
          '<span style="flex:1 1 auto"></span><span class="muted" id="flow-summary"></span>' + (body.hasAttribute('data-no-lang') ? '' : V.langSelect('lang-flow')) + '</div>' +
          (steps ? '<div class="container"><div class="progress" aria-label="Step ' + step + ' of ' + steps + '">' + bars + '</div></div>' : '');
      } else {
        var owners = kind === 'owners';
        slot.className = 'site-header';
        slot.innerHTML =
          '<div class="container">' +
          '<a class="brand" href="' + (owners ? 'owners.html' : 'index.html') + '"><img class="logo-pearl" src="assets/viustay-logo-colour.svg" alt="Viustay home"><img class="logo-night" src="assets/viustay-logo-white.svg" alt="Viustay home">' + (owners ? '<span class="tag">for owners</span>' : '') + '</a>' +
          (owners ? '' : '<span class="hdr-q"><button type="button" class="vs-install hdr-inst" hidden><svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg><span>' + T('Install app') + '</span></button><a class="hdr-me" href="me.html" aria-label="' + T('Me') + '"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg></a></span>') +
          '<button type="button" class="menu-toggle" aria-expanded="false" aria-controls="menu-panel" aria-label="Open menu"><span></span><span></span><span></span></button>' +
          '<div class="menu-panel" id="menu-panel">' +
          '<nav class="site-nav" aria-label="Main">' +
          (owners
            ? '<a href="index.html">' + T('Find a home') + '</a><a href="owners.html#how">' + T('How it works') + '</a><a href="owners.html#caretakers">' + T('Caretakers') + '</a>'
            : '<a href="index.html">' + T('Explore') + '</a><a href="homes.html">' + T('All homes') + '</a><a href="saved.html">' + T('Saved') + '</a><a href="trip.html">' + T('My Plans') + '</a><a href="owners.html">' + T('For owners') + '</a>' +
              '<details class="nav-more"><summary>' + T('More') + '</summary><div class="nav-more-list"><a href="how-it-works.html">' + T('How it works') + '</a><a href="about.html">' + T('About') + '</a><a href="list-property.html">' + T('List your property') + '</a><a href="contact.html">' + T('Contact') + '</a></div></details>' +
              '<a class="nav-extra" href="how-it-works.html">' + T('How it works') + '</a><a class="nav-extra" href="about.html">' + T('About') + '</a><a class="nav-extra" href="contact.html">' + T('Contact') + '</a>') +
          '</nav><div class="header-actions">' +
          (owners
            ? '<a class="btn btn-pill btn-light" href="dashboard.html">' + T('Manager log in') + '</a>'
            : '<a class="btn btn-pill btn-primary hdr-ai" href="ai.html">' + V.sphere(26) + '<span>' + T('Ask Viu AI') + '</span></a>') +
          V.langSelect() + (owners ? '' : '<a class="hdr-me" href="me.html" aria-label="' + T('Me') + '"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg></a>') +
          '</div><div class="menu-looks" role="group" aria-label="Colour look"></div></div></div>';
        document.addEventListener('click', function (ev) { var d = slot.querySelector('.nav-more[open]'); if (d && !d.contains(ev.target)) d.removeAttribute('open'); });
        var tog = slot.querySelector('.menu-toggle'), panel = slot.querySelector('.menu-panel');
        tog.addEventListener('click', function () {
          var open = panel.classList.toggle('open');
          tog.setAttribute('aria-expanded', String(open));
          tog.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        });
      }
    }
    // Bottom tab bar on phones (item 24): Home, Homes, Short stays, My bookings, Help
    if (kind === 'main' && !body.hasAttribute('data-no-tabs')) {
      var here = (location.pathname.split('/').pop() || 'index.html'), q = location.search;
      var cur = here === 'trip.html' ? 'b' : here === 'saved.html' ? 's' : here === 'ai.html' || here === 'amina.html' ? 'a' : here === 'index.html' || here === 'homes.html' || here === 'home.html' || here === 'matches.html' || here === 'reels.html' ? 'i' : '';
      var TAB = [['i', 'index.html', 'Explore', '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'],
        ['a', 'ai.html', 'Viu AI', ''],
        ['s', 'saved.html', 'Saved', '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'],
        ['b', 'trip.html', 'My Plans', '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>']];
      var tb = document.createElement('nav'); tb.className = 'tabbar'; tb.setAttribute('aria-label', T('App'));
      tb.innerHTML = TAB.map(function (t) {
        return '<a href="' + t[1] + '"' + (t[0] === 'w' ? ' target="_blank" rel="noopener"' : '') + (t[0] === cur ? ' class="on" aria-current="page"' : '') + '><i>' + (t[0] === 'a' ? V.sphere(24, true) : '<svg viewBox="0 0 24 24">' + t[3] + '</svg>') + '</i>' + T(t[2]) + '</a>';
      }).join('');
      body.appendChild(tb); body.classList.add('has-tabs');
    }
    var foot = V.$('#site-footer');
    if (foot) {
      foot.className = 'site-footer';
      foot.innerHTML =
        '<div class="container footer-grid">' +
        '<div class="footer-brand brand" style="display:block"><img class="logo-pearl" src="assets/viustay-logo-colour.svg" alt="Viustay" style="height:28px;width:auto"><img class="logo-night" src="assets/viustay-logo-white.svg" alt="Viustay" style="height:28px;width:auto"><p>' + T('Find your place. We handle the rest.') + '</p><p>' + T('Mon–Sat, 8:00 AM – 5:00 PM') + '</p></div>' +
        '<nav aria-label="Renters"><strong>' + T('Renters') + '</strong><a href="ai.html">' + T('Ask Viu AI') + '</a><a href="homes.html">' + T('All homes') + '</a><a href="saved.html">' + T('Saved') + '</a><a href="reels.html">' + T('Home reels') + '</a><a href="homes.html?stay=short">' + T('Stay a few nights') + '</a><a href="areas.html">' + T('Area guides') + '</a><a href="trip.html">' + T('My Plans') + '</a></nav>' +
        '<nav aria-label="Owners"><strong>' + T('Owners') + '</strong><a href="owners.html">' + T('For owners') + '</a><a href="list-property.html">' + T('List your property') + '</a><a href="dashboard.html">' + T('Manager log in') + '</a><a href="agent.html">' + T('Agent log in') + '</a></nav>' +
        '<nav aria-label="Company"><strong>' + T('Company') + '</strong><a href="about.html">' + T('About') + '</a><a href="investors.html">' + T('Investors') + '</a><a href="faq.html">FAQ</a><a href="contact.html">' + T('Contact') + '</a></nav>' +
        '<nav aria-label="Legal"><strong>' + T('Legal') + '</strong><a href="terms.html">' + T('Terms') + '</a><a href="privacy.html">' + T('Privacy') + '</a></nav>' +
        '</div><div class="container footer-base"><span>&copy; ' + new Date().getFullYear() + ' Viustay · Nairobi, Kenya</span><span>' + T('Draft website · Version 2') + '</span></div>';
    }
    // Floating WhatsApp button on every page except the dashboard
    if (kind === 'main' && !body.hasAttribute('data-no-ai') && !V.$('.ai-fab')) {
      var fab = document.createElement('a'); fab.className = 'ai-fab'; fab.href = 'ai.html'; fab.setAttribute('aria-label', T('Ask Viu AI'));
      fab.innerHTML = V.sphere(60) + '<span>' + T('Ask Viu AI') + '</span>'; body.appendChild(fab);
    } else if (!body.hasAttribute('data-no-wa') && !V.$('.wa-float')) {
      var wa = document.createElement('a');
      wa.className = 'wa-float';
      wa.href = V.wa('Hi Viustay, I have a question');
      wa.target = '_blank'; wa.rel = 'noopener';
      wa.setAttribute('aria-label', T('Chat with Viustay on WhatsApp'));
      wa.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3 1 2.5c.1.2 1.6 2.5 4 3.5 1.5.6 2 .7 2.8.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.5-.3Z"/></svg>';
      body.appendChild(wa);
    }
  };

  // ---------- Language picker (header) ----------
  V.langSelect = function (cls) {
    if (!window.VT) return '';
    var cur = VT.lang();
    return '<label class="lang-pick ' + (cls || '') + '"><span class="sr-only">' + T('Language') + '</span><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M2.5 10h15M10 2.5c2.2 2.3 2.2 12.7 0 15M10 2.5c-2.2 2.3-2.2 12.7 0 15" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>' +
      '<select aria-label="' + T('Language') + '" onchange="VT.set(this.value)">' + Object.keys(VT.LANGS).map(function (k) { return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + ' title="' + VT.LANGS[k] + '">' + (cls === 'lang-flow' ? VT.LANGS[k] : k.toUpperCase()) + '</option>'; }).join('') + '</select></label>';
  };

  // ---------- Dates in the chosen language ----------
  V.date = function (iso, opts) {
    var d = iso instanceof Date ? iso : new Date(String(iso).length === 10 ? iso + 'T00:00:00' : iso);
    try { return d.toLocaleDateString(window.VT ? VT.locale() : 'en-GB', opts || { weekday: 'short', day: 'numeric', month: 'short' }); }
    catch (e) { return d.toLocaleDateString('en-GB', opts || { weekday: 'short', day: 'numeric', month: 'short' }); }
  };

  // ---------- Skeleton loading ----------
  V.skel = {
    cards: function (n, cls) { var h = ''; for (var i = 0; i < (n || 3); i++) h += '<div class="sk-card ' + (cls || '') + '" aria-hidden="true"><span class="sk sk-photo"></span><span class="sk-body"><span class="sk sk-line w40 tall"></span><span class="sk sk-line w80"></span><span class="sk sk-line w60"></span></span></div>'; return h; },
    minis: function (n) { var h = ''; for (var i = 0; i < (n || 3); i++) h += '<div class="sk-mini" aria-hidden="true"><span class="sk sk-thumb"></span><span class="sk-body"><span class="sk sk-line w60"></span><span class="sk sk-line w80"></span></span></div>'; return h; },
    lines: function (n) { var h = '<div class="sk-block" aria-hidden="true">'; for (var i = 0; i < (n || 3); i++) h += '<span class="sk sk-line ' + ['w80', 'w60', 'w90', 'w40'][i % 4] + '"></span>'; return h + '</div>'; },
    chips: function (n) { var h = ''; for (var i = 0; i < (n || 4); i++) h += '<span class="sk sk-chip" aria-hidden="true"></span>'; return h; },
    rows: function (n) { var h = ''; for (var i = 0; i < (n || 3); i++) h += '<div class="sk-rowcard" aria-hidden="true">' + V.skel.lines(3) + '</div>'; return h; }
  };

  // ---------- Launch animation (once each time the app or site is opened) ----------
  (function launch() {
    var b = document.body;
    var bootEnd = function () { if (window.VSBootEnd) window.VSBootEnd(); };
    if (!b || b.hasAttribute('data-no-launch')) { bootEnd(); return; }
    var seen = false; try { seen = sessionStorage.getItem('vs-launched'); sessionStorage.setItem('vs-launched', '1'); } catch (e) { seen = true; }
    if (seen) { bootEnd(); return; }
    // Keyhole reveal: the logo drops in, the keyhole lights up, then the app opens THROUGH the keyhole.
    // Drawn as one SVG with a mask, animated frame by frame (requestAnimationFrame) so it stays smooth.
    var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var W = window.innerWidth || 390, H = window.innerHeight || 844, NS = 'http://www.w3.org/2000/svg';
    var u = Math.min(118, W * .3) / 32, x0 = W / 2 - 16 * u, y0 = H / 2 - 20 * u - 26, cx = x0 + 16 * u, cy = y0 + 14.5 * u;
    var K = Math.sqrt(Math.max(cx, W - cx) * Math.max(cx, W - cx) + Math.max(cy, H - cy) * Math.max(cy, H - cy)) / (5 * u) + 3;
    var KEYP = '<circle cx="0" cy="0" r="5"/><path d="M-2.4 3h4.8l-1.3 8a1.1 1.1 0 0 1-2.2 0z"/>';
    var o = document.createElement('div');
    o.className = 'vs-launch vl2'; o.setAttribute('aria-hidden', 'true');
    o.innerHTML = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" xmlns="' + NS + '">' +
      '<defs><mask id="vl-m" maskUnits="userSpaceOnUse" x="0" y="0" width="' + W + '" height="' + H + '"><rect width="' + W + '" height="' + H + '" fill="#fff"/>' +
      '<g transform="translate(' + cx + ' ' + cy + ')"><g id="vl-h" transform="scale(0)"><g transform="scale(' + u + ')" fill="#000">' + KEYP + '</g></g></g></mask></defs>' +
      '<g mask="url(#vl-m)"><rect width="' + W + '" height="' + H + '" fill="#FFFFFF"/>' +
      '<g id="vl-logo" opacity="0"><g transform="translate(' + x0 + ' ' + y0 + ') scale(' + u + ') translate(-8 -4)"><path d="M24 5C15.2 5 9 11.6 9 20c0 10.5 15 23 15 23s15-12.5 15-23C39 11.6 32.8 5 24 5z" fill="#1554D1"/>' +
      '<g transform="translate(24 18.5)"><g id="vl-k" transform="scale(0)" fill="#FFB020">' + KEYP + '</g></g></g></g>' +
      '<text id="vl-w" x="' + (W / 2) + '" y="' + (y0 + 40 * u + 46) + '" text-anchor="middle" font-family="Plus Jakarta Sans, system-ui, sans-serif" font-weight="800" font-size="34" letter-spacing="-0.6" fill="#0A2540" opacity="0">viustay</text></g></svg>';
    b.appendChild(o);
    var logo = o.querySelector('#vl-logo'), key = o.querySelector('#vl-k'), word = o.querySelector('#vl-w'), hole = o.querySelector('#vl-h');
    var done = false, opened = false, t0 = null, openAt = calm ? 250 : 900, OPEN = calm ? 1 : 650;
    window.VS_LAUNCHING = true;
    function cl(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
    function back(p) { var c = 1.7; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); }
    function inout(p) { return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
    function finish() {
      if (done) return; done = true; window.VS_LAUNCHING = false;
      if (o.parentNode) o.parentNode.removeChild(o);
      try { window.dispatchEvent(new Event('vs-launch-done')); } catch (e) {}
    }
    function frame(ts) {
      if (done) return; if (t0 === null) t0 = ts; var t = ts - t0;
      if (calm) { logo.setAttribute('opacity', 1); key.setAttribute('transform', 'scale(1)'); word.setAttribute('opacity', 1); }
      else {
        var p1 = cl(t / 420), p2 = cl((t - 280) / 300), p3 = cl((t - 430) / 260);
        logo.setAttribute('opacity', p1.toFixed(3)); logo.setAttribute('transform', 'translate(0 ' + (-46 * (1 - back(p1))).toFixed(2) + ')');
        key.setAttribute('transform', 'scale(' + Math.max(0, back(p2)).toFixed(3) + ')');
        word.setAttribute('opacity', (p3 * (1 - cl((t - openAt) / 160))).toFixed(3));
      }
      if (t >= openAt) {
        if (!opened) { opened = true; bootEnd(); }
        var q = cl((t - openAt) / OPEN);
        hole.setAttribute('transform', 'scale(' + (K * inout(q)).toFixed(3) + ')');
        if (q >= 1) { finish(); return; }
      }
      requestAnimationFrame(frame);
    }
    o.addEventListener('click', function () { if (!opened && t0 !== null) { openAt = Math.max(0, performance.now() - t0); } });
    requestAnimationFrame(frame);
    setTimeout(function () { if (!done) { bootEnd(); finish(); } }, 3500);   // safety net
  })();

  document.addEventListener('DOMContentLoaded', function () {
    V.renderChrome();
    V.$$('[data-text]').forEach(function (el) { var k = el.getAttribute('data-text'); if (cfg[k]) el.textContent = cfg[k]; });
    V.$$('[data-wa]').forEach(function (el) { el.href = V.wa(el.getAttribute('data-wa')); el.target = '_blank'; el.rel = 'noopener'; });
    if (V.demo && document.body && !document.body.hasAttribute('data-no-banner')) {
      var b = document.createElement('div');
      b.className = 'demo-banner';
      b.textContent = 'Demo mode: the database is not connected yet, so forms are not saved.';
      document.body.insertBefore(b, document.body.firstChild);
    }
  });

  // ---------- CSV parsing (handles quotes and commas inside quotes) ----------
  V.parseCSV = function (text) {
    text = text || '';
    // Tab-separated (a sheet published as .tsv): split on tabs instead of commas
    var first = text.split(/\r?\n/)[0] || '';
    var SEP = first.indexOf('\t') >= 0 && first.indexOf(',') < 0 ? '\t' : ',';
    var rows = [], row = [], field = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') { q = false; }
        else { field += c; }
      } else if (c === '"') { q = true; }
      else if (c === SEP) { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else { field += c; }
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    rows = rows.filter(function (r) { return r.some(function (x) { return x.trim() !== ''; }); });
    if (!rows.length) return [];
    var head = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    return rows.slice(1).map(function (r) {
      var o = {};
      head.forEach(function (h, j) { o[h] = (r[j] || '').trim(); });
      return o;
    });
  };

  // ---------- Listings ----------
  // Sheet columns: id, status, type, bedrooms, rent, area, road, building_code,
  // bathrooms, floor, furnished, amenities, available_from, deposit, notes, photos
  var listingsPromise = null;
  // Fetch a published sheet tab. The copy saved on this phone shows instantly (if under 12 hours old); the sheet refreshes it quietly.
  function sheetText(url, KEY) {
    var cached = null;
    try { cached = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
    var fresh = fetch(url, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('Could not load listings'); return r.text(); })
      .then(function (t) { try { localStorage.setItem(KEY, JSON.stringify({ url: url, t: Date.now(), csv: t })); } catch (e) {} return t; });
    var useCache = cached && cached.url === url && (Date.now() - cached.t) < 12 * 3600 * 1000;
    if (useCache) { fresh.catch(function () {}); return Promise.resolve(cached.csv); }
    return fresh;
  }
  // Listings published from admin.html -> Buildings live in Supabase (table "listings").
  // Read with a plain request so pages don't need the Supabase library. Saved on the phone like the sheet.
  function dbListings() {
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return Promise.resolve([]);
    var KEY = 'vs-dblistings-v1', cached = null;
    try { cached = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
    var fresh = fetch(cfg.SUPABASE_URL + '/rest/v1/listings?select=*&status=eq.available&order=published_at.desc', {
      headers: { apikey: cfg.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + cfg.SUPABASE_ANON_KEY }, cache: 'no-store'
    }).then(function (r) { if (!r.ok) throw new Error('listings ' + r.status); return r.json(); })
      .then(function (rows) {
        rows = (rows || []).map(function (r) {
          var o = {}; for (var k in r) o[k] = r[k] == null ? '' : String(r[k]);
          o.status = 'available'; return o;
        });
        try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), rows: rows })); } catch (e) {}
        return rows;
      });
    // Show the saved copy at once if it is fresh (2 minutes); otherwise wait for the network
    if (cached && Date.now() - cached.t < 2 * 60 * 1000) { fresh.catch(function () {}); return Promise.resolve(cached.rows); }
    return fresh.catch(function () { return cached ? cached.rows : []; });
  }
  V.loadListings = function () {
    if (listingsPromise) return listingsPromise;
    var url = cfg.LISTINGS_CSV_URL || 'data/sample-listings.csv';
    // Short stays can live in their own tab of the sheet (SHORT_STAYS_CSV_URL); every row there is a short stay.
    var shortUrl = cfg.SHORT_STAYS_CSV_URL || '';
    listingsPromise = Promise.all([
      sheetText(url, 'vs-listings-v1'),
      shortUrl ? sheetText(shortUrl, 'vs-shortstays-v1').catch(function () { return ''; }) : Promise.resolve(''),
      dbListings()
    ]).then(function (res) {
      var rows = V.parseCSV(res[0]).concat(V.parseCSV(res[1] || '').map(function (r) { r.stay = 'short'; return r; }));
      // Units published from admin -> Buildings (sheet rows win if the same id is in both)
      var seen = {}; rows.forEach(function (r) { seen[r.id] = 1; });
      (res[2] || []).forEach(function (r) { if (r.id && !seen[r.id]) rows.push(r); });
      return rows.filter(function (l) {
          return l.id && (l.status || 'available').toLowerCase() === 'available';
        }).map(function (l) {
          l.rent = V.num(l.rent) || 0;
          l.bedrooms = l.bedrooms === '' ? null : Number(l.bedrooms);
          l.amenityList = (l.amenities || '').split(/[;|]/).map(function (s) { return s.trim(); }).filter(Boolean);
          l.photoList = (l.photos || '').split(/\s+|;/).map(function (s) { return s.trim(); }).filter(Boolean);
          l.stay = /short/i.test(l.stay || '') ? 'short' : 'long';
          l.night_rate = V.num(l.night_rate) || 0;
          l.min_nights = V.num(l.min_nights) || 1;
          l.cleaning_fee = V.num(l.cleaning_fee) || 0;
          l.max_guests = V.num(l.max_guests) || Math.max(2, (l.bedrooms || 1) * 2);
          l.check_in = l.check_in || '2:00 PM';
          l.check_out = l.check_out || '11:00 AM';
          l.cancellation = l.cancellation || 'Free cancellation up to 48 hours before check-in';
          l.includedList = (l.included || '').split(/[;|]/).map(function (s) { return s.trim(); }).filter(Boolean);
          l.rulesList = (l.house_rules || '').split(/[;|]/).map(function (s) { return s.trim(); }).filter(Boolean);
          l.title = V.typeLabel(l) + ', ' + (l.road || l.area);
          l.sample = !cfg.LISTINGS_CSV_URL;
          return l;
        });
    });
    return listingsPromise;
  };
  V.getListing = function (id) {
    return V.loadListings().then(function (all) { return all.filter(function (l) { return l.id === id; })[0] || null; });
  };
  V.typeLabel = function (l) {
    var t = (l.type || '').trim();
    if (t) return T(t);
    if (l.bedrooms === 0) return T('Studio');
    return T('{n} bedroom', { n: l.bedrooms || 1 });
  };
  V.shortDesc = function (l) {
    var parts = [V.typeLabel(l)];
    if (l.bathrooms) parts.push(T('{n} bath', { n: l.bathrooms }));
    parts.push(l.road || l.area);
    return parts.join(' · ');
  };
  // Price for display: monthly rent for long stays, nightly rate for short stays
  V.price = function (l) { return l.stay === 'short' ? l.night_rate : l.rent; };
  V.per = function (l) { return l.stay === 'short' ? T('/ night') : T('/ month'); };
  V.priceText = function (l) { return 'KES ' + V.money(V.price(l)) + ' ' + V.per(l); };
  V.photoStyle = function (url) { return url ? 'background-image:url(\'' + encodeURI(url).replace(/'/g, '%27') + '\')' : ''; };

  // Score a listing against a search (used by the guided flow)
  V.matches = function (l, s) {
    if (s.stay && (s.stay === 'short') !== (l.stay === 'short')) return false;
    if (s.area) {
      var hay = ((l.area || '') + ' ' + (l.road || '')).toLowerCase();
      // Every word of the area must appear as a whole word (so "South C" never matches "South B")
      var words = s.area.toLowerCase().split(/[\s,]+/).filter(function (w) { return w && ['near', 'the', 'road'].indexOf(w) < 0; });
      var tokens = hay.split(/[^a-z0-9]+/);
      if (words.length && !words.every(function (w) { return tokens.indexOf(w) >= 0; })) return false;
    }
    if (s.bedrooms !== undefined && s.bedrooms !== null && s.bedrooms !== '') {
      var b = Number(s.bedrooms);
      if (b >= 3 ? (l.bedrooms || 0) < 3 : l.bedrooms !== b) return false;
    }
    var price = V.price(l);
    if (s.min && price < s.min) return false;
    if (s.max && price > s.max) return false;
    // Schools / space for kids are checked by our team, not filtered by the sheet (yet)
    var hard = (s.must || []).filter(function (m) { return V.SOFT_MUST.indexOf(m) < 0; });
    if (hard.length) {
      s = { must: hard };
      var am = l.amenityList.map(function (a) { return a.toLowerCase(); }).join(' | ');
      for (var i = 0; i < s.must.length; i++) {
        var key = s.must[i].toLowerCase().split(/[\s/]+/)[0];
        if (am.indexOf(key) < 0) return false;
      }
    }
    return true;
  };

  V.SOFT_MUST = ['Schools nearby', 'Space for kids'];

  // Search state shared across the guided flow pages
  V.getSearch = function () {
    try { return JSON.parse(sessionStorage.getItem('viustay_search') || '{}'); } catch (e) { return {}; }
  };
  V.setSearch = function (s) {
    try { sessionStorage.setItem('viustay_search', JSON.stringify(s)); } catch (e) { /* private mode: keep going */ }
  };

  // Insert a row into Supabase (or pretend, in demo mode)
  V.insert = function (table, row) {
    if (V.demo) { console.info('[demo] would save to', table, row); return Promise.resolve({ demo: true }); }
    return V.ensureDb().then(function (db) { return db.from(table).insert(row); }).then(function (res) { if (res.error) throw res.error; return res; });
  };

  // ---------- Pull down to refresh (item 22) ----------
  // The installed app has no browser refresh, so: pull down at the top of a page -> spinner -> fresh data.
  // A page can handle 'vs-refresh' itself (call e.preventDefault()) to reload just its data; otherwise the page reloads.
  (function () {
    var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true || /[?&]ptr=1/.test(location.search);
    if (!standalone || !('ontouchstart' in window)) return;
    var y0 = null, dy = 0, el = null, busy = false, MAX = 90, GO = 64;
    function blocked(t) { return document.body.hasAttribute('data-no-ptr') || (t.closest && t.closest('.leaflet-container, .tk-screen, .mb-sheet-wrap, .md-sheet, [data-no-ptr], input, textarea, select')); }
    function ui() {
      if (el) return el;
      el = document.createElement('div'); el.className = 'ptr'; el.setAttribute('aria-hidden', 'true');
      el.innerHTML = '<span class="ptr-ball"><svg viewBox="0 0 28 34"><path d="M14 33S2 21 2 13a12 12 0 0 1 24 0c0 8-12 20-12 20Z" fill="#1554D1"/><circle cx="14" cy="13" r="5" fill="#111111"/></svg></span>';
      document.body.appendChild(el); return el;
    }
    function set(d, anim) { var e = ui(); e.style.transition = anim ? 'transform .25s, opacity .25s' : 'none'; e.style.transform = 'translate(-50%,' + (d - 50) + 'px)'; e.style.opacity = Math.min(1, d / GO); e.querySelector('svg').style.transform = 'rotate(' + d * 4 + 'deg)'; }
    document.addEventListener('touchstart', function (e) {
      if (busy || window.scrollY > 0 || document.scrollingElement.scrollTop > 0 || e.touches.length !== 1 || blocked(e.target)) { y0 = null; return; }
      y0 = e.touches[0].clientY; dy = 0;
    }, { passive: true });
    document.addEventListener('touchmove', function (e) {
      if (y0 === null) return;
      dy = Math.max(0, Math.min(MAX, (e.touches[0].clientY - y0) * .5));
      if (window.scrollY > 0) { y0 = null; set(0, true); return; }
      if (dy > 4) set(dy);
    }, { passive: true });
    document.addEventListener('touchend', function () {
      if (y0 === null) return; y0 = null;
      if (dy < GO) { set(0, true); return; }
      busy = true; set(GO, true); ui().classList.add('spin');
      var ev; try { ev = new CustomEvent('vs-refresh', { cancelable: true }); } catch (x) { ev = document.createEvent('CustomEvent'); ev.initCustomEvent('vs-refresh', false, true, null); }
      var handled = !window.dispatchEvent(ev);
      if (!handled) { setTimeout(function () { location.reload(); }, 250); return; }
      setTimeout(function () { busy = false; ui().classList.remove('spin'); set(0, true); }, 900);
    });
  })();
})();

// ---------- Guide: the 8 motion rules, shared by every form ----------
// Rise in · One pulse, once · Dim what's done · Button wakes up · Progress fills · Gentle shake · Scroll to it · Calm down.
// Forms opt in with data-guide. Only ONE thing asks for attention at a time.
(function () {
  var V = window.V = window.V || {};
  function calm() { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function once(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); var t = setTimeout(done, 1400); function done() { clearTimeout(t); el.classList.remove(cls); el.removeEventListener('animationend', done); } el.addEventListener('animationend', done); }
  function seen(el) { return !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length)); }
  var G = V.Guide = {
    calm: calm,
    rise: function (el) { once(el, 'g-rise'); },
    pulse: function (el) { once(el, 'g-pulse'); },
    shake: function (el) { once(el, 'g-shake'); if (navigator.vibrate && !calm()) try { navigator.vibrate(30); } catch (e) {} },
    scrollTo: function (el, block) {
      if (!el) return; var r = el.getBoundingClientRect(), vh = window.innerHeight, bar = document.body.classList.contains('has-tabs') ? 90 : 20;
      if (r.top >= 70 && r.bottom <= vh - bar - 70) return;   // already in view: don't move the page
      el.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: block || 'center' });
    },
    wake: function (btn, on) {
      if (!btn) return; var was = !btn.classList.contains('g-asleep');
      btn.classList.toggle('g-asleep', !on);
      if (on && !was) once(btn, 'g-wake');
    },
    // A step is done when every visible, non-optional input in it is filled.
    filled: function (step) {
      var ok = true, any = false;
      Array.prototype.forEach.call(step.querySelectorAll('input, select, textarea'), function (i) {
        if (i.type === 'hidden' || i.disabled || i.hasAttribute('data-opt') || i.closest('[data-opt]') || !seen(i)) return;
        if (i.tagName === 'TEXTAREA' && !i.required) return;
        any = true;
        var v = (i.value || '').trim();
        if (i.type === 'checkbox' || i.type === 'radio') { if (!i.checked && !(i.type === 'radio' && step.querySelector('input[name="' + i.name + '"]:checked'))) ok = false; }
        else if (i.type === 'tel') { if (!(V.phoneOk ? V.phoneOk(v) : v.length >= 9)) ok = false; }
        else if (i.type === 'email') { if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) ok = false; }
        else if (i.type === 'password') { if (v.length < (+i.getAttribute('minlength') || 1)) ok = false; }
        else if (!v) ok = false;
      });
      if (step.classList.contains('chips') || step.hasAttribute('data-pick')) { any = true; ok = !!step.querySelector('[aria-pressed="true"], .on, .is-on, .active'); }
      return any ? ok : undefined;   // nothing to fill here (e.g. an optional note)
    },
    steps: function (root) {
      return Array.prototype.filter.call(root.querySelectorAll('[data-step], .field, .check, .chips'), function (s) {
        if (!seen(s) || s.closest('[data-opt]') || s.hasAttribute('data-opt')) return false;
        var p = s.parentNode && s.parentNode.closest('[data-step], .field, .check'); return !p || !root.contains(p) || p === root;   // outermost only
      });
    },
    // Attach to a form or block. opts.button: the main button; opts.ready(): extra conditions; opts.onChange(allDone)
    form: function (root, opts) {
      if (!root || root._guide) return root && root._guide; opts = opts || {};
      var started = false;
      function btn() { if (opts.button) return typeof opts.button === 'function' ? opts.button() : opts.button; var bs = Array.prototype.filter.call(root.querySelectorAll('[type=submit], .btn-primary, [data-next]'), seen); return bs.filter(function (b) { return !b.classList.contains('btn-link'); })[0]; }
      function refresh(moveFocus) {
        var list = G.steps(root), now = null;
        list.forEach(function (s) {
          var d = G.filled(s);
          s.classList.toggle('g-done', d === true && started);
          if (d === false && !now) now = s;
        });
        list.forEach(function (s) {
          var was = s.classList.contains('g-now');
          s.classList.toggle('g-now', s === now && started);
          if (s === now && started && !was && moveFocus) { G.pulse(s); }
        });
        var all = !now && (!opts.ready || opts.ready());
        G.wake(btn(), all);
        if (opts.onChange) opts.onChange(all, now);
        return now;
      }
      function go() { started = true; refresh(true); }
      root.addEventListener('focusin', function () { if (!started) { started = true; refresh(false); } });
      root.addEventListener('focusout', function () { setTimeout(function () { refresh(true); }, 0); });
      root.addEventListener('change', function () { setTimeout(go, 0); });
      root.addEventListener('click', function (e) { if (e.target.closest('.chip, [aria-pressed]')) setTimeout(go, 0); });
      root.addEventListener('input', function () { started = true; var b = btn(), list = G.steps(root); G.wake(b, list.every(function (s) { return G.filled(s) !== false; }) && (!opts.ready || opts.ready())); });
      // Pressing the sleeping button: show what's missing (shake it, take them there)
      document.addEventListener('click', function (e) {
        var b = e.target.closest('.g-asleep'); if (!b || !(root.contains(b) || b === btn())) return;
        started = true;   // never block: the page's own checks still run, we only point at what's missing
 var now = (opts.blocked && opts.blocked()) || refresh(false);
        if (now && now !== true) { setTimeout(function () { G.shake(now); G.scrollTo(now); var i = now.querySelector('input:not([type=hidden]), select, textarea'); if (i && i.type !== 'checkbox' && i.type !== 'radio') i.focus({ preventScroll: true }); }, 30); }
      }, true);
      // Things that appear inside a guided form rise in
      if (window.MutationObserver) new MutationObserver(function (ms) {
        ms.forEach(function (m) {
          var el = m.target; if (m.attributeName !== 'class') return;
          if (/(^|\s)hidden(\s|$)/.test(m.oldValue || '') && !el.classList.contains('hidden')) { G.rise(el); setTimeout(function () { refresh(false); }, 0); }
        });
      }).observe(root, { attributes: true, attributeOldValue: true, subtree: true, attributeFilter: ['class'] });
      root._guide = { refresh: refresh, start: go };
      setTimeout(function () { refresh(false); }, 0);
      return root._guide;
    }
  };
  // Error messages shake once and come into view, everywhere on the site.
  function watchErrors() {
    if (!window.MutationObserver) return;
    new MutationObserver(function (ms) {
      ms.forEach(function (m) {
        var el = m.target.nodeType === 1 ? m.target : m.target.parentNode;
        if (!el || !el.matches || !el.matches('.error, [role=alert]')) return;
        if (el.classList.contains('hidden') || !(el.textContent || '').trim() || !seen(el)) { el._gTxt = ''; return; }
        if (el._gTxt === el.textContent) return; el._gTxt = el.textContent;
        G.shake(el); G.scrollTo(el);
      });
    }).observe(document.body, { attributes: true, attributeFilter: ['class'], childList: true, characterData: true, subtree: true });
  }
  function boot() { watchErrors(); Array.prototype.forEach.call(document.querySelectorAll('[data-guide]'), function (f) { G.form(f); }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

// ---------- UI 2.0: context-aware chrome + the shared home card ----------
(function () {
  var V = window.V = window.V || {};
  // Header gets a hairline once you scroll; the tab bar shrinks while you scroll down and grows back when you scroll up.
  var lastY = 0, ticking = false;
  function onScroll() {
    var y = window.scrollY || 0, b = document.body; if (!b) return;
    b.classList.toggle('ui-scrolled', y > 8);
    if (Math.abs(y - lastY) > 6) { b.classList.toggle('ui-down', y > lastY && y > 120); lastY = y; }
    ticking = false;
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  // One card design for homes everywhere (image first, the photo is the hero)
  // Viu AI sphere (futuristic, animated): <span class="vai"> ... "AI"
  V.sphere = function (size, mini) {
    return '<span class="vai' + (mini ? ' vai-sm' : '') + '" style="--s:' + size + 'px" aria-hidden="true"><span class="vai-core"></span><span class="vai-ring"></span><span class="vai-orbit"><b></b></span><em>AI</em></span>';
  };
  // Saved homes (favourites, any number). The 3-home viewing trip is separate (V.TripBasket in app.js).
  V.Favs = {
    ids: function () { try { return JSON.parse(localStorage.getItem('vs-favs') || '[]'); } catch (e) { return []; } },
    has: function (id) { return V.Favs.ids().indexOf(id) >= 0; },
    toggle: function (id) { var a = V.Favs.ids(), i = a.indexOf(id); if (i >= 0) a.splice(i, 1); else a.unshift(id); try { localStorage.setItem('vs-favs', JSON.stringify(a)); } catch (e) {} try { window.dispatchEvent(new CustomEvent('vs-favs')); } catch (e) {} return i < 0; }
  };
  document.addEventListener('click', function (e) {
    var h = e.target.closest && e.target.closest('[data-fav]'); if (!h) return;
    e.preventDefault(); e.stopPropagation();
    var on = V.Favs.toggle(h.getAttribute('data-fav'));
    Array.prototype.forEach.call(document.querySelectorAll('[data-fav="' + h.getAttribute('data-fav') + '"]'), function (x) { x.setAttribute('aria-pressed', String(on)); });
    h.classList.remove('pop'); void h.offsetWidth; h.classList.add('pop');
    if (V.toast) V.toast(on ? V.t('Saved. Find it in Saved.') : V.t('Removed from Saved'));
  }, true);
  if (!V.toast) V.toast = function (msg) {
    var t = document.querySelector('.app-toast'); if (!t) { t = document.createElement('div'); t.className = 'app-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.remove('on'); void t.offsetWidth; t.classList.add('on'); clearTimeout(V._tt); V._tt = setTimeout(function () { t.classList.remove('on'); }, 2200);
  };
  V.heart = function (id) { var on = V.Favs.has(id); return '<span class="fav" role="button" tabindex="0" data-fav="' + V.esc(id) + '" aria-pressed="' + on + '" aria-label="' + V.esc(V.t('Save')) + '"><svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg></span>'; };
  V.cardHTML = function (l) {
    var T = V.t, sh = l.stay === 'short';
    return '<a class="card" data-id="' + V.esc(l.id) + '" href="home.html?id=' + encodeURIComponent(l.id) + '">' +
      '<span class="photo" style="' + V.photoStyle(l.photoList[0]) + '">' + (l.photoList[0] ? '' : V.esc(T('Photo coming soon'))) + '<span class="badge">' + V.esc(T('Verified')) + '</span>' + V.heart(l.id) + '</span>' +
      '<span class="body"><span class="price">KES ' + V.money(V.price(l)) + ' <small>' + V.esc(V.per(l)) + '</small></span>' +
      '<span class="desc">' + V.esc(V.shortDesc(l)) + ' · ' + V.esc(l.area) + (sh ? ' · ' + V.esc(T('Up to {n} guests', { n: l.max_guests })) : '') + '</span>' +
      '<span class="tags">' + V.esc((sh && l.includedList && l.includedList.length ? l.includedList : (l.amenityList || [])).slice(0, 3).map(function (x) { return T(x); }).join(' · ')) + '</span></span></a>';
  };
})();

// ---------- UI 2.1 motion: tap ripples, scroll reveals, count-ups ----------
(function () {
  var V = window.V = window.V || {};
  var calm = function () { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); };
  // Ripple where you tap
  var RIP = '.btn, .door, .q-opt, .chip, .search-pill, .doors-help, .fbtn, .sc-guests button, .su-kind, .md-btn';
  document.addEventListener('pointerdown', function (e) {
    if (calm()) return; var el = e.target.closest && e.target.closest(RIP); if (!el || el.disabled) return;
    var r = el.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2, s = document.createElement('span');
    s.className = 'rp'; s.style.width = s.style.height = d + 'px'; s.style.left = (e.clientX - r.left - d / 2) + 'px'; s.style.top = (e.clientY - r.top - d / 2) + 'px';
    el.appendChild(s); setTimeout(function () { s.remove(); }, 650);
  }, { passive: true });
  // Cards, tiles and sections rise in as they come into view
  var SEL = '.card, .area-tile, .bento > div, .grp .hx-h, .panel, .mb-tk, .ad-row, .md-start';
  var io = window.IntersectionObserver && !calm() ? new IntersectionObserver(function (es) {
    es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('rv-in'); io.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -6% 0px' }) : null;
  function scan(root) {
    if (!io) return;
    Array.prototype.forEach.call((root || document).querySelectorAll(SEL), function (el, i) {
      if (el.classList.contains('rv')) return;
      var r = el.getBoundingClientRect(); if (r.top < innerHeight * .9 && r.bottom > 0) return;   // already on screen: leave it
      el.classList.add('rv'); el.style.transitionDelay = Math.min(i % 4, 3) * 60 + 'ms'; io.observe(el);
    });
  }
  V.reveal = scan;
  if (window.MutationObserver) new MutationObserver(function () { clearTimeout(scan._t); scan._t = setTimeout(function () { scan(); }, 60); }).observe(document.documentElement, { childList: true, subtree: true });
  // Numbers count up the first time they appear (live counts on the home page)
  V.countUp = function (el) {
    if (!el || calm()) return; var txt = el.textContent, m = txt.match(/\d+/g); if (!m) return;
    var t0 = null, dur = 700;
    function step(t) { if (!t0) t0 = t; var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3), i = 0;
      el.textContent = txt.replace(/\d+/g, function (n) { return String(Math.round(Number(m[i++]) * e)); }); if (p < 1) requestAnimationFrame(step); }
    requestAnimationFrame(step);
  };
})();
