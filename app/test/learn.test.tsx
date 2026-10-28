// Learn tab (FEAT-C03): >= 20 lessons listed with number/title/5 min/done tick; the reader resolves every placeholder of
// the sample chart (no "{" left) with Latin/Num runs in Devanagari; Mark done writes lessons_done and raises the corpus
// level so a Why? sheet elsewhere (matching Varna row) shows level-2 text; the glossary list (>= 150) filters; the term page
// shows Devanagari + Latin + meaning + related terms/lessons; a WhySheet term row navigates to the term page; the journal
// stores a mood in two taps (chip + Save) with words only; the month grid renders 28-31 cells with engine Moon-house
// numbers and dasha hairlines; the legend says "for reflection, not proof" and "proof" appears nowhere else; banner policy
// LearnRoot/GlossaryList vs reader/journal; +30 % pseudo-locale snapshots of the lesson list and the journal.
import { act, fireEvent, screen } from '@testing-library/react-native';
import { LESSON_PLACEHOLDERS, lessonPlaceholders, loadGlossary, loadLessons, lookup, renderLesson } from '@shubhvela/content';
import { changesBetween, DAY_MS, localDateOf, sadeSati, TARA_KEYS } from '@shubhvela/engine';
import { router } from 'expo-router';
import { PixelRatio, ScrollView } from 'react-native';
import ChartsScreen from '../app/(tabs)/charts';
import LearnScreen from '../app/(tabs)/learn';
import TodayScreen from '../app/(tabs)/today';
import MatchResultScreen from '../app/family/match/result';
import JournalScreen from '../app/learn/journal';
import { bannerFor, beginSession, resetAdPolicyForTests, todayCardOrder } from '../src/ads/AdPolicy';
import { WhySheet } from '../src/components/WhySheet';
import { getJournalEntry, listJournalMonth, MOODS, saveJournalEntry } from '../src/db/journal';
import { listLessonsDone, markLessonDone } from '../src/db/lessonsDone';
import { getProfile, insertProfile, setProfileIntent } from '../src/db/profiles';
import { SAMPLE_AMMA, SAMPLE_PRIYA } from '../src/dev/seed';
import { chartFor, clearChartCache, dashaFor } from '../src/engine-bridge/charts';
import { makeT } from '../src/i18n';
import GlossaryDetail, { otherLanguageMeanings } from '../src/learn/GlossaryDetail';
import GlossaryList, { filterGlossary, sortGlossary } from '../src/learn/GlossaryList';
import { journalMonth, moonHouseOnDay, shiftYearMonth } from '../src/learn/journalModel';
import LessonReader, { lessonSegments } from '../src/learn/LessonReader';
import { lessonValues, moonHouseOf } from '../src/learn/placeholders';
import { TRY_IT_CARDS, TRY_IT_SHEETS } from '../src/learn/arrival';
import { levelFromDone, unlockedLevel, whyLevel } from '../src/learn/progress';
import { kootaLevel, kootaSideText } from '../src/match/model';
import { planetName, signName } from '../src/today/format';
import { installTestDb } from './helpers/nodeDb';
import { allTexts, renderWithProviders, textOf } from './helpers/render';

const NOW = Date.UTC(2026, 9, 22, 5, 28); // Thu 22 Oct 2026 10:58 IST
const now = () => NOW;
const TZ = 'Asia/Kolkata';
const t = makeT('en');

function assertNoTruncation() {
  const texts = allTexts();
  expect(texts.length).toBeGreaterThan(5);
  for (const tx of texts) expect(tx.props.numberOfLines).toBeUndefined();
}

function allText(): string {
  return allTexts()
    .map((tx) => textOf(tx))
    .join('\n');
}

