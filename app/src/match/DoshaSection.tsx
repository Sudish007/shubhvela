// Dosha section (design.md 10.6 F29): Nadi and Bhakoot rows with their exceptions NAMED (lifted / named-not-scored /
// scored 0 on the same nakshatra-pada), then Mangal dosha for each person: the status row (present + effective /
// cancelled / not present) with the Mars-from-reference lines, and every cancellation rule as its own row with an
// "applies" / "not applied" tag and a Why? carrying the corpus text. The mutual-cancellation row closes the section.
// Wording is the state of a rule - never a warning about a person (build-rules: cancellations shown, no fear copy).
import { lookup } from '@shubhvela/content';
import type { AshtakootaResult, MangalCancellation, MangalDoshaReport, MangalPairReport } from '@shubhvela/engine';
import { StyleSheet, View } from 'react-native';
import { Row } from '../components/Row';
import { ApproxTag, Tag } from '../components/Tag';
import { Txt } from '../components/Txt';
import { useLang, type TFn } from '../i18n';
import { planetName, signName } from '../today/format';
import type { ResolvedSide } from './model';

export interface DoshaSectionProps {
  guna: AshtakootaResult;
  mangal: MangalPairReport;
  a: ResolvedSide;
  b: ResolvedSide;
  /** 1 (free) or 3 (Pro): depth of the Why? explanation. */
  level: 1 | 3;
  testID?: string;
}

/** Status word of a Mangal report: not present / present · effective / present · cancelled. */
export function mangalStatus(r: MangalDoshaReport, t: TFn): string {
  if (!r.present) return t('match.mangalNone');
  return `${t('match.mangalPresent')} · ${t(r.effective ? 'match.mangalEffective' : 'match.mangalCancelled')}`;
}

/** Nadi row text + the exception name when one lifted the dosha. */
export function nadiText(guna: AshtakootaResult, t: TFn): string {
  const nadi = guna.kootas.find((k) => k.id === 'nadi')!;
  if (guna.nadiException) return `${t('match.nadiDosha')}: ${t('match.doshaLifted', { rule: t(`match.exception.${guna.nadiException}`) })}`;
  return `${t('match.nadiDosha')}: ${t(nadi.detail.dosha ? 'match.doshaPresent' : 'match.doshaNone')}`;
}

/** Bhakoot row text: present (+ the same-lord exception named, not scored) / scored 0 on same nakshatra-pada / none. */
export function bhakootText(guna: AshtakootaResult, t: TFn): string {
  const bk = guna.kootas.find((k) => k.id === 'bhakoot')!;
  if (bk.detail.dosha) {
    const base = `${t('match.bhakootDosha')}: ${t('match.doshaPresent')}`;
    return guna.bhakootNote ? `${base} · ${t('match.doshaNoted', { rule: t(`match.exception.${guna.bhakootNote}`) })}` : base;
  }
  if (guna.bhakootException) return `${t('match.bhakootDosha')}: ${t('match.doshaPresent')} · ${t(`match.exception.${guna.bhakootException}`)}`;
  return `${t('match.bhakootDosha')}: ${t('match.doshaNone')}`;
}

function CancellationRow({ c, level, divider, testID }: { c: MangalCancellation; level: 1 | 3; divider: boolean; testID: string }) {
  const { t, lang } = useLang();
  const name = t(`match.cancel.${c.ruleId}`);
  const text = `${name} · ${t(c.applies ? 'match.applies_tag' : 'match.notApplied_tag')}`;
  const explanation = c.applies ? lookup('mangal', c.ruleId, lang)?.text : undefined;
  const inputs: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(c.detail)) inputs[k] = v;
  return (
    <Row ruleId={c.ruleId} text={text} inputs={inputs} explanation={level === 3 ? explanation : undefined} explanationTitle={t('match.fullExplanation')} divider={divider} testID={testID}>
      <View style={styles.cancelHead}>
        <Txt kind="body" style={styles.flex}>
          {name}
        </Txt>
        <Tag variant={c.applies ? 'dignity' : 'kind'} accessibilityLabel={t(c.applies ? 'match.applies_tag' : 'match.notApplied_tag')}>
          {t(c.applies ? 'match.applies_tag' : 'match.notApplied_tag')}
        </Tag>
      </View>
    </Row>
  );
}

