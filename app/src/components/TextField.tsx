// Labelled text input: 44 dp minimum, surface fill, hair2 border (indigo when focused = focus ring token), inline
// error under the field (design.md 11 validation). The hint line shows resolved values (e.g. zone and offset).
import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useLang } from '../i18n';
import { useTokens } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';
import { textStyle } from '../theme/typography';
import { Txt } from './Txt';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string | null;
  hint?: string | null;
  /** Digits / Latin content (coordinates, times): Noto Sans tabular regardless of UI language. */
  numeric?: boolean;
}

export function TextField({ label, error, hint, numeric, ...input }: TextFieldProps) {
  const { colors } = useTokens();
  const { lang } = useLang();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.accent : focused ? colors.indigo : colors.hair2;
  return (
    <View style={styles.wrap}>
      <Txt kind="label" color="ink2" weight={400} style={styles.label}>
        {label}
      </Txt>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.ink3}
        {...input}
        onFocus={(e) => {
          setFocused(true);
          input.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          input.onBlur?.(e);
        }}
        style={[
          styles.input,
          textStyle('body', lang, { latin: numeric, tabular: numeric }),
          { color: colors.ink, backgroundColor: colors.surface, borderColor, borderWidth: focused ? 2 : 1 },
        ]}
      />
      {error ? (
        <Txt kind="caption" color="accent" accessibilityLiveRegion="polite">
          {error}
        </Txt>
      ) : hint ? (
        <Txt kind="caption" color="ink3">
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  label: {},
  input: { minHeight: 44, borderRadius: radius.button, paddingHorizontal: 12, paddingVertical: 8 },
});
