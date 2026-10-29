// The 331 web cities (packages/engine/data/web-cities.json via engine.WEB_CITIES; decision P3): slugs, display names per
// language (GeoNames name_hi for hi/bho when present, else Latin — carry-over B-REVIEW-NIT-1 fallback), country groups
// for the index page and the nearest "sibling" cities for a city page. Nothing here computes a date.
import { HOME_CITY_SLUG } from '../config.mjs';

export function cityList(engine) {
  const cities = engine.WEB_CITIES;
  if (cities.length !== 331) throw new Error(`web-cities.json has ${cities.length} cities, the page set says 331`);
  return cities;
}

export function homeCity(engine) {
  const c = engine.webCity(HOME_CITY_SLUG);
  if (!c) throw new Error(`Home city ${HOME_CITY_SLUG} missing from web-cities.json`);
  return c;
}

/** Display name: Latin for English; the GeoNames Hindi name for hi/bho when present (Devanagari), else Latin. */
export function cityName(city, lang) {
  return lang === 'en' || !city.nameHi ? city.name : city.nameHi;
}

/** "Lucknow, Uttar Pradesh, India" / "लखनऊ, Uttar Pradesh, भारत" (admin1 stays Latin: GeoNames has no Hindi admin names). */
export function cityLine(city, lang, t) {
  const parts = [cityName(city, lang)];
  if (city.admin1 && city.country === 'IN') parts.push(city.admin1);
  parts.push(countryName(city, lang, t));
  return parts.join(', ');
}

export function countryName(city, lang, t) {
  const key = `country.${city.country}`;
  return lang !== 'en' && t && t.has(key) ? t(key) : city.countryName;
}

/** Great-circle distance in km (haversine) for sibling ordering only; never shown. */
export function distanceKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** The n nearest other cities (same country first when it has enough; else the global nearest). */
export function siblingCities(city, cities, n = 8) {
  const others = cities.filter((c) => c.slug !== city.slug).map((c) => ({ c, d: distanceKm(city, c) }));
  const same = others.filter((o) => o.c.country === city.country).sort((a, b) => a.d - b.d);
  const list = same.length >= n ? same : [...same, ...others.filter((o) => o.c.country !== city.country).sort((a, b) => a.d - b.d)];
  return list.slice(0, n).map((o) => o.c);
}

/** Cities grouped by country for the index page: India first (by population), then the others by name. */
export function countryGroups(cities, lang, t) {
  const groups = new Map();
  for (const c of cities) {
    if (!groups.has(c.country)) groups.set(c.country, { code: c.country, name: countryName(c, lang, t), cities: [] });
    groups.get(c.country).cities.push(c);
  }
  const out = [...groups.values()];
  for (const g of out) g.cities.sort((a, b) => (b.population ?? 0) - (a.population ?? 0) || a.name.localeCompare(b.name));
  out.sort((a, b) => (a.code === 'IN' ? -1 : b.code === 'IN' ? 1 : b.cities.length - a.cities.length || a.name.localeCompare(b.name)));
  return out;
}

/** Compact JSON for the client city picker: [slug, name, nameHi|'', lat, lon, tz]. */
export function cityPickerJson(cities) {
  return JSON.stringify(cities.map((c) => [c.slug, c.name, c.nameHi ?? '', c.lat, c.lon, c.tz]));
}
