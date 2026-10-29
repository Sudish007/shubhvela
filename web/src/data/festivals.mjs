// Festival page data (spec F23/F42; FEAT-D02): engine.festivals(year, tradition, region, place) for the Purnimanta
// (north, New Delhi) and Amanta (south, Chennai) systems for every year of the window, grouped by slug. Years are fixed
// 2026-2028 and extend to buildYear + 2 as the build date advances (monthly cron). Texts come from corpus/festivals via
// the content package's bho -> hi -> en fallback. Every date is engine output.
export const FESTIVAL_YEARS_FROM = 2026;
export const FESTIVAL_YEARS_TO = 2028;
export const NORTH_CITY = 'new-delhi';
export const SOUTH_CITY = 'chennai';

export function festivalYears(buildYear) {
  const to = Math.max(FESTIVAL_YEARS_TO, buildYear + 2);
  const out = [];
  for (let y = FESTIVAL_YEARS_FROM; y <= to; y++) out.push(y);
  return out;
}

function place(engine, slug) {
  const c = engine.webCity(slug);
  if (!c) throw new Error(`City ${slug} missing from web-cities.json`);
  return { city: c, geo: { lat: c.lat, lon: c.lon }, tz: c.tz };
}

/** First-day occurrences in date order (multi-day spans collapse to day 1, which carries `end`). */
function firstDays(occs) {
  return occs.filter((o) => !o.day || o.day === 1).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * Returns { years, north: place, south: place, byYear: Map year -> Map slug -> entry } where entry = {slug, names,
 * north: occ[] (first days), south: occ[], primary: occ (north first, else south), ruleId}.
 */
export function festivalData(engine, buildYear) {
  const years = festivalYears(buildYear);
  const north = place(engine, NORTH_CITY);
  const south = place(engine, SOUTH_CITY);
  const byYear = new Map();
  let pages = 0;
  for (const year of years) {
    const n = engine.festivals(year, 'purnimanta', 'north', north.geo, north.tz);
    const s = engine.festivals(year, 'amanta', 'south', south.geo, south.tz);
    const slugs = new Map();
    const add = (occ, side) => {
      if (!slugs.has(occ.slug)) slugs.set(occ.slug, { slug: occ.slug, names: occ.names, north: [], south: [], ruleId: occ.ruleId, year });
      slugs.get(occ.slug)[side].push(occ);
    };
    for (const o of n) add(o, 'north');
    for (const o of s) add(o, 'south');
    for (const e of slugs.values()) {
      e.north = firstDays(e.north);
      e.south = firstDays(e.south);
      e.primary = e.north[0] ?? e.south[0];
      e.sortDate = e.primary.date;
    }
    const sorted = new Map([...slugs.values()].sort((a, b) => (a.sortDate < b.sortDate ? -1 : a.sortDate > b.sortDate ? 1 : a.slug.localeCompare(b.slug))).map((e) => [e.slug, e]));
    byYear.set(year, sorted);
    pages += sorted.size;
  }
  return { years, north, south, byYear, pages };
}

/** Sunrise/moonrise/sunset at a place on a civil date (static values for the default city; the client recomputes for others). */
export function dayTimes(engine, date, pl) {
  const p = engine.panchang(date, pl.geo, pl.tz);
  return { date, sunrise: p.sunrise, sunset: p.sunset, moonrise: p.moonrise, moonset: p.moonset, noSun: p.noSun, tz: pl.tz };
}

/** Festival text (what to do, rule, convention note) in the resolved language, or null. */
export function festivalCopy(content, slug, lang) {
  const r = content.festivalText(slug, lang);
  return r ? { ...r.item, lang: r.lang, fallback: r.fallback } : null;
}

/** Verification footer inputs: engine festivalVerification for this exact date, or null. */
export function verification(engine, slug, year, tradition, date) {
  return engine.festivalVerification(slug, year, tradition, date);
}
