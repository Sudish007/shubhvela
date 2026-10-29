#!/usr/bin/env node
// gen-brand-assets.mjs - renders every Shubhvela brand asset from app/brand/lib (mark + text engine) with sharp,
// and validates the whole set. No system fonts, no gradients, no filters; flat paper + ink + vermilion only.
//
//   node scripts/gen-brand-assets.mjs            generate everything, then validate
//   node scripts/gen-brand-assets.mjs --check    validate only (exit 1 on any failure); used by CI and d-ship
//   node scripts/gen-brand-assets.mjs --proof <dir>   also write legibility proofs (48 / 36 px launcher) to <dir>
//
// Outputs (all committed):
//   app/brand/*.svg                      vector sources (mark, wordmarks, lockups, feature graphic, screenshot frame)
//   app/assets/*.png                     Expo icon / adaptive layers / splash icon / favicon (file names fixed by app.json)
//   app/android/app/src/main/res/        mipmap-*/ic_launcher*.webp, drawable-*/splashscreen_logo.png, notification_icon.png
//   app/playstore-assets/                icon-512.png, feature-graphic-1024x500.png, screenshots/<lang>/NN-*.png
//   web/public/brand/                    logo.svg, favicons, og-base.png, lockup SVG + PNG
// Screenshot sources are the emulator captures under .agents/tasks/v1-build/shots (gitignored); without them the
// screenshot step is skipped and the committed PNGs are only validated.
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { T, ICON, BOX, BOX_SIZE, svgDoc, layer108, window72, markAt, markBox, lockupH, lockupV, featureGraphic, ogBase, text, measure, r2, mark } from '../app/brand/lib/mark.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const P = (...s) => join(ROOT, ...s);
const BRAND = P('app', 'brand');
const ASSETS = P('app', 'assets');
const RES = P('app', 'android', 'app', 'src', 'main', 'res');
const PLAY = P('app', 'playstore-assets');
const WEB = P('web', 'public', 'brand');
const SHOTS = P('.agents', 'tasks', 'v1-build', 'shots');

const args = process.argv.slice(2);
const CHECK_ONLY = args.includes('--check');
const proofIdx = args.indexOf('--proof');
const PROOF_DIR = proofIdx >= 0 ? args[proofIdx + 1] : null;

sharp.cache(false);
sharp.concurrency(1);

const DENSITIES = [['mdpi', 1], ['hdpi', 1.5], ['xhdpi', 2], ['xxhdpi', 3], ['xxxhdpi', 4]];
const LANGS = ['en', 'hi', 'bho'];
const PAPER = T.light.paper;

// ---------- raster helpers ----------
async function raster(svg) {
  for (let attempt = 1; ; attempt++) {
    try {
      return sharp(Buffer.from(svg), { density: 72 });
    } catch (e) {
      if (attempt >= 3) throw e;
      await new Promise((r) => setTimeout(r, 300));
    }
  }
}
const ensureDir = (f) => mkdirSync(dirname(f), { recursive: true });
async function writePng(file, svg, { alpha = true } = {}) {
  ensureDir(file);
  let img = await raster(svg);
  img = alpha ? img.ensureAlpha() : img.flatten({ background: PAPER }).removeAlpha();
  await img.png({ compressionLevel: 9, palette: false }).toFile(file);
  log(file);
}
async function writeWebp(file, svg) {
  ensureDir(file);
  const img = (await raster(svg)).ensureAlpha();
  await img.webp({ lossless: true }).toFile(file);
  log(file);
}
function writeSvg(file, svg) {
  ensureDir(file);
  writeFileSync(file, svg + '\n');
  log(file);
}
const log = (f) => console.log('  wrote', f.slice(ROOT.length + 1).replace(/\\/g, '/'));

