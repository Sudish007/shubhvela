// Inline on the 404 page: a client-side search over the site inventory (assets/search-<lang>.json: title + path per
// page), fetched on the first keystroke. No server, no analytics.
(function () {
  var input = document.getElementById('q');
  var list = document.getElementById('results');
  var none = document.getElementById('no-results');
  if (!input || !list) return;
  var url = input.getAttribute('data-index');
  var items = null;
  var loading = null;
  function norm(s) { return s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, ''); }
  function render(q) {
    list.textContent = '';
    if (!items) return;
    var nq = norm(q.trim());
    if (!nq) { none.hidden = true; return; }
    var hits = [];
    for (var i = 0; i < items.length && hits.length < 20; i++) {
      if (norm(items[i].t).indexOf(nq) >= 0 || (items[i].k && norm(items[i].k).indexOf(nq) >= 0)) hits.push(items[i]);
    }
    none.hidden = hits.length > 0;
    for (var j = 0; j < hits.length; j++) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = hits[j].p;
      a.textContent = hits[j].t;
      li.appendChild(a);
      list.appendChild(li);
    }
  }
  input.addEventListener('input', function () {
    if (!items) {
      loading = loading || fetch(url).then(function (r) { return r.json(); }).then(function (j) { items = j; render(input.value); });
      return;
    }
    render(input.value);
  });
})();
