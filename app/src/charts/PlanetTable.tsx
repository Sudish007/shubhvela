// Planets card table (design.md 4, N7): three FIXED columns - 31 % Planet (tags under the name) · 36 % Sign and degree
// (tabular) · 33 % Nakshatra and pada (one NoBreak run) - 8 dp right padding per cell, headers that wrap rather than
// truncate. The Lagna row comes first (hidden in Moon-chart mode), then the nine planets; every row is a 44 dp control
// that opens the PlanetSheet. Every applicable dignity/mark tag is shown (a planet can be combust + friend + vargottama).
import type { ChartData, ChartPlanet, PlanetId } from '@shubhvela/engine';
import { StyleSheet, View } from 'react-native';
import { Num, NoBreak } from '../components/Num';
import { Pressable44 } from '../components/Pressable44';
import { Tag, ApproxTag } from '../components/Tag';
import { Txt } from '../components/Txt';
import { useLang, type TFn } from '../i18n';
import { useTokens } from '../theme/ThemeProvider';
import { degreeText, nakshatraName, padaText, planetName, signName, tagsFor } from './model';

/** Column widths in percent (design 4); they sum to 100. */
export const COLUMN_WIDTHS = [31, 36, 33] as const;
export const CELL_RIGHT_PADDING = 8;

export type TableSubject = { kind: 'planet'; id: PlanetId } | { kind: 'lagna' };

export interface PlanetTableProps {
  chart: ChartData;
  /** Declared birth-time uncertainty (minutes) for the approx tag wording. */
  approxMinutes: number;
  onPressRow: (subject: TableSubject) => void;
  testID?: string;
}

/** Tag labels for a planet row in the UI language (design 4 vocabulary via dignity.*). */
export function tagLabels(p: Pick<ChartPlanet, 'tags' | 'approx'>, t: TFn): { key: string; label: string }[] {
  return tagsFor(p).map((key) => ({ key, label: t(`dignity.${key}`) }));
}

export function PlanetTable({ chart, approxMinutes, onPressRow, testID }: PlanetTableProps) {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  const divider = { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hair };
  const cols = COLUMN_WIDTHS.map((w) => ({ width: `${w}%` as const, paddingRight: CELL_RIGHT_PADDING }));

  const header = (
    <View style={[styles.row, divider]} accessibilityRole="header">
      {[t('charts.planet_col'), t('charts.sign_col'), t('charts.nakshatra_col')].map((h, i) => (
        <View key={i} style={cols[i]}>
          <Txt kind="micro" weight={600} color="ink3">
            {h}
          </Txt>
        </View>
      ))}
    </View>
  );

  const lagna = chart.lagna && !chart.moonChart ? chart.lagna : null;
  const rows = chart.planets.map((p, i) => {
    const tags = tagLabels(p, t);
    const name = planetName(lang, p.id);
    const sign = signName(lang, p.sign);
    const deg = degreeText(p, t);
    const pada = padaText(p, lang, t);
    const a11y = [name, `${sign} ${deg}`, `${nakshatraName(lang, p.nakshatra)} ${p.pada}`, ...tags.map((x) => x.label)].join(', ');
    return (
      <Pressable44
        key={p.id}
        accessibilityLabel={a11y}
        onPress={() => onPressRow({ kind: 'planet', id: p.id })}
        style={[styles.row, i < chart.planets.length - 1 && divider]}
        testID={`planet-row-${p.id}`}
      >
        <View style={cols[0]}>
          <Txt kind="label" weight={600}>
            {name}
          </Txt>
          {tags.length ? (
            <View style={styles.tags} testID={`planet-tags-${p.id}`}>
              {tags.map((tag) =>
                tag.key === 'approx' ? <ApproxTag key={tag.key} minutes={approxMinutes || undefined} /> : <Tag key={tag.key} variant="dignity">{tag.label}</Tag>,
              )}
            </View>
          ) : null}
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
          <NoBreak kind="label" weight={400}>
            {pada}
          </NoBreak>
        </View>
      </Pressable44>
    );
  });

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
          <View style={cols[0]}>
            <Txt kind="label" weight={600}>
              {t('charts.lagna')}
            </Txt>
            {lagna.approx ? (
              <View style={styles.tags}>
                <ApproxTag minutes={approxMinutes || undefined} />
              </View>
            ) : null}
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
            <NoBreak kind="label" weight={400}>
              {padaText(lagna, lang, t)}
            </NoBreak>
          </View>
        </Pressable44>
      ) : null}
      {rows}
    </View>
  );
}

const styles = StyleSheet.create({
  table: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'flex-start', paddingVertical: 8, alignSelf: 'stretch' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
});
