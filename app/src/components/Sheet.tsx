// Bottom sheet (design.md 2.3, N22): Modal over the scrim token, fixed grab handle + title, scrolling body, 44 dp
// Close control. The only animation in the app is the slide; AccessibilityInfo reduced motion turns it off.
import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLang } from '../i18n';
import { useTokens } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';
import { Pressable44 } from './Pressable44';
import { Txt } from './Txt';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Rendered under the scrolling body, above the safe-area inset (e.g. a confirm button row). */
  footer?: ReactNode;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduced(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

export function Sheet({ visible, onClose, title, children, footer }: SheetProps) {
  const { colors } = useTokens();
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  return (
    <Modal visible={visible} transparent animationType={reduced ? 'none' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable accessibilityLabel={t('common.close')} accessibilityRole="button" onPress={onClose} style={[styles.scrim, { backgroundColor: colors.scrim }]} />
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.hair, paddingBottom: insets.bottom + 16 }]} accessibilityViewIsModal>
          <View style={[styles.handle, { backgroundColor: colors.hair2 }]} />
          <View style={styles.head}>
            <Txt kind="sheetTitle" style={styles.title} accessibilityRole="header">
              {title}
            </Txt>
            <Pressable44 accessibilityLabel={t('common.close')} onPress={onClose}>
              <Txt kind="label" color="accent">
                {t('common.close')}
              </Txt>
            </Pressable44>
          </View>
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginTop: 8, marginBottom: 8 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1 },
  body: { flexGrow: 0 },
  bodyContent: { paddingVertical: 8, gap: 12 },
  footer: { paddingTop: 12 },
});
