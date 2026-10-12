// Agent model maths: pickup estates, home locations, route, fare. Same formula as supabase/add-agents.sql.
(function () {
  var V = window.V;
  var T = {};
  V.Trip = T;

  // Used when the database isn't reachable (demo). The real values live in admin -> Fare settings.
  T.DEFAULTS = {
    base: 150, per_km: 40, per_min: 4, wait_per_hour: 300, view_min: 20, road_factor: 1.4, speed_kmh: 22,
    min_fare: 500, round_to: 50, return_trip: true, viewing_fee: 950,
    slots: ['9:00 AM', '11:30 AM', '2:00 PM'], trips_per_agent_day: 2, days_ahead: 6, closed_days: [0], cutoff: '18:00',
    pay_window_min: 30, callout_fee: 300, placement_bonus_pct: 15, till: '', pay_name: 'Viustay', payout_day: 'Friday', airport_pickup_fee: 2500,
    rates_are_placeholders: true,
    pickups: [
      { name: 'Buruburu', lat: -1.2890, lng: 36.8750 },
      { name: 'CBD', lat: -1.2860, lng: 36.8230 },
      { name: 'Dagoretti', lat: -1.2960, lng: 36.7550 },
      { name: 'Donholm', lat: -1.2980, lng: 36.8850 },
      { name: 'Eastleigh', lat: -1.2730, lng: 36.8480 },
      { name: 'Embakasi', lat: -1.3220, lng: 36.8950 },
      { name: 'Gigiri', lat: -1.2340, lng: 36.8030 },
      { name: 'Hurlingham', lat: -1.2960, lng: 36.7940 },
      { name: 'Imara Daima', lat: -1.3290, lng: 36.8800 },
      { name: 'Kahawa', lat: -1.1830, lng: 36.9270 },
      { name: 'Kangemi', lat: -1.2650, lng: 36.7470 },
      { name: 'Karen', lat: -1.3190, lng: 36.7070 },
      { name: 'Kasarani', lat: -1.2220, lng: 36.8960 },
      { name: 'Kileleshwa', lat: -1.2780, lng: 36.7830 },
      { name: 'Kilimani', lat: -1.2900, lng: 36.7840 },
      { name: 'Kitengela', lat: -1.4750, lng: 36.9600 },
      { name: 'Langata', lat: -1.3400, lng: 36.7600 },
      { name: 'Lavington', lat: -1.2780, lng: 36.7680 },
      { name: 'Loresho', lat: -1.2520, lng: 36.7550 },
      { name: 'Madaraka', lat: -1.3060, lng: 36.8160 },
      { name: 'Muthaiga', lat: -1.2490, lng: 36.8320 },
      { name: 'Nairobi West', lat: -1.3080, lng: 36.8200 },
      { name: 'Ngara', lat: -1.2750, lng: 36.8250 },
      { name: 'Ngong Road', lat: -1.3000, lng: 36.7780 },
      { name: 'Pangani', lat: -1.2700, lng: 36.8370 },
      { name: 'Parklands', lat: -1.2630, lng: 36.8170 },
      { name: 'Riverside', lat: -1.2700, lng: 36.7920 },
      { name: 'Rongai', lat: -1.3960, lng: 36.7450 },
      { name: 'Roysambu', lat: -1.2180, lng: 36.8870 },
      { name: 'Ruaka', lat: -1.2050, lng: 36.7780 },
      { name: 'Runda', lat: -1.2180, lng: 36.8100 },
      { name: 'South B', lat: -1.3110, lng: 36.8360 },
      { name: 'South C', lat: -1.3200, lng: 36.8270 },
      { name: 'Spring Valley', lat: -1.2560, lng: 36.7950 },
      { name: 'Syokimau', lat: -1.3600, lng: 36.9300 },
      { name: 'Upper Hill', lat: -1.2950, lng: 36.8150 },
      { name: 'Utawala', lat: -1.2850, lng: 36.9600 },
      { name: 'Westlands', lat: -1.2670, lng: 36.8040 }
    ]
  };

  // Rough centre of each estate, for homes. A listing can override with lat / lng columns in the sheet.
  T.ESTATES = {
    'kilimani': [-1.2900, 36.7840], 'kileleshwa': [-1.2780, 36.7830], 'lavington': [-1.2780, 36.7680],
    'hurlingham': [-1.2960, 36.7940], 'upper hill': [-1.2950, 36.8150], 'parklands': [-1.2630, 36.8170],
    'westlands': [-1.2670, 36.8040], 'riverside': [-1.2700, 36.7920], 'spring valley': [-1.2560, 36.7950],
    'loresho': [-1.2520, 36.7550], 'kangemi': [-1.2650, 36.7470], 'south c': [-1.3200, 36.8270],
    'south b': [-1.3110, 36.8360], 'madaraka': [-1.3060, 36.8160], 'nairobi west': [-1.3080, 36.8200],
    'langata': [-1.3400, 36.7600], "lang'ata": [-1.3400, 36.7600], 'karen': [-1.3190, 36.7070],
    'ngong road': [-1.3000, 36.7780], 'dagoretti': [-1.2960, 36.7550], 'cbd': [-1.2860, 36.8230],
    'ngara': [-1.2750, 36.8250], 'pangani': [-1.2700, 36.8370], 'eastleigh': [-1.2730, 36.8480],
    'buruburu': [-1.2890, 36.8750], 'donholm': [-1.2980, 36.8850], 'embakasi': [-1.3220, 36.8950],
    'imara daima': [-1.3290, 36.8800], 'utawala': [-1.2850, 36.9600], 'syokimau': [-1.3600, 36.9300],
    'kitengela': [-1.4750, 36.9600], 'rongai': [-1.3960, 36.7450], 'kasarani': [-1.2220, 36.8960],
    'roysambu': [-1.2180, 36.8870], 'kahawa': [-1.1830, 36.9270], 'ruaka': [-1.2050, 36.7780],
    'runda': [-1.2180, 36.8100], 'gigiri': [-1.2340, 36.8030], 'muthaiga': [-1.2490, 36.8320]
  };
  var CITY_CENTRE = [-1.2860, 36.8230];

  // ---------- settings ----------
  var settingsPromise = null;
  T.loadSettings = function () {
    if (settingsPromise) return settingsPromise;
    if (V.demo) return (settingsPromise = Promise.resolve(T.DEFAULTS));
    settingsPromise = V.ensureDb().then(function (db) {
      return db.from('app_settings').select('value').eq('key', 'trip').maybeSingle();
    }).then(function (r) {
      if (r.error || !r.data) return T.DEFAULTS;
      var s = {}; Object.keys(T.DEFAULTS).forEach(function (k) { s[k] = T.DEFAULTS[k]; });
      Object.keys(r.data.value || {}).forEach(function (k) { s[k] = r.data.value[k]; });
      return s;
    }).catch(function () { return T.DEFAULTS; });
    return settingsPromise;
  };

  // ---------- geometry ----------
  T.km = function (a, b) {
    var R = 6371, rad = Math.PI / 180;
    var dLat = (b[0] - a[0]) * rad, dLng = (b[1] - a[1]) * rad;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  };

  // Where a home is: sheet lat/lng first, then its estate, then the city centre (flagged as a guess)
  T.homePoint = function (l) {
    var lat = parseFloat(l.lat), lng = parseFloat(l.lng);
    if (!isNaN(lat) && !isNaN(lng)) return { pt: [lat, lng], guess: false };
    var hay = ((l.area || '') + ' ' + (l.road || '')).toLowerCase();
    var best = null;
    Object.keys(T.ESTATES).forEach(function (k) { if (hay.indexOf(k) >= 0 && (!best || k.length > best.length)) best = k; });
    return best ? { pt: T.ESTATES[best], guess: false } : { pt: CITY_CENTRE, guess: true };
  };

  T.nearestPickup = function (lat, lng, pickups) {
    var best = null;
    (pickups || []).forEach(function (p) {
      var d = T.km([lat, lng], [p.lat, p.lng]);
      if (!best || d < best.km) best = { pickup: p, km: d };
    });
    return best;
  };

  function perms(a) {
    if (a.length <= 1) return [a];
    var out = [];
    a.forEach(function (x, i) { perms(a.slice(0, i).concat(a.slice(i + 1))).forEach(function (p) { out.push([x].concat(p)); }); });
    return out;
  }

  T.fare = function (km, homes, s) {
    var drive = km / Math.max(s.speed_kmh, 1) * 60;
    var raw = s.base + s.per_km * km + s.per_min * drive + s.wait_per_hour * homes * s.view_min / 60;
    var r = Math.max(s.round_to, 1);
    return Math.ceil(Math.max(raw, s.min_fare) / r) * r;
  };

  // Pickup -> homes (shortest order) -> back to pickup
  T.quote = function (pickup, homes, s) {
    var start = [pickup.lat, pickup.lng];
    var pts = homes.map(function (h) { var p = T.homePoint(h); return { home: h, pt: p.pt, guess: p.guess }; });
    var best = null;
    perms(pts).forEach(function (order) {
      var d = 0, at = start;
      order.forEach(function (o) { d += T.km(at, o.pt); at = o.pt; });
      if (s.return_trip) d += T.km(at, start);
      if (!best || d < best.d) best = { d: d, order: order };
    });
    var km = Math.max(0.5, Math.round((best ? best.d : 0) * s.road_factor * 10) / 10);
    var fare = T.fare(km, homes.length, s);
    return {
      km: km,
      drive_min: Math.round(km / Math.max(s.speed_kmh, 1) * 60),
      wait_min: homes.length * s.view_min,
      fare: fare, viewing_fee: s.viewing_fee, total: fare + s.viewing_fee,
      order: best ? best.order.map(function (o) { return o.home; }) : [],
      guess: pts.some(function (p) { return p.guess; })
    };
  };

  T.mins = function (m) { var t = V.t; m = Math.round(m); return m < 60 ? t('{n} min', { n: m }) : t('{n} h', { n: Math.floor(m / 60) }) + (m % 60 ? ' ' + t('{n} min', { n: m % 60 }) : ''); };
})();
