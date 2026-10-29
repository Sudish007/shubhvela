// Display formatting over engine output (Latin digits, tabular numerals; names from the engine locale tables).
// Every function takes the loaded engine module so the templates and the OG renderer share one implementation.

export function hm(engine, utcMs, tz) {
  if (utcMs === null || utcMs === undefined) return null;
  return engine.formatInZone(utcMs, tz, 'HH:mm');
}

/** "Thu 22 Oct 2026" / "गुरु 22 अक्टू 2026" */
export function dateLong(engine, utcMs, tz, lang) {
  return engine.formatInZone(utcMs, tz, 'EEE d MMM yyyy', lang);
}

/** "22 Oct 2026" */
export function dateShort(engine, utcMs, tz, lang) {
  return engine.formatInZone(utcMs, tz, 'd MMM yyyy', lang);
}

/** Civil date string YYYY-MM-DD -> "Mon 26 Oct 2026" without a time zone (calendar dates). */
export function civilDateLong(engine, ymd, lang) {
  const [y, m, d] = ymd.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${engine.locale.weekdayShort[lang][wd]} ${d} ${engine.locale.monthShort[lang][m - 1]} ${y}`;
}

export function civilDateNumeric(ymd) {
  return ymd;
}

/** "Shukla Ekadashi" / "शुक्ल एकादशी" (Purnima and Amavasya stand alone). */
export function tithiLabel(engine, tithi, lang) {
  const name = engine.locale.tithiNames[lang][tithi.index];
  if (tithi.index === 14 || tithi.index === 29) return name;
  const paksha = engine.locale.pakshaNames[lang][tithi.paksha === 'shukla' ? 0 : 1];
  return `${paksha} ${name}`;
}

/** Tithi text of a festival occurrence: "Kartik Krishna Chaturthi". */
export function festivalTithiLabel(engine, tt, lang) {
  if (!tt) return null;
  const month = `${tt.adhik ? engine.locale.adhikLabel[lang] + ' ' : ''}${engine.locale.lunarMonthNames[lang][tt.month]}`;
  const idx = tt.paksha === 'shukla' ? tt.tithi - 1 : 15 + tt.tithi - 1;
  const name = engine.locale.tithiNames[lang][Math.min(29, Math.max(0, idx))];
  if (idx === 14 || idx === 29) return `${month} ${name}`;
  return `${month} ${engine.locale.pakshaNames[lang][tt.paksha === 'shukla' ? 0 : 1]} ${name}`;
}

export function nakshatraLabel(engine, index, lang) {
  return engine.locale.nakshatraNames[lang][index];
}

/** "6°44′" from a chart point. */
export function degStr(point) {
  return `${point.degree}°${String(point.minute).padStart(2, '0')}′`;
}

export function signName(engine, sign, lang) {
  return engine.locale.signNames[lang][sign - 1];
}

export function planetName(engine, id, lang) {
  return engine.locale.planetNames[lang][id];
}

/** Window "13:30 – 14:55" or the dash when missing. */
export function windowStr(engine, w, tz, dash = '—') {
  if (!w) return dash;
  return `${hm(engine, w.start, tz)} – ${hm(engine, w.end, tz)}`;
}

/** Ayanamsa label from the UI strings (settings.ayanamsa.<id>), stripped of "(default)" for inline use. */
export function ayanamsaLabel(t, id) {
  return t(`settings.ayanamsa.${id}`).replace(/\s*\(.*\)$/, '');
}

export function nodeLabel(t, node) {
  return t(`settings.nodes.${node}`).replace(/\s*\(.*\)$/, '');
}
