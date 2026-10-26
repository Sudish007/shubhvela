// Yogas card (F16, design.md 10.3; charts.html "Yogas in this chart · 3 found"): one row per yoga the engine found
// forming or cancelled - name, the one-line rule from the yogas corpus, a state tag "formed" / "cancelled" (the
// cancelling rule in the sub-line) and a 44 dp Why? that opens the full corpus explanation with the rule, the inputs
// (participants and their houses), the classical source and glossary one-liners. Never fear words: "cancelled", never
// "danger". N found = engine.yogas().found (formed yogas only); the checked count is printed too, so the card is
// honest about what was looked for.
import { glossaryTerm, lookup, ruleText, type GlossaryEntry } from '@shubhvela/content';
import type { PlanetId, YogaResult, YogasReport } from '@shubhvela/engine';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card } from '../components/Card';
import { Pressable44 } from '../components/Pressable44';
import { Sheet } from '../components/Sheet';
import { Tag } from '../components/Tag';
import { Txt } from '../components/Txt';
import { glossaryIdsFor } from '../components/WhySheet';
import { useLang, type Lang, type TFn } from '../i18n';
import { useTokens } from '../theme/ThemeProvider';
import { planetName } from './model';

export interface YogasCardProps {
  report: YogasReport;
  testID?: string;
}

/** Localised yoga name (UI strings; the Sanskrit term is the headword in every language). */
export function yogaName(id: string, t: TFn): string {
  return t(`yogas.name.${id}`);
}

/** The one-line rule of a yoga or bhanga id from the yogas corpus (resolved bho -> hi -> en), else the rules corpus. */
export function yogaRule(ruleId: string, lang: Lang): string | null {
  return lookup('yogas', ruleId, lang)?.snippet.rule ?? ruleText(ruleId, lang)?.text ?? null;
}

/** Rows the card lists: every yoga whose forming condition holds (formed or cancelled), engine order. */
export function yogaRows(report: YogasReport): YogaResult[] {
  return report.yogas;
}

