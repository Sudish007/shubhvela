// Settings -> Pro and purchases (spec F39 "cancel/manage link visible in Settings"; design.md 10.9): the current Pro
// state (with the grace notice "Payment issue - update your card in Play" when Play reports a billing issue), a row to
// the plans (the Pro screen), Restore and Manage rows, and the one-time report rows with their credits.
import { useRouter } from 'expo-router';
import { useCatalog, useBillingMessage, useProStatus, BillingNotice, ProStatusLines, ReportRows, RestoreManageRows } from '../../src/billing/ui';
import { Card, NavRow, Screen, Txt } from '../../src/components';
import { useLang } from '../../src/i18n';

export default function SettingsProScreen() {
  const { t } = useLang();
  const router = useRouter();
  const status = useProStatus();
  const { catalog } = useCatalog();
  const [message, setMessage] = useBillingMessage();
  return (
    <Screen title={t('settings.pro')} chrome="stack" route="SettingsPro" testID="settings-pro-screen">
      {status.pro ? (
        <Card>
          <ProStatusLines status={status} />
        </Card>
      ) : null}
      <BillingNotice message={message} />
      <Card flush>
        <NavRow title={t('pro.plansTitle')} value={status.pro ? t('pro.openPro') : undefined} onPress={() => router.push('/pro')} divider={false} testID="settings-pro-plans" />
      </Card>
      <Card>
        <RestoreManageRows onMessage={setMessage} />
      </Card>
      <Card>
        <Txt kind="heading" weight={600}>
          {t('pro.reportsTitle')}
        </Txt>
        <ReportRows catalog={catalog} onMessage={setMessage} />
      </Card>
      <Txt kind="caption" color="ink3" testID="settings-pro-disclaimer">
        {t('pro.disclaimer')}
      </Txt>
    </Screen>
  );
}
