// Reminder preferences (design.md 10.4 F25): the evening-before / morning-of times per event kind (defaults 19:00 and
// 07:00, editable in Settings -> Notifications), the opt-in daily-note notification (default Off) and the list of
// series the last re-plan could not schedule (shown as a "not scheduled" tag on that card). Stored in the settings
// table under `reminder.*` keys; every read validates the stored value and falls back to the default.
import type { SeriesKind } from './eventSeries';
import { getDb } from './connection';

export type ReminderSlot = 'evening' | 'morning';

export interface KindTimes {
  /** HH:MM, evening of the day before the event. */
  evening: string;
  /** HH:MM, morning of the event day. */
  morning: string;
}

export type ReminderTimes = Record<SeriesKind, KindTimes>;

export const DEFAULT_EVENING = '19:00';
export const DEFAULT_MORNING = '07:00';
export const SERIES_KINDS: readonly SeriesKind[] = ['tithi_birthday', 'barsi', 'vrat_family'];

export const DEFAULT_REMINDER_TIMES: ReminderTimes = {
  tithi_birthday: { evening: DEFAULT_EVENING, morning: DEFAULT_MORNING },
  barsi: { evening: DEFAULT_EVENING, morning: DEFAULT_MORNING },
  vrat_family: { evening: DEFAULT_EVENING, morning: DEFAULT_MORNING },
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isHHMM(v: string | null | undefined): v is string {
  return typeof v === 'string' && HHMM.test(v);
}

function read(key: string): string | null {
  return getDb().getFirstSync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key])?.value ?? null;
}

function write(key: string, value: string): void {
  getDb().runSync('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
}

export function getReminderTime(kind: SeriesKind, slot: ReminderSlot): string {
  const v = read(`reminder.${kind}.${slot}`);
  return isHHMM(v) ? v : DEFAULT_REMINDER_TIMES[kind][slot];
}

export function setReminderTime(kind: SeriesKind, slot: ReminderSlot, hhmm: string): void {
  if (!isHHMM(hhmm)) throw new Error(`Invalid time ${hhmm}`);
  write(`reminder.${kind}.${slot}`, hhmm);
}

export function getReminderTimes(): ReminderTimes {
  return {
    tithi_birthday: { evening: getReminderTime('tithi_birthday', 'evening'), morning: getReminderTime('tithi_birthday', 'morning') },
    barsi: { evening: getReminderTime('barsi', 'evening'), morning: getReminderTime('barsi', 'morning') },
    vrat_family: { evening: getReminderTime('vrat_family', 'evening'), morning: getReminderTime('vrat_family', 'morning') },
  };
}

/** The daily-note notification is opt-in (default Off); when On it fires at `time` every morning. */
export function getDailyNoteSetting(): { enabled: boolean; time: string } {
  const t = read('reminder.dailyNote.time');
  return { enabled: read('reminder.dailyNote.enabled') === '1', time: isHHMM(t) ? t : DEFAULT_MORNING };
}

export function setDailyNoteEnabled(enabled: boolean): void {
  write('reminder.dailyNote.enabled', enabled ? '1' : '0');
}

export function setDailyNoteTime(hhmm: string): void {
  if (!isHHMM(hhmm)) throw new Error(`Invalid time ${hhmm}`);
  write('reminder.dailyNote.time', hhmm);
}

/** Series keys (eventSeries.seriesKey) whose notifications the OS refused in the last re-plan. */
export function getFailedSeries(): string[] {
  const v = read('reminder.failedSeries');
  if (!v) return [];
  try {
    const arr = JSON.parse(v) as unknown;
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function setFailedSeries(keys: readonly string[]): void {
  write('reminder.failedSeries', JSON.stringify([...new Set(keys)]));
}

/** ISO instant of the last successful re-plan (Settings -> Notifications caption). */
export function getLastPlannedAt(): string | null {
  return read('reminder.lastPlannedAt');
}

export function setLastPlannedAt(iso: string): void {
  write('reminder.lastPlannedAt', iso);
}
