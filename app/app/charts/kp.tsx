// KP (F15, design.md 10.3; plan B04): route /charts/kp?profile=<id>, banner allow-listed as "KP" (M5). Behind
// canSeeFeature('kp') with the UnlockSheet. Tables: Placidus cusps (cusp, sign · degree, sign / star / sub lord; the
// sub-sub lord in the Why? inputs), planets with their four-fold lords and Placidus house, significators by house
// (grades A-D + Rahu/Ketu agents), ruling planets for "now" with the instant and place printed. Headers are 12 sp and
// wrap rather than truncate. The KP ayanamsa is the system's own (engine default) under the F19 node setting; "How this
// was computed" states it. Every value is engine.kp() / engine.rulingPlanets() output.
import type { KpLords, KpReport, PlanetId } from '@shubhvela/engine';
import { StyleSheet, View } from 'react-native';
import { ApproxTag, Card, NoBreak, Num, Row, Screen, Txt } from '../../src/components';
import { LockedFeature, useMountClock } from '../../src/charts/LockedFeature';
import { degreeText, planetName, shortPlace, signName } from '../../src/charts/model';
import { useRouteProfile } from '../../src/charts/routeProfile';
import { useFeatureAccess } from '../../src/charts/unlockState';
import { getSetting } from '../../src/db/settings';
import { kpFor, rulingPlanetsFor } from '../../src/engine-bridge/charts';
import { useLang, type Lang } from '../../src/i18n';
import { NODE_KEY, nodeWord } from '../../src/settingsLabels';
import { useTokens } from '../../src/theme/ThemeProvider';
import { fmtDayTime } from '../../src/today/format';

export interface KpScreenProps {
  now?: () => number;
  profileId?: number;
}

/** "Ju · Sa · Me" - the sign, star and sub lords as planet short names (the table cell; full names in the a11y label). */
export function lordsText(l: KpLords): string {
  return `${l.signLord} · ${l.starLord} · ${l.subLord}`;
}

/** Planet list as names, or the "none" word. */
export function planetList(ids: readonly PlanetId[], lang: Lang, none: string): string {
  return ids.length ? ids.map((p) => planetName(lang, p)).join(', ') : none;
}

/** 12 cusp rows in cusp order (exported for tests). */
export function cuspRows(report: KpReport) {
  return report.cusps;
}