function MangalBlock({ side, report, level, testID }: { side: ResolvedSide; report: MangalDoshaReport; level: 1 | 3; testID: string }) {
  const { t, lang } = useLang();
  const refs = report.references.filter((r) => r.dosha).map((r) => t('match.mangalRefs', { house: r.house, reference: t(`match.ref.${r.from}`) }));
  const explanation = lookup('mangal', report.present ? 'mangal-dosha' : 'mangal-dosha-none', lang)?.text;
  return (
    <View testID={testID} style={styles.block}>
      <Txt kind="label" weight={600} accessibilityRole="header">
        {t('match.mangalFor', { name: side.label })}
      </Txt>
      <Row
        ruleId={report.ruleId}
        text={`${t('match.mangal')}: ${mangalStatus(report, t)}`}
        inputs={{
          [planetName(lang, 'Ma')]: signName(lang, report.marsSign),
          [t('match.ref.lagna')]: report.fromLagna ? t('match.mangalRefs', { house: report.fromLagna.house, reference: t('match.ref.lagna') }) : t('common.unknown'),
          [t('match.ref.moon')]: t('match.mangalRefs', { house: report.fromMoon.house, reference: t('match.ref.moon') }),
          [t('match.ref.venus')]: t('match.mangalRefs', { house: report.fromVenus.house, reference: t('match.ref.venus') }),
        }}
        explanation={level === 3 ? explanation : undefined}
        explanationTitle={t('match.fullExplanation')}
        testID={`${testID}-status`}
      >
        <View style={styles.statusHead}>
          <Txt kind="body" weight={600} style={styles.flex}>
            {`${t('match.mangal')}: ${mangalStatus(report, t)}`}
          </Txt>
          {report.lagnaUnknown ? <ApproxTag /> : null}
        </View>
        {refs.map((line, i) => (
          <Txt key={i} kind="caption" color="ink2" testID={`${testID}-ref-${i}`}>
            {line}
          </Txt>
        ))}
        {report.lagnaUnknown ? (
          <Txt kind="caption" color="ink3">
            {t('match.lagnaUnknownNote', { name: side.label })}
          </Txt>
        ) : null}
      </Row>
      {report.present ? (
        <>
          <Txt kind="micro" weight={600} color="ink3" style={styles.subhead}>
            {t('match.cancellations')}
          </Txt>
          {report.cancellations.map((c, i) => (
            <CancellationRow key={c.ruleId} c={c} level={level} divider={i < report.cancellations.length - 1} testID={`${testID}-${c.ruleId}`} />
          ))}
        </>
      ) : null}
    </View>
  );
}

export function DoshaSection({ guna, mangal, a, b, level, testID }: DoshaSectionProps) {
  const { t, lang } = useLang();
  const nadi = guna.kootas.find((k) => k.id === 'nadi')!;
  const bk = guna.kootas.find((k) => k.id === 'bhakoot')!;
  const nadiExplanation = guna.nadiException ? lookup('koota', guna.nadiException, lang)?.text : undefined;
  const bkExplanation = guna.bhakootNote ? lookup('koota', guna.bhakootNote, lang)?.text : guna.bhakootException ? lookup('koota', guna.bhakootException, lang)?.text : undefined;
  return (
    <View testID={testID} style={styles.section}>
      <Txt kind="heading" accessibilityRole="header">
        {t('match.doshas')}
      </Txt>
      <Row ruleId={guna.nadiException ?? 'koota-nadi'} inputs={{ [a.label]: t(`match.nadi.${nadi.a}`), [b.label]: t(`match.nadi.${nadi.b}`) }} explanation={level === 3 ? nadiExplanation : undefined} explanationTitle={t('match.fullExplanation')} testID="dosha-nadi">
        {nadiText(guna, t)}
      </Row>
      <Row
        ruleId={guna.bhakootNote ?? guna.bhakootException ?? 'koota-bhakoot'}
        inputs={{ [a.label]: signName(lang, Number(bk.a)), [b.label]: signName(lang, Number(bk.b)), [t('match.koota.bhakoot')]: String(bk.detail.distance) }}
        explanation={level === 3 ? bkExplanation : undefined}
        explanationTitle={t('match.fullExplanation')}
        testID="dosha-bhakoot"
      >
        {bhakootText(guna, t)}
      </Row>
      <MangalBlock side={a} report={mangal.a} level={level} testID="mangal-a" />
      <MangalBlock side={b} report={mangal.b} level={level} testID="mangal-b" />
      {mangal.a.present || mangal.b.present ? <CancellationRow c={mangal.bothManglik} level={level} divider={false} testID="mangal-both" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 4 },
  block: { marginTop: 8, gap: 2 },
  subhead: { marginTop: 6 },
  statusHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  cancelHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  flex: { flexShrink: 1 },
});
