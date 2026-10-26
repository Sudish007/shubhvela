// Planets card table (design.md 4, N7): three FIXED columns - 31 % Planet (tags under the name) · 30 % Sign and degree
// (tabular) · 39 % short nakshatra name and pada (pada glued to the last word, N4) - 8 dp right padding per cell, headers that wrap rather than
// truncate. The Lagna row comes first (hidden in Moon-chart mode), then the nine planets; every row is a 44 dp control
// that opens the PlanetSheet. Every applicable dignity/mark tag is shown (a planet can be combust + friend + vargottama).
// Large text (font scale > 1.15, design 7 "cards grow"): the tags move to a full-width line under the three cells and the
// pada may wrap onto its own line, because at 1.3x neither "debilitated" (31 %) nor "Bhadrapada 2" (39 %) fits its
// column and Android would otherwise break the word in two (seen on the Phase A fixer's 1.3x emulator shot).
import type { ChartData, ChartPlanet, PlanetId } from '@shubhvela/engine';
import { PixelRatio, StyleSheet, View } from 'react-native';
import { Num } from '../components/Num';
import { Pressable44 } from '../components/Pressable44';
import { Tag, ApproxTag } from '../components/Tag';
import { Txt } from '../components/Txt';
import { useLang, type TFn } from '../i18n';
import { useTokens } from '../theme/ThemeProvider';
import { degreeText, nakshatraName, padaText, planetName, signName, tagsFor } from './model';

/** Column widths in percent (design 4); they sum to 100. */
// 31/36/33 in design 4 at 390 dp; the third column was widened to 39 % (sign+degree 30 %) by the Phase A fixer because
// "Bhadrapada 2" did not fit 33 % at 15 sp and Android broke the word in two on the emulator; "Vrishchika 29°24'" still fits 30 %.
export const COLUMN_WIDTHS = [31, 30, 39] as const;
export const CELL_RIGHT_PADDING = 8;
/** Above this system font scale the tags take their own full-width line and the pada may wrap. */
export const LARGE_TEXT_SCALE = 1.15;

export type TableSubject = { kind: 'planet'; id: PlanetId } | { kind: 'lagna' };

export interface PlanetTableProps {
  chart: ChartData;
  /** Declared birth-time uncertainty (minutes) for the approx tag wording. */
  approxMinutes: number;
  onPressRow: (subject: TableSubject) => void;
  /** System font scale (tests); production reads PixelRatio.getFontScale(). */
  fontScale?: number;
  testID?: string;
}

/** Tag labels for a planet row in the UI language (design 4 vocabulary via dignity.*). */
export function tagLabels(p: Pick<ChartPlanet, 'tags' | 'approx'>, t: TFn): { key: string; label: string }[] {
  return tagsFor(p).map((key) => ({ key, label: t(`dignity.${key}`) }));
}

/** Large text: the N4 glue is released so "Bhadrapada" and the pada can sit on two lines instead of breaking a word. */
export function padaCellText(text: string, large: boolean): string {
  return large ? text.replace(/\u00A0/g, ' ') : text;
}

export function PlanetTable({ chart, approxMinutes, onPressRow, fontScale, testID }: PlanetTableProps) {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  const divider = { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hair };
  const cols = COLUMN_WIDTHS.map((w) => ({ width: `${w}%` as const, paddingRight: CELL_RIGHT_PADDING }));
  const large = (fontScale ?? PixelRatio.getFontScale()) > LARGE_TEXT_SCALE;

  const header = (
    <View style={[styles.row, divider]} accessibilityRole="header">
      <View style={styles.cells}>
        {[t('charts.planet_col'), t('charts.sign_col'), t('charts.nakshatra_col')].map((h, i) => (
          <View key={i} style={cols[i]}>
            <Txt kind="micro" weight={600} color="ink3">
              {h}
            </Txt>
          </View>
        ))}
      </View>
    </View>
  );

  const tagsView = (tags: { key: string; label: string }[], testID?: string) =>
    tags.length ? (
      <View style={[styles.tags, large && styles.tagsLarge]} testID={testID}>
        {tags.map((tag) =>
          tag.key === 'approx' ? <ApproxTag key={tag.key} minutes={approxMinutes || undefined} /> : <Tag key={tag.key} variant="dignity">{tag.label}</Tag>,
        )}
      </View>
    ) : null;

  const lagna = chart.lagna && !chart.moonChart ? chart.lagna : null;
  const rows = chart.planets.map((p, i) => {
    const tags = tagLabels(p, t);
    const name = planetName(lang, p.id);
    const sign = signName(lang, p.sign);
    const deg = degreeText(p, t);
    const pada = padaCellText(padaText(p, lang, t), large);
    const a11y = [name, `${sign} ${deg}`, `${nakshatraName(lang, p.nakshatra)} ${p.pada}`, ...tags.map((x) => x.label)].join(', ');
    const tagsNode = tagsView(tags, `planet-tags-${p.id}`);
    return (
      <Pressable44
        key={p.id}
        accessibilityLabel={a11y}
        onPress={() => onPressRow({ kind: 'planet', id: p.id })}
        style={[styles.row, i < chart.planets.length - 1 && divider]}
        testID={`planet-row-${p.id}`}
      >
        <View style={styles.cells}>
          <View style={cols[0]}>
            <Txt kind="label" weight={600}>
              {name}
            </Txt>
            {large ? null : tagsNode}
          </View>
          <View style={cols[1]}>
            <Txt kind="label" weight={400}>
              {sign}
            </Txt>
            <Num kind="label" weight={400} color="ink2">
              {deg}
            </Num>
          </View>
          <View style={cols[2]}>
            <Txt kind="label" weight={400}>
              {pada}
            </Txt>
          </View>
        </View>
        {large ? tagsNode : null}
      </Pressable44>
    );
  });

  const lagnaTags = lagna?.approx ? [{ key: 'approx', label: t('common.approx') }] : [];
  const lagnaTagsNode = lagna ? tagsView(lagnaTags) : null;

  return (
    <View testID={testID} style={styles.table}>
      {header}
      {lagna ? (
        <Pressable44
          accessibilityLabel={[t('charts.lagna'), `${signName(lang, lagna.sign)} ${degreeText(lagna, t)}`, `${nakshatraName(lang, lagna.nakshatra)} ${lagna.pada}`, ...(lagna.approx ? [t('common.approx')] : [])].join(', ')}
          onPress={() => onPressRow({ kind: 'lagna' })}
          style={[styles.row, divider]}
          testID="planet-row-lagna"
        >
          <View style={styles.cells}>
            <View style={cols[0]}>
              <Txt kind="label" weight={600}>
                {t('charts.lagna')}
              </Txt>
              {large ? null : lagnaTagsNode}
            </View>
            <View style={cols[1]}>
              <Txt kind="label" weight={400}>
                {signName(lang, lagna.sign)}
              </Txt>
              <Num kind="label" weight={400} color="ink2">
                {degreeText(lagna, t)}
              </Num>
            </View>
            <View style={cols[2]}>
              <Txt kind="label" weight={400}>
                {padaCellText(padaText(lagna, lang, t), large)}
              </Txt>
            </View>
          </View>
          {large ? lagnaTagsNode : null}
        </Pressable44>
      ) : null}
      {rows}
    </View>
  );
}

const styles = StyleSheet.create({
  table: { alignSelf: 'stretch' },
  row: { flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', paddingVertical: 8, alignSelf: 'stretch' },
  cells: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'flex-start', alignSelf: 'stretch' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  tagsLarge: { marginTop: 6 },
});
