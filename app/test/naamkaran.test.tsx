// FEAT-B05 Naamkaran helper (F28): a profile younger than a year is preselected; the card shows the Moon nakshatra
// pada's syllable first and the nakshatra's other three as chips; tapping a chip lists that syllable's names from the
// corpus in Devanagari + Latin with the "no meaning claimed" note; "Why?" opens the naamkaran-syllable rule; the
// profile editor of a newborn offers the helper row; the Family route is registered.
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { PixelRatio } from 'react-native';
import { naamkaranNames } from '@shubhvela/content';
import { syllablesForChart } from '@shubhvela/engine';
import NaamkaranScreen from '../app/family/naamkaran';
import ProfileEditor from '../app/profile/[id]';
import { getProfile, insertProfile } from '../src/db/profiles';
import { SAMPLE_PRIYA } from '../src/dev/seed';
import { chartFor, clearChartCache } from '../src/engine-bridge/charts';
import { isNewborn, preselect, syllableOrder } from '../src/family/naamkaranModel';
import { nakshatraName } from '../src/today/format';
import { installTestDb } from './helpers/nodeDb';
import { allTexts, renderWithProviders, textOf } from './helpers/render';

const NOW = Date.UTC(2026, 9, 22, 5, 28); // Thu 22 Oct 2026 10:58 IST
const now = () => NOW;

/** Sample newborn: Aarav, born 1 Aug 2026 06:10 in Lucknow (every syllable below is engine output for this chart). */
const NEWBORN = { ...SAMPLE_PRIYA, name: 'Aarav', gender: 'male' as const, birthDate: '2026-08-01', birthTime: '06:10', relationship: 'son' as const, intent: null, isSelf: false };

// Same router mock as test/setup.ts, but useLocalSearchParams reads a mutable object so the editor can open a given id.
const mockParams: { id?: string; profile?: string } = {};
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
  return {
    useRouter: () => mockRouter,
    router: mockRouter,
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
    Redirect: () => null,
    Link: ({ children }: { children?: unknown }) => children ?? null,
    Stack: Object.assign(() => null, { Screen: () => null }),
  };
});

