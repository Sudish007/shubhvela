// Legal plumbing shared by the consent screen and Settings -> Privacy / About.
import Constants from 'expo-constants';

/** Owner step 8 (docs/OWNER-TODO.md): the real address replaces this placeholder; nothing else changes. */
export const GRIEVANCE_EMAIL_PLACEHOLDER = 'grievance@shubhvela.in';

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
