// Prashna history (F18, design.md 10.3): every saved question, newest first, with the instant and place it was asked
// at; tapping a row re-opens the reading (recomputed from the stored instant), the 44 dp Delete control asks once and
// removes the row. Behind the same `prashna` key / Pro as the question screen.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, ChevronIcon, EmptyState, Pressable44, PrimaryButton, Screen, SecondaryButton, Sheet, Txt } from '../../../src/components';
import { LockedFeature, useMountClock } from '../../../src/charts/LockedFeature';
import { useFeatureAccess } from '../../../src/charts/unlockState';
import { deletePrashna, listPrashna, type PrashnaRow } from '../../../src/db/prashna';
import { useLang } from '../../../src/i18n';
import { useTokens } from '../../../src/theme/ThemeProvider';
import { fmtDate, fmtTime } from '../../../src/today/format';
import { RichText } from '../../../src/today/RichText';

export interface PrashnaHistoryProps {
  now?: () => number;
}

export default function PrashnaHistoryScreen({ now }: PrashnaHistoryProps) {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  const router = useRouter();
  const nowMs = useMountClock(now);
  const access = useFeatureAccess('prashna', nowMs);
  const [rows, setRows] = useState<PrashnaRow[]>(() => listPrashna());
  const [confirm, setConfirm] = useState<PrashnaRow | null>(null);
  const [deletedNotice, setDeletedNotice] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setRows(listPrashna());
    }, []),
  );

  function remove(row: PrashnaRow) {
    deletePrashna(row.id);
    setRows(listPrashna());
    setConfirm(null);
    setDeletedNotice(true);
  }

  if (!access.allowed) {
    return (
      <Screen title={t('prashna.history')} chrome="stack" testID="prashna-history-screen">
        <LockedFeature feature="prashna" testID="prashna-history-locked" />
      </Screen>
    );
  }

  return (
    <Screen title={t('prashna.history')} chrome="stack" testID="prashna-history-screen">
      {deletedNotice ? (
        <Txt kind="caption" color="ink2" accessibilityLiveRegion="polite" testID="prashna-deleted">
          {t('prashna.deleted')}
        </Txt>
      ) : null}
      {rows.length === 0 ? <EmptyState title={t('prashna.history')} body={t('prashna.historyEmpty')} /> : null}
      {rows.length ? (
        <Card flush testID="prashna-history-list">
          {rows.map((r, i) => (
            <View key={r.id} style={[styles.row, i < rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hair }]} testID={`prashna-history-${r.id}`}>
              <Pressable44 accessibilityLabel={`${r.question}. ${fmtDate(Date.parse(r.ts), r.tz, lang)} ${fmtTime(Date.parse(r.ts), r.tz)}`} onPress={() => router.push(`/charts/prashna?id=${r.id}`)} style={styles.open} testID={`prashna-history-open-${r.id}`}>
                <View style={styles.text}>
                  <Txt kind="body">{r.question}</Txt>
                  <RichText kind="caption" color="ink2" text={`${fmtDate(Date.parse(r.ts), r.tz, lang)} · ${fmtTime(Date.parse(r.ts), r.tz)} · ${r.lat.toFixed(2)}, ${r.lon.toFixed(2)}`} />
                </View>
                <ChevronIcon color={colors.ink3} />
              </Pressable44>
              <Pressable44 accessibilityLabel={`${t('prashna.delete')}: ${r.question}`} onPress={() => setConfirm(r)} style={styles.delete} testID={`prashna-history-delete-${r.id}`}>
                <Txt kind="label" weight={600} color="accent">
                  {t('common.delete')}
                </Txt>
              </Pressable44>
            </View>
          ))}
        </Card>
      ) : null}
      <Sheet
        visible={!!confirm}
        onClose={() => setConfirm(null)}
        title={t('prashna.delete')}
        footer={
          <View style={styles.confirm}>
            <PrimaryButton label={t('common.delete')} onPress={() => confirm && remove(confirm)} testID="prashna-delete-confirm" />
            <SecondaryButton label={t('common.cancel')} onPress={() => setConfirm(null)} />
          </View>
        }
      >
        <Txt kind="body">{t('prashna.deleteConfirm')}</Txt>
        {confirm ? (
          <Txt kind="body" color="ink2">
            {confirm.question}
          </Txt>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 16, paddingRight: 8, paddingVertical: 4 },
  open: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  delete: { paddingHorizontal: 8 },
  confirm: { gap: 8 },
});
