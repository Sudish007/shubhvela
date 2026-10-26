// Family tab end to end (fixed clock, seeded household): avatar row + quota line, Family Today rows with Why?, event cards
// (tithi birthday per profile with the relationship in the kind label - N5; barsi + Pitru Paksha per ancestor; vrat
// cards only for enabled families), series switches (on; 6th on free refused with the honest sheet; permission denied
// leaves the switch Off with the settings row; "not scheduled" tag), footer buttons (M7 wording), quiet-by-default
// caption, the B06 Family tools card (M3) and its routes, +30 % pseudo-locale snapshot without truncation.
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import FamilyScreen from '../app/(tabs)/family';
import { insertAncestor } from '../src/db/ancestors';
import { countEnabledSeries, isSeriesEnabled, setSeriesEnabled } from '../src/db/eventSeries';
import { insertProfile } from '../src/db/profiles';
import { setFailedSeries } from '../src/db/reminderSettings';
import { SAMPLE_AMMA, SAMPLE_DADAJI, SAMPLE_PRIYA } from '../src/dev/seed';
import type { UseSeriesOptions } from '../src/family/useSeries';
import { installTestDb } from './helpers/nodeDb';
import { allTexts, renderWithProviders, textOf } from './helpers/render';

const NOW = Date.UTC(2026, 9, 22, 5, 28); // Thu 22 Oct 2026 10:58 IST
const now = () => NOW;
const FIND = { timeout: 25000 };

const granted: UseSeriesOptions = {
  getPermission: async () => 'granted',
  requestPermission: async () => 'granted',
  replan: async () => ({ scheduled: 0, failed: [], planned: 0 }),
};
const denied: UseSeriesOptions = {
  getPermission: async () => 'denied',
  requestPermission: async () => 'denied',
  replan: async () => ({ scheduled: 0, failed: [], planned: 0 }),
};

function assertNoTruncation() {
  for (const tx of allTexts()) expect(tx.props.numberOfLines).toBeUndefined();
}

