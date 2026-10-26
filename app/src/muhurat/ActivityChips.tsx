// ActivityChips (F26, design.md 10.5; review N5): the 14 activities as a horizontally scrolling chip row. Collapsed, the
// row shows the first VISIBLE_COLLAPSED activities (plus the selected one when it is further down) and the chip
// "All 14 activities", which opens a sheet listing every activity as a radio row (N5); selected = fill + 2 px underline
// (the Chip component). Names come from the engine's activity table in the UI language.
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Chip } from '../components/Chip';
import { RadioRow } from '../components/ListRows';
import { Sheet } from '../components/Sheet';
import { Txt } from '../components/Txt';
import { useLang } from '../i18n';
import { ACTIVITIES } from './model';

export const VISIBLE_COLLAPSED = 6;

export interface ActivityChipsProps {
  selected: string;
  onSelect: (activityId: string) => void;
  testID?: string;
}

/** Activity ids shown in the collapsed row: the first six, plus the selected one when it is not among them. */
export function collapsedRow(selected: string): string[] {
  const ids = ACTIVITIES.map((a) => a.id);
  const head = ids.slice(0, VISIBLE_COLLAPSED);
  return head.includes(selected) ? head : [...head, selected];
}

export function ActivityChips({ selected, onSelect, testID }: ActivityChipsProps) {
  const { t, lang } = useLang();
  const [open, setOpen] = useState(false);
  const row = collapsedRow(selected);
  const name = (id: string): string => ACTIVITIES.find((a) => a.id === id)?.names[lang] ?? id;
  return (
    <View testID={testID}>
      <Txt kind="micro" weight={600} color="ink3" style={styles.label}>
        {t('muhurat.activity')}
      </Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityRole="radiogroup" accessibilityLabel={t('muhurat.activity')} testID="activity-chip-row">
        {row.map((id) => (
          <Chip key={id} label={name(id)} selected={id === selected} onPress={() => onSelect(id)} testID={`activity-chip-${id}`} />
        ))}
        <Chip label={t('muhurat.allActivities_chip', { count: ACTIVITIES.length })} selected={false} onPress={() => setOpen(true)} accessibilityLabel={t('muhurat.allActivities_chip')} testID="activity-chip-all" />
      </ScrollView>
      <Sheet visible={open} onClose={() => setOpen(false)} title={t('muhurat.allActivities_chip')}>
        <View testID="activity-sheet">
          {ACTIVITIES.map((a, i) => (
            <RadioRow
              key={a.id}
              title={a.names[lang]}
              selected={a.id === selected}
              onPress={() => {
                onSelect(a.id);
                setOpen(false);
              }}
              divider={i < ACTIVITIES.length - 1}
              testID={`activity-sheet-${a.id}`}
            />
          ))}
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  row: { gap: 8, paddingRight: 16 },
});
