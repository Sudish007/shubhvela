// Settings -> Calendar tradition for NEW profiles (Purnimanta / Amanta). Existing profiles keep their own value (F3).
import { useState } from 'react';
import { getSetting, setSetting, type Tradition } from '../../src/db/settings';
import { useLang } from '../../src/i18n';
import { ChoiceScreen } from '../../src/settings/ChoiceScreen';
import { TRADITION_KEY } from '../../src/settingsLabels';

const ORDER: readonly Tradition[] = ['purnimanta', 'amanta'];

export default function TraditionScreen() {
  const { t } = useLang();
  const [value, setValue] = useState<Tradition>(() => getSetting('traditionDefault'));
  return (
    <ChoiceScreen<Tradition>
      title={t('settings.traditionDefault')}
      choices={ORDER.map((v) => ({ value: v, label: t(TRADITION_KEY[v]) }))}
      value={value}
      onChange={(v) => {
        setSetting('traditionDefault', v);
        setValue(v);
      }}
      testID="tradition-screen"
    />
  );
}
