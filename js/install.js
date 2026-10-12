// "Install app" button: Android/Chrome get the real install prompt, iPhone gets a 2-step guide.
(function () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
  var standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  var ua = navigator.userAgent || '';
  var isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var deferred = null;

  function buttons() { return Array.prototype.slice.call(document.querySelectorAll('.vs-install')); }
  function show(on) { buttons().forEach(function (b) { b.hidden = !on; }); }

  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; show(true); });
  window.addEventListener('appinstalled', function () { deferred = null; show(false); toast('Viustay is installed. Find it on your home screen.'); });

  function toast(msg) {
    var t = document.createElement('div'); t.className = 'vs-toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.classList.add('on'); }, 10);
    setTimeout(function () { t.classList.remove('on'); setTimeout(function () { t.remove(); }, 300); }, 3200);
  }
  function iosGuide() {
    var scrim = document.createElement('div'); scrim.className = 'vs-ios-scrim';
    var sheet = document.createElement('div'); sheet.className = 'vs-ios'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-labelledby', 'vs-ios-h');
    sheet.innerHTML =
      '<img src="assets/app-icon-192.png" alt="" width="64" height="64">' +
      '<h2 id="vs-ios-h">Install Viustay</h2>' +
      '<ol><li><span class="n">1</span><span>Tap <b>Share</b> <svg width="18" height="20" viewBox="0 0 18 20" aria-hidden="true"><path d="M9 1v12M5 5l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 9v9h12V9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg> at the bottom of Safari.</span></li>' +
      '<li><span class="n">2</span><span>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</span></li></ol>' +
      '<p>Viustay then opens full screen from its own icon, like any app.</p>' +
      '<button type="button" class="btn btn-primary">Got it</button>';
    function close() { scrim.remove(); sheet.remove(); }
    scrim.addEventListener('click', close); sheet.querySelector('button').addEventListener('click', close);
    document.body.appendChild(scrim); document.body.appendChild(sheet);
    sheet.querySelector('button').focus();
  }
  function onClick() {
    if (deferred) {
      deferred.prompt();
      deferred.userChoice.then(function (r) { if (r.outcome === 'accepted') show(false); deferred = null; });
    } else if (isIOS) {
      iosGuide();
    } else {
      toast('Open this site in Chrome on your phone, then tap Install app.');
    }
  }
  function mount() {
    if (standalone) return;
    var actions = document.querySelector('.site-header .header-actions');
    if (actions && !actions.querySelector('.vs-install')) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-pill btn-outline vs-install';
      b.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1v9M4.5 6.5 8 10l3.5-3.5M2 13h12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>Install app';
      actions.insertBefore(b, actions.firstChild);
    }
    var foot = document.querySelector('.footer-brand');
    if (foot && !foot.querySelector('.vs-install')) {
      var f = document.createElement('button'); f.type = 'button'; f.className = 'btn btn-pill btn-outline vs-install vs-install-foot'; f.textContent = 'Install the Viustay app';
      foot.appendChild(f);
    }
    buttons().forEach(function (x) { x.addEventListener('click', onClick); });
    // Android shows it once the browser says the app is installable; iPhone always (guide).
    show(!!deferred || isIOS);
  }
  document.addEventListener('DOMContentLoaded', function () { setTimeout(mount, 0); });
})();
