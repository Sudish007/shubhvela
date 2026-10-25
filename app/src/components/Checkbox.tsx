// Checkbox row: 44 dp box, tick glyph + label, accessibilityRole checkbox with state.checked (visible in both themes).
import { StyleSheet } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';
import { CheckboxIcon } from './icons';
import { Pressable44 } from './Pressable44';
import { Txt } from './Txt';

export interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  testID?: string;
}

export function Checkbox({ label, checked, onChange, disabled, testID }: CheckboxProps) {
  const { colors } = useTokens();
  return (
    <Pressable44
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={[styles.row, disabled && styles.disabled]}
    >
      <CheckboxIcon color={checked ? colors.accent : colors.ink2} checked={checked} />
      <Txt kind="label" weight={checked ? 600 : 400} color={checked ? 'accent' : 'ink'} style={styles.label}>
        {label}
      </Txt>
    </Pressable44>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch', justifyContent: 'flex-start', paddingVertical: 4 },
  label: { flex: 1, minWidth: 0 },
  disabled: { opacity: 0.5 },
});
