// Panchang page data (FEAT-D02, design.md 9 page set): for every web city the current month and the next month as rows
// (engine.panchang per civil day in the city's zone) plus the build day's full panchang and goodHours for the "today"
// card and band. "Current month" is derived from the build instant in Asia/Kolkata (UTC+5:30), so the monthly cron
// (23 3 1 * *) rolls both pages forward; every number is engine output. Work is spread over worker threads (pool.mjs).
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { WEB_DIR } from '../config.mjs';
import { civilDate } from '../dates.mjs';
import { runPool } from './pool.mjs';

export const BUILD_TZ = 'Asia/Kolkata';
export { civilDate };

/** The build calendar: today (IST), the current month and the next month, rolling 12 months for muhurat pages. */
export function buildCalendar(engine, nowMs = Date.now()) {
  const today = civilDate(engine, nowMs, BUILD_TZ);
  const [y, m] = today.split('-').map(Number);
  const ym = (yy, mm) => `${yy}-${String(mm).padStart(2, '0')}`;
  const addMonths = (n) => {
    const t = y * 12 + (m - 1) + n;
    return ym(Math.floor(t / 12), (t % 12) + 1);
  };
  const months12 = [];
  for (let i = 0; i < 12; i++) months12.push(addMonths(i));
  return { today, year: y, currentMonth: ym(y, m), nextMonth: addMonths(1), months12 };
}

/** "October 2026" / "अक्टूबर 2026" from YYYY-MM via the engine month table. */
export function monthLabel(engine, ym, lang) {
  const [y, m] = ym.split('-').map(Number);
  return `${engine.locale.monthNames[lang][m - 1]} ${y}`;
}

/**
 * Computes the month rows and the today card for every city. Returns Map slug -> {months: {ym: rows[]}, today: {date,
 * panchang, gh}}. `onProgress(done, total)` is optional.
 */
export async function panchangData(engine, cities, calendar, { enginePath, log } = {}) {
  const engineUrl = pathToFileURL(enginePath ?? resolve(WEB_DIR, '.cache', 'engine.mjs')).href;
  const months = [calendar.currentMonth, calendar.nextMonth];
  const jobs = cities.map((city) => ({ city: { slug: city.slug, lat: city.lat, lon: city.lon, tz: city.tz }, months, today: calendar.today }));
  const results = await runPool(resolve(WEB_DIR, 'src', 'data', 'panchang-worker.mjs'), { engineUrl }, jobs);
  const map = new Map();
  for (const r of results) map.set(r.slug, r);
  if (log) log(`panchang months for ${map.size} cities (${months.join(', ')}), today ${calendar.today}`);
  return map;
}
