// Shared helpers: Supabase client, listings loader, small utilities.
(function () {
  var cfg = window.VIUSTAY_CONFIG || {};
  var V = {};
  window.V = V;

  V.cfg = cfg;
  V.demo = !(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  V.db = V.demo ? null : window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

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
          '<span style="flex:1 1 auto"></span><span class="muted" id="flow-summary"></span></div>' +
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
            ? '<a href="index.html">Find a home</a><a href="owners.html#how">How it works</a><a href="owners.html#caretakers">Caretakers</a>'
            : '<a href="homes.html">Rent</a><a href="homes.html?stay=short">Short stays</a><a href="how-it-works.html">How it works</a><a href="about.html">About</a><a href="owners.html">List your property</a>') +
          '</nav><div class="header-actions">' +
          (owners
            ? '<a class="btn btn-pill btn-light" href="dashboard.html">Manager log in</a>'
            : '<a class="btn btn-pill btn-primary" href="index.html">Help me choose</a>') +
          '</div><div class="menu-looks" role="group" aria-label="Colour look"></div></div></div>';
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
        '<div class="footer-brand brand" style="display:block"><img class="logo-pearl" src="assets/viustay-logo-colour.svg" alt="Viustay" style="height:28px;width:auto"><img class="logo-night" src="assets/viustay-logo-white.svg" alt="Viustay" style="height:28px;width:auto"><p>Find your place. We handle the rest.</p><p>Mon–Sat, 8:00 AM – 5:00 PM</p></div>' +
        '<nav aria-label="Renters"><strong>Renters</strong><a href="index.html">Guided search</a><a href="homes.html">All homes</a><a href="areas.html">Area guides</a><a href="how-it-works.html">How it works</a></nav>' +
        '<nav aria-label="Owners"><strong>Owners</strong><a href="owners.html">For owners</a><a href="list-property.html">List your property</a><a href="dashboard.html">Manager log in</a></nav>' +
        '<nav aria-label="Company"><strong>Company</strong><a href="about.html">About</a><a href="investors.html">Investors</a><a href="faq.html">FAQ</a><a href="contact.html">Contact</a></nav>' +
        '<nav aria-label="Legal"><strong>Legal</strong><a href="terms.html">Terms</a><a href="privacy.html">Privacy</a></nav>' +
        '</div><div class="container footer-base"><span>&copy; ' + new Date().getFullYear() + ' Viustay · Nairobi, Kenya</span><span>Draft website · Version 2</span></div>';
    }
    // Floating WhatsApp button on every page except the dashboard
    if (!body.hasAttribute('data-no-wa') && !V.$('.wa-float')) {
      var wa = document.createElement('a');
      wa.className = 'wa-float';
      wa.href = V.wa('Hi Viustay, I have a question');
      wa.target = '_blank'; wa.rel = 'noopener';
      wa.setAttribute('aria-label', 'Chat with Viustay on WhatsApp');
      wa.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3 1 2.5c.1.2 1.6 2.5 4 3.5 1.5.6 2 .7 2.8.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.5-.3Z"/></svg>';
      body.appendChild(wa);
    }
  };

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
    var rows = [], row = [], field = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') { q = false; }
        else { field += c; }
      } else if (c === '"') { q = true; }
      else if (c === ',') { row.push(field); field = ''; }
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
  V.loadListings = function () {
    if (listingsPromise) return listingsPromise;
    var url = cfg.LISTINGS_CSV_URL || 'data/sample-listings.csv';
    listingsPromise = fetch(url, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('Could not load listings'); return r.text(); })
      .then(function (t) {
        return V.parseCSV(t).filter(function (l) {
          return l.id && (l.status || 'available').toLowerCase() === 'available';
        }).map(function (l) {
          l.rent = V.num(l.rent) || 0;
          l.bedrooms = l.bedrooms === '' ? null : Number(l.bedrooms);
          l.amenityList = (l.amenities || '').split(/[;|]/).map(function (s) { return s.trim(); }).filter(Boolean);
          l.photoList = (l.photos || '').split(/\s+|;/).map(function (s) { return s.trim(); }).filter(Boolean);
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
    if (t) return t;
    if (l.bedrooms === 0) return 'Studio';
    return (l.bedrooms || 1) + ' bedroom';
  };
  V.shortDesc = function (l) {
    var parts = [V.typeLabel(l)];
    if (l.bathrooms) parts.push(l.bathrooms + ' bath');
    parts.push(l.road || l.area);
    return parts.join(' · ');
  };
  V.photoStyle = function (url) { return url ? 'background-image:url(\'' + encodeURI(url).replace(/'/g, '%27') + '\')' : ''; };

  // Score a listing against a search (used by the guided flow)
  V.matches = function (l, s) {
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
    if (s.min && l.rent < s.min) return false;
    if (s.max && l.rent > s.max) return false;
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
    return V.db.from(table).insert(row).then(function (res) { if (res.error) throw res.error; return res; });
  };
})();
