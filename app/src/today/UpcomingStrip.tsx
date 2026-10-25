// F7 Upcoming strip (design.md 10.2): section title + "All dates", horizontal 196 dp cards in the engine's fixed order
// (family tithi · vrat · saved muhurat · dasha change · major transit) with a micro kind label, a bold title and a
// tabular date line (digit runs in Num, time ranges glued with NoBreak); each card is tappable and opens its detail. Empty kinds are omitted by the engine; when
// everything is empty the strip is one row "Add a family date" (-> profile editor).
import type { UpcomingItem } from '@shubhvela/engine';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ChevronIcon } from '../components/icons';
import { Pressable44 } from '../components/Pressable44';
import { Txt } from '../components/Txt';
import { useLang, type Lang, type TFn } from '../i18n';
import { useTokens } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';
import { fmtDate, fmtDayShort, fmtRange, fmtTime, glueRanges, lunarMonthName, planetName, signName, tithiName } from './format';
import { RichText } from './RichText';

export interface UpcomingStripProps {
  items: readonly UpcomingItem[];
  tz: string;
  /** Self profile id (the family-tithi card opens its editor). */
  profileId: number;
  testID?: string;
}

export const UPCOMING_CARD_WIDTH = 196;

export interface UpcomingCardText {
  kind: string;
  title: string;
  date: string;
  route: string;
}

const KIND_KEY: Record<UpcomingItem['kind'], string> = {
  familyTithi: 'upcoming.familyTithi',
  vrat: 'upcoming.vrat',
  savedMuhurat: 'upcoming.savedMuhurat',
  dashaChange: 'upcoming.dasha',
  majorTransit: 'upcoming.transit',
};

/** Text of one card, every value from the engine item. Routes: profile editor, vrat detail (A12), Charts; saved muhurats route to Charts until B01. */
export function upcomingCardText(item: UpcomingItem, tz: string, profileId: number, t: TFn, lang: Lang): UpcomingCardText {
  const c = cardText(item, tz, profileId, t, lang);
  return { ...c, date: glueRanges(c.date) };
}

function cardText(item: UpcomingItem, tz: string, profileId: number, t: TFn, lang: Lang): UpcomingCardText {
  const p = item.params;
  const kind = t(KIND_KEY[item.kind]);
  const day = fmtDayShort(item.at, tz, lang);
  switch (item.kind) {
    case 'familyTithi': {
      const tithi = tithiName(lang, (p.tithi as number) - 1 + (p.paksha === 'krishna' ? 15 : 0));
      const month = lunarMonthName(lang, p.month as number, Boolean(p.adhik));
      const paksha = t(p.paksha === 'krishna' ? 'panchang.krishna' : 'panchang.shukla');
      return { kind, title: t('upcoming.janmaTithi', { name: (p.name as string | null) ?? t('today.yourDayNoName') }), date: `${t('events.tithiDate', { month, paksha, tithi })} · ${day}`, route: `/profile/${profileId}` };
    }
    case 'vrat': {
      const name = t(`vrat.name.${p.name as string}`);
      let extra = '';
      if (p.keyTimeKind === 'parana' && typeof p.keyTimeStart === 'number' && typeof p.keyTimeEnd === 'number') extra = ` · ${t('upcoming.parana', { from: fmtTime(p.keyTimeStart, tz), to: fmtTime(p.keyTimeEnd, tz) })}`;
      else if (p.keyTimeKind === 'moonrise' && typeof p.keyTimeStart === 'number') extra = ` · ${t('upcoming.moonrise', { time: fmtTime(p.keyTimeStart, tz) })}`;
      return { kind, title: name, date: `${day}${extra}`, route: `/family/vrat/${p.family as string}` };
    }
    case 'savedMuhurat':
      return { kind, title: String(p.activity), date: `${day} · ${fmtRange(p.start as number, p.end as number, tz)}`, route: '/(tabs)/charts' };
    case 'dashaChange': {
      const key = p.level === 'maha' ? 'upcoming.mahaChange' : p.level === 'pratyantar' ? 'upcoming.pratyantarChange' : 'upcoming.antarChange';
      return { kind, title: t(key, { from: planetName(lang, p.from as 'Su'), to: planetName(lang, p.to as 'Su') }), date: fmtDate(item.at, tz, lang), route: '/(tabs)/charts' };
    }
    case 'majorTransit': {
      const sign = signName(lang, p.toSign as number);
      const title =
        p.planet === 'Rahu'
          ? t('upcoming.rahuKetuEnter', { sign, ketuSign: signName(lang, p.ketuToSign as number) })
          : t(p.retrograde ? 'upcoming.entersRetro' : 'upcoming.enters', { planet: planetName(lang, p.planet === 'Saturn' ? 'Sa' : 'Ju'), sign });
      return { kind, title, date: fmtDate(item.at, tz, lang), route: '/(tabs)/charts' };
    }
  }
}

export function UpcomingStrip({ items, tz, profileId, testID }: UpcomingStripProps) {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  const router = useRouter();
  const cards = items.map((it) => ({ item: it, text: upcomingCardText(it, tz, profileId, t, lang) }));
  return (
    <View testID={testID} style={styles.root}>
      <View style={styles.titleRow}>
        <Txt kind="heading" accessibilityRole="header">
          {t('upcoming.title')}
        </Txt>
        <Pressable44 accessibilityLabel={t('upcoming.allDates')} onPress={() => router.push('/family/calendar')} style={styles.allDates} testID="upcoming-all-dates">
          <Txt kind="label" weight={600} color="accent">
            {t('upcoming.allDates')}
          </Txt>
        </Pressable44>
      </View>
      {cards.length === 0 ? (
        <Pressable44
          accessibilityLabel={t('upcoming.addFamilyDate')}
          onPress={() => router.push('/profile/new')}
          style={[styles.emptyRow, { backgroundColor: colors.surface, borderColor: colors.hair }]}
          testID="upcoming-empty"
        >
          <Txt kind="label" weight={400} style={styles.emptyText}>
            {t('upcoming.addFamilyDate')}
          </Txt>
          <ChevronIcon color={colors.ink3} />
        </Pressable44>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip} testID="upcoming-strip">
          {cards.map(({ item, text }) => (
            <Pressable44
              key={item.kind}
              accessibilityLabel={`${text.kind}: ${text.title}, ${text.date}`}
              onPress={() => router.push(text.route)}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hair }]}
              testID={`upcoming-${item.kind}`}
            >
              <Txt kind="micro" color="ink3" style={styles.kind}>
                {text.kind}
              </Txt>
              <Txt kind="label" weight={600} style={styles.title}>
                {text.title}
              </Txt>
              <RichText kind="label" weight={400} color="ink2" style={styles.date} text={text.date} />
            </Pressable44>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'stretch' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, paddingVertical: 4 },
  allDates: { paddingHorizontal: 8 },
  strip: { gap: 10, paddingRight: 16 },
  card: { width: UPCOMING_CARD_WIDTH, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.card, paddingHorizontal: 14, paddingVertical: 12, minHeight: 88, alignItems: 'flex-start', justifyContent: 'flex-start' },
  kind: { textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { marginTop: 4 },
  date: { marginTop: 2 },
  emptyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.card, paddingHorizontal: 16, paddingVertical: 10, alignSelf: 'stretch' },
  emptyText: { flex: 1 },
});
