// Settings -> Theme (D9): System / Light / Dark, persisted; the ThemeProvider applies it immediately.
import { useLang } from '../../src/i18n';
import { ChoiceScreen } from '../../src/settings/ChoiceScreen';
import { THEME_KEY } from '../../src/settingsLabels';
import { useTokens, type ThemeSetting } from '../../src/theme/ThemeProvider';

const ORDER: readonly ThemeSetting[] = ['system', 'light', 'dark'];

export default function ThemeScreen() {
  const { t } = useLang();
  const { setting, setThemeSetting } = useTokens();
  return (
    <ChoiceScreen<ThemeSetting>
      title={t('settings.theme')}
      choices={ORDER.map((v) => ({ value: v, label: t(THEME_KEY[v]) }))}
      value={setting}
      onChange={setThemeSetting}
      testID="theme-screen"
    />
  );
}
