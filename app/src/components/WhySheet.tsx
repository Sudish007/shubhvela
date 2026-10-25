// WhyButton + WhySheet (design.md 6): the 44 dp "Why?" text control at the right of every interpretive row opens a
// sheet with the rule in one sentence (corpus/rules by ruleId), the inputs used with their values, the classical
// source name when the corpus has one, and glossary one-liners for the Sanskrit terms (links become navigation in C03).
import { glossaryTerm, ruleText, type GlossaryEntry } from '@shubhvela/content';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLang } from '../i18n';
import { useTokens } from '../theme/ThemeProvider';
import { Pressable44 } from './Pressable44';
import { Sheet } from './Sheet';
import { Txt } from './Txt';

export type WhyInputValue = string | number | boolean | null | undefined;

export interface WhyProps {
  /** Engine rule id (RULE_IDS); the corpus has one sentence + source per id. */
  ruleId: string;
  /** The inputs the rule used, with their values, in display form. */
  inputs?: Record<string, WhyInputValue>;
  /** Extra glossary ids to show besides the ones derived from the rule id. */
  glossary?: readonly string[];
  /** Sheet title; defaults to the row sentence when given, else "Why?". */
  title?: string;
}

/** Glossary ids worth showing for a rule id: the id itself and its hyphen-prefixes (rahu-kaal, sade-sati-phase-1 -> sade-sati). */
export function glossaryIdsFor(ruleId: string, extra: readonly string[] = []): string[] {
  const parts = ruleId.split('-');
  const ids = new Set<string>(extra);
  for (let n = parts.length; n >= 1; n--) ids.add(parts.slice(0, n).join('-'));
  return [...ids];
}

export function WhySheet({ ruleId, inputs, glossary, title, visible, onClose }: WhyProps & { visible: boolean; onClose: () => void }) {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  const rule = ruleText(ruleId, lang);
  const terms = glossaryIdsFor(ruleId, glossary)
    .map((id) => glossaryTerm(id, lang)?.item)
    .filter((g): g is GlossaryEntry => !!g);
  const inputEntries = Object.entries(inputs ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return (
    <Sheet visible={visible} onClose={onClose} title={title ?? t('common.why')}>
      <View style={styles.section}>
        <Txt kind="micro" weight={600} color="ink3">
          {t('common.rule')}
        </Txt>
        <Txt kind="body">{rule?.text ?? ruleId}</Txt>
        {rule && rule.fallback ? (
          <Txt kind="caption" color="ink3">
            {t(`settings.lang.${rule.lang}`)}
          </Txt>
        ) : null}
      </View>
      {inputEntries.length ? (
        <View style={styles.section}>
          <Txt kind="micro" weight={600} color="ink3">
            {t('common.inputs')}
          </Txt>
          {inputEntries.map(([k, v]) => (
            <View key={k} style={[styles.inputRow, { borderColor: colors.hair }]}>
              <Txt kind="label" weight={400} color="ink2" style={styles.inputKey}>
                {k}
              </Txt>
              <Txt kind="label" weight={600} latin tabular style={styles.inputValue}>
                {String(v)}
              </Txt>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.section}>
        <Txt kind="micro" weight={600} color="ink3">
          {t('common.source')}
        </Txt>
        <Txt kind="caption" color="ink2">
          {rule?.snippet.source && rule.snippet.source !== 'convention' ? rule.snippet.source : t('common.sourceConvention')}
        </Txt>
      </View>
      {terms.length ? (
        <View style={styles.section}>
          <Txt kind="micro" weight={600} color="ink3">
            {t('common.glossary')}
          </Txt>
          {terms.map((g) => (
            <Txt key={g.id} kind="caption" color="ink2">
              <Txt kind="caption" weight={600}>
                {g.term_dev}
              </Txt>
              {` (${g.term_lat}) · ${g.meaning}`}
            </Txt>
          ))}
        </View>
      ) : null}
    </Sheet>
  );
}

export interface WhyButtonProps extends WhyProps {
  /** Accessible name: "Why? <row sentence>". */
  rowText?: string;
  testID?: string;
}

export function WhyButton({ rowText, testID, ...why }: WhyButtonProps) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const label = t('common.why');
  return (
    <>
      <Pressable44 testID={testID} accessibilityLabel={rowText ? `${label} ${rowText}` : label} onPress={() => setOpen(true)} style={styles.button}>
        <Txt kind="label" weight={600} color="accent">
          {label}
        </Txt>
      </Pressable44>
      {open ? <WhySheet {...why} title={why.title ?? rowText} visible onClose={() => setOpen(false)} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  section: { gap: 4 },
  inputRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  inputKey: { flexShrink: 1 },
  inputValue: { flexShrink: 1, textAlign: 'right' },
  button: { paddingHorizontal: 8 },
});
