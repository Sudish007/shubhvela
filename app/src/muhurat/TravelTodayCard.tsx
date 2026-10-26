// "Travel today" card (F27, design.md 10.5 F27; plan B05): the weekday's Disha Shool as a sentence, the Panchak and
// Bhadra-on-earth flags as TEXT (never a colour), the advisory footer and a Why? (rule disha-shool with the inputs).
// Shown under the muhurat results and in Today's expanded segment list. Everything comes from engine.travelNoteFor().
import { travelNoteFor, type PanchangDay, type TravelNote } from '@shubhvela/engine';
import { StyleSheet, View } from 'react-native';
import { Card } from '../components/Card';
import { Row } from '../components/Row';
import { Txt } from '../components/Txt';
import { useLang, type Lang, type TFn } from '../i18n';
import { useTokens } from '../theme/ThemeProvider';
import { fmtTimeOrDayTime, glueRanges, weekdayName } from '../today/format';
import { RichText } from '../today/RichText';

export interface TravelTodayCardProps {
  panchang: PanchangDay;
  /** Inside another card (Today's expanded segment list): a hairline-topped section instead of a nested card. */
  embedded?: boolean;
  testID?: string;
}

/** The card's sentences in order: Disha Shool, then Panchak / Bhadra flags (or "no flag today"). */
export function travelSentences(note: TravelNote, day: string, tz: string, t: TFn, lang: Lang): string[] {
  const p = note.params;
  const out = [t('travel.dishaShool', { direction: t(`travel.dir.${p.avoid}`), weekday: weekdayName(lang, p.vara) })];
  if (p.panchak && p.panchakEnd !== null) out.push(t('travel.panchak', { until: fmtTimeOrDayTime(p.panchakEnd, tz, lang, day) }));
  if (p.bhadraEarth && p.bhadraStart !== null && p.bhadraEnd !== null) {
    out.push(glueRanges(t('travel.bhadra', { from: fmtTimeOrDayTime(p.bhadraStart, tz, lang, day), to: fmtTimeOrDayTime(p.bhadraEnd, tz, lang, day) })));
  }
  if (!p.panchak && !p.bhadraEarth) out.push(t('travel.noFlags'));
  return out;
}

export function travelWhyInputs(note: TravelNote, day: string, tz: string, t: TFn, lang: Lang): Record<string, string> {
  const p = note.params;
  const out: Record<string, string> = {
    [t('panchang.vara')]: weekdayName(lang, p.vara),
    [t('travel.avoidDirection')]: t(`travel.dir.${p.avoid}`),
    [t('travel.otherDirections')]: p.safe.map((d) => t(`travel.dir.${d}`)).join(', '),
    [t('band.panchak')]: p.panchak && p.panchakEnd !== null ? t('common.till', { time: fmtTimeOrDayTime(p.panchakEnd, tz, lang, day) }) : t('common.no'),
    [t('band.bhadra')]: p.bhadraEarth && p.bhadraStart !== null && p.bhadraEnd !== null ? `${fmtTimeOrDayTime(p.bhadraStart, tz, lang, day)} \u2013 ${fmtTimeOrDayTime(p.bhadraEnd, tz, lang, day)}` : t('common.no'),
  };
  return out;
}

export function TravelTodayCard({ panchang, embedded, testID }: TravelTodayCardProps) {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  const note = travelNoteFor(panchang);
  const sentences = travelSentences(note, panchang.date, panchang.tz, t, lang);
  const safe = t('travel.safeDirections', { list: note.params.safe.map((d) => t(`travel.dir.${d}`)).join(', ') });
  const Wrap = embedded ? View : Card;
  return (
    <Wrap testID={testID} style={embedded ? [styles.embedded, { borderTopColor: colors.hair }] : undefined}>
      <Row ruleId={note.ruleId} text={`${t('travel.title')}. ${sentences.join(' ')}`} inputs={travelWhyInputs(note, panchang.date, panchang.tz, t, lang)} glossary={['disha-shool', 'panchak', 'bhadra']} divider={false} testID="travel-row">
        <Txt kind="heading" accessibilityRole="header">
          {t('travel.title')}
        </Txt>
        <View style={styles.body}>
          {sentences.map((s, i) => (
            <RichText key={i} kind="body" text={s} testID={`travel-line-${i}`} />
          ))}
          <Txt kind="caption" color="ink3">
            {safe}
          </Txt>
        </View>
      </Row>
      <Txt kind="caption" color="ink3" style={styles.advisory}>
        {t('travel.advisory')}
      </Txt>
    </Wrap>
  );
}

const styles = StyleSheet.create({
  body: { gap: 6, marginTop: 4 },
  advisory: { marginTop: 4 },
  embedded: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
});
