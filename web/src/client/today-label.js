// Inline on the home page: the mini panel and the city cards were computed at build time for the date in data-date
// (the Asia/Kolkata civil day of the build, rebuilt monthly). The page itself always prints that date, so a stale build
// never claims to be "today"; this script only adds the word "Today" when the visitor's Asia/Kolkata date matches.
(function () {
  var els = document.querySelectorAll('[data-today-date]');
  if (!els.length) return;
  var today;
  try {
    today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch (e) { return; }
  for (var i = 0; i < els.length; i++) {
    if (els[i].getAttribute('data-today-date') !== today) continue;
    var label = els[i].getAttribute('data-today-label');
    var slot = els[i].querySelector('[data-today-slot]');
    if (label && slot) slot.textContent = label + ' · ' + slot.textContent;
  }
})();
