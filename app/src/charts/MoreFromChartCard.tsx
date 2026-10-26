// "More from this chart" (design.md 5 M14, 10.3; charts.html): one 44 dp row per rewarded-unlock key in this build -
// Divisional charts (14), Ashtakavarga, KP system, Varshaphal (Prashna and Ask my chart rows arrive with C04). Every
// row names its own state: Pro -> plain row; unlocked -> "unlocked till <time> tomorrow"; locked -> lock icon + "watch
// an ad · 24 h". Tapping an unlocked/Pro row opens the feature; tapping a locked row opens the unlock sheet for THAT
// key (one ad = one key). The Varshaphal row's sub-line is "Your Vedic year from <date · time>" (NoBreak runs).
import { StyleSheet, View } from 'react-native';
import { Card } from '../components/Card';
import { ChevronIcon, LockIcon } from '../components/icons';
import { Pressable44 } from '../components/Pressable44';
import { Tag } from '../components/Tag';
import { Txt } from '../components/Txt';
import { useLang } from '../i18n';
import { useTokens } from '../theme/ThemeProvider';
import { RichText } from '../today/RichText';
import { fmtDate, fmtTime } from '../today/format';
import { MORE_FROM_CHART_KEYS, rowStateText, type FeatureAccess, type UnlockKey } from './unlockState';

export interface MoreFromChartCardProps {
  access: Record<UnlockKey, FeatureAccess>;
  nowMs: number;
  tz: string;
  /** Start of the running Vedic year (engine solar return) for the Varshaphal sub-line. */
  vedicYearStart: number;
  onOpen: (key: UnlockKey) => void;
  onUnlock: (key: UnlockKey) => void;
  testID?: string;
}

const DESC_KEY: Record<UnlockKey, string> = {
  vargas: 'vargas.desc',
  ashtakavarga: 'ashtakavarga.desc',
  kp: 'kp.desc',
  varshaphal: 'varshaphal.desc',
  prashna: 'unlock.feature.prashna',
};

export function MoreFromChartCard({ access, nowMs, tz, vedicYearStart, onOpen, onUnlock, testID }: MoreFromChartCardProps) {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  const anyLocked = MORE_FROM_CHART_KEYS.some((k) => !access[k].pro);
  return (
    <Card testID={testID}>
      <View style={styles.head}>
        <Txt kind="heading" accessibilityRole="header" style={styles.title}>
          {t('unlock.moreTitle')}
        </Txt>
        {anyLocked ? (
          <Txt kind="caption" color="ink2">
            {t('unlock.orPro')}
          </Txt>
        ) : null}
      </View>
      {MORE_FROM_CHART_KEYS.map((key, i) => {
        const a = access[key];
        const state = rowStateText(a, nowMs, tz, lang, t);
        const title = t(`unlock.rowTitle.${key}`);
        const sub = key === 'varshaphal' ? t('varshaphal.yearFrom', { date: fmtDate(vedicYearStart, tz, lang), time: fmtTime(vedicYearStart, tz) }) : t(DESC_KEY[key]);
        const a11y = a.allowed ? `${title}. ${sub}${state ? `. ${state}` : ''}` : t('unlock.lockedRowA11y', { feature: title });
        return (
          <Pressable44
            key={key}
            accessibilityLabel={a11y}
            onPress={() => (a.allowed ? onOpen(key) : onUnlock(key))}
            style={[styles.row, i < MORE_FROM_CHART_KEYS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hair }]}
            testID={`more-row-${key}`}
          >
            <View style={styles.text}>
              <Txt kind="body" weight={600}>
                {title}
              </Txt>
              {key === 'varshaphal' ? <RichText kind="caption" color="ink2" text={sub} /> : (
                <Txt kind="caption" color="ink2">
                  {sub}
                </Txt>
              )}
              {state ? (
                <View style={styles.stateRow}>
                  {!a.allowed ? <LockIcon color={colors.ink3} size={14} /> : null}
                  <RichText kind="caption" color={a.allowed ? 'accent' : 'ink3'} text={state} testID={`more-state-${key}`} />
                </View>
              ) : null}
            </View>
            {a.allowed ? <ChevronIcon color={colors.ink3} /> : <Tag>{t('unlock.unlock')}</Tag>}
          </Pressable44>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 8, alignSelf: 'stretch' },
  text: { flex: 1, minWidth: 0, gap: 2 },
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
