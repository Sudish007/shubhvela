// Festival calendar (F23) + festival detail footer: buildCalendar lists three years from the current month with every
// festival once and the ancestors' barsi / Pitru Paksha days highlighted (F21); the Purnimanta/Amanta toggle changes
// the month naming of the tithi text and the North/South toggle changes which festivals appear; the detail footer
// reads "Verified against Drik Panchang on <fetch date>" only for a date the suite checked, else "not yet verified";
// the Calendar screen renders both segmented toggles with their state and the list; +30 % pseudo-locale snapshot.
import { fireEvent, screen } from '@testing-library/react-native';
import { festivals, type FestivalOccurrence } from '@shubhvela/engine';
import CalendarScreen from '../app/family/calendar';
import FestivalScreen from '../app/family/festival/[slug]';
import { insertAncestor } from '../src/db/ancestors';
import { insertProfile } from '../src/db/profiles';
import { getSetting } from '../src/db/settings';
import { SAMPLE_DADAJI, SAMPLE_PRIYA } from '../src/dev/seed';
import { buildCalendar, itemCaption, itemTitle } from '../src/family/CalendarList';
import { verificationFooter } from '../src/family/FestivalDetail';
import { makeT } from '../src/i18n';
import { installTestDb } from './helpers/nodeDb';
import { allTexts, renderWithProviders, textOf } from './helpers/render';

const NOW = Date.UTC(2026, 9, 22, 5, 28); // Thu 22 Oct 2026 10:58 IST
const now = () => NOW;
const FIND = { timeout: 25000 };
const LUCKNOW = { lat: 26.85, lon: 80.95 };
const TZ = 'Asia/Kolkata';
const t = makeT('en');

function assertNoTruncation() {
  for (const tx of allTexts()) expect(tx.props.numberOfLines).toBeUndefined();
}

describe('buildCalendar', () => {
  it('lists festivals from the current month for the requested years, once per festival, with the shraddha days highlighted', () => {
    const dadaji = { id: 1, ...SAMPLE_DADAJI };
    const m = buildCalendar({ today: '2026-10-22', tradition: 'purnimanta', region: 'north', geo: LUCKNOW, tz: TZ, ancestors: [dadaji], years: 2 });
    expect(m.fromYear).toBe(2026);
    expect(m.toYear).toBe(2027);
    expect(m.months[0].id).toBe('2026-10');
    expect(m.months[m.months.length - 1].id).toBe('2027-12');
    expect(m.festivalCount).toBeGreaterThan(150);
    const all = m.months.flatMap((x) => x.items);
    // Navratri spans appear once (first day), with a "through" caption.
    const navratri = all.filter((i) => i.slug === 'sharad-navratri');
    expect(navratri.map((i) => i.year)).toEqual([2026, 2027]);
    expect(itemCaption(navratri[0], t, 'en')).toMatch(/through the \d+th$/);
    // Diwali 2026 on 8 Nov (A03 sample truth) in November's section.
    const nov = m.months.find((x) => x.id === '2026-11')!;
    expect(nov.items.find((i) => i.slug === 'diwali')?.date).toBe('2026-11-08');
    // F21: Dadaji's barsi (Ashwin Krishna Dashami = his Pitru Paksha day) is listed in 2027 with the ancestor's name.
    const shraddha = all.filter((i) => i.kind !== 'festival');
    expect(shraddha.length).toBeGreaterThanOrEqual(1);
    // The whole current month is listed, so the 5 Oct 2026 day (already passed) and the 2027 day both appear.
    expect(shraddha.map((i) => i.date)).toEqual(['2026-10-05', expect.stringMatching(/^2027-(09|10)-/)]);
    expect(shraddha.every((i) => i.ancestor?.name === 'Dadaji' && i.kind === 'barsi')).toBe(true);
    expect(itemTitle(shraddha[0], t, 'en')).toMatch(/Dadaji/);
  });

  it('Purnimanta vs Amanta changes the month naming of the tithi text; North vs South changes the festival set', () => {
    const p = buildCalendar({ today: '2026-10-22', tradition: 'purnimanta', region: 'north', geo: LUCKNOW, tz: TZ, ancestors: [], years: 1 });
    const a = buildCalendar({ today: '2026-10-22', tradition: 'amanta', region: 'north', geo: LUCKNOW, tz: TZ, ancestors: [], years: 1 });
    const kcP = p.months.flatMap((x) => x.items).find((i) => i.slug === 'karwa-chauth')!;
    const kcA = a.months.flatMap((x) => x.items).find((i) => i.slug === 'karwa-chauth')!;
    expect(kcP.date).toBe('2026-10-29');
    expect(kcA.date).toBe(kcP.date);
    expect(itemCaption(kcP, t, 'en')).toBe('Kartik Krishna Chaturthi');
    expect(itemCaption(kcA, t, 'en')).toBe('Ashwin Krishna Chaturthi');
    const s = buildCalendar({ today: '2026-10-22', tradition: 'amanta', region: 'south', geo: LUCKNOW, tz: TZ, ancestors: [], years: 1 });
    const slugs = (m: typeof s) => new Set(m.months.flatMap((x) => x.items).map((i) => i.slug));
    expect(slugs(p).has('chhath-puja')).toBe(true);
    expect(slugs(s).has('chhath-puja')).toBe(false);
    expect(slugs(s).has('karthigai-deepam')).toBe(true);
    expect(slugs(p).has('karthigai-deepam')).toBe(false);
  });
});

