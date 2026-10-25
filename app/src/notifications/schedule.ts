// Local scheduling (design.md 10.4 F25, M15, N12): wraps expo-notifications (channel 'events', local only, no server).
// replanAll() is called on every app launch and after every switch change: it gathers the enabled series from SQLite,
// asks the planner for the next 60 days (cap 300), cancels everything previously scheduled and schedules the plan one
// by one. A failure on one notification is caught, logged in dev only, and recorded against its series so the card can
// show the "not scheduled" tag; the other notifications still go through. Without a granted permission nothing is
// scheduled and the stored list is cleared (the switches cannot be On in that state).
import * as Notifications from 'expo-notifications';
import { AndroidImportance, SchedulableTriggerInputTypes } from 'expo-notifications';
import { Platform } from 'react-native';
import { hasDb } from '../db/connection';
import { listAncestors } from '../db/ancestors';
import { enabledVratFamilies, listEnabledSeries, seriesId, type SeriesKind } from '../db/eventSeries';
import { getProfile, getSelfProfile, type Profile } from '../db/profiles';
import { getDailyNoteSetting, getReminderTimes, setFailedSeries, setLastPlannedAt } from '../db/reminderSettings';
import { clearScheduled, insertScheduled } from '../db/scheduled';
import { getSetting } from '../db/settings';
import { chartFor } from '../engine-bridge/charts';
import { translate, type Lang } from '../i18n';
import { getPermissionState } from './permissions';
import { planNotifications, type PlannedNotification, type PlannerAncestor, type PlannerInput, type PlannerProfile } from './planner';

export const EVENTS_CHANNEL = 'events';

export interface ScheduleDeps {
  ensureChannel(lang: Lang): Promise<void>;
  cancelAll(): Promise<void>;
  schedule(n: PlannedNotification): Promise<string>;
}

/** The real expo-notifications bridge. */
export const expoScheduleDeps: ScheduleDeps = {
  async ensureChannel(lang) {
    if (Platform.OS !== 'android') return;
    await Notifications.setNotificationChannelAsync(EVENTS_CHANNEL, {
      name: translate(lang, 'reminders.channel.events'),
      importance: AndroidImportance.DEFAULT,
    });
  },
  async cancelAll() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  },
  async schedule(n) {
    return Notifications.scheduleNotificationAsync({
      content: { title: n.title, body: n.body, data: { key: n.key, date: n.date, slot: n.slot } },
      trigger: { type: SchedulableTriggerInputTypes.DATE, date: new Date(n.fireAtMs), channelId: EVENTS_CHANNEL },
    });
  },
};

export interface ReplanResult {
  /** Notifications the OS accepted. */
  scheduled: number;
  /** Series keys with at least one refused notification ("not scheduled" tag). */
  failed: string[];
  /** Why nothing was scheduled, when nothing was. */
  skipped?: 'permission' | 'no-profile' | 'no-db';
  planned: number;
}

/** Hands a plan to the OS: cancel everything, schedule each entry, record ids and failures. Pure w.r.t. the DB inputs. */
export async function applyPlan(plan: readonly PlannedNotification[], lang: Lang, deps: ScheduleDeps = expoScheduleDeps): Promise<ReplanResult> {
  await deps.cancelAll();
  if (hasDb()) clearScheduled();
  const failed = new Set<string>();
  const rows: { seriesId: number; fireAt: string; notificationId: string }[] = [];
  if (plan.length) await deps.ensureChannel(lang);
  for (const n of plan) {
    try {
      const id = await deps.schedule(n);
      rows.push({ seriesId: n.kind === 'daily_note' ? 0 : seriesId(n.kind as SeriesKind, n.refId ?? ''), fireAt: new Date(n.fireAtMs).toISOString(), notificationId: id });
    } catch (e) {
      if (__DEV__) console.warn('schedule failed', n.key, n.date, e);
      failed.add(n.key);
    }
  }
  if (hasDb()) {
    insertScheduled(rows);
    setFailedSeries([...failed]);
    setLastPlannedAt(new Date().toISOString());
  }
  return { scheduled: rows.length, failed: [...failed], planned: plan.length };
}

/** Observer for scheduling: the self profile's place (deterministic; GPS mode only moves the Today band). */
export function schedulingObserver(self: Profile): { geo: { lat: number; lon: number }; tz: string } {
  return { geo: { lat: self.lat, lon: self.lon }, tz: self.tz };
}

/** Builds the planner input from SQLite for the enabled series only. */
export function plannerInputFromDb(nowMs: number, lang: Lang): PlannerInput | null {
  const self = getSelfProfile();
  if (!self) return null;
  const { geo, tz } = schedulingObserver(self);
  const enabled = listEnabledSeries();
  const profiles: PlannerProfile[] = [];
  for (const s of enabled.filter((x) => x.kind === 'tithi_birthday')) {
    const p = getProfile(Number(s.refId));
    if (!p) continue;
    try {
      profiles.push({ id: p.id, name: p.name, relationLabel: translate(lang, `family.relation.${p.relationship}`), chart: chartFor(p), tradition: p.tradition });
    } catch (e) {
      if (__DEV__) console.warn('chart failed for reminders', p.id, e);
    }
  }
  const enabledAncestors = new Set(enabled.filter((x) => x.kind === 'barsi').map((x) => x.refId));
  const ancestors: PlannerAncestor[] = listAncestors()
    .filter((a) => enabledAncestors.has(String(a.id)))
    .map((a) => ({ id: a.id, name: a.name, deathMonth: a.deathMonth, paksha: a.paksha, tithi: a.tithi, year: a.year }));
  return {
    nowMs,
    geo,
    tz,
    lang,
    tradition: self.tradition,
    profiles,
    ancestors,
    vratFamilies: enabledVratFamilies(),
    times: getReminderTimes(),
    dailyNote: getDailyNoteSetting(),
  };
}

/** Re-plan everything (app launch, switch change, time change). Safe to call often; never throws. */
export async function replanAll(opts: { nowMs?: number; lang?: Lang; deps?: ScheduleDeps; permission?: () => Promise<string> } = {}): Promise<ReplanResult> {
  if (!hasDb()) return { scheduled: 0, failed: [], skipped: 'no-db', planned: 0 };
  const lang = opts.lang ?? getSetting('language');
  const deps = opts.deps ?? expoScheduleDeps;
  const perm = await (opts.permission ?? getPermissionState)();
  if (perm !== 'granted') {
    try {
      await deps.cancelAll();
    } catch {}
    clearScheduled();
    setFailedSeries([]);
    return { scheduled: 0, failed: [], skipped: 'permission', planned: 0 };
  }
  const input = plannerInputFromDb(opts.nowMs ?? Date.now(), lang);
  if (!input) {
    await applyPlan([], lang, deps);
    return { scheduled: 0, failed: [], skipped: 'no-profile', planned: 0 };
  }
  try {
    return await applyPlan(planNotifications(input), lang, deps);
  } catch (e) {
    if (__DEV__) console.warn('replan failed', e);
    return { scheduled: 0, failed: [], planned: 0 };
  }
}
