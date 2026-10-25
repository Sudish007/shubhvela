// F23 festival calendar list (design.md 10.4): month sections from the current month through the end of the third year,
// each festival a 56 dp row (date · name · tithi text) that opens the detail; the family's shraddha days (barsi and the
// Pitru Paksha tithi day of every ancestor record, F21) are listed in their months with a highlight. Every date is
// engine output for the chosen tradition (month naming) and region at the observer's place; the model is pure and the
// screen computes it in an effect (three festival years ~1 s on a mid-range phone).
import { type FestivalOccurrence, type GeoPoint, type Region, type Tradition, barsiDates, festivals, locale } from '@shubhvela/engine';
import { StyleSheet, View } from 'react-native';
import { Pressable44 } from '../components/Pressable44';
import { Tag } from '../components/Tag';
import { Txt } from '../components/Txt';
import { ChevronIcon } from '../components/icons';
import type { Ancestor } from '../db/ancestors';
import { useLang, type Lang, type TFn } from '../i18n';
import { useTokens } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';
import { festivalTithiLine, tithiText } from './format';

export type CalendarItemKind = 'festival' | 'pitru' | 'barsi';

export interface CalendarItem {
  kind: CalendarItemKind;
  date: string;
  /** Festival slug (festival rows). */
  slug?: string;
  year: number;
  /** Engine occurrence (festival rows). */
  occurrence?: FestivalOccurrence;
  ancestor?: Ancestor;
  tithi?: { month: number; adhik: boolean; paksha: 'shukla' | 'krishna'; tithi: number };
}

export interface CalendarMonth {
  /** YYYY-MM */
  id: string;
  year: number;
  /** 0-11 */
  month: number;
  items: CalendarItem[];
}

export interface CalendarModel {
  tradition: Tradition;
  region: Region;
  fromYear: number;
  toYear: number;
  months: CalendarMonth[];
  festivalCount: number;
}

export interface BuildCalendarOptions {
  today: string;
  tradition: Tradition;
  region: Region;
  geo: GeoPoint;
  tz: string;
  ancestors: readonly Ancestor[];
  /** Years to cover from the current one (default 3). */
  years?: number;
}

/** Three years of festivals + the family's shraddha days, grouped by month from the current month on (pure). */
export function buildCalendar(o: BuildCalendarOptions): CalendarModel {
  const fromYear = Number(o.today.slice(0, 4));
  const years = o.years ?? 3;
  const toYear = fromYear + years - 1;
  const fromMonth = o.today.slice(0, 7);
  const items: CalendarItem[] = [];
  let festivalCount = 0;
  for (let y = fromYear; y <= toYear; y++) {
    for (const f of festivals(y, o.tradition, o.region, o.geo, o.tz)) {
      if (f.day !== undefined && f.day !== 1) continue; // multi-day spans: one row on their first day
      festivalCount++;
      items.push({ kind: 'festival', date: f.date, slug: f.slug, year: y, occurrence: f, tithi: f.tithiText ? { month: f.tithiText.month, adhik: f.tithiText.adhik, paksha: f.tithiText.paksha, tithi: f.tithiText.tithi } : undefined });
    }
  }
  for (const a of o.ancestors) {
    for (const d of barsiDates({ deathMonth: a.deathMonth, paksha: a.paksha, tithi: a.tithi, year: a.year ?? undefined }, fromYear, toYear, o.tradition, o.geo, o.tz)) {
      const m = o.tradition === 'amanta' ? d.month.amanta : d.month.purnimanta;
      items.push({ kind: 'barsi', date: d.date, year: d.year, ancestor: a, tithi: { month: m.index, adhik: m.adhik, paksha: a.paksha, tithi: a.tithi } });
      // An ancestor who passed inside Pitru Paksha has the barsi ON the Pitru Paksha day: one row, not two.
      if (d.pitruPakshaDay && d.pitruPakshaDay.date !== d.date) items.push({ kind: 'pitru', date: d.pitruPakshaDay.date, year: d.year, ancestor: a, tithi: { month: m.index, adhik: m.adhik, paksha: a.paksha, tithi: a.tithi } });
    }
  }
  const byMonth = new Map<string, CalendarItem[]>();
  for (const it of items) {
    const id = it.date.slice(0, 7);
    if (id < fromMonth) continue;
    const arr = byMonth.get(id) ?? [];
    arr.push(it);
    byMonth.set(id, arr);
  }
  const months: CalendarMonth[] = [...byMonth.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([id, arr]) => ({
      id,
      year: Number(id.slice(0, 4)),
      month: Number(id.slice(5, 7)) - 1,
      items: arr.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : x.kind === 'festival' ? -1 : 1)),
    }));
  return { tradition: o.tradition, region: o.region, fromYear, toYear, months, festivalCount };
}

