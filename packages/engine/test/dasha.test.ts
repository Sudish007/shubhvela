import { describe, expect, it } from 'vitest';
import { computeChart } from '../src/kundli/index';
import { DASHA_YEAR_DAYS, VIMSHOTTARI_ORDER, VIMSHOTTARI_YEARS, changesBetween, current, dasha, ingressDates, nextChange, sadeSati, siderealLongitude } from '../src/dasha/index';
import { localToUtc, formatInZone } from '../src/tz/index';

const ZONE = 'Asia/Kolkata';
const DAY = 86_400_000;
// Sample profile (plan P12): 1998-03-14 06:42 Lucknow, Moon Kanya 8d45 Uttara Phalguni 4 (A02 findings).
const SAMPLE = computeChart({ date: '1998-03-14', time: '06:42', tz: ZONE, lat: 26.85, lon: 80.95 });
const d = (ms: number) => formatInZone(ms, ZONE, 'yyyy-MM-dd');

describe('Vimshottari dasha tree (F14)', () => {
  const tree = dasha(SAMPLE);

  it('starts with the balance of the birth nakshatra lord and spans at least 120 years', () => {
    expect(tree.birthNakshatra).toBe(12); // Uttara Phalguni
    expect(tree.balanceAtBirth.lord).toBe('Su');
    expect(tree.balanceAtBirth.years).toBeGreaterThan(0.5);
    expect(tree.balanceAtBirth.years).toBeLessThan(0.6);
    const last = tree.mahas[tree.mahas.length - 1];
    expect((last.end - tree.birthUtcMs) / (DASHA_YEAR_DAYS * DAY)).toBeGreaterThanOrEqual(120);
    // A02 findings: Rahu maha 2015-10-05 .. 2033-10-05.
    const rahu = tree.mahas.find((m) => m.lord === 'Ra')!;
    expect(d(rahu.start)).toBe('2015-10-05');
    expect(d(rahu.end)).toBe('2033-10-05');
  });

  it('follows the Vimshottari order with full-length mahadashas after the balance', () => {
    for (let i = 1; i < 9; i++) {
      const m = tree.mahas[i];
      const idx = VIMSHOTTARI_ORDER.indexOf(tree.mahas[i - 1].lord);
      expect(m.lord).toBe(VIMSHOTTARI_ORDER[(idx + 1) % 9]);
      expect((m.end - m.start) / (DASHA_YEAR_DAYS * DAY)).toBeCloseTo(VIMSHOTTARI_YEARS[m.lord], 6);
      expect(m.start).toBe(tree.mahas[i - 1].end);
    }
  });

  it('antars and pratyantars are contiguous inside their parents, 9 each (first maha truncated at birth)', () => {
    for (const m of tree.mahas) {
      const antars = m.children!;
      expect(antars.length).toBeGreaterThan(0);
      expect(antars.length).toBeLessThanOrEqual(9);
      expect(antars[0].start).toBe(m.start);
      expect(antars[antars.length - 1].end).toBe(m.end);
      for (let i = 1; i < antars.length; i++) expect(antars[i].start).toBe(antars[i - 1].end);
      for (const a of antars) {
        const pr = a.children!;
        expect(pr.length).toBeGreaterThan(0);
        expect(pr[0].start).toBe(a.start);
        expect(Math.abs(pr[pr.length - 1].end - a.end)).toBeLessThan(2);
      }
    }
    expect(tree.mahas[1].children).toHaveLength(9);
  });

  it('current() and nextChange() agree with the A02 sample (Rahu/Ketu/Rahu on 2026-10-22; Rahu-Venus from 2027-04-24)', () => {
    const now = localToUtc(ZONE, { y: 2026, m: 10, d: 22, hh: 10, mm: 58 }).utcMs;
    const cur = current(tree, now)!;
    expect(cur.maha.lord).toBe('Ra');
    expect(cur.antar.lord).toBe('Ke');
    expect(cur.pratyantar.lord).toBe('Ra');
    const next = nextChange(tree, now, 'antar')!;
    expect(next).toMatchObject({ level: 'antar', from: 'Ke', to: 'Ve', within: ['Ra'] });
    expect(d(next.at)).toBe('2027-04-24');
    expect(nextChange(tree, now, 'maha')).toMatchObject({ from: 'Ra', to: 'Ju' });
    expect(current(tree, tree.birthUtcMs - DAY)).toBeNull();
  });

  it('nextChange is strictly monotonic when walked from birth across the whole tree, at every level', () => {
    for (const level of ['maha', 'antar', 'pratyantar'] as const) {
      let t = tree.birthUtcMs;
      let steps = 0;
      for (;;) {
        const c = nextChange(tree, t, level);
        if (!c) break;
        expect(c.at).toBeGreaterThan(t);
        const after = current(tree, c.at);
        if (after) expect(after[level].lord).toBe(c.to);
        t = c.at;
        steps++;
        if (steps > 20_000) throw new Error('nextChange did not terminate');
      }
      expect(steps).toBeGreaterThan(level === 'maha' ? 8 : level === 'antar' ? 80 : 700);
    }
    const changes = changesBetween(tree, tree.birthUtcMs, tree.birthUtcMs + 365 * DAY);
    for (let i = 1; i < changes.length; i++) expect(changes[i].at).toBeGreaterThanOrEqual(changes[i - 1].at);
    expect(changes.some((c) => c.level === 'maha')).toBe(true);
  });
});

