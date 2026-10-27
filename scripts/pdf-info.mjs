#!/usr/bin/env node
// Reports size, page count and embedded font names of PDF files (B08 PDF check; no PDF library needed).
// Page count = number of "/Type /Page" page objects (not "/Pages"); Android's print pipeline (expo-print ->
// PdfDocument / Skia) writes plain, uncompressed object headers, so the regex count is exact for these files.
// Usage: node scripts/pdf-info.mjs <file.pdf> [...]
import { readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';

const out = [];
for (const file of process.argv.slice(2)) {
  const buf = readFileSync(file);
  const latin = buf.toString('latin1');
  const pages = (latin.match(/\/Type\s*\/Page(?![s])/g) || []).length;
  const fonts = [...new Set((latin.match(/\/BaseFont\s*\/([A-Za-z0-9+_.-]+)/g) || []).map((m) => m.replace(/\/BaseFont\s*\//, '').replace(/^[A-Z]{6}\+/, '')))];
  out.push({ file: basename(file), bytes: statSync(file).size, pages, fonts, devanagari: /NotoSansDevanagari/.test(latin) });
}
console.log(JSON.stringify(out, null, 2));
