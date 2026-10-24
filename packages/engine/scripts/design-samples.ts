// Prints the engine values behind the design mocks (plan.md R1-M5 / N2): the three mock days at New Delhi and
// the 1998-03-14 06:42 Lucknow chart. Every number below is computed; the output is pasted into
// .agents/tasks/v1-build/verification-a02.md and supersedes the mocks' SAMPLE placeholders (mocks are not edited).
// Run with: npx tsx packages/engine/scripts/design-samples.ts
//
// Section (a) prints the raw fork values per day (A02) and, since A03, the merged goodHours() model (band spans,
// segment rows with their single verdict chip, flags, legend, hora grid) and the panchang() F8 fields.
import { Observer } from 'astronomy-engine';
import { getPanchangam } from '../vendor/jyotish/src/core/panchangam';
import { getVimshottariDasha } from '../vendor/jyotish/src/core/dashas';
import { computeChart, chalit, varga, type ChartData } from '../src/kundli/index';
import { formatInZone, localToUtc, offsetAt, TZDB_VERSION } from '../src/tz/index';
import { nakshatraNames, planetNames, signNames, tithiNames, pakshaNames, weekdayShort, lunarMonthNames, karanaNames, yogaNames } from '../src/locale/index';
import { goodHours, labelFor, at as bandAt } from '../src/panchang/goodHours';
import { panchang } from '../src/panchang/panchang';

const DOT = ' \u00b7 ';
const ZONE = 'Asia/Kolkata';
const DELHI = { lat: 28.6139, lon: 77.209 };
const DAYS: [number, number, number][] = [
  [2026, 10, 22], // Thu
  [2026, 10, 23], // Fri
  [2026, 10, 26], // Mon
];

const hm = (d: Date | null | undefined): string => (d ? formatInZone(d.getTime(), ZONE, 'HH:mm') : '--:--');
const hm2 = (ms: number | null | undefined): string => (ms === null || ms === undefined ? '--:--' : formatInZone(ms, ZONE, 'HH:mm'));
const RITU = ['Vasanta', 'Grishma', 'Varsha', 'Sharad', 'Hemanta', 'Shishira'];
const dayLabel = (ms: number): string => formatInZone(ms, ZONE, 'EEE d MMM yyyy');
const dms = (deg: number, min: number): string => `${deg}\u00b0${String(min).padStart(2, '0')}\u2032`;

