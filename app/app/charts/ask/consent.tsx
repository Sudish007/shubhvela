// Consent before the model download (spec F35, design.md 10.7 / 2.3): the exact size computed from MODEL_BYTES
// ("2.6 GB"), Wi-Fi only (and never resumes on mobile data by itself), the storage location on this phone, the delete
// promise, offline-only, the model and runtime named with a link to the Gemma terms of use, and a sticky CTA
// "Download 2.6 GB on Wi-Fi" (the Screen's sticky-CTA padding rule) with "Not now". Nothing starts before the tap.
import { useRouter } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';
import { modelLocationLabel } from '../../../src/ai/download';
import { GEMMA_TERMS_URL, modelSizeLabel } from '../../../src/ai/model';
import { Card, Pressable44, PrimaryButton, Screen, SecondaryButton, Txt, ChevronIcon } from '../../../src/components';
import { useLang } from '../../../src/i18n';
import { useTokens } from '../../../src/theme/ThemeProvider';
import { RichText } from '../../../src/today/RichText';

export interface AskConsentScreenProps {
  openUrl?: (url: string) => Promise<unknown>;
  location?: string;
}

export default function AskConsentScreen({ openUrl = (u) => Linking.openURL(u), location }: AskConsentScreenProps) {
  const { t } = useLang();
  const { colors } = useTokens();
  const router = useRouter();
  const size = modelSizeLabel();
  const rows: { key: string; text: string; testID: string }[] = [
    { key: 'size', text: t('ask.consentSize'), testID: 'ask-consent-size' },
    { key: 'wifi', text: t('ask.consentWifi'), testID: 'ask-consent-wifi' },
    { key: 'storage', text: t('ask.consentStorage', { path: location ?? modelLocationLabel() }), testID: 'ask-consent-storage' },
    { key: 'delete', text: t('ask.consentDelete'), testID: 'ask-consent-delete' },
    { key: 'offline', text: t('ask.consentOffline'), testID: 'ask-consent-offline' },
    { key: 'model', text: t('ask.consentModel'), testID: 'ask-consent-model' },
  ];
  return (
    <Screen
      title={t('ask.consentTitle')}
      chrome="stack"
      testID="ask-consent-screen"
      stickyCta={
        <View style={styles.cta}>
          <PrimaryButton label={t('ask.consentCta')} accessibilityLabel={`${t('ask.consentCta')} (${size})`} onPress={() => router.replace('/charts/ask/download')} testID="ask-consent-download" />
          <SecondaryButton label={t('ask.consentNotNow')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/charts'))} testID="ask-consent-not-now" />
        </View>
      }
    >
      <Txt kind="body" color="ink2">
        {t('ask.gateBody')}
      </Txt>
      <Card testID="ask-consent-card">
        {rows.map((r, i) => (
          <View key={r.key} style={[styles.row, i < rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hair }]} testID={r.testID}>
            <RichText kind="body" text={r.text} />
          </View>
        ))}
        <Pressable44 accessibilityRole="link" accessibilityLabel={t('ask.consentTerms')} onPress={() => void openUrl(GEMMA_TERMS_URL)} style={styles.link} testID="ask-consent-terms">
          <Txt kind="label" weight={600} color="accent" style={styles.linkText}>
            {t('ask.consentTerms')}
          </Txt>
          <ChevronIcon color={colors.accent} size={18} />
        </Pressable44>
      </Card>
      <Txt kind="caption" color="ink3">
        {t('ask.notAdvice')}
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cta: { gap: 8 },
  row: { paddingVertical: 8 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 4 },
  linkText: { flexShrink: 1 },
});
