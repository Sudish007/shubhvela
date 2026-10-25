// Tab definitions and the tab button (design.md 3 / 8): 24 dp stroke icons, 12 sp labels wrapping to two lines,
// active = 3 px top indicator + accent, accessibilityRole tab + state.selected. Used by app/app/(tabs)/_layout.tsx.
import type { TabTriggerSlotProps } from 'expo-router/ui';
import type { ComponentRef, ComponentType, Ref } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChartsIcon, FamilyIcon, LearnIcon, TodayIcon, type IconProps } from '../components/icons';
import { Txt } from '../components/Txt';
import { useTokens } from '../theme/ThemeProvider';
import { size } from '../theme/tokens';

export type TabName = 'today' | 'family' | 'charts' | 'learn';

export interface TabDef {
  name: TabName;
  href: string;
  labelKey: string;
  Icon: ComponentType<IconProps>;
}

export const TABS: readonly TabDef[] = [
  { name: 'today', href: '/(tabs)/today', labelKey: 'tabs.today', Icon: TodayIcon },
  { name: 'family', href: '/(tabs)/family', labelKey: 'tabs.family', Icon: FamilyIcon },
  { name: 'charts', href: '/(tabs)/charts', labelKey: 'tabs.charts', Icon: ChartsIcon },
  { name: 'learn', href: '/(tabs)/learn', labelKey: 'tabs.learn', Icon: LearnIcon },
];

export type TabButtonProps = TabTriggerSlotProps & { label: string; Icon: ComponentType<IconProps> };

/** React 19: `ref` arrives as an ordinary prop (TabTrigger asChild clones the child with it). */
export function TabButton({ isFocused, label, Icon, href: _href, ref, ...props }: TabButtonProps) {
  const { colors } = useTokens();
  const color = isFocused ? colors.accent : colors.ink2;
  return (
    <Pressable
      ref={ref as unknown as Ref<ComponentRef<typeof Pressable>>}
      {...props}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!isFocused }}
      style={styles.tab}
    >
      <View style={[styles.indicator, { backgroundColor: isFocused ? colors.accent : 'transparent' }]} />
      <Icon color={color} />
      <Txt kind="micro" weight={600} color={isFocused ? 'accent' : 'ink2'} style={styles.label} numberOfLines={2}>
        {label}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tab: { flex: 1, minHeight: size.tabBar, alignItems: 'center', justifyContent: 'flex-start', paddingBottom: 6, gap: 2 },
  indicator: { height: 3, alignSelf: 'stretch', marginBottom: 7 },
  label: { textAlign: 'center', paddingHorizontal: 2 },
});
