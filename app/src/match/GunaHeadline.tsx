// "N of 36 guna" headline (design.md 10.6 F29): ink display type, tabular numerals, no colour grading of the score -
// the number is the value, nothing else says good or bad. Under it one line per side (name, Moon sign, nakshatra pada).
import { StyleSheet, View } from 'react-native';
import { ApproxTag } from '../components/Tag';
import { Txt } from '../components/Txt';
import { Num } from '../components/Num';
import { useLang } from '../i18n';
import { nakshatraName, signName } from '../today/format';
import { fmtGuna, type ResolvedSide } from './model';
import type { AshtakootaResult } from '@shubhvela/engine';

export interface GunaHeadlineProps {
  guna: AshtakootaResult;
  a: ResolvedSide;
  b: ResolvedSide;
  testID?: string;
}

export function GunaHeadline({ guna, a, b, testID }: GunaHeadlineProps) {
  const { t, lang } = useLang();
  const total = fmtGuna(guna.total);
  const line = (side: ResolvedSide, moon: AshtakootaResult['a']) =>
    t('match.sideLine', { name: side.label, sign: signName(lang, moon.moonSign), nakshatra: nakshatraName(lang, moon.nakshatra), pada: moon.pada });
  return (
    <View testID={testID} style={styles.wrap} accessibilityRole="header" accessibilityLabel={t('match.gunaA11y', { total })}>
      <Num kind="display" testID="guna-total">
        {t('match.gunaHeadline', { total })}
      </Num>
      {([a, b] as const).map((side, i) => (
        <View key={side.key} style={styles.sideRow}>
          <Txt kind="label" weight={400} color="ink2" style={styles.sideText} testID={`guna-side-${side.key}`}>
            {`${i === 0 ? 'A' : 'B'} · ${line(side, i === 0 ? guna.a : guna.b)}`}
          </Txt>
          {side.timeUnknown || side.approxMinutes > 0 ? <ApproxTag minutes={side.approxMinutes || undefined} /> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  sideRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  sideText: { flexShrink: 1 },
});
