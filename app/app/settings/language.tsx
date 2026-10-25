// Settings -> Language (en/hi/bho). setLang persists and re-renders every string live (F19 acceptance).
import { LANGS, useLang, type Lang } from '../../src/i18n';
import { ChoiceScreen } from '../../src/settings/ChoiceScreen';
import { LANG_KEY } from '../../src/settingsLabels';

export default function LanguageScreen() {
  const { t, lang, setLang } = useLang();
  return (
    <ChoiceScreen<Lang>
      title={t('settings.language')}
      choices={LANGS.map((l) => ({ value: l, label: t(LANG_KEY[l]) }))}
      value={lang}
      onChange={setLang}
      testID="language-screen"
    />
  );
}
