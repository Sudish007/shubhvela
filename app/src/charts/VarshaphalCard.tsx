// Varshaphal card (F17, design.md 10.3 M13/M21): shown on Charts only during the 30 days before the next solar
// return (varshaphalModel.varshaphalPromoted). Row "Your Vedic year begins <date · time>" with Why? (engine
// solar-return rule), a 44 dp row that opens the upcoming year's summary (behind the `varshaphal` key / Pro, named on
// the row), and the "Notify when the year begins" switch (default Off; the planner schedules one local notification at
// the instant when On; the switch also lives in Settings -> Notifications).
import { StyleSheet, View } from 'react-native';
import { Card } from '../components/Card';
import { ChevronIcon, LockIcon } from '../components/icons';
import { Pressable44 } from '../components/Pressable44';
import { Row } from '../components/Row';
import { Switch } from '../components/Switch';
import { Txt } from '../components/Txt';
import type { VedicYear } from '../engine-bridge/charts';
import { useLang } from '../i18n';
import { useTokens } from '../theme/ThemeProvider';
import { fmtDate, fmtTime } from '../today/format';
import { RichText } from '../today/RichText';
import { rowStateText, type FeatureAccess } from './unlockState';
import { daysUntilReturn } from './varshaphalModel';

export interface VarshaphalCardProps {
  vedicYear: VedicYear;
  nowMs: number;
  tz: string;
  access: FeatureAccess;
  notifyOn: boolean;
  onToggleNotify: (on: boolean) => void;
  /** Opens the summary of the upcoming year (allowed) or the unlock sheet (locked). */
  onOpen: () => void;
  testID?: string;
}

export function VarshaphalCard({ vedicYear, nowMs, tz, access, notifyOn, onToggleNotify, onOpen, testID }: VarshaphalCardProps) {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  const date = fmtDate(vedicYear.nextStart, tz, lang);
  const time = fmtTime(vedicYear.nextStart, tz);
  const sentence = t('varshaphal.cardSoon', { date, time });
  const state = rowStateText(access, nowMs, tz, lang, t);
  return (
    <Card testID={testID}>
      <Txt kind="heading" accessibilityRole="header">
        {t('varshaphal.title')}
      </Txt>
      <Row ruleId="varshaphal-solar-return" text={sentence} inputs={{ [t('varshaphal.yearBegins')]: `${date} ${time}`, [t('onboarding.timezone')]: tz }} glossary={['varshaphal']} testID="varshaphal-begins">
        <RichText kind="body" text={sentence} />
      </Row>
      <Pressable44
        accessibilityLabel={access.allowed ? t('varshaphal.openSummary') : t('unlock.lockedRowA11y', { feature: t('varshaphal.title') })}
        onPress={onOpen}
        style={[styles.openRow, { borderBottomColor: colors.hair }]}
        testID="varshaphal-open"
      >
        <View style={styles.openText}>
          <Txt kind="body">{t('varshaphal.openSummary')}</Txt>
          <RichText kind="caption" color="ink3" text={t('varshaphal.cardBody', { days: t('common.days', { count: daysUntilReturn(vedicYear, nowMs) }) })} />
          {state ? (
            <View style={styles.stateRow}>
              {!access.allowed ? <LockIcon color={colors.ink3} size={14} /> : null}
              <RichText kind="caption" color={access.allowed ? 'accent' : 'ink3'} text={state} testID="varshaphal-state" />
            </View>
          ) : null}
        </View>
        <ChevronIcon color={colors.ink3} />
      </Pressable44>
      <View style={styles.switchRow}>
        <View style={styles.openText}>
          <Txt kind="body">{t('varshaphal.notifyToggle')}</Txt>
          <RichText kind="caption" color="ink3" text={notifyOn ? t('varshaphal.notifyOn', { date, time }) : t('varshaphal.notifyOff')} />
        </View>
        <Switch value={notifyOn} onValueChange={onToggleNotify} accessibilityLabel={t('varshaphal.notifyToggle')} testID="varshaphal-notify" />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  openRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 8, alignSelf: 'stretch', borderBottomWidth: StyleSheet.hairlineWidth },
  openText: { flex: 1, minWidth: 0, gap: 2 },
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 8 },
});
