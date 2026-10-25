// Drik Panchang monthly festival pages for the festival suite (plan.md section 8).
//   node reference/fetch/drik-festivals.mjs [--city delhi|chennai] [--year 2026] [--max 60]
// For each city-year the 12 pages /festivals/month/festivals-<month>.html?year=<y>&geoname-id=<id> are loaded
// with Drik's school cookie set to the city's tradition (drik-school-name = purnimanta | amanta), and every
// listed event is stored: {name, date, text (tithi / basis line)}. Output: reference/festivals/drikpanchang/
// <city>-<year>.json (written after all 12 months; a partially fetched year resumes from the months already
// stored in $env:TEMP/shubhvela-ref-festival-partial.json).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REFERENCE_DIR, CURSOR_FILE, parseArgs, readJson, runFetcher, writeFact, writeJson } from './common.mjs';

const args = parseArgs();
const cases = readJson(join(REFERENCE_DIR, 'festivals', 'cases.json'));
const OUT_DIR = join(REFERENCE_DIR, 'festivals', 'drikpanchang');
const SITE = 'drikpanchang';
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const PARTIAL_FILE = join(CURSOR_FILE, '..', 'shubhvela-ref-festival-partial.json');

export function pageUrl(geonameId, year, month) {
  return `https://www.drikpanchang.com/festivals/month/festivals-${MONTHS[month - 1]}.html?year=${year}&geoname-id=${geonameId}`;
}

/** "March 3, 2026, Tuesday" -> "2026-03-03". */
export function parseGregDate(text) {
  const m = /^([A-Z][a-z]+) (\d{1,2}), (\d{4})/.exec(text.trim());
  if (!m) return null;
  const mi = MONTHS.findIndex((n) => n.startsWith(m[1].toLowerCase().slice(0, 3))) + 1;
  if (!mi) return null;
  return `${m[3]}-${String(mi).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

async function extractEvents(page) {
  return page.evaluate(() => {
    const out = [];
    for (const a of document.querySelectorAll('a.dpEvent, .dpEvent')) {
      const name = a.querySelector('.dpEventName')?.innerText?.replace(/\s+/g, ' ').trim();
      const date = a.querySelector('.dpEventGregDate')?.innerText?.replace(/\s+/g, ' ').trim();
      const info = a.querySelector('.dpEventInfo');
      let text = '';
      if (info) {
        text = [...info.childNodes]
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => n.textContent.replace(/\s+/g, ' ').trim())
          .filter(Boolean)
          .join(' ');
      }
      const cls = a.querySelector('.dpEventName')?.className || '';
      if (name && date) out.push({ name, date, text, kind: (cls.match(/dp(\w+)EventColor/) || [])[1] || '', href: a.getAttribute('href') || '' });
    }
    return out;
  });
}

const isMain = process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href;
if (isMain) await runFetcher('drik-festivals', SITE, async (session) => {
  if (args.max) session.maxLoads = Math.min(session.maxLoads, Number(args.max));
  const partial = existsSync(PARTIAL_FILE) ? readJson(PARTIAL_FILE) : {};
  for (const [cityId, city] of Object.entries(cases.cities)) {
    if (args.city && args.city !== cityId) continue;
    for (const year of cases.years) {
      if (args.year && Number(args.year) !== year) continue;
      const outFile = join(OUT_DIR, `${cityId}-${year}.json`);
      const key = `${cityId}-${year}`;
      partial[key] = partial[key] || { months: {} };
      if (existsSync(outFile)) {
        // A committed year file is complete unless it says which months it holds (a partial written when the
        // site blocked the run); a partial seeds the resume and is rewritten when the missing months arrive.
        const existing = readJson(outFile);
        const have = existing.values?.monthsFetched;
        if (!Array.isArray(have) || have.length >= 12) continue;
        for (const m of have) {
          if (partial[key].months[m]) continue;
          partial[key].months[m] = { url: pageUrl(city.geonameId, year, m), title: '', school: existing.values.schoolShownByPage?.[0] ?? 'unknown', events: existing.values.events.filter((e) => e.month === m).map((e) => ({ ...e, dateText: e.date })) };
        }
      }
      const writeYearFile = (complete) => {
        const months = partial[key].months;
        const have = Object.keys(months).map(Number).sort((a, b) => a - b);
        const events = [];
        for (const month of have) for (const e of months[month].events) events.push({ name: e.name, date: e.date, text: e.text, kind: e.kind, month });
        const schools = [...new Set(Object.values(months).map((m) => m.school))];
        writeFact(outFile, {
          caseId: key,
          source: SITE,
          sourceUrl: pageUrl(city.geonameId, year, 1).replace('january', '<month>'),
          values: { city: cityId, geonameId: city.geonameId, year, tradition: city.tradition, region: city.region, schoolCookie: city.school, schoolShownByPage: schools, complete, monthsFetched: have, eventCount: events.length, events },
          notes: [
            `Every event of the ${complete ? 'twelve' : `${have.length} fetched (of twelve)`} monthly pages (Hindu festivals, vrats, sankrantis, regional and non-Hindu holidays as listed); the tithi/basis line is kept as printed. School cookie drik-school-name=${city.school}.`,
            'Dates are the Gregorian dates printed by Drik for the chosen city; the suite maps slugs to event names with reference/festivals/name-map.json.',
            ...(complete ? [] : [`PARTIAL: months ${have.join(', ')} only (the site served a reCAPTCHA); rerun reference/fetch/drik-festivals.mjs --city ${cityId} --year ${year} to complete it.`]),
          ],
        });
        return events.length;
      };
      // School cookie = the city's tradition (Drik keeps it per browser; set it before the first load).
      await session.context.clearCookies();
      await session.context.addCookies([{ name: 'drik-school-name', value: city.school, domain: 'www.drikpanchang.com', path: '/' }]);
      try {
        for (let month = 1; month <= 12; month++) {
          if (partial[key].months[month]) continue;
          if (session.budgetLeft() < 1) throw new Error(`RUN_BUDGET: no loads left before ${key} month ${month}`);
          const url = pageUrl(city.geonameId, year, month);
          const page = await session.load(url, `festivals-${key}-${month}`);
          const title = await page.title();
          const events = await extractEvents(page);
          if (!events.length) throw new Error(`No events found on ${url} (layout changed?)`);
          const school = await page.evaluate(() => document.body.innerText.includes('Switch to Amanta') ? 'purnimanta' : document.body.innerText.includes('Switch to Purnimanta') ? 'amanta' : 'unknown');
          partial[key].months[month] = { url, title, school, events: events.map((e) => ({ ...e, date: parseGregDate(e.date) || e.date, dateText: e.date })) };
          writeJson(PARTIAL_FILE, partial);
          console.log(`[drik-festivals] ${key} month ${month}: ${events.length} events, school shown: ${school} (${session.loads}/${session.maxLoads} loads)`);
        }
      } catch (err) {
        // Keep what was fetched as a committed PARTIAL year file (months listed in values.monthsFetched) so the
        // suite can compare those months now; the next run completes it.
        if (Object.keys(partial[key].months).length) {
          const n = writeYearFile(false);
          console.log(`[drik-festivals] wrote PARTIAL ${outFile} (${n} events, months ${Object.keys(partial[key].months).join(',')})`);
        }
        throw err;
      }
      // All twelve months present: write the committed fact file.
      const total = writeYearFile(true);
      delete partial[key];
      writeJson(PARTIAL_FILE, partial);
      console.log(`[drik-festivals] wrote ${outFile} (${total} events)`);
    }
  }
});
