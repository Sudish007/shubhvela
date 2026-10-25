// Vimshottari card (F14, design.md 10.3 M13): "Full tree" link; maha line; the antar strip = nine cells proportional
// to duration (current cell accent-tint + accent border, 2 px ink marker, "You are here · <date>" above; a planet label
// only in cells >= 28 dp, narrower cells are named only in the accessible label and in the full tree, N7); rows Now /
// Next (with Why?) / "Pratyantar dasha and change notifications (off until you switch them on) · Pro" whose Pro tag
// opens the honest pre-B03 sheet. Every date is engine.dasha() output in the profile's zone.
import { current, type ChartData, type DashaTree, type PlanetId } from '@shubhvela/engine';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card } from '../components/Card';
import { Num } from '../components/Num';
import { Pressable44 } from '../components/Pressable44';
import { Row } from '../components/Row';
import { Tag } from '../components/Tag';
import { Txt } from '../components/Txt';
import { useLang, type Lang, type TFn } from '../i18n';
import { useTokens } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';
import { fmtDate } from '../today/format';
import { RichText } from '../today/RichText';
import { antarCells, antarMarkerX, dateRange, durationText, nakshatraName, nextAntar, planetName } from './model';

export interface DashaCardProps {
  chart: ChartData;
  tree: DashaTree;
  nowMs: number;
  tz: string;
  ayanamsaLabel: string;
  onFullTree: () => void;
  onPressPro: () => void;
  /** Strip width for tests; measured by onLayout otherwise. */
  width?: number;
  testID?: string;
}

/** Default strip width before onLayout (390 dp - 2 x 16 gutter - 2 x 16 card padding). */
export const DEFAULT_STRIP_WIDTH = 326;
const STRIP_H = 36;

/** Accessible text of the strip: every antar with its dates, the current one marked (N7). */
export function stripA11y(maha: { lord: PlanetId; children?: { lord: PlanetId; start: number; end: number }[] }, nowMs: number, tz: string, lang: Lang, t: TFn): string {
  const list = (maha.children ?? [])
    .map((a) => `${planetName(lang, a.lord)} ${fmtDate(a.start, tz, lang)} – ${fmtDate(a.end, tz, lang)}${a.start <= nowMs && nowMs < a.end ? ` ${t('dasha.current')}` : ''}`)
    .join('; ');
  return t('dasha.antarStripA11y', { lord: planetName(lang, maha.lord), list });
}

