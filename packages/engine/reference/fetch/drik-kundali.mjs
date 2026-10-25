// Drik Panchang janma-kundali reference for the chart suite (plan.md section 8).
//   node reference/fetch/drik-kundali.mjs [--case c02] [--max 60] [--probe]
// Flow per case, exactly as a visitor does it (inspected once with Playwright on 2026-10-25):
//   1. GET /jyotisha/kundali/janma-kundali.html, fill date / time (12-hour selects) / city (jQuery autocomplete
//      backed by /ajax/geo/dp-city-search.php, which fills latitude, longitude, elevation, Olson zone, offset);
//   2. Submit -> "please confirm" overlay (#dp-button-confirm) -> "continue without login" radio
//      (#dp-save-without-login) -> confirm -> the browser POSTs dp_payload to /jyotisha/kundali/kundali.html;
//   3. the result page renders "Rashi Chart Details > Graha Details" (#dp-planet-table): Lagna + 9 grahas with
//      longitude (DD° Sign MM′ SS″), nakshatra + pada; the toolbar's "Vimshottari Dasha" button loads the dasha
//      table (mahadasha lords with start/end dates).
// Each case costs the form page, the result page and the dasha view = 3 page loads of the 60-load run budget.
// Output: reference/charts/drikpanchang/<id>.json with sidereal longitudes (decimal degrees), signs 1-12,
// Moon nakshatra/pada, the first mahadasha lord and its end date, and the offset the site applied.
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REFERENCE_DIR, RAW_DIR, ensureDir, parseArgs, readJson, runFetcher, writeFact } from './common.mjs';

const args = parseArgs();
const cases = readJson(join(REFERENCE_DIR, 'charts', 'cases.json')).cases;
const OUT_DIR = join(REFERENCE_DIR, 'charts', 'drikpanchang');
const SITE = 'drikpanchang';
const FORM_URL = 'https://www.drikpanchang.com/jyotisha/kundali/janma-kundali.html';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SIGN_ABBR = { mesh: 1, mesha: 1, vrish: 2, vrishabha: 2, vibh: 2, mith: 3, mithuna: 3, mitu: 3, kark: 4, karka: 4, simh: 5, simha: 5, kany: 6, kanya: 6, tula: 7, vrsc: 8, vrishchika: 8, vish: 8, dhan: 9, dhanu: 9, maka: 10, makara: 10, kumb: 11, kumbha: 11, meen: 12, meena: 12 };
const GRAHA_IDS = { lagna: 'La', surya: 'Su', chandra: 'Mo', mangal: 'Ma', budha: 'Me', guru: 'Ju', shukra: 'Ve', shani: 'Sa', rahu: 'Ra', ketu: 'Ke' };
const NAKSHATRAS = ['Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'P Phalguni', 'U Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula', 'P Ashadha', 'U Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'P Bhadrapada', 'U Bhadrapada', 'Revati'];
const LORDS = { surya: 'Su', chandra: 'Mo', mangal: 'Ma', budha: 'Me', guru: 'Ju', shukra: 'Ve', shani: 'Sa', rahu: 'Ra', ketu: 'Ke', sun: 'Su', moon: 'Mo', mars: 'Ma', mercury: 'Me', jupiter: 'Ju', venus: 'Ve', saturn: 'Sa' };

function normKey(s) {
  return s.toLowerCase().replace(/[^a-z]/g, '');
}

