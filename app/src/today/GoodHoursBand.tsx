// F5 band (design.md 10.2, 2.1, 8): ONE 32 dp composite strip drawn with react-native-svg from engine.goodHours spans.
// Daylight = 75 % of the width, night = 25 % (bandPosition); good spans = saffron + dot <Pattern>, avoid = hatch
// <Pattern>, neutral = plain; night spans are indigo and keep the pattern as the verdict carrier (N1). No gradients,
// no shadows. Moonrise tick on the top edge, 2 px ink now-marker, now-time label above, tick row below. The band is
// one accessibilityRole="image" whose label is generated from the same spans; inline labels (13 sp, 600) follow the
// engine's labelFor and hide rather than clip when the span is narrower than 60 dp x fontScale (N3).
import type { GoodHours, GoodHoursSpan } from '@shubhvela/engine';
import { useState } from 'react';
import { PixelRatio, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Line, Path, Pattern, Rect } from 'react-native-svg';
import { Num } from '../components/Num';
import { Txt } from '../components/Txt';
import { useLang } from '../i18n';
import { useTokens } from '../theme/ThemeProvider';
import { radius, size, type ColorToken } from '../theme/tokens';
import { bandA11yText, bandLabels, markerX, spanRects, tickMarks } from './bandGeometry';
import { fmtTime } from './format';

export interface GoodHoursBandProps {
  gh: GoodHours;
  nowMs: number;
  /** Flags sentence for the accessibility text (null when the day has none). */
  flagsText: string | null;
  /** Measured by onLayout; a prop only for tests and the widget preview. */
  width?: number;
  /** System font scale; defaults to PixelRatio.getFontScale(). */
  fontScale?: number;
  testID?: string;
}

/** Width used before onLayout reports (390 dp screen - 2 x 16 gutter - 2 x 16 card padding). */
export const DEFAULT_BAND_WIDTH = 326;

type Palette = Record<ColorToken, string>;
type PatternIds = { dots: string; dotsNight: string; hatch: string; hatchNight: string };

/** Span fill: night spans are indigo whatever the verdict (the pattern carries it); day spans use good/avoid/neutral. */
export function fillFor(span: GoodHoursSpan, colors: Palette): string {
  if (span.night) return colors.night;
  return span.verdict === 'good' ? colors.good : span.verdict === 'avoid' ? colors.avoid : colors.neutral;
}

/** Pattern id: dots for good, hatch for avoid, none for neutral; the night variants are drawn in night-ink. */
export function patternFor(span: GoodHoursSpan, ids: PatternIds): string | null {
  if (span.verdict === 'good') return span.night ? ids.dotsNight : ids.dots;
  if (span.verdict === 'avoid') return span.night ? ids.hatchNight : ids.hatch;
  return null;
}
const NOW_ROW = 18;
const TICK_ROW = 16;
const MOON_TICK_H = 7;