export function DashaCard({ chart, tree, nowMs, tz, ayanamsaLabel, onFullTree, onPressPro, width: widthProp, testID }: DashaCardProps) {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  const [measured, setMeasured] = useState<number | null>(null);
  const width = widthProp ?? measured ?? DEFAULT_STRIP_WIDTH;
  const cur = current(tree, nowMs);
  const next = nextAntar(tree, nowMs);
  const moon = chart.planets.find((p) => p.id === 'Mo');

  return (
    <Card testID={testID}>
      <View style={styles.titleRow}>
        <Txt kind="heading" accessibilityRole="header" style={styles.title}>
          {t('dasha.title')}
        </Txt>
        <Pressable44 accessibilityLabel={t('dasha.fullTree')} onPress={onFullTree} style={styles.link} testID="dasha-full-tree">
          <Txt kind="label" weight={600} color="accent">
            {t('dasha.fullTree')}
          </Txt>
        </Pressable44>
      </View>
      {cur ? (
        <>
          <RichText kind="label" weight={400} color="ink2" text={t('dasha.mahaLine', { lord: planetName(lang, cur.maha.lord), from: fmtDate(cur.maha.start, tz, lang), to: fmtDate(cur.maha.end, tz, lang) })} testID="dasha-maha-line" />
          <View style={styles.hereRow}>
            <RichText kind="caption" weight={600} color="accent" text={t('dasha.youAreHere', { date: fmtDate(nowMs, tz, lang) })} testID="dasha-you-are-here" />
          </View>
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={stripA11y(cur.maha, nowMs, tz, lang, t)}
            onLayout={(e) => setMeasured(Math.round(e.nativeEvent.layout.width))}
            style={[styles.strip, { height: STRIP_H }]}
            testID="antar-strip"
          >
            {antarCells(cur.maha, nowMs, width).map((c) => (
              <View
                key={c.node.lord}
                style={[
                  styles.cell,
                  { left: c.x, width: c.width, height: STRIP_H, borderColor: c.current ? colors.accent : colors.hair2, backgroundColor: c.current ? colors.accentTint : colors.surface },
                ]}
                testID={`antar-cell-${c.node.lord}`}
              >
                {c.label ? (
                  <Txt kind="micro" weight={c.current ? 600 : 400} color={c.current ? 'accent' : 'ink2'} latin testID={`antar-label-${c.node.lord}`}>
                    {c.node.lord}
                  </Txt>
                ) : null}
              </View>
            ))}
            <View style={[styles.marker, { left: antarMarkerX(cur.maha, nowMs, width) - 1, height: STRIP_H, backgroundColor: colors.ink }]} testID="antar-marker" />
          </View>
          <View style={styles.rows}>
            <Row
              ruleId="dasha-vimshottari"
              text={`${t('dasha.now')}: ${t('dasha.pair', { maha: planetName(lang, cur.maha.lord), antar: planetName(lang, cur.antar.lord) })}`}
              inputs={{ maha: planetName(lang, cur.maha.lord), antar: planetName(lang, cur.antar.lord), start: fmtDate(cur.antar.start, tz, lang), end: fmtDate(cur.antar.end, tz, lang) }}
              glossary={['mahadasha', 'antardasha']}
              caption={<Num kind="caption" color="ink3">{dateRange(cur.antar.start, cur.antar.end, tz, lang, t)}</Num>}
              testID="dasha-now"
            >
              <Txt kind="body">
                <Txt kind="body" color="ink3">{`${t('dasha.now')}  `}</Txt>
                <Txt kind="body" weight={600}>
                  {t('dasha.pair', { maha: planetName(lang, cur.maha.lord), antar: planetName(lang, cur.antar.lord) })}
                </Txt>
              </Txt>
            </Row>
            {next ? (
              <Row
                ruleId="dasha-change"
                text={`${t('dasha.next')}: ${t('dasha.pair', { maha: planetName(lang, next.maha.lord), antar: planetName(lang, next.antar.lord) })}`}
                inputs={{ maha: planetName(lang, next.maha.lord), antar: planetName(lang, next.antar.lord), start: fmtDate(next.antar.start, tz, lang), end: fmtDate(next.antar.end, tz, lang) }}
                glossary={['antardasha']}
                caption={<RichText kind="caption" color="ink3" text={t('dasha.fromLine', { date: fmtDate(next.antar.start, tz, lang), duration: durationText(next.antar.end - next.antar.start, t) })} />}
                testID="dasha-next"
              >
                <Txt kind="body">
                  <Txt kind="body" color="ink3">{`${t('dasha.next')}  `}</Txt>
                  <Txt kind="body" weight={600}>
                    {t('dasha.pair', { maha: planetName(lang, next.maha.lord), antar: planetName(lang, next.antar.lord) })}
                  </Txt>
                </Txt>
              </Row>
            ) : null}
            <Row
              ruleId="dasha-vimshottari"
              text={t('dasha.pratyantarPro')}
              divider={false}
              caption={
                <Txt kind="caption" color="ink3">
                  {t('dasha.proOff')}
                </Txt>
              }
              control={
                <Pressable44 accessibilityLabel={`${t('dasha.pratyantarPro')}, ${t('common.pro')}`} onPress={onPressPro} testID="dasha-pro">
                  <Tag variant="kind">{t('dasha.pro_tag')}</Tag>
                </Pressable44>
              }
              testID="dasha-pratyantar"
            >
              <Txt kind="body">{t('dasha.pratyantarPro')}</Txt>
            </Row>
          </View>
        </>
      ) : null}
      {moon ? (
        <RichText
          kind="caption"
          color="ink3"
          style={styles.footer}
          text={t('dasha.howComputed', {
            nakshatra: nakshatraName(lang, tree.birthNakshatra),
            pada: tree.pada,
            years: tree.balanceAtBirth.years.toFixed(2),
            lord: planetName(lang, tree.balanceAtBirth.lord),
            ayanamsa: ayanamsaLabel,
          })}
          testID="dasha-how"
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1 },
  link: { paddingHorizontal: 8 },
  hereRow: { marginTop: 8, flexDirection: 'row' },
  strip: { alignSelf: 'stretch', position: 'relative', marginTop: 4 },
  cell: { position: 'absolute', top: 0, borderWidth: 1, borderRadius: radius.tag, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  marker: { position: 'absolute', top: 0, width: 2 },
  rows: { marginTop: 8 },
  footer: { marginTop: 12 },
});
