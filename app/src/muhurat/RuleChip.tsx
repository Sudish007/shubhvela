// RuleChip (F26, design.md 10.5 / muhurat.html .rule): one per scored rule. Met = tick icon + accent border + accent
// text; not met = cross icon + dashed hairline border + ink3 text, so the state never rests on colour alone. Text only
// (13 sp caption); the window's Why? carries the rule table, so the chip itself is not a control.
import type { MuhuratRule } from '@shubhvela/engine';
import { StyleSheet, View } from 'react-native';
import { CheckIcon, CrossIcon } from '../components/icons';
import { Txt } from '../components/Txt';
import { useLang } from '../i18n';
import { useTokens } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';

export interface RuleChipProps {
  rule: Pick<MuhuratRule, 'id' | 'met'>;
  /** Display label (rule name + detail, from model.ruleChipLabel). */
  label: string;
  testID?: string;
}

export function RuleChip({ rule, label, testID }: RuleChipProps) {
  const { t } = useLang();
  const { colors } = useTokens();
  const met = rule.met;
  const color = met ? colors.accent : colors.ink3;
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={t('muhurat.ruleChipA11y', { rule: label, state: t(met ? 'muhurat.ruleMet_tag' : 'muhurat.ruleNotMet_tag') })}
      style={[styles.chip, { borderColor: met ? colors.accent : colors.hair2, borderStyle: met ? 'solid' : 'dashed' }]}
    >
      {met ? <CheckIcon color={color} size={14} /> : <CrossIcon color={color} size={14} />}
      <Txt kind="caption" color={met ? 'accent' : 'ink3'} style={styles.label}>
        {label}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: radius.button, paddingHorizontal: 8, paddingVertical: 3 },
  label: { flexShrink: 1 },
});
