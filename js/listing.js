// Single listing page: home.html?id=VS-001
document.addEventListener('DOMContentLoaded', function () {
  var V = window.V;
  var id = new URLSearchParams(window.location.search).get('id');

  V.$('#share-btn').addEventListener('click', function () {
    var url = window.location.href, btn = this;
    if (navigator.share) { navigator.share({ title: document.title, url: url }).catch(function () {}); return; }
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { btn.textContent = 'Link copied'; });
  });

  V.getListing(id).then(function (l) {
    if (!l) { V.$('#not-found').classList.remove('hidden'); return; }
    V.$('#listing').classList.remove('hidden');
    document.title = V.typeLabel(l) + ' for rent, ' + (l.road || l.area) + ' | Viustay';
    V.$('#l-title').textContent = V.typeLabel(l) + ', ' + (l.road || l.area);
    var sub = [l.area + ', Nairobi', V.typeLabel(l)];
    if (l.bathrooms) sub.push(l.bathrooms + ' bath');
    if (l.floor) sub.push(l.floor + ' floor');
    if (l.furnished) sub.push(/^y/i.test(l.furnished) ? 'Furnished' : 'Unfurnished');
    V.$('#l-sub').textContent = sub.join(' · ');
    V.$('#l-price').innerHTML = 'KES ' + V.money(l.rent) + ' <small>/ month</small>';
    V.$('#l-deposit').textContent = l.deposit || '–';
    V.$('#l-available').textContent = l.available_from || 'Now';
    V.$('#l-amenities').innerHTML = l.amenityList.map(function (a) { return '<span>' + V.esc(a) + '</span>'; }).join('') || '<span>Ask us for details</span>';
    if (l.notes) V.$('#l-notes').textContent = l.notes; else V.$('#l-notes-wrap').classList.add('hidden');
    V.$('#l-book').href = 'book.html?id=' + encodeURIComponent(l.id);
    V.$('#l-wa').href = V.wa('Hi Viustay, I\'m interested in ' + V.typeLabel(l) + ' on ' + (l.road || l.area) + ' (ref ' + l.id + ').');
    V.$('#l-ref').textContent = 'Ref ' + l.id + (l.sample ? ' · sample listing' : '');

    var photos = l.photoList, current = 0;
    function show() {
      var main = V.$('#main-photo');
      main.setAttribute('style', V.photoStyle(photos[current]));
      V.$('#photo-placeholder').classList.toggle('hidden', !!photos.length);
      V.$('#photo-counter').textContent = photos.length ? (current + 1) + ' / ' + photos.length : '';
      V.$('#photo-counter').classList.toggle('hidden', !photos.length);
      V.$$('#thumbs button').forEach(function (b, i) { b.setAttribute('aria-pressed', i === current ? 'true' : 'false'); });
    }
    V.$('#thumbs').innerHTML = '';
    photos.slice(0, 4).forEach(function (p, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'Photo ' + (i + 1));
      b.setAttribute('style', V.photoStyle(p));
      b.addEventListener('click', function () { current = i; show(); });
      V.$('#thumbs').appendChild(b);
    });
    if (!photos.length) V.$('#thumbs').classList.add('hidden');
    show();
  }).catch(function () { V.$('#not-found').classList.remove('hidden'); });
});
