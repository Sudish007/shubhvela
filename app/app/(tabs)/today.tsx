// Today (design.md 10.2; plan A10): the single card stack. Header: date line + the F1 first value "Your Moon: <sign> ·
// <nakshatra>" (N6); meta row: place pill (-> Settings -> Location) and the "Panchang" pill (-> F8 sheet); then, in the
// intent order, the "Good hours today" card (F5/F27), the "Today is <name>'s janma tithi" row (F20), the daily note
// (F6), the F22 "vrat today" card (enabled vrat families only, A12) and the Upcoming strip (F7). "Family dates" moves the
// vrat card and Upcoming above the note; "Learn" adds nothing until C03
// exists. The card order comes from AdPolicy.todayCardOrder(intent) so the native ad card is provably the LAST card
// (M4); AdPolicy.todayNativeSlot() answers 'none' for Pro and nothing is drawn; otherwise NativeAdCard mounts its view
// only when its onLayout.y >= windowHeight (below the fold) and collapses on no fill.
// Every number on this screen is engine output for the chosen place and the current instant; no Listen button until C01.
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { todayCardOrder, todayNativeSlot, type TodayCardKey } from '../../src/ads/AdPolicy';
import { NativeAdCard } from '../../src/ads/NativeAdCard';
import { ApproxTag, Card, ChevronIcon, EmptyState, NoBreak, Pressable44, Screen, Txt } from '../../src/components';
import { chartFor, moonLine } from '../../src/engine-bridge/charts';
import { VratTodayCard } from '../../src/family/VratTodayCard';
import { useLang } from '../../src/i18n';
import { useProfiles } from '../../src/profiles/useProfiles';
import { useTokens } from '../../src/theme/ThemeProvider';
import { radius } from '../../src/theme/tokens';
import { DailyNoteCard } from '../../src/today/DailyNoteCard';
import { fmtCivilDate, lunarMonthName, tithiName } from '../../src/today/format';
import { GoodHoursCard } from '../../src/today/GoodHoursCard';
import { PanchangSheet } from '../../src/today/PanchangSheet';
import { RichText } from '../../src/today/RichText';
import { TodayTithiRow } from '../../src/today/TodayTithiRow';
import { UpcomingStrip } from '../../src/today/UpcomingStrip';
import { useToday, type UseTodayOptions } from '../../src/today/useToday';

export interface TodayScreenProps {
  /** Clock and fix providers for tests; production uses Date.now and expo-location. */
  todayOptions?: UseTodayOptions;
}

