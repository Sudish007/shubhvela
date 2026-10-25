// Settings -> Notifications (A09 part): the Android permission state (real, from expo-notifications) and the quiet-by-
// default statement. Reminder times per kind, the series switches and the exact-alarm row are wired by A12 / C01;
// nothing about them is rendered until then.
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { Card, PrimaryButton, Screen, Txt } from '../../src/components';
import { useLang } from '../../src/i18n';

type Perm = 'unknown' | 'granted' | 'denied' | 'undetermined';

export default function NotificationsScreen() {
  const { t } = useLang();
  const [perm, setPerm] = useState<Perm>('unknown');

  useEffect(() => {
    let alive = true;
    Notifications.getPermissionsAsync()
      .then((p) => alive && setPerm(p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied'))
      .catch(() => alive && setPerm('unknown'));
    return () => {
      alive = false;
    };
  }, []);

  async function request() {
    if (perm === 'denied') return Linking.openSettings();
    try {
      const p = await Notifications.requestPermissionsAsync();
      setPerm(p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied');
    } catch {
      setPerm('unknown');
    }
  }

  return (
    <Screen title={t('reminders.title')} chrome="stack" testID="notifications-screen">
      <Card>
        <Txt kind="body">{perm === 'granted' ? t('reminders.permissionGranted') : perm === 'denied' ? t('reminders.permissionDenied') : t('reminders.permission')}</Txt>
        {perm !== 'granted' && perm !== 'unknown' ? <PrimaryButton label={perm === 'denied' ? t('common.openSettings') : t('reminders.permission')} onPress={request} /> : null}
      </Card>
      <Txt kind="body" color="ink2">
        {t('reminders.quiet')}
      </Txt>
    </Screen>
  );
}
