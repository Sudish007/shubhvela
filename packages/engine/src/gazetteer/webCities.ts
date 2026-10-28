// The 331 web-companion cities (plan.md P3: 300 largest Indian cities + Kathmandu + 30 diaspora cities) read from
// data/web-cities.json - the ONE list behind the site's /panchang/<city>/ pages and the app's
// shubhvela://panchang/<city> deep link (F37), so a slug the web publishes always resolves in the app.
import citiesJson from '../../data/web-cities.json';

export interface WebCity {
  geonameid: number;
  name: string;
  nameAscii: string;
  nameHi: string | null;
  admin1: string | null;
  country: string;
  countryName: string;
  lat: number;
  lon: number;
  /** Canonical IANA zone id (a key of data/tz-transitions.json). */
  tz: string;
  /** URL slug used by the web companion: lower-case ASCII, hyphen-separated. */
  slug: string;
  population: number;
  group: 'india' | 'nepal' | 'diaspora';
}

const data = citiesJson as unknown as { count: number; cities: WebCity[] };

export const WEB_CITIES: readonly WebCity[] = data.cities;

const bySlug = new Map<string, WebCity>(WEB_CITIES.map((c) => [c.slug, c]));

/** Normalises a slug the way the web build does (lower-case, spaces/underscores to hyphens). */
export function normaliseCitySlug(slug: string): string {
  return slug
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** The web city for a slug, or null when the slug is not one of the 331 published pages. */
export function webCity(slug: string): WebCity | null {
  return bySlug.get(normaliseCitySlug(slug)) ?? null;
}
