// Ashtakavarga (F15, design.md 10.3; plan B04): route /charts/ashtakavarga?profile=<id>, banner allow-listed as
// "Ashtakavarga" (M5). Behind canSeeFeature('ashtakavarga') (24-h rewarded key or Pro) with the UnlockSheet. Content:
// planet chips (Sun … Saturn) -> the BAV grid of that planet, 8 x 12: one row per contributor (the seven planets and
// the Lagna), one column per sign, a filled cell where that contributor gives a bindu, and the per-sign totals in
// tabular numerals; then the SAV row - 12 houses with ink-on-neutral strength bars, bindus and the strength class
// (>= 28 strong · 25-27 average · <= 24 weak), each with a Why? (engine rule ids); "How this was computed". Every
// number is engine.ashtakavarga() output (337 bindus in all).
import { ASHTAKAVARGA_PLANETS, type AshtakavargaPlanetId, type AshtakavargaReport, type PlanetId } from '@shubhvela/engine';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ApproxTag, Card, Chip, Num, Row, Screen, Txt } from '../../src/components';
import { LockedFeature, useMountClock } from '../../src/charts/LockedFeature';
import { planetName, signName } from '../../src/charts/model';
import { useRouteProfile } from '../../src/charts/routeProfile';
import { useFeatureAccess } from '../../src/charts/unlockState';
import { ashtakavargaFor, chartFor } from '../../src/engine-bridge/charts';
import { useLang, type Lang, type TFn } from '../../src/i18n';
import { AYANAMSA_KEY, shortValue } from '../../src/settingsLabels';
import { useTokens } from '../../src/theme/ThemeProvider';
import { radius } from '../../src/theme/tokens';

export interface AshtakavargaScreenProps {
  now?: () => number;
  profileId?: number;
}

const REFS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Ascendant'] as const;
const REF_PLANET: Record<(typeof REFS)[number], PlanetId | null> = { Sun: 'Su', Moon: 'Mo', Mars: 'Ma', Mercury: 'Me', Jupiter: 'Ju', Venus: 'Ve', Saturn: 'Sa', Ascendant: null };

/** Label of a contributor row: the planet name, or "Lagna" for the ascendant. */
export function refLabel(ref: (typeof REFS)[number], lang: Lang, t: TFn): string {
  const p = REF_PLANET[ref];
  return p ? planetName(lang, p) : t('charts.lagna');
}

/** The widest SAV value sets the bar scale (ink bar on neutral, design 10.3). */
export function barFraction(bindus: number, report: Pick<AshtakavargaReport, 'sav'>): number {
  const max = Math.max(1, ...report.sav);
  return bindus / max;
}

