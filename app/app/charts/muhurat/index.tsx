// Muhurat finder (F26, design.md 10.5 M25 / mocks/muhurat.html; plan B05): route /charts/muhurat, banner allow-listed
// as "MuhuratFinder" (M5). Header: Back + title + the saved-list control (44 dp). Inputs: ActivityChips (14, N5 "All 14
// activities" sheet), RangeField (free: fixed today..+7; Pro: range picker), ForField (one profile, two for marriage /
// engagement), the caption about the free range and the candidate-window rule. Results: engine.muhurat.score at the
// self profile's place, ranked by the engine (N18): WindowCards for windows meeting >= 4 rules, "Best partial matches"
// for the rest, the zero-results copy with the top three partials when nothing matched; "Save to Upcoming" writes
// saved_muhurats (the F7 strip picks it up); ".ics Pro" exports through expo-sharing for Pro and opens the Pro screen
// otherwise; the Travel today card and the "How this was computed" footer close the list.
// AdPolicy.maybeShowInterstitial('muhuratSearchCompleted') is asked ONCE per completed search, never on back.
import { localDateOf, panchang, type MuhuratWindow, type PanchangDay } from '@shubhvela/engine';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useInterstitial } from '../../../src/ads/useInterstitial';
import { useProStatus } from '../../../src/billing/ui';
import { useMountClock } from '../../../src/charts/LockedFeature';
import { BookmarkIcon, Card, ComputedFooter, EmptyState, InlineNotice, Pressable44, Screen, Txt } from '../../../src/components';
import { type Profile } from '../../../src/db/profiles';
import { countSavedMuhurats, findSavedMuhurat, saveMuhurat } from '../../../src/db/savedMuhurats';
import { chartFor } from '../../../src/engine-bridge/charts';
import { useLang } from '../../../src/i18n';
import { ActivityChips } from '../../../src/muhurat/ActivityChips';
import { ForField } from '../../../src/muhurat/ForField';
import { exportIcs, type IcsExportDeps } from '../../../src/muhurat/ics';
import { ACTIVITIES, clampRange, freeRange, profilesNeeded, searchMuhurat, type MuhuratObserver, type MuhuratSearch } from '../../../src/muhurat/model';
import { PartialMatches } from '../../../src/muhurat/PartialMatches';
import { RangeField } from '../../../src/muhurat/RangeField';
import { TravelTodayCard } from '../../../src/muhurat/TravelTodayCard';
import { WindowCard } from '../../../src/muhurat/WindowCard';
import { useProfiles } from '../../../src/profiles/useProfiles';
import { AYANAMSA_KEY, shortValue } from '../../../src/settingsLabels';
import { useTokens } from '../../../src/theme/ThemeProvider';
import { observerFromProfile } from '../../../src/today/model';

export interface MuhuratFinderProps {
  now?: () => number;
  /** Initial activity (default: the first of the table). */
  activity?: string;
  /** .ics export seams for tests. */
  icsDeps?: IcsExportDeps;
}

export const DEFAULT_ACTIVITY = ACTIVITIES[0].id;

/** The For selection for an activity: the self profile first; two slots for marriage / engagement. */
export function initialSelection(activityId: string, self: Profile | null, profiles: readonly Profile[]): (number | null)[] {
  const n = profilesNeeded(activityId);
  const first = self?.id ?? profiles[0]?.id ?? null;
  if (n === 1) return [first];
  const second = profiles.find((p) => p.id !== first)?.id ?? null;
  return [first, second];
}

/** Re-shapes the For selection when the activity's profile count changes (1 <-> 2). */
export function reshapeSelection(cur: readonly (number | null)[], n: 1 | 2, profiles: readonly Profile[]): (number | null)[] {
  if (cur.length === n) return [...cur];
  const first = cur[0] ?? null;
  return n === 1 ? [first] : [first, profiles.find((p) => p.id !== first)?.id ?? null];
}

type SearchState = MuhuratSearch | { error: true } | null;

function safeSavedCount(): number {
  try {
    return countSavedMuhurats();
  } catch {
    return 0;
  }
}

