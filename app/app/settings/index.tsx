// Settings (design.md 3): one grouped list. Pro and purchases are hidden until B03; Backup and restore until C04;
// the Vrats group arrives with A12. Each row shows its current value so the state is visible without opening it.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Card, NavRow, Screen } from '../../src/components';
import { getAllSettings, type Settings } from '../../src/db/settings';
import { useLang } from '../../src/i18n';
import { AYANAMSA_KEY, CHART_STYLE_KEY, LANG_KEY, NODE_KEY, THEME_KEY, TRADITION_KEY, shortValue } from '../../src/settingsLabels';
import { useTokens } from '../../src/theme/ThemeProvider';

export default function SettingsScreen() {
  const { t } = useLang();
  const { setting: themeSetting } = useTokens();
  const router = useRouter();
  const [s, setS] = useState<Settings>(() => getAllSettings());
  useFocusEffect(
    useCallback(() => {
      setS(getAllSettings());
    }, []),
  );
  const go = (path: string) => () => router.push(path);
  return (
    <Screen title={t('settings.title')} chrome="stack" testID="settings-screen">
      <Card flush>
        <NavRow title={t('settings.profiles')} onPress={() => router.replace('/(tabs)/family')} testID="settings-profiles" />
        <NavRow title={t('settings.language')} value={t(LANG_KEY[s.language])} onPress={go('/settings/language')} testID="settings-language" />
        <NavRow title={t('settings.theme')} value={t(THEME_KEY[themeSetting])} onPress={go('/settings/theme')} testID="settings-theme" />
        <NavRow title={t('settings.chartStyle')} value={t(CHART_STYLE_KEY[s.chartStyle])} onPress={go('/settings/chart-style')} testID="settings-chart-style" />
        <NavRow
          title={t('settings.calculation')}
          value={`${shortValue(t(AYANAMSA_KEY[s.ayanamsa]))} · ${shortValue(t(NODE_KEY[s.node]))}`}
          onPress={go('/settings/calculation')}
          testID="settings-calculation"
        />
        <NavRow title={t('settings.traditionDefault')} value={t(TRADITION_KEY[s.traditionDefault])} onPress={go('/settings/tradition')} testID="settings-tradition" />
        <NavRow title={t('settings.notifications')} onPress={go('/settings/notifications')} divider={false} testID="settings-notifications" />
      </Card>
      <Card flush>
        <NavRow title={t('settings.privacy')} onPress={go('/settings/privacy')} testID="settings-privacy" />
        <NavRow title={t('settings.disclaimers')} onPress={go('/settings/disclaimers')} testID="settings-disclaimers" />
        <NavRow title={t('settings.about')} onPress={go('/settings/about')} divider={false} testID="settings-about" />
      </Card>
    </Screen>
  );
}
