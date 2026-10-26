// Drik Panchang Horoscope Matching (Ashta Kuta) reference for the matching suite (plan.md section 8).
//   node reference/fetch/drik-matching.mjs [--pair m01] [--max 60] [--probe]
// Same visitor flow as drik-kundali.mjs with the twin form (dp-* = first person, dp-second-* = second person):
// fill both, Submit -> confirm -> "continue without login" -> confirm -> result page with the Ashta Kuta table.
// = 2 page loads per pair. Output: reference/matching/drikpanchang/<pair>.json.
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REFERENCE_DIR, RAW_DIR, ensureDir, parseArgs, readJson, runFetcher, writeFact } from './common.mjs';

const args = parseArgs();
const pairs = readJson(join(REFERENCE_DIR, 'matching', 'cases.json')).pairs;
const chartCases = readJson(join(REFERENCE_DIR, 'charts', 'cases.json')).cases;
const OUT_DIR = join(REFERENCE_DIR, 'matching', 'drikpanchang');
const SITE = 'drikpanchang';
const FORM_URL = 'https://www.drikpanchang.com/jyotisha/horoscope-match/horoscope-match.html';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function hour12(hhmm) {
  const [hh, mm] = hhmm.split(':').map(Number);
  return { hour: String(hh % 12 === 0 ? 12 : hh % 12), minute: String(mm), ampm: hh < 12 ? 'AM' : 'PM' };
}

async function fillPerson(page, prefix, c, label) {
  const id = (f) => `#dp-${prefix}${f}`;
  const [y, m, d] = c.date.split('-').map(Number);
  await page.selectOption(id('month'), { label: `${MONTHS[m - 1]} (${m})` });
  await page.selectOption(id('day'), { label: String(d) });
  await page.selectOption(id('year'), { label: String(y) });
  const t = hour12(c.time ?? '12:00');
  await page.selectOption(id('hour'), { label: t.hour });
  await page.selectOption(id('minute'), { label: t.minute });
  await page.selectOption(id('second'), { label: '0' });
  await page.selectOption(id('am-pm'), { label: t.ampm });
  await page.fill(id('name'), label);
  const readLatLon = () =>
    page.evaluate((pfx) => {
      const v = (f) => Number(document.querySelector(`#dp-${pfx}${f}`).value) || 0;
      const sign = (f) => document.querySelector(`#dp-${pfx}${f}`).value;
      const lat = (v('lat-deg') + v('lat-min') / 60 + v('lat-sec') / 3600) * (/minus|south/i.test(sign('lat-sign')) ? -1 : 1);
      const lon = (v('long-deg') + v('long-min') / 60 + v('long-sec') / 3600) * (/minus|west/i.test(sign('long-sign')) ? -1 : 1);
      return { lat, lon, olson: document.querySelector(`#dp-${pfx}olson-timezone`).value, offset: document.querySelector(`#dp-${pfx}offset`).value, city: document.querySelector(`#dp-${pfx}city-search`).value };
    }, prefix);
  let geo = null;
  let items = [];
  for (let i = 0; i < 8; i++) {
    await page.fill(id('city-search'), '');
    await page.click(id('city-search'));
    await page.type(id('city-search'), c.place, { delay: 70 });
    // The page holds one jQuery-UI autocomplete list per person; the other person's (hidden) list keeps its old
    // <li>s, so wait for ANY visible item instead of the first attached one (Phase A fixer: the first run timed out
    // on "resolved to 9 elements, first one not visible").
    await page.waitForFunction(() => [...document.querySelectorAll('.ui-autocomplete li')].some((e) => e.offsetParent !== null), null, { timeout: 25000 });
    await page.waitForTimeout(600);
    items = await page.$$eval('.ui-autocomplete li', (els) => els.filter((e) => e.offsetParent !== null).map((e) => e.innerText.replace(/\s+/g, ' ').trim()));
    const visible = await page.$$('.ui-autocomplete li');
    const vis = [];
    for (const el of visible) if (await el.isVisible()) vis.push(el);
    if (i >= vis.length) break;
    await vis[i].click();
    await page.waitForTimeout(1200);
    geo = await readLatLon();
    if (Math.hypot(geo.lat - c.lat, (geo.lon - c.lon) * Math.cos((c.lat * Math.PI) / 180)) < 0.3) break;
  }
  return { geo, suggestions: items };
}

