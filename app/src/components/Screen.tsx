// Screen (design.md 2.3, M4/M6/N15): the single owner of the fixed-chrome padding formula. Scroll content ends with
//   tab screens:      paddingBottom = tabBar(72) + bannerStrip (measured banner + 2 x 16 when AdPolicy shows one) + 16 + insets.bottom
//   sticky-CTA screens: paddingBottom = measuredCtaHeight (onLayout) + 16 + insets.bottom
//   plain stack screens (no tab bar, no CTA): paddingBottom = bannerStrip (allow-listed pushed screens, else 0) + 16 + insets.bottom
// The strip itself (BannerStrip) is rendered here when AdPolicy.bannerFor(route) === 'anchored' - screens never do.
// Header: title in Tiro 26/32 and either the gear (tab screens; accessibilityLabel "Settings") or a 44 dp Back control.
import { useRouter } from 'expo-router';
import { useState, type ReactNode, type RefObject } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewInstance, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBannerHeight, useBannerPlacement } from '../ads/AdPolicy';
import { BannerStrip } from '../ads/BannerStrip';
import { useLang } from '../i18n';
import { useTokens } from '../theme/ThemeProvider';
import { bottomPaddingAboveBanner, bottomPaddingAboveStickyCta, size } from '../theme/tokens';
import { BackIcon, GearIcon } from './icons';
import { Pressable44 } from './Pressable44';
import { Txt } from './Txt';

export type ScreenChrome = 'tabs' | 'stack';

export interface ScreenProps {
  title: string;
  /** 'tabs' = under the 72 dp tab bar with the gear; 'stack' = pushed screen with a Back control. */
  chrome?: ScreenChrome;
  /** Route name for AdPolicy (banner allow-list, M5). */
  route?: string;
  /** Hide the gear / back control (onboarding). */
  hideControl?: boolean;
  /** Secondary line under the title (e.g. the date line). Interpretive text must be a Row, not this. */
  subtitle?: ReactNode;
  /** Sticky bottom CTA; when set the padding switches to the CTA formula. */
  stickyCta?: ReactNode;
  /** Replaces the gear on tab screens (A11's profile picker lives in the body, not here); on stack screens a 44 dp control at the right of the title (B05's saved-list icon). */
  headerRight?: ReactNode;
  /** Pinned strip between the status inset and the scrolling content (the dasha tree's "you are here" header). */
  pinned?: ReactNode;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
  onBack?: () => void;
  /** Ref to the content ScrollView for programmatic scrolling (Charts "Try it on your chart" card anchors, F32). */
  scrollRef?: RefObject<ScrollViewInstance | null>;
}

export function screenBottomPadding(args: { chrome: ScreenChrome; bannerHeight: number | null; ctaHeight: number | null; insetBottom: number }): number {
  if (args.ctaHeight != null) return bottomPaddingAboveStickyCta(args.ctaHeight, args.insetBottom);
  if (args.chrome === 'tabs') return bottomPaddingAboveBanner(args.bannerHeight, args.insetBottom);
  const strip = args.bannerHeight == null ? 0 : args.bannerHeight + 2 * size.bannerPadding;
  return strip + 16 + args.insetBottom;
}

export function Screen({ title, chrome = 'tabs', route = '', hideControl, subtitle, stickyCta, headerRight, pinned, children, contentStyle, testID, onBack, scrollRef }: ScreenProps) {
  const { colors } = useTokens();
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bannerHeight = useBannerHeight(route);
  const banner = useBannerPlacement(route);
  const [ctaHeight, setCtaHeight] = useState<number | null>(null);
  const paddingBottom = screenBottomPadding({ chrome, bannerHeight, ctaHeight: stickyCta ? ctaHeight ?? 0 : null, insetBottom: insets.bottom });

  const control = hideControl ? null : chrome === 'tabs' ? (
    headerRight ?? (
      <Pressable44 accessibilityLabel={t('common.settings')} onPress={() => router.push('/settings')} testID="screen-gear">
        <GearIcon color={colors.ink} />
      </Pressable44>
    )
  ) : (
    <Pressable44 accessibilityLabel={t('common.back')} onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))} testID="screen-back">
      <BackIcon color={colors.ink} />
    </Pressable44>
  );

  return (
    <View testID={testID} style={[styles.root, { backgroundColor: colors.paper, paddingTop: insets.top }]}>
      {pinned ? (
        <View testID="screen-pinned" style={[styles.pinned, { backgroundColor: colors.surface, borderBottomColor: colors.hair }]}>
          {pinned}
        </View>
      ) : null}
      <ScrollView ref={scrollRef} testID="screen-scroll" style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom }, contentStyle]} keyboardShouldPersistTaps="handled">
        <View style={[styles.header, chrome === 'stack' && styles.headerStack]}>
          {chrome === 'stack' ? control : null}
          <View style={styles.titleBlock}>
            <Txt kind="display" accessibilityRole="header">
              {title}
            </Txt>
            {subtitle ? <View style={styles.subtitle}>{subtitle}</View> : null}
          </View>
          {chrome === 'tabs' ? control : headerRight ?? null}
        </View>
        {children}
      </ScrollView>
      {banner === 'anchored' && !stickyCta ? <BannerStrip route={route} insetBottom={chrome === 'tabs' ? 0 : insets.bottom} /> : null}
      {stickyCta ? (
        <View style={[styles.cta, { backgroundColor: colors.surface, borderTopColor: colors.hair, paddingBottom: insets.bottom }]}>
          {/* The measured box excludes the safe-area inset so the formula adds it exactly once. */}
          <View testID="screen-cta" onLayout={(e) => setCtaHeight(Math.round(e.nativeEvent.layout.height))} style={styles.ctaInner}>
            {stickyCta}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pinned: { paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, minHeight: 44 },
  headerStack: { alignItems: 'center' },
  titleBlock: { flex: 1, minWidth: 0, paddingTop: 6 },
  subtitle: { marginTop: 4 },
  cta: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: StyleSheet.hairlineWidth },
  ctaInner: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },
});
