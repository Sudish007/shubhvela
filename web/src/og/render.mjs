// OG image renderer (plan P6): text layers through sharp/libvips (Pango shapes Devanagari correctly) with the self-hosted
// TTFs passed as `fontfile` (no system fonts needed, same output on Windows and the Linux runner), the brand mark through
// @resvg/resvg-js (geometry only, from web/public/brand/logo.svg when the brand run has delivered it), composited onto
// paper and quantised to a palette PNG (compressionLevel 9, ~15-25 KB). Never reads a PNG into a text channel.
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { FONT_FILES, FONT_SRC_DIR, WEB_DIR } from '../config.mjs';
import { FAMILY, OG_H, OG_W, escapeMarkup, ogTemplate } from './templates.mjs';

export const BRAND_MARK = resolve(WEB_DIR, 'public', 'brand', 'logo.svg');

const FONTFILE = {
  [FAMILY.display]: resolve(FONT_SRC_DIR, FONT_FILES.display),
  [FAMILY.sans]: resolve(FONT_SRC_DIR, FONT_FILES.sansRegular),
  [FAMILY.deva]: resolve(FONT_SRC_DIR, FONT_FILES.devaRegular),
};

/** Renders one text run to a transparent RGBA PNG; returns { png, width, height }. Pango wraps at maxWidth. */
async function textLayer({ text, family, size, color, maxWidth }) {
  const img = sharp({
    text: {
      text: `<span foreground="${color}">${escapeMarkup(text)}</span>`,
      font: `${family} ${size}`,
      fontfile: FONTFILE[family],
      width: maxWidth,
      align: 'centre',
      rgba: true,
      dpi: 72,
    },
  });
  const png = await img.png().toBuffer({ resolveWithObject: true });
  return { png: png.data, width: png.info.width, height: png.info.height };
}

/** Shrinks the font size until the run fits one line (singleLine) or at most maxLines, never below minSize. */
async function fitText(layer) {
  let size = layer.size;
  for (;;) {
    const r = await textLayer({ ...layer, size });
    const lines = Math.round(r.height / (size * 1.35));
    const ok = layer.singleLine ? lines <= 1 && r.width <= layer.maxWidth : lines <= (layer.maxLines ?? 2);
    if (ok || size <= layer.minSize) return { ...r, size };
    size -= 2;
  }
}

/** The brand mark (geometry only) at `size` px, or null when the brand run has not delivered logo.svg. */
export function markPng(size) {
  if (!existsSync(BRAND_MARK)) return null;
  const svg = readFileSync(BRAND_MARK, 'utf8');
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: size }, background: 'rgba(0,0,0,0)', font: { loadSystemFonts: false } });
  return Buffer.from(r.render().asPng());
}

/**
 * Writes one OG image. opts: { lang, title, subtitle?, url, out (absolute path) }. Returns { bytes, mark: boolean }.
 */
export async function renderOg(opts) {
  const tpl = ogTemplate({ ...opts, hasMark: existsSync(BRAND_MARK) });
  const layers = [];
  // Wordmark row: mark + "शुभवेला · Shubhvela", centred as a group.
  const wm = await textLayer({ text: tpl.wordmark.text, family: tpl.wordmark.family, size: tpl.wordmark.size, color: tpl.wordmark.color, maxWidth: OG_W });
  const mark = tpl.wordmark.hasMark ? markPng(tpl.wordmark.markSize) : null;
  const groupWidth = wm.width + (mark ? tpl.wordmark.markSize + tpl.wordmark.gap : 0);
  let x = Math.round((OG_W - groupWidth) / 2);
  if (mark) {
    layers.push({ input: mark, left: x, top: Math.round(tpl.wordmark.y + wm.height / 2 - tpl.wordmark.markSize / 2) });
    x += tpl.wordmark.markSize + tpl.wordmark.gap;
  }
  layers.push({ input: wm.png, left: x, top: tpl.wordmark.y });
  // Vermilion rule.
  const rule = await sharp({ create: { width: tpl.rule.width, height: tpl.rule.height, channels: 4, background: tpl.rule.color } }).png().toBuffer();
  layers.push({ input: rule, left: Math.round(tpl.rule.x), top: tpl.rule.y });
  // Title, subtitle, URL.
  for (const layer of tpl.layers) {
    const r = await fitText(layer);
    layers.push({ input: r.png, left: Math.round((OG_W - r.width) / 2), top: layer.y });
  }
  const png = await sharp({ create: { width: OG_W, height: OG_H, channels: 3, background: tpl.background } })
    .composite(layers)
    .png({ palette: true, compressionLevel: 9, quality: 90 })
    .toBuffer();
  await mkdir(dirname(opts.out), { recursive: true });
  await writeFile(opts.out, png);
  return { bytes: png.length, mark: Boolean(mark) };
}