describe('B05 naamkaran helper', () => {
  let close: () => void;
  let priyaId: number;
  let babyId: number;
  beforeEach(() => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1);
    ({ close } = installTestDb());
    clearChartCache();
    (router.push as jest.Mock).mockClear();
    priyaId = insertProfile(SAMPLE_PRIYA, new Date(NOW));
    babyId = insertProfile(NEWBORN, new Date(NOW));
    delete mockParams.profile;
    mockParams.id = String(babyId);
  });
  afterEach(() => {
    globalThis.__PSEUDO_LOCALE__ = undefined;
    close();
  });

  it('isNewborn / preselect: the profile under a year wins over the self profile; the route id wins over both', () => {
    const priya = getProfile(priyaId)!;
    const baby = getProfile(babyId)!;
    expect(isNewborn(baby, NOW)).toBe(true);
    expect(isNewborn(priya, NOW)).toBe(false);
    expect(isNewborn({ birthDate: '2025-10-01' }, NOW)).toBe(false);
    expect(preselect([priya, baby], null, NOW)?.id).toBe(babyId);
    expect(preselect([priya, baby], priyaId, NOW)?.id).toBe(priyaId);
    expect(preselect([priya], null, NOW)?.id).toBe(priyaId);
    const r = syllablesForChart(chartFor(baby));
    const order = syllableOrder(r);
    expect(order.length).toBe(4);
    expect(order[0].pada).toBe(r.pada);
    expect(order[0].devanagari).toBe(r.syllable.devanagari);
    expect(new Set(order.map((s) => s.pada)).size).toBe(4);
  });

  it("the newborn is preselected; the card shows the pada's syllables and names in Devanagari + Latin with a Why?", async () => {
    const baby = getProfile(babyId)!;
    const r = syllablesForChart(chartFor(baby));
    const names = naamkaranNames(r.nakshatra, r.pada, 'en')!;
    await renderWithProviders(<NaamkaranScreen now={now} />);
    expect(screen.getByTestId(`naamkaran-profile-${babyId}`).props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId(`naamkaran-profile-${babyId}`).props.accessibilityLabel).toBe('Aarav, Younger than a year: name syllables suggested');
    expect(screen.getByTestId(`naamkaran-profile-${priyaId}`).props.accessibilityState.selected).toBe(false);
    expect(textOf(screen.getByTestId('naamkaran-for'))).toMatch(new RegExp(`^Aarav · Moon in .+ pada ${r.pada}$`));
    // Four syllable chips, the pada's first and selected; its names listed in both scripts.
    const chips = screen.getAllByTestId(/^syllable-\d$/);
    expect(chips.length).toBe(4);
    expect(chips[0].props.testID).toBe(`syllable-${r.pada}`);
    expect(chips[0].props.accessibilityState.selected).toBe(true);
    expect(chips[0].props.accessibilityLabel).toBe(`Syllable ${r.syllable.devanagari}, ${r.syllable.latin}`);
    expect(names.item.names.length).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < names.item.names.length; i++) {
      const row = screen.getByTestId(`name-${r.pada}-${i}`);
      expect(textOf(row)).toBe(`${names.item.names[i].dev}${names.item.names[i].lat}`);
      expect(names.item.names[i].dev).toMatch(/[\u0900-\u097F]/);
      expect(names.item.names[i].lat).toMatch(/^[A-Za-z]/);
    }
    expect(screen.getByText(`Names beginning with ${names.item.syllable.dev} (${names.item.syllable.lat})`)).toBeTruthy();
    expect(textOf(screen.getByTestId('naamkaran-no-meaning'))).toBe('Names are listed by sound only; no meaning is claimed beyond the syllable rule.');
    // Why? opens the rule sheet with the pada -> syllable table inputs.
    await fireEvent.press(screen.getByLabelText(/^Why\? Suggested starting syllables/));
    expect(screen.getByText(/nama-akshara table assigns one starting syllable/)).toBeTruthy();
    expect(screen.getByText(`${r.syllable.devanagari} (${r.syllable.latin})`)).toBeTruthy();
    for (const tx of allTexts()) expect(tx.props.numberOfLines).toBeUndefined();
  });

  it('tapping another syllable chip lists that pada’s names; switching to Priya recomputes from her Moon', async () => {
    const baby = getProfile(babyId)!;
    const r = syllablesForChart(chartFor(baby));
    const other = syllableOrder(r)[1];
    await renderWithProviders(<NaamkaranScreen now={now} />);
    await fireEvent.press(screen.getByTestId(`syllable-${other.pada}`));
    const names = naamkaranNames(r.nakshatra, other.pada, 'en')!;
    expect(screen.getByTestId(`name-${other.pada}-0`)).toBeTruthy();
    expect(textOf(screen.getByTestId(`name-${other.pada}-0`))).toBe(`${names.item.names[0].dev}${names.item.names[0].lat}`);
    await fireEvent.press(screen.getByTestId(`naamkaran-profile-${priyaId}`));
    const rp = syllablesForChart(chartFor(getProfile(priyaId)!));
    expect(textOf(screen.getByTestId('naamkaran-for'))).toBe(`Priya · Moon in ${nakshatraName('en', rp.nakshatra)} pada ${rp.pada}`);
    expect(screen.getAllByTestId(/^syllable-\d$/)[0].props.testID).toBe(`syllable-${rp.pada}`);
  });

  it("a newborn's profile editor offers the Name syllables row; an adult's does not", async () => {
    await renderWithProviders(<ProfileEditor />);
    const row = screen.getByTestId('profile-naamkaran');
    expect(row.props.accessibilityLabel).toBe('Name syllables');
    await fireEvent.press(row);
    expect(router.push).toHaveBeenCalledWith(`/family/naamkaran?profile=${babyId}`);
    mockParams.id = String(priyaId);
    await renderWithProviders(<ProfileEditor />);
    expect(screen.queryByTestId('profile-naamkaran')).toBeNull();
  });

  it('?profile=<id> on the naamkaran route preselects that profile over the newborn', async () => {
    mockParams.profile = String(priyaId);
    await renderWithProviders(<NaamkaranScreen now={now} />);
    expect(screen.getByTestId(`naamkaran-profile-${priyaId}`).props.accessibilityState.selected).toBe(true);
    const rp = syllablesForChart(chartFor(getProfile(priyaId)!));
    expect(textOf(screen.getByTestId('naamkaran-for'))).toBe(`Priya · Moon in ${nakshatraName('en', rp.nakshatra)} pada ${rp.pada}`);
  });
});
