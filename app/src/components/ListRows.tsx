// Non-interpretive list rows (Settings and editors): NavRow (title, value, chevron -> route), RadioRow (filled dot +
// 2 px border when selected, design.md 8), SwitchRow (title + Switch). None of these carry a ruleId because they
// are controls, not sentences; interpretive text always goes through Row.
import { StyleSheet, View } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';
import { ChevronIcon } from './icons';
import { Pressable44 } from './Pressable44';
import { Switch } from './Switch';
import { Txt } from './Txt';

export interface NavRowProps {
  title: string;
  value?: string;
  caption?: string;
  onPress: () => void;
  divider?: boolean;
  testID?: string;
}

export function NavRow({ title, value, caption, onPress, divider = true, testID }: NavRowProps) {
  const { colors } = useTokens();
  return (
    <Pressable44
      testID={testID}
      accessibilityLabel={value ? `${title}, ${value}` : title}
      onPress={onPress}
      style={[styles.row, divider && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hair }]}
    >
      <View style={styles.text}>
        <Txt kind="label" weight={400}>
          {title}
        </Txt>
        {caption ? (
          <Txt kind="caption" color="ink3">
            {caption}
          </Txt>
        ) : null}
      </View>
      {value ? (
        <Txt kind="label" weight={400} color="ink2" style={styles.value}>
          {value}
        </Txt>
      ) : null}
      <ChevronIcon color={colors.ink3} />
    </Pressable44>
  );
}

export interface RadioRowProps {
  title: string;
  caption?: string;
  selected: boolean;
  onPress: () => void;
  divider?: boolean;
  testID?: string;
}

export function RadioRow({ title, caption, selected, onPress, divider = true, testID }: RadioRowProps) {
  const { colors } = useTokens();
  return (
    <Pressable44
      testID={testID}
      accessibilityRole="radio"
      accessibilityLabel={title}
      accessibilityState={{ selected, checked: selected }}
      onPress={onPress}
      style={[styles.row, divider && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hair }]}
    >
      <View style={[styles.radio, { borderColor: selected ? colors.accent : colors.hair2, borderWidth: selected ? 2 : 1 }]}>
        {selected ? <View style={[styles.radioDot, { backgroundColor: colors.accent }]} /> : null}
      </View>
      <View style={styles.text}>
        <Txt kind="label" weight={selected ? 600 : 400} color={selected ? 'accent' : 'ink'}>
          {title}
        </Txt>
        {caption ? (
          <Txt kind="caption" color="ink3">
            {caption}
          </Txt>
        ) : null}
      </View>
    </Pressable44>
  );
}

export interface SwitchRowProps {
  title: string;
  caption?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  divider?: boolean;
  testID?: string;
}

export function SwitchRow({ title, caption, value, onValueChange, disabled, divider = true, testID }: SwitchRowProps) {
  const { colors } = useTokens();
  return (
    <View style={[styles.row, divider && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hair }]}>
      <View style={styles.text}>
        <Txt kind="label" weight={400}>
          {title}
        </Txt>
        {caption ? (
          <Txt kind="caption" color="ink3">
            {caption}
          </Txt>
        ) : null}
      </View>
      <Switch testID={testID} value={value} onValueChange={onValueChange} accessibilityLabel={title} disabled={disabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Rows live inside flush Cards (edge-to-edge dividers), so they carry the 16 dp card padding themselves.
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 16, alignSelf: 'stretch', justifyContent: 'flex-start' },
  text: { flex: 1, minWidth: 0, gap: 2 },
  value: { flexShrink: 1, textAlign: 'right' },
  radio: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
});
