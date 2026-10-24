#!/usr/bin/env node
// Shrinks PNG screenshots in place so no side exceeds 1920 px (binary-file rule: read_file only
// after shrinking). Usage: node scripts/shrink-png.mjs <file.png> [more.png ...] [--max 1920]
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const maxIdx = args.indexOf('--max');
const MAX = maxIdx >= 0 ? Number(args[maxIdx + 1]) : 1920;
const files = args.filter((a, i) => !a.startsWith('--') && (maxIdx < 0 || i !== maxIdx + 1));
if (files.length === 0) {
  console.error('usage: node scripts/shrink-png.mjs <file.png> [...] [--max 1920]');
  process.exit(3);
}

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('sharp is not installed; run `npm install` at the repo root.');
  process.exit(1);
}

for (const file of files) {
  const input = readFileSync(file);
  const meta = await sharp(input).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (w <= MAX && h <= MAX) {
    console.log(`${file}: ${w}x${h} (unchanged)`);
    continue;
  }
  const out = await sharp(input)
    .resize({ width: MAX, height: MAX, fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
  writeFileSync(file, out);
  const m2 = await sharp(out).metadata();
  console.log(`${file}: ${w}x${h} -> ${m2.width}x${m2.height}`);
}
