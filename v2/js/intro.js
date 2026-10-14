// Home page intro: a cinematic Nairobi scene with the headline, then (after 3 seconds, or a tap) the first question pops up.
(function () {
  var V = window.V, T = V.t, cfg = V.cfg;
  var prev = V.getSearch() || {};
  // The Nairobi scene stays behind the home page (the intro lifts away to reveal it)
  (function homeBg() {
    if (document.querySelector('.home-bg')) return;
    var bg = document.createElement('div'); bg.className = 'home-bg'; bg.setAttribute('aria-hidden', 'true');
    if (cfg.INTRO_IMAGE) bg.style.backgroundImage = "url('" + cfg.INTRO_IMAGE.replace(/'/g, '%27') + "')";
    document.body.insertBefore(bg, document.body.firstChild);
  })();
  var seen = false; try { seen = sessionStorage.getItem('vs-intro'); } catch (e) {}
  if (seen || (prev.chat && prev.fromResults)) return;
  try { sessionStorage.setItem('vs-intro', '1'); } catch (e) {}
  var root = document.documentElement;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var onboarding = false; try { onboarding = !localStorage.getItem('vs-onboarded'); } catch (e) {}

  var o = document.createElement('div');
  o.className = 'intro'; o.setAttribute('role', 'presentation');
  var img = cfg.INTRO_IMAGE || '';
  var media = cfg.INTRO_VIDEO ? '<video class="intro-media" src="' + V.esc(cfg.INTRO_VIDEO) + '" ' + (img ? 'poster="' + V.esc(img) + '" ' : '') + 'autoplay muted loop playsinline></video>'
    : '<div class="intro-media" style="background-image:url(\'' + img.replace(/'/g, '%27') + '\')"></div>';
  var words = T("Let's find your family's <em>next home</em>.");
  o.innerHTML = '<div class="intro-scene">' + media + '</div><div class="intro-light"></div><div class="intro-shade"></div><div class="intro-grain"></div>' +
    '<div class="intro-copy"><span class="intro-eyebrow"><i></i>' + V.esc(T('Verified homes in Nairobi')) + '</span><h1>' + words + '</h1>' +
    '<p>' + V.esc(T('Nairobi, found for you.')) + '</p></div>' +
    // Tap hint: a finger tapping with a pulse ring, "Tap to start", and a 3-second bar
    '<div class="intro-tap" aria-hidden="true"><span class="it-hand"><i class="it-ring"></i><svg viewBox="0 0 24 24"><path d="M9 11V4.5a1.5 1.5 0 0 1 3 0V10h.5V8.5a1.5 1.5 0 0 1 3 0V10h.5V9.5a1.5 1.5 0 0 1 3 0V15c0 3.5-2.5 6-6 6h-1c-2.2 0-3.6-1-4.8-2.6L4.6 14.6a1.5 1.5 0 0 1 2.3-1.9L9 14.5z"/></svg></span>' +
    '<span class="it-txt">' + V.esc(T('Tap to start')) + '</span><span class="it-bar"><i></i></span></div>' +
    (cfg.INTRO_VIDEO || !img ? '' : '<a class="intro-credit" href="https://unsplash.com/photos/a-view-of-a-city-with-tall-buildings-vyagy6HJpVE" target="_blank" rel="noopener">Photo: Kenny Murgor / Unsplash</a>');
  document.body.appendChild(o);
  root.classList.add('intro-wait');

  // Split the headline into words that rise in one after another
  var h1 = o.querySelector('h1'), n = 0;
  (function wrap(node) {
    Array.prototype.slice.call(node.childNodes).forEach(function (c) {
      if (c.nodeType === 3) {
        var frag = document.createDocumentFragment();
        c.textContent.split(/(\s+)/).forEach(function (w) {
          if (!w) return;
          if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(w)); return; }
          var sp = document.createElement('span'); sp.className = 'iw'; sp.style.animationDelay = (0.3 + n++ * 0.16) + 's'; sp.textContent = w; frag.appendChild(sp);
        });
        node.replaceChild(frag, c);
      } else wrap(c);
    });
  })(h1);

  // Motion: the scene drifts with the mouse, or with the phone's tilt
  var tx = 0, ty = 0;
  function move(x, y) { tx = Math.max(-1, Math.min(1, x)); ty = Math.max(-1, Math.min(1, y)); o.style.setProperty('--mx', tx.toFixed(3)); o.style.setProperty('--my', ty.toFixed(3)); }
  if (!reduce) {
    o.addEventListener('pointermove', function (e) { move(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1); });
    window.addEventListener('deviceorientation', function (e) { if (e.gamma == null) return; move(e.gamma / 25, (e.beta - 45) / 25); });
  }

  var gone = false, timer = null;
  function finish() {
    if (gone) return; gone = true; clearTimeout(timer);
    o.classList.add('out');
    root.classList.remove('intro-wait'); root.classList.add('intro-pop');
    setTimeout(function () { if (o.parentNode) o.parentNode.removeChild(o); root.classList.remove('intro-pop'); }, 1200);
  }
  o.addEventListener('click', finish);
  function startClock() { if (!timer && !gone) { o.classList.add('run'); timer = setTimeout(finish, 3000); } }
  function ready() { return !window.VS_LAUNCHING && !(onboarding && document.querySelector('.onb:not(.out)')); }
  function check() { if (ready()) startClock(); }
  window.addEventListener('vs-launch-done', function () { setTimeout(check, 50); });
  window.addEventListener('vs-onboarded', function () { onboarding = false; setTimeout(check, 50); });
  setTimeout(check, 60);
})();
