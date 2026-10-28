// "Ask my chart" gate (F35, design.md 10.7): the honest state screen. Unsupported phone -> the three requirement rows
// with the measured value and pass/fail for each (Android 12, 6 GB RAM, 4 GB free) and NO cloud fallback; supported but
// not Pro -> "Ask my chart is part of Pro" with Go Pro; supported Pro -> a Continue into consent or the chat. When the
// model file is on the phone this screen also offers "Delete model" (the storage promise of the consent screen holds
// even when Pro has lapsed). Nothing here is downloaded or computed by a server.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { askRouteFor, askSnapshot, type AskSnapshot } from '../../../src/ai/askState';
import { deleteModel } from '../../../src/ai/modelStore';
import { modelSizeLabel } from '../../../src/ai/model';
import { Card, PrimaryButton, Screen, SecondaryButton, Sheet, Txt } from '../../../src/components';
import { useLang } from '../../../src/i18n';
import { useTokens } from '../../../src/theme/ThemeProvider';
import { RichText } from '../../../src/today/RichText';

export interface AskGateScreenProps {
  /** Injection for tests (device facts + tier + model status). */
  snapshot?: () => AskSnapshot;
}

export default function AskGateScreen({ snapshot = askSnapshot }: AskGateScreenProps) {
  const { t } = useLang();
  const { colors } = useTokens();
  const router = useRouter();
  const [snap, setSnap] = useState<AskSnapshot>(() => snapshot());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const { state, gate, status } = snap;
  const title = state === 'unsupported' ? t('ask.gateTitle') : t('ask.rowTitle');

  function removeModel() {
    deleteModel();
    setConfirmDelete(false);
    setDeleted(true);
    setSnap(snapshot());
  }

  const rowKey = { android: 'ask.gateAndroid', ram: 'ask.gateRam', storage: 'ask.gateStorage' } as const;
  const rowParam = { android: 'version', ram: 'ram', storage: 'free' } as const;

  return (
    <Screen title={title} chrome="stack" testID="ask-gate-screen">
      <Card testID="ask-gate-card">
        <Txt kind="body">{t('ask.gateBody')}</Txt>
        <View style={styles.rows}>
          {gate.reasons.map((r, i) => (
            <View key={r.key} style={[styles.row, i < gate.reasons.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hair }]} testID={`ask-gate-${r.key}`}>
              <RichText kind="body" text={t(rowKey[r.key], { [rowParam[r.key]]: r.value })} />
              <Txt kind="caption" color={r.ok ? 'ink2' : 'accent'} testID={`ask-gate-${r.key}-state`}>
                {r.ok ? t('ask.gatePass') : t('ask.gateFail')}
              </Txt>
            </View>
          ))}
        </View>
        {state === 'unsupported' ? (
          <Txt kind="body" weight={600} testID="ask-gate-unsupported">
            {t('ask.rowUnsupported')}
          </Txt>
        ) : null}
      </Card>

      {state === 'pro' ? (
        <Card testID="ask-gate-pro">
          <Txt kind="body">{t('ask.proOnly')}</Txt>
          <PrimaryButton label={t('pro.goPro')} onPress={() => router.push('/pro')} style={styles.cta} testID="ask-gate-go-pro" />
        </Card>
      ) : null}

      {state === 'download' || state === 'ready' ? (
        <Card testID="ask-gate-continue">
          <Txt kind="body" color="ink2">
            {status === 'ready' ? t('ask.rowReady') : t('ask.rowDownload')}
          </Txt>
          <PrimaryButton label={status === 'ready' ? t('ask.openChat') : t('common.continue')} onPress={() => router.push(askRouteFor(state))} style={styles.cta} testID="ask-gate-open" />
        </Card>
      ) : null}

      {status !== 'absent' ? (
        <Card testID="ask-gate-model">
          <Txt kind="body">{t('ask.gateModelOnPhone', { size: modelSizeLabel() })}</Txt>
          <Txt kind="caption" color="ink2">
            {t('ask.deleteModelBody')}
          </Txt>
          <SecondaryButton label={t('ask.deleteModel')} onPress={() => setConfirmDelete(true)} style={styles.cta} testID="ask-gate-delete" />
        </Card>
      ) : null}
      {deleted ? (
        <Txt kind="caption" color="ink2" accessibilityLiveRegion="polite" testID="ask-gate-deleted">
          {t('ask.deleted')}
        </Txt>
      ) : null}

      <Sheet
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('ask.deleteModel')}
        footer={
          <View style={styles.confirm}>
            <PrimaryButton label={t('ask.deleteModel')} onPress={removeModel} testID="ask-gate-delete-confirm" />
            <SecondaryButton label={t('common.cancel')} onPress={() => setConfirmDelete(false)} />
          </View>
        }
      >
        <Txt kind="body">{t('ask.deleteModelConfirm')}</Txt>
        <Txt kind="body" color="ink2">
          {t('ask.deleteModelBody')}
        </Txt>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rows: { marginTop: 12 },
  row: { paddingVertical: 8, gap: 2 },
  cta: { marginTop: 12 },
  confirm: { gap: 8 },
});
