// UI string keys for setting values (shared by Settings index and the detail screens).
import type { Ayanamsa, NodeMode } from '@shubhvela/engine';
import type { ChartStyle, Lang, ThemeSetting, Tradition } from './db/settings';

export const CHART_STYLE_KEY: Record<ChartStyle, string> = { north: 'charts.styleNorth', south: 'charts.styleSouth', east: 'charts.styleEast' };
export const TRADITION_KEY: Record<Tradition, string> = { purnimanta: 'family.traditionPurnimanta', amanta: 'family.traditionAmanta' };
export const THEME_KEY: Record<ThemeSetting, string> = { system: 'settings.theme.system', light: 'settings.theme.light', dark: 'settings.theme.dark' };
export const LANG_KEY: Record<Lang, string> = { en: 'settings.lang.en', hi: 'settings.lang.hi', bho: 'settings.lang.bho' };
export const AYANAMSA_KEY: Record<Ayanamsa, string> = { lahiri: 'settings.ayanamsa.lahiri', kp: 'settings.ayanamsa.kp', raman: 'settings.ayanamsa.raman' };
export const NODE_KEY: Record<NodeMode, string> = { mean: 'settings.nodes.mean', true: 'settings.nodes.true' };

/** "Lahiri (default)" -> "Lahiri" for compact value columns. */
export function shortValue(label: string): string {
  return label.replace(/\s*\([^)]*\)\s*$/, '');
}
