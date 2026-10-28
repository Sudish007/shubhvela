// JournalMonth (F34, design.md 10.7): a 7-column grid of the month. Each day cell carries the date, the mood as a dot
// (a circle with the mood word's initial letter - the letter, not a colour, says which mood), the transit Moon's house from
// the natal Moon as a number under the date (engine), and a 2 px hairline across the top when a dasha period changes that
// day. Previous/next month are 44 dp controls. The legend ends with "for reflection, not proof" and nothing in the grid is
// graded good or bad.
import { locale } from '@shubhvela/engine';
import { StyleSheet, View } from 'react-native';
import { ChevronIcon } from '../components/icons';
import { Num } from '../components/Num';
import { Pressable44 } from '../components/Pressable44';
import { Txt } from '../components/Txt';
import { useLang } from '../i18n';
import { useTokens } from '../theme/ThemeProvider';
import { ordinal, planetName } from '../today/format';
import type { JournalCell, JournalMonthModel } from './journalModel';

export interface JournalMonthProps {
  model: JournalMonthModel;
  onPrev: () => void;
  onNext: () => void;
  /** Hide the Moon-house numbers (no chart). */
  testID?: string;
}

export function monthTitle(model: JournalMonthModel, lang: 'en' | 'hi' | 'bho'): string {
  return `${locale.monthNames[lang][model.month - 1]} ${model.year}`;
}

function cellLabel(c: JournalCell, t: (k: string, p?: Record<string, string | number>) => string, lang: 'en' | 'hi' | 'bho', monthName: string): string {
  const parts = [`${c.date} ${monthName}`];
  parts.push(c.mood ? t('journal.moodA11y', { mood: t(`journal.mood.${c.mood}`), state: t('common.yes') }) : t('journal.noMood'));
  if (c.moonHouse !== null) parts.push(t('note.houseFromMoon', { house: ordinal(c.moonHouse, lang) }));
  for (const ch of c.dashaChanges) parts.push(`${t(`dasha.${ch.level}`)}: ${planetName(lang, ch.from)} – ${planetName(lang, ch.to)}`);
  return parts.join(', ');
}

export function JournalMonth({ model, onPrev, onNext, testID }: JournalMonthProps) {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  const title = monthTitle(model, lang);
  const monthName = locale.monthShort[lang][model.month - 1];
  const slots: (JournalCell | null)[] = [...Array<null>(model.leading).fill(null), ...model.cells];
  while (slots.length % 7) slots.push(null);
  const rows: (JournalCell | null)[][] = [];
  for (let i = 0; i < slots.length; i += 7) rows.push(slots.slice(i, i + 7));

  return (
    <View testID={testID} style={styles.root}>
      <View style={styles.head}>
        <Pressable44 accessibilityLabel={t('journal.prevMonth')} onPress={onPrev} testID="journal-prev" style={styles.navBtn}>
          <View style={styles.flip}>
            <ChevronIcon color={colors.ink} />
          </View>
        </Pressable44>
        <Txt kind="heading" accessibilityRole="header" style={styles.title} testID="journal-month-title">
          {t('journal.monthTitle', { month: title })}
        </Txt>
        <Pressable44 accessibilityLabel={t('journal.nextMonth')} onPress={onNext} testID="journal-next" style={styles.navBtn}>
          <ChevronIcon color={colors.ink} />
        </Pressable44>
      </View>

      <View style={styles.weekRow}>
        {locale.weekdayShort[lang].map((w, i) => (
          <View key={i} style={styles.cell}>
            <Txt kind="micro" color="ink3" style={styles.center}>
              {w}
            </Txt>
          </View>
        ))}
      </View>

      <View testID="journal-grid">
        {rows.map((row, r) => (
          <View key={r} style={styles.weekRow}>
            {row.map((c, i) =>
              c ? (
                <View
                  key={c.day}
                  accessible
                  accessibilityLabel={cellLabel(c, t, lang, monthName)}
                  testID={`journal-cell-${c.day}`}
                  style={[
                    styles.cell,
                    styles.dayCell,
                    { borderColor: c.isToday ? colors.accent : colors.hair, borderWidth: c.isToday ? 2 : StyleSheet.hairlineWidth, backgroundColor: colors.surface },
                  ]}
                >
                  {c.dashaChanges.length ? <View style={[styles.dashaLine, { backgroundColor: colors.indigo }]} testID={`journal-dasha-${c.day}`} /> : null}
                  <Num kind="caption" weight={c.isToday ? 600 : 400} color={c.isToday ? 'accent' : 'ink'} testID={`journal-date-${c.day}`}>
                    {String(c.date)}
                  </Num>
                  <View style={[styles.dot, c.mood ? { borderColor: colors.accent, backgroundColor: colors.accentTint } : styles.dotEmpty]} testID={c.mood ? `journal-dot-${c.day}` : undefined}>
                    {c.mood ? (
                      <Txt kind="micro" weight={600} color="accent">
                        {t(`journal.mood.${c.mood}`).slice(0, 1)}
                      </Txt>
                    ) : null}
                  </View>
                  {c.moonHouse !== null ? (
                    <Num kind="micro" color="ink2" testID={`journal-house-${c.day}`}>
                      {String(c.moonHouse)}
                    </Num>
                  ) : null}
                </View>
              ) : (
                <View key={`blank-${r}-${i}`} style={styles.cell} />
              ),
            )}
          </View>
        ))}
      </View>

      <View style={[styles.legend, { borderTopColor: colors.hair }]} testID="journal-legend">
        <Txt kind="micro" weight={600} color="ink3">
          {t('journal.legendTitle')}
        </Txt>
        <Txt kind="caption" color="ink2">
          {t('journal.legendMood')}
        </Txt>
        <Txt kind="caption" color="ink2">
          {t('journal.legendMoonHouse')}
        </Txt>
        <Txt kind="caption" color="ink2">
          {t('journal.legendDashaLine')}
        </Txt>
        <Txt kind="caption" color="ink3" testID="journal-legend-footer">
          {t('journal.legendFooter')}
        </Txt>
      </View>
      {model.entryCount === 0 ? (
        <Txt kind="caption" color="ink3" testID="journal-empty-month">
          {t('journal.emptyMonth')}
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, minWidth: 0, textAlign: 'center' },
  navBtn: { width: 44 },
  flip: { transform: [{ scaleX: -1 }] },
  weekRow: { flexDirection: 'row', gap: 2 },
  cell: { flex: 1, minWidth: 0, alignItems: 'center' },
  dayCell: { borderRadius: 6, paddingTop: 6, paddingBottom: 4, gap: 2, overflow: 'hidden', minHeight: 64 },
  dashaLine: { position: 'absolute', top: 0, left: 0, right: 0, height: 2 },
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dotEmpty: { borderColor: 'transparent' },
  center: { textAlign: 'center' },
  legend: { gap: 2, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4 },
});
