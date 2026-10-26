// WindowCard (F26, design.md 10.5 / muhurat.html .res): one scored window. "<day> · <from>–<to>" in resultWhen (20/26
// 600, the range glued with NoBreak), the sub-line "tithi · nakshatra · vara · choghadiya", the score "N/10 rules met"
// with a bar whose width is met/of (a count, labelled as such; never a percentage or stars), one RuleChip per rule in
// the engine's order, then the actions: "Save to Upcoming" (primary on the first result), ".ics Pro" (Pro exports via
// expo-sharing, free opens the Pro screen) and "Why?" (the activity's rule table with the inputs). Every value is the
// engine window's.
import type { MuhuratWindow } from '@shubhvela/engine';
import { StyleSheet, View } from 'react-native';
import { PrimaryButton, SecondaryButton } from '../components/Button';
import { Card } from '../components/Card';
import { NoBreak, Num } from '../components/Num';
import { Tag } from '../components/Tag';
import { Txt } from '../components/Txt';
import { WhyButton } from '../components/WhySheet';
import { useLang } from '../i18n';
import { useTokens } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';
import { ruleChipLabel, subLine, whenLine, whyInputs } from './model';
import { RuleChip } from './RuleChip';

export interface WindowCardProps {
  window: MuhuratWindow;
  tz: string;
  /** Civil date of today in tz (the when-line reads "Today" for it). */
  todayDate: string;
  /** First result: Save is the primary button. */
  primary?: boolean;
  saved: boolean;
  pro: boolean;
  onSave: () => void;
  onIcs: () => void;
  testID?: string;
}

/** Bar width fraction: rules met over rules checked (a count ratio for the bar geometry only). */
export function barFraction(w: Pick<MuhuratWindow, 'met' | 'of'>): number {
  return w.of > 0 ? w.met / w.of : 0;
}

export function WindowCard({ window: w, tz, todayDate, primary, saved, pro, onSave, onIcs, testID }: WindowCardProps) {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  const when = whenLine(w, tz, lang, t, todayDate);
  const sub = subLine(w, lang, t);
  const metText = t('muhurat.rulesMet', { met: w.met, of: w.of });
  const notes: string[] = [];
  if (w.night) notes.push(t('muhurat.night_tag'));
  if (w.clippedByRahuKaal) notes.push(t('muhurat.clipped'));
  return (
    <Card testID={testID} accessibilityLabel={`${when}. ${sub}. ${t('muhurat.rulesMetA11y', { met: w.met, of: w.of })}`}>
      <View style={styles.top}>
        <View style={styles.flex}>
          <NoBreak kind="resultWhen" numeric testID="window-when">
            {when}
          </NoBreak>
          <Txt kind="label" weight={400} color="ink2" testID="window-sub">
            {sub}
          </Txt>
          {notes.length ? (
            <View style={styles.notes}>
              {notes.map((n) => (
                <Tag key={n}>{n}</Tag>
              ))}
            </View>
          ) : null}
        </View>
        <View style={styles.score} accessible accessibilityLabel={t('muhurat.rulesMetA11y', { met: w.met, of: w.of })} testID="window-score">
          <Num kind="sheetTitle" weight={600} style={styles.scoreNum}>
            {String(w.met)}
            <Num kind="caption" color="ink3">{`/${w.of}`}</Num>
          </Num>
          <Txt kind="micro" color="ink3">
            {metText.replace(/^\S+\s*/, '')}
          </Txt>
        </View>
      </View>
      <View style={[styles.barTrack, { backgroundColor: colors.neutral, borderColor: colors.hair }]} accessibilityRole="image" accessibilityLabel={t('muhurat.rulesMetA11y', { met: w.met, of: w.of })}>
        <View style={[styles.barFill, { backgroundColor: colors.accent, width: `${Math.round(barFraction(w) * 100)}%` }]} testID="window-bar" />
      </View>
      <View style={styles.rules} testID="window-rules">
        {w.rules.map((r) => (
          <RuleChip key={r.id} rule={r} label={ruleChipLabel(r, w, tz, lang, t)} testID={`rule-${r.id}-${r.met ? 'met' : 'notmet'}`} />
        ))}
      </View>
      <View style={styles.actions}>
        {saved ? (
          <SecondaryButton label={t('muhurat.saved')} onPress={onSave} disabled style={styles.action} testID="window-saved" />
        ) : primary ? (
          <PrimaryButton label={t('muhurat.saveUpcoming')} onPress={onSave} style={styles.action} testID="window-save" />
        ) : (
          <SecondaryButton label={t('muhurat.saveUpcoming')} onPress={onSave} style={styles.action} testID="window-save" />
        )}
        <SecondaryButton label={pro ? t('muhurat.ics') : t('muhurat.icsPro')} accessibilityLabel={t('muhurat.icsExport')} onPress={onIcs} style={styles.action} testID="window-ics" />
        <WhyButton ruleId={w.ruleId} inputs={whyInputs(w, tz, lang, t)} glossary={['muhurat', 'choghadiya', 'rahu-kaal', 'abhijit', 'bhadra', 'panchak']} rowText={when} title={t('muhurat.whySheetTitle', { activity: whyInputs(w, tz, lang, t)[t('muhurat.activity')] })} testID="window-why" />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  notes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  score: { alignItems: 'flex-end' },
  scoreNum: { textAlign: 'right' },
  barTrack: { height: 8, borderRadius: radius.tag, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginTop: 10, marginBottom: 12 },
  barFill: { height: '100%' },
  rules: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 12 },
  action: { alignSelf: 'auto' },
});
