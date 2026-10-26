// Row (design.md 10, 11): the interpretive row used everywhere = text column + 44 dp control column. `ruleId` is a
// REQUIRED prop (TypeScript refuses a Row without one, see test/row-ruleid.test.tsx), so no screen can render an
// interpretive sentence without its "Why?". The control column renders the WhyButton unless a custom control is given.
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';
import { Txt } from './Txt';
import { WhyButton, type WhyInputValue } from './WhySheet';

export interface RowProps {
  /** Engine rule id behind this sentence; required by design (honesty marker owner). */
  ruleId: string;
  /** The sentence (string) or richer content (Num/NoBreak runs). */
  children: ReactNode;
  /** Plain-text form of the sentence for the Why? accessible name and sheet title; required when children is not a string. */
  text?: string;
  /** Inputs the rule used, shown in the Why? sheet with their values. */
  inputs?: Record<string, WhyInputValue>;
  glossary?: readonly string[];
  /** Longer corpus explanation for the Why? sheet (koota level text, Mangal cancellation text). */
  explanation?: string;
  explanationTitle?: string;
  /** Second line (caption) under the sentence, e.g. a tag or a time range. */
  caption?: ReactNode;
  /** Replaces the Why? control (e.g. a Switch); the rule id is still required and still reaches the sheet via `whyToo`. */
  control?: ReactNode;
  /** Draw the hairline divider under the row (default true). */
  divider?: boolean;
  testID?: string;
}

export function Row({ ruleId, children, text, inputs, glossary, explanation, explanationTitle, caption, control, divider = true, testID }: RowProps) {
  const { colors } = useTokens();
  const rowText = text ?? (typeof children === 'string' ? children : undefined);
  return (
    <View testID={testID} style={[styles.row, divider && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hair }]}>
      <View style={styles.text}>
        {typeof children === 'string' ? <Txt kind="body">{children}</Txt> : children}
        {caption ? <View style={styles.caption}>{caption}</View> : null}
      </View>
      <View style={styles.control}>
        {control ?? <WhyButton ruleId={ruleId} inputs={inputs} glossary={glossary} explanation={explanation} explanationTitle={explanationTitle} rowText={rowText} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8 },
  text: { flex: 1, minWidth: 0, paddingTop: 2 },
  caption: { marginTop: 4, flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  control: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'flex-end' },
});
