// Reminder planner + scheduler (F25, N12): occurrences only for enabled series, two notifications per occurrence at the
// per-kind default times (19:00 evening before / 07:00 morning of, profile zone), past instants dropped, nearest first,
// capped at 300; applyPlan records ids and per-series failures; replanAll schedules nothing without permission and
// nothing when no series is enabled (quiet by default).
import { formatInZone } from '@shubhvela/engine';
import { listEnabledSeries, setSeriesEnabled } from '../src/db/eventSeries';
import { getProfile, insertProfile } from '../src/db/profiles';
import { DEFAULT_REMINDER_TIMES, getFailedSeries, getReminderTime, setReminderTime } from '../src/db/reminderSettings';
import { countScheduled, listScheduledDetailed } from '../src/db/scheduled';
import { insertAncestor } from '../src/db/ancestors';
import { SAMPLE_DADAJI, SAMPLE_PRIYA } from '../src/dev/seed';
import { chartFor } from '../src/engine-bridge/charts';
import { HORIZON_DAYS, MAX_SCHEDULED, planNotifications, planOccurrences, type PlannerInput } from '../src/notifications/planner';
import { applyPlan, plannerInputFromDb, replanAll, type ScheduleDeps } from '../src/notifications/schedule';
import { installTestDb } from './helpers/nodeDb';

const NOW = Date.UTC(2026, 9, 22, 5, 28); // Thu 22 Oct 2026 10:58 IST
const TZ = 'Asia/Kolkata';

function fakeDeps(failKeys: string[] = []): ScheduleDeps & { scheduled: string[]; cancelled: number } {
  const d = {
    scheduled: [] as string[],
    cancelled: 0,
    async ensureChannel() {},
    async cancelAll() {
      d.cancelled++;
    },
    async schedule(n: { key: string; date: string; slot: string }) {
      if (failKeys.includes(n.key)) throw new Error('OS refused');
      d.scheduled.push(`${n.key}|${n.date}|${n.slot}`);
      return `id-${d.scheduled.length}`;
    },
  };
  return d;
}

