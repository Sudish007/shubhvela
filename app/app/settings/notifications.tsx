// Settings -> Notifications (design.md 10.4 F25, plan A12): the real permission state (expo-notifications) with the
// request / open-settings action; the evening-before and morning-of times per event kind (defaults 19:00 / 07:00, native
// time picker, re-planned on change); the opt-in "Daily note" switch (default Off) with its time; the "Scheduled" count
// (what the OS really holds after the last re-plan) with the next entries as a plain list; the quiet-by-default line.
// "Dasha change alerts" (B04) and "Exact widget updates" (C01) are NOT rendered before those builds - nothing fake.
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, NavRow, PrimaryButton, Screen, SwitchRow, Txt } from '../../src/components';
import { getAncestor } from '../../src/db/ancestors';
import type { SeriesKind } from '../../src/db/eventSeries';
import { getProfile, getSelfProfile } from '../../src/db/profiles';
import {
  SERIES_KINDS,
  getDailyNoteSetting,
  getLastPlannedAt,
  getReminderTimes,
  setDailyNoteEnabled,
  setDailyNoteTime,
  setReminderTime,
  type ReminderSlot,
  type ReminderTimes,
} from '../../src/db/reminderSettings';
import { countScheduled, listScheduledDetailed, type ScheduledDetail } from '../../src/db/scheduled';
import { useLang } from '../../src/i18n';
import { getPermissionState, openSystemNotificationSettings, requestPermission, type PermissionState } from '../../src/notifications/permissions';
import { replanAll, type ReplanResult } from '../../src/notifications/schedule';
import { pickTime } from '../../src/profiles/nativePickers';
import { fmtDayTime } from '../../src/today/format';
import { RichText } from '../../src/today/RichText';

export interface NotificationsScreenProps {
  /** Injection for tests. */
  getPermission?: () => Promise<PermissionState>;
  requestPermission?: () => Promise<PermissionState>;
  replan?: () => Promise<ReplanResult>;
  pickTime?: (current: string, onPick: (hhmm: string) => void) => void;
}

const KIND_KEY: Record<SeriesKind, string> = { tithi_birthday: 'reminders.kind.tithiBirthday', barsi: 'reminders.kind.barsi', vrat_family: 'reminders.kind.vrat' };

function scheduledLabel(d: ScheduledDetail, t: (k: string, p?: Record<string, string | number>) => string): string {
  if (!d.kind) return t('reminders.kind.dailyNote');
  const kind = t(KIND_KEY[d.kind as SeriesKind] ?? 'reminders.title');
  if (d.kind === 'tithi_birthday' && d.refId) {
    const p = getProfile(Number(d.refId));
    return `${kind} · ${p?.name ?? (p ? t(`family.relation.${p.relationship}`) : '')}`;
  }
  if (d.kind === 'barsi' && d.refId) return `${kind} · ${getAncestor(Number(d.refId))?.name ?? ''}`;
  if (d.kind === 'vrat_family' && d.refId) return `${kind} · ${t(`vrat.family.${d.refId}`)}`;
  return kind;
}

