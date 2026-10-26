// Scan a code (F30, design.md 10.6 F30 "Scan a code (expo-camera)"): camera permission handling (ask, denied -> the
// honest message + "Type a code" instead), a full-width CameraView limited to QR codes, local decoding of the QR's
// /m/ URL (or a raw code) and the one invalid message when the QR is something else. Nothing leaves the phone.
import { encodeShareCode } from '@shubhvela/engine';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMountClock } from '../charts/LockedFeature';
import { PrimaryButton, SecondaryButton } from '../components/Button';
import { InlineNotice } from '../components/Notices';
import { Screen } from '../components/Screen';
import { Txt } from '../components/Txt';
import { useLang } from '../i18n';
import { useTokens } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';
import { decodeShared } from './payload';

export interface ScanScreenProps {
  /** Receives the normalised 20-character code of the scanned payload. */
  onDecoded: (code: string) => void;
  /** "Type a code instead" and the denied-permission fallback. */
  onTypeInstead: () => void;
  /** Clock for the payload's date-range check (tests). */
  now?: () => number;
  testID?: string;
}

/** The scanned text -> normalised code, or null when it is not a Shubhvela payload. */
export function codeFromScan(data: string, nowMs: number = Date.now()): string | null {
  const payload = decodeShared(data, nowMs);
  return payload ? encodeShareCode(payload) : null;
}

const INVALID_HOLD_MS = 1500;

export function ScanScreen({ onDecoded, onTypeInstead, now, testID }: ScanScreenProps) {
  const { t } = useLang();
  const { colors } = useTokens();
  const nowMs = useMountClock(now);
  const [permission, requestPermission] = useCameraPermissions();
  const [invalid, setInvalid] = useState(false);
  const [done, setDone] = useState(false);
  const doneRef = useRef(false);
  const lastInvalid = useRef(0);

  function onScanned(r: BarcodeScanningResult) {
    if (doneRef.current) return;
    const code = codeFromScan(r.data, nowMs);
    if (code) {
      doneRef.current = true;
      setDone(true);
      onDecoded(code);
      return;
    }
    const now = Date.now();
    if (now - lastInvalid.current > INVALID_HOLD_MS) {
      lastInvalid.current = now;
      setInvalid(true);
      setTimeout(() => setInvalid(false), INVALID_HOLD_MS);
    }
  }

  const granted = permission?.granted === true;
  return (
    <Screen title={t('share.scanTitle')} chrome="stack" testID={testID ?? 'scan-screen'}>
      {!permission ? null : granted ? (
        <>
          <View style={[styles.camera, { borderColor: colors.hair, backgroundColor: colors.ink }]} testID="scan-camera">
            <CameraView style={styles.fill} facing="back" active={!done} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={onScanned} />
          </View>
          <Txt kind="body" color="ink2" testID="scan-hint">
            {t('share.scanning')}
          </Txt>
          {invalid ? <InlineNotice tone="error">{t('share.invalid')}</InlineNotice> : null}
        </>
      ) : (
        <>
          <InlineNotice>{t('share.cameraDenied')}</InlineNotice>
          {permission.canAskAgain ? <PrimaryButton label={t('share.cameraAsk')} onPress={() => void requestPermission()} testID="scan-ask" /> : null}
        </>
      )}
      <SecondaryButton label={t('share.type')} onPress={onTypeInstead} testID="scan-type-instead" />
      <Txt kind="caption" color="ink3">
        {t('share.codeContains')}
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  camera: { aspectRatio: 1, alignSelf: 'stretch', borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  fill: { flex: 1 },
});