describe('C03 Learn tab', () => {
  let close: () => void;
  let priyaId: number;
  const priya = () => getProfile(priyaId)!;
  beforeEach(() => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1);
    ({ close } = installTestDb());
    clearChartCache();
    resetAdPolicyForTests();
    (router.push as jest.Mock).mockClear();
    priyaId = insertProfile(SAMPLE_PRIYA, new Date(NOW));
  });
  afterEach(() => {
    globalThis.__PSEUDO_LOCALE__ = undefined;
    close();
  });

  // ---- F32 lessons ----

  it('the Learn root lists >= 20 lessons with number, title, "5 min" and no done tick; Glossary and Journal rows navigate', async () => {
    const lessons = loadLessons('en').items;
    expect(lessons.length).toBeGreaterThanOrEqual(20);
    await renderWithProviders(<LearnScreen />);
    expect(screen.getByTestId('learn-screen')).toBeTruthy();
    expect(screen.getAllByTestId(/^lesson-lesson-\d+$/).length).toBe(lessons.length);
    for (const l of lessons) {
      expect(textOf(screen.getByTestId(`lesson-${l.id}-n`))).toBe(String(l.n));
      expect(textOf(screen.getByTestId(`lesson-${l.id}-title`))).toBe(l.title);
      expect(screen.queryByTestId(`lesson-${l.id}-done`)).toBeNull();
    }
    expect(screen.getAllByText('5 min').length).toBe(lessons.length);
    expect(textOf(screen.getByTestId('learn-progress'))).toBe(`0 of ${lessons.length} done`);
    expect(textOf(screen.getByTestId('learn-continue'))).toContain('Continue with lesson 1');
    await fireEvent.press(screen.getByTestId('learn-glossary-row'));
    expect(router.push).toHaveBeenCalledWith('/learn/glossary');
    await fireEvent.press(screen.getByTestId('learn-journal-row'));
    expect(router.push).toHaveBeenCalledWith('/learn/journal');
    await fireEvent.press(screen.getByTestId('lesson-lesson-03'));
    expect(router.push).toHaveBeenCalledWith('/learn/lesson/lesson-03');
    expect(allText()).not.toMatch(/proof/i);
    assertNoTruncation();
  });

  it('a done lesson shows the tick and the progress line counts it', async () => {
    markLessonDone('lesson-01', new Date(NOW));
    await renderWithProviders(<LearnScreen />);
    expect(screen.getByTestId('lesson-lesson-01-done')).toBeTruthy();
    expect(textOf(screen.getByTestId('lesson-lesson-01-done'))).toBe('Done');
    expect(screen.getByTestId('lesson-lesson-01').props.accessibilityState.checked).toBe(true);
    expect(textOf(screen.getByTestId('learn-progress'))).toBe(`1 of ${loadLessons('en').items.length} done`);
    expect(textOf(screen.getByTestId('learn-continue'))).toContain('Continue with lesson 2');
  });

  it('the resolver fills every one of the 57 placeholders from the sample chart; no "{" remains in any lesson', () => {
    const p = priya();
    const values = lessonValues({ profile: p, chart: chartFor(p), nowMs: NOW, lang: 'en', t });
    for (const key of LESSON_PLACEHOLDERS) {
      expect(typeof values[key]).toBe('string');
      expect(String(values[key]).length).toBeGreaterThan(0);
    }
    const chart = chartFor(p);
    expect(values.moonSign).toBe(signName('en', chart.planets.find((x) => x.id === 'Mo')!.sign));
    expect(values.lagna).toBe(signName('en', chart.lagna!.sign));
    expect(values.moonHouse).toBe(String(chart.planets.find((x) => x.id === 'Mo')!.house));
    expect(values.saturnHouseFromMoon).toBe(String(sadeSati(chart, NOW).saturnHouseFromMoon));
    expect(values.balanceLord).toBe(planetName('en', dashaFor(chart).balanceAtBirth.lord));
    expect(values.name).toBe('Priya');
    expect(values.birthPlace).toBe(SAMPLE_PRIYA.placeName);
    expect(values.ephemeris).toBe('astronomy-engine 2.1.19');
    expect(values.ayanamsa).toBe('Lahiri (default)');
    expect(values.rahuKaalToday).toMatch(/^\d{2}:\d{2}.*\d{2}:\d{2}$/);
    expect(Number(values.todayMoonHouseFromMoon)).toBeGreaterThanOrEqual(1);
    expect(Number(values.todayMoonHouseFromMoon)).toBeLessThanOrEqual(12);
    for (const l of loadLessons('en').items) {
      const text = renderLesson(l, values).join('\n');
      expect(text).not.toContain('{');
      expect(text).not.toContain('}');
      // Every placeholder a lesson uses is in the contract.
      for (const ph of lessonPlaceholders(l)) expect(LESSON_PLACEHOLDERS).toContain(ph);
    }
  });

  it('unknown birth time: Lagna placeholders read the honest UI string, never an empty string', () => {
    const id = insertProfile({ ...SAMPLE_AMMA, birthTime: null, timeUnknown: true, isSelf: false }, new Date(NOW));
    const p = getProfile(id)!;
    const values = lessonValues({ profile: p, chart: chartFor(p), nowMs: NOW, lang: 'en', t }, ['lagna', 'lagnaLord', 'lagnaNavamsaSign', 'moonSign']);
    expect(values.lagna).toBe('unknown (no birth time)');
    expect(values.lagnaLord).toBe('unknown (no birth time)');
    expect(values.lagnaNavamsaSign).toBe('unknown (no birth time)');
    expect(String(values.moonSign).length).toBeGreaterThan(0);
  });

  it('Devanagari body: Latin and digit values become Num runs; English body: only digit runs do', () => {
    const hi = lessonSegments('आपका चंद्र {moonSign} में है, {balanceYears} वर्ष।', { moonSign: 'Vrishchika', balanceYears: '3.2' }, 'hi');
    expect(hi.filter((s) => s.num).map((s) => s.text)).toEqual(['Vrishchika', '3.2']);
    const en = lessonSegments('Your Moon is in {moonSign}, {balanceYears} years.', { moonSign: 'Vrishchika', balanceYears: '3.2' }, 'en');
    expect(en.filter((s) => s.num).map((s) => s.text)).toEqual(['3.2']);
    expect(en.map((s) => s.text).join('')).toBe('Your Moon is in Vrishchika, 3.2 years.');
  });

  it('the reader renders the interpolated body, Try it row, terms and Mark done; Mark done writes lessons_done and reports the unlock', async () => {
    const lesson = loadLessons('en').items[0];
    await renderWithProviders(<LessonReader id={lesson.id} now={now} />);
    expect(screen.getByRole('header', { name: lesson.title })).toBeTruthy();
    expect(screen.getAllByTestId(/^lesson-para-\d+$/).length).toBe(lesson.body.length);
    const body = screen.getAllByTestId(/^lesson-para-\d+$/).map((p) => textOf(p)).join('\n');
    expect(body).not.toContain('{');
    expect(body).toContain('Priya');
    expect(body).toContain(signName('en', chartFor(priya()).planets.find((x) => x.id === 'Mo')!.sign));
    expect(textOf(screen.getByTestId('lesson-values-from'))).toBe("Chart values from Priya's profile");
    expect(screen.getByTestId('lesson-draft')).toBeTruthy();
    // Try it on your chart -> the lesson's route.
    expect(textOf(screen.getByTestId('lesson-try-row'))).toContain('Try it on your chart');
    await fireEvent.press(screen.getByTestId('lesson-try-row'));
    expect(router.push).toHaveBeenCalledWith(lesson.tryIt.route);
    // Terms link to the glossary pages.
    for (const term of lesson.terms) expect(screen.getByTestId(`lesson-term-${term}`)).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`lesson-term-${lesson.terms[0]}`));
    expect(router.push).toHaveBeenCalledWith(`/learn/glossary/${lesson.terms[0]}`);
    // Mark done (48 dp primary) -> lessons_done -> unlock notice; undo removes the row.
    expect(textOf(screen.getByTestId('lesson-unlocks'))).toBe('Unlocks level 2 explanations');
    expect(listLessonsDone()).toEqual([]);
    expect(unlockedLevel()).toBe(1);
    await fireEvent.press(screen.getByTestId('lesson-mark-done'));
    expect(listLessonsDone().map((d) => d.lessonId)).toEqual([lesson.id]);
    expect(unlockedLevel()).toBe(2);
    expect(textOf(screen.getByTestId('lesson-done-on'))).toBe('Done on 22 Oct 2026');
    expect(textOf(screen.getByTestId('lesson-unlocked'))).toContain('Deeper explanations unlocked');
    expect(textOf(screen.getByTestId('lesson-unlocked'))).toContain('level 2');
    expect(screen.getByTestId('lesson-next')).toBeTruthy();
    expect(screen.queryByTestId('lesson-prev')).toBeNull();
    await fireEvent.press(screen.getByTestId('lesson-undo'));
    expect(listLessonsDone()).toEqual([]);
    expect(screen.getByTestId('lesson-mark-done')).toBeTruthy();
    // No banner strip on the reader even in an ad session.
    await act(async () => {
      for (let i = 0; i < 4; i++) beginSession();
    });
    expect(bannerFor('LessonReader')).toBe('none');
    expect(screen.queryByTestId('banner-strip')).toBeNull();
    assertNoTruncation();
  });

  it('corpus level: lessons unlock level 2 and never level 3 (Pro); whyLevel/kootaLevel follow', () => {
    const lessons = loadLessons('en').items;
    expect(levelFromDone(new Set(), lessons)).toBe(1);
    expect(levelFromDone(new Set(['lesson-01']), lessons)).toBe(2);
    // A level-3 lesson marked done still caps at 2 for a free reader: the full explanation stays with Pro.
    expect(lessons.find((l) => l.id === 'lesson-21')!.unlocksLevel).toBe(3);
    expect(levelFromDone(new Set(lessons.map((l) => l.id)), lessons)).toBe(2);
    expect(whyLevel(true)).toBe(3);
    expect(whyLevel(false)).toBe(1);
    expect(kootaLevel(false)).toBe(1);
    expect(kootaLevel(false, 2)).toBe(2);
    expect(kootaLevel(false, 3)).toBe(2);
    expect(kootaLevel(true, 1)).toBe(3);
    markLessonDone('lesson-05', new Date(NOW));
    expect(whyLevel(false)).toBe(2);
  });

  it('after Mark done a Why? sheet elsewhere (matching Varna row) shows the level-2 text instead of level 1; nothing commercial changes', async () => {
    const ammaId = insertProfile(SAMPLE_AMMA, new Date(NOW));
    markLessonDone('lesson-01', new Date(NOW));
    await renderWithProviders(<MatchResultScreen now={now} sides={{ a: { kind: 'profile', id: priyaId }, b: { kind: 'profile', id: ammaId } }} />);
    await fireEvent.press(screen.getByLabelText(/^Why\? Varna · /));
    expect(screen.getByTestId('why-explanation')).toBeTruthy();
    expect(screen.getAllByText(lookup('koota', 'koota-varna-2', 'en')!.text).length).toBeGreaterThan(0);
    expect(screen.queryByText(lookup('koota', 'koota-varna-3', 'en')!.text)).toBeNull();
    // Free captions and prices are untouched by the lesson unlock.
    expect(screen.getByTestId('summary-free')).toBeTruthy();
    expect(textOf(screen.getByTestId('match-report-pdf'))).toBe('Matching report PDF · ₹99');
  });

  it("Today's lesson row renders for the Learn intent only, under the note, pointing at the next undone lesson", async () => {
    expect(todayCardOrder('learn')).toContain('todayLesson');
    expect(todayCardOrder('learn').indexOf('todayLesson')).toBe(todayCardOrder('learn').indexOf('dailyNote') + 1);
    for (const intent of ['marriage', 'career', 'familyDates', null] as const) expect(todayCardOrder(intent)).not.toContain('todayLesson');
    markLessonDone('lesson-01', new Date(NOW));
    setProfileIntent(priyaId, 'learn');
    await renderWithProviders(<TodayScreen todayOptions={{ now }} />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    await screen.findByTestId('today-lesson', {}, { timeout: 20000 });
    const row = screen.getByTestId('today-lesson-row');
    expect(textOf(row)).toContain("Today's lesson");
    expect(textOf(row)).toContain('Lesson 2');
    expect(textOf(row)).toContain(loadLessons('en').items[1].title);
    await fireEvent.press(row);
    expect(router.push).toHaveBeenCalledWith('/learn/lesson/lesson-02');
  });

  it('every tryIt route in the corpus is a known screen; its ?card= / ?sheet= / ?varga= value is one the target honours', () => {
    const known = ['/(tabs)/charts', '/(tabs)/today', '/family/calendar', '/charts/dasha-tree', '/charts/vargas', '/charts/ashtakavarga', '/charts/kp', '/family/match', '/charts/muhurat', '/settings/calculation'];
    for (const l of loadLessons('en').items) {
      const [path, query = ''] = l.tryIt.route.split('?');
      expect(known).toContain(path);
      for (const pair of query ? query.split('&') : []) {
        const [k, v] = pair.split('=');
        if (k === 'card') expect(TRY_IT_CARDS).toContain(v);
        else if (k === 'sheet') expect(TRY_IT_SHEETS).toContain(v);
        else if (k === 'varga') expect(v).toBe('D9');
        else throw new Error(`unknown tryIt param ${pair} in ${l.id}`);
      }
    }
  });

  it('Charts arriving with ?card=yogas scrolls once to the Yogas card when its layout is known and clears the param', async () => {
    (router.setParams as jest.Mock).mockClear();
    // The jest preset's ScrollView mock keeps scrollTo as one jest.fn on the class prototype; the Screen's ref reaches it.
    const scrollTo = (ScrollView.prototype as unknown as { scrollTo: jest.Mock }).scrollTo;
    expect(jest.isMockFunction(scrollTo)).toBe(true);
    scrollTo.mockClear();
    await renderWithProviders(<ChartsScreen now={now} chartWidth={326} card="yogas" />);
    expect(scrollTo).not.toHaveBeenCalled();
    // Another card laying out first does not scroll.
    await act(async () => {
      fireEvent(screen.getByTestId('houses-anchor'), 'layout', { nativeEvent: { layout: { x: 0, y: 900, width: 358, height: 300 } } });
    });
    expect(scrollTo).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent(screen.getByTestId('yogas-anchor'), 'layout', { nativeEvent: { layout: { x: 0, y: 1840, width: 358, height: 400 } } });
    });
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ y: 1832, animated: true });
    expect(router.setParams).toHaveBeenCalledWith({ card: undefined });
    // A second layout pass (font scale change, rotation) never scrolls again.
    await act(async () => {
      fireEvent(screen.getByTestId('yogas-anchor'), 'layout', { nativeEvent: { layout: { x: 0, y: 1900, width: 358, height: 400 } } });
    });
    expect(scrollTo).toHaveBeenCalledTimes(1);
    // The Planets card is its own anchor (the Card takes onLayout); Sade Sati has one too.
    expect(screen.getByTestId('planets-card')).toBeTruthy();
    expect(screen.getByTestId('sadesati-anchor')).toBeTruthy();
  });

  it('Today arriving with ?sheet=panchang opens the panchang sheet once the model is ready and clears the param', async () => {
    (router.setParams as jest.Mock).mockClear();
    await renderWithProviders(<TodayScreen todayOptions={{ now }} sheet="panchang" />);
    expect(screen.queryByTestId('panchang-header')).toBeNull();
    await screen.findByTestId('daily-note', {}, { timeout: 20000 });
    await screen.findByTestId('panchang-header', {}, { timeout: 20000 });
    expect(router.setParams).toHaveBeenCalledWith({ sheet: undefined });
    // Without the param the sheet stays closed.
    (router.setParams as jest.Mock).mockClear();
    await renderWithProviders(<TodayScreen todayOptions={{ now }} />);
    await screen.findByTestId('daily-note', {}, { timeout: 20000 });
    expect(screen.queryByTestId('panchang-header')).toBeNull();
    expect(router.setParams).not.toHaveBeenCalled();
  });

  it('B-REVIEW-NIT-3: the matching Tara side text carries the tara name, as the muhurat chip does', () => {
    const row = { id: 'tara' } as Parameters<typeof kootaSideText>[0];
    expect(kootaSideText(row, '5', t, 'en')).toBe('tara 5 (Pratyari)');
    expect(kootaSideText(row, '4', t, 'en')).toBe('tara 4 (Kshema)');
    for (let n = 1; n <= 9; n++) expect(kootaSideText(row, String(n), t, 'en')).toContain(`(${t(`note.tara.${TARA_KEYS[n]}`)})`);
  });

  // ---- F33 glossary ----

  it('the glossary list has >= 150 terms (Devanagari · Latin · one line), filters by search and navigates to a term', async () => {
    const all = loadGlossary('en').items;
    expect(all.length).toBeGreaterThanOrEqual(150);
    for (const g of all) {
      expect(g.term_dev).toMatch(/[\u0900-\u097F]/);
      expect(g.term_lat).toMatch(/[A-Za-z]/);
      expect(g.meaning.length).toBeGreaterThan(0);
    }
    expect(filterGlossary(all, '')).toHaveLength(all.length);
    expect(filterGlossary(all, 'rahu').map((g) => g.id)).toContain('rahu-kaal');
    expect(filterGlossary(all, 'राहु').every((g) => g.term_dev.includes('राहु') || g.meaning.includes('राहु'))).toBe(true);
    expect(filterGlossary(all, 'zzzzqq')).toHaveLength(0);
    const sorted = sortGlossary(all);
    expect(sorted[0].term_lat.localeCompare(sorted[sorted.length - 1].term_lat, 'en')).toBeLessThan(0);

    await renderWithProviders(<GlossaryList />);
    expect(screen.getByTestId('glossary-list')).toBeTruthy();
    expect(screen.getAllByTestId(/^glossary-[a-z0-9-]+$/).filter((n) => !/^glossary-(list|search|count|rows|clear|empty)$/.test(n.props.testID)).length).toBe(all.length);
    expect(textOf(screen.getByTestId('glossary-count'))).toBe(`${all.length} terms`);
    await fireEvent.changeText(screen.getByTestId('glossary-search'), 'Kaal');
    const rows = screen.getAllByTestId(/^glossary-[a-z0-9-]+$/).filter((n) => !/^glossary-(list|search|count|rows|clear|empty)$/.test(n.props.testID));
    expect(rows.length).toBe(filterGlossary(all, 'Kaal').length);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(all.length);
    expect(textOf(screen.getByTestId('glossary-rahu-kaal'))).toContain('राहु');
    expect(textOf(screen.getByTestId('glossary-rahu-kaal'))).toContain('Rahu Kaal');
    await fireEvent.press(screen.getByTestId('glossary-rahu-kaal'));
    expect(router.push).toHaveBeenCalledWith('/learn/glossary/rahu-kaal');
    await fireEvent.changeText(screen.getByTestId('glossary-search'), 'zzzzqq');
    expect(textOf(screen.getByTestId('glossary-empty'))).toBe('No term matches "zzzzqq"');
    await fireEvent.press(screen.getByTestId('glossary-clear'));
    expect(textOf(screen.getByTestId('glossary-count'))).toBe(`${all.length} terms`);
    // Banner policy (M5): the list and the Learn root are allow-listed from session 4; the term page, reader and journal
    // are not (the strip itself needs the ads SDK, which AdsRoot initialises only on device).
    await act(async () => {
      for (let i = 0; i < 4; i++) beginSession();
    });
    expect(bannerFor('GlossaryList')).toBe('anchored');
    expect(bannerFor('GlossaryTerm')).toBe('none');
    expect(bannerFor('LearnRoot')).toBe('anchored');
    expect(bannerFor('Journal')).toBe('none');
    assertNoTruncation();
  });

  it('the term page shows the headword in Devanagari and Latin, the meaning, related terms and the lessons that use it', async () => {
    const g = loadGlossary('en').items.find((x) => x.id === 'lagna')!;
    const lessonsUsing = loadLessons('en').items.filter((l) => l.terms.includes('lagna'));
    expect(lessonsUsing.length).toBeGreaterThan(0);
    await renderWithProviders(<GlossaryDetail id="lagna" from="why" />);
    expect(screen.getByRole('header', { name: g.term_dev })).toBeTruthy();
    expect(textOf(screen.getByTestId('glossary-term-lat'))).toBe(g.term_lat);
    expect(screen.getByText(g.meaning)).toBeTruthy();
    expect(screen.getByTestId('glossary-from-why')).toBeTruthy();
    for (const r of g.related ?? []) expect(screen.getByTestId(`glossary-related-${r}`)).toBeTruthy();
    for (const l of lessonsUsing) expect(screen.getByTestId(`glossary-lesson-${l.id}`)).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`glossary-lesson-${lessonsUsing[0].id}`));
    expect(router.push).toHaveBeenCalledWith(`/learn/lesson/${lessonsUsing[0].id}`);
    // Three languages: Hindi/Bhojpuri meanings appear only when their own text exists (no hi/bho glossary yet -> none, honest).
    expect(otherLanguageMeanings('lagna', 'en')).toEqual([]);
    expect(screen.queryByTestId('glossary-meaning-hi')).toBeNull();
    // Unknown id -> honest message, not a blank page.
    await renderWithProviders(<GlossaryDetail id="no-such-term" />);
    expect(screen.getByTestId('glossary-missing')).toBeTruthy();
  });

  it('every WhySheet glossary row keeps the one-liner preview and navigates to the term page (closing the sheet first)', async () => {
    const onClose = jest.fn();
    await renderWithProviders(<WhySheet ruleId="rahu-kaal" visible onClose={onClose} inputs={{ start: '10:40', end: '12:05' }} />);
    const row = screen.getByTestId('why-term-rahu-kaal');
    const g = loadGlossary('en').items.find((x) => x.id === 'rahu-kaal')!;
    expect(textOf(row)).toContain(g.term_dev);
    expect(textOf(row)).toContain(g.meaning);
    await fireEvent.press(row);
    expect(onClose).toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith('/learn/glossary/rahu-kaal?from=why');
  });

  // ---- F34 journal ----

  it('an entry takes two taps (chip + Save); moods are words, never emoji; the note is optional', async () => {
    expect(MOODS).toEqual(['calm', 'low', 'busy', 'bright', 'tense']);
    await renderWithProviders(<JournalScreen now={now} />);
    expect(screen.getByRole('header', { name: 'Journal · for reflection' })).toBeTruthy();
    expect(screen.getByText('How was today?')).toBeTruthy();
    const words = ['Calm', 'Low', 'Busy', 'Bright', 'Tense'];
    for (const w of words) expect(screen.getByText(w)).toBeTruthy();
    // Emoji / pictographs never appear anywhere on the screen.
    expect(allText()).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    const today = localDateOf(NOW, TZ);
    expect(getJournalEntry(today)).toBeNull();
    expect(screen.getByTestId('journal-save').props.accessibilityState.disabled).toBe(true);
    // Tap 1: the chip; tap 2: Save.
    await fireEvent.press(screen.getByTestId('journal-mood-bright'));
    expect(screen.getByTestId('journal-mood-bright').props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByTestId('journal-save'));
    expect(getJournalEntry(today)).toEqual({ day: today, mood: 'bright', note: null });
    expect(textOf(screen.getByTestId('journal-saved-mood'))).toBe('Bright');
    expect(screen.getByTestId(`journal-dot-${today}`)).toBeTruthy();
    expect(textOf(screen.getByTestId(`journal-dot-${today}`))).toBe('B');
    // Edit adds a note; Remove clears the day.
    await fireEvent.press(screen.getByTestId('journal-edit'));
    await fireEvent.changeText(screen.getByTestId('journal-note'), '  a quiet evening  ');
    await fireEvent.press(screen.getByTestId('journal-save'));
    expect(getJournalEntry(today)).toEqual({ day: today, mood: 'bright', note: 'a quiet evening' });
    expect(textOf(screen.getByTestId('journal-saved-note'))).toBe('a quiet evening');
    await fireEvent.press(screen.getByTestId('journal-remove'));
    expect(getJournalEntry(today)).toBeNull();
    expect(screen.queryByTestId(`journal-dot-${today}`)).toBeNull();
    // Wording: "for reflection" present, "proof" only inside "for reflection, not proof".
    const text = allText();
    expect(text).toContain('for reflection');
    expect(textOf(screen.getByTestId('journal-legend-footer'))).toBe('for reflection, not proof');
    expect(text.replace(/for reflection, not proof/g, '')).not.toMatch(/proof/i);
    expect(screen.queryByTestId('banner-strip')).toBeNull();
    assertNoTruncation();
  });

  it('the month model has 28-31 cells with engine Moon-house numbers (1-12) and dasha-change hairlines on the right days', () => {
    const p = priya();
    const chart = chartFor(p);
    const geo = { lat: p.lat, lon: p.lon };
    saveJournalEntry('2026-10-03', 'calm', null);
    saveJournalEntry('2026-10-21', 'tense', 'late night');
    const m = journalMonth('2026-10', { chart, geo, tz: TZ, entries: listJournalMonth('2026-10'), nowMs: NOW, withPratyantar: false });
    expect(m.cells.length).toBe(31);
    expect(m.leading).toBe(4); // 1 Oct 2026 is a Thursday
    expect(m.entryCount).toBe(2);
    expect(m.cells[2].mood).toBe('calm');
    expect(m.cells[20].note).toBe('late night');
    expect(m.cells.find((c) => c.isToday)?.day).toBe('2026-10-22');
    for (const c of m.cells) {
      expect(c.moonHouse).toBeGreaterThanOrEqual(1);
      expect(c.moonHouse).toBeLessThanOrEqual(12);
      expect(c.moonHouse).toBe(moonHouseOnDay(chart, c.day, geo, TZ));
    }
    // The Moon moves about one sign every 2.25 days: consecutive houses differ by at most 1 (mod 12) and cover most of the zodiac.
    const houses = m.cells.map((c) => c.moonHouse!);
    for (let i = 1; i < houses.length; i++) expect([0, 1].includes((houses[i] - houses[i - 1] + 12) % 12)).toBe(true);
    expect(new Set(houses).size).toBeGreaterThanOrEqual(12);
    expect(moonHouseOf(chart, chart.planets.find((x) => x.id === 'Mo')!.sign)).toBe(1);
    // Dasha hairlines: exactly the maha/antar changes of the month, on their civil days (pratyantar excluded on free).
    const from = Date.UTC(2026, 8, 30, 18, 30);
    const to = Date.UTC(2026, 9, 31, 18, 30);
    const expected = changesBetween(dashaFor(chart), from, to).filter((c) => c.level !== 'pratyantar');
    const marked = m.cells.filter((c) => c.dashaChanges.length);
    expect(marked.flatMap((c) => c.dashaChanges).map((c) => c.at).sort()).toEqual(expected.map((c) => c.at).sort());
    for (const c of marked) for (const ch of c.dashaChanges) expect(localDateOf(ch.at, TZ)).toBe(c.day);
    // With pratyantar (Pro) a month has at least as many marks, and across 2026 the pratyantar changes do appear.
    let proCount = 0;
    for (let mo = 1; mo <= 12; mo++) {
      const ym = `2026-${mo < 10 ? `0${mo}` : mo}`;
      const free = journalMonth(ym, { chart, geo, tz: TZ, entries: [], nowMs: NOW, withPratyantar: false });
      const pro = journalMonth(ym, { chart, geo, tz: TZ, entries: [], nowMs: NOW, withPratyantar: true });
      const f = free.cells.reduce((n, c) => n + c.dashaChanges.length, 0);
      const q = pro.cells.reduce((n, c) => n + c.dashaChanges.length, 0);
      expect(q).toBeGreaterThanOrEqual(f);
      proCount += q - f;
    }
    expect(proCount).toBeGreaterThan(0);
    // Other month lengths and navigation.
    expect(journalMonth('2026-02', { chart: null, geo, tz: TZ, entries: [], nowMs: NOW, withPratyantar: false }).cells.length).toBe(28);
    expect(journalMonth('2028-02', { chart: null, geo, tz: TZ, entries: [], nowMs: NOW, withPratyantar: false }).cells.length).toBe(29);
    expect(journalMonth('2026-11', { chart: null, geo, tz: TZ, entries: [], nowMs: NOW, withPratyantar: false }).cells[0].moonHouse).toBeNull();
    expect(shiftYearMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftYearMonth('2026-12', 1)).toBe('2027-01');
    expect(localDateOf(NOW + DAY_MS, TZ)).toBe('2026-10-23');
  });

  it('the month grid renders every cell with its Moon-house number, the dasha hairline and the legend; prev/next move the month', async () => {
    const p = priya();
    const chart = chartFor(p);
    saveJournalEntry('2026-10-03', 'low', null);
    await renderWithProviders(<JournalScreen now={now} />);
    expect(textOf(screen.getByTestId('journal-month-title'))).toBe('October 2026 · for reflection');
    expect(screen.getAllByTestId(/^journal-cell-2026-10-\d{2}$/).length).toBe(31);
    expect(screen.getAllByTestId(/^journal-house-2026-10-\d{2}$/).length).toBe(31);
    const m = journalMonth('2026-10', { chart, geo: { lat: p.lat, lon: p.lon }, tz: TZ, entries: [], nowMs: NOW, withPratyantar: false });
    for (const c of m.cells) {
      expect(textOf(screen.getByTestId(`journal-house-${c.day}`))).toBe(String(c.moonHouse));
      expect(textOf(screen.getByTestId(`journal-date-${c.day}`))).toBe(String(c.date));
      if (c.dashaChanges.length) expect(screen.getByTestId(`journal-dasha-${c.day}`)).toBeTruthy();
      else expect(screen.queryByTestId(`journal-dasha-${c.day}`)).toBeNull();
    }
    expect(textOf(screen.getByTestId('journal-dot-2026-10-03'))).toBe('L');
    const cell = screen.getByTestId('journal-cell-2026-10-03');
    expect(cell.props.accessibilityLabel).toContain('Mood Low');
    expect(cell.props.accessibilityLabel).toContain(`${m.cells[2].moonHouse}`);
    expect(screen.getByText('Legend')).toBeTruthy();
    expect(screen.getByText("Number = the day's Moon house from your birth Moon")).toBeTruthy();
    expect(screen.getByText('Line = dasha change')).toBeTruthy();
    expect(screen.getByText('for reflection, not proof')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('journal-prev'));
    expect(textOf(screen.getByTestId('journal-month-title'))).toBe('September 2026 · for reflection');
    expect(screen.getAllByTestId(/^journal-cell-2026-09-\d{2}$/).length).toBe(30);
    expect(screen.getByTestId('journal-empty-month')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('journal-next'));
    await fireEvent.press(screen.getByTestId('journal-next'));
    expect(textOf(screen.getByTestId('journal-month-title'))).toBe('November 2026 · for reflection');
    expect(screen.getAllByTestId(/^journal-cell-2026-11-\d{2}$/).length).toBe(30);
  });

  // ---- +30 % pseudo-locale ----

  for (const lang of ['en', 'hi', 'bho'] as const) {
    it(`pseudo-locale +30 % (${lang}): the lesson list and the journal render every padded string whole, no truncation`, async () => {
      globalThis.__PSEUDO_LOCALE__ = true;
      const tree = await renderWithProviders(<LearnScreen />, { lang });
      assertNoTruncation();
      expect(screen.getAllByTestId(/^lesson-lesson-\d+$/).length).toBeGreaterThanOrEqual(20);
      if (lang === 'en') expect(tree.toJSON()).toMatchSnapshot('learn-root');
      const journal = await renderWithProviders(<JournalScreen now={now} />, { lang });
      assertNoTruncation();
      expect(screen.getAllByTestId(/^journal-mood-(calm|low|busy|bright|tense)$/).length).toBe(5);
      if (lang === 'en') expect(journal.toJSON()).toMatchSnapshot('journal');
    });
  }
});
