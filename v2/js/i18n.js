// Languages: English (default), Kiswahili, Somali. English text is the key; missing words fall back to English.
// Use VT('Text {n}', { n: 3 }) in scripts, and data-i18n on HTML elements (their English text is the key).
(function () {
  var LANGS = { en: 'English', sw: 'Kiswahili', so: 'Soomaali' };
  var lang = 'en';
  try { lang = localStorage.getItem('vs-lang') || 'en'; } catch (e) {}
  if (!LANGS[lang]) lang = 'en';
  document.documentElement.lang = lang;
  var D = window.VS_DICT || {};

  function T(s, v) {
    var d = D[lang], out = (d && d[s]) || s;
    if (v) out = out.replace(/\{(\w+)\}/g, function (m, k) { return v[k] !== undefined ? v[k] : m; });
    return out;
  }
  T.lang = function () { return lang; };
  T.LANGS = LANGS;
  T.chosen = function () { try { return !!localStorage.getItem('vs-lang'); } catch (e) { return false; } };
  T.set = function (l, reload) {
    if (!LANGS[l]) return;
    try { localStorage.setItem('vs-lang', l); } catch (e) {}
    lang = l; document.documentElement.lang = l;
    if (reload !== false) location.reload(); else T.apply();
  };
  T.apply = function (root) {
    if (lang === 'en' && !root) return;
    Array.prototype.forEach.call((root || document).querySelectorAll('[data-i18n]'), function (el) {
      var k = el.getAttribute('data-i18n') || el.getAttribute('data-i18n-key') || el.textContent.trim();
      if (!el.getAttribute('data-i18n-key')) el.setAttribute('data-i18n-key', k);
      el.textContent = T(k);
    });
    Array.prototype.forEach.call((root || document).querySelectorAll('[data-i18n-html]'), function (el) {
      var k = el.getAttribute('data-i18n-key') || el.innerHTML.trim();
      el.setAttribute('data-i18n-key', k);
      el.innerHTML = T(k);
    });
    Array.prototype.forEach.call((root || document).querySelectorAll('[data-i18n-ph]'), function (el) {
      var k = el.getAttribute('data-i18n-ph') || el.getAttribute('placeholder');
      el.setAttribute('data-i18n-ph', k);
      el.setAttribute('placeholder', T(k));
    });
  };
  // Dates in the chosen language (Somali falls back to English month names in some browsers)
  T.locale = function () { return { en: 'en-GB', sw: 'sw-KE', so: 'so-SO' }[lang] || 'en-GB'; };
  window.VT = T;
  document.addEventListener('DOMContentLoaded', function () { T.apply(); });
})();
