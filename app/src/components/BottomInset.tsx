// Bottom inset (design.md 2.3, N15; DEV-1): the ONE value every bottom-anchored element adds for the system navigation
// bar - the tab bar ((tabs)/_layout), BannerStrip, the sticky CTA and the padding formula (Screen), and the Sheet.
// Primary source: react-native-safe-area-context (`useSafeAreaInsets().bottom`). Fallback: when it reports 0 while the
// window is drawn edge-to-edge (RN `edgeToEdgeEnabled`, enforced on Android 15+), the value comes from an invisible
// probe that React Native's own SafeAreaView pads natively through onApplyWindowInsets - an independent path from the
// context library's rootWindowInsets polling - so a device that never delivers the inset still clears the bar.
// `resolveBottomInset` is the pure rule (unit-tested); the provider only wires the sources.
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, TurboModuleRegistry, View } from 'react-native';
// RN's Fabric SafeAreaView (descriptor "SafeAreaView", Android view manager RCTSafeAreaView, state = system bars +
// cutout from onApplyWindowInsets). The public `SafeAreaView` export is a plain View on Android, so the native
// component is imported directly (types: src/types/rn-safe-area-native.d.ts).
import RNSafeAreaView from 'react-native/Libraries/Components/SafeAreaView/RCTSafeAreaViewNativeComponent';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isScreenshotBuild } from '../legal';

export interface BottomInsetSources {
  /** `useSafeAreaInsets().bottom` in dp. */
  reported: number;
  /** Probe measurement in dp; null until RN's SafeAreaView has laid out (and on non-edge-to-edge windows). */
  probe: number | null;
  /** The window is drawn behind the navigation bar (RN DeviceInfo `isEdgeToEdge`; true on Android when unknown). */
  edgeToEdge: boolean;
}

/** The inset to add below bottom chrome: the reported inset, else the probe when the window is edge-to-edge, else 0. */
export function resolveBottomInset(s: BottomInsetSources): number {
  if (s.reported > 0) return s.reported;
  if (s.edgeToEdge && s.probe != null && s.probe > 0) return s.probe;
  return 0;
}

interface DeviceInfoConstants {
  isEdgeToEdge?: boolean;
}

/** RN exports `isEdgeToEdge` from DeviceInfo (DeviceInfoModule.kt); android/gradle.properties sets edgeToEdgeEnabled=true. */
export function isEdgeToEdgeWindow(): boolean {
  if (Platform.OS !== 'android') return false;
  try {
    const mod = TurboModuleRegistry.get<{ getConstants: () => DeviceInfoConstants }>('DeviceInfo');
    const flag = mod?.getConstants?.().isEdgeToEdge;
    return typeof flag === 'boolean' ? flag : true;
  } catch {
    return true;
  }
}

export interface BottomInsetState extends BottomInsetSources {
  effective: number;
  /** Probe top inset in dp (readout only). */
  probeTop: number | null;
}

const BottomInsetContext = createContext<BottomInsetState | null>(null);

const T0 = Date.now();

export interface BottomInsetProviderProps {
  children: ReactNode;
  /** Test hook; production reads `isEdgeToEdgeWindow()`. */
  edgeToEdge?: boolean;
}

export function BottomInsetProvider({ children, edgeToEdge }: BottomInsetProviderProps) {
  const insets = useSafeAreaInsets();
  const e2e = edgeToEdge ?? isEdgeToEdgeWindow();
  const [probe, setProbe] = useState<{ top: number; bottom: number } | null>(null);
  const value = useMemo<BottomInsetState>(() => {
    const sources = { reported: insets.bottom, probe: probe?.bottom ?? null, edgeToEdge: e2e };
    return { ...sources, effective: resolveBottomInset(sources), probeTop: probe?.top ?? null };
  }, [insets.bottom, probe, e2e]);
  // Screenshot builds log every change so the emulator audit can see whether the inset arrives as 0 or late (DEV-1).
  const last = useRef('');
  useEffect(() => {
    if (!isScreenshotBuild()) return;
    const line = JSON.stringify({ t: Date.now() - T0, top: insets.top, reported: value.reported, probe: value.probe, probeTop: value.probeTop, edgeToEdge: value.edgeToEdge, effective: value.effective });
    if (line !== last.current) {
      last.current = line;
      console.log('dev/insets', line);
    }
  }, [value, insets.top]);
  return (
    <BottomInsetContext.Provider value={value}>
      {children}
      {e2e ? <InsetProbe onMeasure={setProbe} /> : null}
    </BottomInsetContext.Provider>
  );
}

/** The effective bottom inset in dp. Outside a provider it is the reported inset (tests that render one component). */
export function useBottomInset(): number {
  const ctx = useContext(BottomInsetContext);
  const insets = useSafeAreaInsets();
  return ctx ? ctx.effective : insets.bottom;
}

/** Every source behind the value (dev readout). */
export function useBottomInsetState(): BottomInsetState | null {
  return useContext(BottomInsetContext);
}

interface InsetProbeProps {
  onMeasure: (m: { top: number; bottom: number }) => void;
}

/**
 * Full-window RN SafeAreaView (native padding = system bars + cutout) with one filling child: child.y is the top inset,
 * outer height - child.y - child.height the bottom inset. Touch-transparent, hidden from accessibility, no pixels.
 */
function InsetProbe({ onMeasure }: InsetProbeProps) {
  const [outer, setOuter] = useState<number | null>(null);
  const [inner, setInner] = useState<{ y: number; height: number } | null>(null);
  useEffect(() => {
    if (outer == null || inner == null) return;
    onMeasure({ top: Math.max(0, Math.round(inner.y)), bottom: Math.max(0, Math.round(outer - inner.y - inner.height)) });
  }, [outer, inner, onMeasure]);
  return (
    <RNSafeAreaView pointerEvents="none" importantForAccessibility="no-hide-descendants" style={styles.probe} onLayout={(e) => setOuter(e.nativeEvent.layout.height)} testID="bottom-inset-probe">
      <View style={styles.fill} onLayout={(e) => setInner({ y: e.nativeEvent.layout.y, height: e.nativeEvent.layout.height })} testID="bottom-inset-probe-inner" />
    </RNSafeAreaView>
  );
}

const styles = StyleSheet.create({
  probe: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0 },
  fill: { flex: 1 },
});
