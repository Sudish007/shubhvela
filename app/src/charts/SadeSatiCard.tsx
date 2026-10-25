// Sade Sati and Dhaiya card (F15 free part, design.md 10.3): the current state as a Row with Why? (rule id from the
// engine state: sade-sati-phase-n / dhaiya-4|8 / sade-sati-none), the phase dates of the current or next episode, the
// next event with its date (an "approx." tag only when the engine flags one - it never does: dates come from exact
// Saturn ingress search) and the "how this was computed" caption.
import type { SadeSatiReport } from '@shubhvela/engine';
import { StyleSheet, View } from 'react-native';
import { Card } from '../components/Card';
import { Row } from '../components/Row';
import { ApproxTag } from '../components/Tag';
import { Txt } from '../components/Txt';
import { useLang, type Lang, type TFn } from '../i18n';
import { fmtDate, ordinal } from '../today/format';
import { RichText } from '../today/RichText';
import { dateRange, signName } from './model';

export interface SadeSatiCardProps {
  report: SadeSatiReport;
  tz: string;
  ayanamsaLabel: string;
  nowMs: number;
  testID?: string;
}

/** Rule id of the state row (rules corpus ids, same as the daily note's sade-sati row). */
export function sadeSatiRuleId(report: Pick<SadeSatiReport, 'state'>): string {
  const s = report.state;
  if (s.kind === 'sadesati') return `sade-sati-phase-${s.phase}`;
  if (s.kind === 'dhaiya') return `dhaiya-${s.house}`;
  return 'sade-sati-none';
}

/** The state sentence from the engine report. */
export function sadeSatiSentence(report: SadeSatiReport, tz: string, lang: Lang, t: TFn): string {
  const s = report.state;
  const sign = signName(lang, report.saturnSign);
  const house = ordinal(report.saturnHouseFromMoon, lang);
  if (s.kind === 'sadesati') return t('sadesati.phase', { phase: s.phase, sign, house, from: fmtDate(s.start, tz, lang), to: fmtDate(s.end, tz, lang) });
  if (s.kind === 'dhaiya') return t('sadesati.dhaiya', { sign, house, from: fmtDate(s.start, tz, lang), to: fmtDate(s.end, tz, lang) });
  return t('sadesati.none', { sign, house });
}

/** The episode whose phases are listed: the running one, else the next to start. */
export function episodeToShow(report: SadeSatiReport, nowMs: number) {
  return report.episodes.find((e) => e.start <= nowMs && nowMs < e.end) ?? report.episodes.find((e) => e.start > nowMs) ?? null;
}

export function SadeSatiCard({ report, tz, ayanamsaLabel, nowMs, testID }: SadeSatiCardProps) {
  const { t, lang } = useLang();
  const sentence = sadeSatiSentence(report, tz, lang, t);
  const episode = episodeToShow(report, nowMs);
  const PHASE_KEY = { 1: 'sadesati.phase1', 2: 'sadesati.phase2', 3: 'sadesati.phase3' } as const;
  return (
    <Card testID={testID}>
      <Txt kind="heading" accessibilityRole="header">
        {t('sadesati.title')}
      </Txt>
      <Row
        ruleId={sadeSatiRuleId(report)}
        text={sentence}
        inputs={{
          natalMoonSign: signName(lang, report.natalMoonSign),
          saturnSign: signName(lang, report.saturnSign),
          saturnHouseFromMoon: ordinal(report.saturnHouseFromMoon, lang),
          since: fmtDate(report.state.start, tz, lang),
          until: fmtDate(report.state.end, tz, lang),
        }}
        glossary={['sade-sati', 'dhaiya']}
        divider={false}
        testID="sadesati-state"
      >
        <RichText kind="body" text={sentence} />
      </Row>
      {episode ? (
        <View style={styles.phases} testID="sadesati-phases">
          <Txt kind="micro" weight={600} color="ink3">
            {t('sadesati.phaseDates')}
          </Txt>
          {episode.phases.map((ph, i) => (
            <View key={`${ph.n}-${i}`} style={styles.phaseRow}>
              <Txt kind="caption" color="ink2" style={styles.phaseName}>
                {t(PHASE_KEY[ph.n])}
              </Txt>
              <RichText kind="caption" color="ink2" text={dateRange(ph.start, ph.end, tz, lang, t)} />
            </View>
          ))}
        </View>
      ) : null}
      {report.next ? (
        <View style={styles.nextRow} testID="sadesati-next">
          <RichText kind="caption" weight={600} color="ink2" text={t('sadesati.nextEvent', { event: t(`sadesati.event.${report.next.kind}`), date: fmtDate(report.next.at, tz, lang) })} />
          {report.next.approx ? <ApproxTag /> : null}
        </View>
      ) : null}
      <Txt kind="caption" color="ink3" style={styles.footer}>
        {t('sadesati.howComputed', { ayanamsa: ayanamsaLabel })}
      </Txt>
    </Card>
  );
}

const styles = StyleSheet.create({
  phases: { marginTop: 8, gap: 2 },
  phaseRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  phaseName: { flexShrink: 1 },
  nextRow: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  footer: { marginTop: 12 },
});
