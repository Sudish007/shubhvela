// Screenshot-mode seed (plan.md P12): the sample household used for every emulator screenshot. Every value shown on a
// screenshot is ENGINE OUTPUT computed from these inputs at render time; nothing here is a displayed number.
import { seedSessionsForScreenshots } from '../ads/AdPolicy';
import { getDb } from '../db/connection';
import { insertAncestor } from '../db/ancestors';
import { recordConsent } from '../db/appState';
import { insertProfile, type Intent } from '../db/profiles';
import { setSetting, type Lang, type ThemeSetting } from '../db/settings';
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
}

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
