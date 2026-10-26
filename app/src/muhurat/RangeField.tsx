// RangeField (F26, spec section 9 "Muhurat finder: today + 7 days / any range"): free tier = a read-only field
// "today – +7 days" with the computed dates as caption and the "Any range · Pro" link; Pro = two 48 dp date fields
// (From / To) opening the native Android date picker, bounded today .. today + 400 days (the engine's limit).
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { localDateOf, type DateRange } from '@shubhvela/engine';
import { StyleSheet, View } from 'react-native';
import { CalendarIcon } from '../components/icons';
import { NoBreak } from '../components/Num';
import { Pressable44 } from '../components/Pressable44';
import { Tag } from '../components/Tag';
import { Txt } from '../components/Txt';
import { useLang, type Lang } from '../i18n';
import { dateToIso, isoToDate } from '../profiles/nativePickers';
import { useTokens } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';
import { fmtCivilDate } from '../today/format';
import { MAX_RANGE_DAYS, clampRange } from './model';

export interface RangeFieldProps {
  range: DateRange;
  pro: boolean;
  /** Clock instant (the free range and the picker bounds start today). */
  nowMs: number;
  tz: string;
  onChange: (range: DateRange) => void;
  onPressPro: () => void;
  testID?: string;
}

/** "Thu 22 Oct 2026 – Thu 29 Oct 2026" without the weekday: "22 Oct 2026 – 29 Oct 2026". */
export function rangeText(range: DateRange, lang: Lang): string {
  const strip = (s: string): string => s.split(' ').slice(1).join(' ');
  return `${strip(fmtCivilDate(range.from, lang))} \u2013 ${strip(fmtCivilDate(range.to, lang))}`;
}

function addDaysIso(iso: string, days: number): string {
  const d = isoToDate(iso);
  d.setDate(d.getDate() + days);
  return dateToIso(d);
}

export function RangeField({ range, pro, nowMs, tz, onChange, onPressPro, testID }: RangeFieldProps) {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  const today = localDateOf(nowMs, tz);
  const fieldStyle = [styles.field, { borderColor: colors.hair2, backgroundColor: colors.surface }];

  function pick(which: 'from' | 'to') {
    const current = which === 'from' ? range.from : range.to;
    DateTimePickerAndroid.open({
      value: isoToDate(current),
      mode: 'date',
      minimumDate: isoToDate(which === 'from' ? today : range.from),
      maximumDate: isoToDate(addDaysIso(today, MAX_RANGE_DAYS)),
      onValueChange: (_e, d) => {
        const iso = dateToIso(d);
        onChange(clampRange(which === 'from' ? { from: iso, to: range.to < iso ? iso : range.to } : { from: range.from, to: iso }, nowMs, tz));
      },
    });
  }

  if (!pro) {
    return (
      <View testID={testID}>
        <Txt kind="micro" weight={600} color="ink3" style={styles.label}>
          {t('muhurat.dates')}
        </Txt>
        <View style={fieldStyle} accessible accessibilityLabel={`${t('muhurat.dates')}: ${t('muhurat.freeRange')}, ${rangeText(range, lang)}`} testID="range-free">
          <Txt kind="label" weight={400} style={styles.flex}>
            {t('muhurat.freeRange')}
          </Txt>
          <CalendarIcon color={colors.ink3} size={20} />
        </View>
        <View style={styles.captionRow}>
          <NoBreak kind="caption" color="ink3" numeric testID="range-dates">
            {rangeText(range, lang)}
          </NoBreak>
          <Pressable44 accessibilityLabel={t('muhurat.rangePro')} onPress={onPressPro} style={styles.proLink} testID="range-pro">
            <Txt kind="caption" weight={600} color="accent">
              {t('muhurat.rangePro')}
            </Txt>
          </Pressable44>
        </View>
      </View>
    );
  }

  return (
    <View testID={testID}>
      <View style={styles.labelRow}>
        <Txt kind="micro" weight={600} color="ink3" style={styles.label}>
          {t('muhurat.dates')}
        </Txt>
        <Tag>{t('common.pro')}</Tag>
      </View>
      <View style={styles.pair}>
        <Pressable44 accessibilityLabel={`${t('muhurat.rangeFrom')}: ${fmtCivilDate(range.from, lang)}`} onPress={() => pick('from')} style={[fieldStyle, styles.flex]} testID="range-from">
          <View style={styles.flex}>
            <Txt kind="micro" color="ink3">
              {t('muhurat.rangeFrom')}
            </Txt>
            <NoBreak kind="label" weight={400} numeric>
              {fmtCivilDate(range.from, lang).split(' ').slice(1).join(' ')}
            </NoBreak>
          </View>
          <CalendarIcon color={colors.ink2} size={20} />
        </Pressable44>
        <Pressable44 accessibilityLabel={`${t('muhurat.rangeTo')}: ${fmtCivilDate(range.to, lang)}`} onPress={() => pick('to')} style={[fieldStyle, styles.flex]} testID="range-to">
          <View style={styles.flex}>
            <Txt kind="micro" color="ink3">
              {t('muhurat.rangeTo')}
            </Txt>
            <NoBreak kind="label" weight={400} numeric>
              {fmtCivilDate(range.to, lang).split(' ').slice(1).join(' ')}
            </NoBreak>
          </View>
          <CalendarIcon color={colors.ink2} size={20} />
        </Pressable44>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  field: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderRadius: radius.button },
  flex: { flex: 1, minWidth: 0 },
  captionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2 },
  proLink: { paddingHorizontal: 8 },
  pair: { flexDirection: 'row', gap: 8 },
});