console.log(`design-samples ${new Date().toISOString()} | tzdb ${TZDB_VERSION} | ephemeris astronomy-engine 2.1.19 | ayanamsa Lahiri | node mean | goodHours precedence design 10.2 | Brahma muhurta = 96-48 min before next sunrise`);
console.log('');
console.log(`=== (a) Mock days at New Delhi ${DELHI.lat}/${DELHI.lon} ${ZONE} ===`);
for (const [y, m, d] of DAYS) {
  const noon = localToUtc(ZONE, { y, m, d, hh: 12, mm: 0 }).utcMs;
  const offset = offsetAt(ZONE, noon);
  const observer = new Observer(DELHI.lat, DELHI.lon, 0);
  const p = getPanchangam(new Date(noon), observer, { timezoneOffset: offset });
  console.log('');
  console.log(`--- ${dayLabel(noon)} (offset ${offset >= 0 ? '+' : ''}${offset} min) ---`);
  console.log(`Sunrise ${hm(p.sunrise)}${DOT}Sunset ${hm(p.sunset)}${DOT}Moonrise ${hm(p.moonrise)}${DOT}Moonset ${hm(p.moonset)}`);
  const tithiIdx = p.tithi - 1;
  const paksha = tithiIdx < 15 ? pakshaNames.en[0] : pakshaNames.en[1];
  console.log(`Tithi ${paksha} ${tithiNames.en[tithiIdx]} till ${hm(p.tithiEndTime)}${DOT}Nakshatra ${nakshatraNames.en[p.nakshatra - 1]} till ${hm(p.nakshatraEndTime)}${DOT}Yoga ${p.yogaName} till ${hm(p.yogaEndTime)}${DOT}Karana ${p.karana}`);
  console.log(`Karana transitions: ${p.karanaTransitions.map((k) => `${k.name} till ${hm(k.endTime)}`).join(', ')}`);
  console.log(`Masa ${p.masa.name}${p.masa.isAdhika ? ' (adhika)' : ''} (fork amanta reckoning)${DOT}Ritu ${p.ritu}${DOT}${p.ayanaName}${DOT}Vikram ${p.samvat.vikram}${DOT}Shaka ${p.samvat.shaka}${DOT}Sun in ${signNames.en[p.sunRashi.index]}${DOT}Moon in ${signNames.en[p.moonRashi.index]}`);
  console.log(`Rahu Kaal ${hm(p.rahuKalamStart)}-${hm(p.rahuKalamEnd)}${DOT}Yamaganda ${hm(p.yamagandaKalam?.start)}-${hm(p.yamagandaKalam?.end)}${DOT}Gulika ${hm(p.gulikaKalam?.start)}-${hm(p.gulikaKalam?.end)}${DOT}Abhijit ${hm(p.abhijitMuhurta?.start)}-${hm(p.abhijitMuhurta?.end)}${DOT}Brahma ${hm(p.brahmaMuhurta?.start)}-${hm(p.brahmaMuhurta?.end)}`);
  console.log(`Choghadiya day: ${p.choghadiya.day.map((c) => `${c.name} ${hm(c.startTime)}-${hm(c.endTime)} (${c.rating})`).join(', ')}`);
  console.log(`Choghadiya night: ${p.choghadiya.night.map((c) => `${c.name} ${hm(c.startTime)}-${hm(c.endTime)} (${c.rating})`).join(', ')}`);
  console.log(`Hora at noon: ${p.currentHora}${DOT}Vara ${weekdayShort.en[p.vara - 1]}${DOT}Moon nakshatra pada ${p.nakshatraPada}`);
  if (p.varjyam.length) console.log(`Varjyam: ${p.varjyam.map((v) => `${hm(v.start)}-${hm(v.end)}`).join(', ')}${DOT}Amrit kalam: ${p.amritKalam.map((v) => `${hm(v.start)}-${hm(v.end)}`).join(', ')}`);

  // A03: the merged model behind the Today band (goodHours = the only producer of verdicts) and the F8 sheet.
  const dayLocal = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const gh = goodHours(dayLocal, DELHI, ZONE);
  const t = gh.ticks!;
  const name = (id: string): string => {
    const s = gh.segments.find((x) => x.id === id);
    return s ? (s.choghadiya ? `${s.choghadiya} choghadiya` : s.name) : id;
  };
  console.log(`goodHours ticks: sunrise ${hm2(t.sunrise)}${DOT}noon ${hm2(t.noon)}${DOT}sunset ${hm2(t.sunset)}${DOT}next sunrise ${hm2(t.nextSunrise)}${DOT}moonrise ${t.moonrise ? hm2(t.moonrise) : 'none'}${DOT}legend ${gh.legend.join(' · ')}`);
  console.log(
    `goodHours band (${gh.spans.length} spans, labels at 358 dp): ` +
      gh.spans
        .map((s) => {
          const label = labelFor(s, gh, 358);
          const lbl = label ? (label.kind === 'verdict' ? label.verdict : label.segments.map(name).join('+')) : 'no label';
          return `${hm2(s.start)}-${hm2(s.end)} ${s.verdict}${s.night ? ' (night)' : ''} [${s.reasons.map(name).join(', ')}] <${lbl}>`;
        })
        .join('; '),
  );
  console.log(`goodHours rows (${gh.segments.filter((s) => !s.night).length} day + ${gh.segments.filter((s) => s.night).length} night):`);
  for (const s of gh.segments) {
    const notes: string[] = [];
    if (s.overriddenBy) notes.push(`overridden by ${s.overriddenBy.map(name).join(', ')}`);
    if (s.liftedBy) notes.push(`lifted by ${s.liftedBy.map(name).join(', ')}`);
    for (const part of s.parts ?? []) notes.push(part.kind === 'own' ? `${hm2(part.start)}-${hm2(part.end)} keeps its own nature (${part.verdict})` : `${hm2(part.start)}-${hm2(part.end)} ${part.kind} by ${part.by.map(name).join(', ')}`);
    if (s.includes) notes.push(`includes ${s.includes.map(name).join(', ')}`);
    for (const f of s.flags) notes.push(`flag: ${f}`);
    console.log(`  ${s.night ? 'night ' : 'day   '}${name(s.id).padEnd(18)} ${hm2(s.start)}-${hm2(s.end)}  ${s.verdict.padEnd(7)} ${notes.join(' · ')}`);
  }
  const flagText: string[] = [];
  if (gh.flags.panchak) flagText.push(`Panchak ${formatInZone(gh.flags.panchak.start, ZONE, 'EEE d MMM HH:mm')} -> ${formatInZone(gh.flags.panchak.end, ZONE, 'EEE d MMM HH:mm')}`);
  if (gh.flags.bhadra) flagText.push(`Bhadra (${gh.flags.bhadra.location}) ${formatInZone(gh.flags.bhadra.start, ZONE, 'EEE d MMM HH:mm')} -> ${formatInZone(gh.flags.bhadra.end, ZONE, 'EEE d MMM HH:mm')}`);
  console.log(`goodHours flags: ${flagText.length ? flagText.join(DOT) : 'none'}`);
  const nowProbe = localToUtc(ZONE, { y, m, d, hh: 10, mm: 58 }).utcMs;
  const now = bandAt(gh, nowProbe);
  if (now) console.log(`goodHours at 10:58: ${now.span.verdict}${DOT}${now.choghadiya ? `${now.choghadiya.choghadiya} choghadiya` : '-'}${DOT}${now.hora ? planetNames.en[now.hora.lord] + ' hora' : '-'}${DOT}next: ${now.next ? `${now.next.starting.map(name).join('/')} ${hm2(now.next.at)} (${now.next.verdict})` : '-'}`);
  console.log(`goodHours hora: ${gh.hora.map((h) => `${hm2(h.start)} ${planetNames.en[h.lord]}`).join(', ')}`);
  const pd = panchang(dayLocal, DELHI, ZONE);
  const tithiTxt = (tt: { n: number; paksha: string; end: number }) => `${tt.paksha === 'shukla' ? 'Shukla' : 'Krishna'} ${tithiNames.en[tt.n - 1]} till ${hm2(tt.end)}`;
  console.log(
    `panchang F8: ${pd.tithis.map(tithiTxt).join(', then ')}${DOT}Nakshatra ${pd.nakshatras.map((n) => `${nakshatraNames.en[n.index]} (pada ${n.pada}) till ${hm2(n.end)}`).join(', then ')}${DOT}Yoga ${pd.yogas.map((v) => `${yogaNames.en[v.index]} till ${hm2(v.end)}`).join(', then ')}${DOT}Karana ${pd.karanas.map((k) => `${karanaNames.en[k.index]}${k.bhadra ? ' (Bhadra)' : ''} till ${hm2(k.end)}`).join(', then ')}`,
  );
  console.log(
    `panchang F8: Vikram ${pd.vikramSamvat}${DOT}Shaka ${pd.shakaSamvat}${DOT}Month Purnimanta ${pd.monthPurnimanta.adhik ? 'Adhik ' : ''}${lunarMonthNames.en[pd.monthPurnimanta.index]}${DOT}Amanta ${pd.monthAmanta.adhik ? 'Adhik ' : ''}${lunarMonthNames.en[pd.monthAmanta.index]}${DOT}Ritu vedic ${RITU[pd.ritu.vedic]} / drik ${RITU[pd.ritu.drik]}${DOT}Ayana vedic ${pd.ayana.vedic} / drik ${pd.ayana.drik}${DOT}Sun ${signNames.en[pd.sunSign]}${DOT}Moon ${signNames.en[pd.moonSign]}${DOT}Moonrise ${hm2(pd.moonrise)}${DOT}Moonset ${hm2(pd.moonset)}${DOT}Disha Shool ${pd.dishaShool.avoid}${DOT}Brahma (before this sunrise) ${hm2(pd.brahmaMorning!.start)}-${hm2(pd.brahmaMorning!.end)}`,
  );
}

