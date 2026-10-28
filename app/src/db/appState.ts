// app_state: small flags that are not user preferences (consent_at, sessions counter, last_ad_at ...).
import { getDb } from './connection';

export type AppStateKey = 'consent_at' | 'sessions' | 'last_ad_at' | 'onboarding_intent_seen' | 'tts_hindi_voice_toast';

export function getAppState(key: AppStateKey): string | null {
  const row = getDb().getFirstSync<{ value: string }>('SELECT value FROM app_state WHERE key = ?', [key]);
  return row?.value ?? null;
}

export function setAppState(key: AppStateKey, value: string): void {
  getDb().runSync('INSERT INTO app_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
}

/** DPDP consent (design.md 10.1 F1): ISO timestamp of the tap on "I understand, continue", or null. */
export function consentAt(): string | null {
  return getAppState('consent_at');
}

export function recordConsent(now: Date = new Date()): void {
  setAppState('consent_at', now.toISOString());
}
