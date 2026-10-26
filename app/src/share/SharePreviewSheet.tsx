// Share-card preview sheet (F36, design.md 10.8): the card (laid out at 540 x 675 dp, shown scaled to the sheet
// width), the "Show birth time" switch (default Off; only for cards that carry a birth time), a 48 dp "Share" CTA that
// captures the PNG (1080 x 1350) and opens the system share sheet; a capture failure shows "Couldn't create the image"
// with Retry. Closing the sheet AFTER a share is the explicit forward action that may show the interstitial
// (`sharePreviewClosedAfterShare`, through AdPolicy only); closing without a share never does.
import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useInterstitial } from '../ads/useInterstitial';
import { PrimaryButton } from '../components/Button';
import { InlineNotice } from '../components/Notices';
import { Sheet } from '../components/Sheet';
import { Switch } from '../components/Switch';
import { Txt } from '../components/Txt';
import { useLang } from '../i18n';
import { CARD_H, CARD_W, captureCardPng, shareImage, type CaptureFn, type CardView, type ShareFn } from './ShareCard';

export interface SharePreviewSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Sheet title, e.g. t('share.cardKundli'). */
  title: string;
  /** Renders the card; receives the ref to capture and the switch state. */
  renderCard: (ref: RefObject<CardView | null>, showBirthTime: boolean) => ReactNode;
  /** Show the "Show birth time" switch (cards that carry a birth time). */
  hasBirthTime?: boolean;
  /** Injection for tests. */
  capture?: CaptureFn;
  share?: ShareFn;
}

type State = { kind: 'idle' } | { kind: 'busy' } | { kind: 'shared' } | { kind: 'failed' };

export function SharePreviewSheet({ visible, onClose, title, renderCard, hasBirthTime = false, capture = captureCardPng, share = shareImage }: SharePreviewSheetProps) {
  const { t } = useLang();
  const { width } = useWindowDimensions();
  const interstitial = useInterstitial();
  const ref = useRef<CardView | null>(null);
  const [showBirthTime, setShowBirthTime] = useState(false);
  const [state, setState] = useState<State>({ kind: 'idle' });
  const sharedRef = useRef(false);

  // The card is laid out at its capture size and scaled down to the sheet's inner width (16 dp gutters).
  const scale = Math.min(1, (width - 32) / CARD_W);

  const doShare = async () => {
    const view = ref.current;
    if (!view) return;
    setState({ kind: 'busy' });
    try {
      const uri = await capture(view);
      await share(uri, title);
      sharedRef.current = true;
      setState({ kind: 'shared' });
    } catch (e) {
      if (__DEV__) console.warn('share card failed', e);
      setState({ kind: 'failed' });
    }
  };

  const close = () => {
    // Forward action after a share (design.md 5 trigger list); a plain close never asks.
    if (sharedRef.current) interstitial.show('sharePreviewClosedAfterShare');
    onClose();
  };

  const busy = state.kind === 'busy';
  return (
    <Sheet
      visible={visible}
      onClose={close}
      title={title}
      footer={
        <View style={styles.footer} testID="share-preview-footer">
          {state.kind === 'failed' ? <InlineNotice tone="error">{t('share.imageFailed')}</InlineNotice> : null}
          {state.kind === 'shared' ? (
            <Txt kind="caption" color="ink2" accessibilityLiveRegion="polite" testID="share-preview-shared">
              {t('share.shared')}
            </Txt>
          ) : null}
          <PrimaryButton label={state.kind === 'failed' ? t('common.retry') : t('share.share')} onPress={() => void doShare()} disabled={busy} testID="share-preview-share" />
        </View>
      }
    >
      <View style={[styles.previewBox, { height: Math.ceil(CARD_H * scale) }]} accessibilityLabel={t('share.previewA11y', { card: title })} testID="share-preview-card-box">
        <View style={[styles.cardHolder, { transform: [{ scale }], width: CARD_W, height: CARD_H }]}>{renderCard(ref, showBirthTime)}</View>
      </View>
      {hasBirthTime ? (
        <View style={styles.switchRow}>
          <Txt kind="label" weight={400} style={styles.switchLabel}>
            {t('share.showBirthTime')}
          </Txt>
          <Switch value={showBirthTime} onValueChange={setShowBirthTime} accessibilityLabel={t('share.showBirthTime')} testID="share-show-birth-time" />
        </View>
      ) : null}
      {hasBirthTime && !showBirthTime ? (
        <Txt kind="caption" color="ink3" testID="share-birth-time-hidden">
          {t('share.birthTimeHidden')}
        </Txt>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  previewBox: { alignItems: 'center', justifyContent: 'flex-start', overflow: 'hidden' },
  cardHolder: { transformOrigin: 'top center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44 },
  switchLabel: { flex: 1 },
  footer: { gap: 8 },
});
