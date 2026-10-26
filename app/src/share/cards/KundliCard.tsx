// "My kundli card" (F36): the chart in the chosen style (the same engine chart-layout as the Charts tab), the name,
// the Moon / Lagna line and the birth line. The birth TIME is printed only when `showBirthTime` is on (default Off on
// the preview sheet); date and place are always there. Every value is engine output for the profile's chart.
import type { ChartData, ChartStyle } from '@shubhvela/engine';
import { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chart } from '../../charts/Chart';
import { fmtBirthDate, shortPlace } from '../../charts/model';
import { Txt } from '../../components/Txt';
import type { Profile } from '../../db/profiles';
import { useLang } from '../../i18n';
import { CHART_STYLE_KEY } from '../../settingsLabels';
import { nakshatraName, signName } from '../../today/format';
import { CardFrame, type CardView } from '../ShareCard';

export interface KundliCardProps {
  profile: Profile;
  chart: ChartData;
  style: ChartStyle;
  /** Display name of the profile (name or relationship word). */
  label: string;
  showBirthTime: boolean;
}

const CHART_W = 400;

/** The birth line text (exported for tests): time only when the switch is on and the time is known. */
export function kundliBornLine(p: Profile, showBirthTime: boolean, t: (k: string, params?: Record<string, string | number>) => string, lang: 'en' | 'hi' | 'bho'): string {
  const date = fmtBirthDate(p.birthDate, lang);
  const place = shortPlace(p.placeName);
  if (showBirthTime && !p.timeUnknown && p.birthTime) return t('share.bornTime', { date, time: p.birthTime, place });
  return t('share.born', { date, place });
}

export const KundliCard = forwardRef<CardView, KundliCardProps>(function KundliCard({ profile, chart, style, label, showBirthTime }, ref) {
  const { t, lang } = useLang();
  const moon = chart.planets.find((p) => p.id === 'Mo');
  const moonText = moon ? `${signName(lang, moon.sign)} · ${nakshatraName(lang, moon.nakshatra)} ${moon.pada}` : '';
  const line = chart.lagna && !chart.moonChart ? t('share.moonLagna', { moon: moonText, lagna: signName(lang, chart.lagna.sign) }) : t('share.moonOnly', { moon: moonText });
  return (
    <CardFrame ref={ref} kind="kundli" kicker={t('share.cardKundli')}>
      <Txt kind="display" testID="kundli-card-name">
        {t('share.kundliOf', { name: label })}
      </Txt>
      <View style={styles.chart}>
        <Chart style={style} chart={chart} width={CHART_W} fontScale={1} styleName={t(CHART_STYLE_KEY[style])} centreLines={style === 'north' ? undefined : [label]} testID="kundli-card-chart" />
      </View>
      <Txt kind="heading" testID="kundli-card-moon">
        {line}
      </Txt>
      <Txt kind="label" weight={400} color="ink2" testID="kundli-card-born">
        {kundliBornLine(profile, showBirthTime, t, lang)}
      </Txt>
    </CardFrame>
  );
});

const styles = StyleSheet.create({
  chart: { alignItems: 'center' },
});
