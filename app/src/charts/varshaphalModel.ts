// Pure Varshaphal placement rules (F17, design.md 10.3 M13/M21): the Varshaphal lives as a row in "More from this
// chart" ("Your Vedic year from <date · time>" = the running year's solar return) and is promoted to its own card
// during the 30 days before the next solar return ("Your Vedic year begins <date · time>"). The engine-bridge supplies
// the instants; nothing here is guessed.
import { DAY_MS } from '@shubhvela/engine';
import type { VedicYear } from '../engine-bridge/charts';

/** Days before the next solar return during which the row becomes a card (design.md 10.3 F17). */
export const VARSHAPHAL_PROMOTE_DAYS = 30;

/** True when the next solar return is within 30 days (and still ahead). */
export function varshaphalPromoted(vy: Pick<VedicYear, 'nextStart'>, nowMs: number): boolean {
  const ahead = vy.nextStart - nowMs;
  return ahead > 0 && ahead <= VARSHAPHAL_PROMOTE_DAYS * DAY_MS;
}

/** Whole days until the next return, for the card body ("ready N days before the year begins"). */
export function daysUntilReturn(vy: Pick<VedicYear, 'nextStart'>, nowMs: number): number {
  return Math.max(0, Math.ceil((vy.nextStart - nowMs) / DAY_MS));
}
