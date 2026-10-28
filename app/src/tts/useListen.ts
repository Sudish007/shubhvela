// F10 TTS (design.md 10.2 F10, 8): "Listen" on the daily note toggles to "Stop" and speaks the note's sentences in the UI
// language with expo-speech. Voice lookup by language tag: en -> an en-IN voice, else any English voice; hi -> hi-IN, else any
// Hindi voice; bho -> the Hindi voice (no Bhojpuri TTS voice exists on Android) with a ONE-TIME toast "Reading in the Hindi
// voice". When no voice for the language is installed, nothing is spoken and a non-blocking notice offers the Android
// text-to-speech settings page. Nothing here fakes progress: the state follows the engine's start/done/stopped/error events.
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform, ToastAndroid } from 'react-native';
import { getAppState, setAppState } from '../db/appState';
import { hasDb } from '../db/connection';
import type { Lang } from '../i18n';

export interface VoiceInfo {
  identifier: string;
  language: string;
}

export interface SpeechDeps {
  voices(): Promise<VoiceInfo[]>;
  speak(text: string, opts: { language: string; voice?: string; onDone: () => void; onStopped: () => void; onError: (e: unknown) => void }): void;
  stop(): Promise<void>;
  /** Shows the one-time Bhojpuri notice (ToastAndroid in production). */
  toast(message: string): void;
  /** Opens the Android text-to-speech settings page. */
  openTtsSettings(): Promise<void>;
  /** Persisted flag: has the Hindi-voice toast been shown? */
  hindiToastShown(): boolean;
  markHindiToastShown(): void;
}

/** BCP-47 language the voice must speak for each UI language. Bhojpuri has no Android TTS voice: Hindi reads it. */
export const TTS_LANGUAGE: Record<Lang, string> = { en: 'en', hi: 'hi', bho: 'hi' };
/** Preferred regional tag per language (Indian English / Indian Hindi) before any other voice of the language. */
const PREFERRED_TAG: Record<Lang, string> = { en: 'en-IN', hi: 'hi-IN', bho: 'hi-IN' };

function normTag(tag: string): string {
  return tag.replace('_', '-').toLowerCase();
}

/** The voice to use for a UI language: exact regional match first, then any voice of the language; null when none. */
export function pickVoice(voices: readonly VoiceInfo[], lang: Lang): VoiceInfo | null {
  const want = normTag(PREFERRED_TAG[lang]);
  const base = TTS_LANGUAGE[lang];
  const exact = voices.find((v) => normTag(v.language) === want);
  if (exact) return exact;
  return voices.find((v) => normTag(v.language).split('-')[0] === base) ?? null;
}

export const expoSpeechDeps: SpeechDeps = {
  async voices() {
    const list = await Speech.getAvailableVoicesAsync();
    return list.map((v) => ({ identifier: v.identifier, language: v.language }));
  },
  speak(text, opts) {
    Speech.speak(text, { language: opts.language, voice: opts.voice, onDone: opts.onDone, onStopped: opts.onStopped, onError: opts.onError });
  },
  stop: () => Speech.stop(),
  toast(message) {
    if (Platform.OS === 'android') ToastAndroid.show(message, ToastAndroid.SHORT);
  },
  async openTtsSettings() {
    if (Platform.OS === 'android') await Linking.sendIntent('com.android.settings.TTS_SETTINGS');
  },
  hindiToastShown: () => {
    try {
      return hasDb() && getAppState('tts_hindi_voice_toast') === '1';
    } catch {
      return false;
    }
  },
  markHindiToastShown: () => {
    try {
      if (hasDb()) setAppState('tts_hindi_voice_toast', '1');
    } catch {
      /* flag only */
    }
  },
};

export type ListenStatus = 'idle' | 'speaking' | 'noVoice' | 'error';

export interface ListenState {
  status: ListenStatus;
  /** Toggle Listen / Stop. */
  toggle: () => Promise<void>;
  stop: () => Promise<void>;
  openTtsSettings: () => Promise<void>;
}

export interface UseListenOptions {
  deps?: SpeechDeps;
  /** Toast text for the Bhojpuri -> Hindi voice case (already translated). */
  hindiVoiceToast: string;
}

/** Sentences joined with a pause between rows (a period keeps most engines from running them together). */
export function speechText(sentences: readonly string[]): string {
  return sentences
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (/[.!?।]$/.test(s) ? s : `${s}.`))
    .join(' ');
}

export function useListen(sentences: readonly string[], lang: Lang, opts: UseListenOptions): ListenState {
  const deps = opts.deps ?? expoSpeechDeps;
  const [status, setStatus] = useState<ListenStatus>('idle');
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      // Leaving the screen stops the voice (no orphaned speech).
      void deps.stop().catch(() => {});
    };
  }, [deps]);
  // A language change while speaking stops the current read-out and clears a stale "no voice" notice.
  const [seenLang, setSeenLang] = useState(lang);
  if (seenLang !== lang) {
    setSeenLang(lang);
    if (status === 'speaking' || status === 'noVoice') setStatus('idle');
  }
  useEffect(() => {
    void deps.stop().catch(() => {});
  }, [lang, deps]);

  const stop = useCallback(async () => {
    await deps.stop().catch(() => {});
    if (alive.current) setStatus('idle');
  }, [deps]);

  const toggle = useCallback(async () => {
    if (status === 'speaking') return stop();
    const text = speechText(sentences);
    if (!text) return;
    let voice: VoiceInfo | null = null;
    try {
      voice = pickVoice(await deps.voices(), lang);
    } catch {
      voice = null;
    }
    if (!voice) {
      if (alive.current) setStatus('noVoice');
      return;
    }
    if (lang === 'bho' && !deps.hindiToastShown()) {
      deps.toast(opts.hindiVoiceToast);
      deps.markHindiToastShown();
    }
    setStatus('speaking');
    deps.speak(text, {
      language: TTS_LANGUAGE[lang],
      voice: voice.identifier,
      onDone: () => alive.current && setStatus('idle'),
      onStopped: () => alive.current && setStatus('idle'),
      onError: () => alive.current && setStatus('error'),
    });
  }, [status, stop, sentences, deps, lang, opts.hindiVoiceToast]);

  const openTtsSettings = useCallback(() => deps.openTtsSettings().catch(() => {}), [deps]);
  return { status, toggle, stop, openTtsSettings };
}
