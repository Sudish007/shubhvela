// Settings -> Vrats (F22, design.md 10.4): the 12 vrat families, each a SwitchRow that toggles the whole family (one
// reminder series; the 6th enabled series on free opens the honest Pro sheet) with the next computed occurrence and its
// key time as the caption. Also the target of the Family footer button "Add vrat". Quiet by default: nothing is On
// until the user switches it on.
import { VRAT_FAMILIES, type VratFamily, type VratOccurrence } from '@shubhvela/engine';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, CapSheet, ChevronIcon, Pressable44, Screen, SwitchRow, Txt } from '../../src/components';
import { getSelfProfile } from '../../src/db/profiles';
import { vratKeyTimeText, vratName } from '../../src/family/format';
import { nextVratOccurrence } from '../../src/family/model';
import { useSeries, type UseSeriesOptions } from '../../src/family/useSeries';
import { useLang } from '../../src/i18n';
import { openSystemNotificationSettings } from '../../src/notifications/permissions';
import { useTokens } from '../../src/theme/ThemeProvider';
import { radius } from '../../src/theme/tokens';
import { fmtCivilDate } from '../../src/today/format';

export interface VratsScreenProps {
  now?: () => number;
  seriesOptions?: UseSeriesOptions;
  /** Skip the next-occurrence captions (tests). */
  withoutDates?: boolean;
}

export default function VratsScreen({ now, seriesOptions, withoutDates }: VratsScreenProps) {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  const self = getSelfProfile();
  const series = useSeries(seriesOptions);
  const [next, setNext] = useState<Partial<Record<VratFamily, VratOccurrence | null>> | null>(withoutDates ? {} : null);

  useEffect(() => {
    if (!self || withoutDates) return;
    const nowMs = (now ?? Date.now)();
    const obs = { geo: { lat: self.lat, lon: self.lon }, tz: self.tz };
    const id = setTimeout(() => {
      const out: Partial<Record<VratFamily, VratOccurrence | null>> = {};
      for (const f of VRAT_FAMILIES) {
        try {
          out[f] = nextVratOccurrence(f, nowMs, obs);
        } catch (e) {
          if (__DEV__) console.warn('vrat failed', f, e);
          out[f] = null;
        }
      }
      setNext(out);
    }, 0);
    return () => clearTimeout(id);
  }, [self, now, withoutDates]);

  const countLine = series.cap === null ? t('reminders.seriesOnPro', { count: series.enabledCount }) : t('reminders.enabledCount', { count: series.enabledCount, max: series.cap });

  return (
    <Screen title={t('vrat.title')} chrome="stack" testID="vrats-screen">
      <Txt kind="body" color="ink2">
        {t('vrat.intro')}
      </Txt>
      <Txt kind="caption" color="ink3" latin tabular testID="vrats-count">
        {countLine}
      </Txt>
      {series.permission === 'denied' ? (
        <Pressable44 accessibilityLabel={t('reminders.permission')} onPress={openSystemNotificationSettings} style={[styles.permRow, { borderColor: colors.hair2, backgroundColor: colors.surface }]} testID="permission-row">
          <Txt kind="label" weight={400} style={styles.permText}>
            {t('reminders.permission')}
          </Txt>
          <ChevronIcon color={colors.ink3} />
        </Pressable44>
      ) : null}
      <Card flush>
        {VRAT_FAMILIES.map((f, i) => {
          const occ = next ? next[f] : undefined;
          const caption =
            !self || withoutDates
              ? undefined
              : occ === undefined
                ? t('common.computing')
                : occ === null
                  ? t('vrat.noUpcoming')
                  : `${t('vrat.nextOccurrence', { date: fmtCivilDate(occ.date, lang) })} · ${vratName(t, occ.name)} · ${vratKeyTimeText(t, occ.keyTime, self.tz)}`;
          return (
            <View key={f}>
              <SwitchRow title={t(`vrat.family.${f}`)} caption={caption} value={series.isEnabled('vrat_family', f)} onValueChange={(v) => void series.toggle('vrat_family', f, v)} divider={i < VRAT_FAMILIES.length - 1} testID={`vrat-switch-${f}`} />
            </View>
          );
        })}
      </Card>
      <CapSheet visible={series.capOpen} onClose={series.closeCap} reason="pro_reminders" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  permRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderWidth: 1, borderRadius: radius.button, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'stretch' },
  permText: { flex: 1 },
});
