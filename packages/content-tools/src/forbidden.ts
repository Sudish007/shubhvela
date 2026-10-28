// Forbidden-content and register checks shared by the translate CLI post-checks and packages/content tests.
import forbiddenJson from '../forbidden.json';

export type Lang = 'en' | 'hi' | 'bho';
export const FORBIDDEN: Record<Lang, string[]> = {
  en: forbiddenJson.en,
  hi: forbiddenJson.hi,
  bho: forbiddenJson.bho,
};

const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isLatin = (s: string): boolean => /^[\x20-\x7e]+$/.test(s);

/** Returns the forbidden phrases found in `text` for `lang` (Latin phrases match whole words, Devanagari by substring). */
export function forbiddenHits(text: string, lang: Lang): string[] {
  const hits: string[] = [];
  for (const phrase of FORBIDDEN[lang]) {
    const re = isLatin(phrase) ? new RegExp(`(^|[^A-Za-z0-9])${esc(phrase)}(?![A-Za-z0-9])`, 'i') : new RegExp(esc(phrase), 'u');
    if (re.test(text)) hits.push(phrase);
  }
  return hits;
}

/** Accuracy / percentage claims: any digits followed by a percent sign, in any language. */
export function hasPercentClaim(text: string): boolean {
  return /\d\s*%/.test(text) || /\d\s*प्रतिशत/.test(text) || /\bpercent\b/i.test(text);
}

const DEVANAGARI_RE = /[\u0900-\u097F]/g;
const LATIN_RE = /[A-Za-z]/g;

/** Latin tokens allowed inside Devanagari strings (technical terms on first mention, brand and product names). */
export const LATIN_ALLOWLIST = [
  'Shubhvela', 'Pro', 'AdMob', 'Google', 'Play', 'Android', 'OpenStreetMap', 'Nominatim', 'GeoNames', 'KP', 'TTS', 'PDF', 'QR',
  'DPDP', 'HH:MM', 'MIT', 'ISC', 'OFL', 'CC', 'BY', 'CC0', 'IANA', 'tz', 'tz-lookup', 'astronomy-engine', 'jyotish', 'Drik', 'Panchang',
  'Tiro', 'Devanagari', 'Hindi', 'Noto', 'Sans', 'English', 'Asia/Kolkata', 'Lahiri', 'R', 'D1', 'D9', 'D2', 'D3', 'D4', 'D7', 'D10', 'D12',
  'D16', 'D20', 'D24', 'D27', 'D30', 'D40', 'D45', 'D60', 'BAV', 'SAV', 'AI', 'Wi-Fi', 'Placidus', 'AppLovin', 'Gemma', 'ics',
  // C02: Ask-my-chart consent and backup copy name the model, the runtime, the units and the ciphers.
  'GB', 'RAM', 'E2B', 'Apache', 'LiteRT-LM', 'AES-256-GCM', 'PBKDF2', 'svb',
];
// Longest first so "tz-lookup" is removed before "tz", "QR" before "R".
const ALLOWLIST_SORTED = [...LATIN_ALLOWLIST].sort((a, b) => b.length - a.length);

/** Strips allow-listed Latin terms and `{params}`, then counts Devanagari vs Latin letters. */
export function scriptCounts(text: string): { devanagari: number; latin: number } {
  let t = text.replace(/\{[a-zA-Z0-9_]+\}/g, ' ');
  for (const term of ALLOWLIST_SORTED) t = t.split(term).join(' ');
  return { devanagari: (t.match(DEVANAGARI_RE) ?? []).length, latin: (t.match(LATIN_RE) ?? []).length };
}

/**
 * Devanagari-dominant test for hi/bho strings: after removing allow-listed terms, Devanagari letters must be at least
 * `minRatio` of all letters (plan 9: 0.90 for Hindi, 0.85 for Bhojpuri). Strings with no letters at all pass.
 */
export function isDevanagariDominant(text: string, minRatio: number): boolean {
  const { devanagari, latin } = scriptCounts(text);
  const letters = devanagari + latin;
  if (letters === 0) return true;
  return devanagari / letters >= minRatio;
}

export const DEVANAGARI_MIN_RATIO: Record<Exclude<Lang, 'en'>, number> = { hi: 0.9, bho: 0.85 };

/** Maithili verb forms and particles that must not appear in Bhojpuri text (spec 7 register rule). */
export const MAITHILI_FORMS = ['अछि', 'छी', 'छथि', 'छलाह', 'छैक', 'रहैत', 'करैत', 'अहाँ', 'हमरा सभ'];

export function maithiliHits(text: string): string[] {
  return MAITHILI_FORMS.filter((f) => new RegExp(`(^|[\\s,.;:!?()“”"'-])${f}(?=$|[\\s,.;:!?()“”"'-])`, 'u').test(text));
}
