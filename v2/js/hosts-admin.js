// Admin -> Homes -> Short-stay hosts (item 17): short stays sent by managers. Upload photos, then Publish to the homes page.
(function () {
  var V = window.V, esc = function (s) { return V.esc(s == null ? '' : String(s)); };
  var form = {};
  function rulesText(r) {
    var L = { smoking: 'Smoking', parties: 'Parties', pets: 'Pets', visitors: 'Visitors after 10 PM' };
    return Object.keys(L).map(function (k) { return L[k] + ': ' + (r && r[k] ? 'yes' : 'no'); }).join(' · ');
  }
  function photos(txt) { return String(txt || '').split(/\s+/).filter(Boolean); }
  function body(r) {
    var f = form[r.id] || (form[r.id] = { photos: r.photos || '' }), ph = photos(f.photos);
    return '<span><strong>' + esc(r.title || r.type) + '</strong> · ' + esc([r.building_name, r.area, r.unit_label && 'unit ' + r.unit_label, r.floor].filter(Boolean).join(' · ')) + '</span>' +
      '<span>KES ' + V.money(r.night_rate) + ' / night' + (r.cleaning_fee ? ' + KES ' + V.money(r.cleaning_fee) + ' cleaning' : '') + ' · <strong>' + (r.min_nights > 1 ? 'min ' + r.min_nights + ' nights' : 'no minimum') + '</strong> · up to ' + r.max_guests + ' guests · ' + r.beds + ' bed' + (r.beds === 1 ? '' : 's') + ' · in ' + esc(r.check_in) + ', out ' + esc(r.check_out) + (r.discounts ? ' · ' + esc(r.discounts) : '') + '</span>' +
      '<span style="color:var(--muted)">' + esc((r.included || []).join(', ')) + '</span>' +
      '<span class="note">' + esc(rulesText(r.rules)) + ' · Check-in: ' + esc([r.checkin_name, r.checkin_phone, r.keys].filter(Boolean).join(', ') || 'not given') + (r.notes ? ' · ' + esc(r.notes) : '') + '</span>' +
      '<span class="note">From ' + esc(r.manager_email) + (r.listing_id ? ' · Live as <strong>' + esc(r.listing_id) + '</strong>' : '') + '</span>' +
      '<div class="hs-pub" data-host="' + r.id + '"><div class="hs-thumbs">' + ph.map(function (u, i) { return '<span style="background-image:url(\'' + esc(u) + '\')">' + (i === 0 ? '<b>★</b>' : '') + '<button type="button" data-hrm="' + i + '" aria-label="Remove">✕</button></span>'; }).join('') + '</div>' +
      '<div class="t-inline"><label class="btn btn-outline" style="font-size:14px;padding:6px 12px;min-height:36px;cursor:pointer">Upload photos<input type="file" accept="image/*" multiple data-hup hidden></label>' +
      '<button type="button" class="btn btn-primary" data-hpub style="font-size:14px;padding:6px 14px;min-height:36px">' + (r.listing_id ? 'Update listing' : 'Publish to homes page') + '</button><span class="note" data-hmsg>' + esc(f.msg || '') + '</span></div></div>';
  }
  function bind(list, rows) {
    V.$$('[data-host]', list).forEach(function (box) {
      var id = +box.getAttribute('data-host'), r = rows.filter(function (x) { return x.id === id; })[0], f = form[id];
      var redraw = function () { if (window.VAdmin && window.VAdmin.render) window.VAdmin.render(); else box.closest('article').querySelector('.hs-pub').outerHTML = ''; };
      var up = V.$('[data-hup]', box);
      up.onchange = function () {
        var files = Array.prototype.slice.call(up.files || [], 0, 15), done = 0, msg = V.$('[data-hmsg]', box);
        if (!files.length) return;
        var chain = Promise.resolve(), shrink = window.VBuildingsAdmin.shrink;
        files.forEach(function (file, i) {
          chain = chain.then(function () { return shrink(file); }).then(function (blob) {
            var path = 'SS-' + id + '/' + Date.now() + '-' + i + '.jpg';
            return V.db.storage.from('listing-photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false }).then(function (res) {
              if (res.error) throw res.error;
              f.photos = (f.photos + ' ' + V.db.storage.from('listing-photos').getPublicUrl(path).data.publicUrl).trim();
              done++; msg.textContent = 'Uploading ' + done + ' of ' + files.length + '…';
            });
          });
        });
        chain.then(function () { f.msg = done + ' photo' + (done === 1 ? '' : 's') + ' uploaded. The first is the cover.'; redraw(); })
          .catch(function (e) { console.error(e); f.msg = 'Upload stopped: ' + (/bucket|row-level/i.test(e.message || '') ? 'run supabase/add-photo-storage.sql first.' : (e.message || 'please try again.')); redraw(); });
      };
      V.$$('[data-hrm]', box).forEach(function (b) { b.onclick = function () { var l = photos(f.photos); l.splice(+b.getAttribute('data-hrm'), 1); f.photos = l.join(' '); redraw(); }; });
      V.$('[data-hpub]', box).onclick = function () {
        var btn = this, msg = V.$('[data-hmsg]', box);
        if (!photos(f.photos).length) { msg.textContent = 'Upload at least one photo first.'; return; }
        if (!confirm('Put "' + (r.title || r.type) + '" on the homes page as a short stay?')) return;
        btn.disabled = true;
        V.db.rpc('admin_publish_stay', { p_sub: id, p: { photos: f.photos } }).then(function (res) {
          if (res.error) throw res.error;
          r.status = 'listed'; r.listing_id = res.data && res.data.listing_id; r.photos = f.photos;
          f.msg = 'Live as ' + r.listing_id + '. It shows on Short stays within a few minutes.';
          try { localStorage.removeItem('vs-dblistings-v1'); } catch (e) {}
          redraw();
        }).catch(function (e) { btn.disabled = false; msg.textContent = 'Could not publish: ' + (/no_photos/.test(e.message || '') ? 'add photos first.' : (e.message || 'please try again.')); });
      };
    });
  }
  window.VHostsAdmin = { body: body, bind: bind };
})();
