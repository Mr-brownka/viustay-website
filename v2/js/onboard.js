// First-open welcome: language -> what brings you -> look. Shown once, on the home page only.
(function () {
  var V = window.V, T = V.t;
  var KEY = 'vs-onboarded', STEP = 'vs-onb-step';
  try { if (localStorage.getItem(KEY)) return; } catch (e) { return; }
  var step = 1; try { step = +(sessionStorage.getItem(STEP) || 1); } catch (e) {}
  var goal = null; try { goal = sessionStorage.getItem('vs-onb-goal'); } catch (e) {}

  var o = document.createElement('div');
  o.className = 'onb'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', T('Welcome to Viustay'));
  document.body.appendChild(o);
  document.documentElement.classList.add('onb-open');

  var PIN = '<svg viewBox="0 0 40 46" aria-hidden="true"><path d="M20 2 C10 2 3 9.5 3 19 C3 31 20 44 20 44 C20 44 37 31 37 19 C37 9.5 30 2 20 2 Z" fill="#111111"/><path d="M10.5 17 L20 9.5 L29.5 17" fill="none" stroke="#0E5E54" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.5 19.5 L20 29 L26.5 19.5" fill="none" stroke="#FFFFFF" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function finish() {
    try { localStorage.setItem(KEY, '1'); sessionStorage.removeItem(STEP); sessionStorage.removeItem('vs-onb-goal'); } catch (e) {}
    o.classList.add('out'); document.documentElement.classList.remove('onb-open');
    setTimeout(function () { if (o.parentNode) o.parentNode.removeChild(o); }, 300);
    try { window.dispatchEvent(new Event('vs-onboarded')); } catch (e) {}
    if (goal === 'owner') { location.href = 'owners.html'; return; }
    if (goal === 'short' && window.VSChat) window.VSChat.preset({ stay: 'short' });
    if (goal === 'long' && window.VSChat) window.VSChat.preset({ stay: 'long' });
  }
  function dots(n) { return '<div class="onb-dots" aria-hidden="true">' + [1, 2, 3].map(function (i) { return '<i class="' + (i === n ? 'on' : '') + '"></i>'; }).join('') + '</div>'; }
  function skip() { return '<button type="button" class="onb-skip" data-skip>' + T('Skip') + '</button>'; }

  function render() {
    var h = '';
    if (step === 1) {
      h = '<div class="onb-card">' + skip() + '<div class="onb-logo">' + PIN + '</div>' +
        '<h1>Karibu · Welcome · Soo dhawoow</h1><p>' + T('Choose your language') + '</p>' +
        '<div class="onb-opts">' + Object.keys(VT.LANGS).map(function (k) {
          return '<button type="button" class="onb-opt' + (VT.lang() === k ? ' on' : '') + '" data-lang="' + k + '"><b>' + VT.LANGS[k] + '</b><small>' + { en: 'Continue in English', sw: 'Endelea kwa Kiswahili', so: 'Ku sii wad Soomaali' }[k] + '</small></button>';
        }).join('') + '</div>' + dots(1) + '</div>';
    } else if (step === 2) {
      h = '<div class="onb-card">' + skip() + '<h1>' + T('What brings you to Viustay?') + '</h1>' +
        '<div class="onb-opts">' +
        '<button type="button" class="onb-opt" data-goal="long"><b>' + T('Find a home to rent') + '</b><small>' + T('Monthly rent, verified homes, one viewing trip') + '</small></button>' +
        '<button type="button" class="onb-opt" data-goal="short"><b>' + T('Book a short stay') + '</b><small>' + T('Furnished places by the night, like a hotel') + '</small></button>' +
        '<button type="button" class="onb-opt" data-goal="owner"><b>' + T('List my property') + '</b><small>' + T('For owners, managers and caretakers') + '</small></button>' +
        '</div>' + dots(2) + '</div>';
    } else {
      var cur = document.documentElement.getAttribute('data-look') || 'pearl';
      h = '<div class="onb-card">' + skip() + '<h1>' + T('Pick your look') + '</h1><p>' + T('You can change this any time from the menu.') + '</p>' +
        '<div class="onb-looks">' +
        '<button type="button" class="onb-look' + (cur === 'pearl' ? ' on' : '') + '" data-look="pearl"><span class="pv pearl"><i></i><i></i><i></i></span><b>Pearl</b></button>' +
        '<button type="button" class="onb-look' + (cur === 'night' ? ' on' : '') + '" data-look="night"><span class="pv night"><i></i><i></i><i></i></span><b>Night</b></button>' +
        '</div><button type="button" class="btn btn-primary onb-done" data-done>' + T('Start') + '</button>' + dots(3) + '</div>';
    }
    o.innerHTML = h;
    var first = o.querySelector('.onb-opt, .onb-look'); if (first) first.focus({ preventScroll: true });
  }

  o.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-skip')) { goal = goal || null; finish(); return; }
    if (b.hasAttribute('data-lang')) {
      var l = b.getAttribute('data-lang');
      try { sessionStorage.setItem(STEP, '2'); } catch (e2) {}
      if (l !== VT.lang()) { VT.set(l); return; }   // reloads the page in the new language
      try { localStorage.setItem('vs-lang', l); } catch (e3) {}
      step = 2; render(); return;
    }
    if (b.hasAttribute('data-goal')) {
      goal = b.getAttribute('data-goal');
      try { sessionStorage.setItem('vs-onb-goal', goal); sessionStorage.setItem(STEP, '3'); } catch (e4) {}
      step = 3; render(); return;
    }
    if (b.hasAttribute('data-look')) {
      if (window.VSLook) VSLook.set(b.getAttribute('data-look'));
      Array.prototype.forEach.call(o.querySelectorAll('.onb-look'), function (x) { x.classList.toggle('on', x === b); });
      return;
    }
    if (b.hasAttribute('data-done')) finish();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && o.parentNode) finish(); });
  render();
})();