// ---------- the SVG sources (app/brand) ----------
function sources() {
  const out = {};
  // mark: tight viewBox on the 46 dp visible box, coordinates in the 108 dp space
  const vb = `${BOX.left} ${BOX.top} ${BOX_SIZE} ${BOX_SIZE}`;
  out['mark.svg'] = svgDoc(BOX_SIZE, BOX_SIZE, mark({ ink: ICON.ink, accent: ICON.accent }), vb);
  out['mark-mono.svg'] = svgDoc(BOX_SIZE, BOX_SIZE, mark({ ink: ICON.ink, accent: ICON.ink }), vb);
  // adaptive icon: both layers in one 108 dp document (background rect + foreground mark), with the 72 dp window and
  // the 66 dp safe circle as guides on a hidden layer
  out['icon-adaptive-108.svg'] = svgDoc(108, 108,
    `<g id="background"><rect width="108" height="108" fill="${ICON.paper}"/></g><g id="foreground">${mark({ ink: ICON.ink, accent: ICON.accent })}</g>` +
    `<g id="guides" display="none" fill="none" stroke="${T.light.ink3}" stroke-width="0.5"><rect x="18" y="18" width="72" height="72"/><circle cx="54" cy="54" r="33" stroke="${ICON.accent}"/></g>`);
  // wordmarks (Tiro, ink), tight boxes
  for (const [name, str, fs] of [['wordmark-devanagari.svg', 'शुभवेला', 100], ['wordmark-latin.svg', 'Shubhvela', 100]]) {
    const t = text('tiro', str, fs, 0, 0, T.light.ink);
    const b = t.bbox, pad = 2;
    out[name] = svgDoc(r2(b.x2 - b.x1 + 2 * pad), r2(b.y2 - b.y1 + 2 * pad), t.svg, `${r2(b.x1 - pad)} ${r2(b.y1 - pad)} ${r2(b.x2 - b.x1 + 2 * pad)} ${r2(b.y2 - b.y1 + 2 * pad)}`);
  }
  for (const theme of ['light', 'dark']) {
    const h = lockupH(theme, 100);
    out[`lockup-horizontal-${theme}.svg`] = svgDoc(r2(h.w), r2(h.h), h.svg);
    const v = lockupV(theme, 100);
    out[`lockup-stacked-${theme}.svg`] = svgDoc(r2(v.w + 8), r2(v.h), `<g transform="translate(${r2(v.w / 2 + 4)} 0)">${v.svg}</g>`);
  }
  out['feature-graphic.svg'] = featureGraphic();
  out['splash.svg'] = splashSvg(1080, 2400, 384, true);
  out['screenshot-frame.svg'] = screenshotBase('en', 'Caption goes here (one line)', true);
  return out;
}

// ---------- compositions ----------
/** Splash: mark with `boxPx` visible height centred on W x H; paper background when `paper`, else transparent. */
function splashSvg(W, H, boxPx, paper) {
  const bg = paper ? `<rect width="${W}" height="${H}" fill="${PAPER}"/>` : '';
  return svgDoc(W, H, bg + markBox('light', boxPx, (W - boxPx) / 2, (H - boxPx) / 2));
}
/** Square canvas with the mark's box = size * ratio, transparent (splash icon / notification silhouette). */
function centredMark(size, ratio, mono) {
  const box = size * ratio;
  return svgDoc(size, size, markBox('light', box, (size - box) / 2, (size - box) / 2, mono));
}

// Screenshot frame geometry (1080 x 1920, 9:16). The phone frame bleeds off the bottom edge.
const SS = { W: 1080, H: 1920, screenW: 864, screenX: 108, screenY: 300, bezel: 18, frameR: 72, screenR: 54 };
SS.screenH = SS.H - SS.screenY; // 1620 visible
/** Paper background, caption, vermilion rule and the flat ink frame. When `slot`, an empty screen slot is drawn. */
function screenshotBase(lang, caption, slot = false) {
  const t = T.light;
  const parts = [`<rect width="${SS.W}" height="${SS.H}" fill="${t.paper}"/>`];
  const deva = lang !== 'en';
  const font = deva ? 'tiro' : 'sansSemi';
  const maxW = SS.W - 2 * 72;
  let fs = deva ? 66 : 56;
  const minFs = deva ? 54 : 46;
  while (measure(font, caption, fs) > maxW && fs > minFs) fs -= 1;
  const w = measure(font, caption, fs);
  if (w > maxW) throw new Error(`caption too long for one line at ${fs}px (${Math.round(w)} > ${maxW}): ${caption}`);
  parts.push(text(font, caption, fs, SS.W / 2, 172, t.ink, { align: 'middle' }).svg);
  parts.push(`<rect x="${SS.W / 2 - 24}" y="222" width="48" height="4" fill="${t.accent}"/>`);
  const fx = SS.screenX - SS.bezel, fy = SS.screenY - SS.bezel, fw = SS.screenW + 2 * SS.bezel, fh = SS.H - fy + SS.frameR;
  parts.push(`<rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" rx="${SS.frameR}" fill="${t.ink}"/>`);
  if (slot) parts.push(`<rect x="${SS.screenX}" y="${SS.screenY}" width="${SS.screenW}" height="${SS.screenH + SS.screenR}" rx="${SS.screenR}" fill="${t.surface}"/>`);
  return svgDoc(SS.W, SS.H, parts.join(''));
}

