// Rewarded unlock sheet (design.md 5 M14, 10.3 F12; charts.html?sheet=unlock): names the ONE key it unlocks
// ("Unlock Ashtakavarga"), explains that one ad unlocks one feature for 24 h on this device, and offers two 48 dp
// buttons - "Watch an ad · unlock for 24 h" (useRewarded -> AdPolicy.unlock after EARNED_REWARD) and "Go Pro" (/pro).
// The ad is shown only on the explicit tap; no fill / closed early -> an inline notice, nothing unlocked. The screen
// decides nothing about tiers: entitlements grants the unlock, AdPolicy books the ad. UnlockBlock is the same content
// without the Modal, used as the header of the vargas sheet on the free tier.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRewarded, type RewardedFailure } from '../ads/useRewarded';
import type { RewardedKey } from '../ads/AdPolicy';
import { PrimaryButton, SecondaryButton } from '../components/Button';
import { InlineNotice } from '../components/Notices';
import { Sheet } from '../components/Sheet';
import { Txt } from '../components/Txt';
import { useLang } from '../i18n';
import { size } from '../theme/tokens';
import { featureName, type UnlockKey } from './unlockState';

export interface UnlockBlockProps {
  feature: UnlockKey;
  /** Called after the unlock is written (the caller closes the sheet / re-renders the row). */
  onUnlocked?: (expiresAt: Date) => void;
  /** Called before navigating to /pro (close the sheet). */
  onBeforeGoPro?: () => void;
  testID?: string;
}

export function UnlockBlock({ feature, onUnlocked, onBeforeGoPro, testID }: UnlockBlockProps) {
  const { t } = useLang();
  const router = useRouter();
  const [failure, setFailure] = useState<RewardedFailure | null>(null);
  const name = featureName(feature, t);
  const rewarded = useRewarded(feature as RewardedKey, {
    onUnlocked: (_key, expiresAt) => {
      setFailure(null);
      onUnlocked?.(expiresAt);
    },
    onFailed: (_key, reason) => setFailure(reason),
  });
  const goPro = () => {
    onBeforeGoPro?.();
    router.push('/pro');
  };
  return (
    <View style={styles.block} testID={testID}>
      <Txt kind="body">{t('unlock.body', { feature: name })}</Txt>
      <PrimaryButton label={t('unlock.watch')} onPress={rewarded.start} testID="unlock-watch" />
      <SecondaryButton label={t('unlock.goPro')} onPress={goPro} style={styles.proButton} testID="unlock-go-pro" />
      {failure ? <InlineNotice tone="error">{failure === 'unavailable' ? t('ads.unavailable') : t('unlock.failed')}</InlineNotice> : null}
      <Txt kind="caption" color="ink3">
        {`${t('unlock.deviceCaption')} ${t('unlock.onlyOnTap')}`}
      </Txt>
    </View>
  );
}

export interface UnlockSheetProps {
  visible: boolean;
  onClose: () => void;
  feature: UnlockKey;
  onUnlocked?: (expiresAt: Date) => void;
}

export function UnlockSheet({ visible, onClose, feature, onUnlocked }: UnlockSheetProps) {
  const { t } = useLang();
  return (
    <Sheet visible={visible} onClose={onClose} title={t('unlock.title', { feature: featureName(feature, t) })}>
      <UnlockBlock
        feature={feature}
        onUnlocked={(at) => {
          onUnlocked?.(at);
          onClose();
        }}
        onBeforeGoPro={onClose}
        testID="unlock-sheet"
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  block: { gap: 12 },
  // Both unlock buttons are 48 dp (design.md 10.3 F12); SecondaryButton is 44 by default.
  proButton: { minHeight: size.primaryCta },
});
