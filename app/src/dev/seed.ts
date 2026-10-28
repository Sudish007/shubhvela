// Screenshot-mode seed (plan.md P12): the sample household used for every emulator screenshot. Every value shown on a
// screenshot is ENGINE OUTPUT computed from these inputs at render time; nothing here is a displayed number.
import { seedSessionsForScreenshots } from '../ads/AdPolicy';
import { getDb } from '../db/connection';
import { insertAncestor } from '../db/ancestors';
import { recordConsent } from '../db/appState';
import { saveJournalEntry } from '../db/journal';
import { markLessonDone } from '../db/lessonsDone';
import { insertPrashna } from '../db/prashna';
import { insertProfile, type Intent } from '../db/profiles';
import { setSetting, type Lang, type ThemeSetting } from '../db/settings';
import { formatInZone } from '@shubhvela/engine';
import { clearChartCache } from '../engine-bridge/charts';
import { setEntitlement } from '../entitlements';

export const SAMPLE_PRIYA = {
  name: 'Priya',
  gender: 'female' as const,
  birthDate: '1998-03-14',
  birthTime: '06:42',
  timeUnknown: false,
  timeApproxMinutes: 0 as const,
  lat: 26.85,
  lon: 80.95,
  tz: 'Asia/Kolkata',
  placeName: 'Lucknow, Uttar Pradesh, India',
  relationship: 'self' as const,
  tradition: 'purnimanta' as const,
  pdfLanguage: 'hi' as const,
  intent: 'marriage' as const,
  isSelf: true,
};

export const SAMPLE_AMMA = {
  name: 'Amma',
  gender: 'female' as const,
  birthDate: '1970-07-05',
  birthTime: '04:30',
  timeUnknown: false,
  timeApproxMinutes: 0 as const,
  lat: 25.61,
  lon: 85.14,
  tz: 'Asia/Kolkata',
  placeName: 'Patna, Bihar, India',
  relationship: 'mother' as const,
  tradition: 'purnimanta' as const,
  pdfLanguage: 'hi' as const,
  intent: null,
  isSelf: false,
};

/** Dadaji: Ashwin (lunar month index 6), Krishna paksha, Dashami. */
export const SAMPLE_DADAJI = { name: 'Dadaji', relation: 'grandfather', deathMonth: 6, paksha: 'krishna' as const, tithi: 10, year: null };

export interface SeedOptions {
  lang: Lang;
  theme: ThemeSetting;
  now?: Date;
  /** Self profile's onboarding intent (B08 M4 audit); default = Priya's 'marriage'. */
  intent?: Intent;
  /** PDF language of every seeded profile (B08 PDF audit); default hi. */
  pdfLang?: Lang;
  /** true = active Pro entitlement (B08 Pro variants); false = Free (any earlier dev Pro row is expired). */
  pro?: boolean;
  /** Persisted session counter (B08: 4 = ads shown); undefined = untouched. */
  sessions?: number;
  /** C05: seed Learn/Prashna history (one question asked 2 h ago at Lucknow, three journal days, lesson 1 done). */
  history?: boolean;
}

/** The sample Prashna question per language (user-typed text, never shown as a computed value). */
export const SAMPLE_PRASHNA_QUESTION: Record<Lang, string> = {
  en: 'Should I take the new job this month?',
  hi: 'क्या मुझे इस महीने नई नौकरी स्वीकार करनी चाहिए?',
  bho: 'का हमरा ई महीना नया नोकरी ले लेवे के चाहीं?',
};

/** Replaces all user data with the sample household and the requested language/theme. Idempotent. */
export function seedSampleState(opts: SeedOptions): { priyaId: number; ammaId: number; dadajiId: number } {
  const db = getDb();
  const now = opts.now ?? new Date();
  db.execSync('BEGIN');
  try {
    for (const t of ['scheduled', 'event_series', 'profiles', 'ancestors', 'saved_muhurats', 'journal', 'prashna', 'lessons_done', 'unlocks', 'purchases']) db.execSync(`DELETE FROM ${t}`);
    const pdfLanguage = opts.pdfLang ?? SAMPLE_PRIYA.pdfLanguage;
    const priyaId = insertProfile({ ...SAMPLE_PRIYA, pdfLanguage, intent: opts.intent ?? SAMPLE_PRIYA.intent }, opts.now);
    const ammaId = insertProfile({ ...SAMPLE_AMMA, pdfLanguage }, opts.now);
    const dadajiId = insertAncestor(SAMPLE_DADAJI);
    recordConsent(opts.now);
    if (opts.history) {
      const twoHoursAgo = new Date(now.getTime() - 2 * 3600_000);
      insertPrashna({ question: SAMPLE_PRASHNA_QUESTION[opts.lang], ts: twoHoursAgo.toISOString(), lat: SAMPLE_PRIYA.lat, lon: SAMPLE_PRIYA.lon, tz: SAMPLE_PRIYA.tz });
      const dayOf = (daysAgo: number) => formatInZone(now.getTime() - daysAgo * 86_400_000, SAMPLE_PRIYA.tz, 'yyyy-MM-dd');
      saveJournalEntry(dayOf(1), 'calm', null);
      saveJournalEntry(dayOf(3), 'busy', null);
      saveJournalEntry(dayOf(6), 'bright', null);
      markLessonDone('lesson-01', now);
    }
    setSetting('language', opts.lang);
    setSetting('theme', opts.theme);
    db.execSync('COMMIT');
    // Entitlement + session counter outside the transaction: both setters notify their subscribers.
    setEntitlement('shubhvela_pro', opts.pro ? 'active' : 'expired', opts.pro ? 'dev-screenshot' : null, now);
    setEntitlement('shubhvela_pro_lifetime', 'expired', null, now);
    if (opts.sessions !== undefined) seedSessionsForScreenshots(opts.sessions);
    clearChartCache();
    return { priyaId, ammaId, dadajiId };
  } catch (e) {
    db.execSync('ROLLBACK');
    throw e;
  }
}
