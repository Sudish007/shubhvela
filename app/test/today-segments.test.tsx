// Segment list and Now line: exactly one verdict chip per row (engine verdict), the "overridden by" / "lifted by"
// wording, Tonight + hora grid, and the Why? sheet of the Now line showing rule + inputs + source.
import { fireEvent, screen, within } from '@testing-library/react-native';
import { at, goodHours, type GoodHours } from '@shubhvela/engine';
import { ruleText } from '@shubhvela/content';
import { NowLine, nowLineParams, nowRuleId } from '../src/today/NowLine';
import { num, richSegments, textSegments } from '../src/today/RichText';
import { dayRows, nightRows, rowNotes, SegmentList } from '../src/today/SegmentList';
import { makeT } from '../src/i18n';
import { renderWithProviders, textOf } from './helpers/render';

const DELHI = { lat: 28.6139, lon: 77.209 };
const TZ = 'Asia/Kolkata';
const DAY = '2026-10-22';
const NOW = Date.UTC(2026, 9, 22, 5, 28); // Thu 22 Oct 2026 10:58 IST
const t = makeT('en');

let gh: GoodHours;
beforeAll(() => {
  gh = goodHours(DAY, DELHI, TZ);
});

describe('<SegmentList>', () => {
  it('lists 13 day rows (incl. Brahma muhurat) and 8 night rows, each with exactly one verdict chip', async () => {
    await renderWithProviders(<SegmentList gh={gh} nowMs={NOW} />);
    const day = dayRows(gh);
    const night = nightRows(gh);
    expect(day.length).toBe(13);
    expect(night.length).toBe(8);
    expect(screen.getByText('Day · 13 segments')).toBeTruthy();
    for (const seg of [...day, ...night]) {
      const row = screen.getByTestId(`segment-row-${seg.id}`);
      const chips = within(row).getAllByTestId('verdict-chip');
      expect(chips.length).toBe(1);
      expect(['good', 'neutral', 'avoid']).toContain(textOf(chips[0]));
      expect(textOf(chips[0])).toBe(seg.verdict);
    }
  });

  it('uses the design wording for overridden rows and shows the flag as text, never as a colour', async () => {
    await renderWithProviders(<SegmentList gh={gh} nowMs={NOW} />);
    const overridden = gh.segments.filter((s) => s.overriddenBy?.length);
    expect(overridden.length).toBeGreaterThan(0);
    for (const seg of overridden) {
      const notes = rowNotes(seg, gh, t, 'en');
      expect(notes.some((n) => /^overridden by /.test(n))).toBe(true);
      expect(seg.verdict).not.toBe(seg.nature);
    }
    expect(screen.getAllByText(/^overridden by /).length).toBe(overridden.length);
    const flagged = gh.segments.filter((s) => s.flags.length);
    expect(flagged.length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^flag: /).length).toBeGreaterThan(0);
    // Chips carry the merged verdict only; Bhadra never changes a chip.
    for (const seg of flagged) expect(['good', 'neutral', 'avoid']).toContain(seg.verdict);
  });

  it('draws the hora grid with 24 cells and marks the current hora', async () => {
    await renderWithProviders(<SegmentList gh={gh} nowMs={NOW} />);
    expect(screen.getAllByTestId(/^hora-\d+$/).length).toBe(24);
    expect(screen.getAllByText(/ · now$/).length).toBe(1);
  });

  it('every row is tappable and opens the Why? sheet with the rule, inputs and source', async () => {
    await renderWithProviders(<SegmentList gh={gh} nowMs={NOW} />);
    const seg = gh.segments.find((s) => s.id === 'rahu')!;
    await fireEvent.press(screen.getByTestId(`segment-row-${seg.id}`));
    const rule = ruleText(seg.ruleId, 'en')!;
    expect(screen.getByText(rule.text)).toBeTruthy();
    expect(screen.getByText('Inputs')).toBeTruthy();
    expect(screen.getByText('Weekday')).toBeTruthy();
    expect(screen.getByText('Thursday')).toBeTruthy();
    expect(screen.getByText('Source')).toBeTruthy();
    expect(screen.getByText(rule.snippet.source!)).toBeTruthy();
  });
});

describe('RichText segments (N4 / N19)', () => {
  it('merges "{from}–{to}" into one glued Num run and tags every other digit run', () => {
    const segs = richSegments((p) => t('today.flagBhadraEarth', p), { from: num('11:40'), to: num('23:46') });
    const nums = segs.filter((s) => s.num).map((s) => s.text);
    expect(nums).toEqual(['11:40\u2060\u2013\u206023:46']);
    expect(nums[0]).not.toMatch(/\s/);
    expect(segs.map((s) => s.text).join('')).toBe('Bhadra on earth 11:40\u2060\u2013\u206023:46: no new beginnings');
    const plain = textSegments('सूर्योदय 06:27 · चंद्रोदय 15:21 · 13 segments');
    expect(plain.filter((s) => s.num).map((s) => s.text)).toEqual(['06:27', '15:21', '13']);
    expect(plain.map((s) => s.text).join('')).toBe('सूर्योदय 06:27 · चंद्रोदय 15:21 · 13 segments');
  });
});

describe('<NowLine>', () => {
  it('reads the current span from engine.at and names the next segment with its verdict', async () => {
    const state = at(gh, NOW)!;
    const { key, params } = nowLineParams(gh, state, NOW, t, 'en');
    expect(key).toBe('today.nowLine');
    expect(params.verdict).toBe('Neutral');
    expect(params.choghadiya).toBe('Chal');
    expect(params.hora).toBe('Mercury');
    expect(params.next).toBe('Abhijit');
    expect(params.nextVerdict).toBe('good');
    await renderWithProviders(<NowLine gh={gh} nowMs={NOW} />);
    const text = textOf(screen.getByTestId('now-line-text'));
    expect(text).toContain('Now ');
    expect(text).toContain('10:58');
    expect(text).toContain('Neutral');
    expect(text).toContain('Chal choghadiya');
    expect(text).toContain('Mercury hora');
    expect(text).toContain('Abhijit');
  });

  it('its Why? opens the rule of the deciding segment with weekday and sunrise inputs and the source', async () => {
    const state = at(gh, NOW)!;
    const ruleId = nowRuleId(gh, state);
    expect(ruleId).toBe('choghadiya-chal');
    await renderWithProviders(<NowLine gh={gh} nowMs={NOW} />);
    await fireEvent.press(screen.getByLabelText(/^Why\? Now /));
    const rule = ruleText(ruleId, 'en')!;
    expect(screen.getByText(rule.text)).toBeTruthy();
    expect(screen.getByText('Applies now')).toBeTruthy();
    expect(screen.getByText('Weekday')).toBeTruthy();
    expect(screen.getByText('Thursday')).toBeTruthy();
    expect(screen.getByText('Sunrise')).toBeTruthy();
    expect(screen.getByText('Source')).toBeTruthy();
  });

  it('renders nothing outside the Vedic day', async () => {
    await renderWithProviders(<NowLine gh={gh} nowMs={gh.ticks!.sunrise - 1} />);
    expect(screen.queryByTestId('now-line-text')).toBeNull();
  });
});
