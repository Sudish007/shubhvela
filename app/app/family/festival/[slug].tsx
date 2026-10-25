// Festival detail route (F23): /family/festival/<slug>?year=&date=&tradition=&region=. The year defaults to the current
// one, tradition to the self profile's, region to the persisted setting; the occurrence is recomputed here from the
// engine (never passed as text) so a deep link without a date still shows the right day for the user's place.
import { type Region, type Tradition, festivalRule, festivals, localDateOf } from '@shubhvela/engine';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen, Txt } from '../../../src/components';
import { getSelfProfile } from '../../../src/db/profiles';
import { getSetting } from '../../../src/db/settings';
import { FestivalDetail } from '../../../src/family/FestivalDetail';
import { useLang } from '../../../src/i18n';
import { useTokens } from '../../../src/theme/ThemeProvider';
import { radius } from '../../../src/theme/tokens';

export interface FestivalScreenProps {
  slug?: string;
  year?: number;
  date?: string;
  tradition?: Tradition;
  region?: Region;
  now?: () => number;
}

type Loaded = { kind: 'ok'; all: ReturnType<typeof festivals> } | { kind: 'missing' };

export default function FestivalScreen(props: FestivalScreenProps) {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  const params = useLocalSearchParams<{ slug?: string; year?: string; date?: string; tradition?: string; region?: string }>();
  const slug = props.slug ?? params.slug ?? '';
  const self = getSelfProfile();
  const nowMs = (props.now ?? Date.now)();
  const year = props.year ?? (params.year ? Number(params.year) : Number(localDateOf(nowMs, self?.tz ?? 'UTC').slice(0, 4)));
  const tradition: Tradition = props.tradition ?? (params.tradition === 'amanta' || params.tradition === 'purnimanta' ? params.tradition : self?.tradition ?? getSetting('traditionDefault'));
  const region: Region = props.region ?? (params.region === 'south' || params.region === 'north' ? params.region : getSetting('festivalRegion'));
  const wantedDate = props.date ?? params.date;
  const rule = festivalRule(slug);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!self || !rule) return;
    const id = setTimeout(() => {
      try {
        setLoaded({ kind: 'ok', all: festivals(year, tradition, region, { lat: self.lat, lon: self.lon }, self.tz) });
      } catch (e) {
        if (__DEV__) console.warn('festival failed', e);
        setLoaded({ kind: 'missing' });
      }
    }, 0);
    return () => clearTimeout(id);
  }, [self, rule, year, tradition, region]);

  const title = rule ? rule.names[lang] ?? rule.names.en : t('calendar.festival');
  const siblings = loaded?.kind === 'ok' ? loaded.all.filter((f) => f.slug === slug && (f.day === undefined || f.day === 1)) : [];
  const occurrence = siblings.find((f) => f.date === wantedDate) ?? siblings[0] ?? null;

  return (
    <Screen title={title} chrome="stack" route="FestivalDetail" subtitle={<Txt kind="label" weight={400} color="ink2" latin tabular>{String(year)}</Txt>} testID="festival-screen">
      {!self || !rule ? (
        <Txt kind="body" color="ink2">
          {!rule ? t('calendar.unknownFestival') : t('today.noProfile')}
        </Txt>
      ) : null}
      {self && rule && !loaded ? (
        <View accessibilityLabel={t('common.computing')} accessibilityRole="progressbar" testID="festival-skeleton" style={[styles.skeleton, { borderColor: colors.hair, backgroundColor: colors.surface }]} />
      ) : null}
      {self && rule && loaded && !occurrence ? (
        <Txt kind="body" color="ink2" testID="festival-none">
          {t('calendar.notInYear', { year })}
        </Txt>
      ) : null}
      {self && occurrence ? (
        <FestivalDetail occurrence={occurrence} siblings={siblings} year={year} tradition={tradition} region={region} geo={{ lat: self.lat, lon: self.lon }} tz={self.tz} placeName={self.placeName} testID="festival-detail" />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  skeleton: { height: 200, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.card },
});
