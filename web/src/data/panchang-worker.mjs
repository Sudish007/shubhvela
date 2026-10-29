// Worker for data/panchang.mjs: computes one city's month tables (engine.panchang per civil day) and the build day's full
// panchang + goodHours. Pure engine calls; the result is plain data (structured-clone safe).
import { parentPort, workerData } from 'node:worker_threads';
import { monthDates } from '../dates.mjs';

const engine = workerData ? await import(workerData.engineUrl) : null;

/** Projection of a PanchangDay for the month table (the full object is kept only for the build day). */
export function dayRow(p) {
  return {
    date: p.date,
    vara: p.vara,
    noSun: p.noSun,
    sunrise: p.sunrise,
    sunset: p.sunset,
    moonrise: p.moonrise,
    moonset: p.moonset,
    tithi: p.tithi ? { index: p.tithi.index, n: p.tithi.n, paksha: p.tithi.paksha, end: p.tithi.end } : null,
    nakshatra: p.nakshatra ? { index: p.nakshatra.index, pada: p.nakshatra.pada, end: p.nakshatra.end } : null,
    rahuKaal: p.rahuKaal ? { start: p.rahuKaal.start, end: p.rahuKaal.end } : null,
    monthPurnimanta: p.monthPurnimanta ? { index: p.monthPurnimanta.index, adhik: p.monthPurnimanta.adhik } : null,
    monthAmanta: p.monthAmanta ? { index: p.monthAmanta.index, adhik: p.monthAmanta.adhik } : null,
  };
}

export function computeCity(engine, job) {
  const { city, months, today } = job;
  const geo = { lat: city.lat, lon: city.lon };
  const out = { slug: city.slug, months: {}, today: null };
  const cache = new Map();
  for (const ym of months) {
    out.months[ym] = monthDates(ym).map((date) => {
      const p = engine.panchang(date, geo, city.tz);
      cache.set(date, p);
      return dayRow(p);
    });
  }
  const p = cache.get(today) ?? engine.panchang(today, geo, city.tz);
  const gh = engine.goodHours(today, geo, city.tz);
  out.today = { date: today, panchang: p, gh };
  return out;
}

if (parentPort) {
  parentPort.on('message', ({ id, job }) => {
    try {
      parentPort.postMessage({ id, result: computeCity(engine, job) });
    } catch (e) {
      parentPort.postMessage({ id, error: `${city(job)}: ${e && e.stack ? e.stack : e}` });
    }
  });
}

function city(job) {
  return job && job.city ? job.city.slug : '?';
}
