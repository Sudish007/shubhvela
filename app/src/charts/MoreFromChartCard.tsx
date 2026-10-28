// "More from this chart" (design.md 5 M14, 10.3, 10.7; charts.html): one 44 dp row per rewarded-unlock key -
// Divisional charts (14), Ashtakavarga, KP system, Varshaphal, Prashna (C04: FIRST row for a time-unknown profile, F2;
// otherwise after Varshaphal) - plus the "Ask my chart" row (F35, Pro-only, never a rewarded key). Every row names its
// own state: Pro -> plain row; unlocked -> "unlocked till <time> tomorrow"; locked -> lock icon + "watch an ad · 24 h".
// The Ask row says exactly one of: the honest unsupported sentence (device gate failed; no cloud fallback), "... Pro."
// (free tier), "Download the model to start (2.6 GB, Wi-Fi only)" or "Ready · model on this phone". Tapping an
// unlocked/Pro row opens the feature; tapping a locked row opens the unlock sheet for THAT key (one ad = one key).
import { StyleSheet, View } from 'react-native';
import type { AskRowState } from '../ai/askState';
import { Card } from '../components/Card';
import { ChevronIcon, LockIcon } from '../components/icons';
import { Pressable44 } from '../components/Pressable44';
import { Tag } from '../components/Tag';
import { Txt } from '../components/Txt';
import { useLang } from '../i18n';
import { useTokens } from '../theme/ThemeProvider';
import { RichText } from '../today/RichText';
import { fmtDate, fmtTime } from '../today/format';
import { moreFromChartOrder, rowStateText, type FeatureAccess, type UnlockKey } from './unlockState';

export interface MoreFromChartCardProps {
  access: Record<UnlockKey, FeatureAccess>;
  nowMs: number;
  tz: string;
  /** Start of the running Vedic year (engine solar return) for the Varshaphal sub-line. */
  vedicYearStart: number;
  /** F2: time-unknown profile -> Prashna is the first row. */
  moonChart?: boolean;
  /** F35 row state (device gate -> tier -> model); undefined hides the row (tests of the Phase B card). */
  ask?: AskRowState;
  onOpen: (key: UnlockKey) => void;
  onUnlock: (key: UnlockKey) => void;
  onOpenAsk?: () => void;
  testID?: string;
}

const DESC_KEY: Record<UnlockKey, string> = {
  vargas: 'vargas.desc',
  ashtakavarga: 'ashtakavarga.desc',
  kp: 'kp.desc',
  varshaphal: 'varshaphal.desc',
  prashna: 'prashna.rowBody',
};

const TITLE_KEY: Record<UnlockKey, string> = {
  vargas: 'unlock.rowTitle.vargas',
  ashtakavarga: 'unlock.rowTitle.ashtakavarga',
  kp: 'unlock.rowTitle.kp',
  varshaphal: 'unlock.rowTitle.varshaphal',
  prashna: 'prashna.title',
};

const ASK_SUB_KEY: Record<AskRowState, string> = {
  unsupported: 'ask.rowUnsupported',
  pro: 'ask.rowBody',
  download: 'ask.rowDownload',
  ready: 'ask.rowReady',
};

export function MoreFromChartCard({ access, nowMs, tz, vedicYearStart, moonChart = false, ask, onOpen, onUnlock, onOpenAsk, testID }: MoreFromChartCardProps) {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  const keys = moreFromChartOrder(moonChart);
  const anyLocked = keys.some((k) => !access[k].pro);
  const divider = { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hair };
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
      {keys.map((key, i) => {
        const a = access[key];
        const state = rowStateText(a, nowMs, tz, lang, t);
        const title = t(TITLE_KEY[key]);
        const sub = key === 'varshaphal' ? t('varshaphal.yearFrom', { date: fmtDate(vedicYearStart, tz, lang), time: fmtTime(vedicYearStart, tz) }) : t(DESC_KEY[key]);
        const a11y = a.allowed ? `${title}. ${sub}${state ? `. ${state}` : ''}` : t('unlock.lockedRowA11y', { feature: title });
        const last = i === keys.length - 1 && !ask;
        return (
          <Pressable44 key={key} accessibilityLabel={a11y} onPress={() => (a.allowed ? onOpen(key) : onUnlock(key))} style={[styles.row, !last && divider]} testID={`more-row-${key}`}>
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
      {ask ? (
        <Pressable44 accessibilityLabel={`${t('ask.rowTitle')}. ${t(ASK_SUB_KEY[ask])}`} onPress={() => onOpenAsk?.()} style={styles.row} testID="more-row-ask">
          <View style={styles.text}>
            <Txt kind="body" weight={600}>
              {t('ask.rowTitle')}
            </Txt>
            <RichText kind="caption" color={ask === 'unsupported' ? 'ink3' : 'ink2'} text={t(ASK_SUB_KEY[ask])} testID="more-state-ask" />
          </View>
          {ask === 'pro' ? <Tag>{t('common.pro')}</Tag> : <ChevronIcon color={colors.ink3} />}
        </Pressable44>
      ) : null}
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
