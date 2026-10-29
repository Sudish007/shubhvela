// Table rows shared by the Node templates and the browser data bundle (pure: engine module/object + translator in,
// markup out): muhurat windows, vrat occurrences and the day-times key/value rows of the festival city picker. Keeping
// them here means the client recompute renders exactly what the static page rendered for the default city.
import { esc } from './html.mjs';
import { civilDateLong, hm, nakshatraLabel, range, timeOrDayTime, tithiText, vratKeyTimeText } from './format.mjs';

export const PERSONAL_RULES = ['chandra-bala', 'tara-bala'];

/** The rules a window met, in the engine's display order ("Tithi · Vara · Rahu Kaal …"). */
export function metRulesLine(t, w) {
  return w.rules.filter((r) => r.met).map((r) => t(`muhurat.rule.${r.id}`)).join(' · ');
}

/**
 * The panchang rules a window did NOT meet ("not met: Vara · Abhijit"), leaving out the two personal rules that the
 * page's note already declares unmet for everyone (no birth chart here); "every panchang rule met" when none is left.
 */
export function unmetRulesLine(t, w) {
  const unmet = w.rules.filter((r) => !r.met && !PERSONAL_RULES.includes(r.id)).map((r) => t(`muhurat.rule.${r.id}`));
  return unmet.length ? t('muhurat.notMet', { rules: unmet.join(' · ') }) : t('muhurat.allPanchangMet');
}

/**
 * Windows table rows grouped by day (windows sorted by start): a day header row (weekday + date, data-date for the
 * today mark), then one row per window — time (+ night/clipped note), "N/10 rules met" + the met rules, choghadiya;
 * the tithi · nakshatra line is printed when it differs from the previous window of the day (the engine gives the
 * tithi running for most of the window).
 */
export function windowRows(engine, t, lang, windows, tz) {
  const out = [];
  let day = null;
  let lastTn = null;
  for (const w of windows) {
    if (w.day !== day) {
      day = w.day;
      lastTn = null;
      const [, m, d] = w.day.split('-').map(Number);
      out.push(`<tr class="day" data-date="${w.day}"><th scope="rowgroup" colspan="3">${esc(`${engine.locale.weekdayShort[lang][w.vara]} ${d} ${engine.locale.monthShort[lang][m - 1]}`)}</th></tr>`);
    }
    const chog = w.choghadiya.map((c) => t(`band.chog.${c.toLowerCase()}`)).join(' · ');
    const tn = `${engine.locale.tithiNames[lang][w.tithi.index]} · ${nakshatraLabel(engine, w.nakshatra.index, lang)}`;
    const tnLine = tn !== lastTn ? `<span class="s">${esc(tn)}</span>` : '';
    lastTn = tn;
    const notes = [w.night ? t('muhurat.night_tag') : null, w.clippedByRahuKaal ? t('muhurat.clipped') : null].filter(Boolean);
    out.push(`<tr><td>${esc(range(engine, w.start, w.end, tz))}${notes.length ? `<span class="s">${esc(notes.join(' · '))}</span>` : ''}</td><td><strong>${w.met}/${w.of}</strong><span class="s">${esc(unmetRulesLine(t, w))}</span></td><td>${esc(chog)}${tnLine}</td></tr>`);
  }
  return out;
}

export function emptyWindowsRow(t) {
  return `<tr><td colspan="3" class="empty">${esc(t('muhurat.noneThisMonth'))}</td></tr>`;
}

export function occurrenceRows(engine, t, lang, occs, tz) {
  return occs.map((o) => {
    const extras = [];
    const ex = o.extra ?? {};
    if (typeof ex.vaishnavaDate === 'string' && ex.vaishnavaDate !== o.date) extras.push(`${t('vrat.vaishnavaLabel')}: ${civilDateLong(engine, ex.vaishnavaDate, lang)}`);
    if (typeof ex.hariVasaraEnd === 'number') extras.push(`${t('vrat.hariVasaraLabel')}: ${timeOrDayTime(engine, ex.hariVasaraEnd, tz, lang, o.date)}`);
    if (typeof ex.nahayKhay === 'string') extras.push(`${t('vrat.chhath.nahayKhay')}: ${civilDateLong(engine, ex.nahayKhay, lang)}`);
    if (typeof ex.kharna === 'string') extras.push(`${t('vrat.chhath.kharna')}: ${civilDateLong(engine, ex.kharna, lang)}`);
    if (typeof ex.ushaArghya === 'string') extras.push(`${t('vrat.chhath.ushaArghya')}: ${civilDateLong(engine, ex.ushaArghya, lang)}`);
    if (ex.angaraki === true) extras.push(t('vrat.angaraki'));
    const tithi = tithiText(engine, t, lang, o.month.purnimanta.index, o.month.purnimanta.adhik, o.paksha, o.tithi);
    return `<tr data-date="${o.date}"><th scope="row">${esc(civilDateLong(engine, o.date, lang))}</th><td>${esc(t(`vrat.name.${o.name}`))}${extras.length ? `<span class="s">${esc(extras.join(' · '))}</span>` : ''}</td><td>${esc(vratKeyTimeText(engine, t, o.keyTime, tz))}</td><td>${esc(tithi)}<span class="s">${esc(t('common.till', { time: timeOrDayTime(engine, o.tithiSpan.end, tz, lang, o.date) }))}</span></td></tr>`;
  });
}

/** Key/value rows (markup) for a city's sunrise/sunset/moonrise/moonset on a date (festival picker output). */
export function dayTimesRows(engine, t, lang, { cityLabel, date, p, tz }) {
  const rows = [[t('data.pickedCity'), cityLabel]];
  if (!p || p.noSun || p.sunrise === null) rows.push([t('panchang.sunriseSunset'), t('today.noSun')]);
  else {
    rows.push([t('panchang.sunriseSunset'), `${hm(engine, p.sunrise, tz)} · ${hm(engine, p.sunset, tz)}`]);
    rows.push([t('panchang.moonriseMoonset'), `${p.moonrise !== null ? timeOrDayTime(engine, p.moonrise, tz, lang, date) : t('mini.none')} · ${p.moonset !== null ? timeOrDayTime(engine, p.moonset, tz, lang, date) : t('mini.none')}`]);
  }
  return rows.map(([k, v]) => `<div class="kv"><span>${esc(k)}</span><span class="num">${esc(v)}</span></div>`).join('\n');
}
