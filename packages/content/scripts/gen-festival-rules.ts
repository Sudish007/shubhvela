// Writes one `festival-<slug>` rule sentence per row of packages/engine/data/festival-rules.json into
// corpus/rules/en.json (hand-written entries are kept; festival entries are regenerated from the table so the
// sentence always states the rule the engine actually evaluates). Run from the repo root:
//   npx tsx packages/content/scripts/gen-festival-rules.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const RULES_JSON = resolve(HERE, '../../engine/data/festival-rules.json');
const OUT = resolve(HERE, '../corpus/rules/en.json');

interface FestivalRow {
  slug: string;
  names: { en: string };
  rule: Record<string, unknown> & { kind: string };
  regions?: string[];
  traditionDependent: boolean;
}
interface Snippet {
  id: string;
  rule: string;
  source?: string;
  level: 1 | 2 | 3;
  text: string;
  review: 'draft' | 'reviewed';
  params?: string[];
}

const MONTHS = ['Chaitra', 'Vaishakha', 'Jyeshtha', 'Ashadha', 'Shravana', 'Bhadrapada', 'Ashwin', 'Kartik', 'Margashirsha', 'Pausha', 'Magha', 'Phalguna'];
const SIGNS = ['Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya', 'Tula', 'Vrishchika', 'Dhanu', 'Makara', 'Kumbha', 'Meena'];
const NAKSHATRAS = ['Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishtha', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'];
const TITHIS = ['', 'Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi', 'Saptami', 'Ashtami', 'Navami', 'Dashami', 'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIMING: Record<string, string> = {
  udaya: 'on the day whose sunrise has that tithi',
  aparahna: 'on the day that tithi covers the afternoon (aparahna)',
  madhyahna: 'on the day that tithi covers midday (madhyahna)',
  pradosh: 'on the day that tithi covers the evening (pradosh kala, the first tenth of the night)',
  nishita: 'on the night that tithi covers midnight (nishita)',
  moonrise: 'on the day that tithi covers moonrise',
};

function tithiName(paksha: string, tithi: number): string {
  if (tithi === 15) return paksha === 'shukla' ? 'Purnima' : 'Amavasya';
  return TITHIS[tithi];
}
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

function sentence(row: FestivalRow, bySlug: Map<string, FestivalRow>): { text: string; source: string; params: string[] } {
  const r = row.rule;
  const name = row.names.en;
  const region = row.regions?.length ? ` (observed in the ${row.regions.join(' and ')})` : '';
  switch (r.kind) {
    case 'lunar': {
      const month = MONTHS[r.month as number];
      const paksha = cap(r.paksha as string);
      const tithi = tithiName(r.paksha as string, r.tithi as number);
      let text = `${name}${region} falls on ${month} ${paksha} ${tithi} (Purnimanta month name), ${TIMING[r.timing as string]}`;
      if (r.prefer === 'last') text += ', preferring the later day when the tithi covers that time on two days';
      if (r.bhadraFree) text += ', and the observance moves past any Bhadra (Vishti karana) that overlaps the window';
      if (typeof r.nakshatraPreference === 'number') text += `, with a day that also has ${NAKSHATRAS[r.nakshatraPreference]} nakshatra preferred`;
      return { text: text + '.', source: 'Dharmasindhu', params: ['date', 'month', 'paksha', 'tithi', 'window'] };
    }
    case 'solar': {
      const sign = SIGNS[r.sign as number];
      return {
        text: `${name}${region} is the day of the Sun's entry into sidereal ${sign} (${sign} sankranti), or the following day when the sankranti happens after sunset.`,
        source: 'Dharmasindhu',
        params: ['date', 'sankranti'],
      };
    }
    case 'offset': {
      const from = bySlug.get(r.from as string)?.names.en ?? (r.from as string);
      const days = r.days as number;
      const rel = days < 0 ? `${-days} day${-days === 1 ? '' : 's'} before` : `${days} day${days === 1 ? '' : 's'} after`;
      return { text: `${name}${region} is ${rel} ${from}.`, source: 'convention', params: ['date'] };
    }
    case 'nakshatra': {
      return {
        text: `${name}${region} is the day in the solar month of ${SIGNS[r.solarSign as number]} whose sunrise has ${NAKSHATRAS[r.nakshatra as number]} nakshatra; when two days qualify, the one with more daylight under that nakshatra is taken.`,
        source: 'convention',
        params: ['date', 'nakshatra', 'span'],
      };
    }
    case 'span': {
      return {
        text: `${name}${region} runs from ${MONTHS[r.month as number]} ${cap(r.paksha as string)} ${TITHIS[r.fromTithi as number]} to ${TITHIS[r.toTithi as number]} (Purnimanta month name), each day taken by the tithi at sunrise, so the span can be eight or ten days when a tithi is lost or repeated.`,
        source: 'Dharmasindhu',
        params: ['date', 'end', 'day'],
      };
    }
    case 'weekday-in-month': {
      return {
        text: `${name}${region} is every ${WEEKDAYS[r.weekday as number]} inside the lunar month of ${MONTHS[r.month as number]}, whose span depends on the Purnimanta or Amanta reckoning.`,
        source: 'convention',
        params: ['date', 'month'],
      };
    }
    case 'weekday-before': {
      return {
        text: `${name}${region} is the last ${WEEKDAYS[r.weekday as number]} before ${MONTHS[r.month as number]} ${cap(r.paksha as string)} ${tithiName(r.paksha as string, r.tithi as number)}.`,
        source: 'convention',
        params: ['date'],
      };
    }
    case 'pitru-paksha': {
      return {
        text: `${name} is the Purnima shraddha that opens the dark fortnight of Bhadrapada (Purnimanta Ashwin); each following day is matched to a tithi by the afternoon (aparahna) rule down to Sarva Pitru Amavasya.`,
        source: 'Dharmasindhu',
        params: ['date', 'end'],
      };
    }
    default:
      throw new Error(`gen-festival-rules: unknown rule kind ${r.kind} for ${row.slug}`);
  }
}

function main(): void {
  const table = JSON.parse(readFileSync(RULES_JSON, 'utf8')) as { rules: FestivalRow[] };
  const bySlug = new Map(table.rules.map((r) => [r.slug, r]));
  const existing = JSON.parse(readFileSync(OUT, 'utf8')) as Snippet[];
  const kept = existing.filter((s) => !s.id.startsWith('festival-'));
  const generated: Snippet[] = table.rules.map((row) => {
    const { text, source, params } = sentence(row, bySlug);
    return { id: `festival-${row.slug}`, rule: 'festival', source, level: 1, review: 'draft', params, text };
  });
  const all = [...kept, ...generated];
  const body = all.map((s) => '  ' + JSON.stringify({ id: s.id, rule: s.rule, source: s.source, level: s.level, review: s.review, params: s.params, text: s.text })).join(',\n');
  writeFileSync(OUT, `[\n${body}\n]\n`, 'utf8');
  console.log(`gen-festival-rules: ${kept.length} hand-written + ${generated.length} festival entries -> ${OUT}`);
}

main();