export function GoodHoursBand({ gh, nowMs, flagsText, width: widthProp, fontScale: fontScaleProp, testID }: GoodHoursBandProps) {
  const { colors, theme } = useTokens();
  const { t } = useLang();
  const [measured, setMeasured] = useState<number | null>(null);
  const width = widthProp ?? measured ?? DEFAULT_BAND_WIDTH;
  const fontScale = fontScaleProp ?? PixelRatio.getFontScale();
  const ticks = gh.ticks;
  if (!ticks) return null;
  const h = size.band;
  const rects = spanRects(gh, width);
  const labels = bandLabels(gh, width, fontScale, t);
  const nowX = markerX(nowMs, ticks, width);
  const inDay = nowMs >= ticks.sunrise && nowMs < ticks.nextSunrise;
  const moonX = ticks.moonrise !== null ? markerX(ticks.moonrise, ticks, width) : null;
  const marks = tickMarks(ticks, width, gh.tz);
  const nowLabel = fmtTime(nowMs, gh.tz);
  const ids = { dots: `dots-${theme}`, dotsNight: `dotsN-${theme}`, hatch: `hatch-${theme}`, hatchNight: `hatchN-${theme}` };

  return (
    <View testID={testID} onLayout={(e) => setMeasured(Math.round(e.nativeEvent.layout.width))} style={styles.root}>
      <View style={styles.nowRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {inDay ? (
          <View style={[styles.nowLabelBox, { left: Math.min(Math.max(nowX, 24), width - 24) }]}>
            <Num kind="caption" weight={600} color="accent" testID="band-now-time">
              {nowLabel}
            </Num>
          </View>
        ) : null}
      </View>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={bandA11yText(gh, nowMs, t, flagsText)}
        testID="good-hours-band"
        style={[styles.band, { height: h, borderColor: colors.hair2, backgroundColor: colors.neutral }]}
      >
        <Svg width={width} height={h}>
          <Defs>
            <Pattern id={ids.dots} patternUnits="userSpaceOnUse" width={6} height={6}>
              <Circle cx={3} cy={3} r={1.1} fill={colors.goodInk} />
            </Pattern>
            <Pattern id={ids.dotsNight} patternUnits="userSpaceOnUse" width={6} height={6}>
              <Circle cx={3} cy={3} r={1.1} fill={colors.nightInk} fillOpacity={0.85} />
            </Pattern>
            <Pattern id={ids.hatch} patternUnits="userSpaceOnUse" width={8} height={8}>
              <Path d="M-2 2L2 -2M0 8L8 0M6 10L10 6" stroke={colors.avoidHatch} strokeWidth={1.4} />
            </Pattern>
            <Pattern id={ids.hatchNight} patternUnits="userSpaceOnUse" width={8} height={8}>
              <Path d="M-2 2L2 -2M0 8L8 0M6 10L10 6" stroke={colors.nightInk} strokeOpacity={0.85} strokeWidth={1.4} />
            </Pattern>
          </Defs>
          {rects.map((r, i) => <Rect key={`s${i}`} x={r.x} y={0} width={r.w} height={h} fill={fillFor(r.span, colors)} testID={`band-span-${i}`} />)}
          {rects.map((r, i) => {
            const pattern = patternFor(r.span, ids);
            return pattern ? <Rect key={`p${i}`} x={r.x} y={0} width={r.w} height={h} fill={`url(#${pattern})`} /> : null;
          })}
          {rects.slice(1).map((r, i) => (
            <Line key={`d${i}`} x1={r.x} y1={0} x2={r.x} y2={h} stroke={r.span.night ? colors.nightInk : colors.hair2} strokeOpacity={r.span.night ? 0.35 : 1} strokeWidth={1} />
          ))}
          {moonX !== null ? <Rect x={moonX - 1} y={0} width={2} height={MOON_TICK_H} fill={colors.indigo} testID="band-moonrise" /> : null}
          {inDay ? <Rect x={nowX - 1} y={0} width={2} height={h} fill={colors.ink} testID="band-now-marker" /> : null}
        </Svg>
        {labels.map((l, i) => {
          const color = l.span.night ? 'nightInk' : l.span.verdict === 'good' ? 'goodInk' : 'ink';
          return (
            <View key={`l${i}`} pointerEvents="none" style={[styles.labelBox, { left: l.x, width: l.w }]}>
              <Txt kind="caption" weight={600} color={color} style={[styles.label, { backgroundColor: fillFor(l.span, colors) }]} testID="band-label">
                {l.text}
              </Txt>
            </View>
          );
        })}
      </View>
      <View style={styles.ticks} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {marks.map((m, i) => (
          <View key={i} style={[styles.tickBox, m.align === 'left' ? { left: 0 } : m.align === 'right' ? { right: 0 } : { left: m.x - 40, width: 80, alignItems: 'center' }]}>
            <View style={[styles.tickMark, { backgroundColor: colors.hair2 }]} />
            <Num kind="micro" color="ink3">
              {m.text}
            </Num>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'stretch' },
  nowRow: { height: NOW_ROW, position: 'relative' },
  nowLabelBox: { position: 'absolute', top: 0, width: 48, marginLeft: -24, alignItems: 'center' },
  band: { borderRadius: radius.band, borderWidth: 1, overflow: 'hidden', position: 'relative' },
  labelBox: { position: 'absolute', top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  label: { paddingHorizontal: 5, borderRadius: 3 },
  ticks: { height: TICK_ROW + 4, marginTop: 4, position: 'relative' },
  tickBox: { position: 'absolute', top: 0, alignItems: 'flex-start' },
  tickMark: { width: 1, height: 4, marginBottom: 0 },
});
