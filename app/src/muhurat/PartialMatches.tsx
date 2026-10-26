// PartialMatches (F26, design.md 10.5): windows meeting fewer than 4 rules are shown only here, in the same N18 order,
// as full WindowCards (rule chips make the shortfall explainable). Zero matches in range: the honest copy
// "No window met at least 4 rules in these days; widen the range (Pro) or see the best partial matches" with the
// top three partials; a range with no candidate at all (polar days) says so instead of inventing a window.
import type { MuhuratWindow } from '@shubhvela/engine';
import { StyleSheet, View } from 'react-native';
import { Txt } from '../components/Txt';
import { useLang } from '../i18n';
import { PARTIAL_THRESHOLD, ZERO_RESULT_PARTIALS } from './model';
import { WindowCard, type WindowCardProps } from './WindowCard';

export interface PartialMatchesProps extends Pick<WindowCardProps, 'tz' | 'todayDate' | 'pro'> {
  partials: readonly MuhuratWindow[];
  /** True when the match list above is empty (zero-results copy + top three). */
  zeroResults: boolean;
  isSaved: (w: MuhuratWindow) => boolean;
  onSave: (w: MuhuratWindow) => void;
  onIcs: (w: MuhuratWindow) => void;
  testID?: string;
}

/** Which partials to list: all of them under a result list, the top three under the zero-results copy. */
export function partialsToShow(partials: readonly MuhuratWindow[], zeroResults: boolean): MuhuratWindow[] {
  return zeroResults ? partials.slice(0, ZERO_RESULT_PARTIALS) : [...partials];
}

export function PartialMatches({ partials, zeroResults, tz, todayDate, pro, isSaved, onSave, onIcs, testID }: PartialMatchesProps) {
  const { t } = useLang();
  const shown = partialsToShow(partials, zeroResults);
  if (!zeroResults && shown.length === 0) return null;
  return (
    <View testID={testID} style={styles.root}>
      {zeroResults ? (
        <Txt kind="body" color="ink2" testID="zero-results">
          {t('muhurat.zeroResults')}
        </Txt>
      ) : null}
      {shown.length ? (
        <>
          <Txt kind="heading" accessibilityRole="header" testID="partial-title">
            {t('muhurat.partialTitle')}
          </Txt>
          <Txt kind="caption" color="ink3">
            {`${t('muhurat.partialNote')} (${PARTIAL_THRESHOLD})`}
          </Txt>
          {shown.map((w, i) => (
            <WindowCard key={`${w.day}-${w.start}-${w.end}`} window={w} tz={tz} todayDate={todayDate} pro={pro} saved={isSaved(w)} onSave={() => onSave(w)} onIcs={() => onIcs(w)} testID={`partial-${i}`} />
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
});
