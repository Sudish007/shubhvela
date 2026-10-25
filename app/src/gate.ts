// Consent gate (design.md 10.1 F1): onboarding until consent_at is stored AND a "self" profile exists.
import { consentAt } from './db/appState';
import { getSelfProfile } from './db/profiles';

export function needsOnboarding(): boolean {
  return consentAt() === null || getSelfProfile() === null;
}