export function monthHeading(m: CalendarMonth, lang: Lang): string {
  return `${locale.monthNames[lang][m.month]} ${m.year}`;
}

/** Day column text "Thu 22" from a civil date, engine weekday names. */
export function dayLabel(date: string, lang: Lang): string {
  const [y, mo, d] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  return `${locale.weekdayShort[lang][weekday]} ${d}`;
}

export function itemTitle(it: CalendarItem, t: TFn, lang: Lang): string {
  if (it.kind === 'festival' && it.occurrence) return it.occurrence.names[lang] ?? it.occurrence.names.en;
  const name = it.ancestor?.name ?? '';
  return it.kind === 'pitru' ? t('calendar.pitruRow', { name }) : t('calendar.barsiRow', { name });
}

export function itemCaption(it: CalendarItem, t: TFn, lang: Lang): string | null {
  if (it.kind === 'festival' && it.occurrence) {
    const line = festivalTithiLine(t, lang, it.occurrence.tithiText);
    if (it.occurrence.end && it.occurrence.end !== it.occurrence.date) {
      const [, , d2] = it.occurrence.end.split('-').map(Number);
      return `${line ?? ''}${line ? ' · ' : ''}${t('calendar.through', { day: d2 })}`;
    }
    return line;
  }
  return it.tithi ? tithiText(t, lang, it.tithi.month, it.tithi.adhik, it.tithi.paksha, it.tithi.tithi) : null;
}

export interface CalendarListProps {
  model: CalendarModel;
  onOpenFestival: (item: CalendarItem) => void;
  onOpenAncestor: (a: Ancestor) => void;
  testID?: string;
}

export function CalendarList({ model, onOpenFestival, onOpenAncestor, testID }: CalendarListProps) {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  if (!model.months.length) {
    return (
      <Txt kind="body" color="ink2" testID={testID}>
        {t('calendar.empty')}
      </Txt>
    );
  }
  return (
    <View testID={testID} style={styles.root}>
      {model.months.map((m) => (
        <View key={m.id} style={styles.month} testID={`month-${m.id}`}>
          <Txt kind="heading" accessibilityRole="header" style={styles.monthTitle}>
            {monthHeading(m, lang)}
          </Txt>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hair }]}>
            {m.items.map((it, i) => {
              const title = itemTitle(it, t, lang);
              const caption = itemCaption(it, t, lang);
              const highlight = it.kind !== 'festival';
              return (
                <Pressable44
                  key={`${it.kind}-${it.slug ?? it.ancestor?.id}-${it.date}`}
                  accessibilityLabel={`${dayLabel(it.date, lang)}: ${title}${caption ? `, ${caption}` : ''}`}
                  onPress={() => (it.kind === 'festival' ? onOpenFestival(it) : it.ancestor ? onOpenAncestor(it.ancestor) : undefined)}
                  style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hair }, highlight && { backgroundColor: colors.accentTint }]}
                  testID={`cal-${it.kind}-${it.slug ?? it.ancestor?.id}-${it.date}`}
                >
                  <Txt kind="label" weight={600} latin tabular style={styles.day}>
                    {dayLabel(it.date, lang)}
                  </Txt>
                  <View style={styles.text}>
                    <View style={styles.titleRow}>
                      <Txt kind="label" weight={600} style={styles.title}>
                        {title}
                      </Txt>
                      {it.kind === 'pitru' ? <Tag variant="kind">{t('events.pitruPaksha')}</Tag> : it.kind === 'barsi' ? <Tag variant="kind">{t('family.barsi')}</Tag> : null}
                    </View>
                    {caption ? (
                      <Txt kind="caption" color="ink3">
                        {caption}
                      </Txt>
                    ) : null}
                  </View>
                  <ChevronIcon color={colors.ink3} />
                </Pressable44>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  month: { gap: 6 },
  monthTitle: { paddingTop: 4 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.card, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, paddingVertical: 8, alignSelf: 'stretch', justifyContent: 'flex-start' },
  day: { width: 64 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  title: { flexShrink: 1 },
});