console.log('');
console.log('=== (b) Sample chart: 1998-03-14 06:42 Lucknow 26.85/80.95 Asia/Kolkata (approx +-30 min, Lahiri, mean node, whole sign) ===');
const chart = computeChart({ date: '1998-03-14', time: '06:42', approxMinutes: 30, tz: ZONE, lat: 26.85, lon: 80.95 });
const planetLine = (c: ChartData): void => {
  for (const p of c.planets) {
    const nak = nakshatraNames.en[p.nakshatra - 1];
    console.log(
      `  ${planetNames.en[p.id].padEnd(8)} ${signNames.en[p.sign - 1].padEnd(11)} ${dms(p.degree, p.minute).padEnd(8)} ${`${nak} ${p.pada}`.padEnd(22)} H${String(p.house).padEnd(3)} ${p.tags.join(', ')}${p.approx ? ' [approx.]' : ''}`,
    );
  }
};
console.log(`UTC ${new Date(chart.meta.utcMs).toISOString()} (offset +${chart.meta.offsetMinutes} min)${DOT}ayanamsa ${chart.meta.ayanamsaDegrees.toFixed(4)}\u00b0`);
if (chart.lagna) {
  const l = chart.lagna;
  console.log(`Lagna ${signNames.en[l.sign - 1]} ${dms(l.degree, l.minute)} ${nakshatraNames.en[l.nakshatra - 1]} ${l.pada}${l.approx ? ' [approx.: +-30 min drift ' + l.drift!.minus.toFixed(2) + '..' + l.drift!.plus.toFixed(2) + ' crosses a sign boundary]' : ''}`);
}
console.log('Planets (D1):');
planetLine(chart);
console.log('Houses (whole sign): ' + chart.houses.map((h) => `${h.n}:${signNames.en[h.sign - 1]}/${h.lord}${h.occupants.length ? '[' + h.occupants.join(' ') + ']' : ''}`).join(' '));
const d9 = varga(chart, 'D9');
console.log(`D9 Navamsa: Lagna ${d9.lagna ? signNames.en[d9.lagna.sign - 1] : '-'}${DOT}${d9.planets.map((p) => `${p.id} ${signNames.en[p.sign - 1]}${p.tags.includes('vargottama') ? '*' : ''}`).join(', ')} (* = vargottama)`);
const ch = chalit(chart);
console.log(`Chalit (Sripati): ${ch.planets.map((p) => `${p.id} H${p.house}`).join(', ')}${DOT}cusps ${ch.houses.map((h) => `${h.n}:${signNames.en[h.sign - 1]}`).join(' ')}`);
const moon = chart.planets.find((p) => p.id === 'Mo')!;
console.log(`Moon chart first house: ${signNames.en[moon.sign - 1]}${DOT}Moon ${nakshatraNames.en[moon.nakshatra - 1]} pada ${moon.pada}`);

