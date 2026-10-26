// Varshaphal summary (F17, design.md 10.3 M13/M21; plan B04): route /charts/varshaphal?profile=<id>&year=<yyyy>.
// Behind canSeeFeature('varshaphal') (24-h key / Pro) with the UnlockSheet. The first three items of the report:
// the solar-return chart (same Chart component, the user's chart style), Muntha (sign, house, lord) and the year lord
// with the five-candidate table (role, planet, Panchavargiya bala, aspect to the annual Lagna) - each a Row with Why?
// on the engine rule ids; the "Year begins" switch (default Off) for the NEXT return; "How this was computed". The
// Varshaphal report PDF (₹149 both tiers, M2) is B07's and is not offered here until that route exists.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ApproxTag, Card, Num, Row, Screen, Switch, Txt } from '../../src/components';
import { Chart } from '../../src/charts/Chart';
import { LockedFeature, useMountClock } from '../../src/charts/LockedFeature';
import { planetName, shortPlace, signName } from '../../src/charts/model';
import { useRouteProfile, useRouteYear } from '../../src/charts/routeProfile';
import { profileLabel } from '../../src/charts/sheets';
import { useFeatureAccess } from '../../src/charts/unlockState';
import { getYearBeginsEnabled, setYearBeginsEnabled } from '../../src/db/reminderSettings';
import { getSetting } from '../../src/db/settings';
import { chartFor, varshaphalFor, vedicYearAt } from '../../src/engine-bridge/charts';
import { useLang } from '../../src/i18n';
import { getPermissionState, requestPermission, type PermissionState } from '../../src/notifications/permissions';
import { replanAll } from '../../src/notifications/schedule';
import { AYANAMSA_KEY, CHART_STYLE_KEY, NODE_KEY, shortValue } from '../../src/settingsLabels';
import { useTokens } from '../../src/theme/ThemeProvider';
import { fmtDate, fmtTime } from '../../src/today/format';
import { RichText } from '../../src/today/RichText';

export interface VarshaphalScreenProps {
  now?: () => number;
  profileId?: number;
  year?: number;
  chartWidth?: number;
  getPermission?: () => Promise<PermissionState>;
  requestPermission?: () => Promise<PermissionState>;
  replan?: () => Promise<unknown>;
}

const DEFAULT_CHART_WIDTH = 326;

