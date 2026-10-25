// Today screen end to end (fixed clock, seeded self profile, profile place): header first value + date line, Panchang
// pill -> F8 sheet with every field, good-hours card, daily note, Upcoming, "All 13 segments" expanding in place, no
// Listen button and no ad box; +30 % pseudo-locale snapshot with no truncation and no split time range (N4).
import { fireEvent, screen } from '@testing-library/react-native';
import TodayScreen from '../app/(tabs)/today';
import { SAMPLE_PRIYA } from '../src/dev/seed';
import { insertProfile, setProfileIntent } from '../src/db/profiles';
import { installTestDb } from './helpers/nodeDb';
import { allTexts, renderWithProviders, textOf } from './helpers/render';

const NOW = Date.UTC(2026, 9, 22, 5, 28); // Thu 22 Oct 2026 10:58 IST
const todayOptions = { now: () => NOW };
const FIND = { timeout: 20000 };

function assertNoTruncation() {
  for (const tx of allTexts()) expect(tx.props.numberOfLines).toBeUndefined();
}

/** Every "HH:mm–HH:mm" in a rendered Text must be glued (U+2060 around the dash, no breakable space). */
function assertRangesGlued() {
  const WJ = '\u2060';
  const unglued: string[] = [];
  for (const tx of allTexts()) {
    const s = textOf(tx);
    for (const m of s.matchAll(/\d{1,2}:\d{2}[\s\u2060]*[\u2013\u2014-][\s\u2060]*\d{1,2}:\d{2}/g)) {
      if (!m[0].includes(WJ) || /\s/.test(m[0])) unglued.push(`"${m[0]}" in "${s}"`);
    }
  }
  expect(unglued).toEqual([]);
}