export default function MuhuratFinder({ now, activity: initialActivity, icsDeps }: MuhuratFinderProps) {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  const router = useRouter();
  const nowMs = useMountClock(now);
  const { pro } = useProStatus();
  const { self, profiles } = useProfiles();
  const { show: showInterstitial } = useInterstitial();
  const observer: MuhuratObserver | null = useMemo(() => (self ? observerFromProfile(self) : null), [self]);
  const tz = observer?.tz ?? 'UTC';
  const todayDate = localDateOf(nowMs, tz);

  const [activity, setActivity] = useState<string>(initialActivity ?? DEFAULT_ACTIVITY);
  const [selection, setSelection] = useState<(number | null)[]>(() => initialSelection(initialActivity ?? DEFAULT_ACTIVITY, self, profiles));
  const [proRange, setProRange] = useState(() => freeRange(nowMs, tz));
  const range = pro ? clampRange(proRange, nowMs, tz) : freeRange(nowMs, tz);
  const rangeFrom = range.from;
  const rangeTo = range.to;
  const [savedCount, setSavedCount] = useState(safeSavedCount);
  const [icsError, setIcsError] = useState(false);

  function chooseActivity(id: string) {
    setActivity(id);
    setSelection((cur) => reshapeSelection(cur, profilesNeeded(id), profiles));
  }

  // The search is synchronous engine work (~120 ms for 8 days); memoised on its inputs so re-renders never recompute.
  const result = useMemo<SearchState>(() => {
    if (!observer) return null;
    const chosen = selection.map((id) => profiles.find((p) => p.id === id)).filter((p): p is Profile => !!p);
    if (chosen.length !== selection.length) return null;
    try {
      return searchMuhurat(activity, { from: rangeFrom, to: rangeTo }, chosen, observer);
    } catch (e) {
      if (__DEV__) console.warn('muhurat failed', e);
      return { error: true };
    }
  }, [observer, selection, profiles, activity, rangeFrom, rangeTo]);

  // One interstitial decision per completed search (design.md 5 trigger muhuratSearchCompleted): keyed on the search
  // inputs, so a re-render or a profile-list refresh that recomputes the same search never asks twice; never on back.
  const searchKey = `${activity}|${rangeFrom}|${rangeTo}|${selection.join(',')}`;
  const lastAsked = useRef<string | null>(null);
  useEffect(() => {
    if (!result || 'error' in result || lastAsked.current === searchKey) return;
    lastAsked.current = searchKey;
    showInterstitial('muhuratSearchCompleted');
  }, [result, searchKey, showInterstitial]);

  const todayPanchang = useMemo<PanchangDay | null>(() => {
    if (!observer || !self) return null;
    try {
      return panchang(todayDate, { lat: observer.lat, lon: observer.lon }, tz, { ayanamsa: chartFor(self).meta.ayanamsa });
    } catch {
      return null;
    }
  }, [observer, self, todayDate, tz]);

  function isSaved(w: MuhuratWindow): boolean {
    try {
      return findSavedMuhurat(w) !== null;
    } catch {
      return false;
    }
  }
  function onSave(w: MuhuratWindow) {
    saveMuhurat(w);
    setSavedCount(safeSavedCount());
  }
  function onIcs(w: MuhuratWindow) {
    if (!pro) {
      router.push('/pro');
      return;
    }
    setIcsError(false);
    exportIcs(w, lang, t, tz, observer?.placeName ?? null, { ...icsDeps, nowMs }).catch((e) => {
      if (__DEV__) console.warn('ics failed', e);
      setIcsError(true);
    });
  }

  const savedControl = (
    <Pressable44 accessibilityLabel={`${t('muhurat.savedTitle')} (${savedCount})`} onPress={() => router.push('/charts/muhurat/saved')} testID="muhurat-saved-link">
      <BookmarkIcon color={colors.ink} />
    </Pressable44>
  );

  if (!self || !observer) {
    return (
      <Screen title={t('muhurat.title')} chrome="stack" route="MuhuratFinder" testID="muhurat-screen">
        <EmptyState title={t('muhurat.title')} body={t('charts.noProfile')} />
      </Screen>
    );
  }

  const chart = chartFor(self);
  const ayanamsaLabel = shortValue(t(AYANAMSA_KEY[chart.meta.ayanamsa]));
  const matches = result && !('error' in result) ? result.matches : [];
  const partials = result && !('error' in result) ? result.partials : [];

  return (
    <Screen title={t('muhurat.title')} chrome="stack" route="MuhuratFinder" headerRight={savedControl} testID="muhurat-screen">
      <ActivityChips selected={activity} onSelect={chooseActivity} testID="activity-chips" />
      <View style={styles.fields}>
        <RangeField range={range} pro={pro} nowMs={nowMs} tz={tz} onChange={setProRange} onPressPro={() => router.push('/pro')} testID="range-field" />
        <ForField profiles={profiles} selected={selection} onChange={setSelection} testID="for-field" />
      </View>
      <Txt kind="caption" color="ink3" testID="muhurat-caption">
        {`${pro ? '' : `${t('muhurat.freeNote')} `}${t('muhurat.windowRule')} ${t('muhurat.place', { place: observer.placeName ?? t('today.yourLocation') })}`}
      </Txt>

      {result && 'error' in result ? (
        <Card>
          <Txt kind="body" color="accent">
            {t('errors.chart')}
          </Txt>
        </Card>
      ) : null}
      {icsError ? <InlineNotice tone="error">{t('errors.generic')}</InlineNotice> : null}

      {result && !('error' in result) ? (
        <View style={styles.results} testID="muhurat-results">
          <Txt kind="caption" color="ink2" testID="muhurat-count">
            {t('muhurat.results', { count: matches.length })}
          </Txt>
          {matches.map((w, i) => (
            <WindowCard key={`${w.day}-${w.start}-${w.end}`} window={w} tz={tz} todayDate={todayDate} primary={i === 0} saved={isSaved(w)} pro={pro} onSave={() => onSave(w)} onIcs={() => onIcs(w)} testID={`window-${i}`} />
          ))}
          <PartialMatches partials={partials} zeroResults={matches.length === 0} tz={tz} todayDate={todayDate} pro={pro} isSaved={isSaved} onSave={onSave} onIcs={onIcs} testID="partials" />
        </View>
      ) : null}

      {todayPanchang ? <TravelTodayCard panchang={todayPanchang} testID="travel-today" /> : null}

      <ComputedFooter
        ayanamsa={`${ayanamsaLabel} (${chart.meta.ayanamsaDegrees.toFixed(4)}°)`}
        node={chart.meta.nodeMethod}
        ephemeris={t('panchang.ephemeris', { ephemeris: chart.meta.ephemeris })}
        tz={tz}
        rounding={t('charts.rounding')}
        extra={[t('muhurat.howComputed')]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  fields: { gap: 12 },
  results: { gap: 12 },
});
