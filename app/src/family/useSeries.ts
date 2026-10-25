// Series switches (design.md 10.4 F25): one hook behind every On/Off switch on the Family cards, the vrat screens and
// Settings -> Vrats. Switching ON asks for the notification permission first (denied -> the switch stays Off and the
// inline "Allow notifications in Android settings" row appears), then asks entitlements.canAddReminder() (the 6th
// enabled series on free opens the honest Pro sheet instead of switching), then persists and re-plans. Switching OFF
// always works and re-plans. The hook never decides caps itself (entitlements.ts is the only gate).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { countEnabledSeries, listEnabledSeries, setSeriesEnabled, seriesKey, type SeriesKind } from '../db/eventSeries';
import { getFailedSeries } from '../db/reminderSettings';
import { canAddReminder, FREE_REMINDER_SERIES_CAP, isPro } from '../entitlements';
import { getPermissionState, requestPermission, type PermissionState } from '../notifications/permissions';
import { replanAll, type ReplanResult } from '../notifications/schedule';

export interface SeriesState {
  /** Keys of enabled series (eventSeries.seriesKey). */
  enabled: Set<string>;
  enabledCount: number;
  /** Free cap, or null on Pro. */
  cap: number | null;
  /** Series whose notifications the OS refused in the last re-plan ("not scheduled" tag). */
  failed: Set<string>;
  permission: PermissionState;
  /** The honest Pro sheet is open (6th series on free). */
  capOpen: boolean;
  closeCap: () => void;
  isEnabled: (kind: SeriesKind, refId: string) => boolean;
  /** Returns the resulting enabled state. */
  toggle: (kind: SeriesKind, refId: string, next: boolean) => Promise<boolean>;
  /** Re-read the DB (after another screen changed something). */
  refresh: () => void;
}

export interface UseSeriesOptions {
  /** Injected for tests; production uses expo-notifications and the scheduler. */
  getPermission?: () => Promise<PermissionState>;
  requestPermission?: () => Promise<PermissionState>;
  replan?: () => Promise<ReplanResult>;
  /** Called after a successful change (screens recompute their model). */
  onChange?: () => void;
}

function readEnabled(): Set<string> {
  return new Set(listEnabledSeries().map((s) => seriesKey(s.kind, s.refId)));
}

export function useSeries(opts: UseSeriesOptions = {}): SeriesState {
  const getPerm = opts.getPermission ?? getPermissionState;
  const askPerm = opts.requestPermission ?? requestPermission;
  const injectedReplan = opts.replan;
  const replan = useMemo(() => injectedReplan ?? (() => replanAll()), [injectedReplan]);
  const [enabled, setEnabled] = useState<Set<string>>(readEnabled);
  const [failed, setFailed] = useState<Set<string>>(() => new Set(getFailedSeries()));
  const [permission, setPermission] = useState<PermissionState>('unknown');
  const [capOpen, setCapOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    getPerm().then((p) => alive && setPermission(p));
    return () => {
      alive = false;
    };
  }, [getPerm]);

  const refresh = useCallback(() => {
    setEnabled(readEnabled());
    setFailed(new Set(getFailedSeries()));
  }, []);

  const toggle = useCallback(
    async (kind: SeriesKind, refId: string, next: boolean): Promise<boolean> => {
      const key = seriesKey(kind, refId);
      const was = enabled.has(key);
      if (!next) {
        if (was) {
          setSeriesEnabled(kind, refId, false);
          setEnabled(readEnabled());
          const r = await replan();
          setFailed(new Set(r.failed));
          opts.onChange?.();
        }
        return false;
      }
      if (was) return true;
      const perm = await askPerm();
      setPermission(perm);
      if (perm !== 'granted') return false;
      const decision = canAddReminder(countEnabledSeries());
      if (!decision.allowed) {
        setCapOpen(true);
        return false;
      }
      setSeriesEnabled(kind, refId, true);
      setEnabled(readEnabled());
      const r = await replan();
      setFailed(new Set(r.failed));
      opts.onChange?.();
      return true;
    },
    [enabled, askPerm, replan, opts],
  );

  return {
    enabled,
    enabledCount: enabled.size,
    cap: isPro() ? null : FREE_REMINDER_SERIES_CAP,
    failed,
    permission,
    capOpen,
    closeCap: () => setCapOpen(false),
    isEnabled: (kind, refId) => enabled.has(seriesKey(kind, refId)),
    toggle,
    refresh,
  };
}
