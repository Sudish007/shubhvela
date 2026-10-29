// Four tabs (spec section 8, design.md 3): Today - Family - Charts - Learn. Headless expo-router tabs with our own
// 72 dp bar: surface + top hairline, inline SVG icons (no emoji), labels 12 sp, safe-area inset added below (N15).
// DEV-1: `TabList asChild` clones this View through a Radix Slot, which merges `style` with an object spread
// ({ ...slotStyle, ...childStyle }). An ARRAY style therefore arrived as { "0": ..., "1": ... } and every bar style
// (height + inset, paddingBottom, surface, hairline) was dropped in release builds - the bar was the 72 dp content
// height with no inset and the system navigation bar covered the labels on 3-button phones. The style is now one flat
// object (tabBarStyle in src/navigation/tabs.tsx, unit-tested) and the inset comes from useBottomInset (edge-to-edge
// fallback included).
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { StyleSheet, View } from 'react-native';
import { useBottomInset } from '../../src/components/BottomInset';
import { useLang } from '../../src/i18n';
import { TABS, TabButton, tabBarStyle } from '../../src/navigation/tabs';
import { useTokens } from '../../src/theme/ThemeProvider';

export default function TabsLayout() {
  const { colors } = useTokens();
  const { t } = useLang();
  const insetBottom = useBottomInset();
  return (
    <Tabs style={styles.root}>
      <TabSlot style={styles.slot} />
      <TabList asChild>
        <View accessibilityRole="tablist" testID="tab-bar" style={tabBarStyle({ insetBottom, surface: colors.surface, hair: colors.hair })}>
          {TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton label={t(tab.labelKey)} Icon={tab.Icon} />
            </TabTrigger>
          ))}
        </View>
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  slot: { flex: 1 },
});
