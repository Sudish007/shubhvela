// Inline in <head> BEFORE the stylesheet (design.md 9, N2/N14): light is the first paint for everyone; dark only when the
// URL says ?theme=dark or the persisted toggle (localStorage 'shubhvela-theme') says so. No prefers-color-scheme auto-switch.
(function () {
  var q = new URLSearchParams(location.search);
  var t = q.get('theme');
  if (!t) {
    try { t = localStorage.getItem('shubhvela-theme'); } catch (e) { /* storage blocked: stay light */ }
  }
  if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
})();
