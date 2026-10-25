// Segmented control (design.md 8): a radiogroup of 44 dp segments; the selected one has a fill AND a 2 px underline;
// each segment exposes accessibilityRole radio + state {selected, checked}. Used for approx 15/30/60 (N11), tradition,
// PDF language, chart style and the F19 options.
import { StyleSheet, View } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';
import { Pressable44 } from './Pressable44';
import { Txt } from './Txt';

export interface SegmentOption<V extends string | number> {
  value: V;
  label: string;
  accessibilityLabel?: string;
}

export interface SegmentedProps<V extends string | number> {
  options: readonly SegmentOption<V>[];
  value: V;
  onChange: (v: V) => void;
  accessibilityLabel: string;
  disabled?: boolean;
  testID?: string;
}

export function Segmented<V extends string | number>({ options, value, onChange, accessibilityLabel, disabled, testID }: SegmentedProps<V>) {
  const { colors } = useTokens();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} testID={testID} style={[styles.group, { borderColor: colors.hair2, backgroundColor: colors.surface }]}>
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <Pressable44
            key={String(o.value)}
            accessibilityRole="radio"
            accessibilityLabel={o.accessibilityLabel ?? o.label}
            accessibilityState={{ selected, checked: selected }}
            disabled={disabled}
            onPress={() => onChange(o.value)}
            style={[
              styles.segment,
              i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.hair2 },
              selected && { backgroundColor: colors.accentTint },
            ]}
          >
            <View style={styles.inner}>
              <Txt kind="label" weight={600} color={selected ? 'accent' : 'ink'} style={styles.label}>
                {o.label}
              </Txt>
              <View style={[styles.underline, { backgroundColor: selected ? colors.accent : 'transparent' }]} />
            </View>
          </Pressable44>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.button, overflow: 'hidden' },
  segment: { flex: 1, paddingHorizontal: 8, paddingVertical: 4 },
  inner: { alignItems: 'center', alignSelf: 'stretch' },
  label: { textAlign: 'center' },
  underline: { height: 2, alignSelf: 'stretch', marginTop: 2, borderRadius: 1 },
});
