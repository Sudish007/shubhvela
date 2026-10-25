// Settings -> Notifications, Settings -> Vrats and the shraddha editor (A12): default times 19:00 / 07:00 per kind, the
// time picker persists a new time and re-plans, the daily note is opt-in (Off, disabled until permission), "Scheduled"
// is honest (nothing until a series is on), the Vrats screen lists the 12 families with switches and the cap line, the
// ancestor editor validates and saves a record that never touches the profile count. Rows that belong to B04/C01
// ("Dasha change alerts", "Exact widget updates") are not rendered.
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import AncestorEditor, { validateAncestor } from '../app/family/ancestor/[id]';
import NotificationsScreen from '../app/settings/notifications';
import VratsScreen from '../app/settings/vrats';
import { countAncestors, listAncestors } from '../src/db/ancestors';
import { countEnabledSeries, isSeriesEnabled, setSeriesEnabled } from '../src/db/eventSeries';
import { countProfiles, insertProfile } from '../src/db/profiles';
import { getDailyNoteSetting, getReminderTime } from '../src/db/reminderSettings';
import { insertScheduled } from '../src/db/scheduled';
import { SAMPLE_PRIYA } from '../src/dev/seed';
import { makeT } from '../src/i18n';
import { installTestDb } from './helpers/nodeDb';
import { renderWithProviders, textOf } from './helpers/render';

const FIND = { timeout: 20000 };
const NOW = Date.UTC(2026, 9, 22, 5, 28);

describe('<NotificationsScreen>', () => {
  let close: () => void;
  beforeEach(() => {
    ({ close } = installTestDb());
    insertProfile(SAMPLE_PRIYA, new Date(NOW));
  });
  afterEach(() => close());

  it('shows the default 19:00 / 07:00 per kind, the opt-in daily note, the honest Scheduled line, and no B04/C01 rows', async () => {
    const replan = jest.fn(async () => ({ scheduled: 0, failed: [], planned: 0 }));
    await renderWithProviders(<NotificationsScreen getPermission={async () => 'undetermined'} requestPermission={async () => 'granted'} replan={replan} />);
    await screen.findByText('Allow notifications', {}, FIND);
    for (const kind of ['tithi_birthday', 'barsi', 'vrat_family']) {
      expect(screen.getByTestId(`time-${kind}-evening`).props.accessibilityLabel).toBe('Evening before, 19:00');
      expect(screen.getByTestId(`time-${kind}-morning`).props.accessibilityLabel).toBe('Morning of, 07:00');
    }
    const daily = screen.getByTestId('daily-note-switch');
    expect(daily.props.accessibilityState.checked).toBe(false);
    expect(daily.props.accessibilityState.disabled).toBe(true); // no permission yet
    expect(getDailyNoteSetting()).toEqual({ enabled: false, time: '07:00' });
    expect(textOf(screen.getByTestId('scheduled-count'))).toBe('Nothing scheduled: no series is switched on.');
    expect(screen.queryByText(/Dasha change alerts/)).toBeNull();
    expect(screen.queryByText(/Exact widget updates/)).toBeNull();
    // Granting re-plans once.
    await fireEvent.press(screen.getByTestId('permission-button'));
    await waitFor(() => expect(replan).toHaveBeenCalledTimes(1), FIND);
    await screen.findByText('Notifications are allowed for Shubhvela', {}, FIND);
  });

  it('changing a time persists it and re-plans; the Scheduled count reflects the stored rows', async () => {
    insertScheduled([
      { seriesId: 0, fireAt: '2026-10-23T01:30:00.000Z', notificationId: 'a' },
      { seriesId: 0, fireAt: '2026-10-24T01:30:00.000Z', notificationId: 'b' },
    ]);
    const replan = jest.fn(async () => ({ scheduled: 2, failed: [], planned: 2 }));
    const pick = jest.fn((_current: string, onPick: (hhmm: string) => void) => onPick('20:15'));
    await renderWithProviders(<NotificationsScreen getPermission={async () => 'granted'} replan={replan} pickTime={pick} />);
    await screen.findByText('Notifications are allowed for Shubhvela', {}, FIND);
    expect(textOf(screen.getByTestId('scheduled-count'))).toBe('2 notifications planned for the next 60 days');
    expect(screen.getAllByTestId('scheduled-row').length).toBe(2);
    await fireEvent.press(screen.getByTestId('time-barsi-evening'));
    expect(pick).toHaveBeenCalledWith('19:00', expect.any(Function));
    await waitFor(() => expect(getReminderTime('barsi', 'evening')).toBe('20:15'), FIND);
    expect(screen.getByTestId('time-barsi-evening').props.accessibilityLabel).toBe('Evening before, 20:15');
    expect(getReminderTime('tithi_birthday', 'evening')).toBe('19:00');
    await waitFor(() => expect(replan).toHaveBeenCalledTimes(1), FIND);
    await fireEvent.press(screen.getByTestId('daily-note-switch'));
    await waitFor(() => expect(getDailyNoteSetting().enabled).toBe(true), FIND);
    expect(screen.getByTestId('daily-note-time').props.accessibilityLabel).toBe('Morning of, 07:00');
  });
});