const RESULT_RE = /Varna|Vashya|Nadi|Bhakoot|Ashta\s*Kuta|Guna|Milan/i;
/**
 * Submit -> optional "please confirm" overlay -> optional "continue without login" -> the result. B01 fix for the
 * Phase A timeout (carry-over A-REVIEW-MEDIUM-2): the matching page does not always navigate after the last confirm
 * (the kundali flow does), so instead of waitForNavigation this waits for EITHER a URL change OR the Ashta Kuta table
 * appearing in place, whichever happens first, then lets the page settle.
 */
async function submitAndOpen(page) {
  const startUrl = page.url();
  await page.click('#dp-submit-button');
  const confirm = await page.waitForSelector('#dp-button-confirm', { timeout: 25000 }).catch(() => null);
  if (confirm) {
    await page.waitForTimeout(700);
    await page.click('#dp-button-confirm').catch(() => {});
    const noLogin = await page.waitForSelector('#dp-save-without-login', { timeout: 15000 }).catch(() => null);
    if (noLogin) {
      await page.click('#dp-save-without-login');
      await page.waitForTimeout(700);
      await page.click('#dp-button-confirm').catch(() => {});
    }
  }
  const deadline = Date.now() + 90000;
  for (;;) {
    try {
      await page.waitForFunction(
        ({ u, re }) => location.href !== u || new RegExp(re, 'i').test(document.body ? document.body.innerText : ''),
        { u: startUrl, re: RESULT_RE.source },
        { timeout: Math.max(1000, deadline - Date.now()), polling: 500 },
      );
      break;
    } catch (err) {
      // A navigation destroys the execution context mid-poll: re-arm the wait until the deadline.
      if (Date.now() >= deadline) throw err;
      await page.waitForTimeout(500);
    }
  }
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(6000);
}

async function extractResult(page) {
  return page.evaluate(() => {
    const text = document.body.innerText;
    const tables = [];
    for (const t of document.querySelectorAll('.dpKundaliTable, table, [class*=Koota], [class*=Kuta], [class*=Match]')) {
      const rows = [...t.querySelectorAll('.dpTableRow, tr')].map((r) => [...r.children].map((c) => c.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean));
      if (rows.length) tables.push({ cls: t.className, rows: rows.slice(0, 40) });
    }
    return { text, tables };
  });
}

const KOOTA_NAMES = { varna: 'varna', vashya: 'vashya', vasya: 'vashya', tara: 'tara', dina: 'tara', yoni: 'yoni', grahamaitri: 'grahaMaitri', maitri: 'grahaMaitri', rasyadhipati: 'grahaMaitri', gana: 'gana', bhakoot: 'bhakoot', bhakut: 'bhakoot', bhakuta: 'bhakoot', rashi: 'bhakoot', nadi: 'nadi' };
/**
 * Parses the Ashta Kuta result text. Drik renders (B01 probe, 2026-10-27) "Varna Kuta Points: 1/1" ... "Nadi Kuta
 * Points: 8/8" plus a "Total Guna Milan" block whose obtained and maximum points follow on separate lines
 * ("Union is Very Good", "26", "36"); the older "Varna 1/1" / "Total 24/36" one-line forms are still accepted.
 * The Moon sign, nakshatra and lunar longitude the site used for each person are recorded too (`moons`).
 */
