// Settings -> Privacy (spec section 10, design.md 3): the consent notice text, what leaves the phone, grievance contact,
// policy and deletion links, and "Delete everything" behind a confirm sheet (drops every table, cancels scheduled
// notifications, clears unlocks and the entitlement cache; the gate then re-opens the consent screen).
// "Backup and restore" is C04's and is not shown until it exists.
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Card, PrimaryButton, Screen, SecondaryButton, Sheet, TextButton, Txt } from '../../src/components';
import { deleteEverything } from '../../src/db/deleteEverything';
import { useLang } from '../../src/i18n';
import { dataDeletionUrl, grievanceText, privacyPolicyUrl } from '../../src/legal';

export default function PrivacyScreen() {
  const { t } = useLang();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function wipe() {
    setBusy(true);
    try {
      await deleteEverything({ cancelScheduledNotifications: () => Notifications.cancelAllScheduledNotificationsAsync() });
    } finally {
      setBusy(false);
      setConfirm(false);
      router.replace('/');
    }
  }

  const blocks: [string, string][] = [
    [t('privacy.storedTitle'), t('privacy.storedList')],
    [t('privacy.networkTitle'), t('privacy.networkList')],
    [t('consent.leavesTitle'), t('privacy.nominatim')],
    [t('consent.adsTitle'), t('consent.ads')],
    [t('consent.grievanceTitle'), `${grievanceText(t, 'privacy.grievance')}\n${t('privacy.grievanceNote')}`],
  ];

  return (
    <Screen title={t('privacy.title')} chrome="stack" testID="privacy-screen">
      <Txt kind="body">{t('privacy.summary')}</Txt>
      <Card>
        <View style={styles.blocks}>
          {blocks.map(([title, body]) => (
            <View key={title} style={styles.block}>
              <Txt kind="heading">{title}</Txt>
              <Txt kind="body" color="ink2">
                {body}
              </Txt>
            </View>
          ))}
          <Txt kind="caption" color="ink3">
            {t('privacy.breach')}
          </Txt>
          <Txt kind="caption" color="ink3">
            {t('consent.law')}
          </Txt>
        </View>
      </Card>
      <Card>
        <View style={styles.links}>
          <TextButton label={t('privacy.policyLink')} onPress={() => Linking.openURL(privacyPolicyUrl())} />
          <TextButton label={t('privacy.deletionLink')} onPress={() => Linking.openURL(dataDeletionUrl())} />
        </View>
      </Card>
      <Card>
        <View style={styles.block}>
          <Txt kind="heading">{t('privacy.deleteAll')}</Txt>
          <Txt kind="body" color="ink2">
            {t('privacy.deleteAllBody')}
          </Txt>
          <SecondaryButton label={t('privacy.deleteAll')} onPress={() => setConfirm(true)} testID="delete-everything" />
        </View>
      </Card>
      <Sheet
        visible={confirm}
        onClose={() => setConfirm(false)}
        title={t('privacy.deleteAll')}
        footer={
          <View style={styles.links}>
            <PrimaryButton label={t('privacy.deleteAllConfirm')} onPress={wipe} disabled={busy} testID="delete-everything-confirm" />
            <SecondaryButton label={t('common.cancel')} onPress={() => setConfirm(false)} disabled={busy} />
          </View>
        }
      >
        <Txt kind="body">{t('privacy.deleteAllBody')}</Txt>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  blocks: { gap: 16 },
  block: { gap: 6 },
  links: { gap: 8 },
});
