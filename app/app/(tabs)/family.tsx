// Family tab (design.md 10.1 F3, 10.4 F20-F25; family.html; plan A12). Top to bottom: date line; the avatar row (the ONE
// profile control; "Add" under entitlements.canAddProfile()); the quota line "2 of 2 profiles · N of 5 reminders (free)"
// with the Pro text button (honest Pro sheet until B03); Family Today (F24); "Dates and reminders" + "Calendar"; the
// event cards sorted by next date (tithi birthday per profile, barsi + Pitru Paksha per ancestor, the next occurrence
// of every ENABLED vrat family) each with its series Switch and Why?; the city card (place, sunrise/sunset, Panchang ->
// F8 sheet); the footer buttons "Add family member" (M7) · "Add shraddha" · "Add vrat"; the quiet-by-default caption.
// Every number is engine output at the self profile's place for now. No "Family tools" card, no share/match/naamkaran
// rows until Phase B (nothing fake, no disabled placeholders).
import { goodHours, panchang, type GoodHours, type PanchangDay } from '@shubhvela/engine';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, CapSheet, ChevronIcon, EmptyState, InlineNotice, Pressable44, Screen, SecondaryButton, TextButton, Txt } from '../../src/components';
import { listAncestors, type Ancestor } from '../../src/db/ancestors';
import { enabledVratFamilies } from '../../src/db/eventSeries';
import { FREE_PROFILE_CAP, canAddProfile, isPro } from '../../src/entitlements';
import { chartFor } from '../../src/engine-bridge/charts';
import { EventCard } from '../../src/family/EventCard';
import { FamilyTodayCard } from '../../src/family/FamilyTodayCard';
import { computeFamily, type FamilyModel, type FamilyObserver } from '../../src/family/model';
import { ProfileRow } from '../../src/family/ProfileRow';
import { useSeries, type UseSeriesOptions } from '../../src/family/useSeries';
import { VratCard } from '../../src/family/VratCard';
import { useLang } from '../../src/i18n';
import { openSystemNotificationSettings } from '../../src/notifications/permissions';
import { useProfiles } from '../../src/profiles/useProfiles';
import { useTokens } from '../../src/theme/ThemeProvider';
import { radius } from '../../src/theme/tokens';
import { fmtCivilDate, fmtTime, lunarMonthName, tithiName } from '../../src/today/format';
import { PanchangSheet } from '../../src/today/PanchangSheet';
import { RichText } from '../../src/today/RichText';

export interface FamilyScreenProps {
  /** Clock for tests. */
  now?: () => number;
  /** Permission / scheduler injection for tests. */
  seriesOptions?: UseSeriesOptions;
}

interface Computed {
  model: FamilyModel;
  panchang: PanchangDay;
  goodHours: GoodHours;
  key: string;
}

