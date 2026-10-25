// Acceptance slices of F1/F2/F3 that run without a device: the consent gate, the Today first value computed by the
// engine for the seeded sample household (P12), the Family cap sheet on the 3rd profile, the dev-route parser, and
// the birth-form validation + mapping (unknown time -> Moon chart, approximate -> time_approx_minutes).
import { fireEvent, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import FamilyScreen from '../app/(tabs)/family';
import TodayScreen from '../app/(tabs)/today';
import ConsentScreen from '../app/onboarding/consent';
import { needsOnboarding } from '../src/gate';
import { consentAt } from '../src/db/appState';
import { getProfile, getSelfProfile, insertProfile, listProfiles } from '../src/db/profiles';
import { parseDevParams } from '../src/dev/params';
import { SAMPLE_AMMA, SAMPLE_PRIYA, seedSampleState } from '../src/dev/seed';
import { chartFor, moonLine } from '../src/engine-bridge/charts';
import { formToProfile } from '../src/profiles/mapping';
import { EMPTY_FORM, validateForm } from '../src/profiles/validate';
import { installTestDb } from './helpers/nodeDb';
import { renderWithProviders, textOf } from './helpers/render';

describe('flows', () => {
  let close: () => void;
  beforeEach(() => {
    ({ close } = installTestDb());
    (useRouter().push as jest.Mock).mockClear();
    (useRouter().replace as jest.Mock).mockClear();
  });
  afterEach(() => close());

  it('gate: onboarding until consent AND a self profile exist', async () => {
    expect(needsOnboarding()).toBe(true);
    await renderWithProviders(<ConsentScreen />);
    await fireEvent.press(screen.getByTestId('consent-continue'));
    expect(consentAt()).not.toBeNull();
    expect(useRouter().replace).toHaveBeenCalledWith('/onboarding/birth');
    expect(needsOnboarding()).toBe(true);
    insertProfile(SAMPLE_PRIYA);
    expect(needsOnboarding()).toBe(false);
  });

  it('Today shows the engine Moon line for the seeded self profile (A02 truth: Kanya, Uttara Phalguni 4)', async () => {
    seedSampleState({ lang: 'en', theme: 'light', now: new Date('2026-10-25T00:00:00Z') });
    const self = getSelfProfile()!;
    expect(self.name).toBe('Priya');
    const moon = moonLine(chartFor(self), 'en');
    expect(moon.sign).toBe('Kanya');
    expect(moon.nakshatra).toBe('Uttara Phalguni');
    expect(moon.pada).toBe(4);
    await renderWithProviders(<TodayScreen />);
    // The first value is synchronous (before the A10 model finishes computing) ...
    const line = textOf(screen.getByTestId('today-moon-line'));
    expect(line).toContain('Your Moon: Kanya');
    expect(line).toContain('Uttara\u00A0Phalguni\u00A04');
    // ... and the rest of Today (band, note) follows from the same engine without the database being closed under it.
    await screen.findByTestId('good-hours-card', {}, { timeout: 20000 });
  });

  it('F2: unknown time -> Moon chart; approximate -> time_approx_minutes and approx flags', () => {
    const base = EMPTY_FORM({ tradition: 'purnimanta', pdfLanguage: 'en', relationship: 'self' });
    const place = { name: 'Lucknow', admin1: 'Uttar Pradesh', country: 'India', lat: 26.85, lon: 80.95, tz: 'Asia/Kolkata', source: 'gazetteer' as const };
    expect(validateForm({ ...base, birthDate: '1998-03-14', place })).toEqual({ time: true });
    const unknown = formToProfile({ ...base, birthDate: '1998-03-14', place, timeUnknown: true }, { isSelf: true, intent: null });
    expect(unknown.timeUnknown).toBe(true);
    const id = insertProfile(unknown);
    expect(chartFor(getProfile(id)!).moonChart).toBe(true);
    const approx = formToProfile({ ...base, birthDate: '1998-03-14', birthTime: '06:42', place, timeApprox: true, approxMinutes: 60 }, { isSelf: false, intent: null });
    expect(approx.timeApproxMinutes).toBe(60);
    const chart = chartFor(getProfile(insertProfile(approx))!);
    expect(chart.meta.approxMinutes).toBe(60);
    expect(chart.approx.lagna).toBe(true);
  });

  it('F3: the third profile on free opens the honest cap sheet instead of navigating', async () => {
    insertProfile(SAMPLE_PRIYA);
    insertProfile(SAMPLE_AMMA);
    await renderWithProviders(<FamilyScreen />);
    // A12: the quota line reads "2 of 2 profiles Ã‚Â· N of 5 reminders (free)"; the "Add" avatar is the always-present entry.
    expect(screen.getByText(/^2 of 2 profiles/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('avatar-add'));
    expect(useRouter().push).not.toHaveBeenCalled();
    expect(screen.getByText('Free plan: two profiles')).toBeTruthy();
    expect(screen.getByText(/Pro is not in this build yet/)).toBeTruthy();
    expect(listProfiles()).toHaveLength(2);
  });

  it('dev route parameters fall back to en / light / Today', () => {
    expect(parseDevParams({ lang: 'hi', theme: 'dark', screen: 'settings', sample: '1', font: '1.3' })).toEqual({ lang: 'hi', theme: 'dark', screen: '/settings', sample: true, font: '1.3', testReminder: false });
    expect(parseDevParams({ lang: 'xx', theme: 'neon' })).toEqual({ lang: 'en', theme: 'light', screen: '/(tabs)/today', sample: false, font: '1.0', testReminder: false });
    expect(parseDevParams({ test_reminder: '1' }).testReminder).toBe(true);
    expect(parseDevParams({ screen: '/(tabs)/charts', style: 'south' }).style).toBe('south');
    expect(parseDevParams({ style: 'round' }).style).toBeUndefined();
  });
});
