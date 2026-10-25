// F7 Upcoming strip: fixed order, every present kind tappable, the empty state is one "Add a family date" row; F6 daily
// note rows: fixed order, every row a Row with Why?, fragments resolved from the corpus with the engine params.
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { computeChart, dailyNote, upcoming, UPCOMING_ORDER, type UpcomingItem } from '@shubhvela/engine';
import { DailyNoteCard, fragmentText, rowSegments } from '../src/today/DailyNoteCard';
import { UpcomingStrip, upcomingCardText } from '../src/today/UpcomingStrip';
import { makeT } from '../src/i18n';
import { renderWithProviders, textOf } from './helpers/render';

const DELHI = { lat: 28.6139, lon: 77.209 };
const TZ = 'Asia/Kolkata';
const NOW = Date.UTC(2026, 9, 22, 5, 28); // 22 Oct 2026 10:58 IST
const t = makeT('en');
const PRIYA = { date: '1998-03-14', time: '06:42', tz: 'Asia/Kolkata', lat: 26.85, lon: 80.95 };

describe('<UpcomingStrip>', () => {
  it('shows one "Add a family date" row when nothing is coming up, leading to the profile editor', async () => {
    await renderWithProviders(<UpcomingStrip items={[]} tz={TZ} profileId={1} />);
    expect(screen.getByText('Upcoming')).toBeTruthy();
    expect(screen.queryByTestId('upcoming-strip')).toBeNull();
    const row = screen.getByTestId('upcoming-empty');
    expect(textOf(screen.getByText('Add a family date'))).toBe('Add a family date');
    await fireEvent.press(row);
    expect(router.push).toHaveBeenCalledWith('/profile/new');
  });

  it("renders the engine's items in the fixed order, each card tappable with kind, title and date", async () => {
    const chart = computeChart(PRIYA, { ayanamsa: 'lahiri', node: 'mean' });
    const items: UpcomingItem[] = upcoming({ id: '1', name: 'Priya', chart, tradition: 'purnimanta' }, [], NOW, DELHI, TZ);
    expect(items.length).toBeGreaterThanOrEqual(3);
    const order = items.map((i) => UPCOMING_ORDER.indexOf(i.kind));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    await renderWithProviders(<UpcomingStrip items={items} tz={TZ} profileId={1} />);
    for (const it of items) {
      const card = screen.getByTestId(`upcoming-${it.kind}`);
      const text = upcomingCardText(it, TZ, 1, t, 'en');
      expect(card.props.accessibilityLabel).toContain(text.title);
      expect(text.date).toMatch(/\d/);
      await fireEvent.press(card);
      expect(router.push).toHaveBeenLastCalledWith(text.route);
    }
    const vrat = items.find((i) => i.kind === 'vrat');
    if (vrat) expect(upcomingCardText(vrat, TZ, 1, t, 'en').title).toBe('Papankusha Ekadashi');
    const transit = items.find((i) => i.kind === 'majorTransit');
    if (transit) expect(upcomingCardText(transit, TZ, 1, t, 'en').title).toMatch(/Jupiter enters Simha|Rahu enters|Saturn enters/);
  });
});

describe('<DailyNoteCard>', () => {
  it('renders 3-5 rows in the fixed order, each with a Why?, from corpus fragments with the engine params filled', async () => {
    const chart = computeChart(PRIYA, { ayanamsa: 'lahiri', node: 'mean' });
    const rows = dailyNote(chart, '2026-10-22', DELHI, TZ);
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows.length).toBeLessThanOrEqual(5);
    expect(rows.map((r) => r.ruleId)).toEqual(['chandra-bala', 'tara-bala', 'day-tithi-nakshatra', 'sade-sati', 'dasha-lords'].slice(0, rows.length));
    for (const r of rows) for (const k of r.keys) expect([k, fragmentText(k, 'en') !== null]).toEqual([k, true]);
    await renderWithProviders(<DailyNoteCard rows={rows} name="Priya" day="2026-10-22" tz={TZ} />);
    expect(textOf(screen.getByTestId('note-title'))).toBe('Your day, Priya');
    expect(screen.getAllByLabelText(/^Why\? /).length).toBe(rows.length);
    for (const r of rows) {
      const text = textOf(screen.getByTestId(`note-text-${r.ruleId}`));
      expect(text.length).toBeGreaterThan(20);
      expect(text).not.toMatch(/\{\w+\}/); // every placeholder interpolated
    }
    // Bhadra/Panchak advice: the day row names the flag windows with times (22 Oct 2026 has both).
    const dayRow = rows.find((r) => r.ruleId === 'day-tithi-nakshatra')!;
    expect(dayRow.keys).toContain('panchak');
    expect(rowSegments(dayRow, TZ, '2026-10-22', t, 'en').some((s) => s.num)).toBe(true);
    expect(screen.getByTestId('note-footer').props.children).toBe("Guidance for reflection, computed from your chart and today's sky. Not a prediction.");
    // No Listen button until C01 (nothing fake).
    expect(screen.queryByText('Listen')).toBeNull();
  });
});
