// Chip (design.md 2.1 / 8): pill with a 44 dp box; selected = accentTint fill + 2 px accent underline (never colour
// alone); accessibilityState.selected. Labels wrap to two lines instead of truncating (design.md 7).
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
  testID?: string;
}

export function Chip({ label, selected, onPress, accessibilityLabel, testID }: ChipProps) {
  const { colors } = useTokens();
  return (
    <Pressable44
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, { borderColor: selected ? colors.accent : colors.hair2, backgroundColor: selected ? colors.accentTint : colors.surface }]}
    >
      <View style={styles.inner}>
        <Txt kind="label" weight={600} color={selected ? 'accent' : 'ink'} style={styles.label}>
          {label}
        </Txt>
        <View style={[styles.underline, { backgroundColor: selected ? colors.accent : 'transparent' }]} />
      </View>
    </Pressable44>
  );
}

const styles = StyleSheet.create({
  chip: { borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 4 },
  inner: { alignItems: 'center' },
  label: { textAlign: 'center', maxWidth: 180 },
  underline: { height: 2, alignSelf: 'stretch', marginTop: 2, borderRadius: 1 },
});