export function parseKootas(text) {
  const out = { kootas: {}, total: null, totalMax: null, mangal: {}, moons: {}, raw: [] };
  const lines = text.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const nextNumbers = (i, n) => {
    const nums = [];
    for (let j = i + 1; j < lines.length && j <= i + 6 && nums.length < n; j++) if (/^\d+(?:\.\d+)?$/.test(lines[j])) nums.push(Number(lines[j]));
    return nums;
  };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const m = /^([A-Za-z ]+?)\s*(?:Koota|Kuta|Kutam)?\s*(?:Points|Milan)?\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(?:\/|out of|of)\s*(\d+(?:\.\d+)?)\b/i.exec(l);
    if (m) {
      const key = m[1].toLowerCase().replace(/[^a-z]/g, '');
      if (/^total|^guna|^ashtakoot|^ashtakuta|^points/.test(key)) {
        out.total = Number(m[2]);
        out.totalMax = Number(m[3]);
      } else if (KOOTA_NAMES[key]) out.kootas[KOOTA_NAMES[key]] = { score: Number(m[2]), max: Number(m[3]), raw: l };
      out.raw.push(l);
    } else if (/^Total Guna Milan/i.test(l) && out.total === null) {
      const nums = nextNumbers(i, 2);
      if (nums.length === 2) {
        out.total = nums[0];
        out.totalMax = nums[1];
        out.raw.push(`${l} ${nums[0]}/${nums[1]}`);
      }
    } else if (/^Janmarashi/i.test(l)) {
      out.moons.boySign = lines[i + 1] ?? null;
      out.moons.girlSign = lines[i + 2] ?? null;
    } else if (/^Nakshatra \(Birthstar\)/i.test(l)) {
      out.moons.boyNakshatra = lines[i + 1] ?? null;
      out.moons.girlNakshatra = lines[i + 2] ?? null;
    } else if (/^Lunar Longitude/i.test(l)) {
      const nums = nextNumbers(i, 2);
      if (nums.length === 2) {
        out.moons.boyMoon = nums[0];
        out.moons.girlMoon = nums[1];
      }
    }
    const mg = /(Mangal|Manglik|Kuja)\s*Dosh[a]?/i.exec(l);
    if (mg) out.raw.push(l);
  }
  return out;
}
const isMain = process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href;
if (isMain) await runFetcher('drik-matching', SITE, async (session) => {
  if (args.max) session.maxLoads = Math.min(session.maxLoads, Number(args.max));
  let done = 0;
  for (const p of pairs) {
    if (args.pair && args.pair !== p.id) continue;
    const outFile = join(OUT_DIR, `${p.id}.json`);
    if (existsSync(outFile) && !args.probe) continue;
    if (session.budgetLeft() < 2) throw new Error(`RUN_BUDGET: fewer than 2 loads left for ${p.id}`);
    const boy = chartCases.find((c) => c.id === p.boy);
    const girl = chartCases.find((c) => c.id === p.girl);
    if (done > 0) await session.newPage();
    const page = await session.load(FORM_URL, `match-form-${p.id}`);
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    const first = await fillPerson(page, '', boy, `Boy ${boy.id}`);
    const second = await fillPerson(page, 'second-', girl, `Girl ${girl.id}`);
    session.loads += 1;
    session.lastLoadAt = Date.now();
    await submitAndOpen(page);
    const resultUrl = page.url();
    const res = await extractResult(page);
    if (args.probe) {
      try {
        ensureDir(join(RAW_DIR, SITE));
        writeFileSync(join(RAW_DIR, SITE, `match-${p.id}.txt`), res.text + '\n\nTABLES\n' + JSON.stringify(res.tables, null, 1), 'utf8');
        writeFileSync(join(RAW_DIR, SITE, `match-${p.id}.html`), await page.content(), 'utf8');
      } catch {}
      const i = res.text.indexOf('Varna');
      console.log('[probe] text around Varna:', res.text.slice(Math.max(0, i - 1500), i + 3000));
      console.log('[probe] tables:', JSON.stringify(res.tables.slice(0, 6), null, 1).slice(0, 5000));
    }
    const parsed = parseKootas(res.text);
    const values = {
      input: {
        boy: { id: boy.id, date: boy.date, time: boy.time ?? '12:00', place: boy.place, siteGeo: first.geo, suggestions: first.suggestions },
        girl: { id: girl.id, date: girl.date, time: girl.time ?? '12:00', place: girl.place, siteGeo: second.geo, suggestions: second.suggestions },
      },
      total: parsed.total,
      totalMax: parsed.totalMax,
      kootas: parsed.kootas,
      mangal: parsed.mangal,
      moons: parsed.moons,
      rawLines: parsed.raw,
      tables: res.tables.filter((t) => t.rows.some((r) => r.some((c) => /Varna|Vashya|Nadi|Bhakoot|Mangal|Total|Guna/i.test(c)))).slice(0, 6),
    };
    const notes = [];
    if (values.total === null) notes.push('total guna not parsed from the page text; see tables');
    if (Object.keys(values.kootas).length < 8) notes.push(`only ${Object.keys(values.kootas).length} kootas parsed`);
    writeFact(outFile, { caseId: p.id, source: SITE, sourceUrl: `${resultUrl} (POST from ${FORM_URL})`, values, notes: [...notes, 'Ashta Kuta scores as printed by Drik Panchang (Lahiri/Chitrapaksha default); first person = boy, second = girl.'] });
    done++;
    console.log(`[drik-matching] ${p.id} ok (${session.loads}/${session.maxLoads} loads; total ${values.total}/${values.totalMax}; kootas ${Object.keys(values.kootas).length})`);
    if (args.probe) break;
  }
  console.log(`[drik-matching] fetched ${done}`);
});
