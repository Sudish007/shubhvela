// One koota row (design.md 10.6 F29): name, "x of y" points, the one-line meaning (corpus/koota level 1) and the
// "Why?" whose sheet carries the koota explanation at level 1 on free / level 3 on Pro (spec section 9) plus the rule
// sentence and the two sides' inputs. Points are ink text; nothing is colour-graded.
import { lookup } from '@shubhvela/content';
import type { KootaRow as EngineKootaRow } from '@shubhvela/engine';
import { StyleSheet, View } from 'react-native';
import { Row } from '../components/Row';
import { Txt } from '../components/Txt';
import { Num } from '../components/Num';
import { useLang } from '../i18n';
import { kootaSideText } from './model';

export interface KootaRowProps {
  row: EngineKootaRow;
  /** 1 (free), 2 (free after a lesson unlock, C03) or 3 (Pro). */
  level: 1 | 2 | 3;
  aLabel: string;
  bLabel: string;
  divider?: boolean;
  testID?: string;
}

export function KootaRow({ row, level, aLabel, bLabel, divider = true, testID }: KootaRowProps) {
  const { t, lang } = useLang();
  const name = t(`match.koota.${row.id}`);
  const points = t('match.points', { points: row.points, max: row.max });
  const meaning = lookup('koota', `${row.ruleId}-1`, lang)?.text ?? '';
  const explanation = lookup('koota', `${row.ruleId}-${level}`, lang)?.text ?? meaning;
  const aText = kootaSideText(row, row.a, t, lang);
  const bText = kootaSideText(row, row.b, t, lang);
  const text = `${name} · ${points}`;
  return (
    <Row
      ruleId={row.ruleId}
      text={text}
      inputs={{ [aLabel]: aText, [bLabel]: bText }}
      explanation={explanation}
      explanationTitle={t(level === 3 ? 'match.fullExplanation' : level === 2 ? 'common.explanation' : 'match.kootaMeaning')}
      divider={divider}
      testID={testID}
    >
      <View style={styles.head}>
        <Txt kind="body" weight={600} style={styles.name}>
          {name}
        </Txt>
        <Num kind="body" weight={600} testID={testID ? `${testID}-points` : undefined}>
          {points}
        </Num>
      </View>
      <Txt kind="caption" color="ink2" testID={testID ? `${testID}-sides` : undefined}>
        {t('match.sides', { a: aText, b: bText })}
      </Txt>
      {meaning ? (
        <Txt kind="caption" color="ink3" testID={testID ? `${testID}-meaning` : undefined}>
          {meaning}
        </Txt>
      ) : null}
    </Row>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  name: { flexShrink: 1 },
});