describe('planner', () => {
  let close: () => void;
  let priyaId: number;
  let dadajiId: number;
  beforeEach(() => {
    ({ close } = installTestDb());
    priyaId = insertProfile(SAMPLE_PRIYA, new Date(NOW));
    dadajiId = insertAncestor(SAMPLE_DADAJI);
  });
  afterEach(() => close());

  function input(over: Partial<PlannerInput> = {}): PlannerInput {
    const p = getProfile(priyaId)!;
    return {
      nowMs: NOW,
      geo: { lat: p.lat, lon: p.lon },
      tz: TZ,
      lang: 'en',
      tradition: 'purnimanta',
      profiles: [],
      ancestors: [],
      vratFamilies: [],
      times: DEFAULT_REMINDER_TIMES,
      ...over,
    };
  }

  it('plans nothing when no series is enabled (quiet by default)', () => {
    expect(planOccurrences(input())).toEqual([]);
    expect(planNotifications(input())).toEqual([]);
  });

  it('plans every Ekadashi of the next 60 days with evening-before 19:00 and morning-of 07:00 in the profile zone, nearest first', () => {
    const plan = planNotifications(input({ vratFamilies: ['ekadashi'] }));
    expect(plan.length).toBeGreaterThanOrEqual(6);
    expect(plan.length).toBeLessThanOrEqual(12);
    for (const n of plan) {
      expect(n.fireAtMs).toBeGreaterThan(NOW);
      expect(n.kind).toBe('vrat_family');
      expect(n.key).toBe('vrat_family:ekadashi');
      const hhmm = formatInZone(n.fireAtMs, TZ, 'HH:mm');
      const day = formatInZone(n.fireAtMs, TZ, 'yyyy-MM-dd');
      if (n.slot === 'evening') {
        expect(hhmm).toBe('19:00');
        expect(day < n.date).toBe(true);
      } else {
        expect(hhmm).toBe('07:00');
        expect(day).toBe(n.date);
      }
      expect(n.title).toBe('Vrats');
      expect(n.body).toMatch(/Ekadashi (tomorrow|today) · Parana \d\d:\d\d/);
    }
    for (let i = 1; i < plan.length; i++) expect(plan[i].fireAtMs).toBeGreaterThanOrEqual(plan[i - 1].fireAtMs);
    // Today's Papankusha Ekadashi (22 Oct) has both slots in the past at 10:58 IST: not planned.
    expect(plan.find((n) => n.date === '2026-10-22')).toBeUndefined();
  });

  it('uses the edited per-kind time and includes janma-tithi and barsi occurrences when they fall in the horizon', () => {
    const p = getProfile(priyaId)!;
    // Priya's janma tithi is 2027-03-23 (outside 60 days from 22 Oct); shift the clock to 1 Mar 2027 to catch it.
    const march = Date.UTC(2027, 2, 1, 5, 0);
    const occ = planOccurrences(input({ nowMs: march, profiles: [{ id: p.id, name: p.name, relationLabel: 'Me', chart: chartFor(p), tradition: p.tradition }] }));
    const janma = occ.find((o) => o.kind === 'tithi_birthday');
    expect(janma?.date).toBe('2027-03-23');
    expect(janma?.name).toBe('Priya');
    const times = { ...DEFAULT_REMINDER_TIMES, tithi_birthday: { evening: '20:30', morning: '06:15' } };
    const plan = planNotifications(input({ nowMs: march, times, profiles: [{ id: p.id, name: p.name, relationLabel: 'Me', chart: chartFor(p), tradition: p.tradition }] }));
    const evening = plan.find((n) => n.kind === 'tithi_birthday' && n.slot === 'evening')!;
    const morning = plan.find((n) => n.kind === 'tithi_birthday' && n.slot === 'morning')!;
    expect(formatInZone(evening.fireAtMs, TZ, 'yyyy-MM-dd HH:mm')).toBe('2027-03-22 20:30');
    expect(formatInZone(morning.fireAtMs, TZ, 'yyyy-MM-dd HH:mm')).toBe('2027-03-23 06:15');
    expect(evening.body).toMatch(/^Priya's janma tithi is tomorrow \(Tue 23 Mar 2027\) · /);
    expect(morning.body).toMatch(/^Today is Priya's janma tithi · /);
    // Dadaji (Ashwin Krishna Dashami, Purnimanta) died inside Pitru Paksha: his barsi IS his Pitru Paksha day, so the
    // series fires once for that day (no duplicate row).
    const sep = Date.UTC(2027, 8, 1, 5, 0);
    const barsi = planOccurrences(input({ nowMs: sep, ancestors: [{ id: dadajiId, name: 'Dadaji', deathMonth: 6, paksha: 'krishna', tithi: 10, year: null }] }));
    expect(barsi.length).toBe(1);
    expect(barsi[0]).toMatchObject({ kind: 'barsi', key: `barsi:${dadajiId}`, name: 'Dadaji' });
    expect(barsi[0].pitruPaksha).toBeUndefined();
    // An ancestor who died in Magha gets a barsi in Jan/Feb AND a Pitru Paksha day in Sep/Oct: from 1 Sep 2027 only the
    // Pitru Paksha day is inside the 60-day horizon.
    const dadi = planOccurrences(input({ nowMs: sep, ancestors: [{ id: 99, name: 'Kamla Devi', deathMonth: 10, paksha: 'krishna', tithi: 9, year: 2001 }] }));
    expect(dadi.length).toBe(1);
    expect(dadi[0]).toMatchObject({ kind: 'barsi', key: 'barsi:99', pitruPaksha: true, name: 'Kamla Devi' });
    expect(dadi[0].date.startsWith('2027-09') || dadi[0].date.startsWith('2027-10')).toBe(true);
  });

  it('caps the plan at 300 nearest-first (N12) and keeps the daily note opt-in', () => {
    expect(MAX_SCHEDULED).toBe(300);
    expect(HORIZON_DAYS).toBe(60);
    const none = planNotifications(input({ dailyNote: { enabled: false, time: '07:00' } }));
    expect(none).toEqual([]);
    const daily = planNotifications(input({ dailyNote: { enabled: true, time: '07:00' }, horizonDays: 400 }));
    expect(daily.length).toBe(300);
    for (let i = 1; i < daily.length; i++) expect(daily[i].fireAtMs).toBeGreaterThan(daily[i - 1].fireAtMs);
    expect(daily[0].date).toBe('2026-10-23'); // today's 07:00 is past at 10:58 IST
    expect(daily.every((n) => n.kind === 'daily_note' && formatInZone(n.fireAtMs, TZ, 'HH:mm') === '07:00')).toBe(true);
    const capped = planNotifications(input({ dailyNote: { enabled: true, time: '07:00' }, cap: 20 }));
    expect(capped.length).toBe(20);
  });

  it('applyPlan cancels everything first, records ids in `scheduled` and marks a refused series "not scheduled"', async () => {
    setSeriesEnabled('vrat_family', 'ekadashi', true);
    setSeriesEnabled('vrat_family', 'pradosh', true);
    const plan = planNotifications(input({ vratFamilies: ['ekadashi', 'pradosh'] }));
    const deps = fakeDeps(['vrat_family:pradosh']);
    const r = await applyPlan(plan, 'en', deps);
    expect(deps.cancelled).toBe(1);
    expect(r.planned).toBe(plan.length);
    expect(r.failed).toEqual(['vrat_family:pradosh']);
    expect(r.scheduled).toBe(plan.filter((n) => n.key === 'vrat_family:ekadashi').length);
    expect(countScheduled()).toBe(r.scheduled);
    expect(getFailedSeries()).toEqual(['vrat_family:pradosh']);
    const detailed = listScheduledDetailed(5);
    expect(detailed[0]).toEqual({ fireAt: new Date(plan.find((n) => n.key === 'vrat_family:ekadashi')!.fireAtMs).toISOString(), kind: 'vrat_family', refId: 'ekadashi' });
  });

  it('replanAll schedules nothing without permission, nothing with no enabled series, and the plan otherwise', async () => {
    const denied = fakeDeps();
    const r1 = await replanAll({ nowMs: NOW, lang: 'en', deps: denied, permission: async () => 'denied' });
    expect(r1).toEqual({ scheduled: 0, failed: [], skipped: 'permission', planned: 0 });
    expect(denied.scheduled).toEqual([]);
    const quiet = fakeDeps();
    const r2 = await replanAll({ nowMs: NOW, lang: 'en', deps: quiet, permission: async () => 'granted' });
    expect(r2.planned).toBe(0);
    expect(r2.scheduled).toBe(0);
    expect(quiet.scheduled).toEqual([]);
    setSeriesEnabled('vrat_family', 'sankashti', true);
    setReminderTime('vrat_family', 'evening', '18:00');
    expect(getReminderTime('vrat_family', 'evening')).toBe('18:00');
    const live = fakeDeps();
    const r3 = await replanAll({ nowMs: NOW, lang: 'en', deps: live, permission: async () => 'granted' });
    expect(r3.planned).toBeGreaterThan(0);
    expect(r3.scheduled).toBe(r3.planned);
    expect(live.scheduled.every((s) => s.startsWith('vrat_family:sankashti|'))).toBe(true);
    const fromDb = plannerInputFromDb(NOW, 'en')!;
    expect(fromDb.vratFamilies).toEqual(['sankashti']);
    expect(fromDb.times.vrat_family.evening).toBe('18:00');
    expect(listEnabledSeries().map((s) => s.refId)).toEqual(['sankashti']);
  });
});
