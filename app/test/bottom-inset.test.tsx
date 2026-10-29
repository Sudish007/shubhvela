// DEV-1: the bottom inset every bottom-anchored element adds (design.md 2.3, N15) and its edge-to-edge fallback.
// The context library's value wins when it is > 0; when it reports 0 under an edge-to-edge window the RN SafeAreaView
// probe supplies the navigation-bar height; the tab bar style is one flat object so the Radix Slot merge keeps it.
import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { renderWithProviders, TEST_INSETS } from './helpers/render';
import { BottomInsetProvider, resolveBottomInset, useBottomInset } from '../src/components/BottomInset';
import { Screen } from '../src/components/Screen';
import { Sheet } from '../src/components/Sheet';
import { tabBarStyle } from '../src/navigation/tabs';
import { size } from '../src/theme/tokens';

function Readout() {
  const inset = useBottomInset();
  return <Text testID="inset">{String(inset)}</Text>;
}

/** Deepest instance with that testID (RN's native SafeAreaView is a codegen component under Jest, not a host View). */
function byTestId(id: string) {
  const all = screen.root?.queryAll((n) => n.props.testID === id) ?? [];
  if (all.length === 0) throw new Error(`no element with testID ${id}`);
  return all[all.length - 1];
}

/** Lay the probe out as a 390 x 844 window whose RN SafeAreaView padded `top` above and `bottom` below the child. */
async function layoutProbe(top: number, bottom: number) {
  await fireEvent(byTestId('bottom-inset-probe'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } } });
  await fireEvent(byTestId('bottom-inset-probe-inner'), 'layout', { nativeEvent: { layout: { x: 0, y: top, width: 390, height: 844 - top - bottom } } });
}

const ZERO_METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, bottom: 0, left: 0, right: 0 } };

describe('resolveBottomInset', () => {
  it('uses the reported inset whenever it is positive (gesture 24, 3-button 48)', () => {
    expect(resolveBottomInset({ reported: 24, probe: 48, edgeToEdge: true })).toBe(24);
    expect(resolveBottomInset({ reported: 48, probe: null, edgeToEdge: true })).toBe(48);
    expect(resolveBottomInset({ reported: 34, probe: 0, edgeToEdge: false })).toBe(34);
  });

  it('falls back to the probe only when the reported inset is 0 under an edge-to-edge window', () => {
    expect(resolveBottomInset({ reported: 0, probe: 48, edgeToEdge: true })).toBe(48);
    expect(resolveBottomInset({ reported: 0, probe: 24, edgeToEdge: true })).toBe(24);
    expect(resolveBottomInset({ reported: 0, probe: 48, edgeToEdge: false })).toBe(0);
    expect(resolveBottomInset({ reported: 0, probe: null, edgeToEdge: true })).toBe(0);
    expect(resolveBottomInset({ reported: 0, probe: 0, edgeToEdge: true })).toBe(0);
  });
});