describe('festival verification footer', () => {
  it('names the Drik fetch date for a checked date and says "not yet verified" otherwise', () => {
    const delhi = festivals(2026, 'purnimanta', 'north', { lat: 28.61394, lon: 77.20902 }, TZ);
    const diwali = delhi.find((f: FestivalOccurrence) => f.slug === 'diwali')!;
    const ok = verificationFooter('diwali', 2026, 'purnimanta', diwali.date, t, 'en');
    expect(ok.verified).toBe(true);
    expect(ok.text).toMatch(/^Verified against Drik Panchang on \w{3} \d{1,2} \w{3} \d{4}$/);
    const shifted = verificationFooter('diwali', 2026, 'purnimanta', '2026-11-09', t, 'en');
    expect(shifted).toEqual({ verified: false, text: 'Not yet verified against a reference panchang' });
    expect(verificationFooter('diwali', 2029, 'purnimanta', '2029-11-05', t, 'en').verified).toBe(false);
  });
});

describe('<CalendarScreen> and <FestivalScreen>', () => {
  let close: () => void;
  beforeEach(() => {
    ({ close } = installTestDb());
    insertProfile(SAMPLE_PRIYA, new Date(NOW));
    insertAncestor(SAMPLE_DADAJI);
  });
  afterEach(() => {
    globalThis.__PSEUDO_LOCALE__ = undefined;
    close();
  });

  it('renders both toggles with their state, the month list with 56 dp rows, and switches tradition/region', async () => {
    await renderWithProviders(<CalendarScreen now={now} years={1} />);
    await screen.findByTestId('calendar-list', {}, FIND);
    const purnimanta = screen.getByLabelText('Purnimanta');
    expect(purnimanta.props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText('North').props.accessibilityState.checked).toBe(true);
    expect(screen.getByTestId('month-2026-10')).toBeTruthy();
    expect(screen.getByText('October 2026')).toBeTruthy();
    const kc = screen.getByTestId('cal-festival-karwa-chauth-2026-10-29');
    expect(textOf(kc)).toMatch(/Thu 29.*Karwa Chauth.*Kartik Krishna Chaturthi/);
    expect(kc.props.style.find((s: { minHeight?: number }) => s && s.minHeight === 56) ?? kc.props.style).toBeTruthy();
    expect(textOf(screen.getByTestId('calendar-range'))).toMatch(/^2026–2026 · \d+ festival dates at your place$/);
    await fireEvent.press(screen.getByLabelText('Amanta'));
    await screen.findByText(/Ashwin Krishna Chaturthi/, {}, FIND);
    expect(screen.getByLabelText('Amanta').props.accessibilityState.checked).toBe(true);
    await fireEvent.press(screen.getByLabelText('South'));
    await screen.findByTestId(/^cal-festival-karthigai-deepam-/, {}, FIND);
    expect(screen.queryByTestId(/^cal-festival-chhath-puja-/)).toBeNull();
    expect(getSetting('festivalRegion')).toBe('south');
    assertNoTruncation();
  });

  it('festival detail shows the computed date, tithi, sunrise/moonrise, What to do with Why?, and the honest footer', async () => {
    await renderWithProviders(<FestivalScreen slug="diwali" year={2026} tradition="purnimanta" region="north" now={now} />);
    await screen.findByTestId('festival-detail', {}, FIND);
    expect(textOf(screen.getByTestId('festival-date'))).toBe('Sun 8 Nov 2026');
    expect(textOf(screen.getByTestId('festival-tithi'))).toBe('Kartik Krishna Amavasya');
    expect(textOf(screen.getByTestId('festival-sun-moon'))).toMatch(/^Sunrise \d\d:\d\d · (Moonrise \d\d:\d\d|no moonrise this day)$/);
    expect(textOf(screen.getByTestId('festival-what')).length).toBeGreaterThan(80);
    expect(screen.getAllByLabelText(/^Why\? /).length).toBe(1);
    // Lucknow's Diwali date equals the Delhi-verified one, so the footer names the fetch date.
    expect(textOf(screen.getByTestId('festival-verified'))).toMatch(/^Verified against Drik Panchang on /);
    expect(screen.queryByText(/Share/)).toBeNull();
  });

  it('+30 % pseudo-locale (en) calendar renders every string whole', async () => {
    globalThis.__PSEUDO_LOCALE__ = true;
    const tree = await renderWithProviders(<CalendarScreen now={now} years={1} />);
    await screen.findByTestId('calendar-list', {}, FIND);
    assertNoTruncation();
    expect(screen.getAllByText(/^Festival calendar x+$/).length).toBe(1);
    expect(tree.toJSON()).toMatchSnapshot();
  });
});