export default function KpScreen({ now, profileId }: KpScreenProps) {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  const nowMs = useMountClock(now);
  const profile = useRouteProfile(profileId);
  const access = useFeatureAccess('kp', nowMs);

  if (!profile) {
    return (
      <Screen title={t('kp.title')} chrome="stack" route="KP" testID="kp-screen">
        <Txt kind="body" color="ink2">
          {t('charts.noProfile')}
        </Txt>
      </Screen>
    );
  }
  if (!access.allowed) {
    return (
      <Screen title={t('kp.title')} chrome="stack" route="KP" testID="kp-screen">
        <LockedFeature feature="kp" testID="kp-locked" />
      </Screen>
    );
  }

  const report = kpFor(profile);
  const ruling = rulingPlanetsFor(profile, nowMs);
  const approx = report.timeUnknown || report.polar;
  const divider = { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hair };
  const head = (label: string, style: object) => (
    <Txt kind="micro" weight={600} color="ink3" style={style}>
      {label}
    </Txt>
  );

  return (
    <Screen title={t('kp.title')} chrome="stack" route="KP" subtitle={<Txt kind="caption" color="ink2">{t('kp.subtitle')}</Txt>} testID="kp-screen">
      {report.timeUnknown ? (
        <View style={styles.approxRow}>
          <ApproxTag />
          <Txt kind="caption" color="ink2" style={styles.flex}>
            {t('kp.timeUnknown')}
          </Txt>
        </View>
      ) : null}
      {report.polar ? (
        <View style={styles.approxRow}>
          <ApproxTag />
          <Txt kind="caption" color="ink2" style={styles.flex}>
            {t('kp.polar')}
          </Txt>
        </View>
      ) : null}

      <Card testID="kp-cusps-card">
        <Row ruleId="kp-cusps-placidus" text={t('kp.cusps')} inputs={{ [t('settings.ayanamsa')]: `KP ${report.ayanamsaDegrees.toFixed(4)}°`, [t('settings.nodes')]: report.nodeMethod }} glossary={['bhava', 'placidus']} divider={false}>
          <Txt kind="heading">{t('kp.cusps')}</Txt>
        </Row>
        <View style={[styles.tableHead, divider]}>
          {head(t('kp.cusp_col'), styles.colN)}
          {head(t('kp.position_col'), styles.colPos)}
          {head(t('kp.lords_col'), styles.colLords)}
        </View>
        {cuspRows(report).map((c, i) => {
          const degree = degreeText(c, t);
          return (
            <Row
              key={c.n}
              ruleId="kp-sub-lord"
              text={t('kp.cuspRowA11y', { n: c.n, sign: signName(lang, c.sign), degree, signLord: planetName(lang, c.signLord), starLord: planetName(lang, c.starLord), subLord: planetName(lang, c.subLord) })}
              inputs={{
                [t('kp.cusp_col')]: c.n,
                [t('kp.position_col')]: `${signName(lang, c.sign)} ${degree}`,
                [t('kp.signLord_col')]: planetName(lang, c.signLord),
                [t('kp.starLord_col')]: planetName(lang, c.starLord),
                [t('kp.subLord_col')]: planetName(lang, c.subLord),
                [t('kp.subSubLord_col')]: planetName(lang, c.subSubLord),
              }}
              glossary={['sub-lord', 'nakshatra']}
              divider={i < report.cusps.length - 1}
              testID={`kp-cusp-${c.n}`}
            >
              <View style={styles.tableRow}>
                <Num kind="label" weight={600} style={styles.colN}>
                  {String(c.n)}
                </Num>
                <View style={styles.colPos}>
                  <Txt kind="label" weight={400}>
                    {signName(lang, c.sign)}
                  </Txt>
                  <Num kind="caption" color="ink2">
                    {degree}
                  </Num>
                </View>
                <NoBreak kind="label" weight={400} color="ink2" numeric style={styles.colLords}>
                  {lordsText(c)}
                </NoBreak>
              </View>
            </Row>
          );
        })}
        {approx ? <ApproxTag style={styles.note} /> : null}
      </Card>

      <Card testID="kp-planets-card">
        <Txt kind="heading" accessibilityRole="header">
          {t('kp.planets')}
        </Txt>
        <View style={[styles.tableHead, divider]}>
          {head(t('kp.planet_col'), styles.colN)}
          {head(t('kp.position_col'), styles.colPos)}
          {head(t('kp.lords_col'), styles.colLords)}
        </View>
        {report.planets.map((p, i) => {
          const degree = degreeText(p, t);
          return (
            <Row
              key={p.id}
              ruleId="kp-sub-lord"
              text={t('kp.planetRowA11y', { planet: planetName(lang, p.id), sign: signName(lang, p.sign), degree, house: p.house, signLord: planetName(lang, p.signLord), starLord: planetName(lang, p.starLord), subLord: planetName(lang, p.subLord) })}
              inputs={{
                [t('kp.planet_col')]: planetName(lang, p.id),
                [t('kp.position_col')]: `${signName(lang, p.sign)} ${degree}`,
                [t('kp.house_col')]: p.house,
                [t('kp.signLord_col')]: planetName(lang, p.signLord),
                [t('kp.starLord_col')]: planetName(lang, p.starLord),
                [t('kp.subLord_col')]: planetName(lang, p.subLord),
                [t('kp.subSubLord_col')]: planetName(lang, p.subSubLord),
              }}
              glossary={['sub-lord']}
              divider={i < report.planets.length - 1}
              testID={`kp-planet-${p.id}`}
            >
              <View style={styles.tableRow}>
                <View style={styles.colN}>
                  <Txt kind="label" weight={600}>
                    {planetName(lang, p.id)}
                  </Txt>
                  <Num kind="micro" color="ink3">
                    {t('kp.houseN', { n: p.house })}
                  </Num>
                </View>
                <View style={styles.colPos}>
                  <Txt kind="label" weight={400}>
                    {signName(lang, p.sign)}
                  </Txt>
                  <Num kind="caption" color="ink2">
                    {degree}
                  </Num>
                </View>
                <NoBreak kind="label" weight={400} color="ink2" numeric style={styles.colLords}>
                  {lordsText(p)}
                </NoBreak>
              </View>
            </Row>
          );
        })}
      </Card>

      <Card testID="kp-significators-card">
        <Row ruleId="kp-significators" text={t('kp.significators')} glossary={['significator']} divider={false}>
          <Txt kind="heading">{t('kp.significators')}</Txt>
        </Row>
        <Txt kind="caption" color="ink3">
          {`${t('kp.gradeA')} · ${t('kp.gradeB')} · ${t('kp.gradeC')} · ${t('kp.gradeD')}`}
        </Txt>
        {report.significators.map((s, i) => {
          const none = t('kp.noSignificator');
          return (
            <View key={s.house} style={[styles.sigRow, i < report.significators.length - 1 && divider]} accessible accessibilityLabel={t('kp.sigA11y', { house: s.house, A: planetList(s.A, lang, none), B: planetList(s.B, lang, none), C: planetList(s.C, lang, none), D: planetList(s.D, lang, none) })} testID={`kp-sig-${s.house}`}>
              <Num kind="label" weight={600} style={styles.colN}>
                {t('kp.houseN', { n: s.house })}
              </Num>
              <View style={styles.flex}>
                {(['A', 'B', 'C', 'D'] as const).map((g) => (
                  <Txt key={g} kind="caption" color="ink2">
                    <Txt kind="caption" weight={600} color="ink3" latin>{`${g}  `}</Txt>
                    {planetList(s[g], lang, none)}
                  </Txt>
                ))}
                {s.agents.length ? (
                  <Txt kind="caption" color="ink3">
                    {`${t('kp.agents')}: ${planetList(s.agents, lang, none)}`}
                  </Txt>
                ) : null}
              </View>
            </View>
          );
        })}
      </Card>

      <Card testID="kp-ruling-card">
        <Row
          ruleId={ruling.ruleId}
          text={`${t('kp.rulingAt', { time: fmtDayTime(ruling.at, profile.tz, lang) })} ${t('kp.rulingPlace', { place: shortPlace(profile.placeName) })}`}
          inputs={{
            [t('charts.lagna')]: `${signName(lang, ruling.lagna.sign)} · ${lordsText(ruling.lagna)}`,
            [t('charts.moon_chip')]: `${signName(lang, ruling.moon.sign)} · ${lordsText(ruling.moon)}`,
            [t('panchang.vara')]: t('kp.dayLord', { planet: planetName(lang, ruling.dayLord) }),
          }}
          glossary={['ruling-planets', 'hora']}
          divider={false}
        >
          <Txt kind="heading">{t('kp.rulingPlanets')}</Txt>
        </Row>
        <Num kind="caption" color="ink2" testID="kp-ruling-at">
          {`${fmtDayTime(ruling.at, profile.tz, lang)} · ${shortPlace(profile.placeName)}`}
        </Num>
        <Txt kind="body" weight={600} style={styles.note} testID="kp-ruling-list">
          {planetList(ruling.list, lang, t('kp.noSignificator'))}
        </Txt>
        <Txt kind="caption" color="ink2">
          {t('kp.lagnaLords', { sign: planetName(lang, ruling.lagna.signLord), star: planetName(lang, ruling.lagna.starLord), sub: planetName(lang, ruling.lagna.subLord) })}
        </Txt>
        <Txt kind="caption" color="ink2">
          {t('kp.moonLords', { sign: planetName(lang, ruling.moon.signLord), star: planetName(lang, ruling.moon.starLord), sub: planetName(lang, ruling.moon.subLord) })}
        </Txt>
        <Txt kind="caption" color="ink2">
          {t('kp.dayLord', { planet: planetName(lang, ruling.dayLord) })}
        </Txt>
        {ruling.agents.length ? (
          <Txt kind="caption" color="ink3">
            {`${t('kp.agents')}: ${planetList(ruling.agents, lang, t('kp.noSignificator'))}`}
          </Txt>
        ) : null}
      </Card>

      <Txt kind="caption" color="ink3" testID="kp-how">
        {t('kp.howComputed', { ayanamsa: 'KP', value: `${report.ayanamsaDegrees.toFixed(4)}°`, node: nodeWord(t(NODE_KEY[getSetting('node')])), tz: report.tz })}
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  approxRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tableHead: { flexDirection: 'row', gap: 8, paddingVertical: 6, marginTop: 8 },
  tableRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  colN: { width: 64 },
  colPos: { flex: 1, minWidth: 0 },
  colLords: { width: 96 },
  sigRow: { flexDirection: 'row', gap: 8, paddingVertical: 8, alignItems: 'flex-start' },
  note: { marginTop: 8 },
});