// ---------- marketing screenshots ----------
// Slots: the eight store screens, their captions per language (copy adapted from packages/content/ui/<lang>.json,
// respectful Bhojpuri रउआ register) and where the capture comes from. Raw 1080 x 2400 captures (phase-c/raw) are
// preferred; the 864 x 1920 shrunk captures of phase-a/b are used only as a stand-in and the slot is marked pending.
const SLOTS = [
  // 'today-segments' = the Today tab at the top with the good-hours band open (the plain 'today' capture is scrolled to the note)
  { file: '01-today', screen: 'today-segments', shrunk: 'phase-a', caption: { en: 'Good hours today, in one band', hi: 'आज के शुभ समय, एक पट्टी में', bho: 'आज के शुभ बेला, एक पट्टी में' } },
  { file: '02-charts', screen: 'charts', shrunk: 'phase-b', caption: { en: 'Your kundli, three Indian styles', hi: 'आपकी कुंडली, तीन भारतीय शैलियाँ', bho: 'राउर कुंडली, तीन भारतीय शैली' } },
  { file: '03-family', screen: 'family', shrunk: 'phase-b', caption: { en: 'Tithi birthdays and shraddha', hi: 'जन्म-तिथि और श्राद्ध, हर साल', bho: 'जनम-तिथि आ श्राद्ध, हर साल' } },
  { file: '04-muhurat', screen: 'muhurat', shrunk: 'phase-b', caption: { en: 'Muhurat finder, rules shown', hi: 'मुहूर्त खोज, नियम साथ में', bho: 'मुहूर्त खोज, नियम साथे' } },
  { file: '05-matching', screen: 'match-result', shrunk: 'phase-b', caption: { en: '36-guna matching, explained', hi: '36 गुण मिलान, कारण सहित', bho: '36 गुण मिलान, कारन के साथे' } },
  { file: '06-learn', screen: 'learn', caption: { en: '21 lessons, on your own chart', hi: 'इक्कीस पाठ, आपकी अपनी कुंडली पर', bho: 'एकइस पाठ, राउर आपन कुंडली पर' } },
  { file: '07-janam-patri', screen: 'pdf-preview', shrunk: 'phase-b', caption: { en: 'Janam Patri PDF, included in Pro', hi: 'जन्म पत्री PDF, Pro में शामिल', bho: 'जनम पत्री PDF, Pro में शामिल' } },
  { file: '08-panchang', screen: 'today-panchang-sheet', shrunk: 'phase-a', caption: { en: 'Full panchang for your place', hi: 'पूरा पंचांग, आपके स्थान के लिए', bho: 'पूरा पंचांग, राउर जगह खातिर' } },
];

/** Finds the capture for a slot: raw Pro-seed capture, raw capture, else the shrunk one (pending). */
function findCapture(slot, lang) {
  const raw = join(SHOTS, 'phase-c', 'raw');
  for (const n of [`${slot.screen}-${lang}-light-pro-390.png`, `${slot.screen}-${lang}-light-390-pro.png`, `${slot.screen}-${lang}-light-390.png`]) {
    if (existsSync(join(raw, n))) return { path: join(raw, n), kind: 'raw' };
  }
  if (slot.shrunk) {
    const n = join(SHOTS, slot.shrunk, `${slot.screen}-${lang}-light-390.png`);
    if (existsSync(n)) return { path: n, kind: 'shrunk' };
  }
  return null;
}

const near = (v, t, tol) => Math.abs(v - t) <= tol;
/**
 * Locates the AdMob test banner / native ad in a light-theme capture: the first row (below 45 % of the height) that is
 * mostly near-black (the "Test Ad" bar of the banner) or carries Google-blue pixels (the native ad's "Nice job!" flag).
 * Returns the row to crop at = the paper gap just above the ad, or null when there is no ad.
 */
function findAdCrop(data, w, h, channels) {
  const x0 = Math.floor(w * 0.1), x1 = Math.floor(w * 0.9);
  const px = (x, y) => { const i = (y * w + x) * channels; return [data[i], data[i + 1], data[i + 2]]; };
  // the banner's label bar is >= 6 px tall even in the shrunk captures; a 1-3 px chart border or hairline is not an ad
  let adRow = -1, run = 0;
  for (let y = Math.floor(h * 0.45); y < h; y++) {
    let black = 0, blue = 0;
    for (let x = x0; x < x1; x += 2) {
      const [r, g, b] = px(x, y);
      if (r < 50 && g < 50 && b < 50) black++;
      if (b > 200 && r < 110 && g > 90 && g < 190) blue++;
    }
    const n = (x1 - x0) / 2;
    if (blue >= 15) { adRow = y; break; }
    run = black / n >= 0.7 ? run + 1 : 0;
    if (run >= 6) { adRow = y - run + 1; break; }
  }
  if (adRow < 0) return null;
  const isPaperRow = (y) => {
    let ok = 0, n = 0;
    for (let x = x0; x < x1; x += 2) { const [r, g, b] = px(x, y); n++; if (near(r, 0xfa, 8) && near(g, 0xf7, 8) && near(b, 0xf2, 8)) ok++; }
    return ok / n >= 0.97;
  };
  // Walk up through gaps and elements: keep the first element that is tall enough to be a card or a list block
  // (>= 60 rows); a lone section heading or hairline left dangling just above the ad is dropped with it. Never drop
  // more than 240 rows of content; then fall back to the first paper gap.
  let y = adRow - 1;
  let fallback = null;
  while (y > 0 && adRow - y < 240) {
    const gapStart = y;
    while (y > 0 && isPaperRow(y)) y--;
    const gapLen = gapStart - y;
    if (fallback === null && gapLen > 0) fallback = gapStart;
    const elBottom = y;
    while (y > 0 && !isPaperRow(y)) y--;
    const elH = elBottom - y;
    if (elH >= 60) return elBottom + Math.min(gapLen, 12) + 1;
  }
  return fallback ?? Math.max(0, adRow - 8);
}

