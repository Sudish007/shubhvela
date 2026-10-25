// Tag (design.md 2.3 / 6): 12 sp text, radius 4. Variants: dignity (neutral fill), approx (indigo outline, the
// honesty marker for uncertain values), kind (hairline outline, e.g. "Pro", event kinds). ApproxTag is the single
// owner of the "approx." wording so a screen cannot invent a different marker.
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useLang } from '../i18n';
import { useTokens } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';
import { Txt } from './Txt';

export type TagVariant = 'dignity' | 'approx' | 'kind';

export interface TagProps {
  variant?: TagVariant;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function Tag({ variant = 'kind', children, style, accessibilityLabel }: TagProps) {
  const { colors } = useTokens();
  const box: ViewStyle =
    variant === 'approx'
      ? { borderColor: colors.indigo, borderWidth: 1, backgroundColor: 'transparent' }
      : variant === 'dignity'
        ? { backgroundColor: colors.neutral, borderColor: colors.neutral, borderWidth: 1 }
        : { borderColor: colors.hair2, borderWidth: 1, backgroundColor: 'transparent' };
  return (
    <View accessibilityLabel={accessibilityLabel} style={[styles.tag, box, style]}>
      <Txt kind="micro" weight={600} color={variant === 'approx' ? 'indigo' : 'ink2'}>
        {children}
      </Txt>
    </View>
  );
}

export interface ApproxTagProps {
  /** When given, reads "approx. ±N min" (birth time declared approximate); otherwise plain "approx.". */
  minutes?: number;
  style?: StyleProp<ViewStyle>;
}

export function ApproxTag({ minutes, style }: ApproxTagProps) {
  const { t } = useLang();
  const label = minutes ? t('common.approxMinutes', { minutes }) : t('common.approx');
  return (
    <Tag variant="approx" style={style} accessibilityLabel={label}>
      {label}
    </Tag>
  );
}

const styles = StyleSheet.create({
  tag: {
    borderRadius: radius.tag,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
});
