// AstroSage kundli reference for the chart suite (plan.md section 8: "one of AstroSage/Prokerala").
//   node reference/fetch/astrosage-chart.mjs [--case c02] [--max 60] [--probe]
// Flow per case (inspected once with Playwright on 2026-10-25):
//   1. GET https://www.astrosage.com/kundli/ ; fill name, day/month/year, hrs/min/sec, type the place into the
//      jQuery autocomplete (#place, backed by /kundli/FindPlaces.asp) and pick the suggestion nearest the case
//      coordinates; the site fills longitude/latitude (degrees + minutes), timezone (hours) and timezoneid;
//   2. submit -> POST https://ascloud.astrosage.com/cloud/createsession.asp -> /cloud/home.asp (session cookie);
//   3. GET /cloud/planetposition.asp: table "Planets | C | R | Rashi | Longitude DD-MM-SS | Nakshatra | Pada";
//   4. GET /cloud/VMMD&AD.asp: Vimshottari mahadasha / antardasha table (dates).
// = 4 page loads per case against the 60-load run budget. Output: reference/charts/astrosage/<id>.json.
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REFERENCE_DIR, RAW_DIR, ensureDir, parseArgs, readJson, runFetcher, writeFact } from './common.mjs';

const args = parseArgs();
const cases = readJson(join(REFERENCE_DIR, 'charts', 'cases.json')).cases;
const OUT_DIR = join(REFERENCE_DIR, 'charts', 'astrosage');
const SITE = 'astrosage';
const FORM_URL = 'https://www.astrosage.com/kundli/';
const CLOUD = 'https://ascloud.astrosage.com/cloud';
const SIGNS = { aries: 1, taurus: 2, gemini: 3, cancer: 4, leo: 5, virgo: 6, libra: 7, scorpio: 8, scorpion: 8, sagittarius: 9, capricorn: 10, aquarius: 11, pisces: 12 };
const PLANET_IDS = { asc: 'La', sun: 'Su', moon: 'Mo', mars: 'Ma', merc: 'Me', mercury: 'Me', jupt: 'Ju', jupiter: 'Ju', venu: 'Ve', venus: 'Ve', satn: 'Sa', saturn: 'Sa', rahu: 'Ra', ketu: 'Ke' };
const LORDS = { sun: 'Su', moon: 'Mo', mars: 'Ma', mercury: 'Me', merc: 'Me', jupiter: 'Ju', jup: 'Ju', venus: 'Ve', ven: 'Ve', saturn: 'Sa', sat: 'Sa', rahu: 'Ra', ketu: 'Ke' };
const NAKSHATRAS = ['Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purvaphalguni', 'Uttaraphalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula', 'Purvashadha', 'Uttarashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purvabhadra', 'Uttarabhadra', 'Revati'];
// AstroSage spellings (and truncations) mapped to the table above.
const NAK_ALIASES = { ashwini: 0, aswini: 0, bharani: 1, krittika: 2, kritika: 2, krithika: 2, rohini: 3, mrigashira: 4, mrigasira: 4, mrigshira: 4, mrigashirsha: 4, ardra: 5, aridra: 5, punarvasu: 6, pushya: 7, pusya: 7, ashlesha: 8, aslesha: 8, magha: 9, purvaphalguni: 10, purvaphalgini: 10, purvaphal: 10, pphalguni: 10, uttaraphalguni: 11, uttaraphal: 11, uphalguni: 11, hasta: 12, chitra: 13, swati: 14, svati: 14, vishakha: 15, visakha: 15, anuradha: 16, jyeshtha: 17, jyestha: 17, mula: 18, moola: 18, purvashadha: 19, purvaashadha: 19, purvashada: 19, uttarashadha: 20, uttaraashadha: 20, uttarashada: 20, shravana: 21, sravana: 21, dhanishta: 22, dhanishtha: 22, shatabhisha: 23, satabhisa: 23, satabhisha: 23, shatabhishak: 23, purvabhadra: 24, purvabhadrapada: 24, pbhadrapada: 24, uttarabhadra: 25, uttarabhadrapada: 25, ubhadrapada: 25, revati: 26 };

const normKey = (s) => s.toLowerCase().replace(/[^a-z]/g, '');

/** "Pisces", "06-41-15" -> {sign: 12, lon: 336.6875}. */
export function parsePosition(rashi, dms) {
  const sign = SIGNS[normKey(rashi)];
  const m = /^(\d{1,2})-(\d{1,2})-(\d{1,2})$/.exec(dms.trim());
  if (!sign || !m) return null;
  const inSign = Number(m[1]) + Number(m[2]) / 60 + Number(m[3]) / 3600;
  return { sign, lon: Math.round(((sign - 1) * 30 + inSign) * 1e5) / 1e5, text: `${rashi} ${dms}` };
}

