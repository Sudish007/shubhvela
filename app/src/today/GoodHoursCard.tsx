// "Good hours today" card (design.md 10.2 F5): caption row sunrise · sunset · moonrise (its own row, M1), the band,
// the Now line with Why?, the Flags text line, the legend of present colours, and "All 13 segments" expanding the
// list in place (the button then reads "Hide segments"). Polar/no-sun days replace the band with the design 11 text.
import type { GoodHours, PanchangDay } from '@shubhvela/engine';
import { StyleSheet, View } from 'react-native';
import { Card } from '../components/Card';
import { Pressable44 } from '../components/Pressable44';
import { Txt } from '../components/Txt';
import { useLang } from '../i18n';
import { useTokens } from '../theme/ThemeProvider';
import { FlagsLine, flagsText } from './FlagsLine';
import { fmtTime, fmtTimeOrDayTime, glueRanges } from './format';
import { GoodHoursBand } from './GoodHoursBand';
import { Legend } from './Legend';
import { NowLine } from './NowLine';
import { RichText } from './RichText';
import { dayRows, SegmentList } from './SegmentList';

export interface GoodHoursCardProps {
  gh: GoodHours;
  panchang: PanchangDay;
  nowMs: number;
  /** Controlled expansion (the panchang sheet's "All 13" opens the list too). */
  expanded: boolean;
  onToggleExpanded: () => void;
  bandWidth?: number;
  fontScale?: number;
}

export function GoodHoursCard({ gh, panchang, nowMs, expanded, onToggleExpanded, bandWidth, fontScale }: GoodHoursCardProps) {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  const tz = gh.tz;
  if (gh.noSun || !gh.ticks) {
    return (
      <Card testID="good-hours-card">
        <Txt kind="heading" accessibilityRole="header">
          {t('today.goodHours')}
        </Txt>
        <Txt kind="body" color="ink2" style={styles.noSun}>
          {t('today.noSun')}
        </Txt>
      </Card>
    );
  }
  // Moonrise belongs to the Vedic day and can fall after midnight (near Amavasya it is minutes before the next sunrise);
  // then it carries weekday + date like the Panchang sheet's "(next day)" so it never reads as this morning's time.
  const sunLine = panchang.moonrise !== null
    ? t('today.sunLine', { sunrise: fmtTime(gh.ticks.sunrise, tz), sunset: fmtTime(gh.ticks.sunset, tz), moonrise: fmtTimeOrDayTime(panchang.moonrise, tz, lang, gh.day) })
    : t('today.sunLineNoMoonrise', { sunrise: fmtTime(gh.ticks.sunrise, tz), sunset: fmtTime(gh.ticks.sunset, tz) });
  const count = dayRows(gh).length;
  return (
    <Card testID="good-hours-card">
      <Txt kind="heading" accessibilityRole="header">
        {t('today.goodHours')}
      </Txt>
      <RichText kind="caption" color="ink2" style={styles.sunRow} text={glueRanges(sunLine)} testID="sun-line" />
      <GoodHoursBand gh={gh} nowMs={nowMs} flagsText={flagsText(gh, t, lang)} width={bandWidth} fontScale={fontScale} />
      <View style={[styles.nowBox, { borderTopColor: colors.hair }]}>
        <NowLine gh={gh} nowMs={nowMs} testID="now-line" />
      </View>
      <FlagsLine gh={gh} testID="flags-line" />
      <Legend legend={gh.legend} testID="legend" />
      <Pressable44
        accessibilityLabel={expanded ? t('today.hideSegments') : t('today.allSegments', { count })}
        accessibilityState={{ expanded }}
        onPress={onToggleExpanded}
        style={styles.expand}
        testID="segments-toggle"
      >
        <Txt kind="label" weight={600} color="accent">
          {expanded ? t('today.hideSegments') : t('today.allSegments', { count })}
        </Txt>
      </Pressable44>
      {expanded ? <SegmentList gh={gh} nowMs={nowMs} testID="segment-list" /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  sunRow: { marginTop: 2, marginBottom: 6 },
  nowBox: { marginTop: 10, paddingTop: 4, borderTopWidth: StyleSheet.hairlineWidth },
  noSun: { marginTop: 8 },
  expand: { alignSelf: 'flex-start', paddingHorizontal: 0, alignItems: 'flex-start', marginTop: 4 },
});
