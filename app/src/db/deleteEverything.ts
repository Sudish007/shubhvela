// Settings -> Privacy -> Delete everything (spec section 10, design.md 10.1 / 3). Removes every row of every user table
// (profiles, settings, consent, unlocks, entitlement cache, journal ...), cancels every scheduled notification and
// clears the chart cache. Nothing is kept; the next launch starts at the consent screen.
import { clearChartCache } from '../engine-bridge/charts';
import { getDb } from './connection';
import { USER_TABLES } from './schema';

export interface DeleteEverythingDeps {
  /** expo-notifications cancelAllScheduledNotificationsAsync; injected so the repository stays testable. */
  cancelScheduledNotifications: () => Promise<void>;
}

export async function deleteEverything(deps: DeleteEverythingDeps): Promise<void> {
  try {
    await deps.cancelScheduledNotifications();
  } catch (e) {
    if (__DEV__) console.warn('cancelScheduledNotifications failed', e);
  }
  const db = getDb();
  db.execSync('BEGIN');
  try {
    for (const t of USER_TABLES) db.execSync(`DELETE FROM ${t}`);
    db.execSync('COMMIT');
  } catch (e) {
    db.execSync('ROLLBACK');
    throw e;
  }
  clearChartCache();
}