export function parseNakshatraName(name) {
  const k = normKey(name);
  if (k in NAK_ALIASES) return NAK_ALIASES[k] + 1;
  const i = NAKSHATRAS.findIndex((n) => normKey(n).startsWith(k) || k.startsWith(normKey(n)));
  return i >= 0 ? i + 1 : null;
}

async function fillForm(page, c) {
  const [y, m, d] = c.date.split('-').map(Number);
  const [hh, mm] = (c.time ?? '12:00').split(':').map(Number);
  await page.fill('#Name', `Ref ${c.id}`);
  await page.fill('#Day', String(d));
  await page.fill('#Month', String(m));
  await page.fill('#Year', String(y));
  await page.fill('#Hrs', String(hh));
  await page.fill('#Min', String(mm));
  await page.fill('#Sec', '0');
  await page.click('#place');
  let items = [];
  for (let attempt = 0; attempt < 3 && !items.length; attempt++) {
    await page.fill('#place', '');
    await page.type('#place', c.place, { delay: 90 + attempt * 40 });
    if (attempt > 0) {
      // Nudge the autocomplete (it fires on keyup): retype the last letter.
      await page.keyboard.press('Backspace');
      await page.type('#place', c.place.slice(-1), { delay: 120 });
    }
    await page.waitForSelector('.ac_results li', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(800);
    items = await page.$$eval('.ac_results li', (els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').trim()));
  }
  if (!items.length) throw new Error(`autocomplete returned no suggestion for "${c.place}"`);
  const readGeo = () =>
    page.evaluate(() => {
      const v = (id) => document.querySelector(id).value;
      const lat = (Number(v('#LatDeg')) + Number(v('#LatMin')) / 60) * (v('#LatNS') === 'S' ? -1 : 1);
      const lon = (Number(v('#LongDeg')) + Number(v('#LongMin')) / 60) * (v('#LongEW') === 'W' ? -1 : 1);
      return { place: v('#place'), lat, lon, latText: `${v('#LatDeg')}:${v('#LatMin')} ${v('#LatNS')}`, lonText: `${v('#LongDeg')}:${v('#LongMin')} ${v('#LongEW')}`, timezone: v('#timeZone'), timezoneid: v('#timezoneid'), ayanamsa: v('#ayanamsa'), charting: v('#charting') };
    });
  // Try suggestions in order until one lies within 0.3 deg of the case coordinates. The site fills the
  // coordinate fields asynchronously after a click, so wait for them before judging the distance.
  let picked = null;
  let geo = null;
  let best = null;
  for (let i = 0; i < Math.min(items.length, 6); i++) {
    if (i > 0) {
      await page.fill('#place', '');
      await page.type('#place', c.place, { delay: 90 });
      const shown = await page.waitForSelector('.ac_results li', { timeout: 15000 }).catch(() => null);
      if (!shown) break;
      await page.waitForTimeout(800);
    }
    await page.click(`.ac_results li >> nth=${i}`);
    await page.waitForFunction(() => (document.querySelector('#LatDeg').value || '').trim() !== '', null, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(600);
    geo = await readGeo();
    const d = Math.hypot(geo.lat - c.lat, (geo.lon - c.lon) * Math.cos((c.lat * Math.PI) / 180));
    picked = items[i];
    if (!best || d < best.d) best = { d, geo, picked };
    if (d < 0.3) break;
  }
  if (best && best.d < Math.hypot(geo.lat - c.lat, (geo.lon - c.lon) * Math.cos((c.lat * Math.PI) / 180))) {
    // Re-select the nearest suggestion when the loop ended on a worse one.
    await page.fill('#place', '');
    await page.type('#place', c.place, { delay: 90 });
    await page.waitForSelector('.ac_results li', { timeout: 15000 }).catch(() => null);
    await page.waitForTimeout(800);
    const idx = items.indexOf(best.picked);
    if (idx >= 0) {
      await page.click(`.ac_results li >> nth=${idx}`);
      await page.waitForFunction(() => (document.querySelector('#LatDeg').value || '').trim() !== '', null, { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(600);
      geo = await readGeo();
      picked = best.picked;
    }
  }
  return { geo, suggestions: items, picked };
}

async function extractPlanets(page) {
  return page.evaluate(() => {
    const tables = [...document.querySelectorAll('table')];
    const t = tables.find((tb) => /Longitude/.test(tb.innerText) && /Nakshatra/.test(tb.innerText));
    if (!t) return [];
    return [...t.querySelectorAll('tr')]
      .slice(1)
      .map((tr) => {
        const cells = [...tr.children].map((c) => c.innerText.replace(/\s+/g, ' ').trim());
        const first = cells[0] || '';
        const name = first.split(' ').filter(Boolean).pop() || '';
        return { name, combust: cells[1] || '', motion: cells[2] || '', rashi: cells[3] || '', dms: cells[4] || '', nakshatra: cells[5] || '', pada: cells[6] || '', relation: cells[7] || '' };
      })
      .filter((r) => r.rashi && r.dms);
  });
}

async function extractDasha(page) {
  return page.evaluate(() => {
    const out = [];
    for (const tb of document.querySelectorAll('table')) {
      const rows = [...tb.querySelectorAll('tr')].map((tr) => [...tr.children].map((c) => c.innerText.replace(/\s+/g, ' ').trim()));
      if (rows.some((r) => r.some((c) => /\d{1,2}[-\/]\d{1,2}[-\/]\d{4}|\d{4}-\d{2}-\d{2}/.test(c)))) out.push(rows);
    }
    return { tables: out, text: document.body.innerText.slice(0, 20000) };
  });
}

const LORD3 = { sun: 'Su', mon: 'Mo', mar: 'Ma', mer: 'Me', jup: 'Ju', ven: 'Ve', sat: 'Sa', rah: 'Ra', ket: 'Ke' };

/**
 * AstroSage's "Vimshottari MD & AD" page prints plain-text blocks:
 *   Balance Of Dasha : SUN 0 Y 6 M 23 D
 *   SUN -6 Years / 14/ 3/98 / 8/10/98 / <nine antardasha lines>
 * Dates are d/m/yy (two-digit years); the century is resolved so that dates increase from the birth date.
 * Returns {balanceText, mahas: [{lord, start, end}]} with ISO dates (day resolution).
 */
export function parseDasha(_tables, text, birthDate) {
  const lines = text.split('\n').map((l) => l.trim());
  const balance = lines.find((l) => /^Balance Of Dasha/i.test(l)) || null;
  const mahas = [];
  let prev = Date.parse(birthDate);
  const toIso = (s) => {
    const m = /^(\d{1,2})\/\s*(\d{1,2})\/\s*(\d{2})$/.exec(s);
    if (!m) return null;
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const yy = Number(m[3]);
    // Pick the century that keeps the sequence non-decreasing (the balance dasha starts on the birth date).
    for (const century of [1900, 2000, 2100]) {
      const iso = `${century + yy}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const t = Date.parse(iso);
      if (t >= prev - 86_400_000) {
        prev = t;
        return iso;
      }
    }
    return null;
  };
  for (let i = 0; i < lines.length; i++) {
    const m = /^(SUN|MON|MAR|MER|JUP|VEN|SAT|RAH|KET)\s+-\s*(\d+)\s+Years?$/i.exec(lines[i]);
    if (!m) continue;
    const dates = [];
    for (let j = i + 1; j < Math.min(lines.length, i + 6) && dates.length < 2; j++) {
      if (/^\d{1,2}\/\s*\d{1,2}\/\s*\d{2}$/.test(lines[j])) dates.push(lines[j]);
    }
    if (dates.length === 2) {
      const start = toIso(dates[0]);
      const end = toIso(dates[1]);
      mahas.push({ lord: LORD3[m[1].toLowerCase()], years: Number(m[2]), start, end, raw: `${lines[i]} ${dates[0]} ${dates[1]}` });
    }
    if (mahas.length >= 9) break;
  }
  return { balanceText: balance, mahas };
}

const isMain = process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href;
if (isMain) await runFetcher('astrosage-chart', SITE, async (session) => {
  if (args.max) session.maxLoads = Math.min(session.maxLoads, Number(args.max));
  let done = 0;
  for (const c of cases) {
    if (args.case && args.case !== c.id) continue;
    const outFile = join(OUT_DIR, `${c.id}.json`);
    if (existsSync(outFile) && !args.probe) continue;
    if (session.budgetLeft() < 4) throw new Error(`RUN_BUDGET: fewer than 4 loads left for ${c.id}`);
    if (done > 0) await session.newPage();
    const page = await session.load(FORM_URL, `astrosage-form-${c.id}`);
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    const { geo, suggestions, picked } = await fillForm(page, c);
    const notes = [];
    const dLat = Math.abs(geo.lat - c.lat);
    const dLon = Math.abs(geo.lon - c.lon);
    if (dLat > 0.05 || dLon > 0.05) notes.push(`site geo ${geo.lat.toFixed(4)},${geo.lon.toFixed(4)} (minute precision) differs from the case coordinates ${c.lat},${c.lon} by ${dLat.toFixed(3)}/${dLon.toFixed(3)} deg (suggestion "${picked}")`);
    session.loads += 1;
    session.lastLoadAt = Date.now();
    await Promise.all([page.waitForNavigation({ timeout: 90000 }), page.click('#submit')]);
    await page.waitForTimeout(1500);
    const homeUrl = page.url();
    await session.load(`${CLOUD}/planetposition.asp`, `astrosage-planets-${c.id}`);
    await page.waitForTimeout(1500);
    const planets = await extractPlanets(page);
    await session.load(`${CLOUD}/VMMD&AD.asp`, `astrosage-dasha-${c.id}`);
    await page.waitForTimeout(1500);
    const dashaRaw = await extractDasha(page);
    if (args.probe) {
      try {
        ensureDir(join(RAW_DIR, SITE));
        writeFileSync(join(RAW_DIR, SITE, `dasha-${c.id}.txt`), dashaRaw.text + '\n\nTABLES\n' + JSON.stringify(dashaRaw.tables, null, 1), 'utf8');
      } catch {}
      console.log('[probe] planets:', JSON.stringify(planets, null, 1));
      console.log('[probe] dasha tables:', JSON.stringify(dashaRaw.tables.slice(0, 3), null, 1).slice(0, 4000));
    }
    const { balanceText, mahas } = parseDasha(dashaRaw.tables, dashaRaw.text, c.date);
    const tzHours = Number(geo.timezone);
    const values = {
      input: {
        date: c.date,
        time: c.time ?? '12:00',
        noonForUnknownTime: c.time === null,
        place: geo.place,
        latitude: geo.lat,
        longitude: geo.lon,
        latText: geo.latText,
        lonText: geo.lonText,
        timezoneHours: tzHours,
        offsetMinutes: Number.isFinite(tzHours) ? Math.round(tzHours * 60) : null,
        timezoneid: geo.timezoneid,
        ayanamsa: geo.ayanamsa === '0' ? 'N.C.Lahiri (site default)' : geo.ayanamsa,
        suggestions,
        picked,
      },
      planets: {},
      lagna: null,
      moon: null,
      dasha: null,
      raw: { planets, dasha: mahas },
    };
    for (const p of planets) {
      const id = PLANET_IDS[normKey(p.name)];
      if (!id) continue;
      const pos = parsePosition(p.rashi, p.dms);
      if (!pos) continue;
      const nak = parseNakshatraName(p.nakshatra);
      const point = { ...pos, nakshatra: nak, pada: Number(p.pada) || null, retro: p.motion === 'R', combust: p.combust === 'C', relation: p.relation };
      if (id === 'La') values.lagna = point;
      else {
        values.planets[id] = point;
        if (id === 'Mo') values.moon = { nakshatra: nak, pada: Number(p.pada) || null, text: `${p.nakshatra} ${p.pada}` };
      }
    }
    if (mahas.length) values.dasha = { mahaLord: mahas[0].lord, mahaLordId: mahas[0].lord, mahaStart: mahas[0].start ?? null, mahaEnd: mahas[0].end, balanceText, mahas, resolution: 'day (d/m/yy as printed)' };
    if (Object.keys(values.planets).length < 9) notes.push(`only ${Object.keys(values.planets).length} planets parsed`);
    if (!values.dasha) notes.push('dasha table not parsed');
    writeFact(outFile, {
      caseId: c.id,
      source: SITE,
      sourceUrl: `${CLOUD}/planetposition.asp + ${CLOUD}/VMMD&AD.asp (session created by POST ${CLOUD}/createsession.asp from ${FORM_URL}; home ${homeUrl})`,
      values,
      notes: [...notes, 'Longitudes are sidereal (N.C. Lahiri, site default) as printed DD-MM-SS within the sign; R = retrograde, C = combust per the site; coordinates at minute precision from the site autocomplete; the timezone is the hours value the site filled for the place.'],
    });
    done++;
    console.log(`[astrosage] ${c.id} ok (${session.loads}/${session.maxLoads} loads; tz ${geo.timezone} ${geo.timezoneid}; asc ${values.lagna ? values.lagna.text : 'n/a'}; ${mahas.length} mahas)`);
    if (args.probe) break;
  }
  console.log(`[astrosage] fetched ${done}`);
});
