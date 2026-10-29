// Inline on the festival, muhurat and vrat pages: the city picker. The static page carries the featured cities; the full
// 331 list is fetched from assets/cities-<hash>.json on first focus. A change writes ?city=<slug> into the URL
// (shareable) and loads the data bundle (data-bundle on <body>), whose recompute(slug) re-renders the block with the
// engine in the browser. Nothing is sent anywhere.
(function () {
  var sel = document.getElementById('city-pick');
  var url = document.body.getAttribute('data-bundle');
  if (!sel || !url) return;
  var status = document.getElementById('pick-status');
  var lang = document.documentElement.lang;
  var filled = false;
  var mod = null;
  var pendingValue = null;
  function fill() {
    if (filled) return Promise.resolve();
    filled = true;
    return fetch(sel.getAttribute('data-cities')).then(function (r) { return r.json(); }).then(function (list) {
      var have = {};
      for (var i = 0; i < sel.options.length; i++) have[sel.options[i].value] = 1;
      var group = document.createElement('optgroup');
      group.label = sel.getAttribute('data-all') || '';
      for (var j = 0; j < list.length; j++) {
        var c = list[j];
        if (have[c[0]]) continue;
        var o = document.createElement('option');
        o.value = c[0];
        o.textContent = lang !== 'en' && c[2] ? c[2] : c[1];
        group.appendChild(o);
      }
      sel.appendChild(group);
      if (pendingValue) { sel.value = pendingValue; pendingValue = null; }
    }).catch(function () { filled = false; });
  }
  function run(slug) {
    if (status) status.textContent = status.getAttribute('data-loading') || '';
    var p = mod ? Promise.resolve(mod) : import(url).then(function (m) { mod = m; return m; });
    p.then(function (m) {
      return m.recompute(slug);
    }).then(function () {
      if (status) status.textContent = '';
    }).catch(function () {
      if (status) status.textContent = status.getAttribute('data-failed') || '';
    });
  }
  sel.addEventListener('focus', fill, { once: true });
  sel.addEventListener('pointerdown', fill, { once: true });
  sel.addEventListener('change', function () {
    var slug = sel.value;
    try {
      var u = new URL(location.href);
      u.searchParams.set('city', slug);
      history.replaceState(null, '', u.toString());
    } catch (e) { /* older browsers: no URL state */ }
    run(slug);
  });
  var q = null;
  try { q = new URLSearchParams(location.search).get('city'); } catch (e) { q = null; }
  if (q && /^[a-z0-9-]+$/.test(q)) {
    var known = false;
    for (var k = 0; k < sel.options.length; k++) if (sel.options[k].value === q) known = true;
    if (known) sel.value = q; else pendingValue = q;
    fill();
    run(q);
  }
})();
