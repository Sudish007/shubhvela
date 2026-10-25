// Font family resolution (design.md 2.2): display = Tiro Devanagari Hindi for every language's titles (its Latin
// glyphs set English titles so the wordmark matches); body = Noto Sans (en) / Noto Sans Devanagari (hi, bho); Latin
// and digit runs inside Devanagari text are forced to Noto Sans with tabular numerals by the Num/Latin components (N19).
// Static TTFs under app/assets/fonts are registered under these names in app/app/_layout.tsx; weight 600 is a separate
// face name because API < 29 loads only one face per family.
import type { TextStyle } from 'react-native';
import type { Lang } from '../i18n';
import { type as typeScale, type TypeStyleName } from './tokens';

export const FONT_FILES = {
  TiroDevanagariHindi: 'TiroDevanagariHindi-Regular.ttf',
  NotoSans: 'NotoSans-Regular.ttf',
  'NotoSans-SemiBold': 'NotoSans-SemiBold.ttf',
  NotoSansDevanagari: 'NotoSansDevanagari-Regular.ttf',
  'NotoSansDevanagari-SemiBold': 'NotoSansDevanagari-SemiBold.ttf',
} as const;
export type FontName = keyof typeof FONT_FILES;

export type Weight = 400 | 600;

export function fontFamilyFor(family: 'display' | 'body', lang: Lang, weight: Weight, forceLatin = false): FontName {
  if (family === 'display') return 'TiroDevanagariHindi';
  const latin = forceLatin || lang === 'en';
  if (latin) return weight === 600 ? 'NotoSans-SemiBold' : 'NotoSans';
  return weight === 600 ? 'NotoSansDevanagari-SemiBold' : 'NotoSansDevanagari';
}

export interface TextStyleOptions {
  weight?: Weight;
  /** Force Noto Sans (Latin/digit run inside Devanagari text, N19). */
  latin?: boolean;
  /** Tabular numerals for every time, date and degree (design.md 2.2). */
  tabular?: boolean;
}

/** RN text style for a type-scale entry in a language: size, line height (Devanagari body 28), family, weight. */
export function textStyle(kind: TypeStyleName, lang: Lang, opts: TextStyleOptions = {}): TextStyle {
  const def = typeScale[kind];
  const weight = opts.weight ?? def.weight;
  const devanagari = lang !== 'en' && !opts.latin;
  const style: TextStyle = {
    fontSize: def.size,
    lineHeight: devanagari ? def.lineDevanagari : def.line,
    fontFamily: fontFamilyFor(def.family, lang, weight, opts.latin),
    // Weight is carried by the face name; keep fontWeight normal so Android does not synthesise bold on top.
    fontWeight: 'normal',
    ...(opts.tabular ? { fontVariant: ['tabular-nums'] as const } : {}),
  };
  return style;
}
