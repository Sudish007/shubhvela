// BannerStrip (design.md 5, M6, N11): the anchored adaptive banner inside an opaque `paper` strip with 16 dp padding
// on all four sides, pinned above the tab bar (tab screens) or at the bottom (pushed allow-listed screens). It is
// rendered by Screen only when AdPolicy.bannerFor(route) === 'anchored'; the measured banner height is published to
// AdPolicy so Screen's padding formula (measured + 32) keeps scrolled content 16 dp clear. No fill -> the strip
// reports failure, AdPolicy answers 'none', the strip unmounts and the padding recalculates (never a blank box).
import { StyleSheet, View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { useLang } from '../i18n';
import { useTokens } from '../theme/ThemeProvider';
import { size } from '../theme/tokens';
import { reportBannerFailed, reportBannerLoaded, unitIds, useBannerHeight } from './AdPolicy';
import { useAdsInitialized } from './AdsRoot';

export interface BannerStripProps {
  route: string;
  /** Safe-area inset below the strip (0 on tab screens: the tab bar already carries it). */
  insetBottom: number;
}

export function BannerStrip({ route, insetBottom }: BannerStripProps) {
  const { colors } = useTokens();
  const { t } = useLang();
  const ready = useAdsInitialized();
  const measured = useBannerHeight(route);
  if (!ready) return null;
  return (
    <View
      testID="banner-strip"
      accessibilityLabel={t('ads.bannerA11y')}
      style={[styles.strip, { backgroundColor: colors.paper, borderTopColor: colors.hair, paddingBottom: size.bannerPadding + insetBottom }, measured == null && styles.measuring]}
    >
      <BannerAd
        unitId={unitIds().banner}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdLoaded={({ height }) => reportBannerLoaded(route, height)}
        onAdFailedToLoad={() => reportBannerFailed(route)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', padding: size.bannerPadding, borderTopWidth: StyleSheet.hairlineWidth },
  // Until the SDK reports a height the strip takes no room and draws nothing visible (no empty box).
  measuring: { padding: 0, borderTopWidth: 0, height: 0, overflow: 'hidden' },
});
