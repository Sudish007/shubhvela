// F8 Panchang sheet (design.md 10.2, N22): Sheet with a fixed grab handle and a scrolling body; Tiro title "Panchang";
// date · city · sunrise line; key/value rows with end times for Tithi, Nakshatra, Yoga and Karana (each with Why?);
// Samvat (Vikram, Shaka); Month (Purnimanta and Amanta names, ritu, ayana); Sun · Moon rashi; Moonrise · Moonset;
// the "Segments" row (Rahu Kaal · Abhijit · Brahma) with an "All 13" button that opens the expanded list; and the
// "How this was computed" footer. Every value is engine.panchang output for the chosen place and day.
import { formatInZone, locale, type ChartData, type GoodHours, type PanchangDay } from '@shubhvela/engine';
import { StyleSheet, View } from 'react-native';
import { ComputedFooter } from '../components/ComputedFooter';
import { Pressable44 } from '../components/Pressable44';
import { Row } from '../components/Row';
import { Sheet } from '../components/Sheet';
import { Txt } from '../components/Txt';
import type { WhyInputValue } from '../components/WhySheet';
import { useLang, type Lang, type TFn } from '../i18n';
import { AYANAMSA_KEY, NODE_KEY, shortValue } from '../settingsLabels';
import { useTokens } from '../theme/ThemeProvider';
import { RichText } from './RichText';
import { dayRows } from './SegmentList';
import { fmtCivilDate, fmtRange, fmtTime, lunarMonthName, nakshatraName, signName, tithiName } from './format';

export interface PanchangSheetProps {
  visible: boolean;
  onClose: () => void;
  panchang: PanchangDay;
  goodHours: GoodHours;
  chart: ChartData;
  /** Place shown in the header line (the profile's place or "Your location"). */
  placeName: string;
  /** "All 13" -> close the sheet and expand the segment list in the card. */
  onAllSegments: () => void;
}

const RITU_KEYS = ['vasanta', 'grishma', 'varsha', 'sharad', 'hemanta', 'shishira'] as const;

/** Civil date (yyyy-MM-dd) of an instant in the zone. */
function fmtCivil(ms: number, tz: string): string {
  return formatInZone(ms, tz, 'yyyy-MM-dd');
}

/** "till 14:48" or "till 02:22 (next day)" relative to the panchang's civil date. */
export function tillText(endMs: number, p: PanchangDay, t: TFn): string {
  const time = fmtTime(endMs, p.tz);
  return t('panchang.till', { time: fmtCivil(endMs, p.tz) === p.date ? time : t('panchang.nextDayTime', { time }) });
}

/** Row values of the sheet (exported for tests). */
export function panchangRows(p: PanchangDay, t: TFn, lang: Lang) {
  const paksha = (i: number) => t(i >= 15 ? 'panchang.krishna' : 'panchang.shukla');
  const tithiText = (i: number) => `${paksha(i)} ${tithiName(lang, i)}`;
  const tithi = `${tithiText(p.tithi.index)} ${tillText(p.tithi.end, p, t)}${p.tithis[1] ? t('panchang.then', { name: tithiText(p.tithis[1].index) }) : ''}`;
  const nakshatra = `${nakshatraName(lang, p.nakshatra.index + 1)} ${p.nakshatra.pada} ${tillText(p.nakshatra.end, p, t)}${p.nakshatras[1] ? t('panchang.then', { name: nakshatraName(lang, p.nakshatras[1].index + 1) }) : ''}`;
  const yoga = `${locale.yogaNames[lang][p.yoga.index]} ${tillText(p.yoga.end, p, t)}${p.yogas[1] ? t('panchang.then', { name: locale.yogaNames[lang][p.yogas[1].index] }) : ''}`;
  const karanaName = (k: { index: number; bhadra: boolean }) => (k.bhadra ? t('panchang.vishtiBhadra') : locale.karanaNames[lang][k.index]);
  const karana = `${karanaName(p.karana)} ${tillText(p.karana.end, p, t)}${p.karanas[1] ? t('panchang.then', { name: karanaName(p.karanas[1]) }) : ''}`;
  const samvat = `${t('panchang.vikram', { year: p.vikramSamvat })} · ${t('panchang.shaka', { year: p.shakaSamvat })}`;
  const am = lunarMonthName(lang, p.monthAmanta.index, p.monthAmanta.adhik);
  const pm = lunarMonthName(lang, p.monthPurnimanta.index, p.monthPurnimanta.adhik);
  const monthText = am === pm ? t('panchang.monthBoth', { month: am }) : t('panchang.monthSplit', { purnimanta: pm, amanta: am });
  const month = `${monthText} · ${t('panchang.rituLine', { ritu: t(`panchang.ritu.${RITU_KEYS[p.ritu.vedic]}`), ayana: t(`panchang.ayana.${p.ayana.vedic}`) })}`;
  const sunMoon = `${t('panchang.sunIn', { sign: signName(lang, p.sunSign + 1) })} · ${t('panchang.moonIn', { sign: signName(lang, p.moonSign + 1) })}`;
  const riseSet = (ms: number | null) => (ms === null ? t('common.none') : fmtCivil(ms, p.tz) === p.date ? fmtTime(ms, p.tz) : t('panchang.nextDayTime', { time: fmtTime(ms, p.tz) }));
  const moon = `${riseSet(p.moonrise)} · ${riseSet(p.moonset)}`;
  return { tithi, nakshatra, yoga, karana, samvat, month, sunMoon, moon };
}

