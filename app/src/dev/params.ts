// Query parameters of shubhvela://dev/state (plan.md P12). Unknown values fall back to en / light / Today.
import type { Lang, ThemeSetting } from '../db/settings';

const LANGS: readonly Lang[] = ['en', 'hi', 'bho'];
const THEMES: readonly ThemeSetting[] = ['light', 'dark', 'system'];

export interface DevParams {
  lang: Lang;
  theme: ThemeSetting;
  /** Route path, always starting with "/". */
  screen: string;
  /** sample=1 seeds the sample household. */
  sample: boolean;
  /** Echoed only; the font scale is a device setting. */
  font: string;
}

export function parseDevParams(p: Record<string, string | string[] | undefined>): DevParams {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
  const lang = (LANGS as readonly string[]).includes(one(p.lang)) ? (one(p.lang) as Lang) : 'en';
  const theme = (THEMES as readonly string[]).includes(one(p.theme)) ? (one(p.theme) as ThemeSetting) : 'light';
  const screenRaw = one(p.screen) || '/(tabs)/today';
  const screen = screenRaw.startsWith('/') ? screenRaw : `/${screenRaw}`;
  return { lang, theme, screen, sample: one(p.sample) === '1', font: one(p.font) || '1.0' };
}
