// Onboarding 1/3: DPDP consent notice (spec section 10, design.md 10.1 F1). What is stored, where, the one case data
// leaves the phone (Nominatim on an explicit tap), ads on the free tier, how to delete, grievance contact (placeholder
// from docs/OWNER-TODO.md item 8 until the owner provides it), the law. "Continue" = 48 dp primary; "Read policy" opens
// the web privacy URL. Stores app_state.consent_at.
import { useRouter } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';
import { Card, PrimaryButton, Screen, TextButton, Txt } from '../../src/components';
import { recordConsent } from '../../src/db/appState';
import { useLang } from '../../src/i18n';
import { grievanceText, privacyPolicyUrl } from '../../src/legal';

export default function ConsentScreen() {
  const { t } = useLang();
  const router = useRouter();
  const sections: [string, string][] = [
    [t('consent.whatStoredTitle'), t('consent.whatStored')],
    [t('consent.whereTitle'), t('consent.where')],
    [t('consent.leavesTitle'), t('consent.leaves')],
    [t('consent.adsTitle'), t('consent.ads')],
    [t('consent.deleteTitle'), t('consent.delete')],
    [t('consent.grievanceTitle'), grievanceText(t, 'consent.grievance')],
  ];
  return (
    <Screen
      title={t('consent.title')}
      chrome="stack"
      hideControl
      testID="consent-screen"
      stickyCta={
        <View style={styles.cta}>
          <PrimaryButton
            label={t('consent.agree')}
            testID="consent-continue"
            onPress={() => {
              recordConsent();
              router.replace('/onboarding/birth');
            }}
          />
          <TextButton label={t('consent.readPolicy')} onPress={() => Linking.openURL(privacyPolicyUrl())} />
        </View>
      }
    >
      <Txt kind="caption" color="ink3">
        {t('onboarding.step', { n: 1, total: 3 })}
      </Txt>
      <Txt kind="body">{t('consent.intro')}</Txt>
      <Card>
        <View style={styles.sections}>
          {sections.map(([title, body]) => (
            <View key={title} style={styles.section}>
              <Txt kind="heading">{title}</Txt>
              <Txt kind="body" color="ink2">
                {body}
              </Txt>
            </View>
          ))}
        </View>
      </Card>
      <Txt kind="caption" color="ink3">
        {t('consent.law')}
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sections: { gap: 16 },
  section: { gap: 4 },
  cta: { gap: 4 },
});
