// Settings -> Chart style: North / South / East Indian (F11); also reachable from the chart card's menu (A11).
import { useState } from 'react';
import { getSetting, setSetting, type ChartStyle } from '../../src/db/settings';
import { useLang } from '../../src/i18n';
import { ChoiceScreen } from '../../src/settings/ChoiceScreen';
import { CHART_STYLE_KEY } from '../../src/settingsLabels';

const ORDER: readonly ChartStyle[] = ['north', 'south', 'east'];

export default function ChartStyleScreen() {
  const { t } = useLang();
  const [value, setValue] = useState<ChartStyle>(() => getSetting('chartStyle'));
  return (
    <ChoiceScreen<ChartStyle>
      title={t('settings.chartStyle')}
      choices={ORDER.map((v) => ({ value: v, label: t(CHART_STYLE_KEY[v]) }))}
      value={value}
      onChange={(v) => {
        setSetting('chartStyle', v);
        setValue(v);
      }}
      testID="chart-style-screen"
    />
  );
}
