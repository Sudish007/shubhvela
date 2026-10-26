// "Our 36-guna card" (F36): the two names (or initials when a side is a code without a name), the exact "N of 36
// guna" count in ink (no colour grading, design.md 6) and the eight-row koota mini-table. No birth data at all.
import type { AshtakootaResult } from '@shubhvela/engine';
import { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Num } from '../../components/Num';
import { Txt } from '../../components/Txt';
import { useLang } from '../../i18n';
import { fmtGuna } from '../../match/model';
import { colors } from '../../theme/tokens';
import { CardFrame, type CardView } from '../ShareCard';

export interface GunaCardProps {
  guna: AshtakootaResult;
  aLabel: string;
  bLabel: string;
}

export const GunaCard = forwardRef<CardView, GunaCardProps>(function GunaCard({ guna, aLabel, bLabel }, ref) {
  const { t } = useLang();
  const c = colors.light;
  return (
    <CardFrame ref={ref} kind="guna" kicker={t('share.cardGuna')}>
      <Txt kind="heading" testID="guna-card-names">
        {t('match.sides', { a: aLabel, b: bLabel })}
      </Txt>
      <Num kind="display" testID="guna-card-total">
        {t('match.gunaHeadline', { total: fmtGuna(guna.total) })}
      </Num>
      <View style={[styles.table, { borderColor: c.hair }]} testID="guna-card-table">
        {guna.kootas.map((k, i) => (
          <View key={k.id} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hair }]} testID={`guna-card-row-${k.id}`}>
            <Txt kind="label" weight={400} style={styles.name}>
              {t(`match.koota.${k.id}`)}
            </Txt>
            <Num kind="label" weight={600}>{`${fmtGuna(k.points)} / ${k.max}`}</Num>
          </View>
        ))}
      </View>
    </CardFrame>
  );
});

const styles = StyleSheet.create({
  table: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  name: { flex: 1 },
});