describe('<TodayScreen>', () => {
  let close: () => void;
  let selfId: number;
  beforeEach(() => {
    ({ close } = installTestDb());
    selfId = insertProfile(SAMPLE_PRIYA, new Date(NOW));
  });
  afterEach(() => {
    globalThis.__PSEUDO_LOCALE__ = undefined;
    close();
  });

  it('shows the first value, the date line, the band card, the note, Upcoming and no fake controls', async () => {
    await renderWithProviders(<TodayScreen todayOptions={todayOptions} />);
    expect(screen.getByTestId('today-screen')).toBeTruthy();
    await screen.findByTestId('good-hours-card', {}, FIND);
    expect(textOf(screen.getByTestId('today-moon-line'))).toMatch(/^Your Moon: \S+ · /);
    expect(textOf(screen.getByTestId('today-date-line'))).toMatch(/^Thu 22 Oct 2026 · \S+ (Shukla|Krishna) /);
    expect(textOf(screen.getByTestId('sun-line'))).toMatch(/^Sunrise \d\d:\d\d · Sunset \d\d:\d\d · /);
    expect(screen.getByTestId('now-line-text')).toBeTruthy();
    expect(textOf(screen.getByTestId('flags-line'))).toMatch(/^Flags · /);
    expect(screen.getByTestId('legend')).toBeTruthy();
    expect(screen.getByTestId('daily-note')).toBeTruthy();
    expect(screen.getByTestId('upcoming')).toBeTruthy();
    expect(screen.getByTestId('place-pill')).toBeTruthy();
    expect(screen.queryByText('Listen')).toBeNull();
    expect(screen.queryByText('Ad')).toBeNull();
    expect(screen.queryByTestId('native-ad-slot')).toBeNull();
    expect(screen.queryByTestId('today-skeleton')).toBeNull();
    assertNoTruncation();
    assertRangesGlued();
  });

  it('"All 13 segments" expands the list in place and the button then reads "Hide segments"', async () => {
    await renderWithProviders(<TodayScreen todayOptions={todayOptions} />);
    await screen.findByTestId('good-hours-card', {}, FIND);
    const toggle = screen.getByTestId('segments-toggle');
    expect(toggle.props.accessibilityState.expanded).toBe(false);
    expect(screen.getByText('All 13 segments')).toBeTruthy();
    expect(screen.queryByTestId('segment-list')).toBeNull();
    await fireEvent.press(toggle);
    expect(screen.getByTestId('segment-list')).toBeTruthy();
    expect(screen.getByText('Hide segments')).toBeTruthy();
    expect(screen.getByTestId('segments-toggle').props.accessibilityState.expanded).toBe(true);
    expect(screen.getAllByTestId(/^segment-row-/).length).toBe(21);
    assertRangesGlued();
  });

  it('the Panchang pill opens the F8 sheet with every spec field and its computed footer', async () => {
    await renderWithProviders(<TodayScreen todayOptions={todayOptions} />);
    await screen.findByTestId('good-hours-card', {}, FIND);
    await fireEvent.press(screen.getByTestId('panchang-pill'));
    // The pill and the sheet title (Tiro, role header) both read "Panchang".
    expect(screen.getAllByText('Panchang').length).toBe(2);
    expect(screen.getByRole('header', { name: 'Panchang' })).toBeTruthy();
    expect(textOf(screen.getByTestId('panchang-header'))).toMatch(/^Thu 22 Oct 2026 · .+ · Sunrise \d\d:\d\d$/);
    for (const label of ['Tithi', 'Nakshatra', 'Yoga', 'Karana', 'Samvat', 'Month', 'Sun · Moon', 'Moonrise · Moonset', 'Segments']) expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByText(/^Vikram \d{4} · Shaka \d{4}$/)).toBeTruthy();
    expect(screen.getByText(/\(Purnimanta and Amanta\) · \S+ ritu · (Uttarayana|Dakshinayana)$/)).toBeTruthy();
    expect(screen.getByText(/^Sun in \S+ · Moon in \S+$/)).toBeTruthy();
    expect(screen.getByText(/^Rahu Kaal .+ · Abhijit .+ · Brahma .+$/)).toBeTruthy();
    expect(screen.getByText('How this was computed')).toBeTruthy();
    expect(screen.getByText(/^Ayanamsa: Lahiri$/)).toBeTruthy();
    // Tithi, nakshatra, yoga and karana each have a Why?.
    expect(screen.getAllByLabelText(/^Why\? (Tithi|Nakshatra|Yoga|Karana):/).length).toBe(4);
    // "All 13" closes the sheet and expands the list in the card.
    await fireEvent.press(screen.getByTestId('panchang-all-segments'));
    expect(screen.getByTestId('segment-list')).toBeTruthy();
  });

  it('every daily-note row and the Now line have a working Why? (rule + inputs + source)', async () => {
    await renderWithProviders(<TodayScreen todayOptions={todayOptions} />);
    await screen.findByTestId('daily-note', {}, FIND);
    const rows = screen.getAllByTestId(/^note-row-/);
    expect(rows.length).toBeGreaterThanOrEqual(3);
    const whys = screen.getAllByLabelText(/^Why\? /);
    expect(whys.length).toBeGreaterThanOrEqual(rows.length + 1);
    await fireEvent.press(whys[0]);
    expect(screen.getByText('Rule')).toBeTruthy();
    expect(screen.getByText('Inputs')).toBeTruthy();
    expect(screen.getByText('Source')).toBeTruthy();
  });

  it('"Family dates" intent moves Upcoming above the note', async () => {
    setProfileIntent(selfId, 'familyDates');
    await renderWithProviders(<TodayScreen todayOptions={todayOptions} />);
    await screen.findByTestId('daily-note', {}, FIND);
    const root = screen.getByTestId('screen-scroll');
    const ids: string[] = [];
    const walk = (n: { props?: { testID?: string }; children?: readonly unknown[] }) => {
      if (n.props?.testID && ['upcoming', 'daily-note', 'good-hours-card'].includes(n.props.testID)) ids.push(n.props.testID);
      for (const c of n.children ?? []) if (typeof c === 'object' && c) walk(c as { props?: { testID?: string }; children?: readonly unknown[] });
    };
    walk(root);
    expect(ids).toEqual(['good-hours-card', 'upcoming', 'daily-note']);
  });

  for (const lang of ['en', 'hi', 'bho'] as const) {
    it(`pseudo-locale +30 % (${lang}): nothing truncates and no time range splits`, async () => {
      globalThis.__PSEUDO_LOCALE__ = true;
      const tree = await renderWithProviders(<TodayScreen todayOptions={todayOptions} />, { lang });
      await screen.findByTestId('good-hours-card', {}, FIND);
      assertNoTruncation();
      assertRangesGlued();
      expect(allTexts().length).toBeGreaterThan(40);
      // The collapsed stack is the snapshot; the expanded list is checked for truncation and split ranges only.
      if (lang === 'en') expect(tree.toJSON()).toMatchSnapshot();
      await fireEvent.press(screen.getByTestId('segments-toggle'));
      assertNoTruncation();
      assertRangesGlued();
    });
  }
});
