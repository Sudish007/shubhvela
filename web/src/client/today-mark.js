// Inline on the panchang pages: the page was computed at build time for the dates it prints (rebuilt monthly), so it
// never claims a row is "today" by itself. This script compares the visitor's current date IN THE CITY'S ZONE
// (data-today-tz) with (a) the card's data-today-date -> prefixes the heading with "Today", (b) every table row's
// data-date -> marks the matching row (class is-today, aria-current="date", the word "Today" in its first cell).
(function () {
  function todayIn(tz) {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    } catch (e) { return null; }
  }
  var cards = document.querySelectorAll('[data-today-date][data-today-tz]');
  for (var i = 0; i < cards.length; i++) {
    var card = cards[i];
    var today = todayIn(card.getAttribute('data-today-tz'));
    if (!today || card.getAttribute('data-today-date') !== today) continue;
    var slot = card.querySelector('[data-today-slot]');
    var label = card.getAttribute('data-today-label');
    if (slot && label) slot.textContent = label + ' · ' + slot.textContent;
  }
  var tables = document.querySelectorAll('table[data-today-tz]');
  for (var j = 0; j < tables.length; j++) {
    var table = tables[j];
    var t = todayIn(table.getAttribute('data-today-tz'));
    if (!t) continue;
    var row = table.querySelector('tr[data-date="' + t + '"]');
    if (!row) continue;
    row.classList.add('is-today');
    row.setAttribute('aria-current', 'date');
    var lbl = table.getAttribute('data-today-label');
    var first = row.querySelector('th,td');
    if (lbl && first) {
      var s = document.createElement('span');
      s.className = 'today-tag';
      s.textContent = lbl;
      first.appendChild(document.createTextNode(' '));
      first.appendChild(s);
    }
  }
})();
