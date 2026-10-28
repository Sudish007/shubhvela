// Keeps files/widget_state.json in step with the app (design.md 10.2 F9 data contract): a write 2.5 s after launch (after
// the first paint and the reminder re-plan) and a write on every language change; the background job is registered once
// consent exists. Location changes are handled where the observer is known (useToday -> syncWidgetsForObserver).
// Renders nothing.
import { useEffect, useRef } from 'react';
import { consentAt } from '../db/appState';
import { hasDb } from '../db/connection';
import { useLang } from '../i18n';
import { registerExtendWidgetStateTask } from './backgroundTask';
import { writeWidgetState } from './writeState';

export const LAUNCH_WRITE_DELAY_MS = 2500;

function consented(): boolean {
  try {
    return hasDb() && consentAt() !== null;
  } catch {
    return false;
  }
}

export function WidgetStateSync() {
  const { lang } = useLang();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      const id = setTimeout(() => {
        void writeWidgetState({ lang });
        if (consented()) void registerExtendWidgetStateTask();
      }, LAUNCH_WRITE_DELAY_MS);
      return () => clearTimeout(id);
    }
    void writeWidgetState({ lang, force: true });
    return undefined;
  }, [lang]);
  return null;
}