function YogaSheet({ yoga, onClose }: { yoga: YogaResult; onClose: () => void }) {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  const snippet = lookup('yogas', yoga.ruleId, lang);
  const rule = ruleText(yoga.ruleId, lang);
  const bhanga = yoga.cancelledBy ? lookup('yogas', yoga.cancelledBy, lang) : null;
  const terms = glossaryIdsFor(yoga.ruleId, ['yoga', ...(yoga.cancelledBy ? [yoga.cancelledBy] : [])])
    .map((id) => glossaryTerm(id, lang)?.item)
    .filter((g): g is GlossaryEntry => !!g);
  const inputs: [string, string][] = [
    [t('kp.planets'), yoga.participants.map((p: PlanetId) => planetName(lang, p)).join(', ')],
    [t('charts.houses'), yoga.houses.join(', ')],
  ];
  return (
    <Sheet visible onClose={onClose} title={yogaName(yoga.id, t)}>
      <View style={styles.sheetHead}>
        <Tag>{yoga.formed ? t('yogas.formed_tag') : t('yogas.cancelled_tag')}</Tag>
        {yoga.fromMoonChart ? (
          <Txt kind="caption" color="ink3">
            {t('yogas.fromMoon')}
          </Txt>
        ) : null}
      </View>
      <Txt kind="body" testID="yoga-sheet-text">
        {snippet?.text ?? rule?.text ?? yoga.ruleId}
      </Txt>
      {snippet?.fallback ? (
        <Txt kind="caption" color="ink3">
          {t(`settings.lang.${snippet.lang}`)}
        </Txt>
      ) : null}
      <View style={styles.section}>
        <Txt kind="micro" weight={600} color="ink3">
          {t('common.rule')}
        </Txt>
        <Txt kind="caption">{snippet?.snippet.rule ?? rule?.text ?? yoga.ruleId}</Txt>
        {bhanga ? (
          <Txt kind="caption" color="ink2">
            {t('yogas.cancelledBy', { rule: bhanga.snippet.rule })}
          </Txt>
        ) : null}
      </View>
      <View style={styles.section}>
        <Txt kind="micro" weight={600} color="ink3">
          {t('common.inputs')}
        </Txt>
        {inputs.map(([k, v]) => (
          <View key={k} style={[styles.inputRow, { borderColor: colors.hair }]}>
            <Txt kind="label" weight={400} color="ink2">
              {k}
            </Txt>
            <Txt kind="label" weight={600} latin tabular style={styles.inputValue}>
              {v}
            </Txt>
          </View>
        ))}
      </View>
      <View style={styles.section}>
        <Txt kind="micro" weight={600} color="ink3">
          {t('common.source')}
        </Txt>
        <Txt kind="caption" color="ink2">
          {(snippet?.snippet.source && snippet.snippet.source !== 'convention' ? snippet.snippet.source : null) ?? rule?.snippet.source ?? t('common.sourceConvention')}
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

export function YogasCard({ report, testID }: YogasCardProps) {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  const [open, setOpen] = useState<YogaResult | null>(null);
  const rows = yogaRows(report);
  return (
    <Card testID={testID}>
      <View style={styles.head}>
        <Txt kind="heading" accessibilityRole="header" style={styles.title}>
          {t('yogas.title')}
        </Txt>
        <Txt kind="caption" color="ink2" testID="yogas-found">
          {t('yogas.found', { count: report.found })}
        </Txt>
      </View>
      {rows.length === 0 ? (
        <Txt kind="body" color="ink2" testID="yogas-none">
          {t('yogas.none', { checked: report.checked.length })}
        </Txt>
      ) : (
        rows.map((y, i) => {
          const rule = yogaRule(y.ruleId, lang);
          const bhanga = y.cancelledBy ? yogaRule(y.cancelledBy, lang) : null;
          const state = y.formed ? t('yogas.formed_tag') : t('yogas.cancelled_tag');
          return (
            <View key={y.id} style={[styles.row, i < rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hair }]} testID={`yoga-row-${y.id}`}>
              <View style={styles.text}>
                <View style={styles.nameRow}>
                  <Txt kind="body" weight={600}>
                    {yogaName(y.id, t)}
                  </Txt>
                  <View testID={`yoga-state-${y.id}`}>
                    <Tag accessibilityLabel={state}>{state}</Tag>
                  </View>
                </View>
                {rule ? (
                  <Txt kind="caption" color="ink2">
                    {rule}
                  </Txt>
                ) : null}
                {bhanga ? (
                  <Txt kind="caption" color="ink3" testID={`yoga-cancelled-${y.id}`}>
                    {t('yogas.cancelledBy', { rule: bhanga })}
                  </Txt>
                ) : null}
              </View>
              <Pressable44 accessibilityLabel={`${t('common.why')} ${t('yogas.rowA11y', { name: yogaName(y.id, t), state, rule: rule ?? y.ruleId })}`} onPress={() => setOpen(y)} style={styles.why} testID={`yoga-why-${y.id}`}>
                <Txt kind="label" weight={600} color="accent">
                  {t('common.why')}
                </Txt>
              </Pressable44>
            </View>
          );
        })
      )}
      <Txt kind="caption" color="ink3" style={styles.footer}>
        {`${t('yogas.checked', { count: report.checked.length })} · ${t('yogas.footer')}`}
      </Txt>
      {open ? <YogaSheet yoga={open} onClose={() => setOpen(null)} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8 },
  text: { flex: 1, minWidth: 0, gap: 2, paddingTop: 2 },
  nameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  why: { paddingHorizontal: 8 },
  footer: { marginTop: 8 },
  sheetHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  section: { gap: 4 },
  inputRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  inputValue: { flexShrink: 1, textAlign: 'right' },
});
