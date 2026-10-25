// Reports which bundled fonts carry the glyphs the UI relies on (plan.md P17, design review N15).
// Usage: npx tsx packages/engine/scripts/check-glyphs.ts <fonts dir> [codepoint ...]
// Default code points: U+211E (PRESCRIPTION TAKE, the "retrograde" mark), U+00B7 (middle dot), U+2013 (en dash),
// U+00B0 (degree), U+2032 (prime), U+2192 (right arrow). Exit code 1 when U+211E is missing from either Noto family,
// which is the signal to keep the retro tag as "R" + the word (P17).
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import opentype from 'opentype.js';

const dir = resolve(process.argv[2] ?? 'app/assets/fonts');
const extra = process.argv.slice(3).map((s) => parseInt(s.replace(/^U\+/i, ''), 16));
const codepoints = extra.length ? extra : [0x211e, 0x00b7, 0x2013, 0x00b0, 0x2032, 0x2192];

const files = readdirSync(dir).filter((f) => /\.(ttf|otf)$/i.test(f)).sort();
if (files.length === 0) {
  console.error(`No .ttf/.otf files under ${dir}`);
  process.exit(2);
}

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

const coverage = new Map<string, Map<number, boolean>>();
for (const f of files) {
  const font = opentype.parse(toArrayBuffer(readFileSync(join(dir, f))));
  const names = font.names as unknown as Record<string, Record<string, string> | undefined>;
  const version = names.version?.en ?? '?';
  const row = new Map<number, boolean>();
  for (const cp of codepoints) {
    // charToGlyphIndex returns 0 (.notdef) when the cmap has no entry for the code point.
    row.set(cp, font.charToGlyphIndex(String.fromCodePoint(cp)) > 0);
  }
  coverage.set(f, row);
  console.log(`${f}  (${version.trim()}; ${font.numGlyphs} glyphs)`);
  for (const cp of codepoints) {
    console.log(`  U+${cp.toString(16).toUpperCase().padStart(4, '0')} ${String.fromCodePoint(cp)}  ${row.get(cp) ? 'yes' : 'NO'}`);
  }
}

const rx = 0x211e;
const notoLatin = files.filter((f) => /^NotoSans-/.test(f));
const notoDeva = files.filter((f) => /^NotoSansDevanagari-/.test(f));
const bothCover = notoLatin.length > 0 && notoDeva.length > 0 && [...notoLatin, ...notoDeva].every((f) => coverage.get(f)?.get(rx));
console.log('');
console.log(
  bothCover
    ? 'U+211E is present in every Noto Sans and Noto Sans Devanagari face: the retrograde tag may use the glyph.'
    : 'U+211E is NOT covered by both Noto families: keep the retrograde tag as "R" + the word (P17, N15).',
);
process.exit(bothCover ? 0 : 1);
