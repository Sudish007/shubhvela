// Matching result (F29, design.md 10.6 F29; plan B06): route /family/match/result?a=p<id>|c<CODE>&b=...&an=&bn=&as=&bs=.
// Top to bottom: "N of 36 guna" (ink count, no colour grading) with one line per side; the eight koota rows (name,
// "x of y", one-line meaning, Why? at corpus level 1 on free / 3 on Pro); the dosha section (Nadi / Bhakoot with the
// exceptions named, Mangal dosha per person with every cancellation rule as a row); "Beyond gun milan"; the computed
// one-paragraph summary (free adds the honest tier caption); the "Matching report PDF" button (B07 route flag) and the
// "Share our 36-guna card" button (F36 preview sheet, GunaCard); the "How this was computed" footer. Route name
// MatchingResults = banner allow-listed (M5).
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState, type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMountClock } from '../../../src/charts/LockedFeature';
import { MATCH_ROUTE_FLAGS, TIMING_ROUTES } from '../../../src/charts/routeFlags';
import { Card, ComputedFooter, EmptyState, PrimaryButton, Screen, SecondaryButton, Txt } from '../../../src/components';
import { isPro, priceLabel, reportIncluded } from '../../../src/entitlements';
import { useLang } from '../../../src/i18n';
import { BeyondSection } from '../../../src/match/BeyondSection';
import { DoshaSection } from '../../../src/match/DoshaSection';
import { GunaHeadline } from '../../../src/match/GunaHeadline';
import { KootaRow } from '../../../src/match/KootaRow';
import { computeMatch, kootaLevel, resolveSide, sideFromParams, sidesToParams, summaryParams, type MatchRouteParams, type MatchSide, type ResolvedSide } from '../../../src/match/model';
import { useProfiles } from '../../../src/profiles/useProfiles';
import { GunaCard } from '../../../src/share/cards/GunaCard';
import { SharePreviewSheet } from '../../../src/share/SharePreviewSheet';
import type { CardView } from '../../../src/share/ShareCard';
import { AYANAMSA_KEY, shortValue } from '../../../src/settingsLabels';

export interface MatchResultScreenProps {
  now?: () => number;
  /** Sides for tests (the route reads them from the query string). */
  sides?: { a: MatchSide; b: MatchSide };
}

export default function MatchResultScreen({ now, sides }: MatchResultScreenProps) {
  const { t } = useLang();
  const router = useRouter();
  const nowMs = useMountClock(now);
  const params = useLocalSearchParams<MatchRouteParams>();
  const { profiles } = useProfiles();
  const sideA = sides?.a ?? sideFromParams(params, 'a');
  const sideB = sides?.b ?? sideFromParams(params, 'b');
  const pro = isPro();
  const level = kootaLevel(pro);
  const [shareOpen, setShareOpen] = useState(false);

  const computed = useMemo(() => {
    if (!sideA || !sideB) return null;
    try {
      const a: ResolvedSide = resolveSide('a', sideA, profiles, t);
      const b: ResolvedSide = resolveSide('b', sideB, profiles, t);
      return { a, b, report: computeMatch(a.chart, b.chart, nowMs) };
    } catch (e) {
      if (__DEV__) console.warn('matching failed', e);
      return null;
    }
  }, [sideA, sideB, profiles, nowMs, t]);

  if (!computed) {
    return (
      <Screen title={t('match.resultTitle')} chrome="stack" route="MatchingResults" testID="match-result">
        <EmptyState title={t('match.resultTitle')} body={t(sideA && sideB ? 'errors.shareCode' : 'match.sideNeeded')} />
      </Screen>
    );
  }

  const { a, b, report } = computed;
  const chart = a.chart;
  const ayanamsaLabel = shortValue(t(AYANAMSA_KEY[chart.meta.ayanamsa]));
  const summary = t('match.summary', summaryParams(report, a.label, b.label, t));
  const reportState = reportIncluded('matching') ? t('match.reportIncluded') : t('match.reportBtn', { price: priceLabel('matching', null).label });

  return (
    <Screen title={t('match.resultTitle')} chrome="stack" route="MatchingResults" testID="match-result">
      <Card>
        <GunaHeadline guna={report.guna} a={a} b={b} testID="guna-headline" />
      </Card>

      <Card testID="kootas-card">
        <Txt kind="heading" accessibilityRole="header">
          {t('match.kootas')}
        </Txt>
        {report.guna.kootas.map((k, i) => (
          <KootaRow key={k.id} row={k} level={level} aLabel={a.label} bLabel={b.label} divider={i < report.guna.kootas.length - 1} testID={`koota-${k.id}`} />
        ))}
      </Card>

      <Card>
        <DoshaSection guna={report.guna} mangal={report.mangal} a={a} b={b} level={level} testID="dosha-section" />
      </Card>

      <Card>
        <BeyondSection beyond={report.beyond} a={a} b={b} testID="beyond-section" />
      </Card>

      <Card testID="summary-card">
        <Txt kind="heading" accessibilityRole="header">
          {t('match.summaryTitle')}
        </Txt>
        <Txt kind="body" testID="summary-text">
          {summary}
        </Txt>
        {pro ? null : (
          <Txt kind="caption" color="ink3" testID="summary-free">
            {t('match.summaryFree')}
          </Txt>
        )}
        {MATCH_ROUTE_FLAGS.matchingReportPdf ? (
          <View style={styles.reportBtn}>
            <PrimaryButton label={reportState} onPress={() => router.push({ pathname: TIMING_ROUTES.matchingReportPdf, params: sidesToParams(sideA!, sideB!) })} testID="match-report-pdf" />
          </View>
        ) : null}
        <View style={styles.reportBtn}>
          <SecondaryButton label={t('share.shareGuna')} onPress={() => setShareOpen(true)} testID="match-share-card" />
        </View>
      </Card>

      {shareOpen ? (
        <SharePreviewSheet visible onClose={() => setShareOpen(false)} title={t('share.cardGuna')} renderCard={(ref: RefObject<CardView | null>) => <GunaCard ref={ref} guna={report.guna} aLabel={a.label} bLabel={b.label} />} />
      ) : null}

      <ComputedFooter
        ayanamsa={`${ayanamsaLabel} (${chart.meta.ayanamsaDegrees.toFixed(4)}°)`}
        node={chart.meta.nodeMethod}
        ephemeris={t('panchang.ephemeris', { ephemeris: chart.meta.ephemeris })}
        tz={`${a.chart.meta.tz} · ${b.chart.meta.tz}`}
        rounding={t('charts.rounding')}
        extra={[t('match.howComputed', { ayanamsa: ayanamsaLabel, node: chart.meta.nodeMethod })]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  reportBtn: { marginTop: 12 },
});
