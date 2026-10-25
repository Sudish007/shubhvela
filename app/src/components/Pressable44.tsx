// Every tappable thing is at least 44 x 44 dp of VISIBLE box (design.md 2.3: touch slop is never used to reach 44).
// Requires an accessibilityLabel or text children; exposes role and state for TalkBack.
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type AccessibilityRole, type AccessibilityState, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';
import { size } from '../theme/tokens';

export interface Pressable44Props extends Omit<PressableProps, 'style' | 'children'> {
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  style?: StyleProp<ViewStyle>;
  /** Style applied while pressed (default: accentTint fill). */
  pressedStyle?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

export const MIN_CONTROL = size.control;

export function Pressable44({ accessibilityRole = 'button', style, pressedStyle, children, disabled, ...rest }: Pressable44Props) {
  const { colors } = useTokens();
  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      disabled={disabled}
      {...rest}
      accessibilityState={{ disabled: !!disabled, ...rest.accessibilityState }}
      style={({ pressed }) => [styles.base, style, pressed && (pressedStyle ?? { backgroundColor: colors.accentTint })]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minWidth: MIN_CONTROL,
    minHeight: MIN_CONTROL,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
