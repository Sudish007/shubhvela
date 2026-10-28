// Model download screen (F35, design.md 10.7): progress "{done} of 2.6 GB" (both numbers computed from bytes), Pause /
// Resume / Cancel, the Wi-Fi pause message "Download paused — reconnect to Wi-Fi" (never auto-resumed on mobile data),
// the verification step (size + SHA-256), the checksum failure with Delete-and-retry, and "Model ready" with a button
// into the chat. The machine lives in src/ai/download.ts; this screen only renders its phase.
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { type DownloadPhase, type ModelDownloader } from '../../../src/ai/download';
import { gbLabel, MODEL_BYTES, modelSizeLabel } from '../../../src/ai/model';
import { useModelDownload } from '../../../src/ai/useModelDownload';
import { Card, InlineNotice, Num, PrimaryButton, Screen, SecondaryButton, TextButton, Txt } from '../../../src/components';
import { useLang } from '../../../src/i18n';
import { useTokens } from '../../../src/theme/ThemeProvider';
import { RichText } from '../../../src/today/RichText';

export interface AskDownloadScreenProps {
  /** Injection for tests. */
  downloader?: ModelDownloader;
  /** Start automatically on mount (the consent CTA lands here); tests may disable. */
  autoStart?: boolean;
}

export function progressPercent(phase: DownloadPhase): number {
  const bytes = phase.kind === 'downloading' || phase.kind === 'paused' ? phase.bytes : phase.kind === 'ready' ? MODEL_BYTES : 0;
  return Math.max(0, Math.min(100, Math.round((bytes / MODEL_BYTES) * 100)));
}

export default function AskDownloadScreen({ downloader, autoStart = true }: AskDownloadScreenProps) {
  const { t } = useLang();
  const { colors } = useTokens();
  const router = useRouter();
  const dl = useModelDownload(downloader);
  const started = useRef(false);
  useEffect(() => {
    if (!autoStart || started.current) return;
    started.current = true;
    void dl.start();
    // The start is a one-time arrival effect; later taps go through the buttons.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const { phase } = dl;
  const pct = progressPercent(phase);
  const done = phase.kind === 'downloading' || phase.kind === 'paused' ? gbLabel(phase.bytes) : phase.kind === 'ready' ? modelSizeLabel() : gbLabel(0);

  return (
    <Screen title={t('ask.rowTitle')} chrome="stack" testID="ask-download-screen">
      <Card testID="ask-download-card">
        {phase.kind === 'downloading' ? (
          <>
            <RichText kind="body" text={t('ask.downloading', { progress: `${pct}%` })} testID="ask-download-progress" />
            <RichText kind="caption" color="ink2" text={t('ask.downloadedOf', { done })} testID="ask-download-of" />
          </>
        ) : null}
        {phase.kind === 'paused' ? (
          <>
            <Txt kind="body" weight={600} testID="ask-download-paused">
              {phase.reason === 'wifi' ? t('ask.downloadPaused') : t('ask.downloadPausedByYou')}
            </Txt>
            <RichText kind="caption" color="ink2" text={t('ask.downloadedOf', { done })} testID="ask-download-of" />
          </>
        ) : null}
        {phase.kind === 'verifying' ? (
          <Txt kind="body" testID="ask-download-verifying">
            {t('ask.verifying')}
          </Txt>
        ) : null}
        {phase.kind === 'ready' ? (
          <Txt kind="body" weight={600} testID="ask-download-ready">
            {t('ask.ready')}
          </Txt>
        ) : null}
        {phase.kind === 'failed' ? <InlineNotice tone="error">{phase.reason === 'checksum' || phase.reason === 'size' ? t('ask.verifyFailed') : t('ask.downloadFailed')}</InlineNotice> : null}
        {phase.kind === 'idle' ? (
          <Txt kind="body" color="ink2">
            {t('ask.consentWifi')}
          </Txt>
        ) : null}

        <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }} style={[styles.track, { borderColor: colors.hair2, backgroundColor: colors.surface }]} testID="ask-download-bar">
          <View style={[styles.fill, { width: `${pct}%`, backgroundColor: colors.accent }]} />
        </View>
        <Num kind="caption" color="ink3">
          {`${pct}%`}
        </Num>

        <View style={styles.actions}>
          {phase.kind === 'downloading' ? <SecondaryButton label={t('ask.pause')} onPress={() => void dl.pause()} testID="ask-download-pause" /> : null}
          {phase.kind === 'paused' || phase.kind === 'idle' ? <PrimaryButton label={phase.kind === 'idle' ? t('ask.consentCta') : t('ask.resume')} onPress={() => void dl.resume()} testID="ask-download-resume" /> : null}
          {phase.kind === 'failed' ? <PrimaryButton label={t('ask.retry')} onPress={() => void dl.start()} testID="ask-download-retry" /> : null}
          {phase.kind === 'ready' ? <PrimaryButton label={t('ask.openChat')} onPress={() => router.replace('/charts/ask/chat')} testID="ask-download-open" /> : null}
          {phase.kind === 'downloading' || phase.kind === 'paused' || phase.kind === 'failed' ? <TextButton label={t('ask.cancelDownload')} onPress={() => dl.cancel()} testID="ask-download-cancel" /> : null}
        </View>
      </Card>
      <Txt kind="caption" color="ink3">
        {t('ask.offlineNote')}
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: 4, borderWidth: 1, overflow: 'hidden', marginTop: 12, alignSelf: 'stretch' },
  fill: { height: '100%' },
  actions: { gap: 8, marginTop: 12 },
});
