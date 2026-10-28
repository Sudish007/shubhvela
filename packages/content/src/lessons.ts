// Lessons (F32, C02): loaders over corpus/lessons/<lang>.json and the placeholder contract the app's resolver fills
// from the reader's own chart. The list below mirrors the `placeholders` block of schema/lesson.schema.json (the test
// asserts the two are identical) so the app can type its resolver as Record<LessonPlaceholder, string> and the
// content tests can reject any {placeholder} a lesson body uses that the app cannot fill.
import type { ContentLanguage, Lesson, TranslationParams } from './types';
import { LESSONS } from './registry';
import { FALLBACK_CHAIN, resolve, type Resolved } from './load';
import { interpolate, paramsOf } from './t';

/**
 * Every placeholder a lesson body may use, in schema order. Values are display strings in the UI language, already
 * formatted by the app (sign/planet/nakshatra names from the engine locale tables, dates via formatInZone, numbers as
 * Latin digits). When a value cannot be computed (unknown birth time -> no Lagna) the app passes the UI string
 * `lesson.lagnaUnknown` / `lesson.noYoga`, never an empty string, so a sentence always reads.
 */
export const LESSON_PLACEHOLDERS = [
  'name',
  'moonSign',
  'moonSignLord',
  'lagna',
  'lagnaLord',
  'sunSign',
  'nakshatra',
  'pada',
  'nakshatraLord',
  'mahaLord',
  'mahaEnds',
  'antarLord',
  'antarEnds',
  'balanceLord',
  'balanceYears',
  'saturnSign',
  'saturnHouseFromMoon',
  'saturnHouse',
  'jupiterSign',
  'jupiterHouse',
  'marsHouse',
  'venusSign',
  'mercurySign',
  'rahuHouse',
  'ketuHouse',
  'moonHouse',
  'sunHouse',
  'moonDegree',
  'moonNavamsaSign',
  'lagnaNavamsaSign',
  'tenthLord',
  'seventhLord',
  'birthTithi',
  'birthVara',
  'birthYoga',
  'birthKarana',
  'birthPlace',
  'birthTz',
  'ayanamsa',
  'ayanamsaDegrees',
  'nodeMode',
  'todayMoonSign',
  'todayMoonHouseFromMoon',
  'todayTara',
  'todayTithi',
  'todayNakshatra',
  'todayVara',
  'rahuKaalToday',
  'sunriseToday',
  'sunsetToday',
  'nextJanmaTithi',
  'savLagna',
  'savTenth',
  'yogaCount',
  'firstYoga',
  'kpLagnaSubLord',
  'ephemeris',
] as const;

export type LessonPlaceholder = (typeof LESSON_PLACEHOLDERS)[number];

/** Values the app computed for one profile; missing keys leave the `{placeholder}` visible (never silently blank). */
export type LessonValues = Partial<Record<LessonPlaceholder, string | number>>;

/** All lessons in the first chain language that has a file, ordered by `n`. */
export function loadLessons(lang: ContentLanguage): { items: Lesson[]; lang: ContentLanguage; fallback: boolean } {
  for (const l of FALLBACK_CHAIN[lang]) {
    const rows = LESSONS[l];
    if (rows) return { items: [...rows].sort((a, b) => a.n - b.n), lang: l, fallback: l !== lang };
  }
  return { items: [], lang, fallback: false };
}

/** One lesson by id (`lesson-01`), walking the fallback chain per entry. */
export function lesson(id: string, lang: ContentLanguage): Resolved<Lesson> | null {
  return resolve(LESSONS, lang, (rows) => rows.find((l) => l.id === id));
}

/** The placeholder names a lesson's body uses (deduplicated, in order of first appearance). */
export function lessonPlaceholders(l: Lesson): string[] {
  return paramsOf(l.body.join(' '));
}

/** Body paragraphs with the reader's values filled in; unknown placeholders stay visible as `{name}`. */
export function renderLesson(l: Lesson, values: LessonValues): string[] {
  return l.body.map((para) => interpolate(para, values as TranslationParams));
}
