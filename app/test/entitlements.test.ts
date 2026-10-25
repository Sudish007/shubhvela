// entitlements.ts caps (spec section 9): 2 profiles, 5 enabled reminder series (tithi birthdays + ancestors + vrat
// families all count; ancestors never count toward profiles), Pro-only features refused, rewarded unlocks honoured until
// expiry, Pro lifts every cap.
import { FREE_PROFILE_CAP, FREE_REMINDER_SERIES_CAP, canAddProfile, canAddReminder, canSeeFeature, isPro } from '../src/entitlements';
import { countAncestors, insertAncestor } from '../src/db/ancestors';
import { countEnabledSeries, enabledVratFamilies, listEnabledSeries, seriesKey, setSeriesEnabled } from '../src/db/eventSeries';
import { countProfiles, insertProfile } from '../src/db/profiles';
import { SAMPLE_AMMA, SAMPLE_DADAJI, SAMPLE_PRIYA } from '../src/dev/seed';
import { installTestDb } from './helpers/nodeDb';

describe('entitlements', () => {
  let close: () => void;
  let db: ReturnType<typeof installTestDb>['db'];
  beforeEach(() => {
    ({ db, close } = installTestDb());
  });
  afterEach(() => close());

  it('is not Pro in Phase A (empty entitlement cache)', () => {
    expect(isPro()).toBe(false);
  });

  it('allows 2 profiles on free and refuses the 3rd with an explanation', () => {
    expect(FREE_PROFILE_CAP).toBe(2);
    expect(canAddProfile(0)).toEqual({ allowed: true, cap: 2 });
    expect(canAddProfile(1)).toEqual({ allowed: true, cap: 2 });
    expect(canAddProfile(2)).toEqual({ allowed: false, reason: 'pro_profiles', cap: 2 });
  });

  it('counts 5 enabled series incl. ancestors and vrat families, then refuses the 6th', () => {
    expect(FREE_REMINDER_SERIES_CAP).toBe(5);
    setSeriesEnabled('tithi_birthday', '1', true);
    setSeriesEnabled('tithi_birthday', '2', true);
    setSeriesEnabled('barsi', '1', true);
    setSeriesEnabled('vrat_family', 'ekadashi', true);
    expect(canAddReminder(countEnabledSeries())).toEqual({ allowed: true, cap: 5 });
    setSeriesEnabled('vrat_family', 'sankashti', true);
    expect(countEnabledSeries()).toBe(5);
    expect(canAddReminder(countEnabledSeries())).toEqual({ allowed: false, reason: 'pro_reminders', cap: 5 });
    // Disabling one frees a slot (only ENABLED series count).
    setSeriesEnabled('barsi', '1', false);
    expect(canAddReminder(countEnabledSeries()).allowed).toBe(true);
  });

  it('A12: 2 tithi birthdays + 2 ancestors (barsi incl. Pitru Paksha) + 1 vrat family = 5; the 6th is refused', () => {
    const p1 = insertProfile(SAMPLE_PRIYA);
    const p2 = insertProfile(SAMPLE_AMMA);
    const a1 = insertAncestor(SAMPLE_DADAJI);
    const a2 = insertAncestor({ ...SAMPLE_DADAJI, name: 'Dadi', relation: 'grandmother', deathMonth: 10, paksha: 'krishna', tithi: 9 });
    setSeriesEnabled('tithi_birthday', String(p1), true);
    setSeriesEnabled('tithi_birthday', String(p2), true);
    setSeriesEnabled('barsi', String(a1), true);
    setSeriesEnabled('barsi', String(a2), true);
    setSeriesEnabled('vrat_family', 'ekadashi', true);
    expect(countEnabledSeries()).toBe(5);
    expect(canAddReminder(countEnabledSeries())).toEqual({ allowed: false, reason: 'pro_reminders', cap: 5 });
    expect(enabledVratFamilies()).toEqual(['ekadashi']);
    expect(listEnabledSeries().map((s) => seriesKey(s.kind, s.refId)).sort()).toEqual([`barsi:${a1}`, `barsi:${a2}`, `tithi_birthday:${p1}`, `tithi_birthday:${p2}`, 'vrat_family:ekadashi'].sort());
  });

  it('ancestors never count toward the profile cap (M16)', () => {
    insertProfile(SAMPLE_PRIYA);
    insertProfile(SAMPLE_AMMA);
    insertAncestor(SAMPLE_DADAJI);
    insertAncestor({ ...SAMPLE_DADAJI, name: 'Dadi' });
    insertAncestor({ ...SAMPLE_DADAJI, name: 'Nana' });
    expect(countProfiles()).toBe(2);
    expect(countAncestors()).toBe(3);
    expect(canAddProfile(countProfiles())).toEqual({ allowed: false, reason: 'pro_profiles', cap: 2 });
    // Adding a fourth ancestor needs no entitlement decision at all.
    expect(() => insertAncestor({ ...SAMPLE_DADAJI, name: 'Nani' })).not.toThrow();
    expect(countAncestors()).toBe(4);
    expect(countProfiles()).toBe(2);
  });

  it('gates Pro features and honours an unexpired rewarded unlock', () => {
    const now = new Date('2026-10-25T12:00:00Z');
    expect(canSeeFeature('kp', now)).toEqual({ allowed: false, reason: 'pro_feature' });
    expect(canSeeFeature('ask_my_chart', now)).toEqual({ allowed: false, reason: 'pro_feature' });
    db.runSync("INSERT INTO unlocks (feature, expires_at) VALUES ('kp', ?)", [new Date(now.getTime() + 3600_000).toISOString()]);
    expect(canSeeFeature('kp', now).allowed).toBe(true);
    expect(canSeeFeature('kp', new Date(now.getTime() + 2 * 3600_000)).allowed).toBe(false);
    // ask_my_chart is never rewarded-unlockable.
    db.runSync("INSERT INTO unlocks (feature, expires_at) VALUES ('ask_my_chart', ?)", [new Date(now.getTime() + 3600_000).toISOString()]);
    expect(canSeeFeature('ask_my_chart', now).allowed).toBe(false);
  });

  it('Pro lifts every cap', () => {
    db.runSync("INSERT INTO entitlements (product, token, state, updated_at) VALUES ('shubhvela_pro', 't', 'active', '2026-10-25T00:00:00Z')");
    expect(isPro()).toBe(true);
    expect(canAddProfile(99)).toEqual({ allowed: true });
    expect(canAddReminder(99)).toEqual({ allowed: true });
    expect(canSeeFeature('ask_my_chart')).toEqual({ allowed: true });
  });
});
