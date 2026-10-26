// ForField (F26, design.md 10.5 "For field (profile; two profiles for marriage/engagement)"): a 48 dp field showing the
// chosen profile name(s); tapping opens a sheet of radio rows (one per profile). Activities with `profiles: 2` show two
// fields (A and B) so both natal Moons enter the Chandra bala / Tara bala rules.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ChevronIcon } from '../components/icons';
import { RadioRow } from '../components/ListRows';
import { Pressable44 } from '../components/Pressable44';
import { Sheet } from '../components/Sheet';
import { Txt } from '../components/Txt';
import type { Profile } from '../db/profiles';
import { useLang, type TFn } from '../i18n';
import { useTokens } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';

export interface ForFieldProps {
  profiles: readonly Profile[];
  /** One id, or two for marriage / engagement (null = not chosen yet). */
  selected: readonly (number | null)[];
  onChange: (ids: (number | null)[]) => void;
  testID?: string;
}

/** Display name of a profile row: its name, else its relationship word. */
export function profileLabel(p: Profile, t: TFn): string {
  return p.name?.trim() ? p.name : t(`family.relation.${p.relationship}`);
}

export function ForField({ profiles, selected, onChange, testID }: ForFieldProps) {
  const { t } = useLang();
  const { colors } = useTokens();
  const [openSlot, setOpenSlot] = useState<number | null>(null);
  const two = selected.length === 2;
  const nameOf = (id: number | null): string => {
    const p = id === null ? null : profiles.find((x) => x.id === id);
    return p ? profileLabel(p, t) : t('muhurat.pickProfile');
  };
  return (
    <View testID={testID}>
      <Txt kind="micro" weight={600} color="ink3" style={styles.label}>
        {two ? t('muhurat.forTwo') : t('muhurat.for')}
      </Txt>
      <View style={styles.pair}>
        {selected.map((id, slot) => (
          <Pressable44
            key={slot}
            accessibilityLabel={`${two ? t('muhurat.forTwo') : t('muhurat.for')}: ${nameOf(id)}`}
            onPress={() => setOpenSlot(slot)}
            style={[styles.field, styles.flex, { borderColor: colors.hair2, backgroundColor: colors.surface }]}
            testID={`for-field-${slot}`}
          >
            <Txt kind="label" weight={400} style={styles.flex}>
              {nameOf(id)}
            </Txt>
            <ChevronIcon color={colors.ink2} size={20} />
          </Pressable44>
        ))}
      </View>
      <Sheet visible={openSlot !== null} onClose={() => setOpenSlot(null)} title={two ? t('muhurat.forTwo') : t('muhurat.for')}>
        <View testID="for-sheet">
          {profiles.map((p, i) => (
            <RadioRow
              key={p.id}
              title={profileLabel(p, t)}
              caption={p.placeName}
              selected={openSlot !== null && selected[openSlot] === p.id}
              onPress={() => {
                if (openSlot === null) return;
                const next = [...selected];
                next[openSlot] = p.id;
                onChange(next);
                setOpenSlot(null);
              }}
              divider={i < profiles.length - 1}
              testID={`for-profile-${p.id}`}
            />
          ))}
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  pair: { flexDirection: 'row', gap: 8 },
  field: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderRadius: radius.button },
  flex: { flex: 1, minWidth: 0 },
});
