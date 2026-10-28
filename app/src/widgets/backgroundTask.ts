// expo-background-task job `extend-widget-state` (design.md 10.2 F9, plan P4 + N12). WorkManager runs it every >= 12 h
// (inexact; Doze deferral accepted) while the app is in the background: it rewrites files/widget_state.json when fewer
// than two Vedic days remain or the file is older than 12 h, and it ALWAYS re-plans the local reminders for the next 60
// days (same planner as the launch re-plan, cap 300). defineTask must run at module scope (app/_layout.tsx imports this
// file); registration happens after consent so nothing runs for a user who has not accepted the notice yet.
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { replanAll, type ReplanResult } from '../notifications/schedule';
import { extensionReason } from './state';
import { readWidgetState, writeWidgetState, type WidgetFileDeps, type WriteWidgetStateResult } from './writeState';

export const EXTEND_WIDGET_STATE_TASK = 'extend-widget-state';
/** Minimum interval in minutes (expo-background-task unit): 12 hours. */
export const EXTEND_WIDGET_STATE_INTERVAL_MINUTES = 12 * 60;

export interface ExtendDeps {
  nowMs?: () => number;
  files?: WidgetFileDeps;
  replan?: () => Promise<ReplanResult>;
}

export interface ExtendResult {
  reason: ReturnType<typeof extensionReason>;
  write: WriteWidgetStateResult | null;
  replan: ReplanResult;
}

/** The job body (pure w.r.t. its deps; tested without the OS). */
export async function runExtendWidgetState(deps: ExtendDeps = {}): Promise<ExtendResult> {
  const nowMs = (deps.nowMs ?? Date.now)();
  const current = await readWidgetState(deps.files);
  const reason = extensionReason(current, nowMs);
  const write = reason ? await writeWidgetState({ nowMs, deps: deps.files, force: true }) : null;
  const replan = await (deps.replan ?? (() => replanAll({ nowMs })))();
  return { reason, write, replan };
}

let defined = false;
/** Registers the executor with expo-task-manager (idempotent; module scope of the root layout). */
export function defineExtendWidgetStateTask(deps: ExtendDeps = {}): void {
  if (defined) return;
  defined = true;
  TaskManager.defineTask(EXTEND_WIDGET_STATE_TASK, async () => {
    try {
      await runExtendWidgetState(deps);
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch (e) {
      if (__DEV__) console.warn('extend-widget-state failed', e);
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

/** Schedules the job (WorkManager under the hood). Safe to call on every launch; false when the API is unavailable. */
export async function registerExtendWidgetStateTask(): Promise<boolean> {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return false;
    if (await TaskManager.isTaskRegisteredAsync(EXTEND_WIDGET_STATE_TASK)) return true;
    await BackgroundTask.registerTaskAsync(EXTEND_WIDGET_STATE_TASK, { minimumInterval: EXTEND_WIDGET_STATE_INTERVAL_MINUTES });
    return true;
  } catch (e) {
    if (__DEV__) console.warn('extend-widget-state registration failed', e);
    return false;
  }
}