export default function AshtakavargaScreen({ now, profileId }: AshtakavargaScreenProps) {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  const nowMs = useMountClock(now);
  const profile = useRouteProfile(profileId);
  const access = useFeatureAccess('ashtakavarga', nowMs);
  const [planet, setPlanet] = useState<AshtakavargaPlanetId>('Su');

  if (!profile) {
    return (
      <Screen title={t('ashtakavarga.title')} chrome="stack" route="Ashtakavarga" testID="ashtakavarga-screen">
        <Txt kind="body" color="ink2">
          {t('charts.noProfile')}
        </Txt>
      </Screen>
    );
  }
  if (!access.allowed) {
    return (
      <Screen title={t('ashtakavarga.title')} chrome="stack" route="Ashtakavarga" testID="ashtakavarga-screen">
        <LockedFeature feature="ashtakavarga" testID="ashtakavarga-locked" />
      </Screen>
    );
  }

  const chart = chartFor(profile);
  const report = ashtakavargaFor(chart);
  const grid = report.bav[planet];
  const ayanamsaLabel = shortValue(t(AYANAMSA_KEY[chart.meta.ayanamsa]));
  const cellBorder = { borderColor: colors.hair };

  return (
    <Screen title={t('ashtakavarga.title')} chrome="stack" route="Ashtakavarga" testID="ashtakavarga-screen">
      {report.lagnaAssumed === 'moon' ? (
        <View style={styles.approxRow}>
          <ApproxTag />
          <Txt kind="caption" color="ink2" style={styles.flex}>
            {t('ashtakavarga.lagnaAssumed')}
          </Txt>
        </View>
      ) : null}

      <Card testID="bav-card">
        <Txt kind="heading" accessibilityRole="header">
          {t('ashtakavarga.bav')}
        </Txt>
        <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={t('ashtakavarga.planet_col')}>
          {ASHTAKAVARGA_PLANETS.map((p) => (
            <Chip key={p} label={planetName(lang, p)} selected={p === planet} onPress={() => setPlanet(p)} accessibilityLabel={t('ashtakavarga.selectPlanet', { planet: planetName(lang, p) })} testID={`bav-chip-${p}`} />
          ))}
        </View>
        <Row
          ruleId="ashtakavarga-bav"
          text={t('ashtakavarga.gridTitle', { planet: planetName(lang, planet), total: grid.total })}
          inputs={{ [t('ashtakavarga.planet_col')]: planetName(lang, planet), [t('ashtakavarga.total_col')]: grid.total, [t('charts.lagna')]: signName(lang, report.firstHouseSign) }}
          glossary={['ashtakavarga', 'bindu']}
          testID="bav-title"
        >
          <Txt kind="body" weight={600}>
            {t('ashtakavarga.gridTitle', { planet: planetName(lang, planet), total: grid.total })}
          </Txt>
        </Row>
        <View accessible accessibilityRole="image" accessibilityLabel={t('ashtakavarga.gridA11yLabel', { planet: planetName(lang, planet) })} testID={`bav-grid-${planet}`}>
          {/* header: sign numbers 1-12 */}
          <View style={styles.gridRow}>
            <View style={styles.refCell}>
              <Txt kind="micro" color="ink3">
                {t('ashtakavarga.reference_col')}
              </Txt>
            </View>
            {Array.from({ length: 12 }, (_, s) => (
              <View key={s} style={[styles.cell, cellBorder]} accessibilityLabel={signName(lang, s + 1)}>
                <Num kind="micro" color="ink3">
                  {String(s + 1)}
                </Num>
              </View>
            ))}
          </View>
          {REFS.map((ref) => {
            const flags = grid.contributions[ref];
            const signs = flags.map((f, i) => (f ? i + 1 : 0)).filter(Boolean);
            return (
              <View key={ref} style={styles.gridRow} accessibilityLabel={t('ashtakavarga.contribA11y', { ref: refLabel(ref, lang, t), signs: signs.join(', ') })} testID={`bav-row-${ref}`}>
                <View style={styles.refCell}>
                  <Txt kind="micro" color="ink2">
                    {refLabel(ref, lang, t)}
                  </Txt>
                </View>
                {flags.map((f, i) => (
                  <View key={i} style={[styles.cell, cellBorder, f ? { backgroundColor: colors.neutral } : null]}>
                    {f ? <View style={[styles.dot, { backgroundColor: colors.ink }]} /> : null}
                  </View>
                ))}
              </View>
            );
          })}
          <View style={[styles.gridRow, styles.totalRow, { borderTopColor: colors.hair2 }]} testID={`bav-totals-${planet}`}>
            <View style={styles.refCell}>
              <Txt kind="micro" weight={600} color="ink">
                {t('ashtakavarga.total_col')}
              </Txt>
            </View>
            {grid.bySign.map((n, i) => (
              <View key={i} style={[styles.cell, cellBorder]}>
                <Num kind="micro" weight={600}>
                  {String(n)}
                </Num>
              </View>
            ))}
          </View>
        </View>
        <Txt kind="caption" color="ink3" style={styles.note}>
          {t('ashtakavarga.rowA11y', { planet: planetName(lang, planet), total: grid.total, list: grid.byHouse.join(' · ') })}
        </Txt>
      </Card>

      <Card testID="sav-card">
        <Row
          ruleId="ashtakavarga-sav"
          text={`${t('ashtakavarga.sav')} · ${t('ashtakavarga.total')}`}
          inputs={{ [t('ashtakavarga.total_col')]: report.total, [t('charts.lagna')]: signName(lang, report.firstHouseSign) }}
          glossary={['ashtakavarga']}
          testID="sav-title"
        >
          <Txt kind="heading">{t('ashtakavarga.sav')}</Txt>
        </Row>
        <Txt kind="caption" color="ink2" testID="sav-total">
          {t('ashtakavarga.total')}
        </Txt>
        {report.houseStrength.map((h, i) => {
          const line = t('ashtakavarga.savLine', { house: h.house, sign: signName(lang, h.sign), bindus: h.bindus });
          return (
            <Row
              key={h.house}
              ruleId={h.ruleId}
              text={`${line} · ${t(`ashtakavarga.strength.${h.strength}`)}`}
              inputs={{ [t('ashtakavarga.house_col')]: h.house, [t('ashtakavarga.sign_col')]: signName(lang, h.sign), [t('ashtakavarga.bindus', { count: h.bindus })]: h.bindus, [t('ashtakavarga.thresholds')]: t(`ashtakavarga.strength.${h.strength}`) }}
              glossary={['sarvashtakavarga']}
              divider={i < report.houseStrength.length - 1}
              caption={
                <View style={styles.barWrap} accessibilityLabel={t('ashtakavarga.savBarA11y', { house: h.house, sign: signName(lang, h.sign), bindus: h.bindus, strength: t(`ashtakavarga.strength.${h.strength}`) })}>
                  <View style={[styles.barTrack, { backgroundColor: colors.neutral }]}>
                    <View style={[styles.barFill, { backgroundColor: colors.ink, width: `${Math.round(barFraction(h.bindus, report) * 100)}%` }]} testID={`sav-bar-${h.house}`} />
                  </View>
                  <Txt kind="micro" color="ink2">
                    {t(`ashtakavarga.strength.${h.strength}`)}
                  </Txt>
                </View>
              }
              testID={`sav-row-${h.house}`}
            >
              <Txt kind="body">
                <Txt kind="body" color="ink2">{`${t('kp.houseN', { n: h.house })} · ${signName(lang, h.sign)} · `}</Txt>
                <Num kind="body" weight={600}>
                  {String(h.bindus)}
                </Num>
              </Txt>
            </Row>
          );
        })}
        <Txt kind="caption" color="ink3" style={styles.note}>
          {t('ashtakavarga.thresholds')}
        </Txt>
      </Card>

      <Txt kind="caption" color="ink3" testID="ashtakavarga-how">
        {`${t('ashtakavarga.howComputed', { firstHouse: signName(lang, report.firstHouseSign) })} ${ayanamsaLabel}.`}
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  approxRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  gridRow: { flexDirection: 'row', alignItems: 'stretch' },
  refCell: { width: 64, justifyContent: 'center', paddingVertical: 4, paddingRight: 4 },
  cell: { flex: 1, minHeight: 24, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  totalRow: { borderTopWidth: 1, marginTop: 2 },
  note: { marginTop: 8 },
  barWrap: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  barTrack: { flex: 1, height: 8, borderRadius: radius.tag, overflow: 'hidden' },
  barFill: { height: 8 },
});
