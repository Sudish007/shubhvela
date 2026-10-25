// Buttons: PrimaryButton = 48 dp accent CTA (design.md 2.3); SecondaryButton = 44 dp outlined; TextButton = 44 dp
// accent text (the "Why?" look). All report disabled through accessibilityState and dim visibly.
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';
import { radius, size } from '../theme/tokens';
import { Pressable44 } from './Pressable44';
import { Txt } from './Txt';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function PrimaryButton({ label, onPress, disabled, accessibilityLabel, style, testID }: ButtonProps) {
  const { colors } = useTokens();
  return (
    <Pressable44
      testID={testID}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      disabled={disabled}
      style={[styles.primary, { backgroundColor: colors.accent }, disabled && styles.disabled, style]}
      pressedStyle={styles.pressed}
    >
      <Txt kind="label" weight={600} color="accentInk" style={styles.center}>
        {label}
      </Txt>
    </Pressable44>
  );
}

export function SecondaryButton({ label, onPress, disabled, accessibilityLabel, style, testID }: ButtonProps) {
  const { colors } = useTokens();
  return (
    <Pressable44
      testID={testID}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      disabled={disabled}
      style={[styles.secondary, { borderColor: colors.hair2, backgroundColor: colors.surface }, disabled && styles.disabled, style]}
    >
      <Txt kind="label" weight={600} color="ink" style={styles.center}>
        {label}
      </Txt>
    </Pressable44>
  );
}

export function TextButton({ label, onPress, disabled, accessibilityLabel, style, testID }: ButtonProps) {
  return (
    <Pressable44 testID={testID} accessibilityLabel={accessibilityLabel ?? label} onPress={onPress} disabled={disabled} style={[styles.text, disabled && styles.disabled, style]}>
      <Txt kind="label" weight={600} color="accent" style={styles.center}>
        {label}
      </Txt>
    </Pressable44>
  );
}

const styles = StyleSheet.create({
  primary: { minHeight: size.primaryCta, borderRadius: radius.button, paddingHorizontal: 20, paddingVertical: 10, alignSelf: 'stretch' },
  secondary: { borderRadius: radius.button, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 8, alignSelf: 'stretch' },
  text: { paddingHorizontal: 12 },
  center: { textAlign: 'center' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
});