describe('BottomInsetProvider', () => {
  it('passes the reported inset through and ignores the probe when the library delivers a value', async () => {
    await renderWithProviders(
      <BottomInsetProvider edgeToEdge>
        <Readout />
      </BottomInsetProvider>,
    );
    expect(screen.getByTestId('inset').props.children).toBe(String(TEST_INSETS.bottom));
    await layoutProbe(24, 48);
    expect(screen.getByTestId('inset').props.children).toBe(String(TEST_INSETS.bottom));
  });

  it('reports the probe measurement when the library says 0 under edge-to-edge (3-button bar 48 dp)', async () => {
    await renderWithProviders(
      <SafeAreaProvider initialMetrics={ZERO_METRICS}>
        <BottomInsetProvider edgeToEdge>
          <Readout />
        </BottomInsetProvider>
      </SafeAreaProvider>,
    );
    expect(screen.getByTestId('inset').props.children).toBe('0');
    await layoutProbe(24, 48);
    expect(screen.getByTestId('inset').props.children).toBe('48');
  });

  it('renders no probe and keeps 0 when the window is not edge-to-edge (the system already resized it)', async () => {
    await renderWithProviders(
      <SafeAreaProvider initialMetrics={ZERO_METRICS}>
        <BottomInsetProvider edgeToEdge={false}>
          <Readout />
        </BottomInsetProvider>
      </SafeAreaProvider>,
    );
    expect(screen.root?.queryAll((n) => n.props.testID === 'bottom-inset-probe') ?? []).toHaveLength(0);
    expect(screen.getByTestId('inset').props.children).toBe('0');
  });

  it('the probe is touch-transparent, invisible and hidden from accessibility', async () => {
    await renderWithProviders(
      <BottomInsetProvider edgeToEdge>
        <Readout />
      </BottomInsetProvider>,
    );
    const probe = byTestId('bottom-inset-probe');
    expect(probe.props.pointerEvents).toBe('none');
    expect(probe.props.importantForAccessibility).toBe('no-hide-descendants');
    const style = StyleSheet.flatten(probe.props.style);
    expect(style.position).toBe('absolute');
    expect(style.opacity).toBe(0);
  });
});

describe('bottom-anchored chrome follows the resolved inset', () => {
  it('Screen padding and the sticky CTA box use the fallback value when the library reports 0', async () => {
    await renderWithProviders(
      <SafeAreaProvider initialMetrics={ZERO_METRICS}>
        <BottomInsetProvider edgeToEdge>
          <Screen title="Pro" chrome="stack" stickyCta={<View style={{ height: 48 }} />}>
            <Text>body</Text>
          </Screen>
        </BottomInsetProvider>
      </SafeAreaProvider>,
    );
    await fireEvent(screen.getByTestId('screen-cta'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 120 } } });
    await layoutProbe(24, 48);
    const padding = StyleSheet.flatten(screen.getByTestId('screen-scroll').props.contentContainerStyle).paddingBottom;
    expect(padding).toBe(120 + 16 + 48);
    expect(StyleSheet.flatten(screen.getByTestId('screen-cta-box').props.style).paddingBottom).toBe(48);
  });

  it('Sheet bottom padding = inset + 16 from the same source, and its Modal is edge-to-edge', async () => {
    await renderWithProviders(
      <SafeAreaProvider initialMetrics={ZERO_METRICS}>
        <BottomInsetProvider edgeToEdge>
          <Sheet visible onClose={() => {}} title="Panchang">
            <Text>body</Text>
          </Sheet>
        </BottomInsetProvider>
      </SafeAreaProvider>,
    );
    await layoutProbe(24, 48);
    expect(StyleSheet.flatten(screen.getByTestId('sheet-panel').props.style).paddingBottom).toBe(48 + 16);
    const modal = (screen.root?.queryAll((n) => 'navigationBarTranslucent' in n.props) ?? [])[0];
    expect(modal).toBeDefined();
    expect(modal.props.navigationBarTranslucent).toBe(true);
    expect(modal.props.statusBarTranslucent).toBe(true);
  });

  it('tabBarStyle is one flat object: 72 dp + inset high with the inset as bottom padding', () => {
    const s = tabBarStyle({ insetBottom: 48, surface: '#fff', hair: '#eee' });
    expect(Array.isArray(s)).toBe(false);
    expect(s.height).toBe(size.tabBar + 48);
    expect(s.paddingBottom).toBe(48);
    expect(s.backgroundColor).toBe('#fff');
    expect(s.borderTopColor).toBe('#eee');
    expect(s.flexDirection).toBe('row');
    // The Radix Slot merge is an object spread: every key must survive `{ ...slotStyle, ...childStyle }`.
    const merged = { ...{ flexDirection: 'row' }, ...s };
    expect(merged.height).toBe(size.tabBar + 48);
    expect(Object.keys(merged).some((k) => /^\d+$/.test(k))).toBe(false);
  });
});
