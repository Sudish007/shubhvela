// C01 (F9) widget state: buildWidgetState writes seven Vedic days of engine.goodHours spans with the N3 labels and the
// Upcoming line, every number engine output (A03 sample truths for Delhi 2026-10-22); the stale / exhausted / extension
// rules mirror the Kotlin WidgetState; writeWidgetState goes through injectable file deps, debounces identical writes and
// asks the widgets to redraw; the dev route can write a stale or exhausted file for the C05 shots.
import { formatInZone, upcoming } from '@shubhvela/engine';
import { insertProfile, getSelfProfile } from '../src/db/profiles';
import { setSetting } from '../src/db/settings';
import { SAMPLE_PRIYA } from '../src/dev/seed';
import { devWidgetClock, writeDevWidgetState } from '../src/dev/widgetState';
import { chartFor } from '../src/engine-bridge/charts';
import { makeT, type Lang } from '../src/i18n';
import { upcomingCardText } from '../src/today/UpcomingStrip';
import { buildWidgetState, daysRemaining, extensionReason, resolveWidgetState, WIDGET_STALE_AFTER_MS, type WidgetStateFile } from '../src/widgets/state';
import { readWidgetState, resetWriteDebounce, writeWidgetState, type WidgetFileDeps } from '../src/widgets/writeState';
import { installTestDb } from './helpers/nodeDb';

const DELHI = { lat: 28.6139, lon: 77.209, tz: 'Asia/Kolkata', placeName: 'New Delhi, Delhi, India' };
/** 2026-10-22 10:58 IST. */
const NOW = Date.UTC(2026, 9, 22, 5, 28);
const H = 3_600_000;
const hhmm = (ms: number) => formatInZone(ms, DELHI.tz, 'HH:mm');

/** What the Upcoming strip's first card says for the self profile at NOW, in `lang` (the widget line must equal it). */
function expectedNextEvent(lang: Lang): string {
  const self = getSelfProfile()!;
  const chart = chartFor(self);
  const items = upcoming({ id: String(self.id), name: self.name ?? undefined, chart, tradition: self.tradition }, [], NOW, { lat: self.lat, lon: self.lon }, self.tz);
  const t = makeT(lang);
  const text = upcomingCardText(items[0], self.tz, self.id, t, lang);
  return t('widget.nextEvent', { kind: text.kind, title: text.title, date: text.date });
}

function memoryDeps(): WidgetFileDeps & { text: string | null; refreshed: number } {
  const d = {
    text: null as string | null,
    refreshed: 0,
    async write(t: string) {
      d.text = t;
    },
    async read() {
      return d.text;
    },
    refresh() {
      d.refreshed++;
      return 2;
    },
  };
  return d;
}