export default function NotificationsScreen(props: NotificationsScreenProps) {
  const { t, lang } = useLang();
  const getPerm = props.getPermission ?? getPermissionState;
  const askPerm = props.requestPermission ?? requestPermission;
  const replan = props.replan ?? (() => replanAll());
  const pick = props.pickTime ?? pickTime;
  const [perm, setPerm] = useState<PermissionState>('unknown');
  const [times, setTimes] = useState<ReminderTimes>(() => getReminderTimes());
  const [daily, setDaily] = useState(() => getDailyNoteSetting());
  const [scheduled, setScheduled] = useState(() => ({ count: countScheduled(), list: listScheduledDetailed(20), at: getLastPlannedAt() }));

  const refreshScheduled = useCallback(() => setScheduled({ count: countScheduled(), list: listScheduledDetailed(20), at: getLastPlannedAt() }), []);
  useFocusEffect(refreshScheduled);

  useEffect(() => {
    let alive = true;
    getPerm().then((p) => alive && setPerm(p));
    return () => {
      alive = false;
    };
  }, [getPerm]);

  async function request() {
    if (perm === 'denied') return openSystemNotificationSettings();
    const p = await askPerm();
    setPerm(p);
    if (p === 'granted') {
      await replan();
      refreshScheduled();
    }
  }

  function changeTime(kind: SeriesKind, slot: ReminderSlot) {
    pick(times[kind][slot], (hhmm) => {
      setReminderTime(kind, slot, hhmm);
      setTimes(getReminderTimes());
      void replan().then(refreshScheduled);
    });
  }

  function toggleDaily(v: boolean) {
    setDailyNoteEnabled(v);
    setDaily(getDailyNoteSetting());
    void replan().then(refreshScheduled);
  }

  function changeDailyTime() {
    pick(daily.time, (hhmm) => {
      setDailyNoteTime(hhmm);
      setDaily(getDailyNoteSetting());
      void replan().then(refreshScheduled);
    });
  }

  const permText = perm === 'granted' ? t('reminders.permissionGranted') : perm === 'denied' ? t('reminders.permissionDenied') : t('reminders.permission');

  return (
    <Screen title={t('reminders.title')} chrome="stack" testID="notifications-screen">
      <Card>
        <Txt kind="body" testID="permission-text">
          {permText}
        </Txt>
        {perm !== 'granted' && perm !== 'unknown' ? <PrimaryButton label={perm === 'denied' ? t('common.openSettings') : t('reminders.allow')} onPress={request} style={styles.cta} testID="permission-button" /> : null}
      </Card>

      <Txt kind="heading" accessibilityRole="header">
        {t('reminders.perKind')}
      </Txt>
      {SERIES_KINDS.map((kind) => (
        <Card flush key={kind} testID={`times-${kind}`}>
          <View style={styles.kindHead}>
            <Txt kind="label" weight={600}>
              {t(KIND_KEY[kind])}
            </Txt>
          </View>
          <NavRow title={t('reminders.evening')} value={times[kind].evening} onPress={() => changeTime(kind, 'evening')} testID={`time-${kind}-evening`} />
          <NavRow title={t('reminders.morning')} value={times[kind].morning} onPress={() => changeTime(kind, 'morning')} divider={false} testID={`time-${kind}-morning`} />
        </Card>
      ))}

      <Card flush>
        <SwitchRow title={t('reminders.kind.dailyNote')} caption={t('reminders.dailyNoteBody')} value={daily.enabled} onValueChange={toggleDaily} disabled={perm !== 'granted'} divider={daily.enabled} testID="daily-note-switch" />
        {daily.enabled ? <NavRow title={t('reminders.morning')} value={daily.time} onPress={changeDailyTime} divider={false} testID="daily-note-time" /> : null}
      </Card>

      <Card testID="scheduled-card">
        <Txt kind="heading" accessibilityRole="header">
          {t('reminders.scheduled')}
        </Txt>
        <RichText kind="body" text={scheduled.count === 0 ? t('reminders.scheduledNone') : t('reminders.scheduledCount', { count: scheduled.count })} testID="scheduled-count" />
        {scheduled.at ? <RichText kind="caption" color="ink3" text={t('reminders.lastPlanned', { date: fmtDayTime(new Date(scheduled.at).getTime(), getProfileTz(), lang) })} /> : null}
        {scheduled.list.map((d, i) => (
          <View key={`${d.fireAt}-${i}`} style={styles.scheduledRow} testID="scheduled-row">
            <RichText kind="caption" color="ink2" text={fmtDayTime(new Date(d.fireAt).getTime(), getProfileTz(), lang)} style={styles.scheduledWhen} />
            <Txt kind="caption" color="ink2" style={styles.scheduledWhat}>
              {scheduledLabel(d, t)}
            </Txt>
          </View>
        ))}
        {scheduled.count > scheduled.list.length ? (
          <Txt kind="caption" color="ink3">
            {t('reminders.andMore', { count: scheduled.count - scheduled.list.length })}
          </Txt>
        ) : null}
      </Card>

      <Txt kind="body" color="ink2">
        {t('reminders.quiet')}
      </Txt>
    </Screen>
  );
}

/** Times are shown in the self profile's zone (the planner's zone); UTC only when no profile exists yet. */
function getProfileTz(): string {
  return getSelfProfile()?.tz ?? 'UTC';
}

const styles = StyleSheet.create({
  cta: { marginTop: 12 },
  kindHead: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  scheduledRow: { flexDirection: 'row', gap: 12, paddingVertical: 4 },
  scheduledWhen: { width: 132 },
  scheduledWhat: { flex: 1, minWidth: 0 },
});