export default function VarshaphalScreen({ now, profileId, year: yearProp, chartWidth, getPermission = getPermissionState, requestPermission: askPermission = requestPermission, replan = () => replanAll() }: VarshaphalScreenProps) {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  const nowMs = useMountClock(now);
  const profile = useRouteProfile(profileId);
  const routeYear = useRouteYear(yearProp);
  const access = useFeatureAccess('varshaphal', nowMs);
  const [measured, setMeasured] = useState<number | null>(null);
  const [notify, setNotify] = useState(() => getYearBeginsEnabled());

  if (!profile) {
    return (
      <Screen title={t('varshaphal.title')} chrome="stack" testID="varshaphal-screen">
        <Txt kind="body" color="ink2">
          {t('charts.noProfile')}
        </Txt>
      </Screen>
    );
  }
  if (!access.allowed) {
    return (
      <Screen title={t('varshaphal.title')} chrome="stack" testID="varshaphal-screen">
        <LockedFeature feature="varshaphal" testID="varshaphal-locked" />
      </Screen>
    );
  }

  const chart = chartFor(profile);
  const vy = vedicYearAt(chart, nowMs);
  const year = routeYear ?? vy.runningYear;
  const report = varshaphalFor(chart, year);
  const tz = report.tz;
  const style = getSetting('chartStyle');
  const width = chartWidth ?? measured ?? DEFAULT_CHART_WIDTH;
  const ayanamsaLabel = shortValue(t(AYANAMSA_KEY[chart.meta.ayanamsa]));
  const nodeLabel = shortValue(t(NODE_KEY[chart.meta.node]));
  const date = fmtDate(report.instant, tz, lang);
  const time = fmtTime(report.instant, tz);
  const begins = t('varshaphal.yearFrom', { date, time });
  const munthaLine = t('varshaphal.munthaLine', { sign: signName(lang, report.muntha.sign), house: report.muntha.house, lord: planetName(lang, report.muntha.lord) });
  const lordLine = t('varshaphal.yearLordLine', { planet: planetName(lang, report.yearLord.planet), role: t(`varshaphal.role.${report.yearLord.role}`) });

  async function toggleNotify(on: boolean) {
    if (on) {
      let perm = await getPermission();
      if (perm !== 'granted') perm = await askPermission();
      if (perm !== 'granted') return;
    }
    setYearBeginsEnabled(on);
    setNotify(on);
    await replan();
  }

  return (
    <Screen title={t('varshaphal.summaryTitle', { year: report.year })} chrome="stack" subtitle={<Num kind="caption" color="ink2">{t('varshaphal.ageLine', { year: report.year, age: report.age })}</Num>} testID="varshaphal-screen">
      <Card testID="varshaphal-return-card">
        <Row
          ruleId="varshaphal-solar-return"
          text={begins}
          inputs={{ [t('kp.planet_col')]: planetName(lang, 'Su'), [t('onboarding.place')]: shortPlace(profile.placeName), [t('onboarding.timezone')]: tz, [t('settings.ayanamsa')]: ayanamsaLabel }}
          glossary={['varshaphal', 'solar-return']}
          caption={<RichText kind="caption" color="ink3" text={t('varshaphal.returnAt', { kind: t(report.dayReturn ? 'varshaphal.dayReturn' : 'varshaphal.nightReturn'), date, time, place: shortPlace(profile.placeName) })} />}
          testID="varshaphal-begins"
        >
          <RichText kind="body" text={begins} />
        </Row>
        <Txt kind="heading" accessibilityRole="header" style={styles.chartTitle}>
          {t('varshaphal.returnChart')}
        </Txt>
        <View style={styles.chartBox} onLayout={(e) => setMeasured(Math.round(e.nativeEvent.layout.width))}>
          <Chart style={style} chart={report.chart} width={width} styleName={t(CHART_STYLE_KEY[style])} centreLines={style === 'north' ? undefined : [profileLabel(profile, t), String(report.year)]} testID="varshaphal-chart" />
        </View>
        {report.approx ? (
          <View style={styles.approxRow}>
            <ApproxTag />
            <Txt kind="caption" color="ink2" style={styles.flex}>
              {t('varshaphal.approxMoon')}
            </Txt>
          </View>
        ) : null}
      </Card>

      <Card testID="varshaphal-muntha-card">
        <Row
          ruleId={report.muntha.ruleId}
          text={munthaLine}
          inputs={{ [t('varshaphal.muntha')]: signName(lang, report.muntha.sign), [t('kp.house_col')]: report.muntha.house, [t('kp.signLord_col')]: planetName(lang, report.muntha.lord), [t('charts.lagna')]: signName(lang, chart.firstHouseSign) }}
          glossary={['muntha']}
          divider={false}
          testID="varshaphal-muntha"
        >
          <Txt kind="body">
            <Txt kind="body" weight={600}>{`${t('varshaphal.muntha')}  `}</Txt>
            <RichText kind="body" text={munthaLine} />
          </Txt>
        </Row>
      </Card>

      <Card testID="varshaphal-lord-card">
        <Row
          ruleId={report.yearLord.ruleId}
          text={`${t('varshaphal.yearLord')}: ${lordLine}`}
          inputs={Object.fromEntries(report.yearLord.candidates.map((c) => [t(`varshaphal.role.${c.role}`), `${planetName(lang, c.planet)} · ${c.bala.toFixed(2)} · ${c.aspectsLagna ? t('varshaphal.aspectsLagna') : t('varshaphal.noAspect')}`]))}
          glossary={['varshesha', 'panchavargiya-bala']}
          testID="varshaphal-lord"
        >
          <Txt kind="body">
            <Txt kind="body" weight={600}>{`${t('varshaphal.yearLord')}  `}</Txt>
            {lordLine}
          </Txt>
        </Row>
        <Txt kind="micro" weight={600} color="ink3" style={styles.tableTitle}>
          {t('varshaphal.candidates')}
        </Txt>
        <View style={[styles.tableHead, { borderBottomColor: colors.hair }]}>
          <Txt kind="micro" weight={600} color="ink3" style={styles.colRole}>
            {t('varshaphal.candidate_col')}
          </Txt>
          <Txt kind="micro" weight={600} color="ink3" style={styles.colPlanet}>
            {t('kp.planet_col')}
          </Txt>
          <Txt kind="micro" weight={600} color="ink3" style={styles.colBala}>
            {t('varshaphal.bala_col')}
          </Txt>
        </View>
        {report.yearLord.candidates.map((c, i) => (
          <View key={c.role} style={[styles.tableRow, i < report.yearLord.candidates.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hair }]} testID={`varshaphal-candidate-${c.role}`}>
            <View style={styles.colRole}>
              <Txt kind="caption" color="ink2">
                {t(`varshaphal.role.${c.role}`)}
              </Txt>
              <Txt kind="micro" color="ink3">
                {c.aspectsLagna ? `${t('varshaphal.aspectsLagna')}${c.aspectKind ? ` · ${t(`varshaphal.aspect.${c.aspectKind}`)}` : ''}` : t('varshaphal.noAspect')}
              </Txt>
            </View>
            <Txt kind="label" weight={c.planet === report.yearLord.planet && c.role === report.yearLord.role ? 600 : 400} style={styles.colPlanet}>
              {planetName(lang, c.planet)}
            </Txt>
            <Num kind="label" weight={400} style={styles.colBala}>
              {c.bala.toFixed(2)}
            </Num>
          </View>
        ))}
      </Card>

      <Card testID="varshaphal-notify-card">
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Txt kind="body">{t('varshaphal.notifyToggle')}</Txt>
            <RichText kind="caption" color="ink3" text={notify ? t('varshaphal.notifyOn', { date: fmtDate(vy.nextStart, tz, lang), time: fmtTime(vy.nextStart, tz) }) : t('varshaphal.notifyOff')} />
          </View>
          <Switch value={notify} onValueChange={(v) => void toggleNotify(v)} accessibilityLabel={t('varshaphal.notifyToggle')} testID="varshaphal-notify" />
        </View>
      </Card>

      <Txt kind="caption" color="ink3" testID="varshaphal-how">
        {t('varshaphal.howComputed', { ayanamsa: ayanamsaLabel, place: shortPlace(profile.placeName), node: nodeLabel.toLowerCase() })}
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  approxRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  chartTitle: { marginTop: 8 },
  chartBox: { alignSelf: 'stretch', alignItems: 'center', marginTop: 8 },
  tableTitle: { marginTop: 8 },
  tableHead: { flexDirection: 'row', gap: 8, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  tableRow: { flexDirection: 'row', gap: 8, paddingVertical: 6, alignItems: 'flex-start' },
  colRole: { flex: 1, minWidth: 0 },
  colPlanet: { width: 80 },
  colBala: { width: 56, textAlign: 'right' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
});
