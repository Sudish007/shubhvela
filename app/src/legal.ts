// Legal plumbing shared by the consent screen and Settings -> Privacy / About.
import Constants from 'expo-constants';
import { type TFn } from './i18n';

/** Owner step 8 (docs/OWNER-TODO.md): the real address replaces this placeholder and `GRIEVANCE_EMAIL_CONFIRMED` flips to true. */
export const GRIEVANCE_EMAIL_PLACEHOLDER = 'grievance@shubhvela.in';
/** False until the owner confirms the address (Phase A review M4): the consent notice and Settings -> Privacy then say so. */
export const GRIEVANCE_EMAIL_CONFIRMED = false;

/** The grievance line shown to the user: the address, plus the provisional note while it is unconfirmed (D8: nothing shown as real that is not). */
export function grievanceText(t: TFn, key: 'consent.grievance' | 'privacy.grievance'): string {
  const line = t(key, { email: GRIEVANCE_EMAIL_PLACEHOLDER });
  return GRIEVANCE_EMAIL_CONFIRMED ? line : `${line}\n${t('consent.grievanceProvisional')}`;
}

export function webBase(): string {
  return (Constants.expoConfig?.extra as { webBase?: string } | undefined)?.webBase ?? 'https://sudish007.github.io/shubhvela/';
}

export function privacyPolicyUrl(): string {
  return `${webBase()}privacy/`;
}

export function dataDeletionUrl(): string {
  return `${webBase()}data-deletion/`;
}

export const SOURCE_URL = 'https://github.com/Sudish007/shubhvela';

export function isScreenshotBuild(): boolean {
  return process.env.EXPO_PUBLIC_SCREENSHOT_MODE === '1';
}

export function appVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}

export function versionCode(): number {
  return Constants.expoConfig?.android?.versionCode ?? 0;
}
