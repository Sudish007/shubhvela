// Legend (design.md 10.2, R2-2, N1): only the colours present in today's spans (engine `legend`), each swatch
// carrying the same pattern as the band (dots = good, hatch = avoid, plain = neutral); the Night entry reads
// "Night (pattern = verdict)" because indigo carries no verdict of its own.
import type { LegendColour } from '@shubhvela/engine';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Path, Pattern, Rect } from 'react-native-svg';
import { Txt } from '../components/Txt';
import { useLang } from '../i18n';
import { useTokens } from '../theme/ThemeProvider';

export interface LegendProps {
  legend: readonly LegendColour[];
  testID?: string;
}

const SW = 16;

function Swatch({ colour }: { colour: LegendColour }) {
  const { colors, theme } = useTokens();
  const fill = colour === 'good' ? colors.good : colour === 'avoid' ? colors.avoid : colour === 'night' ? colors.night : colors.neutral;
  const id = `legend-${colour}-${theme}`;
  return (
    <Svg width={SW} height={SW} accessible={false}>
      <Defs>
        <Pattern id={`${id}-dots`} patternUnits="userSpaceOnUse" width={6} height={6}>
          <Circle cx={3} cy={3} r={1.1} fill={colors.goodInk} />
        </Pattern>
        <Pattern id={`${id}-hatch`} patternUnits="userSpaceOnUse" width={8} height={8}>
          <Path d="M-2 2L2 -2M0 8L8 0M6 10L10 6" stroke={colors.avoidHatch} strokeWidth={1.4} />
        </Pattern>
      </Defs>
      <Rect x={0.5} y={0.5} width={SW - 1} height={SW - 1} rx={3} fill={fill} stroke={colors.hair2} strokeWidth={1} />
      {colour === 'good' ? <Rect x={1} y={1} width={SW - 2} height={SW - 2} rx={3} fill={`url(#${id}-dots)`} /> : null}
      {colour === 'avoid' ? <Rect x={1} y={1} width={SW - 2} height={SW - 2} rx={3} fill={`url(#${id}-hatch)`} /> : null}
    </Svg>
  );
}

export function Legend({ legend, testID }: LegendProps) {
  const { t } = useLang();
  return (
    <View testID={testID} style={styles.legend} accessibilityLabel={t('common.legend')}>
      {legend.map((c) => (
        <View key={c} style={styles.item} testID={`legend-${c}`}>
          <Swatch colour={c} />
          <Txt kind="caption" color="ink2">
            {c === 'night' ? t('band.nightLegend') : t(`verdict.${c}`)}
          </Txt>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6, marginTop: 10 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