describe('buildWidgetState (pure)', () => {
  const t = makeT('en');
  const file = buildWidgetState({ observer: DELHI, lang: 'en', theme: 'light', nowMs: NOW, t });

  it('writes seven consecutive Vedic days from the one containing now, with the engine offset and real spans', () => {
    expect(file.version).toBe(1);
    expect(file.writtenAt).toBe(NOW);
    expect(file.tz).toBe('Asia/Kolkata');
    expect(file.days.map((d) => d.date)).toEqual(['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28']);
    const d0 = file.days[0];
    expect(d0.offsetMinutes).toBe(330);
    expect(d0.dateText).toBe('Thu 22 Oct 2026');
    expect(hhmm(d0.sunrise)).toBe('06:26');
    expect(hhmm(d0.sunset)).toBe('17:44');
    expect(d0.nextSunrise).toBe(file.days[1].sunrise);
    // A03 sample truths: avoid 06:26-10:40 (Yamaganda, Rog, Gulika, Udveg), neutral 10:40-11:42 (Chal), good 11:42-13:30 (Abhijit, Labh) ...
    const day = d0.spans.filter((s) => !s.night).map((s) => `${hhmm(s.start)}-${hhmm(s.end)} ${s.verdict}`);
    expect(day).toEqual(['06:26-10:40 avoid', '10:40-11:42 neutral', '11:42-13:30 good', '13:30-16:19 avoid', '16:19-17:44 good']);
    expect(d0.spans[0].label).toBe('Avoid');
    expect(d0.spans[0].reasons.map((r) => r.name)).toEqual(['Yamaganda', 'Rog choghadiya', 'Gulika', 'Udveg choghadiya']);
    expect(d0.spans[2].reasons.map((r) => r.name)).toEqual(['Abhijit', 'Labh choghadiya']);
    // Spans are contiguous and cover sunrise -> next sunrise; night spans carry the night flag.
    for (let i = 1; i < d0.spans.length; i++) expect(d0.spans[i].start).toBe(d0.spans[i - 1].end);
    expect(d0.spans[0].start).toBe(d0.sunrise);
    expect(d0.spans[d0.spans.length - 1].end).toBe(d0.nextSunrise);
    expect(d0.spans.filter((s) => s.night).every((s) => s.start >= d0.sunset)).toBe(true);
    // Segments and hora carry display names in the UI language; every string is non-empty.
    expect(d0.segments.find((s) => s.id === 'rahu')?.name).toBe('Rahu Kaal');
    expect(d0.hora.length).toBe(24);
    expect(d0.hora.find((h) => h.start <= NOW && NOW < h.end)?.name).toBe('Mercury');
    expect(Object.values(file.strings).every((s) => s.length > 0)).toBe(true);
    expect(file.strings.stale).toBe('Open Shubhvela to refresh');
    expect(file.strings.next).toBe('next: {segment} {time}');
  });

  it('localises labels in Hindi and Bhojpuri and keeps Latin digits', () => {
    const hi = buildWidgetState({ observer: DELHI, lang: 'hi', theme: 'dark', nowMs: NOW, t: makeT('hi'), days: 1 });
    expect(hi.days.length).toBe(1);
    expect(hi.days[0].spans[0].label).toBe('टालें');
    expect(hi.days[0].segments.find((s) => s.id === 'rahu')?.name).toBe('राहु काल');
    expect(hi.strings.stale).toBe('ताज़ा करने के लिए शुभवेला खोलें');
    expect(hi.days[0].dateText).toMatch(/22/);
    const bho = buildWidgetState({ observer: DELHI, lang: 'bho', theme: 'system', nowMs: NOW, t: makeT('bho'), days: 1 });
    expect(bho.days[0].spans[0].label).toBe('बचीं');
    expect(bho.strings.now).toBe('अबहीं');
  });

  it('resolve mirrors the Kotlin rules: fresh / stale after 36 h / exhausted when no day covers now', () => {
    const fresh = resolveWidgetState(file, NOW);
    expect(fresh.status).toBe('fresh');
    expect(fresh.day?.date).toBe('2026-10-22');
    expect(fresh.span?.verdict).toBe('neutral');
    const beforeSunrise = resolveWidgetState(file, file.days[1].sunrise - 60_000);
    expect(beforeSunrise.day?.date).toBe('2026-10-22');
    expect(beforeSunrise.span?.night).toBe(true);
    expect(resolveWidgetState(file, NOW + WIDGET_STALE_AFTER_MS - 1).status).toBe('fresh');
    const stale = resolveWidgetState(file, NOW + 48 * H);
    expect(stale.status).toBe('stale');
    expect(stale.day?.date).toBe('2026-10-24');
    const exhausted = resolveWidgetState(file, NOW + 14 * 24 * H);
    expect(exhausted.status).toBe('exhausted');
    expect(exhausted.day?.date).toBe('2026-10-28');
    expect(exhausted.span).toBeNull();
    expect(resolveWidgetState(null, NOW).status).toBe('missing');
  });

  it('extension rule: rewrite when missing, when fewer than two days remain, or when older than 12 h', () => {
    expect(daysRemaining(file, NOW)).toBe(7);
    expect(extensionReason(null, NOW)).toBe('missing');
    expect(extensionReason(file, NOW)).toBeNull();
    expect(extensionReason(file, NOW + 11 * H)).toBeNull();
    expect(extensionReason(file, NOW + 13 * H)).toBe('aging');
    const fresh = { ...file, writtenAt: NOW + 5 * 24 * H + 5 * H } as WidgetStateFile;
    expect(daysRemaining(fresh, NOW + 5 * 24 * H + 5 * H)).toBe(2);
    expect(extensionReason(fresh, NOW + 5 * 24 * H + 5 * H)).toBeNull();
    const late = { ...file, writtenAt: NOW + 6 * 24 * H } as WidgetStateFile;
    expect(daysRemaining(late, NOW + 6 * 24 * H)).toBe(1);
    expect(extensionReason(late, NOW + 6 * 24 * H)).toBe('exhausting');
  });
});

