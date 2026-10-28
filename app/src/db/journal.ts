// Reflection journal rows (F34, design.md 10.7): one row per civil day (`day` = YYYY-MM-DD in the profile's zone),
// a mood WORD key and an optional note. Nothing here is interpreted; the month view overlays engine facts (Moon house,
// dasha changes) on these rows "for reflection", never as evidence. Exported by the encrypted backup (C04).
import { getDb } from './connection';

export const MOODS = ['calm', 'low', 'busy', 'bright', 'tense'] as const;
export type Mood = (typeof MOODS)[number];

export interface JournalEntry {
  day: string;
  mood: Mood | null;
  note: string | null;
}

interface Row {
  day: string;
  mood: string | null;
  note: string | null;
}

export function isMood(v: unknown): v is Mood {
  return typeof v === 'string' && (MOODS as readonly string[]).includes(v);
}

function fromRow(r: Row): JournalEntry {
  return { day: r.day, mood: isMood(r.mood) ? r.mood : null, note: r.note && r.note.length ? r.note : null };
}

export function getJournalEntry(day: string): JournalEntry | null {
  const row = getDb().getFirstSync<Row>('SELECT day, mood, note FROM journal WHERE day = ?', [day]);
  return row ? fromRow(row) : null;
}

/** Inserts or replaces the day's entry; an empty note is stored as NULL. */
export function saveJournalEntry(day: string, mood: Mood | null, note: string | null): JournalEntry {
  const cleanNote = note?.trim() ? note.trim() : null;
  getDb().runSync('INSERT INTO journal (day, mood, note) VALUES (?, ?, ?) ON CONFLICT(day) DO UPDATE SET mood = excluded.mood, note = excluded.note', [day, mood, cleanNote]);
  return { day, mood, note: cleanNote };
}

export function deleteJournalEntry(day: string): void {
  getDb().runSync('DELETE FROM journal WHERE day = ?', [day]);
}

/** Every entry of a month (`yyyy-mm`), ascending by day. */
export function listJournalMonth(yearMonth: string): JournalEntry[] {
  return getDb()
    .getAllSync<Row>('SELECT day, mood, note FROM journal WHERE day LIKE ? ORDER BY day', [`${yearMonth}-%`])
    .map(fromRow);
}

export function countJournalEntries(): number {
  return getDb().getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM journal')?.n ?? 0;
}