describe('<VratsScreen>', () => {
  let close: () => void;
  beforeEach(() => {
    ({ close } = installTestDb());
    insertProfile(SAMPLE_PRIYA, new Date(NOW));
  });
  afterEach(() => close());

  it('lists the 12 families as switches, all Off, with the cap line; switching one on counts one series', async () => {
    const opts = { getPermission: async () => 'granted' as const, requestPermission: async () => 'granted' as const, replan: async () => ({ scheduled: 0, failed: [], planned: 0 }) };
    await renderWithProviders(<VratsScreen seriesOptions={opts} withoutDates />);
    await screen.findByTestId('vrats-screen', {}, FIND);
    const switches = screen.getAllByRole('switch');
    expect(switches.length).toBe(12);
    for (const sw of switches) expect(sw.props.accessibilityState.checked).toBe(false);
    expect(textOf(screen.getByTestId('vrats-count'))).toBe('0 of 5 series on');
    expect(screen.getByText('Karwa Chauth')).toBeTruthy();
    expect(screen.getByText('Sankashti Chaturthi')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('vrat-switch-ekadashi'));
    await waitFor(() => expect(isSeriesEnabled('vrat_family', 'ekadashi')).toBe(true), FIND);
    await waitFor(() => expect(textOf(screen.getByTestId('vrats-count'))).toBe('1 of 5 series on'), FIND);
    expect(countEnabledSeries()).toBe(1);
  });

  it('the 6th family on free opens the honest sheet', async () => {
    for (const f of ['ekadashi', 'pradosh', 'sankashti', 'purnima', 'amavasya']) setSeriesEnabled('vrat_family', f, true);
    const opts = { getPermission: async () => 'granted' as const, requestPermission: async () => 'granted' as const, replan: async () => ({ scheduled: 0, failed: [], planned: 0 }) };
    await renderWithProviders(<VratsScreen seriesOptions={opts} withoutDates />);
    await screen.findByTestId('vrats-screen', {}, FIND);
    await fireEvent.press(screen.getByTestId('vrat-switch-chhath'));
    await screen.findByText('Free plan: five reminder series', {}, FIND);
    expect(isSeriesEnabled('vrat_family', 'chhath')).toBe(false);
  });
});

describe('<AncestorEditor>', () => {
  let close: () => void;
  beforeEach(() => {
    ({ close } = installTestDb());
    insertProfile(SAMPLE_PRIYA, new Date(NOW));
    (router.back as jest.Mock).mockClear();
  });
  afterEach(() => close());

  it('validateAncestor requires name, month and tithi and bounds the optional year', () => {
    const t = makeT('en');
    const base = { name: 'Kamla Devi', relation: 'grandmother', deathMonth: 10, paksha: 'krishna' as const, tithi: 9, year: '' };
    expect(validateAncestor(base, t, 2026).value).toEqual({ name: 'Kamla Devi', relation: 'grandmother', deathMonth: 10, paksha: 'krishna', tithi: 9, year: null });
    expect(validateAncestor({ ...base, name: ' ' }, t, 2026).errors.name).toBe('Name is required');
    expect(validateAncestor({ ...base, deathMonth: null }, t, 2026).errors.deathMonth).toBeTruthy();
    expect(validateAncestor({ ...base, tithi: null }, t, 2026).errors.tithi).toBeTruthy();
    expect(validateAncestor({ ...base, year: '1850' }, t, 2026).errors.year).toBe('Enter a year between 1900 and 2026');
    expect(validateAncestor({ ...base, year: '2001' }, t, 2026).value?.year).toBe(2001);
  });

  it('saves a record with month/paksha/tithi chips (Purnimanta names from the profile) and never counts toward profiles', async () => {
    const replan = jest.fn(async () => undefined);
    await renderWithProviders(<AncestorEditor ancestorId="new" replan={replan} />);
    expect(screen.getByText('Month names: Purnimanta (your profile’s calendar tradition)')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('ancestor-name'), 'Kamla Devi');
    await fireEvent.press(screen.getByTestId('relation-grandmother'));
    await fireEvent.press(screen.getByTestId('month-10')); // Magha
    expect(screen.getByTestId('paksha')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('tithi-9')); // Navami (krishna is preselected)
    await fireEvent.changeText(screen.getByTestId('ancestor-year'), '2001');
    await fireEvent.press(screen.getByTestId('ancestor-save'));
    await waitFor(() => expect(listAncestors().length).toBe(1), FIND);
    expect(listAncestors()[0]).toMatchObject({ name: 'Kamla Devi', relation: 'grandmother', deathMonth: 10, paksha: 'krishna', tithi: 9, year: 2001 });
    expect(countAncestors()).toBe(1);
    expect(countProfiles()).toBe(1);
    expect(replan).toHaveBeenCalledTimes(1);
    expect(router.back).toHaveBeenCalled();
  });

  it('refuses an empty name with an inline error and does not save', async () => {
    await renderWithProviders(<AncestorEditor ancestorId="new" />);
    await fireEvent.press(screen.getByTestId('ancestor-save'));
    expect(screen.getByText('Name is required')).toBeTruthy();
    expect(listAncestors().length).toBe(0);
  });
});
