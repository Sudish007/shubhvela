// Vrat page data (spec F22/F42; FEAT-D02): engine.vratOccurrences for each of the 12 families over the next 12 months
// from the build day at New Delhi (the client recomputes for a picked city), with the key time that matters (parana,
// moonrise, pradosh kala, nishita ...) exactly as the app's VratCard shows it. Texts: corpus/vrats (vrat-<family>).
export const VRAT_CITY = 'new-delhi';
export const VRAT_NEXT = 12;

/** URL slug per engine family id (camelCase -> kebab-case). */
export function vratSlug(family) {
  return family.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

/** The next `n` first-day occurrences on or after `today` (multi-day vrats such as Navratri collapse to day 1). */
export function nextOccurrences(occs, today, n = VRAT_NEXT) {
  return occs
    .filter((o) => o.date >= today && (o.extra?.day === undefined || o.extra.day === 1))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .slice(0, n);
}

/** UTC-ms range: the build day (from its earliest zone) to one year later. */
export function yearRange(today) {
  const [y, m, d] = today.split('-').map(Number);
  return { from: Date.UTC(y, m - 1, d) - 12 * 3_600_000, to: Date.UTC(y + 1, m - 1, d) + 12 * 3_600_000 };
}

export function vratData(engine, calendar, { log } = {}) {
  const city = engine.webCity(VRAT_CITY);
  if (!city) throw new Error(`City ${VRAT_CITY} missing from web-cities.json`);
  const geo = { lat: city.lat, lon: city.lon };
  const families = engine.VRAT_FAMILIES;
  if (families.length !== 12) throw new Error(`VRAT_FAMILIES has ${families.length} entries, the page set says 12`);
  const { from, to } = yearRange(calendar.today);
  const byFamily = new Map();
  for (const family of families) {
    const occs = nextOccurrences(engine.vratOccurrences(family, from, to, geo, city.tz), calendar.today);
    byFamily.set(family, { family, slug: vratSlug(family), occurrences: occs });
  }
  if (log) log(`vrat occurrences for ${families.length} families at ${city.name}`);
  return { city, geo, tz: city.tz, families, byFamily, from, to };
}

export function vratCopy(content, family, lang) {
  const r = content.lookup('vrats', `vrat-${family}`, lang);
  return r ? { text: r.text, rule: r.snippet.rule, source: r.snippet.source, lang: r.lang, fallback: r.fallback } : null;
}
