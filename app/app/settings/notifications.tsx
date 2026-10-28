// Settings -> Notifications (design.md 10.4 F25, plan A12): the real permission state (expo-notifications) with the
// request / open-settings action; the evening-before and morning-of times per event kind (defaults 19:00 / 07:00, native
// time picker, re-planned on change); the opt-in "Daily note" switch (default Off) with its time; the "Scheduled" count
// (what the OS really holds after the last re-plan) with the next entries as a plain list; the quiet-by-default line.
// B04: "Dasha change alerts" (F14; Pro shows the switch, default Off; free sees the row with a Pro tag -> /pro) and
// "Notify when the year begins" (F17; default Off). C01 (F9): the "Home-screen widgets" card with "Add widget to home
// screen" (requestPinAppWidget for the small 2x1 / medium 4x2 widget; an honest notice when the launcher cannot pin) and
// "Exact widget updates" (the SCHEDULE_EXACT_ALARM special access: shows Allowed / Not allowed, opens the system page;
// "Not needed" below Android 12 where no such permission exists).
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { exactAlarmState, isPinSupported, openExactAlarmSettings, requestPin, type ExactAlarmState, type WidgetKind } from '../../modules/widget-pin';
import { Card, InlineNotice, NavRow, PrimaryButton, Screen, SecondaryButton, SwitchRow, Txt } from '../../src/components';
import { getAncestor } from '../../src/db/ancestors';
import type { SeriesKind } from '../../src/db/eventSeries';
import { getProfile, getSelfProfile } from '../../src/db/profiles';
import {
  SERIES_KINDS,
  getDailyNoteSetting,
  getDashaAlertsEnabled,
  getLastPlannedAt,
  getReminderTimes,
  getYearBeginsEnabled,
  setDailyNoteEnabled,
  setDailyNoteTime,
  setDashaAlertsEnabled,
  setReminderTime,
  setYearBeginsEnabled,
  type ReminderSlot,
  type ReminderTimes,
} from '../../src/db/reminderSettings';
import { countScheduled, listScheduledDetailed, type ScheduledDetail } from '../../src/db/scheduled';
import { canSeeFeature, onEntitlementsChanged } from '../../src/entitlements';
import { useLang } from '../../src/i18n';
import { getPermissionState, openSystemNotificationSettings, requestPermission, type PermissionState } from '../../src/notifications/permissions';
import { replanAll, type ReplanResult } from '../../src/notifications/schedule';
import { pickTime } from '../../src/profiles/nativePickers';
import { useTokens } from '../../src/theme/ThemeProvider';
import { fmtDayTime } from '../../src/today/format';
import { RichText } from '../../src/today/RichText';

export interface NotificationsScreenProps {
  /** Injection for tests. */
  getPermission?: () => Promise<PermissionState>;
  requestPermission?: () => Promise<PermissionState>;
  replan?: () => Promise<ReplanResult>;
  pickTime?: (current: string, onPick: (hhmm: string) => void) => void;
  /** Widget bridge override for tests (production: the local Expo module). */
  widgets?: WidgetBridge;
}

export interface WidgetBridge {
  isPinSupported(): boolean;
  requestPin(kind: WidgetKind): boolean;
  exactAlarmState(): ExactAlarmState;
  openExactAlarmSettings(): boolean;
}

const nativeWidgetBridge: WidgetBridge = { isPinSupported, requestPin, exactAlarmState, openExactAlarmSettings };

const KIND_KEY: Record<SeriesKind, string> = { tithi_birthday: 'reminders.kind.tithiBirthday', barsi: 'reminders.kind.barsi', vrat_family: 'reminders.kind.vrat' };

