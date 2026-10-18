// Admin -> Buildings: buildings registered by managers, their progress, and Publish.
// Publish = units go live on the homes page (Supabase "listings"), each unit gets its listing id,
// and the building is marked Live. Photos are file names in GitHub (v2/assets).
(function () {
  var V = window.V;
  var S = { buildings: [], units: [], open: null, filter: 'waiting', form: {} };
  var BEDS = { 'Bedsitter / studio': 0, 'One bedroom': 1, 'Two bedroom': 2, 'Three bedroom': 3, 'Four bedroom +': 4 };
  var LABEL = { 'Bedsitter / studio': 'Studio', 'One bedroom': '1 bedroom', 'Two bedroom': '2 bedrooms', 'Three bedroom': '3 bedrooms', 'Four bedroom +': '4 bedrooms' };
  // Manager's form words -> the words the homes search uses
  var AM = { 'Daily': 'Water 24/7', 'Guards': 'Security guard', 'Backup generator': 'Backup power', 'Included in rent': 'Water included', 'Metered': 'Water metered',
    'Some days': '', 'Token': 'Token electricity', 'Postpaid': 'Postpaid electricity', 'Included': 'Garbage included', 'Charged monthly': '' };

  function esc(s) { return V.esc(s == null ? '' : String(s)); }
  function day(d) { return d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : ''; }
  function D(b) { return b.details || {}; }
  function bUnits(b) { return S.units.filter(function (u) { return u.building_id === b.id; }); }
  function photoPath(name) { name = String(name || '').trim(); if (!name) return ''; return /^(https?:|assets\/|\/)/.test(name) ? name : 'assets/' + name; }
  function photoList(txt) { return String(txt || '').split(/[\s,;]+/).map(photoPath).filter(Boolean); }
  function stage(b) {
    var us = bUnits(b);
    if (b.status === 'live') return 3;
    if (us.some(function (u) { return u.photos; })) return 2;
    if (b.visit_date && b.visit_date < new Date().toISOString().slice(0, 10)) return 2;
    return 1;
  }
  function cover(b) {
    var url = D(b).photo_url;
    if (!url) { var u = bUnits(b).filter(function (x) { return x.photos; })[0]; if (u) url = photoList(u.photos)[0]; }
    return url;
  }
  function amenities(b, u) {
    var sv = D(b).services || {}, out = [];
    ['water_source', 'water_supply', 'water_billing', 'electricity', 'security', 'parking', 'garbage', 'amenities'].forEach(function (k) {
      (sv[k] || []).forEach(function (v) { var m = AM.hasOwnProperty(v) ? AM[v] : v; if (m && out.indexOf(m) < 0) out.push(m); });
    });
    if (sv.other) out.push(sv.other);
    if ((D(b).rules || {}).pets === 'Allowed') out.push('Pet friendly');
    if (u && (u.furnished === 'Fully' || u.furnished === 'Semi')) out.push('Furnished');
    return out.join(';');
  }

  var css = '.ba-row{display:flex;align-items:center;gap:16px;padding:14px 16px;border-radius:18px;background:#fff;border:1px solid rgba(17, 17, 17,.1);box-shadow:0 6px 18px rgba(14,60,52,.05);flex-wrap:wrap}' +
    '.ba-thumb{width:84px;height:64px;border-radius:12px;flex:none;background:linear-gradient(160deg,#7FB9A8,#111111) center/cover}' +
    '.ba-pipe{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.ba-pipe span{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600}' +
    '.ba-pipe b{width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;border:2px solid rgba(17, 17, 17,.3)}' +
    '.ba-pipe .d b{background:#111111;border-color:#111111;color:#fff}.ba-pipe .n b{border:5px solid #0E5E54}.ba-pipe .t{color:rgba(17, 17, 17,.45)}.ba-pipe i{width:18px;height:2px;background:#E2DDD3}.ba-pipe i.d{background:#111111}' +
    '.ba-chip{border:1px solid rgba(17, 17, 17,.18);background:#fff;border-radius:99px;padding:7px 14px;font-size:14px;font-weight:600;font-family:inherit;cursor:pointer}.ba-chip[aria-pressed=true]{background:#111111;color:#fff;border-color:#111111}' +
    '.ba-units{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:12px}' +
    '.ba-unit{background:#fff;border:1px solid rgba(17, 17, 17,.12);border-radius:16px;padding:14px 16px;display:flex;flex-direction:column;gap:10px}' +
    '.ba-unit.on{border-color:#111111;box-shadow:inset 0 0 0 1px #111111}' +
    '.ba-unit input[type=text],.ba-unit select,.ba-unit textarea{width:100%;border:1.5px solid rgba(17, 17, 17,.2);border-radius:10px;padding:9px 11px;font-size:15px;font-family:inherit;background:#fff;color:#111111;box-sizing:border-box}' +
    '.ba-unit textarea{min-height:60px;resize:vertical}' +
    '.ba-th{display:flex;gap:6px;flex-wrap:wrap;min-height:20px}.ba-th img{width:64px;height:48px;object-fit:cover;border-radius:8px;background:#EEE}' +
    '.ba-th .bad{font-size:12px;color:#A32D2D;font-weight:600}' +
    '.ba-ph{position:relative;display:inline-block}.ba-ph img{width:78px;height:58px}.ba-ph.cover img{outline:3px solid #0E5E54;outline-offset:1px}' +
    '.ba-ph button{position:absolute;top:3px;width:22px;height:22px;border-radius:50%;border:0;background:rgba(0,0,0,.55);color:#fff;font-size:12px;line-height:22px;padding:0;cursor:pointer}' +
    '.ba-ph [data-cover]{left:3px}.ba-ph.cover [data-cover]{background:#0E5E54;color:#FFFFFF}.ba-ph [data-rm]{right:3px}' +
    '.ba-sq{width:40px;height:40px;border-radius:11px;background:#E7F2EE;color:#111111;font:600 15px Plus Jakarta Sans,sans-serif;display:inline-flex;align-items:center;justify-content:center;flex:none}' +
    '.ba-kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;font-size:14px}.ba-kv span{color:var(--muted);display:block;font-size:12px}' +
    '.ba-bar{position:sticky;bottom:0;background:#fff;border-radius:16px;box-shadow:0 -6px 20px rgba(20,40,36,.1);padding:12px 14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;z-index:5}' +
    '.ba-pill{font-size:12px;font-weight:600;padding:3px 10px;border-radius:99px;white-space:nowrap}.ba-live{background:#F4F4F2;color:#1F1F1F}.ba-wait{background:#FDF0DA;color:#6B6B6B}.ba-let{background:#ECECEA;color:#5F5E5A}';

  function pipe(st) {
    var names = ['Registered', 'Photo visit', 'Photos in GitHub', 'Live'], h = '';
    names.forEach(function (n, i) {
      var c = i < st || (i === 3 && st === 3) ? 'd' : i === st ? 'n' : 't';
      h += '<span class="' + c + '"><b>' + (c === 'd' ? '✓' : '') + '</b>' + n + '</span>' + (i < 3 ? '<i class="' + (i < st ? 'd' : '') + '"></i>' : '');
    });
    return '<div class="ba-pipe">' + h + '</div>';
  }

  function load() {
    var el = V.$('#b-main');
    el.innerHTML = '<h1 style="font-size:30px">Buildings</h1>' + (V.skel ? V.skel.rows(3) : '<p class="note">Loading…</p>');
    return Promise.all([
      V.db.from('buildings').select('*').order('created_at', { ascending: false }),
      V.db.from('units').select('*').order('label')
    ]).then(function (r) {
      if (r[0].error) throw r[0].error; if (r[1].error) throw r[1].error;
      S.buildings = r[0].data || []; S.units = r[1].data || [];
      render();
    }).catch(function (e) {
      console.error(e);
      el.innerHTML = '<h1 style="font-size:30px">Buildings</h1><p class="error">Could not load buildings. Did you run supabase/add-publish.sql?</p>';
    });
  }

  function render() { if (S.open) drawBuilding(); else drawList(); }

  function drawList() {
    var el = V.$('#b-main');
    var waiting = S.buildings.filter(function (b) { return b.status !== 'live'; });
    var shown = S.filter === 'waiting' ? waiting : S.filter === 'live' ? S.buildings.filter(function (b) { return b.status === 'live'; }) : S.buildings;
    el.innerHTML = '<div class="actions" style="justify-content:space-between;align-items:flex-end"><div><h1 style="font-size:30px">Buildings</h1><p class="note" style="margin:2px 0 0">Registered by managers. Open one to publish its vacancies.</p></div>' +
      '<div class="actions" style="gap:8px">' + [['waiting', 'Waiting ' + waiting.length], ['live', 'Live ' + (S.buildings.length - waiting.length)], ['all', 'All ' + S.buildings.length]].map(function (f) {
        return '<button type="button" class="ba-chip" data-f="' + f[0] + '" aria-pressed="' + (S.filter === f[0]) + '">' + f[1] + '</button>';
      }).join('') + '<button type="button" class="btn btn-outline" data-reload style="font-size:15px;padding:8px 14px">Refresh</button></div></div>' +
      '<div class="stack-sm" style="gap:12px">' + (shown.map(function (b) {
        var us = bUnits(b), vac = us.filter(function (u) { return u.status === 'vacant'; }), wait = vac.filter(function (u) { return !u.listing_id; });
        var c = D(b).contacts || {}, st = stage(b), img = cover(b);
        var sub = b.status === 'live' ? 'Live · ' + vac.length + ' vacant' + (wait.length ? ' · ' + wait.length + ' waiting for photos' : '') :
          (b.visit_date ? 'Photo visit ' + day(b.visit_date) + (b.visit_time ? ', ' + b.visit_time.toLowerCase() : '') : 'No visit day yet, call to book') + ' · ' + vac.length + ' vacancies added';
        var btn = st === 3 && !wait.length ? 'btn btn-outline' : 'btn btn-primary';
        return '<div class="ba-row"><span class="ba-thumb"' + (img ? ' style="background-image:url(\'' + esc(img) + '\')"' : '') + '></span>' +
          '<span style="flex:0 1 250px;min-width:200px;line-height:1.35"><strong style="font-size:16px">' + esc(b.name) + '</strong><br><span class="note" style="font-size:13px">' + esc([b.road, b.location].filter(Boolean).join(', ')) + ' · ' + esc(b.code) + '</span><br>' +
          '<span class="note" style="font-size:12px">' + esc([c.person || b.owner_email, c.phone].filter(Boolean).join(' · ')) + '</span></span>' +
          '<span style="flex:1 1 300px">' + pipe(st) + '<span class="note" style="font-size:12px;display:block;margin-top:6px">' + esc(sub) + '</span></span>' +
          '<button type="button" class="' + btn + '" data-open="' + b.id + '" style="font-size:15px;padding:10px 18px;min-height:42px">' + (st === 3 && !wait.length ? 'View' : st >= 2 ? 'Publish' : 'Open') + '</button></div>';
      }).join('') || '<div class="box"><p class="note" style="margin:0">' + (S.filter === 'waiting' ? 'No buildings waiting. New registrations show up here.' : 'No buildings yet.') + '</p></div>') + '</div>';
    V.$$('[data-f]', el).forEach(function (x) { x.onclick = function () { S.filter = x.getAttribute('data-f'); drawList(); }; });
    V.$('[data-reload]', el).onclick = load;
    V.$$('[data-open]', el).forEach(function (x) { x.onclick = function () { S.open = +x.getAttribute('data-open'); S.form = {}; render(); window.scrollTo(0, 0); }; });
  }

  function drawBuilding() {
    var el = V.$('#b-main'), b = S.buildings.filter(function (x) { return x.id === S.open; })[0];
    if (!b) { S.open = null; return drawList(); }
    var d = D(b), c = d.contacts || {}, sv = d.services || {}, us = bUnits(b);
    var vac = us.filter(function (u) { return u.status === 'vacant'; });
    var withPhotos = us.filter(function (u) { return u.photos; });
    vac.forEach(function (u) {
      if (!S.form[u.id]) S.form[u.id] = { on: !u.listing_id, photos: (u.photos || '').replace(/(^|\s)assets\//g, '$1'), notes: '', reuse: '', checked: false, baths: '1' };
    });
    var amen = [].concat.apply([], Object.keys(sv).filter(function (k) { return Array.isArray(sv[k]); }).map(function (k) { return sv[k]; }));
    el.innerHTML = '<button type="button" class="btn-link" data-back style="align-self:flex-start">‹ Buildings</button>' +
      '<div class="actions" style="justify-content:space-between;align-items:flex-start"><div><h1 style="font-size:30px">' + esc(b.name) + '</h1><p class="note" style="margin:2px 0 0">' + esc([b.road, b.location].filter(Boolean).join(', ')) + ' · ' + esc(b.code) +
      (b.status === 'live' ? ' · <span class="ba-pill ba-live">Live</span>' : ' · <span class="ba-pill ba-wait">Setting up</span>') + '</p></div>' + pipe(stage(b)) + '</div>' +
      '<div class="box ba-kv">' +
      '<div><span>Manager</span><strong>' + esc([c.person, c.phone].filter(Boolean).join(' · ') || b.owner_email) + '</strong></div>' +
      '<div><span>Caretaker</span><strong>' + esc([c.caretaker, c.caretaker_phone].filter(Boolean).join(' · ') || '–') + '</strong></div>' +
      '<div><span>Photo visit</span><strong>' + esc(b.visit_date ? day(b.visit_date) + (b.visit_time ? ', ' + b.visit_time.toLowerCase() : '') : 'Not booked') + '</strong></div>' +
      '<div><span>Viewings</span><strong>' + esc((c.viewing_times || []).join(', ') || '–') + (c.notice_hours ? ' · ' + c.notice_hours + ' h notice' : '') + '</strong></div>' +
      '<div style="grid-column:1/-1"><span>Amenities</span><strong>' + esc(amen.join(' · ') || '–') + '</strong></div>' +
      '<div style="grid-column:1/-1"><span>House types</span><strong>' + esc((d.house_types || []).map(function (h) { return h.type + (h.rent ? ' KES ' + V.money(h.rent) : ''); }).join(' · ') || '–') + '</strong></div>' +
      '</div>' +
      (c.phone ? '<div class="actions" style="gap:8px"><a class="btn btn-outline" style="font-size:15px;padding:8px 14px" href="tel:' + esc(c.phone) + '">Call manager</a><a class="btn btn-outline" style="font-size:15px;padding:8px 14px" target="_blank" rel="noopener" href="https://wa.me/' + esc(String(c.phone).replace(/\D/g, '').replace(/^0/, '254')) + '?text=' + encodeURIComponent('Hi ' + (c.person || '') + ', this is Viustay about ' + b.name + '.') + '">WhatsApp manager</a></div>' : '') +
      '<div class="actions" style="justify-content:space-between"><h2 style="font-size:20px">Vacancies · ' + vac.length + '</h2><span class="note">Tap Upload photos on each unit (or use GitHub file names).</span></div>' +
      (vac.length ? '<div class="ba-units">' + vac.map(function (u) { return unitCard(b, u, withPhotos); }).join('') + '</div>' :
        '<div class="box"><p class="note" style="margin:0">No vacancies yet. The manager adds them from their dashboard ("Add vacancy").</p></div>') +
      (us.filter(function (u) { return u.status !== 'vacant'; }).length ? '<p class="note">Let units: ' + us.filter(function (u) { return u.status !== 'vacant'; }).map(function (u) { return esc(u.label) + (u.listing_id ? ' (' + esc(u.listing_id) + ', off the site)' : ''); }).join(', ') + '</p>' : '') +
      '<div class="ba-bar"><button type="button" class="btn btn-primary" data-publish style="font-size:16px;padding:12px 22px">Publish</button><span class="note" data-sum></span><p class="error hidden" data-perr style="margin:0;width:100%"></p></div>';
    V.$('[data-back]', el).onclick = function () { S.open = null; render(); window.scrollTo(0, 0); };
    wireUnits(el, b);
    sum(el, b);
  }

  function unitCard(b, u, withPhotos) {
    var f = S.form[u.id];
    var reuse = withPhotos.filter(function (x) { return x.id !== u.id; });
    var opts = '<option value="">Reuse photos from…</option>' + reuse.map(function (x) {
      return '<option value="' + x.id + '"' + (String(f.reuse) === String(x.id) ? ' selected' : '') + '>' + esc(x.label + ' · ' + x.type + (x.type === u.type ? ' (same type)' : '')) + '</option>';
    }).join('');
    var state = u.listing_id ? '<span class="ba-pill ba-live">Live · ' + esc(u.listing_id) + '</span>' : u.paused ? '<span class="ba-pill ba-let">Paused by manager</span>' : '<span class="ba-pill ba-wait">Waiting for photos</span>';
    return '<div class="ba-unit' + (f.on ? ' on' : '') + '" data-u="' + u.id + '">' +
      '<label style="display:flex;align-items:center;gap:12px;cursor:pointer"><input type="checkbox" data-on' + (f.on ? ' checked' : '') + ' style="width:20px;height:20px">' +
      '<span class="ba-sq">' + esc(u.label) + '</span><span style="flex:1;line-height:1.3"><strong>' + esc(u.type) + (u.floor ? ' · floor ' + esc(u.floor) : '') + '</strong><br><span class="note" style="font-size:13px">KES ' + V.money(u.rent) +
      (u.deposit ? ' · deposit ' + esc(u.deposit) : '') + (u.furnished && u.furnished !== 'No' ? ' · ' + esc(u.furnished) + ' furnished' : '') + '</span></span>' + state + '</label>' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><label class="btn btn-dark" style="font-size:15px;padding:9px 16px;min-height:40px;cursor:pointer">' +
        '<input type="file" accept="image/*" multiple data-up style="display:none">Upload photos</label><span class="note" style="font-size:13px" data-upmsg>' + esc(f.msg || 'From your phone or computer. ★ = cover photo.') + '</span></div>' +
      '<div class="ba-th" data-th></div>' +
      '<details' + (hasNames(f.photos) ? ' open' : '') + '><summary class="note" style="font-size:13px;cursor:pointer">Or type GitHub file names</summary>' +
      '<input type="text" data-ph value="' + esc(f.photos) + '" placeholder="e.g. vs-031-1.jpg vs-031-2.jpg vs-031-3.jpg" style="margin-top:6px"></details>' +
      (reuse.length ? '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><select data-reuse style="flex:1 1 200px">' + opts + '</select>' +
        (f.reuse ? '<label class="note" style="font-size:13px;display:flex;gap:6px;align-items:center"><input type="checkbox" data-chk' + (f.checked ? ' checked' : '') + '> Caretaker\'s video checked: same finish, clean, ready</label>' : '') + '</div>' : '') +
      '<div style="display:flex;gap:8px"><label class="note" style="font-size:13px;flex:0 0 110px">Bathrooms<select data-baths>' + ['1', '2', '3', '4'].map(function (n) { return '<option' + (f.baths === n ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></label>' +
      '<label class="note" style="font-size:13px;flex:1">Short description (optional)<textarea data-notes maxlength="400" placeholder="e.g. Bright corner unit, quiet side, 5 min to the matatu stage.">' + esc(f.notes) + '</textarea></label></div></div>';
  }

  function thumbs(card, txt) {
    var box = V.$('[data-th]', card), list = photoList(txt);
    box.innerHTML = list.map(function (p, i) {
      return '<span class="ba-ph' + (i === 0 ? ' cover' : '') + '"><img alt="" src="' + esc(p) + '"><button type="button" data-cover="' + i + '" title="Make cover">★</button><button type="button" data-rm="' + i + '" title="Remove">✕</button></span>';
    }).join('');
    V.$$('img', box).forEach(function (img) {
      img.onerror = function () { var s = document.createElement('span'); s.className = 'bad'; s.textContent = 'Not found: ' + img.getAttribute('src').replace(/^assets\//, ''); img.replaceWith(s); };
    });
  }
  function hasNames(t) { return String(t || '').split(/\s+/).some(function (x) { return x && !/^https?:/.test(x); }); }
  function shortName(p) { return /^assets\//.test(p) ? p.slice(7) : p; }
  // Shrink a photo on the device before upload: longest side 1600 px, JPEG ~80% (about 200-400 KB)
  function shrink(file) {
    return new Promise(function (ok, no) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? ok(b) : no(new Error('Could not read the photo')); }, 'image/jpeg', 0.8);
      };
      img.onerror = function () { URL.revokeObjectURL(url); no(new Error('That file is not a photo')); };
      img.src = url;
    });
  }
  function upload(b, u, files, card) {
    var f = S.form[u.id], msg = V.$('[data-upmsg]', card), done = 0, list = Array.prototype.slice.call(files, 0, 15);
    msg.textContent = 'Uploading 0 of ' + list.length + '…';
    var chain = Promise.resolve();
    list.forEach(function (file, i) {
      chain = chain.then(function () { return shrink(file); }).then(function (blob) {
        var path = (b.code || 'b' + b.id) + '/' + u.label.replace(/[^A-Za-z0-9-]/g, '') + '-' + Date.now() + '-' + i + '.jpg';
        return V.db.storage.from('listing-photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false }).then(function (r) {
          if (r.error) throw r.error;
          var pub = V.db.storage.from('listing-photos').getPublicUrl(path).data.publicUrl;
          f.photos = ((f.photos || '').trim() + ' ' + pub).trim(); f.on = true; f.reuse = '';
          done++; msg.textContent = 'Uploading ' + done + ' of ' + list.length + '…'; thumbs(card, f.photos); wireThumbs(card, f);
        });
      });
    });
    return chain.then(function () { f.msg = done + ' photo' + (done === 1 ? '' : 's') + ' uploaded. ★ = cover photo.'; render(); })
      .catch(function (e) { console.error(e); f.msg = 'Upload stopped: ' + (/bucket|not found|row-level/i.test(e.message || '') ? 'run supabase/add-photo-storage.sql first.' : (e.message || 'please try again.')); render(); });
  }
  function wireThumbs(card, f) {
    V.$$('[data-cover]', card).forEach(function (x) { x.onclick = function () { var l = photoList(f.photos), i = +x.getAttribute('data-cover'); l.unshift(l.splice(i, 1)[0]); f.photos = l.map(shortName).join(' '); render(); }; });
    V.$$('[data-rm]', card).forEach(function (x) { x.onclick = function () { var l = photoList(f.photos); l.splice(+x.getAttribute('data-rm'), 1); f.photos = l.map(shortName).join(' '); render(); }; });
  }

  function wireUnits(el, b) {
    V.$$('[data-u]', el).forEach(function (card) {
      var id = +card.getAttribute('data-u'), f = S.form[id];
      thumbs(card, f.photos); wireThumbs(card, f);
      var up = V.$('[data-up]', card); if (up) up.onchange = function () { if (up.files && up.files.length) upload(S.buildings.filter(function (x) { return x.id === S.open; })[0], S.units.filter(function (x) { return x.id === id; })[0], up.files, card); };
      V.$('[data-on]', card).onchange = function () { f.on = this.checked; card.classList.toggle('on', f.on); sum(el, b); };
      var ph = V.$('[data-ph]', card);
      ph.oninput = function () { f.photos = ph.value; f.reuse = ''; clearTimeout(ph._t); ph._t = setTimeout(function () { thumbs(card, f.photos); wireThumbs(card, f); }, 400); };
      var re = V.$('[data-reuse]', card);
      if (re) re.onchange = function () {
        f.reuse = re.value; f.checked = false;
        var src = S.units.filter(function (x) { return String(x.id) === re.value; })[0];
        if (src) { f.photos = (src.photos || '').replace(/(^|\s)assets\//g, '$1'); f.on = true; }
        render();
      };
      var chk = V.$('[data-chk]', card); if (chk) chk.onchange = function () { f.checked = chk.checked; };
      V.$('[data-baths]', card).onchange = function () { f.baths = this.value; };
      V.$('[data-notes]', card).oninput = function () { f.notes = this.value; };
    });
    V.$('[data-publish]', el).onclick = function () { publish(el, b); };
  }

  function sum(el, b) {
    var n = bUnits(b).filter(function (u) { return u.status === 'vacant' && S.form[u.id] && S.form[u.id].on; }).length;
    var btn = V.$('[data-publish]', el);
    btn.textContent = n ? 'Publish ' + n + ' unit' + (n > 1 ? 's' : '') + (b.status === 'live' ? '' : ' & mark Live') : 'Tick the units to publish';
    btn.disabled = !n;
    V.$('[data-sum]', el).textContent = n ? 'They go on the homes page straight away. The manager sees them as Vacant.' : '';
  }

  function publish(el, b) {
    var err = V.$('[data-perr]', el), btn = V.$('[data-publish]', el);
    var show = function (t) { err.textContent = t; err.classList.remove('hidden'); };
    err.classList.add('hidden');
    var picked = bUnits(b).filter(function (u) { return u.status === 'vacant' && S.form[u.id] && S.form[u.id].on; });
    var items = [];
    for (var i = 0; i < picked.length; i++) {
      var u = picked[i], f = S.form[u.id], list = photoList(f.photos);
      if (!list.length) return show(u.label + ': add at least one photo file name.');
      if (V.$('[data-u="' + u.id + '"] .bad', el)) return show(u.label + ': one of the photos is not in GitHub yet. Check the file name (it is case sensitive).');
      if (f.reuse && !f.checked) return show(u.label + ': tick "Caretaker\'s video checked" before reusing photos.');
      items.push({ unit_id: u.id, photos: list.join(' '), notes: f.notes.trim(), bathrooms: f.baths, bedrooms: BEDS.hasOwnProperty(u.type) ? BEDS[u.type] : '', type: LABEL[u.type] || u.type, amenities: amenities(b, u) });
    }
    if (!confirm('Publish ' + items.length + ' unit' + (items.length > 1 ? 's' : '') + ' of ' + b.name + ' on the homes page' + (b.status === 'live' ? '' : ' and mark the building Live') + '?')) return;
    btn.disabled = true; btn.textContent = 'Publishing…';
    V.db.rpc('admin_publish', { p_building: b.id, p: { units: items, cover: photoList(items[0].photos)[0] } }).then(function (r) {
      if (r.error) throw r.error;
      ((r.data && r.data.published) || []).forEach(function (x) {
        var u = S.units.filter(function (y) { return y.id === x.unit_id; })[0];
        if (u) { u.listing_id = x.listing_id; u.photos = items.filter(function (it) { return it.unit_id === u.id; })[0].photos; S.form[u.id].on = false; }
      });
      b.status = 'live';
      try { localStorage.removeItem('vs-dblistings-v1'); } catch (e) {}
      render();
      var ids = ((r.data && r.data.published) || []).map(function (x) { return x.listing_id; }).join(', ');
      setTimeout(function () { alert('Published: ' + ids + '. It is live on the homes page now.'); }, 50);
    }).catch(function (e) {
      console.error(e); btn.disabled = false; sum(el, b);
      show(/no_photos/.test(e.message || '') ? 'Every ticked unit needs photos.' : /not_admin/.test(e.message || '') ? 'This login is not an admin.' : 'Could not publish: ' + (e.message || 'please try again.'));
    });
  }

  window.VBuildingsAdmin = {
    shrink: shrink,
    open: function () {
      if (!document.getElementById('ba-css')) { var st = document.createElement('style'); st.id = 'ba-css'; st.textContent = css; document.head.appendChild(st); }
      S.open = null; load();
    },
    openBuilding: function (id) {
      if (!document.getElementById('ba-css')) { var st = document.createElement('style'); st.id = 'ba-css'; st.textContent = css; document.head.appendChild(st); }
      S.open = id; S.form = {}; load();
    }
  };
})();
