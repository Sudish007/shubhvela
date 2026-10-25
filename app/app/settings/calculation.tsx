// Settings -> Calculation (F19): ayanamsa Lahiri/KP/Raman, nodes Mean/True, KP house system Placidus (read-only).
// Changing ayanamsa or node recomputes EVERY profile's chart right away (engine-bridge.recomputeAllCharts) and then
// shows the toast "Recomputed for <ayanamsa> ayanamsa" / "Recomputed with the <node> node" (design.md 10.3 F19).
import { useState } from 'react';
import { Platform, ToastAndroid } from 'react-native';
import { Card, RadioRow, Screen, Txt } from '../../src/components';
import { getSetting, setSetting } from '../../src/db/settings';
import { recomputeAllCharts } from '../../src/engine-bridge/charts';
import { useLang } from '../../src/i18n';
import { AYANAMSA_KEY, NODE_KEY, shortValue } from '../../src/settingsLabels';
import type { Ayanamsa, NodeMode } from '@shubhvela/engine';

const AYANAMSAS: readonly Ayanamsa[] = ['lahiri', 'kp', 'raman'];
const NODES: readonly NodeMode[] = ['mean', 'true'];

/** The toast after a recomputation; a no-op off Android (tests run under jest-expo's RN mock). */
export function showRecomputedToast(message: string): void {
  if (Platform.OS === 'android' && ToastAndroid?.show) ToastAndroid.show(message, ToastAndroid.SHORT);
}

export default function CalculationScreen() {
  const { t } = useLang();
  const [ayanamsa, setAyanamsa] = useState<Ayanamsa>(() => getSetting('ayanamsa'));
  const [node, setNode] = useState<NodeMode>(() => getSetting('node'));
  const [lastToast, setLastToast] = useState<string | null>(null);
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
              if (a === ayanamsa) return;
              setSetting('ayanamsa', a);
              recomputeAllCharts();
              setAyanamsa(a);
              const msg = t('charts.recomputedAyanamsa', { ayanamsa: shortValue(t(AYANAMSA_KEY[a])) });
              setLastToast(msg);
              showRecomputedToast(msg);
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
              if (n === node) return;
              setSetting('node', n);
              recomputeAllCharts();
              setNode(n);
              // The adjective alone ("mean" / "true", "मध्यम" / "स्पष्ट"): the first word of the node label in every language.
              const msg = t('charts.recomputedNode', { node: shortValue(t(NODE_KEY[n])).split(' ')[0].toLowerCase() });
              setLastToast(msg);
              showRecomputedToast(msg);
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
      {lastToast ? (
        // The same sentence as the toast, kept on screen for TalkBack and for tests (toasts are transient and
        // not announced reliably); it only appears after a real recomputation.
        <Txt kind="caption" color="ink2" accessibilityLiveRegion="polite" testID="recomputed-note">
          {lastToast}
        </Txt>
      ) : null}
    </Screen>
  );
}
