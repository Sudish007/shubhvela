// Fetches Drik Panchang day-panchang pages for the panchang suite (plan.md section 8).
//   node reference/fetch/drik-panchang.mjs [--city delhi] [--date 2026-10-22] [--max 60]
// Output: reference/panchang/drikpanchang/<city>-<date>.json (extracted facts only; raw HTML stays in $env:TEMP).
// Existing output files are skipped, so a run interrupted by the 60-load cap or a captcha simply resumes.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REFERENCE_DIR, hhmm, pad2, parseArgs, parseClock, readJson, runFetcher, writeFact } from './common.mjs';

const args = parseArgs();
const cases = readJson(join(REFERENCE_DIR, 'panchang', 'cases.json'));
const OUT_DIR = join(REFERENCE_DIR, 'panchang', 'drikpanchang');
const SITE = 'drikpanchang';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function pageUrl(geonameId, date) {
  const [y, m, d] = date.split('-');
  return `https://www.drikpanchang.com/panchang/day-panchang.html?geoname-id=${geonameId}&date=${d}/${m}/${y}`;
}

/**
 * "02:47 PM" | "02:47 AM, Oct 23" | "03:53 PM, Apr 21, 2026" -> "YYYY-MM-DDTHH:MM" relative to the page date.
 * A month/day suffix names the civil date explicitly; a suffix in January on a December page rolls the year.
 */
export function toLocalIso(text, pageDate) {
  const clock = parseClock(text);
  if (!clock) return null;
  const [py, pm, pd] = pageDate.split('-').map(Number);
  let y = py;
  let m = pm;
  let d = pd;
  const suffix = /,\s*([A-Z][a-z]{2})\s+(\d{1,2})(?:,\s*(\d{4}))?/.exec(text);
  if (suffix) {
    m = MONTHS.indexOf(suffix[1]) + 1;
    d = Number(suffix[2]);
    if (suffix[3]) y = Number(suffix[3]);
    else if (m < pm) y = py + 1;
  }
  return `${y}-${pad2(m)}-${pad2(d)}T${hhmm({ hh: clock.hh, mm: clock.mm })}`;
}

/** "Ekadashi upto 02:47 PM" -> {name, end}; "Dwadashi" -> {name, end: null}. */
export function parseUpto(line, pageDate) {
  const m = /^(.*?)\s+upto\s+(.+)$/i.exec(line.trim());
  if (!m) return { name: line.trim(), end: null, raw: line.trim() };
  return { name: m[1].trim(), end: toLocalIso(m[2], pageDate), raw: line.trim() };
}

/** "01:30 PM to 02:55 PM" -> {start, end}; "Whole Day" / "None" -> {start: null, end: null, text}. */
export function parseRange(line, pageDate) {
  const m = /^(.+?)\s+to\s+(.+)$/i.exec(line.trim());
  if (!m) return { start: null, end: null, text: line.trim() };
  return { start: toLocalIso(m[1], pageDate), end: toLocalIso(m[2], pageDate), text: line.trim() };
}

/** Reads every "key / value" pair of the cards on a day-panchang page; values keep their visual lines. */
export async function extractCards(page) {
  return page.evaluate(() => {
    const cards = [];
    for (const title of document.querySelectorAll('h3.dpTableCardTitle')) {
      let card = title.nextElementSibling;
      while (card && !card.classList.contains('dpTableCard')) card = card.nextElementSibling;
      if (!card) continue;
      // Two-column layout: each .dpTableRow holds key, value, key, value. A row with an empty key continues the
      // value of the last key in the same column (e.g. "Tithi: Ekadashi upto 02:47 PM" then "Dwadashi").
      const rows = [];
      const lastByColumn = [];
      const clean = (s) => s.replace(/\s+/g, ' ').replace(/ⓘ/g, '').trim();
      for (const tr of card.querySelectorAll('.dpTableRow')) {
        const cells = [...tr.children].filter((c) => c.classList.contains('dpTableCell'));
        for (let i = 0; i + 1 < cells.length; i += 2) {
          const col = i / 2;
          const key = clean(cells[i].innerText);
          const lines = cells[i + 1].innerText.split('\n').map(clean).filter((s) => s);
          if (key) {
            const row = { key, lines };
            rows.push(row);
            lastByColumn[col] = row;
          } else if (lastByColumn[col] && lines.length) {
            lastByColumn[col].lines.push(...lines);
          }
        }
      }
      cards.push({ title: title.innerText.trim(), rows });
    }
    const header = document.querySelector('.dpPHeaderLeftTitle, h1');
    return { cards, header: header ? header.innerText.trim() : '', title: document.title };
  });
}

function findRow(cards, keyRe) {
  for (const c of cards) for (const r of c.rows) if (keyRe.test(r.key)) return r;
  return null;
}

