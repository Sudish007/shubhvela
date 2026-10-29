#!/usr/bin/env node
// gen-store-assets.mjs - Play listing kit gate (D04).
//
//   node scripts/gen-store-assets.mjs --check   validate app/playstore-assets against Google Play's upload rules and
//                                               the store-listing text limits; exit 1 on any failure.
//   node scripts/gen-store-assets.mjs           same, but first (re)generates the graphics through the brand generator.
//
// Ownership: the graphics (icon-512, feature graphic, framed screenshots, launcher/splash assets) are produced by
// scripts/gen-brand-assets.mjs from app/brand/** (separate brand run). This script never draws anything of its own:
// when app/brand/ exists it delegates generation and the brand-level checks to that script and then applies the
// Play upload rules below; when app/brand/ is absent it only validates whatever PNGs are present and says so.
// Text limits (title 30, short 80, full 4000, release notes 500) are checked on store-listing.md and release-notes/.
//
// Play rules applied (Play Console help, "Add preview assets to showcase your app", read 2026-10-30):
//   app icon          512 x 512, 32-bit PNG with alpha, <= 1 MB
//   feature graphic   1024 x 500, PNG or JPEG, no alpha, <= 15 MB
//   phone screenshots PNG or JPEG, no alpha, each side 320..3840 px, longer side <= 2 x shorter side, <= 8 MB,
//                     2..8 per language folder
// Binary-file rule: PNGs are read only through sharp metadata, never printed.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const P = (...s) => join(ROOT, ...s);
const PLAY = P('app', 'playstore-assets');
const BRAND = P('app', 'brand');
const BRAND_SCRIPT = P('scripts', 'gen-brand-assets.mjs');
const LANGS = ['en', 'hi', 'bho'];
const MB = 1024 * 1024;

const CHECK_ONLY = process.argv.includes('--check');
sharp.cache(false);

const failures = [];
const rel = (f) => f.slice(ROOT.length + 1).replace(/\\/g, '/');
function ok(msg) {
  console.log(`  ok ${msg}`);
}
function fail(msg) {
  failures.push(msg);
  console.log(`  FAIL ${msg}`);
}

// ---------- graphics ----------
async function meta(file) {
  const m = await sharp(file).metadata();
  return { w: m.width, h: m.height, alpha: !!m.hasAlpha, format: m.format, bytes: statSync(file).size };
}

async function checkIcon() {
  const f = join(PLAY, 'icon-512.png');
  if (!existsSync(f)) return fail(`${rel(f)} missing`);
  const m = await meta(f);
  const good = m.w === 512 && m.h === 512 && m.format === 'png' && m.alpha && m.bytes <= 1 * MB;
  (good ? ok : fail)(`${rel(f)} ${m.w}x${m.h} ${m.format} alpha=${m.alpha} ${m.bytes} B (rule 512x512 PNG+alpha <= 1 MB)`);
}

async function checkFeatureGraphic() {
  const f = join(PLAY, 'feature-graphic-1024x500.png');
  if (!existsSync(f)) return fail(`${rel(f)} missing`);
  const m = await meta(f);
  const good = m.w === 1024 && m.h === 500 && (m.format === 'png' || m.format === 'jpeg') && !m.alpha && m.bytes <= 15 * MB;
  (good ? ok : fail)(`${rel(f)} ${m.w}x${m.h} ${m.format} alpha=${m.alpha} ${m.bytes} B (rule 1024x500 PNG/JPEG no alpha <= 15 MB)`);
}

async function checkScreenshots() {
  const base = join(PLAY, 'screenshots');
  if (!existsSync(base)) return fail(`${rel(base)} missing`);
  // Only <lang>/*.png|jpg are screenshots; sources.json (provenance) and any other file next to the folders are skipped.
  for (const lang of LANGS) {
    const dir = join(base, lang);
    if (!existsSync(dir)) {
      fail(`${rel(dir)} missing (Play needs 2-8 phone screenshots per listing language)`);
      continue;
    }
    const files = readdirSync(dir).filter((f) => ['.png', '.jpg', '.jpeg'].includes(extname(f).toLowerCase())).sort();
    if (files.length < 2 || files.length > 8) fail(`${rel(dir)}: ${files.length} screenshots (rule 2..8)`);
    else ok(`${rel(dir)}: ${files.length} screenshots`);
    for (const name of files) {
      const f = join(dir, name);
      const m = await meta(f);
      const lo = Math.min(m.w, m.h);
      const hi = Math.max(m.w, m.h);
      const good = lo >= 320 && hi <= 3840 && hi <= 2 * lo && (m.format === 'png' || m.format === 'jpeg') && !m.alpha && m.bytes <= 8 * MB;
      (good ? ok : fail)(`${rel(f)} ${m.w}x${m.h} ${m.format} alpha=${m.alpha} ${m.bytes} B`);
    }
  }
  const prov = join(base, 'sources.json');
  if (existsSync(prov)) {
    const slots = JSON.parse(readFileSync(prov, 'utf8')).slots ?? {};
    const pending = Object.entries(slots).filter(([, v]) => v.pending || v.kind === 'missing').map(([k]) => k);
    if (pending.length) console.log(`  note: ${pending.length} screenshot slot(s) are stand-ins pending a raw re-shoot (d-ship): ${pending.join(', ')}`);
    else ok('screenshots/sources.json: no pending slots');
  }
}

