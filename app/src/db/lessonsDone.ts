// lessons_done (F32): which lessons the reader has marked done, and when. The corpus level the Why? sheets may show
// is derived from these rows by app/src/learn/progress.ts; nothing commercial is ever keyed on them.
import { getDb, hasDb } from './connection';

export interface LessonDone {
  lessonId: string;
  doneAt: string;
}

export function listLessonsDone(): LessonDone[] {
  if (!hasDb()) return [];
  return getDb()
    .getAllSync<{ lesson_id: string; done_at: string }>('SELECT lesson_id, done_at FROM lessons_done ORDER BY done_at')
    .map((r) => ({ lessonId: r.lesson_id, doneAt: r.done_at }));
}

export function lessonDoneAt(lessonId: string): string | null {
  if (!hasDb()) return null;
  return getDb().getFirstSync<{ done_at: string }>('SELECT done_at FROM lessons_done WHERE lesson_id = ?', [lessonId])?.done_at ?? null;
}

export function markLessonDone(lessonId: string, now: Date = new Date()): string {
  const doneAt = now.toISOString();
  getDb().runSync('INSERT INTO lessons_done (lesson_id, done_at) VALUES (?, ?) ON CONFLICT(lesson_id) DO UPDATE SET done_at = excluded.done_at', [lessonId, doneAt]);
  return doneAt;
}

export function unmarkLessonDone(lessonId: string): void {
  getDb().runSync('DELETE FROM lessons_done WHERE lesson_id = ?', [lessonId]);
}
