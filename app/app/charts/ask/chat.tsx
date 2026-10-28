// "Ask my chart" chat (spec F35, design.md 10.7; plan C04): Pro-only, model on the phone, offline. Question <= 300
// characters -> "Thinking…" -> the WHOLE answer at once (expo-litert-lm 0.1.2 is non-streaming; no typing animation),
// preceded by the fixed 13 sp line "AI explanation from your chart — can be wrong" (ruleId ask-label) and followed by
// the rule ids used. The prompt is built by src/ai/prompt.ts (system rules + chart JSON + matching corpus snippets).
// Inference errors (OOM, missing file, runtime unavailable) show "Couldn't run the model on this phone right now" with
// Delete model / Retry. Answers live in memory only. Nothing leaves the phone.
import { dailyNote, localDateOf } from '@shubhvela/engine';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { askSnapshot, type AskSnapshot } from '../../../src/ai/askState';
import { AskError, sharedBridge, type AskBridge } from '../../../src/ai/bridge';
import { AiLabel } from '../../../src/ai/Label';
import { modelSizeLabel } from '../../../src/ai/model';
import { deleteModel, modelFile } from '../../../src/ai/modelStore';
import { ASK_MAX, buildPrompt, citedRuleIds, validateAskQuestion, type AskQuestionProblem } from '../../../src/ai/prompt';
import { useMountClock } from '../../../src/charts/LockedFeature';
import { useRouteProfile } from '../../../src/charts/routeProfile';
import { profileLabel } from '../../../src/charts/sheets';
import { Card, InlineNotice, PrimaryButton, Screen, SecondaryButton, Sheet, TextField, Txt } from '../../../src/components';
import { getSelfProfile } from '../../../src/db/profiles';
import { chartFor, dashaFor } from '../../../src/engine-bridge/charts';
import { useLang } from '../../../src/i18n';
import { useTokens } from '../../../src/theme/ThemeProvider';

export interface AskChatScreenProps {
  now?: () => number;
  profileId?: number;
  /** Injection for tests: the bridge over a fake module and the state snapshot. */
  bridge?: AskBridge;
  snapshot?: () => AskSnapshot;
  /** Filesystem path handed to the runtime (tests). */
  modelPath?: () => string;
}

interface Turn {
  id: number;
  question: string;
  answer: string;
  /** Rule ids the model cited, in citation order; empty when it cited none it was given. */
  rulesUsed: string[];
  /** Rule ids the prompt offered (shown in the label's Why? sheet). */
  rulesGiven: string[];
}

