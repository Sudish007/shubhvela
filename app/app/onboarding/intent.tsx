// Onboarding 3/3: optional intent (spec section 2: it only reorders the Today stack; nothing is hidden). "Show my chart"
// computes the chart synchronously on-device (engine.computeChart via the bridge cache) and lands on Today.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, InlineNotice, PrimaryButton, Screen, Txt } from '../../src/components';
import { INTENTS, getSelfProfile, setProfileIntent, type Intent } from '../../src/db/profiles';
import { chartFor } from '../../src/engine-bridge/charts';
import { useLang } from '../../src/i18n';

const CHIP_KEY: Record<Intent, string> = {
  marriage: 'onboarding.marriage_chip',
  career: 'onboarding.career_chip',
  familyDates: 'onboarding.familyDates_chip',
  learn: 'onboarding.learn_chip',
};

export default function IntentScreen() {
  const { t } = useLang();
  const router = useRouter();
  const self = getSelfProfile();
  const [intent, setIntent] = useState<Intent | null>(self?.intent ?? null);
  const [error, setError] = useState<string | null>(null);

  function show() {
    if (!self) return router.replace('/onboarding/birth');
    setProfileIntent(self.id, intent);
    try {
      chartFor({ ...self, intent });
    } catch (e) {
      if (__DEV__) console.warn('chart failed', e);
      setError(t('errors.chart'));
      return;
    }
    router.replace('/(tabs)/today');
  }

  return (
    <Screen title={t('onboarding.intentTitle')} chrome="stack" testID="intent-screen" stickyCta={<PrimaryButton label={t('onboarding.showChart')} onPress={show} testID="show-chart" />}>
      <Txt kind="caption" color="ink3">
        {t('onboarding.step', { n: 3, total: 3 })}
      </Txt>
      <Txt kind="body" color="ink2">
        {t('onboarding.intentHint')}
      </Txt>
      <View style={styles.chips}>
        {INTENTS.map((i) => (
          <Chip key={i} label={t(CHIP_KEY[i])} selected={intent === i} onPress={() => setIntent(intent === i ? null : i)} testID={`intent-${i}`} />
        ))}
      </View>
      {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