describe('ingressDates (Saturn / Jupiter / mean and true Rahu-Ketu)', () => {
  const from = localToUtc(ZONE, { y: 2026, m: 10, d: 22, hh: 0, mm: 0 }).utcMs;

  it('finds Saturn entering Mesha on 2027-06-03 and its retrograde return to Meena in October 2027', () => {
    const ev = ingressDates('Saturn', from, from + 3 * 365.25 * DAY);
    expect(ev.length).toBeGreaterThanOrEqual(3);
    expect(ev[0]).toMatchObject({ planet: 'Saturn', fromSign: 12, toSign: 1, retrograde: false });
    expect(d(ev[0].at)).toBe('2027-06-03');
    expect(ev[1]).toMatchObject({ fromSign: 1, toSign: 12, retrograde: true });
    expect(d(ev[1].at)).toBe('2027-10-20');
    for (let i = 1; i < ev.length; i++) expect(ev[i].at).toBeGreaterThan(ev[i - 1].at);
    // Each event is a true sign crossing: the longitude just before and after sits on either side of the boundary.
    for (const e of ev) {
      expect(Math.floor(siderealLongitude('Saturn', e.at - 60_000) / 30) + 1).toBe(e.fromSign);
      expect(Math.floor(siderealLongitude('Saturn', e.at + 60_000) / 30) + 1).toBe(e.toSign);
    }
  });

  it('Jupiter enters Simha on 2026-10-31; mean Rahu enters Makara on 2026-12-05; Ketu mirrors Rahu', () => {
    const ju = ingressDates('Jupiter', from, from + 400 * DAY);
    expect(ju[0]).toMatchObject({ fromSign: 4, toSign: 5, retrograde: false }); // Karka -> Simha
    expect(d(ju[0].at)).toBe('2026-10-31');
    const ra = ingressDates('Rahu', from, from + 400 * DAY);
    expect(ra[0]).toMatchObject({ fromSign: 11, toSign: 10, retrograde: true });
    expect(d(ra[0].at)).toBe('2026-12-05');
    const ke = ingressDates('Ketu', from, from + 400 * DAY);
    expect(ke[0]).toMatchObject({ fromSign: 5, toSign: 4 });
    expect(Math.abs(ke[0].at - ra[0].at)).toBeLessThan(60_000);
  });

  it('true-node option (P11) gives a different, earlier ingress than the mean node', () => {
    const tru = ingressDates('Rahu', from, from + 400 * DAY, { node: 'true' });
    expect(tru[0]).toMatchObject({ fromSign: 11, toSign: 10 });
    expect(tru[0].at).toBeLessThan(ingressDates('Rahu', from, from + 400 * DAY)[0].at);
  });
});

describe('sadeSati (F15): phases, Dhaiya and next event from exact ingress search', () => {
  const now = localToUtc(ZONE, { y: 2026, m: 10, d: 22, hh: 6, mm: 0 }).utcMs;

  it('sample profile (Moon Kanya): Saturn in Meena is the 7th -> none; Dhaiya (8th) begins 2027-06-03; the next Sade Sati 2036-2043', () => {
    const r = sadeSati(SAMPLE, now);
    expect(r.natalMoonSign).toBe(6);
    expect(r.saturnSign).toBe(12);
    expect(r.saturnHouseFromMoon).toBe(7);
    expect(r.state.kind).toBe('none');
    expect(r.next).toMatchObject({ kind: 'dhaiya-start', approx: false });
    expect(d(r.next!.at)).toBe('2027-06-03');
    const future = r.episodes.find((e) => e.start > now)!;
    expect(d(future.start)).toBe('2036-08-27');
    expect(future.phases[0].n).toBe(1);
    expect(future.phases.map((p) => p.n)).toContain(2);
    expect(future.phases[future.phases.length - 1].n).toBe(3);
    for (const e of r.episodes) for (let i = 1; i < e.phases.length; i++) expect(e.phases[i].start).toBe(e.phases[i - 1].end);
    expect(r.dhaiyas.some((x) => x.house === 8 && d(x.start) === '2027-06-03')).toBe(true);
  });

  it('a Moon in Simha is in the 8th Dhaiya while Saturn transits Meena (2025-2027)', () => {
    const c = computeChart({ date: '1990-01-15', time: '10:00', tz: ZONE, lat: 28.6139, lon: 77.209 });
    expect(c.planets.find((p) => p.id === 'Mo')!.sign).toBe(5);
    const r = sadeSati(c, now);
    expect(r.state).toMatchObject({ kind: 'dhaiya', house: 8 });
    expect(r.next).toMatchObject({ kind: 'dhaiya-end' });
    expect(d(r.next!.at)).toBe('2027-06-03');
  });

  it('a Moon in Meena is in phase 2 now and the report lists phase 1 before and phase 3 after', () => {
    // Moon in Meena on 2026-01-24 noon IST (sidereal 345 deg).
    const c = computeChart({ date: '2026-01-24', time: '12:00', tz: ZONE, lat: 28.6139, lon: 77.209 });
    expect(c.planets.find((p) => p.id === 'Mo')!.sign).toBe(12);
    const r = sadeSati(c, now);
    expect(r.state).toMatchObject({ kind: 'sadesati', phase: 2 });
    const ep = r.episodes.find((e) => e.start <= now && now < e.end)!;
    expect(ep.phases[0].n).toBe(1);
    expect(ep.phases.map((p) => p.n)).toContain(3);
    expect(r.next!.kind).toBe('sadesati-phase');
    expect(d(r.next!.at)).toBe('2027-06-03');
  });
});
