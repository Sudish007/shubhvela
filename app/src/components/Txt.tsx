// The text primitive every component uses: type-scale entry + colour token + language-aware font family.
// Sizes come from tokens only (12 sp floor is enforced by the token generator); allowFontScaling stays on (1.3x rule).
import type { ReactNode } from 'react';
import { Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { useLang } from '../i18n';
import { useTokens } from '../theme/ThemeProvider';
import type { ColorToken, TypeStyleName } from '../theme/tokens';
import { textStyle, type Weight } from '../theme/typography';

export interface TxtProps extends Omit<TextProps, 'style'> {
  kind?: TypeStyleName;
  color?: ColorToken;
  weight?: Weight;
  /** Force Noto Sans (Latin/digit run); see Num / Latin. */
  latin?: boolean;
  tabular?: boolean;
  style?: StyleProp<TextStyle>;
  children?: ReactNode;
}

export function Txt({ kind = 'body', color = 'ink', weight, latin, tabular, style, children, ...rest }: TxtProps) {
  const { lang } = useLang();
  const { colors } = useTokens();
  return (
    <Text {...rest} style={[textStyle(kind, lang, { weight, latin, tabular }), { color: colors[color] }, style]}>
      {children}
    </Text>
  );
}
