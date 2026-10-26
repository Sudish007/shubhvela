// F23 festival detail body (design.md 10.4): the computed date (and span) for the chosen tradition/region at the user's
// place, the tithi/sankranti rule line, the city's sunrise and moonrise for that day, the puja window when the rule has
// one, the "What to do" text (corpus/festivals, resolved bho -> hi -> en) as a Row whose Why? names the rule and its
// inputs, the convention note, and the honest footer: "verified against Drik Panchang on <date>" only when this exact
// date was checked (engine festivalVerification), else "not yet verified". The share-card button arrives in B07.
import { festivalText } from '@shubhvela/content';
import { type FestivalOccurrence, type Region, type Tradition, festivalVerification, panchang } from '@shubhvela/engine';
import { StyleSheet, View } from 'react-native';
import { Card } from '../components/Card';
import { Row } from '../components/Row';
import { Tag } from '../components/Tag';
import { Txt } from '../components/Txt';
import type { WhyInputValue } from '../components/WhySheet';
import { useLang, type Lang, type TFn } from '../i18n';
import { fmtCivilDate, fmtRange, fmtTime, fmtTimeOrDayTime } from '../today/format';
import { RichText } from '../today/RichText';
import { festivalTithiLine, systemName } from './format';

export interface FestivalDetailProps {
  occurrence: FestivalOccurrence;
  /** Every occurrence of the slug in that year (a slug can fall in January and December). */
  siblings: readonly FestivalOccurrence[];
  year: number;
  tradition: Tradition;
  region: Region;
  geo: { lat: number; lon: number };
  tz: string;
  placeName: string;
  testID?: string;
}

/** "Verified against Drik Panchang on <date>" or "Not yet verified" for ONE computed date (exported for tests). */
export function verificationFooter(slug: string, year: number, tradition: Tradition, date: string, t: TFn, lang: Lang): { verified: boolean; text: string } {
  const v = festivalVerification(slug, year, tradition, date);
  return v ? { verified: true, text: t('calendar.verifiedAgainst', { date: fmtCivilDate(v.fetchedAt, lang) }) } : { verified: false, text: t('calendar.notVerified') };
}

export function festivalInputs(o: FestivalOccurrence, tradition: Tradition, region: Region, tz: string, t: TFn, lang: Lang): Record<string, WhyInputValue> {
  const inputs: Record<string, WhyInputValue> = {
    [t('calendar.festival')]: o.names[lang] ?? o.names.en,
    [t('panchang.tithi')]: festivalTithiLine(t, lang, o.tithiText),
    [t('calendar.tradition')]: systemName(t, tradition),
    [t('calendar.region')]: region === 'north' ? t('calendar.regionNorth') : t('calendar.regionSouth'),
    [t('calendar.convention')]: o.convention,
  };
  if (o.span) inputs[t('vrat.tithiEnds')] = fmtTimeOrDayTime(o.span.end, tz, lang, o.date);
  if (o.sankranti) inputs[t('calendar.sankranti')] = fmtTimeOrDayTime(o.sankranti, tz, lang, o.date);
  if (o.window) inputs[t('calendar.pujaWindowLabel')] = fmtRange(o.window.start, o.window.end, tz);
  if (o.bhadra?.length) inputs[t('panchang.vishtiBhadra')] = o.bhadra.map((b) => fmtRange(b.start, b.end, tz)).join(', ');
  return inputs;
}

export function FestivalDetail({ occurrence: o, siblings, year, tradition, region, geo, tz, placeName, testID }: FestivalDetailProps) {
  const { t, lang } = useLang();
  const text = festivalText(o.slug, lang);
  const day = panchang(o.date, geo, tz);
  const tithiLine = festivalTithiLine(t, lang, o.tithiText);
  const footer = verificationFooter(o.slug, year, tradition, o.date, t, lang);
  const sunLine =
    day.sunrise !== null
      ? day.moonrise !== null
        ? // The engine's moonrise belongs to the Vedic day (sunrise -> next sunrise) and can fall after midnight, e.g.
          // Diwali 2026 Lucknow: moonrise 06:20 on the NEXT civil date, one minute before that day's sunrise. Carry the
          // weekday + date in that case, as the Panchang sheet does, so "Sunrise 06:20 · Moonrise 06:20" cannot mislead.
          t('calendar.sunMoon', { sunrise: fmtTime(day.sunrise, tz), moonrise: fmtTimeOrDayTime(day.moonrise, tz, lang, o.date) })
        : t('calendar.sunNoMoon', { sunrise: fmtTime(day.sunrise, tz) })
      : t('today.noSun');
  return (
    <View testID={testID} style={styles.root}>
      <Card>
        <Txt kind="caption" color="ink3">
          {`${systemName(t, tradition)} · ${region === 'north' ? t('calendar.regionNorth') : t('calendar.regionSouth')} · ${placeName}`}
        </Txt>
        <RichText kind="resultWhen" weight={600} text={fmtCivilDate(o.date, lang)} testID="festival-date" />
        {o.end && o.end !== o.date ? <RichText kind="label" color="ink2" text={t('calendar.spanThrough', { date: fmtCivilDate(o.end, lang) })} /> : null}
        {siblings.length > 1 ? (
          <RichText kind="caption" color="ink3" text={t('calendar.alsoOn', { dates: siblings.filter((s) => s.date !== o.date).map((s) => fmtCivilDate(s.date, lang)).join(', ') })} />
        ) : null}
        {tithiLine ? <RichText kind="label" color="ink2" text={tithiLine} testID="festival-tithi" /> : null}
        {o.sankranti ? <RichText kind="label" color="ink2" text={t('calendar.sankrantiAt', { time: fmtTimeOrDayTime(o.sankranti, tz, lang, o.date) })} /> : null}
        <RichText kind="label" color="ink2" text={sunLine} testID="festival-sun-moon" />
        {o.window ? <RichText kind="label" color="ink2" text={t('calendar.pujaWindow', { from: fmtTime(o.window.start, tz), to: fmtTime(o.window.end, tz) })} /> : null}
        {o.bhadra?.length ? <Tag variant="kind">{t('calendar.bhadraMoved')}</Tag> : null}
      </Card>
      <Card>
        <Txt kind="heading" accessibilityRole="header">
          {t('vrat.whatToDo')}
        </Txt>
        <Row ruleId={o.ruleId} text={text?.item.what ?? t('calendar.noText')} inputs={festivalInputs(o, tradition, region, tz, t, lang)} divider={false} testID="festival-what">
          <Txt kind="body">{text?.item.what ?? t('calendar.noText')}</Txt>
        </Row>
        {text?.item.rule ? (
          <Txt kind="caption" color="ink2" style={styles.rule}>
            <Txt kind="caption" weight={600} color="ink2">{`${t('calendar.ruleLabel')}: `}</Txt>
            {text.item.rule}
          </Txt>
        ) : null}
        {text?.item.conventionNote ? (
          <Txt kind="caption" color="ink3" style={styles.rule}>
            {text.item.conventionNote}
          </Txt>
        ) : null}
      </Card>
      <Txt kind="caption" color={footer.verified ? 'ink2' : 'ink3'} testID="festival-verified">
        {footer.text}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  rule: { marginTop: 8 },
});