async function screenshot(slot, lang, cap, outFile) {
  const img = sharp(cap.path);
  const meta = await img.metadata();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const cropY = findAdCrop(data, info.width, info.height, info.channels);
  let screen = sharp(cap.path);
  if (cropY !== null) {
    // crop the ad strip (and whatever sits below it) away and extend the paper background to the original height
    screen = sharp(await screen.extract({ left: 0, top: 0, width: meta.width, height: cropY }).png().toBuffer())
      .extend({ top: 0, bottom: meta.height - cropY, left: 0, right: 0, background: PAPER });
  }
  if (meta.width < SS.screenW) throw new Error(`${cap.path} is ${meta.width} px wide: would be upscaled`);
  const scaledH = Math.round(meta.height * (SS.screenW / meta.width));
  const visibleH = Math.min(SS.screenH + SS.screenR, scaledH);
  let screenBuf = await sharp(await screen.png().toBuffer()).resize(SS.screenW, scaledH).extract({ left: 0, top: 0, width: SS.screenW, height: visibleH }).ensureAlpha().png().toBuffer();
  // rounded screen corners (mask with the same radius as the frame's inner edge)
  const maskSvg = svgDoc(SS.screenW, visibleH, `<rect width="${SS.screenW}" height="${visibleH + SS.screenR}" rx="${SS.screenR}" fill="#fff"/>`);
  const mask = await (await raster(maskSvg)).ensureAlpha().png().toBuffer();
  screenBuf = await sharp(screenBuf).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  const base = await (await raster(screenshotBase(lang, slot.caption[lang]))).ensureAlpha().png().toBuffer();
  ensureDir(outFile);
  await sharp(base).composite([{ input: screenBuf, left: SS.screenX, top: SS.screenY }]).removeAlpha().png({ compressionLevel: 9, palette: false }).toFile(outFile);
  log(outFile);
  return { source: cap.path.slice(ROOT.length + 1).replace(/\\/g, '/'), kind: cap.kind, sourceSize: `${meta.width}x${meta.height}`, adCropY: cropY };
}

async function screenshots() {
  if (!existsSync(join(SHOTS, 'phase-c', 'raw'))) { console.log('  (no emulator captures under .agents/tasks/v1-build/shots: screenshots not regenerated)'); return; }
  const provenance = { generated: new Date().toISOString().slice(0, 10), note: 'kind=raw: 1080x2400 emulator capture; kind=shrunk: 864x1920 stand-in, PENDING a re-shoot with scripts/shots.ps1 -KeepRaw (pro=1 seed, light theme). adCropY: row of the source where the AdMob test banner was cropped away and the paper background extended (null = no ad in the capture).', slots: {} };
  for (const lang of LANGS) {
    for (const slot of SLOTS) {
      const cap = findCapture(slot, lang);
      const out = join(PLAY, 'screenshots', lang, `${slot.file}.png`);
      if (!cap) { console.warn(`  MISSING capture for ${slot.screen} (${lang}); slot left as is`); provenance.slots[`${lang}/${slot.file}`] = { kind: 'missing' }; continue; }
      provenance.slots[`${lang}/${slot.file}`] = { ...(await screenshot(slot, lang, cap, out)), caption: slot.caption[lang], pending: cap.kind !== 'raw' };
    }
  }
  const pf = join(PLAY, 'screenshots', 'sources.json');
  writeFileSync(pf, JSON.stringify(provenance, null, 2) + '\n');
  log(pf);
}

