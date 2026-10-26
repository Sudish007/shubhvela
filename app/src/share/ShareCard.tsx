// Share cards (spec F36, design.md 10.8): every card is laid out at CARD_W x CARD_H dp (540 x 675, the 4:5 portrait
// ratio) and captured by react-native-view-shot into a 1080 x 1350 PNG. The frame is paper with ink text and the one
// saffron accent - no gradients, no shadows - and ALWAYS carries the wordmark and the web URL. Cards render in the
// light palette whatever the app theme (a shared image has no theme), so the frame wraps its content in a light
// ThemeProvider. Capture is behind an injectable function so the preview sheet is unit-tested without the native module.
import { forwardRef, type ComponentRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLang } from '../i18n';
import { ThemeProvider } from '../theme/ThemeProvider';
import { colors, radius } from '../theme/tokens';
import { Txt } from '../components/Txt';

/** Layout size in dp; the PNG is exactly twice that (F36: 1080 x 1350). */
export const CARD_W = 540;
export const CARD_H = 675;
export const PNG_W = 1080;
export const PNG_H = 1350;

export const WORDMARK = 'Shubhvela · शुभवेला';

export type ShareCardKind = 'kundli' | 'guna' | 'panchang' | 'festival';

/** Host element type of a card's root View (what view-shot captures). */
export type CardView = ComponentRef<typeof View>;

export interface CardFrameProps {
  kind: ShareCardKind;
  /** Small caption at the top ("My kundli card", "Today's panchang · Lucknow"). */
  kicker: string;
  children: ReactNode;
  testID?: string;
}

/** The common frame: kicker, content, footer with the wordmark and the web URL. */
export const CardFrame = forwardRef<CardView, CardFrameProps>(function CardFrame({ kind, kicker, children, testID }, ref) {
  const { t } = useLang();
  const c = colors.light;
  return (
    <ThemeProvider initialSetting="light">
      <View ref={ref} collapsable={false} testID={testID ?? `share-card-${kind}`} style={[styles.card, { backgroundColor: c.paper, borderColor: c.hair2 }]}>
        <Txt kind="label" weight={600} color="accent" testID="share-card-kicker">
          {kicker}
        </Txt>
        <View style={styles.body}>{children}</View>
        <View style={[styles.footer, { borderTopColor: c.hair2 }]}>
          <Txt kind="sheetTitle" color="ink" testID="share-card-wordmark">
            {WORDMARK}
          </Txt>
          <Txt kind="label" weight={400} color="ink2" latin testID="share-card-url">
            {t('share.footerUrl')}
          </Txt>
        </View>
      </View>
    </ThemeProvider>
  );
});

export type CaptureFn = (view: CardView) => Promise<string>;

/** Default capture: react-native-view-shot, PNG, resized to 1080 x 1350, temp file URI. */
export async function captureCardPng(view: CardView): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { captureRef } = require('react-native-view-shot') as typeof import('react-native-view-shot');
  return captureRef(view, { format: 'png', quality: 1, width: PNG_W, height: PNG_H, result: 'tmpfile' });
}

export type ShareFn = (uri: string, title: string) => Promise<void>;

/** Default share: the system share sheet (expo-sharing) with the PNG. */
export async function shareImage(uri: string, title: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Sharing = require('expo-sharing') as typeof import('expo-sharing');
  await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: title, UTI: 'public.png' });
}

const styles = StyleSheet.create({
  card: { width: CARD_W, height: CARD_H, borderRadius: radius.card, borderWidth: 1, padding: 32, justifyContent: 'space-between' },
  body: { flex: 1, justifyContent: 'center', gap: 12, paddingVertical: 16 },
  footer: { borderTopWidth: 1, paddingTop: 12, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
});