export default function TodayScreen({ todayOptions }: TodayScreenProps) {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  const router = useRouter();
  const { self, profiles } = useProfiles();
  const { model, nowMs, loading, error, locationFallback } = useToday(self, profiles, todayOptions);
  const [expanded, setExpanded] = useState(false);
  const [sheet, setSheet] = useState(false);

  // The F1 first value is synchronous (chartFor is memoised), so it paints before the rest of the model is computed.
  let moon: ReturnType<typeof moonLine> | null = null;
  if (self) {
    try {
      moon = moonLine(model?.chart ?? chartFor(self), lang);
    } catch (e) {
      if (__DEV__) console.warn('chart failed', e);
    }
  }
  const MARK = '\u0000';
  const [before = '', after = ''] = moon ? t('today.yourMoon', { sign: moon.sign, nakshatra: MARK }).split(MARK) : ['', ''];
  const p = model?.panchang;
  const dateLine = model && p
    ? t('today.dateLine', {
        weekday: fmtCivilDate(model.day, lang).split(' ')[0],
        date: fmtCivilDate(model.day, lang).split(' ').slice(1).join(' '),
        month: lunarMonthName(lang, (model.profile.tradition === 'amanta' ? p.monthAmanta : p.monthPurnimanta).index, (model.profile.tradition === 'amanta' ? p.monthAmanta : p.monthPurnimanta).adhik),
        paksha: t(p.tithi.paksha === 'krishna' ? 'panchang.krishna' : 'panchang.shukla'),
        tithi: tithiName(lang, p.tithi.index),
      })
    : null;
  const placeName = model ? (model.observer.placeName ?? t('today.yourLocation')) : (self?.placeName ?? '');

  const subtitle = (
    <View style={styles.subtitle}>
      {dateLine ? <RichText kind="label" weight={400} color="ink2" text={dateLine} testID="today-date-line" /> : null}
      {self && moon ? (
        <View style={styles.moonRow}>
          <Txt kind="label" weight={400} color="ink2" testID="today-moon-line">
            {before}
            <NoBreak kind="label" weight={400} color="ink2">{`${moon.nakshatra} ${moon.pada}`}</NoBreak>
            {after}
          </Txt>
          {moon.approx ? <ApproxTag minutes={self.timeApproxMinutes || undefined} /> : null}
        </View>
      ) : null}
      {moon?.moonChart ? (
        <Txt kind="caption" color="ink2">
          {t('charts.moonUnknownTime')}
        </Txt>
      ) : null}
    </View>
  );

  const pillStyle = [styles.pill, { borderColor: colors.hair2, backgroundColor: colors.surface }];
  const meta = model ? (
    <View style={styles.meta}>
      <Pressable44 accessibilityLabel={`${t('today.changeLocation')}: ${placeName}`} onPress={() => router.push('/settings/location')} style={pillStyle} testID="place-pill">
        <Txt kind="label" weight={600}>
          {placeName}
        </Txt>
      </Pressable44>
      <Pressable44 accessibilityLabel={t('today.openPanchang')} onPress={() => setSheet(true)} style={pillStyle} testID="panchang-pill">
        <Txt kind="label" weight={600}>
          {t('today.panchang')}
        </Txt>
        <ChevronIcon color={colors.ink} size={18} />
      </Pressable44>
    </View>
  ) : null;

  const goodHours = model ? (
    <GoodHoursCard gh={model.goodHours} panchang={model.panchang} nowMs={nowMs} expanded={expanded} onToggleExpanded={() => setExpanded((e) => !e)} />
  ) : null;
  const tithiRow = model ? <TodayTithiRow rows={model.tithiToday} testID="tithi-today" /> : null;
  const note = model ? <DailyNoteCard rows={model.note} name={model.profile.name} day={model.day} tz={model.observer.tz} testID="daily-note" /> : null;
  const upcomingStrip = model ? <UpcomingStrip items={model.upcoming} tz={model.observer.tz} profileId={model.profile.id} testID="upcoming" /> : null;
  const vratCard = model && model.vratToday.length ? <VratTodayCard occurrences={model.vratToday} tz={model.observer.tz} placeName={placeName} testID="vrat-today" /> : null;
  const order = todayCardOrder(self?.intent);
  const adSlot = todayNativeSlot(order.length - 1);
  const cards: Record<TodayCardKey, React.ReactNode> = {
    goodHours,
    tithiToday: tithiRow,
    vratToday: vratCard,
    upcoming: upcomingStrip,
    dailyNote: note,
    nativeAd: adSlot.kind === 'native' && model ? <NativeAdCard unitId={adSlot.unitId} /> : null,
  };

  return (
    <Screen title={t('today.title')} route="Today" subtitle={subtitle} testID="today-screen">
      {meta}
      {locationFallback && self ? (
        <Txt kind="caption" color="ink2" testID="location-fallback">
          {t('today.locationFallback', { place: self.placeName })}
        </Txt>
      ) : null}
      {!self ? <EmptyState title={t('today.title')} body={t('today.noProfile')} /> : null}
      {error ? (
        <Card>
          <Txt kind="body" color="accent">
            {t('errors.chart')}
          </Txt>
        </Card>
      ) : null}
      {loading ? <Skeleton /> : null}
      {order.map((key) => (cards[key] ? <React.Fragment key={key}>{cards[key]}</React.Fragment> : null))}
      {model ? (
        <PanchangSheet
          visible={sheet}
          onClose={() => setSheet(false)}
          panchang={model.panchang}
          goodHours={model.goodHours}
          chart={model.chart}
          placeName={placeName}
          onAllSegments={() => {
            setSheet(false);
            setExpanded(true);
          }}
        />
      ) : null}
    </Screen>
  );
}

/** Loading state (design 11 / FEAT step 8): hairline boxes the size of the cards, no spinner, no numbers. */
function Skeleton() {
  const { colors } = useTokens();
  const { t } = useLang();
  return (
    <View accessibilityLabel={t('common.computing')} accessibilityRole="progressbar" testID="today-skeleton" style={styles.skeleton}>
      <View style={[styles.skeletonCard, { borderColor: colors.hair, backgroundColor: colors.surface, height: 220 }]} />
      <View style={[styles.skeletonCard, { borderColor: colors.hair, backgroundColor: colors.surface, height: 180 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: { gap: 2 },
  moonRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 14 },
  skeleton: { gap: 12 },
  skeletonCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.card },
});
