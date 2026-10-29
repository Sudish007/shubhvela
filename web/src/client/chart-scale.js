// Inline at the end of <body> (design-review M1): chart text is laid out in user units at viewBox 320, so an SVG that renders
// narrower than 320 px (the 320-385 px viewports) would show 12-unit numerals below the 12 px floor. For every static
// .chart we set --chart-k = max(1, 320 / clientWidth); the CSS font-size is calc(var(--fs) * var(--chart-k)). Charts the
// kundli client lays out at their real width mark themselves data-layout="client" and are left alone.
(function () {
  function scale() {
    var charts = document.querySelectorAll('svg.chart:not([data-layout="client"])');
    for (var i = 0; i < charts.length; i++) {
      var w = charts[i].clientWidth || charts[i].getBoundingClientRect().width;
      if (!w) continue;
      var k = Math.max(1, 320 / w);
      charts[i].style.setProperty('--chart-k', k.toFixed(4));
    }
  }
  scale();
  var pending = 0;
  window.addEventListener('resize', function () {
    if (pending) return;
    pending = window.setTimeout(function () { pending = 0; scale(); }, 120);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(scale);
})();