describe('writeWidgetState (database + injected file deps)', () => {
  let close: () => void;
  beforeEach(() => {
    ({ close } = installTestDb());
    resetWriteDebounce();
  });
  afterEach(() => close());

  it('skips honestly without a profile, then writes the self profile place with the next family date and redraws the widgets', async () => {
    const deps = memoryDeps();
    expect(await writeWidgetState({ nowMs: NOW, deps })).toEqual({ written: false, skipped: 'no-profile', widgetsRefreshed: 0 });
    insertProfile(SAMPLE_PRIYA, new Date(NOW));
    setSetting('language', 'hi');
    const r = await writeWidgetState({ nowMs: NOW, deps });
    expect(r.written).toBe(true);
    expect(r.widgetsRefreshed).toBe(2);
    expect(deps.refreshed).toBe(1);
    const file = (await readWidgetState(deps))!;
    expect(file.lang).toBe('hi');
    expect(file.location).toEqual({ name: SAMPLE_PRIYA.placeName, lat: SAMPLE_PRIYA.lat, lon: SAMPLE_PRIYA.lon });
    expect(file.days.length).toBe(7);
    // The Upcoming strip's first card for Priya on 2026-10-22 (engine fixed order: family tithi first), in Hindi.
    expect(file.nextEvent).toBe(expectedNextEvent('hi'));
    expect(file.nextEvent).toContain(' · ');
    expect(file.nextEvent).toMatch(/23/);
    // Same observer + language within 10 minutes: no rewrite; force or a new language writes again.
    expect((await writeWidgetState({ nowMs: NOW + 60_000, deps })).skipped).toBe('unchanged');
    expect((await writeWidgetState({ nowMs: NOW + 60_000, deps, lang: 'en' })).written).toBe(true);
    expect((await readWidgetState(deps))!.lang).toBe('en');
    expect((await writeWidgetState({ nowMs: NOW + 120_000, deps, lang: 'en', force: true })).written).toBe(true);
  });

  it('uses the observer handed in by Today (device fix) and the English upcoming line matches the strip', async () => {
    insertProfile(SAMPLE_PRIYA, new Date(NOW));
    const deps = memoryDeps();
    const r = await writeWidgetState({ nowMs: NOW, deps, lang: 'en', observer: { ...DELHI, placeName: null, source: 'gps' } });
    expect(r.written).toBe(true);
    const file = r.file!;
    expect(file.location.name).toBeNull();
    expect(file.location.lat).toBe(DELHI.lat);
    expect(file.nextEvent).toBe(expectedNextEvent('en'));
    expect(getSelfProfile()).not.toBeNull();
    expect(chartFor(getSelfProfile()!).meta.ayanamsa).toBe('lahiri');
  });

  it('readWidgetState rejects other versions and broken JSON', async () => {
    const deps = memoryDeps();
    deps.text = 'nope';
    expect(await readWidgetState(deps)).toBeNull();
    deps.text = JSON.stringify({ version: 2, days: [] });
    expect(await readWidgetState(deps)).toBeNull();
  });

  it('dev route clocks produce a stale and an exhausted file for the C05 shots', async () => {
    insertProfile(SAMPLE_PRIYA, new Date(NOW));
    expect(NOW - devWidgetClock('stale', NOW)).toBe(40 * H);
    expect(NOW - devWidgetClock('exhausted', NOW)).toBe(9 * 24 * H);
    // writeDevWidgetState uses the platform deps (no-op off Android): it must not throw, and it reports why.
    const r = await writeDevWidgetState('stale', NOW);
    expect(r.written).toBe(false);
    expect(r.skipped).toBe('unsupported');
    // The same clocks through memory deps give the two footer states at NOW.
    const deps = memoryDeps();
    await writeWidgetState({ nowMs: devWidgetClock('stale', NOW), deps, force: true });
    expect(resolveWidgetState(await readWidgetState(deps), NOW).status).toBe('stale');
    await writeWidgetState({ nowMs: devWidgetClock('exhausted', NOW), deps, force: true });
    expect(resolveWidgetState(await readWidgetState(deps), NOW).status).toBe('exhausted');
  });
});
