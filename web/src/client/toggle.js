// Inline at the end of <body>: the two-state theme toggle (design.md 9, N2/N14). Label = TARGET state ("Dark" while light),
// aria-pressed = CURRENT state (true when dark); the choice persists in localStorage 'shubhvela-theme'. Strings arrive
// through data-* attributes so every language gets its own words. Also: language links on pages that carry URL state
// (kundli, /m/) keep the query string, so switching language keeps the chart.
(function () {
  var h = document.documentElement;
  var b = document.getElementById('theme');
  if (b) {
    var l = document.getElementById('theme-label');
    function sync() {
      var d = h.getAttribute('data-theme') === 'dark';
      b.setAttribute('aria-pressed', d ? 'true' : 'false');
      b.setAttribute('aria-label', d ? b.getAttribute('data-to-light') : b.getAttribute('data-to-dark'));
      if (l) l.textContent = d ? b.getAttribute('data-light') : b.getAttribute('data-dark');
    }
    b.addEventListener('click', function () {
      var d = h.getAttribute('data-theme') === 'dark';
      if (d) h.removeAttribute('data-theme'); else h.setAttribute('data-theme', 'dark');
      try { localStorage.setItem('shubhvela-theme', d ? 'light' : 'dark'); } catch (e) { /* storage blocked */ }
      sync();
    });
    sync();
  }
  if (location.search && document.body.hasAttribute('data-keep-query')) {
    var links = document.querySelectorAll('a[data-keep-query]');
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href');
      if (href && href.indexOf('?') < 0) links[i].setAttribute('href', href + location.search);
    }
  }
})();
