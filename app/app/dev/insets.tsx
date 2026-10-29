// Screenshot-mode readout (DEV-1): shubhvela://dev/state?screen=/dev/insets prints every safe-area number the app
// receives, live, so the emulator audit can see whether the bottom inset arrives as 0 or late in each navigation mode:
// useSafeAreaInsets() (the context library), initialWindowMetrics, the RN SafeAreaView probe, the resolved value every
// bottom-anchored element uses, the edge-to-edge flag, window/screen sizes and a timeline of the reported bottom inset.
// Active ONLY in builds with EXPO_PUBLIC_SCREENSHOT_MODE=1 (same gate as dev/state); otherwise it redirects home.
import { Redirect } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Dimensions, PixelRatio, StyleSheet, View } from 'react-native';
import { initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomInsetState } from '../../src/components/BottomInset';
import { Screen } from '../../src/components/Screen';
import { Txt } from '../../src/components/Txt';
import { isScreenshotBuild } from '../../src/legal';

const T0 = Date.now();

function Line({ id, label, value }: { id: string; label: string; value: string }) {
  return (
    <View style={styles.line} testID={`insets-${id}`}>
      <Txt kind="caption" color="ink2">
        {label}
      </Txt>
      <Txt kind="body" latin tabular accessibilityLabel={`${label} ${value}`}>
        {value}
      </Txt>
    </View>
  );
}

export default function DevInsets() {
  const enabled = isScreenshotBuild();
  const insets = useSafeAreaInsets();
  const state = useBottomInsetState();
  const [timeline, setTimeline] = useState<string[]>([]);
  const lastBottom = useRef<number | null>(null);
  useEffect(() => {
    if (lastBottom.current === insets.bottom) return;
    lastBottom.current = insets.bottom;
    const entry = `${Date.now() - T0} ms: bottom ${insets.bottom.toFixed(1)}`;
    setTimeline((t) => [...t, entry]);
  }, [insets.bottom]);
  if (!enabled) return <Redirect href="/" />;
  const win = Dimensions.get('window');
  const scr = Dimensions.get('screen');
  const fmt = (n: number | null | undefined) => (n == null ? 'null' : n.toFixed(1));
  const initial = initialWindowMetrics?.insets;
  return (
    <Screen title="Insets readout" chrome="stack" testID="dev-insets">
      <Line id="reported" label="useSafeAreaInsets top / bottom / left / right (dp)" value={`${fmt(insets.top)} / ${fmt(insets.bottom)} / ${fmt(insets.left)} / ${fmt(insets.right)}`} />
      <Line id="initial" label="initialWindowMetrics bottom (dp)" value={initial ? fmt(initial.bottom) : 'null'} />
      <Line id="probe" label="RN SafeAreaView probe top / bottom (dp)" value={state ? `${fmt(state.probeTop)} / ${fmt(state.probe)}` : 'no provider'} />
      <Line id="effective" label="effective bottom inset used by chrome (dp)" value={state ? fmt(state.effective) : fmt(insets.bottom)} />
      <Line id="e2e" label="edge-to-edge window" value={state ? String(state.edgeToEdge) : 'unknown'} />
      <Line id="dims" label="window / screen height (dp), density, fontScale" value={`${fmt(win.height)} / ${fmt(scr.height)}, ${PixelRatio.get().toFixed(3)}, ${PixelRatio.getFontScale().toFixed(2)}`} />
      <Line id="timeline" label="reported bottom inset since this screen mounted" value={timeline.join(' | ') || '-'} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  line: { gap: 2 },
});
