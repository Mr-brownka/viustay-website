// v2 look: Pearl (default) or Night. Loaded in <head> so the page never flashes the wrong look.
(function () {
  var look = 'pearl';
  try { look = localStorage.getItem('vs-look') === 'night' ? 'night' : 'pearl'; } catch (e) {}
  // Work pages (manager dashboard, admin, agent) always use the light look: they're built for daylight work and stay easy to read.
  if (document.documentElement.hasAttribute('data-light-only')) look = 'pearl';
  document.documentElement.setAttribute('data-look', look);

  // First open of the app/site this session: paint white straight away (same as the phone's splash) until the launch logo is up.
  var boot = false;
  try { boot = !sessionStorage.getItem('vs-launched'); } catch (e) {}
  if (boot) {
    var de = document.documentElement;
    de.classList.add('vs-boot');
    var st = document.createElement('style');
    st.textContent = 'html.vs-boot,html.vs-boot body{background:#FFFFFF!important}html.vs-boot body>*:not(.vs-launch){visibility:hidden}';
    document.head.appendChild(st);
    var tc = document.querySelector('meta[name="theme-color"]'); if (tc) tc.setAttribute('content', '#FFFFFF');
    window.VSBootEnd = function () {
      de.classList.remove('vs-boot');
      var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', look === 'night' ? '#1F1F1F' : '#FFFFFF');
    };
    setTimeout(window.VSBootEnd, 4000); // safety net
  } else { window.VSBootEnd = function () {}; }

  function set(l) {
    if (document.documentElement.hasAttribute('data-light-only')) return;
    document.documentElement.setAttribute('data-look', l);
    try { localStorage.setItem('vs-look', l); } catch (e) {}
    Array.prototype.forEach.call(document.querySelectorAll('.vs-looks button, .menu-looks button'), function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-look') === l));
    });
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', l === 'night' ? '#1F1F1F' : '#FFFFFF');
  }
  window.VSLook = { set: set };

  // Runs after the header is drawn (common.js), so the menu switch can be added too
  document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 0); });
  function init() {
    if (!document.querySelector('.vs-sky')) {
      var sky = document.createElement('div');
      sky.className = 'vs-sky'; sky.setAttribute('aria-hidden', 'true');
      sky.innerHTML = '<i></i><i></i><i></i>';
      document.body.insertBefore(sky, document.body.firstChild);
    }
    if (!document.body.hasAttribute('data-no-looks') && !document.querySelector('.vs-looks')) {
      var sw = document.createElement('div');
      sw.className = 'vs-looks'; sw.setAttribute('role', 'group'); sw.setAttribute('aria-label', 'Colour look');
      sw.innerHTML = '<button type="button" data-look="pearl"><i style="background:#fff"></i>Pearl</button>' +
                     '<button type="button" data-look="night"><i style="background:#0A2540"></i>Night</button>';
      document.body.appendChild(sw);
      Array.prototype.forEach.call(sw.querySelectorAll('button'), function (b) {
        b.addEventListener('click', function () { set(b.getAttribute('data-look')); });
      });
    }
    // Phones: the switch also lives inside the header menu
    var ml = document.querySelector('.menu-looks');
    if (ml && !ml.firstChild) {
      ml.innerHTML = '<span>Look</span><button type="button" data-look="pearl">Pearl</button><button type="button" data-look="night">Night</button>';
      Array.prototype.forEach.call(ml.querySelectorAll('button'), function (b) {
        b.addEventListener('click', function () { set(b.getAttribute('data-look')); });
      });
    }
    set(document.documentElement.getAttribute('data-look'));
  }
})();
