// "Today's panchang card for a city" (F36): city and date, the merged good-hours band drawn by the SAME GoodHoursBand
// component (same tokens and patterns as Today; engine.goodHours is the only verdict producer), tithi and nakshatra
// with their end times, sunrise/sunset. Every value is engine output for the observer's place and day.
import type { GoodHours, PanchangDay } from '@shubhvela/engine';
import { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Txt } from '../../components/Txt';
import { useLang } from '../../i18n';
import { fmtCivilDate, fmtTime, nakshatraName, tithiName } from '../../today/format';
import { GoodHoursBand } from '../../today/GoodHoursBand';
import { tillText } from '../../today/PanchangSheet';
import { CardFrame, type CardView, CARD_W } from '../ShareCard';

export interface PanchangCardProps {
  panchang: PanchangDay;
  goodHours: GoodHours;
  nowMs: number;
  city: string;
}

/** Band width inside the card (card width minus 2 x 32 padding). */
export const CARD_BAND_W = CARD_W - 64;

export const PanchangCard = forwardRef<CardView, PanchangCardProps>(function PanchangCard({ panchang: p, goodHours, nowMs, city }, ref) {
  const { t, lang } = useLang();
  const paksha = t(p.tithi.paksha === 'krishna' ? 'panchang.krishna' : 'panchang.shukla');
  return (
    <CardFrame ref={ref} kind="panchang" kicker={t('share.cardPanchang', { city })}>
      <Txt kind="display" testID="panchang-card-date">
        {fmtCivilDate(p.date, lang)}
      </Txt>
      <View style={styles.rows}>
        <Txt kind="heading" testID="panchang-card-tithi">{`${t('panchang.tithi')}: ${paksha} ${tithiName(lang, p.tithi.index)} · ${tillText(p.tithi.end, p, t)}`}</Txt>
        <Txt kind="heading" testID="panchang-card-nakshatra">{`${t('panchang.nakshatra')}: ${nakshatraName(lang, p.nakshatra.index + 1)} ${p.nakshatra.pada} · ${tillText(p.nakshatra.end, p, t)}`}</Txt>
        <Txt kind="label" weight={400} color="ink2" testID="panchang-card-sun">
          {p.sunrise !== null && p.sunset !== null ? `${t('band.sunrise')} ${fmtTime(p.sunrise, p.tz)} · ${t('band.sunset')} ${fmtTime(p.sunset, p.tz)}` : t('today.noSun')}
        </Txt>
      </View>
      <View style={styles.band} testID="panchang-card-band">
        <Txt kind="label" weight={600} color="ink2">
          {t('share.goodHours')}
        </Txt>
        <GoodHoursBand gh={goodHours} nowMs={nowMs} flagsText={null} width={CARD_BAND_W} fontScale={1} />
      </View>
    </CardFrame>
  );
});

const styles = StyleSheet.create({
  rows: { gap: 6 },
  band: { gap: 4 },
});
