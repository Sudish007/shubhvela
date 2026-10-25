// Settings -> Calculation (F19): ayanamsa Lahiri/KP/Raman, nodes Mean/True, KP house system Placidus (read-only).
// Changing ayanamsa or node clears the chart cache so every chart is recomputed on next use (A11 adds the toast).
import { useState } from 'react';
import { Card, RadioRow, Screen, Txt } from '../../src/components';
import { getSetting, setSetting } from '../../src/db/settings';
import { clearChartCache } from '../../src/engine-bridge/charts';
import { useLang } from '../../src/i18n';
import { AYANAMSA_KEY, NODE_KEY } from '../../src/settingsLabels';
import type { Ayanamsa, NodeMode } from '@shubhvela/engine';

const AYANAMSAS: readonly Ayanamsa[] = ['lahiri', 'kp', 'raman'];
const NODES: readonly NodeMode[] = ['mean', 'true'];

export default function CalculationScreen() {
  const { t } = useLang();
  const [ayanamsa, setAyanamsa] = useState<Ayanamsa>(() => getSetting('ayanamsa'));
  const [node, setNode] = useState<NodeMode>(() => getSetting('node'));
  return (
    <Screen title={t('settings.calculation')} chrome="stack" testID="calculation-screen">
      <Txt kind="body" color="ink2">
        {t('settings.recomputeNote')}
      </Txt>
      <Txt kind="heading">{t('settings.ayanamsa')}</Txt>
      <Card flush>
        {AYANAMSAS.map((a, i) => (
          <RadioRow
            key={a}
            title={t(AYANAMSA_KEY[a])}
            selected={a === ayanamsa}
            onPress={() => {
              setSetting('ayanamsa', a);
              clearChartCache();
              setAyanamsa(a);
            }}
            divider={i < AYANAMSAS.length - 1}
            testID={`ayanamsa-${a}`}
          />
        ))}
      </Card>
      <Txt kind="heading">{t('settings.nodes')}</Txt>
      <Card flush>
        {NODES.map((n, i) => (
          <RadioRow
            key={n}
            title={t(NODE_KEY[n])}
            selected={n === node}
            onPress={() => {
              setSetting('node', n);
              clearChartCache();
              setNode(n);
            }}
            divider={i < NODES.length - 1}
            testID={`node-${n}`}
          />
        ))}
      </Card>
      <Card>
        <Txt kind="label" weight={400} color="ink2">
          {t('settings.kpHouses')}
        </Txt>
      </Card>
    </Screen>
  );
}
