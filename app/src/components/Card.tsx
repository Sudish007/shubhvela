// Card (design.md 2.3): surface on paper with a 1 px hairline, radius 12, padding 16, never a shadow.
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';

export interface CardProps extends ViewProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Remove the inner padding (rows that draw their own dividers edge to edge). */
  flush?: boolean;
}

export function Card({ children, style, flush, ...rest }: CardProps) {
  const { colors } = useTokens();
  return (
    <View {...rest} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hair }, flush && styles.flush, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    padding: 16,
  },
  flush: { padding: 0, overflow: 'hidden' },
});