// ---------- generation ----------
async function generate() {
  console.log('brand sources');
  for (const [name, svg] of Object.entries(sources())) writeSvg(join(BRAND, name), svg);

  console.log('app/assets');
  await writePng(join(ASSETS, 'icon.png'), svgDoc(1024, 1024, window72(0, 0, 1024, { bg: PAPER })), { alpha: false });
  await writePng(join(ASSETS, 'android-icon-foreground.png'), svgDoc(512, 512, layer108(0, 0, 512)));
  await writePng(join(ASSETS, 'android-icon-background.png'), svgDoc(512, 512, `<rect width="512" height="512" fill="${PAPER}"/>`));
  await writePng(join(ASSETS, 'android-icon-monochrome.png'), svgDoc(432, 432, layer108(0, 0, 432, { mono: ICON.ink })));
  await writePng(join(ASSETS, 'splash-icon.png'), centredMark(1024, 1 / 3));
  await writePng(join(ASSETS, 'favicon.png'), svgDoc(48, 48, window72(0, 0, 48, { bg: PAPER })));

  console.log('android res');
  for (const [d, k] of DENSITIES) {
    const s48 = 48 * k, s108 = 108 * k;
    await writeWebp(join(RES, `mipmap-${d}`, 'ic_launcher.webp'), svgDoc(s48, s48, window72(0, 0, s48, { bg: PAPER })));
    await writeWebp(join(RES, `mipmap-${d}`, 'ic_launcher_round.webp'), svgDoc(s48, s48, window72(0, 0, s48, { bg: PAPER, circle: true })));
    await writeWebp(join(RES, `mipmap-${d}`, 'ic_launcher_foreground.webp'), svgDoc(s108, s108, layer108(0, 0, s108)));
    await writeWebp(join(RES, `mipmap-${d}`, 'ic_launcher_background.webp'), svgDoc(s108, s108, `<rect width="${s108}" height="${s108}" fill="${PAPER}"/>`));
    await writeWebp(join(RES, `mipmap-${d}`, 'ic_launcher_monochrome.webp'), svgDoc(s108, s108, layer108(0, 0, s108, { mono: ICON.ink })));
    // Android 12 splash: 288 dp drawable, the inner 192 dp circle is shown; mark 96 dp tall = one third of the canvas
    await writePng(join(RES, `drawable-${d}`, 'splashscreen_logo.png'), centredMark(288 * k, 1 / 3));
    // notification: 24 dp white silhouette with 2 dp padding; Android tints it with notification_icon_color
    await writePng(join(RES, `drawable-${d}`, 'notification_icon.png'), centredMark(24 * k, 20 / 24, '#FFFFFF'));
  }

  console.log('play graphics');
  await writePng(join(PLAY, 'icon-512.png'), svgDoc(512, 512, window72(0, 0, 512, { bg: PAPER })));
  await writePng(join(PLAY, 'feature-graphic-1024x500.png'), featureGraphic(), { alpha: false });
  await screenshots();

  console.log('web/public/brand');
  const src = sources();
  writeSvg(join(WEB, 'logo.svg'), src['mark.svg']);
  writeSvg(join(WEB, 'logo-mono.svg'), src['mark-mono.svg']);
  writeSvg(join(WEB, 'favicon.svg'), svgDoc(64, 64, window72(0, 0, 64, { bg: PAPER })));
  await writePng(join(WEB, 'favicon-32.png'), svgDoc(32, 32, window72(0, 0, 32, { bg: PAPER })));
  await writePng(join(WEB, 'favicon-180.png'), svgDoc(180, 180, window72(0, 0, 180, { bg: PAPER })), { alpha: false });
  await writePng(join(WEB, 'og-base.png'), ogBase(), { alpha: false });
  for (const theme of ['light', 'dark']) {
    const h = lockupH(theme, 200), v = lockupV(theme, 200);
    writeSvg(join(WEB, `lockup-horizontal-${theme}.svg`), src[`lockup-horizontal-${theme}.svg`]);
    writeSvg(join(WEB, `lockup-stacked-${theme}.svg`), src[`lockup-stacked-${theme}.svg`]);
    await writePng(join(WEB, `lockup-horizontal-${theme}.png`), svgDoc(Math.ceil(h.w), Math.ceil(h.h), h.svg));
    await writePng(join(WEB, `lockup-stacked-${theme}.png`), svgDoc(Math.ceil(v.w + 16), Math.ceil(v.h), `<g transform="translate(${r2(v.w / 2 + 8)} 0)">${v.svg}</g>`));
  }
}

// ---------- legibility proofs ----------
async function proofs(dir) {
  mkdirSync(dir, { recursive: true });
  const src = join(RES, 'mipmap-xxxhdpi', 'ic_launcher_round.webp');
  for (const s of [48, 36]) await sharp(src).resize(s, s).png().toFile(join(dir, `launcher-${s}.png`));
  // sheet: the 48 and 36 px renders at 1x and 4x nearest-neighbour on light and dark wallpaper
  const tiles = [];
  let x = 24;
  for (const [s, up] of [[48, 1], [36, 1], [48, 4], [36, 4]]) {
    const buf = await sharp(src).resize(s, s).resize(s * up, s * up, { kernel: 'nearest' }).png().toBuffer();
    tiles.push({ input: buf, left: x, top: 24 }, { input: buf, left: x, top: 260 });
    x += s * up + 40;
  }
  const W = x, H = 500;
  const bg = await (await raster(svgDoc(W, H, `<rect width="${W}" height="236" fill="#D9D3C9"/><rect y="236" width="${W}" height="${H - 236}" fill="#26272B"/>`))).png().toBuffer();
  await sharp(bg).composite(tiles).png().toFile(join(dir, 'launcher-sheet.png'));
  console.log('  proofs in', dir);
}

// ---------- validation ----------
const failures = [];
const fail = (m) => { failures.push(m); console.error('  FAIL', m); };
const rel = (f) => f.slice(ROOT.length + 1).replace(/\\/g, '/');

