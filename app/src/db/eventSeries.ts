// Reminder series (F20-F22, F25). A09 only needs the count of ENABLED series for entitlements.canAddReminder();
// A12 adds planning and scheduling. Kinds: tithi_birthday (ref = profile id), barsi (ref = ancestor id),
// vrat_family (ref = engine VratFamily key).
import { getDb } from './connection';

export type SeriesKind = 'tithi_birthday' | 'barsi' | 'vrat_family';

export function countEnabledSeries(): number {
  return getDb().getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM event_series WHERE enabled = 1')?.n ?? 0;
}

export function setSeriesEnabled(kind: SeriesKind, refId: string, enabled: boolean): void {
  getDb().runSync(
    'INSERT INTO event_series (kind, ref_id, enabled) VALUES (?, ?, ?) ON CONFLICT(kind, ref_id) DO UPDATE SET enabled = excluded.enabled',
    [kind, refId, enabled ? 1 : 0],
  );
}