function scheduledLabel(d: ScheduledDetail, t: (k: string, p?: Record<string, string | number>) => string): string {
  if (!d.kind || d.kind === 'daily_note') return t('reminders.kind.dailyNote');
  if (d.kind === 'dasha_change') return t('reminders.kind.dashaChange');
  if (d.kind === 'year_begins') return t('reminders.kind.yearBegins');
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
  const { colors } = useTokens();
  const getPerm = props.getPermission ?? getPermissionState;
  const askPerm = props.requestPermission ?? requestPermission;
  const replan = props.replan ?? (() => replanAll());
  const pick = props.pickTime ?? pickTime;
  const router = useRouter();
  const [perm, setPerm] = useState<PermissionState>('unknown');
  const [times, setTimes] = useState<ReminderTimes>(() => getReminderTimes());
  const [daily, setDaily] = useState(() => getDailyNoteSetting());
  const [dashaAlerts, setDashaAlerts] = useState(() => getDashaAlertsEnabled());
  const [yearBegins, setYearBegins] = useState(() => getYearBeginsEnabled());
  const [pratyantarPro, setPratyantarPro] = useState(() => canSeeFeature('dasha_pratyantar').allowed);
  const [scheduled, setScheduled] = useState(() => ({ count: countScheduled(), list: listScheduledDetailed(20), at: getLastPlannedAt() }));
  const widgets = props.widgets ?? nativeWidgetBridge;
  const [exact, setExact] = useState<ExactAlarmState>(() => widgets.exactAlarmState());
  const [pinSupported] = useState(() => widgets.isPinSupported());
  const [pinNotice, setPinNotice] = useState(false);

  const refreshScheduled = useCallback(() => {
    setScheduled({ count: countScheduled(), list: listScheduledDetailed(20), at: getLastPlannedAt() });
    // Back from the system "Alarms & reminders" page: re-read the special-access state.
    setExact(widgets.exactAlarmState());
  }, [widgets]);
  useFocusEffect(refreshScheduled);

  function addWidget(kind: WidgetKind) {
    // The launcher shows its own confirmation dialog; false means it refused (no dialog), so say so instead of pretending.
    setPinNotice(!widgets.requestPin(kind));
  }
  // The Pro state can change while this screen is open (restore on the Pro screen): follow entitlements.
  useEffect(() => onEntitlementsChanged(() => setPratyantarPro(canSeeFeature('dasha_pratyantar').allowed)), []);

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

  function toggleDashaAlerts(v: boolean) {
    setDashaAlertsEnabled(v);
    setDashaAlerts(getDashaAlertsEnabled());
    void replan().then(refreshScheduled);
  }

  function toggleYearBegins(v: boolean) {
    setYearBeginsEnabled(v);
    setYearBegins(getYearBeginsEnabled());
    void replan().then(refreshScheduled);
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

      <Card flush testID="dasha-alerts-card">
        {pratyantarPro ? (
          <SwitchRow title={t('dasha.alertsTitle')} caption={t('dasha.alertsBody')} value={dashaAlerts} onValueChange={toggleDashaAlerts} disabled={perm !== 'granted'} divider={false} testID="dasha-alerts-switch" />
        ) : (
          <NavRow title={t('dasha.alertsTitle')} caption={t('dasha.alertsBody')} value={t('reminders.proOnly')} onPress={() => router.push('/pro')} divider={false} testID="dasha-alerts-pro" />
        )}
      </Card>

      <Card flush testID="year-begins-card">
        <SwitchRow title={t('varshaphal.notifyToggle')} caption={t('reminders.yearBeginsBody')} value={yearBegins} onValueChange={toggleYearBegins} disabled={perm !== 'granted'} divider={false} testID="year-begins-switch" />
      </Card>

      <Card testID="widgets-card">
        <Txt kind="heading" accessibilityRole="header">
          {t('settings.widgetsTitle')}
        </Txt>
        <Txt kind="label" weight={400} style={styles.widgetTitle}>
          {t('settings.addWidget')}
        </Txt>
        <Txt kind="caption" color="ink3">
          {t('settings.addWidgetBody')}
        </Txt>
        {pinSupported && !pinNotice ? (
          <View style={styles.widgetButtons}>
            <SecondaryButton label={t('settings.addWidgetSmall')} onPress={() => addWidget('small')} style={styles.widgetButton} testID="add-widget-small" />
            <SecondaryButton label={t('settings.addWidgetMedium')} onPress={() => addWidget('medium')} style={styles.widgetButton} testID="add-widget-medium" />
          </View>
        ) : (
          <View style={styles.widgetNotice} testID="add-widget-unsupported">
            <InlineNotice>{t('settings.addWidgetUnsupported')}</InlineNotice>
          </View>
        )}
        <View style={[styles.exactRow, { borderTopColor: colors.hair }]}>
          {exact === 'not-applicable' ? (
            <View style={styles.exactText} testID="exact-alarms-na">
              <Txt kind="label" weight={400}>
                {t('settings.exactAlarms')}
              </Txt>
              <Txt kind="caption" color="ink3">
                {t('settings.exactAlarms.na')}
              </Txt>
            </View>
          ) : (
            <NavRow
              title={t('settings.exactAlarms')}
              caption={t('settings.exactAlarmsBody')}
              value={exact === 'granted' ? t('settings.exactAlarms.on') : t('settings.exactAlarms.off')}
              onPress={() => widgets.openExactAlarmSettings()}
              divider={false}
              testID="exact-alarms-row"
            />
          )}
        </View>
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
  widgetTitle: { marginTop: 8 },
  widgetButtons: { marginTop: 12, gap: 8 },
  widgetButton: { alignSelf: 'stretch' },
  widgetNotice: { marginTop: 12 },
  // NavRow carries the 16 dp row padding itself (flush-card convention): pull it out to the card edge.
  exactRow: { marginTop: 12, marginHorizontal: -16, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 4 },
  exactText: { paddingHorizontal: 16, paddingVertical: 10, gap: 2 },
});