async function expectImage(file, { w, h, alpha, channels, maxBytes, format }) {
  if (!existsSync(file)) { fail(`${rel(file)} missing`); return null; }
  const m = await sharp(file).metadata();
  const bytes = readFileSync(file).length;
  const problems = [];
  if (m.width !== w || m.height !== h) problems.push(`size ${m.width}x${m.height} != ${w}x${h}`);
  if (alpha !== undefined && !!m.hasAlpha !== alpha) problems.push(`hasAlpha ${m.hasAlpha} != ${alpha}`);
  if (channels !== undefined && m.channels !== channels) problems.push(`channels ${m.channels} != ${channels}`);
  if (format && m.format !== format) problems.push(`format ${m.format} != ${format}`);
  if (maxBytes && bytes > maxBytes) problems.push(`${bytes} bytes > ${maxBytes}`);
  if (problems.length) fail(`${rel(file)}: ${problems.join('; ')}`);
  else console.log(`  ok ${rel(file)} ${m.width}x${m.height} ch${m.channels} alpha=${m.hasAlpha} ${bytes}B`);
  return m;
}
async function pixels(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}
/** Every pixel with alpha >= 128 has the same RGB (the themed-icon / notification silhouette rule). */
async function expectSingleColour(file) {
  const { data, w, h } = await pixels(file);
  // fully opaque pixels must share one RGB; anti-aliased edge pixels carry the same colour at a lower alpha and are
  // allowed to round (sharp un-premultiplies them)
  let ref = null, bad = 0, opaque = 0;
  for (let i = 0; i < w * h * 4; i += 4) {
    if (data[i + 3] !== 255) continue;
    opaque++;
    if (!ref) ref = [data[i], data[i + 1], data[i + 2]];
    else if (Math.abs(data[i] - ref[0]) > 2 || Math.abs(data[i + 1] - ref[1]) > 2 || Math.abs(data[i + 2] - ref[2]) > 2) bad++;
  }
  if (!opaque) fail(`${rel(file)}: empty silhouette`);
  else if (bad) fail(`${rel(file)}: ${bad} pixels differ from the single colour rgb(${ref})`);
  else console.log(`  ok ${rel(file)} single colour rgb(${ref})`);
}
/** Alpha bounding box of a layer; checks it sits inside the central safe circle (ratio of the width) and is centred. */
async function expectAlphaBox(file, { safeCircle, centred, minFill }) {
  const { data, w, h } = await pixels(file);
  let x1 = w, y1 = h, x2 = -1, y2 = -1, outside = 0;
  const cx = w / 2, cy = h / 2, R = safeCircle ? (safeCircle * w) / 2 : Infinity;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] === 0) continue;
    if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y;
    if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > R) outside++;
  }
  if (x2 < 0) { fail(`${rel(file)}: fully transparent`); return; }
  if (outside) fail(`${rel(file)}: ${outside} pixels outside the ${safeCircle * 100}% safe circle`);
  if (centred && (Math.abs(x1 + x2 + 1 - w) > 2 || Math.abs(y1 + y2 + 1 - h) > 2)) fail(`${rel(file)}: mark not centred (box ${x1}-${x2}, ${y1}-${y2})`);
  if (minFill && (x2 - x1 + 1) / w < minFill) fail(`${rel(file)}: mark only ${Math.round(((x2 - x1 + 1) / w) * 100)}% of the width`);
  if (!failures.some((f) => f.startsWith(rel(file)))) console.log(`  ok ${rel(file)} alpha box ${x1}-${x2} x ${y1}-${y2}`);
}
/** Fully opaque alpha channel (Play icon: alpha present but no transparency). */
async function expectOpaque(file) {
  const { data, w, h } = await pixels(file);
  let t = 0;
  for (let i = 3; i < w * h * 4; i += 4) if (data[i] !== 255) t++;
  if (t) fail(`${rel(file)}: ${t} non-opaque pixels`);
}
/** Screenshot content check: no near-black band inside the screen (a baked ad banner), paper margin top-left. */
async function expectCleanScreenshot(file) {
  const { data, w, h } = await pixels(file);
  const x0 = SS.screenX + 30, x1 = SS.screenX + SS.screenW - 30;
  let run = 0;
  for (let y = SS.screenY + 20; y < h; y++) {
    let black = 0, n = 0;
    for (let x = x0; x < x1; x += 2) { const i = (y * w + x) * 4; n++; if (data[i] < 50 && data[i + 1] < 50 && data[i + 2] < 50) black++; }
    run = black / n >= 0.7 ? run + 1 : 0; // a chart border is 1-3 px; the "Test Ad" label bar is far taller
    if (run >= 6) { fail(`${rel(file)}: near-black band at row ${y} (ad banner?)`); return; }
  }
  const i = (10 * w + 10) * 4;
  if (!(near(data[i], 0xfa, 3) && near(data[i + 1], 0xf7, 3) && near(data[i + 2], 0xf2, 3))) fail(`${rel(file)}: background is not paper`);
}

