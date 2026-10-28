// Screenshot-mode helper (C01 for C05): writes files/widget_state.json as if the app had last run 40 hours ago ("stale":
// today's day is still in the file, so the band renders with the footer "Open Shubhvela to refresh") or 9 days ago
// ("exhausted": every day has passed, so the widget keeps the last known day and shows the footer). The content is still
// real engine output for the seeded place; only the clock handed to the writer is moved. A release build cannot edit the
// file through adb (no run-as), which is why this exists behind EXPO_PUBLIC_SCREENSHOT_MODE.
import type { DevWidgetState } from './params';
import { WIDGET_STALE_AFTER_MS } from '../widgets/state';
import { writeWidgetState, type WriteWidgetStateResult } from '../widgets/writeState';

export const DEV_STALE_AGE_MS = WIDGET_STALE_AFTER_MS + 4 * 3_600_000;
export const DEV_EXHAUSTED_AGE_MS = 9 * 24 * 3_600_000;

export function devWidgetClock(mode: DevWidgetState, now = Date.now()): number {
  return now - (mode === 'stale' ? DEV_STALE_AGE_MS : DEV_EXHAUSTED_AGE_MS);
}

export function writeDevWidgetState(mode: DevWidgetState, now = Date.now()): Promise<WriteWidgetStateResult> {
  return writeWidgetState({ nowMs: devWidgetClock(mode, now), force: true });
}