export function normalise(extracted, pageDate) {
  const { cards } = extracted;
  const row = (re) => findRow(cards, re);
  const first = (re) => row(re)?.lines?.[0] ?? null;
  const iso = (re) => {
    const t = first(re);
    return t ? toLocalIso(t, pageDate) : null;
  };
  const uptoList = (re) => (row(re)?.lines ?? []).map((l) => parseUpto(l, pageDate));
  const range = (re) => {
    const t = first(re);
    return t ? parseRange(t, pageDate) : null;
  };
  const ayanamsaText = first(/^Lahiri Ayanamsha$/i);
  const values = {
    sunrise: iso(/^Sunrise$/i),
    sunset: iso(/^Sunset$/i),
    moonrise: iso(/^Moonrise$/i),
    moonset: iso(/^Moonset$/i),
    tithi: uptoList(/^Tithi$/i),
    nakshatra: uptoList(/^Nakshatra$/i),
    yoga: uptoList(/^Yoga$/i),
    karana: uptoList(/^Karana$/i),
    weekday: first(/^Weekday$/i),
    paksha: first(/^Paksha$/i),
    vikramSamvat: first(/^Vikram Samvat$/i),
    shakaSamvat: first(/^Shaka Samvat$/i),
    chandramasa: row(/^Chandramasa$/i)?.lines ?? [],
    moonsign: first(/^Moonsign$/i),
    sunsign: first(/^Sunsign$/i),
    nakshatraPada: uptoList(/^Nakshatra Pada$/i),
    drikRitu: first(/^Drik Ritu$/i),
    vedicRitu: first(/^Vedic Ritu$/i),
    drikAyana: first(/^Drik Ayana$/i),
    vedicAyana: first(/^Vedic Ayana$/i),
    dinamana: first(/^Dinamana$/i),
    ratrimana: first(/^Ratrimana$/i),
    madhyahna: iso(/^Madhyahna$/i),
    brahmaMuhurta: range(/^Brahma Muhurta$/i),
    pratahSandhya: range(/^Pratah Sandhya$/i),
    abhijit: range(/^Abhijit$/i),
    vijayaMuhurta: range(/^Vijaya Muhurta$/i),
    godhuliMuhurta: range(/^Godhuli Muhurta$/i),
    sayahnaSandhya: range(/^Sayahna Sandhya$/i),
    amritKalam: (row(/^Amrit Kalam$/i)?.lines ?? []).map((l) => parseRange(l, pageDate)),
    nishitaMuhurta: range(/^Nishita Muhurta$/i),
    rahuKalam: range(/^Rahu Kalam$/i),
    yamaganda: range(/^Yamaganda$/i),
    gulikaiKalam: range(/^Gulikai Kalam$/i),
    varjyam: (row(/^Varjyam$/i)?.lines ?? []).map((l) => parseRange(l, pageDate)),
    durMuhurtam: (row(/^Dur Muhurtam$/i)?.lines ?? []).map((l) => parseRange(l, pageDate)),
    bhadra: (row(/^Bhadra$/i)?.lines ?? []).map((l) => parseRange(l, pageDate)),
    panchaka: (row(/^Panchaka$/i)?.lines ?? []).map((l) => parseRange(l, pageDate)),
    dishaShool: first(/^Disha Shool$/i),
    lahiriAyanamsha: ayanamsaText ? Number(ayanamsaText) : null,
    julianDay: first(/^Julian Day$/i),
  };
  return { values, table: cards };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) await runFetcher('drik-panchang', SITE, async (session) => {
  const onlyCity = args.city;
  const onlyDate = args.date;
  const max = args.max ? Number(args.max) : undefined;
  if (max) session.maxLoads = Math.min(session.maxLoads, max);
  let done = 0;
  let skipped = 0;
  for (const [cityId, city] of Object.entries(cases.cities)) {
    if (onlyCity && onlyCity !== cityId) continue;
    for (const { date } of cases.dates) {
      if (onlyDate && onlyDate !== date) continue;
      const outFile = join(OUT_DIR, `${cityId}-${date}.json`);
      if (existsSync(outFile)) {
        skipped++;
        continue;
      }
      const url = pageUrl(city.geonameId, date);
      const page = await session.load(url, `${cityId}-${date}`);
      const extracted = await extractCards(page);
      if (!extracted.cards.length) throw new Error(`No panchang cards found on ${url} (layout changed?)`);
      const { values, table } = normalise(extracted, date);
      if (!values.sunrise || !values.tithi.length) throw new Error(`Incomplete extraction for ${cityId} ${date}: ${JSON.stringify(values).slice(0, 300)}`);
      writeFact(outFile, {
        caseId: `${cityId}-${date}`,
        source: SITE,
        sourceUrl: url,
        values: { city: cityId, geonameId: city.geonameId, tz: city.tz, date, pageTitle: extracted.title, ...values, table },
        notes: ['Times are the city local wall-clock times shown by the page (HH:MM, no seconds); a date suffix marks the next civil day.'],
      });
      done++;
      console.log(`[drik-panchang] ${cityId} ${date} ok (${session.loads}/${session.maxLoads} loads)`);
    }
  }
  console.log(`[drik-panchang] fetched ${done}, skipped ${skipped} already present`);
});