/** "07° Meen 00′ 25″" -> {sign: 12, lon: 337.00694}. */
export function parseLongitude(text) {
  const m = /(\d{1,2})\s*°\s*([A-Za-z]+)\s*(\d{1,2})\s*[′']\s*(\d{1,2})\s*[″"]/.exec(text.replace(/\s+/g, ' '));
  if (!m) return null;
  const sign = SIGN_ABBR[m[2].toLowerCase()];
  if (!sign) return null;
  const inSign = Number(m[1]) + Number(m[3]) / 60 + Number(m[4]) / 3600;
  return { sign, lon: (sign - 1) * 30 + inSign, text: text.replace(/\s+/g, ' ').trim() };
}

/** "U Bhadrapada 2" -> {nakshatra: 26, pada: 2}. */
export function parseNakshatra(text) {
  // Drik appends status glyphs to the nakshatra cell ("Mrigashira 3🔥" = combust); keep ASCII only.
  const m = /^(.*?)\s+(\d)\b/.exec(text.replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim());
  if (!m) return null;
  const key = normKey(m[1]);
  const idx = NAKSHATRAS.findIndex((n) => normKey(n) === key || normKey(n).replace(/^p/, 'purva').replace(/^u/, 'uttara') === key);
  if (idx < 0) return null;
  return { nakshatra: idx + 1, pada: Number(m[2]), text: m[0] };
}

function hour12(hhmm) {
  const [hh, mm] = hhmm.split(':').map(Number);
  return { hour: String(hh % 12 === 0 ? 12 : hh % 12), minute: String(mm), ampm: hh < 12 ? 'AM' : 'PM' };
}

async function fillForm(page, c) {
  const [y, m, d] = c.date.split('-').map(Number);
  await page.selectOption('#dp-month', { label: `${MONTHS[m - 1]} (${m})` });
  await page.selectOption('#dp-day', { label: String(d) });
  await page.selectOption('#dp-year', { label: String(y) });
  const t = hour12(c.time ?? '12:00');
  await page.selectOption('#dp-hour', { label: t.hour });
  await page.selectOption('#dp-minute', { label: t.minute });
  await page.selectOption('#dp-second', { label: '0' });
  await page.selectOption('#dp-am-pm', { label: t.ampm });
  await page.fill('#dp-name', `Ref ${c.id}`);
  await page.click('#dp-city-search');
  await page.type('#dp-city-search', c.place, { delay: 70 });
  await page.waitForSelector('.ui-autocomplete li', { timeout: 25000 });
  await page.waitForTimeout(600);
  const items = await page.$$eval('.ui-autocomplete li', (els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').trim()));
  // Pick the suggestion nearest to the case coordinates (the dropdown lists same-named towns elsewhere: Siwana
  // Rajasthan before Siwan Bihar, Hyderabad Sindh before Hyderabad Telangana): click, read the filled
  // latitude/longitude, and move to the next suggestion while the place is more than 0.3 deg away.
  const readLatLon = () =>
    page.evaluate(() => {
      const dms = (ids) => ids.map((id) => Number(document.querySelector(id).value) || 0).reduce((s, v, i) => s + v / 60 ** i, 0);
      const lat = dms(['#dp-lat-deg', '#dp-lat-min', '#dp-lat-sec']) * (/minus|south/i.test(document.querySelector('#dp-lat-sign').value) ? -1 : 1);
      const lon = dms(['#dp-long-deg', '#dp-long-min', '#dp-long-sec']) * (/minus|west/i.test(document.querySelector('#dp-long-sign').value) ? -1 : 1);
      return { lat, lon };
    });
  let pick = 0;
  for (let i = 0; i < Math.min(items.length, 8); i++) {
    if (i > 0) {
      await page.fill('#dp-city-search', '');
      await page.type('#dp-city-search', c.place, { delay: 70 });
      await page.waitForSelector('.ui-autocomplete li', { timeout: 25000 });
      await page.waitForTimeout(600);
    }
    await page.click(`.ui-autocomplete li >> nth=${i}`);
    await page.waitForTimeout(1200);
    const ll = await readLatLon();
    pick = i;
    if (Math.hypot(ll.lat - c.lat, (ll.lon - c.lon) * Math.cos((c.lat * Math.PI) / 180)) < 0.3) break;
  }
  const geo = await page.evaluate(() => ({
    city: document.querySelector('#dp-city-search').value,
    state: document.querySelector('#dp-state').value,
    country: document.querySelector('#dp-country').value,
    olson: document.querySelector('#dp-olson-timezone').value,
    offset: document.querySelector('#dp-offset').value,
    elevation: document.querySelector('#dp-elevation').value,
    ayanamsha: document.querySelector('#dp-ayanamsha').value,
    lat: [...document.querySelectorAll('#dp-lat-deg,#dp-lat-min,#dp-lat-sec')].map((e) => Number(e.value)),
    latSign: document.querySelector('#dp-lat-sign').value,
    lon: [...document.querySelectorAll('#dp-long-deg,#dp-long-min,#dp-long-sec')].map((e) => Number(e.value)),
    lonSign: document.querySelector('#dp-long-sign').value,
  }));
  const dms = (a) => a[0] + a[1] / 60 + a[2] / 3600;
  geo.latitude = dms(geo.lat) * (/minus|south/i.test(geo.latSign) ? -1 : 1);
  geo.longitude = dms(geo.lon) * (/minus|west/i.test(geo.lonSign) ? -1 : 1);
  return { geo, suggestions: items, picked: items[pick] };
}

async function submitAndOpen(page) {
  await page.click('#dp-submit-button');
  await page.waitForSelector('#dp-button-confirm', { timeout: 25000 });
  await page.waitForTimeout(700);
  await page.click('#dp-button-confirm');
  await page.waitForSelector('#dp-save-without-login', { timeout: 25000 });
  await page.click('#dp-save-without-login');
  await page.waitForTimeout(700);
  await Promise.all([page.waitForNavigation({ timeout: 90000 }), page.click('#dp-button-confirm')]);
  await page.waitForSelector('#dp-planet-table .dpTableRow', { timeout: 60000 });
  await page.waitForTimeout(1500);
}

async function extractPlanets(page) {
  return page.evaluate(() => {
    const block = document.querySelector('#dp-third-block') || document;
    const rows = [...block.querySelectorAll('#dp-planet-table .dpPlanetTable .dpTableRow')].filter((r) => !r.classList.contains('dpTableHeader'));
    return rows.map((r) => {
      const cell = (sel) => (r.querySelector(sel)?.innerText ?? '').replace(/\s+/g, ' ').trim();
      const nameCell = r.querySelector('.dpPlanetCell');
      const name = nameCell ? nameCell.innerText.replace(/[^A-Za-z ]/g, ' ').replace(/\s+/g, ' ').trim().split(' ')[0] : '';
      return {
        name,
        rawName: nameCell ? nameCell.innerText.replace(/\s+/g, ' ').trim() : '',
        longitude: cell('.dpLongitudeCell'),
        nakshatra: cell('.dpNakshatraCell'),
        isIn: cell('.dpPlanetIsInCell'),
        dignities: cell('.dpDignitiesCell'),
        retro: Boolean(nameCell && nameCell.innerText.includes('↺')),
      };
    });
  });
}

async function openDasha(page) {
  const btn = await page.$('.dpVimshottariButton');
  if (!btn) return null;
  await btn.click();
  await page.waitForTimeout(6000);
  return page.evaluate(() => {
    const out = { text: '', rows: [] };
    const holder = document.querySelector('#dp-result-content, .dpDashaTable, .dpVimshottariTable, [class*=Dasha]') || document.body;
    out.text = (holder.innerText || '').slice(0, 20000);
    for (const r of document.querySelectorAll('[class*=asha] .dpTableRow, .dpDashaTable .dpTableRow, table tr')) {
      const cells = [...r.children].map((c) => c.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean);
      if (cells.length >= 2) out.rows.push(cells);
    }
    return out;
  });
}

/**
 * Mahadasha rows as Drik prints them: "Rahu - Maha Dasha - 17y 11m | October 7, 2015, Wednesday at 03:00
 * October 6, 2033, Thursday at 17:45" -> [{lord, start, end}] with "YYYY-MM-DDTHH:MM" local wall times
 * (the first row is the balance dasha; its start lies before the birth).
 */
export function parseDashaRows(rows, text) {
  const out = [];
  const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dateRe = /([A-Z][a-z]+) (\d{1,2}), (\d{4})(?:, [A-Za-z]+ at (\d{1,2}):(\d{2}))?|(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})|(\d{4})-(\d{2})-(\d{2})/g;
  const toIso = (m) => {
    const p2 = (s) => String(s).padStart(2, '0');
    if (m[1]) {
      const mi = MON.findIndex((n) => n.startsWith(m[1].slice(0, 3))) + 1;
      if (!mi) return null;
      return `${m[3]}-${p2(mi)}-${p2(m[2])}${m[4] ? `T${p2(m[4])}:${m[5]}` : ''}`;
    }
    if (m[8]) return `${m[8]}-${p2(m[7])}-${p2(m[6])}`;
    return `${m[9]}-${m[10]}-${m[11]}`;
  };
  const lines = rows.length ? rows.map((r) => r.join(' | ')) : text.split('\n');
  for (const line of lines) {
    const lordMatch = /^(Surya|Chandra|Mangal|Budha|Guru|Shukra|Shani|Rahu|Ketu|Sun|Moon|Mars|Mercury|Jupiter|Venus|Saturn)\b.*Maha/i.exec(line.trim());
    if (!lordMatch) continue;
    const dates = [...line.matchAll(dateRe)].map(toIso).filter(Boolean);
    if (dates.length >= 2) out.push({ lord: LORDS[lordMatch[1].toLowerCase()], start: dates[0], end: dates[1], raw: line.trim() });
    else if (dates.length === 1) out.push({ lord: LORDS[lordMatch[1].toLowerCase()], end: dates[0], raw: line.trim() });
  }
  return out;
}

const isMain = process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href;
if (isMain) await runFetcher('drik-kundali', SITE, async (session) => {
  if (args.max) session.maxLoads = Math.min(session.maxLoads, Number(args.max));
  let done = 0;
  for (const c of cases) {
    if (args.case && args.case !== c.id) continue;
    const outFile = join(OUT_DIR, `${c.id}.json`);
    if (existsSync(outFile) && !args.probe) continue;
    if (session.budgetLeft() < 3) throw new Error(`RUN_BUDGET: fewer than 3 loads left for ${c.id}`);
    if (done > 0) await session.newPage();
    const page = await session.load(FORM_URL, `kundali-form-${c.id}`);
    page.removeAllListeners('dialog');
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    const { geo, suggestions, picked } = await fillForm(page, c);
    const notes = [];
    const dLat = Math.abs(geo.latitude - c.lat);
    const dLon = Math.abs(geo.longitude - c.lon);
    if (dLat > 0.05 || dLon > 0.05) notes.push(`site geo ${geo.latitude.toFixed(4)},${geo.longitude.toFixed(4)} differs from the case coordinates ${c.lat},${c.lon} by ${dLat.toFixed(3)}/${dLon.toFixed(3)} deg (suggestion "${picked}")`);
    // The result page is a navigation (POST) and the dasha view an AJAX load: count both against the budget.
    session.loads += 1;
    session.lastLoadAt = Date.now();
    await submitAndOpen(page);
    const resultUrl = page.url();
    const html = await page.content();
    try {
      ensureDir(join(RAW_DIR, SITE));
      writeFileSync(join(RAW_DIR, SITE, `kundali-result-${c.id}.html`), html, 'utf8');
    } catch {}
    const planets = await extractPlanets(page);
    session.loads += 1;
    const dasha = await openDasha(page);
    if (args.probe && dasha) {
      try {
        writeFileSync(join(RAW_DIR, SITE, `kundali-dasha-${c.id}.txt`), dasha.text + '\n\nROWS\n' + dasha.rows.map((r) => r.join(' | ')).join('\n'), 'utf8');
        writeFileSync(join(RAW_DIR, SITE, `kundali-dasha-${c.id}.html`), await page.content(), 'utf8');
      } catch {}
      console.log('[probe] planets:', JSON.stringify(planets, null, 1));
      console.log('[probe] dasha text head:', dasha.text.slice(0, 3000));
      console.log('[probe] dasha rows:', dasha.rows.slice(0, 40));
    }
    const values = { input: {}, planets: {}, lagna: null, moon: null, dasha: null, raw: { planets, dasha: dasha ? dasha.rows.slice(0, 60) : null } };
    const offsetHours = Number(geo.offset);
    values.input = {
      date: c.date,
      time: c.time ?? '12:00',
      noonForUnknownTime: c.time === null,
      city: geo.city,
      state: geo.state,
      country: geo.country,
      latitude: geo.latitude,
      longitude: geo.longitude,
      elevation: Number(geo.elevation),
      olsonTimezone: geo.olson,
      // The form shows the zone's present standard offset (5.50 for a 1944 Delhi birth); the server applies the
      // historical Olson offset when it computes the chart (the suite verifies the instant through the Moon).
      formOffsetHours: offsetHours,
      offsetMinutes: null,
      ayanamsha: geo.ayanamsha,
      node: 'mean (site default; "Set True Rahu/Ketu" not toggled)',
      suggestions,
      picked,
    };
    for (const p of planets) {
      const id = GRAHA_IDS[normKey(p.name)];
      if (!id) continue;
      const lon = parseLongitude(p.longitude);
      if (!lon) continue;
      const nak = parseNakshatra(p.nakshatra);
      const point = { sign: lon.sign, lon: Math.round(lon.lon * 1e5) / 1e5, text: lon.text, nakshatra: nak ? nak.nakshatra : null, pada: nak ? nak.pada : null, isIn: p.isIn, dignities: p.dignities };
      if (id === 'La') values.lagna = point;
      else {
        if (id === 'Ra' || id === 'Ke') point.retro = p.retro;
        values.planets[id] = point;
        if (id === 'Mo' && nak) values.moon = { nakshatra: nak.nakshatra, pada: nak.pada, text: nak.text };
      }
    }
    if (dasha) {
      const mahas = parseDashaRows(dasha.rows, dasha.text);
      if (mahas.length) values.dasha = { mahaLord: Object.keys(LORDS).find((k) => LORDS[k] === mahas[0].lord && k.length > 2) ?? mahas[0].lord, mahaLordId: mahas[0].lord, mahaStart: mahas[0].start ?? null, mahaEnd: mahas[0].end, mahas: mahas.slice(0, 9) };
    }
    if (Object.keys(values.planets).length < 9) notes.push(`only ${Object.keys(values.planets).length} grahas parsed`);
    if (!values.dasha) notes.push('dasha table not parsed');
    writeFact(outFile, { caseId: c.id, source: SITE, sourceUrl: `${resultUrl} (POST dp_payload from ${FORM_URL})`, values, notes: [...notes, 'Longitudes are sidereal (Lahiri/Chitrapaksha, site default), DD° Sign MM′ SS″ as printed under "Rashi Chart Details > Graha Details"; mean node.'] });
    done++;
    console.log(`[drik-kundali] ${c.id} ok (${session.loads}/${session.maxLoads} loads; offset ${geo.offset} ${geo.olson}; lagna ${values.lagna ? values.lagna.text : 'n/a'})`);
    if (args.probe) break;
  }
  console.log(`[drik-kundali] fetched ${done}`);
});