function KV({ label, value }: { label: string; value: string }) {
  const { colors } = useTokens();
  return (
    <View style={[styles.kv, { borderTopColor: colors.hair }]}>
      <Txt kind="caption" color="ink3">
        {label}
      </Txt>
      <RichText kind="body" text={value} />
    </View>
  );
}

function WhyKV({ label, value, ruleId, inputs, glossary }: { label: string; value: string; ruleId: string; inputs: Record<string, WhyInputValue>; glossary: string[] }) {
  return (
    <Row ruleId={ruleId} text={`${label}: ${value}`} inputs={inputs} glossary={glossary} testID={`panchang-${glossary[0]}`}>
      <View>
        <Txt kind="caption" color="ink3">
          {label}
        </Txt>
        <RichText kind="body" text={value} />
      </View>
    </Row>
  );
}

export function PanchangSheet({ visible, onClose, panchang: p, goodHours: gh, chart, placeName, onAllSegments }: PanchangSheetProps) {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  const rows = panchangRows(p, t, lang);
  const tz = p.tz;
  const header = t('panchang.header', { date: fmtCivilDate(p.date, lang), place: placeName, sunrise: p.sunrise !== null ? fmtTime(p.sunrise, tz) : t('common.none') });
  const base: Record<string, WhyInputValue> = { [t('band.sunrise')]: p.sunrise !== null ? fmtTime(p.sunrise, tz) : null, [t('panchang.vara')]: locale.weekdayNames[lang][p.vara] };
  const segLine =
    p.rahuKaal && p.abhijit && p.brahma
      ? t('panchang.segmentsLine', { rahu: fmtRange(p.rahuKaal.start, p.rahuKaal.end, tz), abhijit: fmtRange(p.abhijit.start, p.abhijit.end, tz), brahma: fmtRange(p.brahma.start, p.brahma.end, tz) })
      : t('today.noSun');
  return (
    <Sheet visible={visible} onClose={onClose} title={t('panchang.title')}>
      <RichText kind="label" weight={400} color="ink2" text={header} testID="panchang-header" />
      <View>
        <WhyKV label={t('panchang.tithi')} value={rows.tithi} ruleId="day-tithi-nakshatra" inputs={{ ...base, [t('panchang.tithi')]: rows.tithi }} glossary={['tithi', 'paksha']} />
        <WhyKV label={t('panchang.nakshatra')} value={rows.nakshatra} ruleId="day-tithi-nakshatra" inputs={{ ...base, [t('panchang.nakshatra')]: rows.nakshatra }} glossary={['nakshatra', 'pada']} />
        <WhyKV label={t('panchang.yoga')} value={rows.yoga} ruleId="day-tithi-nakshatra" inputs={{ ...base, [t('panchang.yoga')]: rows.yoga }} glossary={['yoga']} />
        <WhyKV label={t('panchang.karana')} value={rows.karana} ruleId={p.karana.bhadra || p.karanas[1]?.bhadra ? 'bhadra' : 'day-tithi-nakshatra'} inputs={{ ...base, [t('panchang.karana')]: rows.karana }} glossary={['karana', 'vishti']} />
        <KV label={t('panchang.samvat')} value={rows.samvat} />
        <KV label={t('panchang.month')} value={rows.month} />
        <KV label={t('panchang.sunMoon')} value={rows.sunMoon} />
        <KV label={t('panchang.moonriseMoonset')} value={rows.moon} />
        <View style={[styles.kv, styles.segRow, { borderTopColor: colors.hair }]}>
          <View style={styles.segText}>
            <Txt kind="caption" color="ink3">
              {t('panchang.segments')}
            </Txt>
            <RichText kind="body" text={segLine} />
          </View>
          {gh.ticks ? (
            <Pressable44 accessibilityLabel={t('today.allSegments', { count: dayRows(gh).length })} onPress={onAllSegments} style={styles.allBtn} testID="panchang-all-segments">
              <Txt kind="label" weight={600} color="accent">
                {t('panchang.allSegments', { count: dayRows(gh).length })}
              </Txt>
            </Pressable44>
          ) : null}
        </View>
      </View>
      <ComputedFooter
        ayanamsa={shortValue(t(AYANAMSA_KEY[p.ayanamsa]))}
        node={shortValue(t(NODE_KEY[chart.meta.node]))}
        ephemeris={t('panchang.ephemeris', { ephemeris: chart.meta.ephemeris })}
        tz={tz}
        rounding={t('panchang.rounding')}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  kv: { paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, gap: 2 },
  segRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  segText: { flex: 1, minWidth: 0, gap: 2 },
  allBtn: { paddingHorizontal: 8 },
});
