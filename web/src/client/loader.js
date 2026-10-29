// Inline on the kundli and /m/ pages: loads the compute bundle (esbuild, ESM) lazily so the static page stays light.
// The bundle URL is in data-bundle on <body>. It loads at once when the URL carries chart state (v=1...), otherwise on
// the first interaction with the form; a submit that arrives before the bundle is ready is replayed by init().
(function () {
  var body = document.body;
  var url = body.getAttribute('data-bundle');
  if (!url) return;
  var form = document.getElementById('kundli-form');
  var status = document.getElementById('result-status');
  var loading = false;
  var pendingSubmit = false;
  function load() {
    if (loading) return;
    loading = true;
    if (status) status.textContent = status.getAttribute('data-loading') || '';
    import(url).then(function (m) {
      if (status) status.textContent = '';
      m.init({ pendingSubmit: pendingSubmit });
    }).catch(function () {
      loading = false;
      if (status) status.textContent = status.getAttribute('data-failed') || '';
    });
  }
  if (/(^|[?&])v=/.test(location.search)) load();
  if (form) {
    form.addEventListener('focusin', load, { once: true });
    form.addEventListener('pointerdown', load, { once: true });
    form.addEventListener('submit', function (e) {
      if (!form.hasAttribute('data-ready')) { e.preventDefault(); pendingSubmit = true; load(); }
    });
  }
})();
