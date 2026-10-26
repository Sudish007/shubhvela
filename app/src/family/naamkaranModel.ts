// Naamkaran helper model (F28; plan B05): pure helpers shared by the screen and the profile editor. The syllables
// themselves come from engine.syllablesForChart(); nothing here computes astrology.
import type { NaamkaranResult } from '@shubhvela/engine';
import type { Profile } from '../db/profiles';

const YEAR_MS = 366 * 24 * 3600_000;

/** True for a profile born within the last year (the F28 "newborn" case). */
export function isNewborn(p: Pick<Profile, 'birthDate'>, nowMs: number): boolean {
  const [y, m, d] = p.birthDate.split('-').map(Number);
  const birth = Date.UTC(y, m - 1, d);
  return nowMs - birth >= 0 && nowMs - birth < YEAR_MS;
}

/** Preselection: the route profile, else the youngest newborn, else the self profile, else the first. */
export function preselect(profiles: readonly Profile[], routeId: number | null, nowMs: number): Profile | null {
  if (routeId !== null) {
    const hit = profiles.find((p) => p.id === routeId);
    if (hit) return hit;
  }
  const newborns = profiles.filter((p) => isNewborn(p, nowMs)).sort((a, b) => (a.birthDate < b.birthDate ? 1 : -1));
  if (newborns.length) return newborns[0];
  return profiles.find((p) => p.isSelf) ?? profiles[0] ?? null;
}

export interface OrderedSyllable {
  devanagari: string;
  latin: string;
  /** 1-4: the pada whose syllable this is (also the key of the corpus name list). */
  pada: number;
}

/** The pada's syllable first, then the nakshatra's other three (design.md 10.5 F28). */
export function syllableOrder(r: NaamkaranResult): OrderedSyllable[] {
  const all = r.nakshatraSyllables.map((s, i) => ({ ...s, pada: i + 1 }));
  return [all[r.pada - 1], ...all.filter((_, i) => i !== r.pada - 1)];
}
