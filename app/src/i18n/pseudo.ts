// Pseudo-locale for the +30 % layout tests (design.md 7). Jest sets global.__PSEUDO_LOCALE__ = true before rendering
// a screen; production bundles never set it, so the branch is dead code on the device.
import { pseudoLocale, type UiStrings } from '@shubhvela/content';

declare global {
  var __PSEUDO_LOCALE__: boolean | undefined;
}

export const PSEUDO_FACTOR = 1.3;

export function isPseudoLocale(): boolean {
  return globalThis.__PSEUDO_LOCALE__ === true;
}

export function applyPseudo(ui: UiStrings): UiStrings {
  return isPseudoLocale() ? pseudoLocale(ui, PSEUDO_FACTOR) : ui;
}
