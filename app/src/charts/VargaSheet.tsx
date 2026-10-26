// "14 more vargas" sheet (design.md 4, 10.3 F12): lists D2, D3, D4, D7, D10, D12, D16, D20, D24, D27, D30, D40, D45,
// D60 (D9 is free and sits in the chip row), each with the area it is classically read for. Free tier: the header is
// the UnlockBlock for the key `vargas` (watch an ad · 24 h / Go Pro) and the rows are listed but not selectable; after
// an unlock or on Pro every row is a 44 dp radio that swaps the hero ChartData (same Chart component). The header also
// says how long a running unlock lasts and offers the full-screen table.
import { LOCKED_VARGA_IDS, type DivisionalChartId } from '@shubhvela/engine';
import { StyleSheet, View } from 'react-native';
import { RadioRow } from '../components/ListRows';
import { Pressable44 } from '../components/Pressable44';
import { Sheet } from '../components/Sheet';
import { Tag } from '../components/Tag';
import { Txt } from '../components/Txt';
import { useLang } from '../i18n';
import { useTokens } from '../theme/ThemeProvider';
import { vargaDomainText, vargaLabel } from './model';
import { UnlockBlock } from './UnlockSheet';
import { unlockedTillText, type FeatureAccess } from './unlockState';

export interface VargaSheetProps {
  visible: boolean;
  onClose: () => void;
  access: FeatureAccess;
  selected: DivisionalChartId | null;
  onSelect: (id: DivisionalChartId) => void;
  onUnlocked: (expiresAt: Date) => void;
  /** Opens app/app/charts/vargas (full-screen table) for the selected or first varga. */
  onOpenFull: (id: DivisionalChartId) => void;
  nowMs: number;
  tz: string;
}

export function VargaSheet({ visible, onClose, access, selected, onSelect, onUnlocked, onOpenFull, nowMs, tz }: VargaSheetProps) {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  const divider = { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hair };
  return (
    <Sheet visible={visible} onClose={onClose} title={t('vargas.title')}>
      <View testID="varga-sheet">
        <Txt kind="caption" color="ink2">
          {t('vargas.sheetNote')}
        </Txt>
        {!access.allowed ? (
          <View style={styles.header}>
            <UnlockBlock feature="vargas" onUnlocked={onUnlocked} onBeforeGoPro={onClose} testID="varga-unlock" />
          </View>
        ) : access.until ? (
          <Txt kind="caption" color="accent" style={styles.till} testID="varga-till">
            {unlockedTillText(access.until, nowMs, tz, lang, t)}
          </Txt>
        ) : null}
        <View style={styles.list} accessibilityLabel={t('vargas.listA11y', { state: access.allowed ? t('unlock.unlocked_tag') : t('unlock.locked_tag') })}>
          {LOCKED_VARGA_IDS.map((id, i) =>
            access.allowed ? (
              <RadioRow key={id} title={vargaLabel(id, t)} caption={vargaDomainText(id, t)} selected={selected === id} onPress={() => onSelect(id)} divider={i < LOCKED_VARGA_IDS.length - 1} testID={`varga-${id}`} />
            ) : (
              <View key={id} style={[styles.lockedRow, i < LOCKED_VARGA_IDS.length - 1 && divider]} accessible accessibilityLabel={`${vargaLabel(id, t)}, ${t('unlock.locked_tag')}`} testID={`varga-${id}`}>
                <View style={styles.lockedText}>
                  <Txt kind="label" weight={400} color="ink2">
                    {vargaLabel(id, t)}
                  </Txt>
                  <Txt kind="caption" color="ink3">
                    {vargaDomainText(id, t)}
                  </Txt>
                </View>
                <Tag>{t('unlock.locked_tag')}</Tag>
              </View>
            ),
          )}
        </View>
        {access.allowed ? (
          <Pressable44 accessibilityLabel={t('vargas.openFull')} onPress={() => onOpenFull(selected ?? LOCKED_VARGA_IDS[0])} style={styles.fullLink} testID="varga-open-full">
            <Txt kind="label" weight={600} color="accent">
              {t('vargas.openFull')}
            </Txt>
          </Pressable44>
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: 12 },
  till: { marginTop: 8 },
  list: { marginTop: 8, marginHorizontal: -16 },
  lockedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 16, minHeight: 44 },
  lockedText: { flex: 1, minWidth: 0, gap: 2 },
  fullLink: { alignSelf: 'flex-start', paddingHorizontal: 0, marginTop: 4 },
});
