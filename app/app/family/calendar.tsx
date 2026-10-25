// Festival calendar (F23, design.md 10.4): segmented Purnimanta/Amanta (month naming, starts at the self profile's
// tradition) and North/South (region filter, persisted in settings.festivalRegion) with their state visible, then the
// month list for three years with every festival a 56 dp row and the family's shraddha days highlighted (F21). The list
// is computed in an effect per toggle state and cached per state so toggling back is instant.
import { type Region, type Tradition } from '@shubhvela/engine';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { EmptyState, Screen, Segmented, Txt } from '../../src/components';
import { listAncestors } from '../../src/db/ancestors';
import { getSelfProfile } from '../../src/db/profiles';
import { getSetting, setSetting } from '../../src/db/settings';
import { buildCalendar, CalendarList, type CalendarModel } from '../../src/family/CalendarList';
import { useLang } from '../../src/i18n';
import { useTokens } from '../../src/theme/ThemeProvider';
import { radius } from '../../src/theme/tokens';
import { vedicDayFor } from '../../src/today/model';

export interface CalendarScreenProps {
  /** Clock for tests. */
  now?: () => number;
  /** Years to list (default 3; tests use 1 to stay fast). */
  years?: number;
}

export default function CalendarScreen({ now, years }: CalendarScreenProps) {
  const { t } = useLang();
  const { colors } = useTokens();
  const router = useRouter();
  const self = getSelfProfile();
  const [tradition, setTradition] = useState<Tradition>(() => self?.tradition ?? getSetting('traditionDefault'));
  const [region, setRegion] = useState<Region>(() => getSetting('festivalRegion'));
  const [model, setModel] = useState<CalendarModel | null>(null);
  const cache = useRef(new Map<string, CalendarModel>());
  const key = `${tradition}|${region}`;

  useEffect(() => {
    if (!self) return;
    const hit = cache.current.get(key);
    if (hit) {
      setModel(hit);
      return;
    }
    const id = setTimeout(() => {
      try {
        const nowMs = (now ?? Date.now)();
        const geo = { lat: self.lat, lon: self.lon };
        const today = vedicDayFor(nowMs, geo, self.tz);
        const m = buildCalendar({ today, tradition, region, geo, tz: self.tz, ancestors: listAncestors(), years });
        cache.current.set(key, m);
        setModel(m);
      } catch (e) {
        if (__DEV__) console.warn('calendar failed', e);
      }
    }, 0);
    return () => clearTimeout(id);
  }, [self, tradition, region, key, now, years]);

  const current = model && `${model.tradition}|${model.region}` === key ? model : null;

  return (
    <Screen title={t('calendar.title')} chrome="stack" route="Calendar" testID="calendar-screen">
      <View style={styles.toggles}>
        <View style={styles.toggle}>
          <Txt kind="caption" color="ink3">
            {t('calendar.tradition')}
          </Txt>
          <Segmented<Tradition>
            options={[
              { value: 'purnimanta', label: t('panchang.purnimanta') },
              { value: 'amanta', label: t('panchang.amanta') },
            ]}
            value={tradition}
            onChange={setTradition}
            accessibilityLabel={t('calendar.tradition')}
            testID="calendar-tradition"
          />
        </View>
        <View style={styles.toggle}>
          <Txt kind="caption" color="ink3">
            {t('calendar.region')}
          </Txt>
          <Segmented<Region>
            options={[
              { value: 'north', label: t('calendar.regionNorth') },
              { value: 'south', label: t('calendar.regionSouth') },
            ]}
            value={region}
            onChange={(r) => {
              setSetting('festivalRegion', r);
              setRegion(r);
            }}
            accessibilityLabel={t('calendar.region')}
            testID="calendar-region"
          />
        </View>
      </View>
      <Txt kind="caption" color="ink3">
        {t('calendar.regionNote')}
      </Txt>
      {!self ? <EmptyState title={t('calendar.title')} body={t('today.noProfile')} /> : null}
      {self && !current ? (
        <View accessibilityLabel={t('common.computing')} accessibilityRole="progressbar" testID="calendar-skeleton" style={styles.skeleton}>
          <View style={[styles.skeletonCard, { borderColor: colors.hair, backgroundColor: colors.surface }]} />
          <View style={[styles.skeletonCard, { borderColor: colors.hair, backgroundColor: colors.surface }]} />
        </View>
      ) : null}
      {current ? (
        <>
          <Txt kind="caption" color="ink3" testID="calendar-range">
            {t('calendar.rangeLine', { from: current.fromYear, to: current.toYear, count: current.festivalCount })}
          </Txt>
          <CalendarList
            model={current}
            onOpenFestival={(it) => router.push(`/family/festival/${it.slug}?year=${it.year}&date=${it.date}&tradition=${tradition}&region=${region}`)}
            onOpenAncestor={(a) => router.push(`/family/ancestor/${a.id}`)}
            testID="calendar-list"
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  toggles: { gap: 8 },
  toggle: { gap: 4 },
  skeleton: { gap: 12 },
  skeletonCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.card, height: 160 },
});
