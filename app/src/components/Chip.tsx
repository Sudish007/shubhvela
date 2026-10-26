// Chip (design.md 2.1 / 8): pill with a 44 dp box; selected = accentTint fill + 2 px accent underline (never colour
// alone); accessibilityState.selected. Labels wrap to two lines instead of truncating (design.md 7). B04: an optional
// leading icon (the lock of "14 more vargas") and a micro caption under the label ("till 10:58 tomorrow").
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';
import { Pressable44 } from './Pressable44';
import { Txt } from './Txt';

export interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  /** Leading 18 dp icon (e.g. LockIcon) drawn before the label. */
  icon?: ReactNode;
  /** Second line in micro type under the label (the unlock expiry of design.md 10.3 F12). */
  caption?: string;
  testID?: string;
}

export function Chip({ label, selected, onPress, accessibilityLabel, icon, caption, testID }: ChipProps) {
  const { colors } = useTokens();
  return (
    <Pressable44
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (caption ? `${label}, ${caption}` : label)}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, { borderColor: selected ? colors.accent : colors.hair2, backgroundColor: selected ? colors.accentTint : colors.surface }]}
    >
      <View style={styles.inner}>
        <View style={styles.labelRow}>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          <Txt kind="label" weight={600} color={selected ? 'accent' : 'ink'} style={styles.label}>
            {label}
          </Txt>
        </View>
        {caption ? (
          <Txt kind="micro" color={selected ? 'accent' : 'ink2'} latin tabular style={styles.caption}>
            {caption}
          </Txt>
        ) : null}
        <View style={[styles.underline, { backgroundColor: selected ? colors.accent : 'transparent' }]} />
      </View>
    </Pressable44>
  );
}

const styles = StyleSheet.create({
  chip: { borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 4 },
  inner: { alignItems: 'center' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  icon: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  label: { textAlign: 'center', maxWidth: 180 },
  caption: { textAlign: 'center', maxWidth: 180 },
  underline: { height: 2, alignSelf: 'stretch', marginTop: 2, borderRadius: 1 },
});
