// Panchang suite (spec section 6): 30 dates x 5 cities vs Drik Panchang day-panchang pages.
// Gate tolerances: sunrise/sunset <= 1 min, tithi/nakshatra/yoga end <= 2 min, Rahu Kaal <= 1 min, moonrise <= 2 min.
// Extras recorded with their own tolerances (reference/panchang/cases.json): yamaganda/gulika <= 1 min,
// abhijit/brahma/karana/moonset/bhadra/panchak <= 2 min, names and samvats exact, Lahiri ayanamsa <= 0.01 deg.
// Drik prints wall-clock minutes rounded to the nearest minute; minuteDeviation() rounds the engine the same way.
import { afterAll, describe, expect, it } from 'vitest';
import { panchang, type PanchangDay } from '../../src/panchang/panchang';
import { nextCrossing, siderealSun, STEP } from '../../src/panchang/astro';
import { locale } from '../../src/index';
import {
  loadCases,
  loadReference,
  minuteDeviation,
  normName,
  round,
  sameName,
  utcToLocalIso,
  warnMissing,
  writeSuiteResult,
} from './_shared';

interface City {
  geonameId: number;
  name: string;
  lat: number;
  lon: number;
  tz: string;
}
interface PanchangCases {
  tolerances: Record<string, number>;
  cities: Record<string, City>;
  dates: { date: string; why: string }[];
}
interface Upto {
  name: string;
  end: string | null;
  raw: string;
}
interface Range {
  start: string | null;
  end: string | null;
  text: string;
}
interface DrikValues {
  city: string;
  date: string;
  tz: string;
  sunrise: string | null;
  sunset: string | null;
  moonrise: string | null;
  moonset: string | null;
  tithi: Upto[];
  nakshatra: Upto[];
  yoga: Upto[];
  karana: Upto[];
  weekday: string | null;
  paksha: string | null;
  vikramSamvat: string | null;
  shakaSamvat: string | null;
  chandramasa: string[];
  moonsign: string | null;
  sunsign: string | null;
  drikRitu: string | null;
  vedicRitu: string | null;
  drikAyana: string | null;
  vedicAyana: string | null;
  brahmaMuhurta: Range | null;
  abhijit: Range | null;
  rahuKalam: Range | null;
  yamaganda: Range | null;
  gulikaiKalam: Range | null;
  bhadra: Range[];
  panchaka: Range[];
  lahiriAyanamsha: number | null;
}