async function check() {
  console.log('check: brand sources');
  const required = ['mark.svg', 'mark-mono.svg', 'icon-adaptive-108.svg', 'wordmark-devanagari.svg', 'wordmark-latin.svg', 'lockup-horizontal-light.svg', 'lockup-horizontal-dark.svg', 'lockup-stacked-light.svg', 'lockup-stacked-dark.svg', 'feature-graphic.svg', 'splash.svg', 'screenshot-frame.svg'];
  for (const n of required) {
    const f = join(BRAND, n);
    if (!existsSync(f)) { fail(`${rel(f)} missing`); continue; }
    const s = readFileSync(f, 'utf8');
    if (/linearGradient|radialGradient|<filter|feGaussianBlur|<image|<text/i.test(s)) fail(`${rel(f)}: contains a gradient, filter, embedded image or <text>`);
    const colours = new Set((s.match(/#[0-9a-fA-F]{6}\b/g) || []).map((c) => c.toUpperCase()));
    const allowed = new Set([...Object.values(T.light), ...Object.values(T.dark)].map((c) => c.toUpperCase()));
    for (const c of colours) if (!allowed.has(c)) fail(`${rel(f)}: colour ${c} is not a design token`);
  }
  if (existsSync(WEB)) for (const n of readdirSync(WEB).filter((n) => n.endsWith('.svg'))) {
    const s = readFileSync(join(WEB, n), 'utf8');
    if (/linearGradient|radialGradient|<filter|feGaussianBlur|<text/i.test(s)) fail(`web/public/brand/${n}: contains a gradient, filter or <text>`);
  }

  console.log('check: app/assets');
  await expectImage(join(ASSETS, 'icon.png'), { w: 1024, h: 1024, alpha: false, channels: 3, format: 'png' });
  await expectImage(join(ASSETS, 'android-icon-foreground.png'), { w: 512, h: 512, alpha: true, channels: 4 });
  await expectAlphaBox(join(ASSETS, 'android-icon-foreground.png'), { safeCircle: 0.66, centred: true, minFill: 0.4 });
  await expectImage(join(ASSETS, 'android-icon-background.png'), { w: 512, h: 512, alpha: true, channels: 4 });
  await expectOpaque(join(ASSETS, 'android-icon-background.png'));
  await expectImage(join(ASSETS, 'android-icon-monochrome.png'), { w: 432, h: 432, alpha: true, channels: 4 });
  await expectSingleColour(join(ASSETS, 'android-icon-monochrome.png'));
  await expectAlphaBox(join(ASSETS, 'android-icon-monochrome.png'), { safeCircle: 0.66, centred: true });
  await expectImage(join(ASSETS, 'splash-icon.png'), { w: 1024, h: 1024, alpha: true, channels: 4 });
  await expectAlphaBox(join(ASSETS, 'splash-icon.png'), { centred: true, minFill: 0.3 });
  await expectImage(join(ASSETS, 'favicon.png'), { w: 48, h: 48, alpha: true, channels: 4 });

  console.log('check: android res');
  for (const [d, k] of DENSITIES) {
    await expectImage(join(RES, `mipmap-${d}`, 'ic_launcher.webp'), { w: 48 * k, h: 48 * k, format: 'webp' });
    await expectImage(join(RES, `mipmap-${d}`, 'ic_launcher_round.webp'), { w: 48 * k, h: 48 * k, format: 'webp', alpha: true });
    await expectImage(join(RES, `mipmap-${d}`, 'ic_launcher_foreground.webp'), { w: 108 * k, h: 108 * k, format: 'webp', alpha: true });
    await expectAlphaBox(join(RES, `mipmap-${d}`, 'ic_launcher_foreground.webp'), { safeCircle: 0.66, centred: true });
    await expectImage(join(RES, `mipmap-${d}`, 'ic_launcher_background.webp'), { w: 108 * k, h: 108 * k, format: 'webp' });
    await expectImage(join(RES, `mipmap-${d}`, 'ic_launcher_monochrome.webp'), { w: 108 * k, h: 108 * k, format: 'webp', alpha: true });
    await expectSingleColour(join(RES, `mipmap-${d}`, 'ic_launcher_monochrome.webp'));
    await expectImage(join(RES, `drawable-${d}`, 'splashscreen_logo.png'), { w: 288 * k, h: 288 * k, alpha: true, channels: 4, format: 'png' });
    await expectAlphaBox(join(RES, `drawable-${d}`, 'splashscreen_logo.png'), { centred: true });
    await expectImage(join(RES, `drawable-${d}`, 'notification_icon.png'), { w: 24 * k, h: 24 * k, alpha: true, channels: 4, format: 'png' });
    await expectSingleColour(join(RES, `drawable-${d}`, 'notification_icon.png'));
  }
  const colors = readFileSync(join(RES, 'values', 'colors.xml'), 'utf8');
  for (const [name, val] of [['splashscreen_background', '#FAF7F2'], ['iconBackground', '#FAF7F2'], ['notification_icon_color', '#B83E18']]) {
    if (!new RegExp(`<color name="${name}">${val}</color>`, 'i').test(colors)) fail(`values/colors.xml: ${name} is not ${val}`);
  }
  const appJson = JSON.parse(readFileSync(P('app', 'app.json'), 'utf8')).expo;
  for (const [k, v] of [['icon', './assets/icon.png'], ['android.adaptiveIcon.foregroundImage', './assets/android-icon-foreground.png'], ['android.adaptiveIcon.backgroundImage', './assets/android-icon-background.png'], ['android.adaptiveIcon.monochromeImage', './assets/android-icon-monochrome.png'], ['android.adaptiveIcon.backgroundColor', '#FAF7F2']]) {
    const got = k.split('.').reduce((o, p) => o?.[p], appJson);
    if (got !== v) fail(`app.json ${k} = ${got}, expected ${v}`);
  }

  console.log('check: play graphics');
  // Play: icon 512 x 512, 32-bit PNG with alpha, <= 1024 KB; feature graphic 1024 x 500 PNG/JPEG, no alpha
  await expectImage(join(PLAY, 'icon-512.png'), { w: 512, h: 512, alpha: true, channels: 4, maxBytes: 1024 * 1024, format: 'png' });
  await expectOpaque(join(PLAY, 'icon-512.png'));
  await expectImage(join(PLAY, 'feature-graphic-1024x500.png'), { w: 1024, h: 500, alpha: false, channels: 3, maxBytes: 15 * 1024 * 1024, format: 'png' });
  // Play phone screenshots: PNG (24-bit, no alpha) or JPEG; each side 320-3840 px; long side <= 2 x short side; 2-8 per language; <= 8 MB
  for (const lang of LANGS) {
    const dir = join(PLAY, 'screenshots', lang);
    const files = existsSync(dir) ? readdirSync(dir).filter((n) => /\.(png|jpe?g)$/i.test(n)) : [];
    if (files.length < 2 || files.length > 8) fail(`screenshots/${lang}: ${files.length} files (Play allows 2-8)`);
    for (const n of files) {
      const f = join(dir, n);
      const m = await expectImage(f, { w: 1080, h: 1920, alpha: false, channels: 3, maxBytes: 8 * 1024 * 1024 });
      if (!m) continue;
      const lo = Math.min(m.width, m.height), hi = Math.max(m.width, m.height);
      if (lo < 320 || hi > 3840 || hi > 2 * lo) fail(`${rel(f)}: ${m.width}x${m.height} breaks the Play 320-3840 / 2:1 rule`);
      if (!/^0[1-8]-[a-z-]+\.png$/.test(n)) fail(`${rel(f)}: name must be NN-name.png`);
      await expectCleanScreenshot(f);
    }
  }
  const prov = join(PLAY, 'screenshots', 'sources.json');
  if (existsSync(prov)) {
    const pending = Object.entries(JSON.parse(readFileSync(prov, 'utf8')).slots).filter(([, v]) => v.pending || v.kind === 'missing').map(([k]) => k);
    if (pending.length) console.log(`  note: ${pending.length} screenshot slots are stand-ins pending a raw re-shoot: ${pending.join(', ')}`);
  }

  console.log('check: web/public/brand');
  for (const n of ['logo.svg', 'logo-mono.svg', 'favicon.svg', 'lockup-horizontal-light.svg', 'lockup-horizontal-dark.svg', 'lockup-stacked-light.svg', 'lockup-stacked-dark.svg']) if (!existsSync(join(WEB, n))) fail(`web/public/brand/${n} missing`);
  await expectImage(join(WEB, 'favicon-32.png'), { w: 32, h: 32, alpha: true, channels: 4 });
  await expectImage(join(WEB, 'favicon-180.png'), { w: 180, h: 180, alpha: false, channels: 3 });
  await expectImage(join(WEB, 'og-base.png'), { w: 1200, h: 630, alpha: false, channels: 3 });
  for (const theme of ['light', 'dark']) {
    for (const n of [`lockup-horizontal-${theme}.png`, `lockup-stacked-${theme}.png`]) {
      const f = join(WEB, n);
      if (!existsSync(f)) { fail(`${rel(f)} missing`); continue; }
      const m = await sharp(f).metadata();
      if (!m.hasAlpha) fail(`${rel(f)}: lockup PNG must be transparent`);
      else console.log(`  ok ${rel(f)} ${m.width}x${m.height}`);
    }
  }
}

// ---------- main ----------
if (!CHECK_ONLY) await generate();
if (PROOF_DIR) await proofs(PROOF_DIR);
await check();
if (failures.length) { console.error(`\n${failures.length} check(s) failed`); process.exit(1); }
console.log('\nall brand asset checks passed');
