// Locked state of a pushed feature screen (Ashtakavarga, KP, Varshaphal, the vargas table; design.md 10.3 F15/F17):
// the unlock sheet for THAT key opens at once; if the user dismisses it the screen keeps an honest card that says the
// feature is locked on the free tier with a 48 dp "Unlock" (re-opens the sheet) - no blurred preview, no fake rows.
// entitlements decides; the screen only asks.
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { PrimaryButton } from '../components/Button';
import { Card } from '../components/Card';
import { Txt } from '../components/Txt';
import { useLang } from '../i18n';
import { UnlockSheet } from './UnlockSheet';
import { featureName, type UnlockKey } from './unlockState';

export interface LockedFeatureProps {
  feature: UnlockKey;
  /** Optional: the screens re-render through useFeatureAccess anyway (entitlements notifies on grant). */
  onUnlocked?: () => void;
  testID?: string;
}

/** Hook used by every pushed feature screen: a stable clock per mount (Date.now() only in the initialiser). */
export function useMountClock(now?: () => number): number {
  const [ms] = useState(() => (now ? now() : Date.now()));
  return ms;
}

export function LockedFeature({ feature, onUnlocked, testID }: LockedFeatureProps) {
  const { t } = useLang();
  const [open, setOpen] = useState(true);
  return (
    <Card testID={testID}>
      <Txt kind="body">{t('unlock.lockedScreen', { feature: featureName(feature, t) })}</Txt>
      <PrimaryButton label={t('unlock.title', { feature: featureName(feature, t) })} onPress={() => setOpen(true)} style={styles.cta} testID="locked-unlock" />
      <UnlockSheet visible={open} onClose={() => setOpen(false)} feature={feature} onUnlocked={onUnlocked} />
    </Card>
  );
}

const styles = StyleSheet.create({ cta: { marginTop: 12 } });
