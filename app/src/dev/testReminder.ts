// F25 smoke test helper (screenshot build only, reached via shubhvela://dev/state?...&test_reminder=1): asks for the
// notification permission and schedules ONE reminder 2 minutes ahead through the same expo-notifications bridge the
// planner uses, so the airplane-mode test on the emulator exercises the real channel + DATE trigger path.
import type { Lang } from '../db/settings';
import { requestPermission } from '../notifications/permissions';
import { expoScheduleDeps } from '../notifications/schedule';

export const TEST_REMINDER_DELAY_MS = 2 * 60 * 1000;

export async function scheduleTestReminder(lang: Lang, nowMs = Date.now()): Promise<string | null> {
  const permission = await requestPermission();
  if (permission !== 'granted') {
    if (__DEV__) console.warn('test reminder: permission', permission);
    return null;
  }
  await expoScheduleDeps.ensureChannel(lang);
  const fireAtMs = nowMs + TEST_REMINDER_DELAY_MS;
  return expoScheduleDeps.schedule({
    key: 'test_reminder',
    kind: 'daily_note',
    refId: null,
    date: new Date(fireAtMs).toISOString().slice(0, 10),
    slot: 'daily',
    fireAtMs,
    title: 'Shubhvela test reminder',
    body: `Scheduled at ${new Date(nowMs).toISOString()} for +2 min (F25 airplane-mode smoke).`,
  });
}
