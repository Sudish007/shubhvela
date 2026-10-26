// Divisional charts, full screen (F12, design.md 4 / 10.3; plan B04): route /charts/vargas?profile=<id>&varga=<D-id>.
// Chips for all 15 F12 charts (D9 free; the 14 others behind the `vargas` key / Pro - the locked state shows the
// UnlockSheet), the chosen varga drawn by the SAME Chart component in the user's style, then the table of every planet
// (and the Lagna) in that varga: varga sign · degree ((D1 degree x N) mod 30) with the dignity tags recomputed for the
// varga sign, and the "How this was computed" line naming the BPHS mapping. Every value is engine.varga() output.
import { DIVISIONAL_CHART_IDS, isDivisionalChartId, vargaInfo, type DivisionalChartId } from '@shubhvela/engine';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, Chip, Num, Row, Screen, Tag, Txt, ApproxTag } from '../../src/components';
import { Chart } from '../../src/charts/Chart';
import { LockedFeature, useMountClock } from '../../src/charts/LockedFeature';
import { chartForChip, degreeText, isLockedVarga, planetName, signName, tagsFor, vargaDomainText, vargaLabel } from '../../src/charts/model';
import { useRouteProfile, useRouteVarga } from '../../src/charts/routeProfile';
import { profileLabel } from '../../src/charts/sheets';
import { useFeatureAccess } from '../../src/charts/unlockState';
import { getSetting } from '../../src/db/settings';
import { chartFor } from '../../src/engine-bridge/charts';
import { useLang } from '../../src/i18n';
import { AYANAMSA_KEY, CHART_STYLE_KEY, NODE_KEY, shortValue } from '../../src/settingsLabels';
import { useTokens } from '../../src/theme/ThemeProvider';

export interface VargasScreenProps {
  now?: () => number;
  profileId?: number;
  varga?: string;
  chartWidth?: number;
}

const DEFAULT_CHART_WIDTH = 326;

export default function VargasScreen({ now, profileId, varga: vargaProp, chartWidth }: VargasScreenProps) {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  const nowMs = useMountClock(now);
  const profile = useRouteProfile(profileId);
  const routeVarga = useRouteVarga(vargaProp);
  const access = useFeatureAccess('vargas', nowMs);
  const [picked, setPicked] = useState<DivisionalChartId | null>(null);
  const [measured, setMeasured] = useState<number | null>(null);

  if (!profile) {
    return (
      <Screen title={t('vargas.title')} chrome="stack" testID="vargas-screen">
        <Txt kind="body" color="ink2">
          {t('charts.noProfile')}
        </Txt>
      </Screen>
    );
  }
  const id: DivisionalChartId = picked ?? (routeVarga && isDivisionalChartId(routeVarga) ? routeVarga : 'D9');
  const locked = isLockedVarga(id) && !access.allowed;
  const base = chartFor(profile);
  const info = vargaInfo(id);
  const style = getSetting('chartStyle');
  const width = chartWidth ?? measured ?? DEFAULT_CHART_WIDTH;
  const ayanamsaLabel = shortValue(t(AYANAMSA_KEY[base.meta.ayanamsa]));
  const nodeLabel = shortValue(t(NODE_KEY[base.meta.node]));

  const chips = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} accessibilityLabel={t('vargas.title')} testID="vargas-chip-row">
      {DIVISIONAL_CHART_IDS.map((v) => (
        <Chip key={v} label={v} selected={v === id} onPress={() => setPicked(v)} accessibilityLabel={`${vargaLabel(v, t)}${isLockedVarga(v) && !access.allowed ? `, ${t('unlock.locked_tag')}` : ''}`} testID={`vargas-chip-${v}`} />
      ))}
    </ScrollView>
  );

  if (locked) {
    return (
      <Screen title={vargaLabel(id, t)} chrome="stack" testID="vargas-screen">
        {chips}
        <LockedFeature feature="vargas" testID="vargas-locked" />
      </Screen>
    );
  }

  const chart = chartForChip(base, id);
  const rows = [...(chart.lagna && !chart.moonChart ? [{ key: 'lagna', name: t('charts.lagna'), p: chart.lagna, tags: chart.lagna.approx ? ['approx'] : [] }] : []), ...chart.planets.map((p) => ({ key: p.id, name: planetName(lang, p.id), p, tags: tagsFor(p) }))];

  return (
    <Screen title={vargaLabel(id, t)} chrome="stack" subtitle={<Txt kind="caption" color="ink2">{vargaDomainText(id, t)}</Txt>} testID="vargas-screen">
      {chips}
      <Card testID="vargas-hero">
        <Row
          ruleId={info.ruleId}
          text={`${vargaLabel(id, t)} · ${t('vargas.parts', { n: info.divisor })}`}
          inputs={{ [t('vargas.parts', { n: info.divisor })]: info.divisor, [t('settings.ayanamsa')]: ayanamsaLabel, [t('settings.nodes')]: nodeLabel }}
          glossary={['varga', info.name.toLowerCase()]}
          divider={false}
        >
          <Txt kind="heading">{vargaLabel(id, t)}</Txt>
        </Row>
        <View style={styles.chartBox} onLayout={(e) => setMeasured(Math.round(e.nativeEvent.layout.width))}>
          <Chart style={style} chart={chart} width={width} styleName={t(CHART_STYLE_KEY[style])} centreLines={style === 'north' ? undefined : [profileLabel(profile, t), id]} testID="vargas-chart" />
        </View>
      </Card>

      <Card testID="vargas-table">
        <View style={[styles.head, { borderBottomColor: colors.hair }]}>
          <Txt kind="micro" weight={600} color="ink3" style={styles.colPlanet}>
            {t('charts.planet_col')}
          </Txt>
          <Txt kind="micro" weight={600} color="ink3" style={styles.colSign}>
            {t('vargas.varga_col')}
          </Txt>
        </View>
        {rows.map((r, i) => (
          <View key={r.key} style={[styles.row, i < rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hair }]} testID={`vargas-row-${r.key}`}>
            <View style={styles.colPlanet}>
              <Txt kind="label" weight={600}>
                {r.name}
              </Txt>
              {r.tags.length ? (
                <View style={styles.tags}>
                  {r.tags.map((tag) => (tag === 'approx' ? <ApproxTag key={tag} /> : <Tag key={tag} variant="dignity">{t(`dignity.${tag}`)}</Tag>))}
                </View>
              ) : null}
            </View>
            <View style={styles.colSign}>
              <Txt kind="label" weight={400}>
                {signName(lang, r.p.sign)}
              </Txt>
              <Num kind="caption" color="ink2">
                {degreeText(r.p, t)}
              </Num>
            </View>
          </View>
        ))}
        <Txt kind="caption" color="ink3" style={styles.note}>
          {`${t('vargas.degreeNote', { n: info.divisor })} · ${t('vargas.vargottamaNote')}${info.classBased ? ` · ${t('vargas.classBased')}` : ''}`}
        </Txt>
      </Card>

      <Txt kind="caption" color="ink3" testID="vargas-how">
        {t('vargas.howComputed', { id, name: info.name, n: info.divisor, ayanamsa: ayanamsaLabel, node: nodeLabel.toLowerCase() })}
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 16 },
  chartBox: { alignSelf: 'stretch', alignItems: 'center', marginTop: 8 },
  head: { flexDirection: 'row', gap: 8, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', gap: 8, paddingVertical: 8, alignItems: 'flex-start' },
  colPlanet: { flex: 1, minWidth: 0, gap: 4 },
  colSign: { width: 140 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  note: { marginTop: 8 },
});
