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
          '<button type="button" class="menu-toggle" aria-expanded="false" aria-controls="menu-panel" aria-label="Open menu"><span></span><span></span><span></span></button>' +
          '<div class="menu-panel" id="menu-panel">' +
          '<nav class="site-nav" aria-label="Main">' +
          (owners
            ? '<a href="index.html">' + T('Find a home') + '</a><a href="owners.html#how">' + T('How it works') + '</a><a href="owners.html#caretakers">' + T('Caretakers') + '</a>'
            : '<a href="homes.html">' + T('Rent') + '</a><a href="homes.html?stay=short">' + T('Short stays') + '</a><a href="trip.html">' + T('My bookings') + '</a><a href="owners.html">' + T('For owners') + '</a>' +
              '<details class="nav-more"><summary>' + T('More') + '</summary><div class="nav-more-list"><a href="how-it-works.html">' + T('How it works') + '</a><a href="about.html">' + T('About') + '</a><a href="list-property.html">' + T('List your property') + '</a><a href="contact.html">' + T('Contact') + '</a></div></details>' +
              '<a class="nav-extra" href="how-it-works.html">' + T('How it works') + '</a><a class="nav-extra" href="about.html">' + T('About') + '</a><a class="nav-extra" href="contact.html">' + T('Contact') + '</a>') +
          '</nav><div class="header-actions">' +
          (owners
            ? '<a class="btn btn-pill btn-light" href="dashboard.html">' + T('Manager log in') + '</a>'
            : '<a class="btn btn-pill btn-primary" href="index.html">' + T('Help me choose') + '</a>') +
          V.langSelect() +
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
    var foot = V.$('#site-footer');
    if (foot) {
      foot.className = 'site-footer';
      foot.innerHTML =
        '<div class="container footer-grid">' +
        '<div class="footer-brand brand" style="display:block"><img class="logo-pearl" src="assets/viustay-logo-colour.svg" alt="Viustay" style="height:28px;width:auto"><img class="logo-night" src="assets/viustay-logo-white.svg" alt="Viustay" style="height:28px;width:auto"><p>' + T('Find your place. We handle the rest.') + '</p><p>' + T('Mon–Sat, 8:00 AM – 5:00 PM') + '</p></div>' +
        '<nav aria-label="Renters"><strong>' + T('Renters') + '</strong><a href="index.html">' + T('Guided search') + '</a><a href="homes.html">' + T('All homes') + '</a><a href="homes.html?stay=short">' + T('Short stays') + '</a><a href="areas.html">' + T('Area guides') + '</a><a href="trip.html">' + T('My bookings') + '</a></nav>' +
        '<nav aria-label="Owners"><strong>' + T('Owners') + '</strong><a href="owners.html">' + T('For owners') + '</a><a href="list-property.html">' + T('List your property') + '</a><a href="dashboard.html">' + T('Manager log in') + '</a><a href="agent.html">' + T('Agent log in') + '</a></nav>' +
        '<nav aria-label="Company"><strong>' + T('Company') + '</strong><a href="about.html">' + T('About') + '</a><a href="investors.html">' + T('Investors') + '</a><a href="faq.html">FAQ</a><a href="contact.html">' + T('Contact') + '</a></nav>' +
        '<nav aria-label="Legal"><strong>' + T('Legal') + '</strong><a href="terms.html">' + T('Terms') + '</a><a href="privacy.html">' + T('Privacy') + '</a></nav>' +
        '</div><div class="container footer-base"><span>&copy; ' + new Date().getFullYear() + ' Viustay · Nairobi, Kenya</span><span>' + T('Draft website · Version 2') + '</span></div>';
    }
    // Floating WhatsApp button on every page except the dashboard
    if (!body.hasAttribute('data-no-wa') && !V.$('.wa-float')) {
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
    var o = document.createElement('div');
    o.className = 'vs-launch'; o.setAttribute('aria-hidden', 'true');
    o.innerHTML = '<svg viewBox="0 0 40 46"><path class="pin" d="M20 2 C10 2 3 9.5 3 19 C3 31 20 44 20 44 C20 44 37 31 37 19 C37 9.5 30 2 20 2 Z" fill="#0A4740" stroke="rgba(255,255,255,.18)" stroke-width=".6"/>' +
      '<path class="roof" d="M10.5 17 L20 9.5 L29.5 17" fill="none" stroke="#F2A93B" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path class="vee" d="M13.5 19.5 L20 29 L26.5 19.5" fill="none" stroke="#F4F1EB" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="word">viustay</span>';
    b.appendChild(o);
    var done = false;
    window.VS_LAUNCHING = true;
    function end() { if (done) return; done = true; bootEnd(); o.classList.add('out'); window.VS_LAUNCHING = false; try { window.dispatchEvent(new Event('vs-launch-done')); } catch (e) {} setTimeout(function () { if (o.parentNode) o.parentNode.removeChild(o); }, 320); }
    o.addEventListener('click', end);
    setTimeout(end, window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches ? 450 : 1150);
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
})();
