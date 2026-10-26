// "Festival card" (F36): the festival name in the UI language, its computed date for the user's tradition and place,
// the tithi line and the city's sunrise / moonrise for that day (engine.panchang, the same values FestivalDetail shows).
import type { FestivalOccurrence, PanchangDay } from '@shubhvela/engine';
import { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Txt } from '../../components/Txt';
import { festivalTithiLine } from '../../family/format';
import { useLang } from '../../i18n';
import { fmtCivilDate, fmtTime, fmtTimeOrDayTime } from '../../today/format';
import { CardFrame, type CardView } from '../ShareCard';

export interface FestivalCardProps {
  occurrence: FestivalOccurrence;
  /** engine.panchang for the festival date at the city. */
  day: PanchangDay;
  city: string;
}

export const FestivalCard = forwardRef<CardView, FestivalCardProps>(function FestivalCard({ occurrence: o, day, city }, ref) {
  const { t, lang } = useLang();
  const tithi = festivalTithiLine(t, lang, o.tithiText);
  const sun =
    day.sunrise !== null
      ? day.moonrise !== null
        ? t('calendar.sunMoon', { sunrise: fmtTime(day.sunrise, day.tz), moonrise: fmtTimeOrDayTime(day.moonrise, day.tz, lang, o.date) })
        : t('calendar.sunNoMoon', { sunrise: fmtTime(day.sunrise, day.tz) })
      : t('today.noSun');
  return (
    <CardFrame ref={ref} kind="festival" kicker={`${t('share.cardFestival')} · ${city}`}>
      <Txt kind="display" testID="festival-card-name">
        {o.names[lang] ?? o.names.en}
      </Txt>
      <Txt kind="resultWhen" weight={600} testID="festival-card-date">
        {fmtCivilDate(o.date, lang)}
      </Txt>
      <View style={styles.rows}>
        {tithi ? (
          <Txt kind="heading" weight={400} color="ink2" testID="festival-card-tithi">
            {tithi}
          </Txt>
        ) : null}
        <Txt kind="label" weight={400} color="ink2" testID="festival-card-sun">
          {sun}
        </Txt>
      </View>
    </CardFrame>
  );
});

const styles = StyleSheet.create({
  rows: { gap: 6 },
});
