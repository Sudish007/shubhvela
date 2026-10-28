// Lesson progress -> corpus level (F32, design.md 10.7). Corpus snippets carry `level 1 | 2 | 3`; "Mark done" on a lesson
// with `unlocksLevel` raises the level a Why? sheet may show. Rules in one place:
//   - unlockedLevel() = max(1, max unlocksLevel of the lessons marked done), capped at MAX_FREE_UNLOCK (2) so a lesson
//     never hands out the level-3 "full explanation" that spec section 9 sells as Pro (nothing commercial is unlocked);
//   - whyLevel(pro) = 3 for Pro, else unlockedLevel().
// The one domain with multi-level snippets today is `koota` (match/KootaRow); DoshaSection keeps its level-3-only texts.
import { loadLessons } from '@shubhvela/content';
import { listLessonsDone } from '../db/lessonsDone';

export type CorpusLevel = 1 | 2 | 3;

/** Highest level a free reader can reach by lessons alone (the level-3 full explanation stays with Pro). */
export const MAX_FREE_UNLOCK: CorpusLevel = 2;

/** Lesson ids marked done. */
export function doneLessonIds(): Set<string> {
  return new Set(listLessonsDone().map((d) => d.lessonId));
}

/** Pure form (tests): level from the done ids and the lesson table. */
export function levelFromDone(done: ReadonlySet<string>, lessons: readonly { id: string; unlocksLevel: 2 | 3 }[]): CorpusLevel {
  let level: CorpusLevel = 1;
  for (const l of lessons) if (done.has(l.id) && l.unlocksLevel > level) level = Math.min(l.unlocksLevel, MAX_FREE_UNLOCK) as CorpusLevel;
  return level;
}

/** Level the Why? sheets may show for a free reader after the lessons done so far (1 when none). */
export function unlockedLevel(): CorpusLevel {
  return levelFromDone(doneLessonIds(), loadLessons('en').items);
}

/** The level behind every Why? explanation: 3 on Pro (spec section 9), else what the lessons unlocked. */
export function whyLevel(pro: boolean): CorpusLevel {
  return pro ? 3 : unlockedLevel();
}

/** Progress line of the Learn root: done count over the lesson count. */
export function lessonProgress(total: number): { done: number; total: number; nextN: number | null } {
  const done = doneLessonIds();
  const items = loadLessons('en').items;
  const next = items.find((l) => !done.has(l.id));
  return { done: items.filter((l) => done.has(l.id)).length, total, nextN: next ? next.n : null };
}
