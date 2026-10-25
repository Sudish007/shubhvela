// Four tabs (spec section 8, design.md 3): Today - Family - Charts - Learn. Headless expo-router tabs with our own
// 72 dp bar: surface + top hairline, inline SVG icons (no emoji), labels 12 sp, safe-area inset added below (N15).
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLang } from '../../src/i18n';
import { TABS, TabButton } from '../../src/navigation/tabs';
import { useTokens } from '../../src/theme/ThemeProvider';
import { size } from '../../src/theme/tokens';

export default function TabsLayout() {
  const { colors } = useTokens();
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  return (
    <Tabs style={styles.root}>
      <TabSlot style={styles.slot} />
      <TabList asChild>
        <View
          accessibilityRole="tablist"
          style={[styles.bar, { backgroundColor: colors.surface, borderTopColor: colors.hair, height: size.tabBar + insets.bottom, paddingBottom: insets.bottom }]}
        >
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
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, alignItems: 'stretch' },
});