const cases = loadCases<PanchangCases>('panchang');
const T = cases.tolerances;
const RITU = ['Vasanta', 'Grishma', 'Varsha', 'Sharad', 'Hemanta', 'Shishira'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "02:27 AM, Mar 21" / "07:51 AM" (Drik wall clock) -> "YYYY-MM-DDTHH:MM" relative to the page date. */
function uptoIso(text: string, pageDate: string): string | null {
  const clock = /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(text);
  if (!clock) return null;
  let hh = Number(clock[1]);
  const mm = Number(clock[2]);
  const ap = clock[3].toUpperCase();
  if (ap === 'PM' && hh < 12) hh += 12;
  if (ap === 'AM' && hh === 12) hh = 0;
  const [py, pm, pd] = pageDate.split('-').map(Number);
  let [y, m, d] = [py, pm, pd];
  const suffix = /,\s*([A-Z][a-z]{2})\s+(\d{1,2})(?:,\s*(\d{4}))?/.exec(text);
  if (suffix) {
    m = MONTHS.indexOf(suffix[1]) + 1;
    d = Number(suffix[2]);
    y = suffix[3] ? Number(suffix[3]) : m < pm ? py + 1 : py;
  }
  const p2 = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${y}-${p2(m)}-${p2(d)}T${p2(hh)}:${p2(mm)}`;
}

/** End of the sidereal Sun sign running at sunrise (the engine exposes the sign, not its interval). */
function sunSignEnd(p: PanchangDay): number {
  const target = ((p.sunSign + 1) * 30) % 360;
  return nextCrossing((ms) => siderealSun(ms, p.ayanamsa), target, p.sunrise!, STEP.sun);
}

interface Dev {
  field: string;
  value: number;
  tolerance: number;
}

/** One case: every comparison appends to `devs`; a mismatch of names/numbers appends to `errors`. */
function compare(p: PanchangDay, v: DrikValues, zone: string): { devs: Dev[]; errors: string[] } {
  const devs: Dev[] = [];
  const errors: string[] = [];
  const dev = (field: string, engineMs: number | null, ref: string | null, tolerance: number) => {
    if (ref === null && engineMs === null) return;
    if (ref === null || engineMs === null) {
      errors.push(`${field}: engine ${engineMs === null ? 'none' : utcToLocalIso(engineMs, zone)} vs Drik ${ref ?? 'none'}`);
      return;
    }
    const d = minuteDeviation(engineMs, ref, zone);
    devs.push({ field, value: d, tolerance });
    if (d > tolerance) errors.push(`${field}: engine ${utcToLocalIso(engineMs, zone)} vs Drik ${ref} (${d} min > ${tolerance})`);
  };
  const same = (field: string, engine: string | number | null | undefined, ref: string | null | undefined, cmp: (a: string, b: string) => boolean = sameName) => {
    if (ref === null || ref === undefined) return;
    if (engine === null || engine === undefined || !cmp(String(engine), ref)) errors.push(`${field}: engine ${engine} vs Drik ${ref}`);
  };

  if (p.noSun) {
    errors.push('engine reports no sunrise/sunset for this day');
    return { devs, errors };
  }
  dev('sunrise', p.sunrise, v.sunrise, T.sunriseMin);
  dev('sunset', p.sunset, v.sunset, T.sunsetMin);
  dev('moonrise', p.moonrise, v.moonrise, T.moonriseMin);
  dev('moonset', p.moonset, v.moonset, T.extraSegmentsMin);

  // Sequences over the Vedic day: names in order, end times where Drik prints one ("upto Full Night" = none).
  // A boundary that falls within the tolerance of the next sunrise may put one more or one fewer interval on
  // either side; such a difference is not counted as an error.
  const nearNextSunrise = (ms: number, tolerance: number) => Math.abs(ms - p.nextSunrise!) <= tolerance * 60_000;
  const seq = (field: string, engine: { index: number; end: number }[], names: readonly string[], ref: Upto[], tolerance: number) => {
    for (let i = 0; i < ref.length; i++) {
      const r = ref[i];
      const e = engine[i];
      if (!e) {
        if (!(i > 0 && nearNextSunrise(engine[i - 1].end, tolerance))) errors.push(`${field}[${i}]: Drik lists ${r.name} but the engine has only ${engine.length} intervals`);
        continue;
      }
      if (!sameName(names[e.index], r.name)) {
        errors.push(`${field}[${i}]: engine ${names[e.index]} vs Drik ${r.name}`);
        continue;
      }
      if (r.end) dev(`${field}[${i}].end`, e.end, r.end, tolerance);
      else if (!nearNextSunrise(e.end, tolerance) && e.end < p.nextSunrise!) errors.push(`${field}[${i}]: Drik prints no end (runs past the next sunrise) but the engine ends it at ${utcToLocalIso(e.end, zone)}`);
    }
  };
  seq('tithi', p.tithis, locale.tithiNames.en, v.tithi, T.tithiEndMin);
  seq('nakshatra', p.nakshatras, locale.nakshatraNames.en, v.nakshatra, T.nakshatraEndMin);
  seq('yoga', p.yogas, locale.yogaNames.en, v.yoga, T.yogaEndMin);
  seq('karana', p.karanas, locale.karanaNames.en, v.karana, T.extraSegmentsMin);

  const win = (field: string, engine: { start: number; end: number } | null, ref: Range | null, tolerance: number) => {
    if (!ref || !ref.start || !ref.end) return;
    if (!engine) {
      errors.push(`${field}: engine none vs Drik ${ref.text}`);
      return;
    }
    dev(`${field}.start`, engine.start, ref.start, tolerance);
    dev(`${field}.end`, engine.end, ref.end, tolerance);
  };
  win('rahuKaal', p.rahuKaal, v.rahuKalam, T.rahuKaalMin);
  win('yamaganda', p.yamaganda, v.yamaganda, T.yamagandaGulikaMin);
  win('gulika', p.gulika, v.gulikaiKalam, T.yamagandaGulikaMin);
  win('abhijit', p.abhijit, v.abhijit, T.extraSegmentsMin);
  win('brahmaMorning', p.brahmaMorning, v.brahmaMuhurta, T.extraSegmentsMin);

  // Bhadra and Panchak windows as Drik prints them: clipped to the Vedic day; "Whole Day" = covers it entirely.
  const clip = (w: { start: number; end: number }) => ({ start: Math.max(w.start, p.sunrise!), end: Math.min(w.end, p.nextSunrise!) });
  const bhadra = p.bhadra.filter((b) => b.end > p.sunrise! && b.start < p.nextSunrise!).map(clip);
  if (bhadra.length !== v.bhadra.length) errors.push(`bhadra: engine ${bhadra.length} window(s) vs Drik ${v.bhadra.length} (${v.bhadra.map((b) => b.text).join('; ')})`);
  else bhadra.forEach((b, i) => win(`bhadra[${i}]`, b, v.bhadra[i], T.extraSegmentsMin));
  if (v.panchaka.length) {
    const r = v.panchaka[0];
    if (!p.panchak) errors.push(`panchak: engine none vs Drik ${r.text}`);
    else if (/whole day/i.test(r.text)) {
      if (p.panchak.start > p.sunrise! + 60_000 || p.panchak.end < p.nextSunrise! - 60_000) errors.push(`panchak: Drik Whole Day vs engine ${utcToLocalIso(p.panchak.start, zone)}-${utcToLocalIso(p.panchak.end, zone)}`);
    } else win('panchak', clip(p.panchak), r, T.extraSegmentsMin);
  } else if (p.panchak && p.panchak.end > p.sunrise! + 60_000 && p.panchak.start < p.nextSunrise! - 60_000) {
    errors.push(`panchak: engine ${utcToLocalIso(p.panchak.start, zone)}-${utcToLocalIso(p.panchak.end, zone)} vs Drik none`);
  }

  // Names and numbers.
  same('weekday', locale.weekdayNames.en[p.vara], v.weekday);
  same('paksha', locale.pakshaNames.en[p.tithi.paksha === 'shukla' ? 0 : 1], v.paksha ? v.paksha.replace(/paksha/i, '') : null);
  // "Kumbha" or "Karka upto 07:51 AM" (the sign changes inside the Vedic day; the end is compared as an extra).
  const signAt = (field: string, engineIndex: number, intervals: { end: number }[], ref: string | null) => {
    if (!ref) return;
    const m = /^(.*?)(?:\s+upto\s+(.+))?$/i.exec(ref.trim());
    same(field, locale.signNames.en[engineIndex], m ? m[1] : ref);
    if (m && m[2]) {
      const endIso = uptoIso(m[2], v.date);
      if (endIso) dev(`${field}.end`, intervals[0].end, endIso, T.extraSegmentsMin);
    }
  };
  signAt('moonsign', p.moonSign, p.moonSigns, v.moonsign);
  signAt('sunsign', p.sunSign, [{ end: sunSignEnd(p) }], v.sunsign);
  same('vikramSamvat', p.vikramSamvat, v.vikramSamvat ? v.vikramSamvat.split(' ')[0] : null, (a, b) => a === b);
  same('shakaSamvat', p.shakaSamvat, v.shakaSamvat ? v.shakaSamvat.split(' ')[0] : null, (a, b) => a === b);
  // Drik prints "Jyeshtha (Adhik) - Amanta" for an intercalary month; the name and the adhik flag are compared.
  const monthText = (m: { index: number; adhik: boolean }) => `${locale.lunarMonthNames.en[m.index]}${m.adhik ? ' (Adhik)' : ''}`;
  for (const line of v.chandramasa) {
    const m = /^(.*?)\s*-\s*(Purnimanta|Amanta)$/i.exec(line);
    if (!m) continue;
    const engine = m[2].toLowerCase() === 'purnimanta' ? p.monthPurnimanta : p.monthAmanta;
    const refName = m[1].replace(/\s+/g, ' ').trim();
    const refAdhik = /adhik/i.test(refName);
    const eq = normName(locale.lunarMonthNames.en[engine.index]) === normName(refName.replace(/adhika?/i, '').replace(/[()]/g, '')) && engine.adhik === refAdhik;
    if (!eq) errors.push(`chandramasa ${m[2]}: engine ${monthText(engine)} vs Drik ${refName}`);
  }
  same('drikRitu', RITU[p.ritu.drik], v.drikRitu);
  same('vedicRitu', RITU[p.ritu.vedic], v.vedicRitu);
  same('drikAyana', p.ayana.drik, v.drikAyana);
  same('vedicAyana', p.ayana.vedic, v.vedicAyana);
  if (v.lahiriAyanamsha !== null) {
    const d = Math.abs(p.ayanamsaDeg - v.lahiriAyanamsha);
    devs.push({ field: 'ayanamsaDeg', value: d, tolerance: T.ayanamsaDeg });
    if (d > T.ayanamsaDeg) errors.push(`ayanamsa: engine ${p.ayanamsaDeg.toFixed(6)} vs Drik ${v.lahiriAyanamsha} (${d.toFixed(5)} deg > ${T.ayanamsaDeg})`);
  }
  return { devs, errors };
}

describe('panchang suite — 30 dates x 5 cities vs Drik Panchang (spec section 6)', () => {
  const required = Object.keys(cases.cities).length * cases.dates.length;
  const missing: string[] = [];
  const failures: string[] = [];
  const maxDev: Record<string, number> = {};
  let compared = 0;
  let passed = 0;

  for (const [cityId, city] of Object.entries(cases.cities)) {
    for (const { date } of cases.dates) {
      const id = `${cityId}-${date}`;
      const ref = loadReference<DrikValues>('panchang', 'drikpanchang', id);
      if (!ref) {
        missing.push(id);
        continue;
      }
      compared++;
      it(`${city.name} ${date} matches Drik Panchang within tolerance`, () => {
        const p = panchang(date, { lat: city.lat, lon: city.lon }, city.tz);
        const { devs, errors } = compare(p, ref.values, city.tz);
        for (const d of devs) {
          const key = d.field.replace(/\[\d+\]/, '').replace(/\.(start|end)$/, '');
          maxDev[key] = Math.max(maxDev[key] ?? 0, d.value);
        }
        if (errors.length) failures.push(`${id}: ${errors.join(' | ')}`);
        else passed++;
        expect(errors, `${id}\n${ref.source_url}`).toEqual([]);
      });
    }
  }

  afterAll(() => {
    warnMissing('panchang', 'drikpanchang', missing, required);
    writeSuiteResult({
      suite: 'panchang',
      required,
      compared,
      passed,
      failed: compared - passed,
      skipped: missing.length,
      maxDeviation: Object.fromEntries(Object.entries(maxDev).map(([k, v]) => [k === 'ayanamsaDeg' ? 'ayanamsaDeg' : `${k}Min`, round(v, 5)])),
      sources: { drikpanchang: compared },
      failures,
      generatedAt: new Date().toISOString(),
      tolerances: T,
      missing,
    });
  });
});
