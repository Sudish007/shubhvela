// NativeAdCard (design.md 5, M4, N10): the ONE native ad on Today, always the last card of the stack. A zero-height
// gate view measures where the card would start; the ad is requested and the card mounted only when that y is at or
// below the window height (below the fold at every width and font scale). Dashed border, "Ad" micro tag, the SDK's
// own AdChoices control (NativeAdView, adChoicesPlacement TOP_RIGHT - never a custom label), headline / body / media
// slots filled by the SDK, then a hairline + 16 dp and the footer "Pro removes every ad · Remove ads" -> /pro.
// No fill or error: the card collapses to nothing (the gate view stays at 0 dp).
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { NativeAdChoicesPlacement, NativeAdEventType, NativeAsset, NativeAssetType, NativeAdView, NativeMediaView, useNativeAd } from 'react-native-google-mobile-ads';
import { TextButton } from '../components/Button';
import { Tag } from '../components/Tag';
import { Txt } from '../components/Txt';
import { useLang } from '../i18n';
import { useTokens } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';
import { nativeMountAllowed, recordAdShown } from './AdPolicy';
import { useAdsInitialized } from './AdsRoot';

export interface NativeAdCardProps {
  unitId: string;
  /** Test override for the window height (production reads useWindowDimensions). */
  windowHeight?: number;
}

const REQUEST = { adChoicesPlacement: NativeAdChoicesPlacement.TOP_RIGHT };

export function NativeAdCard({ unitId, windowHeight }: NativeAdCardProps) {
  const { colors } = useTokens();
  const { t } = useLang();
  const router = useRouter();
  const dims = useWindowDimensions();
  const ready = useAdsInitialized();
  const [allowed, setAllowed] = useState(false);
  const fold = windowHeight ?? dims.height;
  const { status, nativeAd } = useNativeAd({ adUnitId: ready && allowed ? unitId : null, requestOptions: REQUEST });

  useEffect(() => {
    if (status !== 'loaded' || !nativeAd) return;
    const sub = nativeAd.addAdEventListener(NativeAdEventType.IMPRESSION, () => recordAdShown('native'));
    return () => sub.remove();
  }, [status, nativeAd]);

  return (
    <>
      {/* The gate: measures the top edge of the slot in the scroll content (page coordinates). */}
      <View
        testID="native-ad-gate"
        style={styles.gate}
        onLayout={(e) => {
          if (nativeMountAllowed(e.nativeEvent.layout.y, fold)) setAllowed(true);
        }}
      />
      {status === 'loaded' && nativeAd ? (
        <NativeAdView nativeAd={nativeAd} testID="native-ad-card" accessibilityLabel={t('ads.nativeA11y')} style={[styles.card, { borderColor: colors.hair2, backgroundColor: colors.surface }]}>
          <View style={styles.head}>
            <Tag variant="kind">{t('ads.label')}</Tag>
          </View>
          <NativeAsset assetType={NativeAssetType.HEADLINE}>
            <Text style={[styles.headline, { color: colors.ink }]}>{nativeAd.headline}</Text>
          </NativeAsset>
          {nativeAd.body ? (
            <NativeAsset assetType={NativeAssetType.BODY}>
              <Text style={[styles.body, { color: colors.ink2 }]}>{nativeAd.body}</Text>
            </NativeAsset>
          ) : null}
          {nativeAd.mediaContent ? <NativeMediaView style={styles.media} resizeMode="cover" /> : null}
          {nativeAd.callToAction ? (
            <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
              <Text style={[styles.cta, { color: colors.accent }]}>{nativeAd.callToAction}</Text>
            </NativeAsset>
          ) : null}
          <View style={[styles.footer, { borderTopColor: colors.hair }]}>
            <Txt kind="caption" color="ink2" style={styles.footerText}>
              {t('ads.proRemoves')}
            </Txt>
            <TextButton label={t('ads.removeAds')} onPress={() => router.push('/pro')} testID="native-ad-remove" />
          </View>
        </NativeAdView>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  gate: { height: 0, alignSelf: 'stretch' },
  card: { borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.card, padding: 16, gap: 8 },
  head: { flexDirection: 'row', justifyContent: 'flex-start', paddingRight: 28 },
  headline: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 20 },
  media: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.tag },
  cta: { fontSize: 15, lineHeight: 20, fontWeight: '600', minHeight: 44, paddingVertical: 12 },
  // The footer is separated from the ad content by a hairline and 16 dp (design.md 5; 16 dp ad-to-control rule).
  footer: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 8, paddingTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  footerText: { flexShrink: 1 },
});
