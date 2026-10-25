// Vrat family detail (F22, design.md 10.4): /family/vrat/<family>. One switch for the whole family (one reminder series;
// the 6th on free opens the honest Pro sheet), the next occurrences within a year at the user's place with the computed
// time that matters for each, the "What to do" text (corpus/vrats, resolved bho -> hi -> en) with its Why?, and the
// "How this was computed" footer. Every time is engine output.
import { VRAT_FAMILIES, type VratFamily, type VratOccurrence, DAY_MS, localDateOf, vratOccurrences } from '@shubhvela/engine';
import { lookup } from '@shubhvela/content';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, CapSheet, ChevronIcon, ComputedFooter, Pressable44, Row, Screen, SwitchRow, Tag, Txt } from '../../../src/components';
import { getSelfProfile } from '../../../src/db/profiles';
import { chartFor } from '../../../src/engine-bridge/charts';
import { AYANAMSA_KEY, NODE_KEY, shortValue } from '../../../src/settingsLabels';
import { vratKeyTimeText, vratName } from '../../../src/family/format';
import { useSeries, type UseSeriesOptions } from '../../../src/family/useSeries';
import { vratText } from '../../../src/family/VratCard';
import { useLang } from '../../../src/i18n';
import { openSystemNotificationSettings } from '../../../src/notifications/permissions';
import { useTokens } from '../../../src/theme/ThemeProvider';
import { radius } from '../../../src/theme/tokens';
import { fmtCivilDate } from '../../../src/today/format';
import { RichText } from '../../../src/today/RichText';

export interface VratScreenProps {
  family?: VratFamily;
  now?: () => number;
  seriesOptions?: UseSeriesOptions;
  /** Days ahead to list (default 400 so yearly vrats appear; tests shorten it). */
  horizonDays?: number;
}

export default function VratScreen({ family: familyProp, now, seriesOptions, horizonDays = 400 }: VratScreenProps) {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = familyProp ?? params.id;
  const family = VRAT_FAMILIES.find((f) => f === id) ?? null;
  const self = getSelfProfile();
  const series = useSeries(seriesOptions);
  const [list, setList] = useState<VratOccurrence[] | null>(null);
  const nowMs = (now ?? Date.now)();

  useEffect(() => {
    if (!self || !family) return;
    const timer = setTimeout(() => {
      try {
        setList(vratOccurrences(family, nowMs - DAY_MS, nowMs + horizonDays * DAY_MS, { lat: self.lat, lon: self.lon }, self.tz));
      } catch (e) {
        if (__DEV__) console.warn('vrat failed', e);
        setList([]);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [self, family, nowMs, horizonDays]);

  if (!family) {
    return (
      <Screen title={t('vrat.title')} chrome="stack" testID="vrat-screen">
        <Txt kind="body" color="ink2">
          {t('vrat.unknown')}
        </Txt>
      </Screen>
    );
  }
  const familyName = t(`vrat.family.${family}`);
  const today = self ? localDateOf(nowMs, self.tz) : '';
  const upcoming = (list ?? []).filter((o) => o.date > today || (o.date === today && (o.keyTime.end ?? o.keyTime.start) >= nowMs));
  const next = upcoming[0] ?? null;
  const whatToDo = lookup('vrats', `vrat-${family}`, lang);
  const enabled = series.isEnabled('vrat_family', family);
  const text = self && next ? vratText(family, next, today, self.tz, self.placeName, t, lang) : null;

  return (
    <Screen title={familyName} chrome="stack" route="VratDetail" testID="vrat-screen">
      <Card flush>
        <SwitchRow title={t('vrat.remindMe')} caption={t('vrat.familySeriesNote', { family: familyName })} value={enabled} onValueChange={(v) => void series.toggle('vrat_family', family, v)} divider={false} testID="vrat-switch" />
      </Card>
      {series.permission === 'denied' ? (
        <Pressable44 accessibilityLabel={t('reminders.permission')} onPress={openSystemNotificationSettings} style={[styles.permRow, { borderColor: colors.hair2, backgroundColor: colors.surface }]} testID="permission-row">
          <Txt kind="label" weight={400} style={styles.permText}>
            {t('reminders.permission')}
          </Txt>
          <ChevronIcon color={colors.ink3} />
        </Pressable44>
      ) : null}
      {series.failed.has(`vrat_family:${family}`) ? <Tag variant="kind">{t('events.notScheduled')}</Tag> : null}
      {!self ? (
        <Txt kind="body" color="ink2">
          {t('today.noProfile')}
        </Txt>
      ) : null}
      {self && list === null ? <View accessibilityLabel={t('common.computing')} accessibilityRole="progressbar" testID="vrat-skeleton" style={[styles.skeleton, { borderColor: colors.hair, backgroundColor: colors.surface }]} /> : null}
      {self && list !== null ? (
        <Card flush>
          <View style={styles.listHead}>
            <Txt kind="heading" accessibilityRole="header">
              {t('vrat.nextDates')}
            </Txt>
            <Txt kind="caption" color="ink3">
              {self.placeName}
            </Txt>
          </View>
          {upcoming.length === 0 ? (
            <Txt kind="body" color="ink2" style={styles.pad}>
              {t('vrat.noUpcoming')}
            </Txt>
          ) : (
            upcoming.slice(0, 30).map((o, i) => (
              <View key={`${o.name}-${o.date}`} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hair }]} testID={`vrat-row-${o.date}`}>
                <View style={styles.rowText}>
                  <Txt kind="label" weight={600}>
                    {vratName(t, o.name)}
                  </Txt>
                  <RichText kind="caption" color="ink2" text={`${fmtCivilDate(o.date, lang)} · ${vratKeyTimeText(t, o.keyTime, self.tz)}`} />
                </View>
              </View>
            ))
          )}
        </Card>
      ) : null}
      {whatToDo ? (
        <Card>
          <Txt kind="heading" accessibilityRole="header">
            {t('vrat.whatToDo')}
          </Txt>
          <Row ruleId={`vrat-${family}`} text={whatToDo.text} inputs={text?.inputs} divider={false} testID="vrat-what">
            <Txt kind="body">{whatToDo.text}</Txt>
          </Row>
        </Card>
      ) : null}
      {self && next ? (
        <ComputedFooter
          ayanamsa={shortValue(t(AYANAMSA_KEY[chartFor(self).meta.ayanamsa]))}
          node={shortValue(t(NODE_KEY[chartFor(self).meta.node]))}
          ephemeris={t('panchang.ephemeris', { ephemeris: chartFor(self).meta.ephemeris })}
          tz={self.tz}
          rounding={t('panchang.rounding')}
          extra={[t('vrat.howComputed', { convention: next.convention, tz: self.tz })]}
        />
      ) : null}
      <CapSheet visible={series.capOpen} onClose={series.closeCap} reason="pro_reminders" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  permRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderWidth: 1, borderRadius: radius.button, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'stretch' },
  permText: { flex: 1 },
  skeleton: { height: 160, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.card },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  pad: { paddingHorizontal: 16, paddingBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, paddingVertical: 8 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
});