export default function FamilyScreen({ now, seriesOptions }: FamilyScreenProps) {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  const router = useRouter();
  const { profiles, self } = useProfiles();
  const [ancestors, setAncestors] = useState<Ancestor[]>(() => listAncestors());
  const [vrats, setVrats] = useState(() => enabledVratFamilies());
  const [tick, setTick] = useState(0);
  const [computed, setComputed] = useState<Computed | null>(null);
  const [capOpen, setCapOpen] = useState<'pro_profiles' | 'pro_feature' | null>(null);
  const [sheet, setSheet] = useState(false);
  const clock = now ?? Date.now;

  const refreshLists = useCallback(() => {
    setAncestors(listAncestors());
    setVrats(enabledVratFamilies());
    setTick((n) => n + 1);
  }, []);
  useFocusEffect(refreshLists);

  const series = useSeries({ ...seriesOptions, onChange: refreshLists });

  const observer = useMemo<FamilyObserver | null>(() => (self ? { geo: { lat: self.lat, lon: self.lon }, tz: self.tz } : null), [self]);
  const key = self && observer ? `${self.id}|${observer.tz}|${profiles.map((p) => p.id).join(',')}|${ancestors.map((a) => `${a.id}:${a.deathMonth}${a.paksha}${a.tithi}${a.year}`).join(',')}|${vrats.join(',')}|${tick}` : '';

  useEffect(() => {
    if (!self || !observer) return;
    const id = setTimeout(() => {
      try {
        const nowMs = clock();
        const model = computeFamily({ profiles, ancestors, enabledVrats: vrats, tradition: self.tradition, observer, nowMs });
        const chart = chartFor(self);
        const p = panchang(model.day, observer.geo, observer.tz, { ayanamsa: chart.meta.ayanamsa });
        const gh = goodHours(model.day, observer.geo, observer.tz, { ayanamsa: chart.meta.ayanamsa });
        setComputed({ model, panchang: p, goodHours: gh, key });
      } catch (e) {
        if (__DEV__) console.warn('family failed', e);
      }
    }, 0);
    return () => clearTimeout(id);
  }, [self, observer, profiles, ancestors, vrats, key, clock]);

  const current = computed && computed.key === key ? computed : null;
  const decision = canAddProfile(profiles.length);
  const pro = isPro();

  function addMember() {
    if (!decision.allowed) return setCapOpen('pro_profiles');
    router.push('/profile/new');
  }

  const p = current?.panchang;
  const dateLine =
    current && p && self
      ? t('today.dateLine', {
          weekday: fmtCivilDate(current.model.day, lang).split(' ')[0],
          date: fmtCivilDate(current.model.day, lang).split(' ').slice(1).join(' '),
          month: lunarMonthName(lang, (self.tradition === 'amanta' ? p.monthAmanta : p.monthPurnimanta).index, (self.tradition === 'amanta' ? p.monthAmanta : p.monthPurnimanta).adhik),
          paksha: t(p.tithi.paksha === 'krishna' ? 'panchang.krishna' : 'panchang.shukla'),
          tithi: tithiName(lang, p.tithi.index),
        })
      : null;

  const quota = pro
    ? t('family.quotaLinePro', { profiles: profiles.length, series: series.enabledCount })
    : t('family.quotaLine', { profiles: profiles.length, maxProfiles: FREE_PROFILE_CAP, series: series.enabledCount, maxSeries: series.cap ?? 0 });

  const today = current?.model.day ?? '';
  const placeName = self?.placeName ?? '';

  return (
    <Screen title={t('family.title')} route="Family" subtitle={dateLine ? <RichText kind="label" weight={400} color="ink2" text={dateLine} testID="family-date-line" /> : undefined} testID="family-screen">
      <ProfileRow profiles={profiles} selectedId={self?.id ?? null} onSelect={(pr) => router.push(`/profile/${pr.id}`)} onAdd={addMember} atCap={!decision.allowed} testID="profile-row" />
      <View style={styles.quota}>
        <RichText kind="caption" color="ink3" text={quota} testID="quota-line" />
        {pro ? null : <TextButton label={t('common.pro')} onPress={() => setCapOpen('pro_feature')} testID="quota-pro" />}
      </View>

      {!self ? <EmptyState title={t('family.title')} body={t('today.noProfile')} /> : null}
      {self && !current ? <Skeleton /> : null}

      {current && self ? <FamilyTodayCard rows={current.model.today} tz={self.tz} moonSign={current.panchang.moonSign + 1} testID="family-today" /> : null}

      {current ? (
        <>
          <View style={styles.sectionTitle}>
            <Txt kind="heading" accessibilityRole="header">
              {t('family.datesAndReminders')}
            </Txt>
            <TextButton label={t('family.calendar')} onPress={() => router.push('/family/calendar')} testID="open-calendar" />
          </View>
          {series.permission === 'denied' ? (
            <Pressable44 accessibilityLabel={t('reminders.permission')} onPress={openSystemNotificationSettings} style={[styles.permRow, { borderColor: colors.hair2, backgroundColor: colors.surface }]} testID="permission-row">
              <Txt kind="label" weight={400} style={styles.permText}>
                {t('reminders.permission')}
              </Txt>
              <ChevronIcon color={colors.ink3} />
            </Pressable44>
          ) : null}
          {current.model.events.length === 0 ? <InlineNotice>{t('family.noEvents')}</InlineNotice> : null}
          {current.model.events.map((e) =>
            e.kind === 'vrat_family' && e.vrat && e.vratFamily ? (
              <VratCard
                key={e.key}
                family={e.vratFamily}
                occurrence={e.vrat}
                today={today}
                tz={self!.tz}
                placeName={placeName}
                enabled={series.isEnabled(e.kind, e.refId)}
                notScheduled={series.failed.has(e.key)}
                onToggle={(next) => void series.toggle(e.kind, e.refId, next)}
                onOpen={() => router.push(`/family/vrat/${e.vratFamily}`)}
                testID={`event-${e.key}`}
              />
            ) : (
              <EventCard
                key={e.key}
                event={e}
                today={today}
                enabled={series.isEnabled(e.kind, e.refId)}
                notScheduled={series.failed.has(e.key)}
                onToggle={(next) => void series.toggle(e.kind, e.refId, next)}
                onOpen={e.kind === 'barsi' ? () => router.push(`/family/ancestor/${e.refId}`) : () => router.push(`/profile/${e.refId}`)}
                testID={`event-${e.key}`}
              />
            ),
          )}

          <Card testID="city-card">
            <View style={styles.cityRow}>
              <View style={styles.cityText}>
                <Txt kind="body" weight={600}>
                  {placeName}
                </Txt>
                <RichText
                  kind="caption"
                  color="ink2"
                  text={
                    current.panchang.sunrise !== null && current.panchang.sunset !== null
                      ? t('family.sunLine', { sunrise: fmtTime(current.panchang.sunrise, self!.tz), sunset: fmtTime(current.panchang.sunset, self!.tz) })
                      : t('today.noSun')
                  }
                  testID="city-sun-line"
                />
              </View>
              <Pressable44 accessibilityLabel={t('today.openPanchang')} onPress={() => setSheet(true)} style={[styles.pill, { borderColor: colors.hair2, backgroundColor: colors.surface }]} testID="city-panchang">
                <Txt kind="label" weight={600}>
                  {t('today.panchang')}
                </Txt>
                <ChevronIcon color={colors.ink} size={18} />
              </Pressable44>
            </View>
          </Card>

          <View style={styles.footerButtons}>
            <SecondaryButton label={t('family.addMember')} onPress={addMember} style={styles.footerButton} testID="add-member" />
            <SecondaryButton label={t('family.addShraddha')} onPress={() => router.push('/family/ancestor/new')} style={styles.footerButton} testID="add-shraddha" />
            <SecondaryButton label={t('family.addVrat')} onPress={() => router.push('/settings/vrats')} style={styles.footerButton} testID="add-vrat" />
          </View>
          <Txt kind="caption" color="ink3" testID="family-footer">
            {t('family.remindersNote')}
          </Txt>
        </>
      ) : null}

      <CapSheet visible={capOpen !== null || series.capOpen} onClose={() => (series.capOpen ? series.closeCap() : setCapOpen(null))} reason={series.capOpen ? 'pro_reminders' : capOpen ?? 'pro_feature'} />
      {current && self ? (
        <PanchangSheet visible={sheet} onClose={() => setSheet(false)} panchang={current.panchang} goodHours={current.goodHours} chart={chartFor(self)} placeName={placeName} onAllSegments={() => setSheet(false)} />
      ) : null}
    </Screen>
  );
}

function Skeleton() {
  const { colors } = useTokens();
  const { t } = useLang();
  return (
    <View accessibilityLabel={t('common.computing')} accessibilityRole="progressbar" testID="family-skeleton" style={styles.skeleton}>
      <View style={[styles.skeletonCard, { borderColor: colors.hair, backgroundColor: colors.surface, height: 140 }]} />
      <View style={[styles.skeletonCard, { borderColor: colors.hair, backgroundColor: colors.surface, height: 120 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  quota: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 44 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 44 },
  permRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderWidth: 1, borderRadius: radius.button, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'stretch' },
  permText: { flex: 1 },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cityText: { flex: 1, minWidth: 0, gap: 2 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 14 },
  footerButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  footerButton: { alignSelf: 'auto', flexGrow: 1, minHeight: 48 },
  skeleton: { gap: 12 },
  skeletonCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.card },
});
