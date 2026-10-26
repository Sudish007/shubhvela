// Embedded fonts for the report HTML (design.md 2.2, N12): the bundled TTFs under app/assets/fonts become base64
// `@font-face` rules so the PDF's Devanagari matches the app. The bytes are read AT RUNTIME through expo-asset +
// expo-file-system (never inlined in source; build-rules binary-file rule) and cached in memory for the session.
// English reports embed Tiro (headings) + Noto Sans 400/600; Hindi and Bhojpuri add Noto Sans Devanagari 400/600.
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import type { Lang } from '../i18n';
import { FONT_FILES, type FontName } from '../theme/typography';

/** CSS family names used by the report stylesheets (app/src/pdf/html/common.ts). */
export const PDF_FAMILY = { display: 'Tiro Devanagari Hindi', sans: 'Noto Sans', devanagari: 'Noto Sans Devanagari' } as const;

export interface FontFace {
  family: (typeof PDF_FAMILY)[keyof typeof PDF_FAMILY];
  weight: 400 | 600;
  file: FontName;
}

const FACES: readonly FontFace[] = [
  { family: PDF_FAMILY.display, weight: 400, file: 'TiroDevanagariHindi' },
  { family: PDF_FAMILY.sans, weight: 400, file: 'NotoSans' },
  { family: PDF_FAMILY.sans, weight: 600, file: 'NotoSans-SemiBold' },
  { family: PDF_FAMILY.devanagari, weight: 400, file: 'NotoSansDevanagari' },
  { family: PDF_FAMILY.devanagari, weight: 600, file: 'NotoSansDevanagari-SemiBold' },
];

/** Faces a report in `lang` needs (Devanagari faces only for hi/bho). */
export function facesFor(lang: Lang): FontFace[] {
  return FACES.filter((f) => lang !== 'en' || f.family !== PDF_FAMILY.devanagari);
}

/** One @font-face rule per face (pure; tested). `base64` is the raw TTF in base64. */
export function fontFaceCss(faces: readonly { family: string; weight: number; base64: string }[]): string {
  return faces
    .map((f) => `@font-face{font-family:'${f.family}';font-weight:${f.weight};font-style:normal;src:url(data:font/ttf;base64,${f.base64}) format('truetype');}`)
    .join('\n');
}

// Metro asset ids of the five TTFs (the same files app/app/_layout.tsx registers with expo-font).
const MODULES: Record<FontName, number> = {
  TiroDevanagariHindi: require('../../assets/fonts/TiroDevanagariHindi-Regular.ttf'),
  NotoSans: require('../../assets/fonts/NotoSans-Regular.ttf'),
  'NotoSans-SemiBold': require('../../assets/fonts/NotoSans-SemiBold.ttf'),
  NotoSansDevanagari: require('../../assets/fonts/NotoSansDevanagari-Regular.ttf'),
  'NotoSansDevanagari-SemiBold': require('../../assets/fonts/NotoSansDevanagari-SemiBold.ttf'),
};

/** Reads one bundled TTF as base64 (expo-asset resolves the bundled file, expo-file-system reads it). */
export async function readFontBase64(file: FontName): Promise<string> {
  const asset = Asset.fromModule(MODULES[file]);
  if (!asset.localUri) await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  return new File(uri).base64();
}

export type FontLoader = (file: FontName) => Promise<string>;

const cache = new Map<FontName, Promise<string>>();

/** The complete @font-face block for a report language; bytes are read once per session. */
export async function fontCssFor(lang: Lang, load: FontLoader = readFontBase64): Promise<string> {
  const faces = facesFor(lang);
  const loaded = await Promise.all(
    faces.map(async (f) => {
      let p = cache.get(f.file);
      if (!p) {
        p = load(f.file).catch((e) => {
          cache.delete(f.file);
          throw e;
        });
        cache.set(f.file, p);
      }
      return { family: f.family, weight: f.weight, base64: await p };
    }),
  );
  return fontFaceCss(loaded);
}

export function resetFontCacheForTests(): void {
  cache.clear();
}

/** File names of the bundled faces (for the verification notes; no bytes). */
export const PDF_FONT_FILES = FACES.map((f) => FONT_FILES[f.file]);