// ---------- listing texts ----------
// store-listing.md marks each limited field with a fenced block whose info string is `text <field> <lang>`,
// e.g. ```text title en ... ```; the limits are Play's (characters, not bytes).
const TEXT_LIMITS = { title: 30, short: 80, full: 4000 };

function checkListingTexts() {
  const f = join(PLAY, 'store-listing.md');
  if (!existsSync(f)) return fail(`${rel(f)} missing`);
  const src = readFileSync(f, 'utf8');
  const re = /```text (title|short|full) (en|hi|bho)\r?\n([\s\S]*?)\r?\n```/g;
  const seen = new Set();
  for (const m of src.matchAll(re)) {
    const [, field, lang, body] = m;
    const n = [...body.trim()].length; // code points, as Play counts
    seen.add(`${field}/${lang}`);
    (n <= TEXT_LIMITS[field] ? ok : fail)(`store-listing.md ${field} ${lang}: ${n} chars (limit ${TEXT_LIMITS[field]})`);
  }
  for (const field of Object.keys(TEXT_LIMITS)) for (const lang of LANGS) if (!seen.has(`${field}/${lang}`)) fail(`store-listing.md: no \`\`\`text ${field} ${lang} block`);
  for (const section of ['## Data safety', '## Content rating', '## Products', '## Release notes']) {
    (src.includes(section) ? ok : fail)(`store-listing.md has section "${section}"`);
  }
}

function checkReleaseNotes() {
  const dir = join(PLAY, 'release-notes');
  const version = JSON.parse(readFileSync(P('app', 'app.json'), 'utf8')).expo.version;
  for (const lang of LANGS) {
    const f = join(dir, `${version}.${lang}.md`);
    if (!existsSync(f)) {
      fail(`${rel(f)} missing`);
      continue;
    }
    const n = [...readFileSync(f, 'utf8').trim()].length;
    (n <= 500 ? ok : fail)(`${rel(f)}: ${n} chars (limit 500)`);
  }
}

function checkVersions() {
  const appJson = JSON.parse(readFileSync(P('app', 'app.json'), 'utf8')).expo;
  const gradle = readFileSync(P('app', 'android', 'app', 'build.gradle'), 'utf8');
  const name = gradle.match(/versionName\s+"([^"]+)"/)?.[1];
  const code = Number(gradle.match(/versionCode\s+(\d+)/)?.[1]);
  (name === appJson.version ? ok : fail)(`versionName ${name} == app.json version ${appJson.version}`);
  (code === appJson.android?.versionCode ? ok : fail)(`versionCode ${code} == app.json android.versionCode ${appJson.android?.versionCode}`);
}

// ---------- brand delegation ----------
function runBrand(check) {
  const cmd = [BRAND_SCRIPT, ...(check ? ['--check'] : [])];
  console.log(`\n> node ${rel(BRAND_SCRIPT)}${check ? ' --check' : ''}`);
  const r = spawnSync(process.execPath, cmd, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  const tail = (r.stdout || '').trim().split(/\r?\n/).slice(-3).join('\n  ');
  console.log(`  ${tail}`);
  if (r.status !== 0) fail(`gen-brand-assets.mjs ${check ? '--check ' : ''}exited ${r.status}: ${(r.stderr || '').trim().split(/\r?\n/).slice(-2).join(' | ')}`);
}

async function main() {
  const brand = existsSync(BRAND) && existsSync(BRAND_SCRIPT);
  if (!brand) console.log('note: app/brand/ absent - graphics are validated as found; generation belongs to the brand run');
  if (brand && !CHECK_ONLY) runBrand(false);
  if (brand) runBrand(true);

  console.log('\ncheck: Play graphics (upload rules)');
  await checkIcon();
  await checkFeatureGraphic();
  await checkScreenshots();
  console.log('\ncheck: listing texts');
  checkListingTexts();
  checkReleaseNotes();
  console.log('\ncheck: versions');
  checkVersions();

  if (failures.length) {
    console.error(`\n${failures.length} check(s) failed`);
    process.exit(1);
  }
  console.log('\nall Play listing checks passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