const asOf = localToUtc(ZONE, { y: 2026, m: 10, d: 22, hh: 10, mm: 58 }).utcMs;
const dasha = getVimshottariDasha(moon.longitude, new Date(chart.meta.utcMs), new Date(asOf));
const fmtD = (d: Date): string => formatInZone(d.getTime(), ZONE, 'd MMM yyyy');
console.log(`Vimshottari dasha (as of ${formatInZone(asOf, ZONE, 'd MMM yyyy HH:mm')}): birth nakshatra ${dasha.birthNakshatra} pada ${dasha.nakshatraPada}`);
console.log('  Mahadashas: ' + dasha.mahadashas.slice(0, 9).map((m) => `${m.planet} ${fmtD(m.startTime)} - ${fmtD(m.endTime)}`).join('; '));
const cm = dasha.currentMahadasha as { planet: string; startTime: Date; endTime: Date };
const ca = dasha.currentAntar as { planet: string; startTime: Date; endTime: Date };
const cp = dasha.currentPratyantar as { planet: string; startTime: Date; endTime: Date } | undefined;
console.log(`  Now: ${cm.planet} mahadasha (${fmtD(cm.startTime)} - ${fmtD(cm.endTime)})${DOT}${ca.planet} antardasha (${fmtD(ca.startTime)} - ${fmtD(ca.endTime)})${cp ? `${DOT}${cp.planet} pratyantar (${fmtD(cp.startTime)} - ${fmtD(cp.endTime)})` : ''}`);
const maha = dasha.mahadashas.find((m) => m.planet === cm.planet && m.startTime.getTime() === cm.startTime.getTime());
const antars = maha?.antars ?? [];
const idx = antars.findIndex((a) => a.planet === ca.planet && a.startTime.getTime() === ca.startTime.getTime());
const next = antars[idx + 1] ?? dasha.mahadashas[dasha.mahadashas.indexOf(maha!) + 1]?.antars?.[0];
if (next) {
  const days = Math.round((ca.endTime.getTime() - asOf) / 86_400_000);
  console.log(`  Next antardasha: ${cm.planet}-${next.planet} from ${fmtD(next.startTime)} (${days} days from as-of)`);
}
console.log('');
console.log('How this was computed: Lahiri ayanamsa, mean node, astronomy-engine ephemeris, time zone Asia/Kolkata from the bundled tz table (historical rules), whole-sign houses, Sripati chalit; times rounded to the minute.');