function realModelPath(): string {
  return modelFile().uri.replace(/^file:\/\//, '');
}

export default function AskChatScreen({ now, profileId, bridge, snapshot = askSnapshot, modelPath = realModelPath }: AskChatScreenProps) {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  const router = useRouter();
  const nowMs = useMountClock(now);
  const routeProfile = useRouteProfile(profileId);
  const profile = routeProfile ?? getSelfProfile();
  const [snap, setSnap] = useState<AskSnapshot>(() => snapshot());
  const [question, setQuestion] = useState('');
  const [problem, setProblem] = useState<AskQuestionProblem | null>(null);
  const [thinking, setThinking] = useState(false);
  const [loadingModel, setLoadingModel] = useState(false);
  const [error, setError] = useState<AskError | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);

  if (snap.state !== 'ready' || !profile) {
    return (
      <Screen title={t('ask.chatTitle')} chrome="stack" testID="ask-chat-screen">
        <Card testID="ask-chat-not-ready">
          <Txt kind="body">{!profile ? t('charts.noProfile') : snap.state === 'unsupported' ? t('ask.rowUnsupported') : snap.state === 'pro' ? t('ask.proOnly') : t('ask.rowDownload')}</Txt>
          {profile && snap.state !== 'unsupported' ? <PrimaryButton label={snap.state === 'pro' ? t('pro.goPro') : t('common.continue')} onPress={() => router.replace(snap.state === 'pro' ? '/pro' : '/charts/ask/consent')} style={styles.cta} testID="ask-chat-continue" /> : null}
        </Card>
      </Screen>
    );
  }

  const b = bridge ?? sharedBridge();

  async function run(q: string) {
    const chart = chartFor(profile!);
    const tree = dashaFor(chart);
    const day = localDateOf(nowMs, profile!.tz);
    const today = dailyNote(chart, day, { lat: profile!.lat, lon: profile!.lon }, profile!.tz);
    const built = buildPrompt({ chart, tree, today, nowMs, question: q, lang, profileName: profileLabel(profile!, t) });
    setLastPrompt(q);
    setError(null);
    try {
      if (!b.isLoaded) {
        setLoadingModel(true);
        await b.load(modelPath());
        setLoadingModel(false);
      }
      setThinking(true);
      const answer = await b.generate(built.prompt);
      setTurns((list) => [...list, { id: list.length + 1, question: q, answer, rulesUsed: citedRuleIds(answer, built.ruleIds), rulesGiven: built.ruleIds }]);
      setQuestion('');
    } catch (e) {
      const err = e instanceof AskError ? e : new AskError('failed', String((e as Error)?.message ?? e));
      if (__DEV__) console.warn('ask failed', err.code, err.message);
      setError(err);
    } finally {
      setLoadingModel(false);
      setThinking(false);
    }
  }

  function ask() {
    const p = validateAskQuestion(question);
    setProblem(p);
    if (p) return;
    void run(question.trim());
  }

  function removeModel() {
    void b.unload();
    deleteModel();
    setConfirmDelete(false);
    setSnap(snapshot());
  }

  const left = ASK_MAX - Array.from(question.trim()).length;
  const problemText = problem === 'empty' ? t('prashna.questionEmpty') : problem === 'tooLong' ? t('ask.questionTooLong') : null;

  return (
    <Screen title={t('ask.chatTitle')} chrome="stack" subtitle={<Txt kind="caption" color="ink2">{t('ask.offlineNote')}</Txt>} testID="ask-chat-screen">
      <Card testID="ask-chat-ask-card">
        <TextField label={t('ask.rowTitle')} value={question} onChangeText={(v) => { setQuestion(v); if (problem) setProblem(null); }} placeholder={t('ask.questionHint')} maxLength={ASK_MAX + 50} multiline error={problemText} hint={t('prashna.charsLeft', { count: Math.max(0, left) })} testID="ask-chat-question" />
        <PrimaryButton label={t('ask.send')} onPress={ask} disabled={thinking || loadingModel} style={styles.cta} testID="ask-chat-send" />
        <Txt kind="caption" color="ink3" style={styles.notAdvice}>
          {t('ask.notAdvice')}
        </Txt>
      </Card>

      {loadingModel ? (
        <Txt kind="body" color="ink2" accessibilityLiveRegion="polite" testID="ask-chat-loading">
          {t('ask.loadingModel')}
        </Txt>
      ) : null}
      {thinking ? (
        <Txt kind="body" color="ink2" accessibilityLiveRegion="polite" testID="ask-chat-thinking">
          {t('ask.thinking')}
        </Txt>
      ) : null}

      {error ? (
        <Card testID="ask-chat-error">
          <InlineNotice tone="error">{t('ask.inferenceFailed')}</InlineNotice>
          <Txt kind="body" color="ink2" style={styles.errorBody}>
            {error.code === 'oom' ? t('errors.modelMemory') : error.code === 'missing' ? t('errors.modelMissing') : t('ask.inferenceFailedBody')}
          </Txt>
          <View style={styles.actions}>
            <SecondaryButton label={t('ask.deleteModel')} onPress={() => setConfirmDelete(true)} testID="ask-chat-error-delete" />
            <PrimaryButton label={t('ask.retry')} onPress={() => lastPrompt && void run(lastPrompt)} testID="ask-chat-error-retry" />
          </View>
        </Card>
      ) : null}

      {[...turns].reverse().map((turn) => (
        <Card key={turn.id} testID={`ask-turn-${turn.id}`}>
          <Txt kind="caption" color="ink3">
            {t('ask.youAsked')}
          </Txt>
          <Txt kind="body" weight={600} testID={`ask-turn-${turn.id}-question`}>
            {turn.question}
          </Txt>
          <View style={[styles.answer, { borderTopColor: colors.hair }]}>
            <AiLabel ruleIds={turn.rulesGiven} testID={`ask-turn-${turn.id}-label`} />
            <Txt kind="body" testID={`ask-turn-${turn.id}-answer`}>
              {turn.answer}
            </Txt>
            <Txt kind="caption" color="ink2" testID={`ask-turn-${turn.id}-rules`}>
              {turn.rulesUsed.length ? t('ask.rulesUsed', { ids: turn.rulesUsed.join(', ') }) : t('ask.noRules')}
            </Txt>
          </View>
        </Card>
      ))}
      {turns.length === 0 && !thinking && !error ? (
        <Txt kind="caption" color="ink3" testID="ask-chat-empty">
          {t('ask.historyEmpty')}
        </Txt>
      ) : null}

      <Card testID="ask-chat-model-card">
        <Txt kind="body">{t('ask.rowReady')}</Txt>
        <Txt kind="caption" color="ink2">
          {t('ask.deleteModelBody')}
        </Txt>
        <SecondaryButton label={t('ask.deleteModel')} onPress={() => setConfirmDelete(true)} style={styles.cta} testID="ask-chat-delete" />
      </Card>

      <Sheet
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('ask.deleteModel')}
        footer={
          <View style={styles.actions}>
            <PrimaryButton label={t('ask.deleteModel')} onPress={removeModel} testID="ask-chat-delete-confirm" />
            <SecondaryButton label={t('common.cancel')} onPress={() => setConfirmDelete(false)} />
          </View>
        }
      >
        <Txt kind="body">{t('ask.deleteModelConfirm')}</Txt>
        <Txt kind="body" color="ink2">
          {t('ask.deleteModelBody')}
        </Txt>
        <Txt kind="caption" color="ink3">
          {t('ask.gateModelOnPhone', { size: modelSizeLabel() })}
        </Txt>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cta: { marginTop: 12 },
  notAdvice: { marginTop: 8 },
  errorBody: { marginTop: 8 },
  actions: { gap: 8, marginTop: 12 },
  answer: { marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, gap: 4 },
});