describe('<FamilyScreen>', () => {
  let close: () => void;
  let priyaId: number;
  let ammaId: number;
  let dadajiId: number;
  beforeEach(() => {
    ({ close } = installTestDb());
    priyaId = insertProfile(SAMPLE_PRIYA, new Date(NOW));
    ammaId = insertProfile(SAMPLE_AMMA, new Date(NOW));
    dadajiId = insertAncestor(SAMPLE_DADAJI);
    (router.push as jest.Mock).mockClear();
  });
  afterEach(() => {
    globalThis.__PSEUDO_LOCALE__ = undefined;
    close();
  });

  it('shows the avatar row, the quota line, Family Today with Why?, one card per profile and ancestor, the footer buttons and nothing from Phase B', async () => {
    await renderWithProviders(<FamilyScreen now={now} seriesOptions={granted} />);
    await screen.findByTestId('family-today', {}, FIND);
    expect(screen.getByTestId(`avatar-${priyaId}`).props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId(`avatar-${ammaId}`).props.accessibilityState.selected).toBe(false);
    expect(screen.getByTestId('avatar-add')).toBeTruthy();
    expect(screen.getByText('Pro · unlimited')).toBeTruthy(); // 2 of 2 on free
    expect(textOf(screen.getByTestId('quota-line'))).toBe('2 of 2 profiles · 0 of 5 reminders (free)');
    expect(textOf(screen.getByTestId('family-date-line'))).toMatch(/^Thu 22 Oct 2026 · Ashwin Shukla Ekadashi$/);
    // F24: one row per profile, Chandra bala + Tara bala from the engine, each with Why?.
    const priyaRow = screen.getByTestId(`family-today-${priyaId}`);
    expect(textOf(priyaRow).replace(/\s+/g, ' ')).toMatch(/^Priya: Moon in the 6th house, Kshema tara/);
    expect(screen.getByTestId(`family-today-${ammaId}`)).toBeTruthy();
    expect(screen.getAllByLabelText(/^Why\? /).length).toBeGreaterThanOrEqual(5);
    // F20 / F21 cards: name is the title, relationship in the kind label (N5).
    const priyaCard = screen.getByTestId(`event-tithi_birthday:${priyaId}`);
    expect(textOf(priyaCard)).toMatch(/TITHI BIRTHDAY · ME · IN \d+ DAYS|Tithi birthday · Me · in \d+ days/);
    expect(textOf(priyaCard)).toMatch(/Priya · janma tithi/);
    expect(textOf(priyaCard)).toMatch(/Chaitra Krishna Pratipada · Tue 23 Mar 2027 · year 29/);
    expect(screen.getByTestId(`event-tithi_birthday:${ammaId}`)).toBeTruthy();
    const dadaji = screen.getByTestId(`event-barsi:${dadajiId}`);
    expect(textOf(dadaji)).toMatch(/Shraddha · barsi · ancestor record/);
    expect(textOf(dadaji)).toMatch(/Dadaji \(Grandfather\)/);
    expect(textOf(dadaji)).toMatch(/Ashwin Krishna Dashami/);
    expect(textOf(dadaji)).toMatch(/Pitru Paksha/);
    // Every switch Off (quiet by default), no vrat card without an enabled family.
    for (const sw of screen.getAllByRole('switch')) expect(sw.props.accessibilityState.checked).toBe(false);
    expect(screen.queryByTestId(/^event-vrat_family:/)).toBeNull();
    // City card + Panchang pill, footer buttons (M7), caption.
    expect(textOf(screen.getByTestId('city-sun-line'))).toMatch(/^Sunrise \d\d:\d\d · Sunset \d\d:\d\d$/);
    expect(screen.getByTestId('city-panchang')).toBeTruthy();
    expect(screen.getByText('Add family member')).toBeTruthy();
    expect(screen.getByText('Add shraddha')).toBeTruthy();
    expect(screen.getByText('Add vrat')).toBeTruthy();
    expect(screen.queryByText('Add tithi birthday')).toBeNull();
    expect(textOf(screen.getByTestId('family-footer'))).toMatch(/Quiet by default/);
    // B06 (M3): the Family tools card sits after the event cards with its three rows; "profile menu" wording nowhere.
    expect(screen.getByText('Family tools')).toBeTruthy();
    expect(screen.getByTestId('tools-match').props.accessibilityLabel).toBe('Match two profiles');
    expect(screen.getByTestId('tools-share').props.accessibilityLabel).toBe('Share for matching');
    expect(screen.getByTestId('tools-naamkaran').props.accessibilityLabel).toBe('Name syllables');
    expect(screen.queryByText(/profile menu/i)).toBeNull();
    expect(screen.queryByText('Ad')).toBeNull();
    assertNoTruncation();
    await fireEvent.press(screen.getByTestId('add-shraddha'));
    expect(router.push).toHaveBeenCalledWith('/family/ancestor/new');
    await fireEvent.press(screen.getByTestId('add-vrat'));
    expect(router.push).toHaveBeenCalledWith('/settings/vrats');
    await fireEvent.press(screen.getByTestId('open-calendar'));
    expect(router.push).toHaveBeenCalledWith('/family/calendar');
    await fireEvent.press(screen.getByTestId('tools-match'));
    expect(router.push).toHaveBeenCalledWith('/family/match');
    await fireEvent.press(screen.getByTestId('tools-naamkaran'));
    expect(router.push).toHaveBeenCalledWith('/family/naamkaran');
    // Share for matching opens the share-code sheet for the self profile: QR + 20-char code + the privacy copy.
    await fireEvent.press(screen.getByTestId('tools-share'));
    expect(textOf(screen.getByTestId('share-privacy'))).toBe('This code contains birth date, time and place but no name.');
    expect(textOf(screen.getByTestId('share-code'))).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){4}$/);
    expect(textOf(screen.getByTestId('share-for'))).toBe('Code for Priya');
    await fireEvent.press(screen.getByTestId('avatar-add'));
    expect(screen.getByText('Free plan: two profiles')).toBeTruthy(); // 3rd profile refused with the honest sheet
  });

  it('switching a series on persists it and updates the quota line; an enabled vrat family gets a card with its key time', async () => {
    setSeriesEnabled('vrat_family', 'ekadashi', true);
    await renderWithProviders(<FamilyScreen now={now} seriesOptions={granted} />);
    await screen.findByTestId('family-today', {}, FIND);
    const vrat = screen.getByTestId('event-vrat_family:ekadashi');
    expect(textOf(vrat)).toMatch(/Ekadashi/);
    expect(textOf(vrat)).toMatch(/Parana \d\d:\d\d\u2060\u2013\u2060\d\d:\d\d/);
    expect(textOf(vrat)).toMatch(/What to do: /);
    expect(screen.getByTestId('event-vrat_family:ekadashi-switch').props.accessibilityState.checked).toBe(true);
    expect(textOf(screen.getByTestId('quota-line'))).toBe('2 of 2 profiles · 1 of 5 reminders (free)');
    const sw = screen.getByTestId(`event-tithi_birthday:${priyaId}-switch`);
    expect(sw.props.accessibilityState.checked).toBe(false);
    await fireEvent.press(sw);
    await waitFor(() => expect(screen.getByTestId(`event-tithi_birthday:${priyaId}-switch`).props.accessibilityState.checked).toBe(true), FIND);
    expect(isSeriesEnabled('tithi_birthday', String(priyaId))).toBe(true);
    await waitFor(() => expect(textOf(screen.getByTestId('quota-line'))).toBe('2 of 2 profiles · 2 of 5 reminders (free)'), FIND);
    // Off again.
    await fireEvent.press(screen.getByTestId(`event-tithi_birthday:${priyaId}-switch`));
    await waitFor(() => expect(isSeriesEnabled('tithi_birthday', String(priyaId))).toBe(false), FIND);
  });

  it('the 6th enabled series on free opens the honest Pro sheet and the switch stays Off', async () => {
    setSeriesEnabled('tithi_birthday', String(priyaId), true);
    setSeriesEnabled('barsi', String(dadajiId), true);
    setSeriesEnabled('vrat_family', 'ekadashi', true);
    setSeriesEnabled('vrat_family', 'pradosh', true);
    setSeriesEnabled('vrat_family', 'sankashti', true);
    await renderWithProviders(<FamilyScreen now={now} seriesOptions={granted} />);
    await screen.findByTestId('family-today', {}, FIND);
    expect(textOf(screen.getByTestId('quota-line'))).toBe('2 of 2 profiles · 5 of 5 reminders (free)');
    const sw = screen.getByTestId(`event-tithi_birthday:${ammaId}-switch`);
    await fireEvent.press(sw);
    await screen.findByText('Free plan: five reminder series', {}, FIND);
    expect(screen.getByTestId(`event-tithi_birthday:${ammaId}-switch`).props.accessibilityState.checked).toBe(false);
    expect(isSeriesEnabled('tithi_birthday', String(ammaId))).toBe(false);
    expect(countEnabledSeries()).toBe(5);
  });

  it('permission denied: the switch stays Off and the "Allow notifications in Android settings" row appears; a refused series carries "not scheduled"', async () => {
    setSeriesEnabled('vrat_family', 'ekadashi', true);
    setFailedSeries(['vrat_family:ekadashi']);
    await renderWithProviders(<FamilyScreen now={now} seriesOptions={denied} />);
    await screen.findByTestId('family-today', {}, FIND);
    await screen.findByTestId('permission-row', {}, FIND);
    expect(screen.getByText('Allow notifications in Android settings')).toBeTruthy();
    const sw = screen.getByTestId(`event-tithi_birthday:${priyaId}-switch`);
    await fireEvent.press(sw);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByTestId(`event-tithi_birthday:${priyaId}-switch`).props.accessibilityState.checked).toBe(false);
    expect(isSeriesEnabled('tithi_birthday', String(priyaId))).toBe(false);
    expect(screen.getByText('not scheduled')).toBeTruthy();
  });

  it('+30 % pseudo-locale (en) renders every string whole', async () => {
    globalThis.__PSEUDO_LOCALE__ = true;
    const tree = await renderWithProviders(<FamilyScreen now={now} seriesOptions={granted} />);
    await screen.findByTestId('family-today', {}, FIND);
    assertNoTruncation();
    expect(screen.getAllByText(/^Add family member x+$/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Dates and reminders x+$/).length).toBe(1);
    expect(tree.toJSON()).toMatchSnapshot();
  });
});
