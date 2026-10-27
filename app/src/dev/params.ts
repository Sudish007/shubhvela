// Query parameters of shubhvela://dev/state (plan.md P12). Unknown values fall back to en / light / Today.
import { INTENTS, type Intent } from '../db/profiles';
import type { ChartStyle, Lang, ThemeSetting } from '../db/settings';
const LANGS: readonly Lang[] = ['en', 'hi', 'bho'];
const THEMES: readonly ThemeSetting[] = ['light', 'dark', 'system'];
const STYLES: readonly ChartStyle[] = ['north', 'south', 'east'];
export interface DevParams {
  lang: Lang;
  theme: ThemeSetting;
  /** Route path, always starting with "/". `{self}` is replaced by the self profile id after seeding (A13 shots). */
  screen: string;
  /** sample=1 seeds the sample household. */
  sample: boolean;
  /** Echoed only; the font scale is a device setting. */
  font: string;
  /** Optional chart style to persist before navigating (A13: charts-north/south/east shots). */
  style?: ChartStyle;
  /** test_reminder=1 schedules one notification 2 minutes ahead through the real bridge (F25 airplane-mode smoke). */
  testReminder: boolean;
  /** pdf_dump=1 (B07/B08) prints the three reports for the seeded household into the cache directory and logs the URIs. */
  pdfDump: boolean;
  /** pro=1 (B08) seeds an active Pro entitlement for the shot; any other value (or absent) resets the device to Free. */
  pro: boolean;
  /** session=N (B08) sets the persisted session counter so ads appear (>= 4) on the shot; absent = untouched. */
  session?: number;
  /** intent=<marriage|career|familyDates|learn> (B08, M4) sets the self profile's onboarding intent. */
  intent?: Intent;
  /** pdf_lang=<en|hi|bho> (B08) sets every seeded profile's PDF language so pdf_dump produces that language. */
  pdfLang?: Lang;
  /** q_<name>=<value> (B08) parameters forwarded to the target screen as <name>=<value>; `{self}`/`{other}` substituted. */
  forward?: Record<string, string>;
}
export function parseDevParams(p: Record<string, string | string[] | undefined>): DevParams {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
  const lang = (LANGS as readonly string[]).includes(one(p.lang)) ? (one(p.lang) as Lang) : 'en';
  const theme = (THEMES as readonly string[]).includes(one(p.theme)) ? (one(p.theme) as ThemeSetting) : 'light';
  const screenRaw = one(p.screen) || '/(tabs)/today';
  const screen = screenRaw.startsWith('/') ? screenRaw : `/${screenRaw}`;
  const out: DevParams = {
    lang,
    theme,
    screen,
    sample: one(p.sample) === '1',
    font: one(p.font) || '1.0',
    testReminder: one(p.test_reminder) === '1',
    pdfDump: one(p.pdf_dump) === '1',
    pro: one(p.pro) === '1',
  };
  if ((STYLES as readonly string[]).includes(one(p.style))) out.style = one(p.style) as ChartStyle;
  const session = Number(one(p.session));
  if (one(p.session) !== '' && Number.isInteger(session) && session >= 0) out.session = session;
  if ((INTENTS as readonly string[]).includes(one(p.intent))) out.intent = one(p.intent) as Intent;
  if ((LANGS as readonly string[]).includes(one(p.pdf_lang))) out.pdfLang = one(p.pdf_lang) as Lang;
  // Query parameters the target screen should receive (B08: the router splits the outer link on "&" before decoding, so
  // a second "?x=&y=" parameter inside `screen` never arrives; `q_a=p{self}&q_b=p{other}` reaches the screen as a=&b=).
  const forward: Record<string, string> = {};
  for (const k of Object.keys(p)) if (k.startsWith('q_') && k.length > 2 && one(p[k]) !== '') forward[k.slice(2)] = one(p[k]);
  if (Object.keys(forward).length > 0) out.forward = forward;
  return out;
}

/** Appends the forwarded query parameters to the (already {self}/{other}-substituted) route. */
export function withForwardedQuery(screen: string, forward: Record<string, string> | undefined): string {
  if (!forward) return screen;
  const qs = Object.entries(forward)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return qs ? `${screen}${screen.includes('?') ? '&' : '?'}${qs}` : screen;
}
