// The chart as hero graphic (design.md 4, M19, M20; plan A11). ONE react-native-svg drawing fed entirely by the
// engine's chart-layout: viewBox 0 0 320 320, 1.5 px frame + 1 px grid in ink, sign numerals in ink-3 at labelSize,
// planet glyphs (Latin 13.5 u Noto Sans SemiBold / Devanagari 14.5 u Tiro), approximate planets in indigo, "+N"
// badges, the South Lagna diagonal in accent. Text sizes come from layout() = size x fontScale / (width / 320), so
// nothing renders below 12 sp at 360 dp and the layout steps to a denser mode before anything shrinks (M20).
// Hit-testing (M19): one onPress / onLongPress on the frame; the touch point (dp) is divided by layout.scale and
// resolved by engine hitTest - a planet when unambiguous, otherwise the house. No invisible 44 dp rects.
import { hitTest, layout, type ChartData, type ChartLayout, type ChartStyle, type PlanetId } from '@shubhvela/engine';
import { useMemo } from 'react';
import { PixelRatio, Pressable, StyleSheet, type GestureResponderEvent } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { useLang, type Lang } from '../i18n';
import { useTokens } from '../theme/ThemeProvider';
import { fontFamilyFor } from '../theme/typography';
import { chartA11yLabel } from './model';

export type ChartLongPressTarget = { kind: 'planet'; id: PlanetId; house: number } | { kind: 'sign'; sign: number; house: number };

export interface ChartProps {
  style: ChartStyle;
  chart: ChartData;
  /** Rendered width in dp (the card's inner width; 296 at 360 dp, 326 at 390 dp). */
  width: number;
  /** System font scale; defaults to PixelRatio.getFontScale(). */
  fontScale?: number;
  /** Centre text for the South/East styles (profile name, ayanamsa and node). */
  centreLines?: string[];
  /** Localised style name for the accessibility label ("North Indian"). */
  styleName: string;
  onPressPlanet?: (id: PlanetId, house: number) => void;
  onPressHouse?: (house: number, sign: number) => void;
  onLongPress?: (target: ChartLongPressTarget) => void;
  testID?: string;
}

export type ChartPress = { kind: 'planet'; id: PlanetId; house: number; sign: number } | { kind: 'house'; house: number; sign: number } | null;

/** Maps a touch in dp to the planet or house it opens (exported for tests). */
export function resolvePress(lay: ChartLayout, xDp: number, yDp: number): ChartPress {
  const hit = hitTest(lay, xDp / lay.scale, yDp / lay.scale);
  if (!hit) return null;
  if (hit.planetId && !hit.ambiguous) return { kind: 'planet', id: hit.planetId, house: hit.house, sign: hit.sign };
  return { kind: 'house', house: hit.house, sign: hit.sign };
}

/** Long-press target: the planet under the touch, else the house's sign (design 4). */
export function resolveLongPress(lay: ChartLayout, xDp: number, yDp: number): ChartLongPressTarget | null {
  const hit = hitTest(lay, xDp / lay.scale, yDp / lay.scale);
  if (!hit) return null;
  if (hit.planetId) return { kind: 'planet', id: hit.planetId, house: hit.house };
  return { kind: 'sign', sign: hit.sign, house: hit.house };
}

/** Face for glyphs (weight 600 Latin / Tiro Devanagari) and numerals (Noto Sans digits). */
export function chartFonts(lang: Lang): { glyph: string; numeral: string } {
  return { glyph: lang === 'en' ? fontFamilyFor('body', 'en', 600) : fontFamilyFor('display', lang, 400), numeral: fontFamilyFor('body', 'en', 400) };
}

export function Chart({ style, chart, width, fontScale: fontScaleProp, centreLines, styleName, onPressPlanet, onPressHouse, onLongPress, testID }: ChartProps) {
  const { colors } = useTokens();
  const { lang, t } = useLang();
  const fontScale = fontScaleProp ?? PixelRatio.getFontScale();
  const lay = useMemo(() => layout(style, chart, fontScale, width, { lang, centreLines }), [style, chart, fontScale, width, lang, centreLines]);
  const fonts = chartFonts(lang);
  const label = useMemo(() => chartA11yLabel(chart, styleName, lang, t), [chart, styleName, lang, t]);

  const press = (e: GestureResponderEvent) => {
    const r = resolvePress(lay, e.nativeEvent.locationX, e.nativeEvent.locationY);
    if (!r) return;
    if (r.kind === 'planet') onPressPlanet?.(r.id, r.house);
    else onPressHouse?.(r.house, r.sign);
  };
  const longPress = (e: GestureResponderEvent) => {
    const r = resolveLongPress(lay, e.nativeEvent.locationX, e.nativeEvent.locationY);
    if (r) onLongPress?.(r);
  };

  return (
    <Pressable
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      accessibilityHint={t('charts.tapHint')}
      onPress={press}
      onLongPress={longPress}
      style={[styles.root, { width, height: width }]}
    >
      <Svg width={width} height={width} viewBox="0 0 320 320" testID="chart-svg">
        <Rect x={lay.frame.x} y={lay.frame.y} width={lay.frame.width} height={lay.frame.height} fill={colors.surface} stroke={colors.ink} strokeWidth={1.5} />
        {lay.grid.map((g, i) => (
          <Line key={`g${i}`} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke={colors.ink} strokeWidth={1} />
        ))}
        {lay.lagnaMark ? <Line x1={lay.lagnaMark.x1} y1={lay.lagnaMark.y1} x2={lay.lagnaMark.x2} y2={lay.lagnaMark.y2} stroke={colors.accent} strokeWidth={2} testID="chart-lagna-mark" /> : null}
        {lay.labels.map((l, i) => (
          <SvgText
            key={`l${i}`}
            x={l.anchorX}
            y={l.baseline}
            fontSize={l.size}
            textAnchor={l.anchor}
            fill={l.kind === 'centre' ? colors.ink2 : colors.ink3}
            fontFamily={l.kind === 'signName' ? fontFamilyFor('body', lang, 400) : fonts.numeral}
            testID={l.kind === 'centre' ? 'chart-centre' : `chart-label-${l.house}`}
          >
            {l.text}
          </SvgText>
        ))}
        {lay.glyphs.map((g) => (
          <SvgText
            key={`p${g.planetId}`}
            x={g.anchorX}
            y={g.baseline}
            fontSize={g.size}
            textAnchor={g.anchor}
            fill={g.approx ? colors.indigo : colors.ink}
            fontFamily={fonts.glyph}
            testID={`chart-glyph-${g.planetId}`}
          >
            {g.text}
          </SvgText>
        ))}
        {lay.badges.map((b) => (
          <SvgText key={`b${b.house}`} x={b.anchorX} y={b.baseline} fontSize={b.size} textAnchor={b.anchor} fill={colors.ink2} fontFamily={fonts.numeral} testID={`chart-badge-${b.house}`}>
            {b.text}
          </SvgText>
        ))}
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'center' },
});
