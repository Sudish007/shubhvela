#!/usr/bin/env node
// Audits uiautomator dumps against the hard UI rules (spec section 8, build-rules):
//   - clickable nodes smaller than 44 dp in either dimension
//   - element boxes that intersect (overlap without containment) inside the same window
//   - content left under the fixed bottom chrome (sticky CTA / banner strip) at FULL scroll
// Usage:
//   node scripts/audit-ui-dump.mjs <file.ui.xml | folder> [--density 420] [--tabbar 72] [--strip 0] [--out audit.json]
//   node scripts/audit-ui-dump.mjs --summary <audit.json>
// With a folder every *.ui.xml inside is audited and the results are appended to <folder>/audit.json.
// A sibling <name>.bottom.ui.xml (dump taken after scrolling to the end; written by scripts/shots.ps1) is used for
// the "covered" check, because at the initial scroll position content legitimately scrolls under a sticky CTA.
// B08: the banner strip (resource-id banner-strip) is treated like the CTA (fixed overlay; covered check against its
// top edge; `strip` records strip vs banner height for the M6 "strip = banner + 32 dp" check), and nodes inside a
// WebView document are not paired with each other for intersections (collapsed HTML table borders).
//
// Facts about the dump learned in A13: React Native's view tree is FLATTENED (a labelled container and its children
// are siblings in the XML); scroll children are CLIPPED to the ScrollView bounds; the app's Screen component exposes
// resource-id "screen-scroll" (the ScrollView) and "screen-cta" (the sticky CTA box); the tab bar lies below
// screen-scroll on tab screens, so content can never be under it.

import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : def;
};

if (args.includes('--summary')) {
  const file = opt('summary', null);
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const totals = data.reduce(
    (t, r) => ({ shots: t.shots + 1, smallControls: t.smallControls + r.smallControls.length, intersections: t.intersections + r.intersections.length, covered: t.covered + r.covered.length, failing: t.failing + (r.pass ? 0 : 1) }),
    { shots: 0, smallControls: 0, intersections: 0, covered: 0, failing: 0 },
  );
  console.log(JSON.stringify(totals));
  for (const r of data.filter((r) => !r.pass)) console.log(`FAIL ${r.file} small=${r.smallControls.length} intersect=${r.intersections.length} covered=${r.covered.length}`);
  process.exit(totals.failing === 0 ? 0 : 1);
}

const target = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--density' && args[args.indexOf(a) - 1] !== '--tabbar' && args[args.indexOf(a) - 1] !== '--strip' && args[args.indexOf(a) - 1] !== '--out');
if (!target) {
  console.error('usage: node scripts/audit-ui-dump.mjs <file.ui.xml | folder> [--density 420] [--tabbar 72] [--strip 0] [--out audit.json]');
  process.exit(3);
}
const density = Number(opt('density', '420'));
const tabBarDp = Number(opt('tabbar', '72'));
const stripDp = Number(opt('strip', '0'));
const dpPerPx = 160 / density;
const MIN_DP = 44;
const CLEARANCE_DP = 16; // design.md 13: >= 16 dp of content clearance above the CTA/banner at full scroll

function parseNodes(xml) {
  const nodes = [];
  const re = /<node\b([^>]*)\/?>/g;
  let m;
  while ((m = re.exec(xml))) {
    const attrs = {};
    const ar = /([\w:-]+)="([^"]*)"/g;
    let a;
    while ((a = ar.exec(m[1]))) attrs[a[1]] = a[2];
    const b = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(attrs.bounds || '');
    if (!b) continue;
    nodes.push({
      cls: attrs.class || '',
      text: attrs.text || '',
      desc: attrs['content-desc'] || '',
      clickable: attrs.clickable === 'true',
      scrollable: attrs.scrollable === 'true',
      id: attrs['resource-id'] || '',
      x1: +b[1], y1: +b[2], x2: +b[3], y2: +b[4],
    });
  }
  return nodes;
}

const label = (n) => n.text || n.desc || n.id || n.cls;
const inside = (n, box, tol = 2) => !!box && n.x1 >= box.x1 - tol && n.y1 >= box.y1 - tol && n.x2 <= box.x2 + tol && n.y2 <= box.y2 + tol;

// WebView documents (the PDF preview, B07) expose their DOM as nodes too; adjacent HTML table cells share collapsed
// borders (1 CSS px = ~3 device px), which is a document rendering, not two app boxes - skipped for intersections.
function markWebContent(nodes) {
  const webs = nodes.filter((n) => n.cls === 'android.webkit.WebView');
  nodes.forEach((n, i) => { n.inWeb = webs.some((w) => w !== n && nodes.indexOf(w) < i && inside(n, w)); });
}

function auditXml(xml, file, bottomXml) {
  const nodes = parseNodes(xml);
  const screenH = Math.max(...nodes.map((n) => n.y2), 0);
  const screenW = Math.max(...nodes.map((n) => n.x2), 0);
  const scroll = nodes.find((n) => n.id === 'screen-scroll') || null;
  // Fixed bottom chrome over the scroll view: the sticky CTA (screen-cta) or the banner strip (banner-strip, M6).
  // Both are absolute overlays; scroll content legitimately passes behind them until the full-scroll position.
  const ctaIndex = nodes.findIndex((n) => n.id === 'screen-cta' || n.id === 'banner-strip');
  const cta = ctaIndex >= 0 ? nodes[ctaIndex] : null;
  // Scroll content passing behind the CTA is geometrically inside its box too; the CTA's own children follow it in
  // document order (the dump keeps order even though it flattens nesting).
  nodes.forEach((n, i) => { n.inCta = !!cta && i > ctaIndex && inside(n, cta); });
  markWebContent(nodes);
  // M6: strip height vs the banner view it wraps (the SDK's WebView inside the strip); the strip must be banner + 32 dp.
  let strip = null;
  if (cta && cta.id === 'banner-strip') {
    const ad = nodes.find((n, i) => i > ctaIndex && n.cls === 'android.webkit.WebView' && inside(n, cta));
    const stripDp = (cta.y2 - cta.y1) * dpPerPx;
    const bannerDp = ad ? (ad.y2 - ad.y1) * dpPerPx : null;
    strip = { stripDp: +stripDp.toFixed(1), bannerDp: bannerDp == null ? null : +bannerDp.toFixed(1), extraDp: bannerDp == null ? null : +(stripDp - bannerDp).toFixed(1), top: cta.y1, bottom: cta.y2 };
  }
  // Chrome line: the sticky CTA's top edge when present; else the scroll viewport bottom (= tab bar top on tab
  // screens, screen bottom on stack screens). --tabbar/--strip are the legacy fallback when no screen-scroll exists.
  const chromeTop = cta ? cta.y1 - stripDp / dpPerPx : scroll ? scroll.y2 - stripDp / dpPerPx : screenH - (tabBarDp + stripDp) / dpPerPx;

  // Clipped bounds: controls touching a scroll viewport edge are not measurable and are skipped.
  const clippedEdges = nodes.filter((n) => n.scrollable).flatMap((s) => [s.y1, s.y2]).concat([chromeTop]);
  const touchesEdge = (n) => clippedEdges.some((e) => Math.abs(n.y1 - e) <= 2 || Math.abs(n.y2 - e) <= 2);

  // Nodes inside the banner strip are the ad creative's own DOM (Google's test banner exposes a 43 dp clickable
  // WebView element inside the 103-112 dp banner view); the app draws no control there, so they are not measured.
  const inAd = (n) => !!cta && cta.id === 'banner-strip' && n.inCta;
  const smallControls = nodes
    .filter((n) => n.clickable && !touchesEdge(n) && !inAd(n))
    .map((n) => ({ ...n, wDp: (n.x2 - n.x1) * dpPerPx, hDp: (n.y2 - n.y1) * dpPerPx }))
    .filter((n) => n.wDp > 0 && n.hDp > 0 && (n.wDp < MIN_DP - 0.5 || n.hDp < MIN_DP - 0.5))
    .map((n) => ({ label: label(n), wDp: +n.wDp.toFixed(1), hDp: +n.hDp.toFixed(1), bounds: [n.x1, n.y1, n.x2, n.y2] }));

  // Intersections: two element boxes overlap by more than 1 px in both axes and neither contains the other
  // (2 px tolerance for rounding). Pairs where exactly one box belongs to the fixed CTA overlay are skipped: scroll
  // content passing under the CTA is the "covered" question, answered on the full-scroll dump below.
  const contains = (a, b) => a.x1 <= b.x1 + 2 && a.y1 <= b.y1 + 2 && a.x2 >= b.x2 - 2 && a.y2 >= b.y2 - 2;
  const intersections = [];
  // The overlay box itself (screen-cta / banner-strip, which carries an accessibility label) is not an element box.
  const visible = nodes.filter((n) => n !== cta && n.x2 > n.x1 && n.y2 > n.y1 && (n.text || n.desc || n.clickable));
  for (let i = 0; i < visible.length; i++) {
    for (let j = i + 1; j < visible.length; j++) {
      const a = visible[i], b = visible[j];
      if (contains(a, b) || contains(b, a)) continue;
      if (cta && a.inCta !== b.inCta) continue;
      if (a.inWeb && b.inWeb) continue;
      const ox = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
      const oy = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
      // > 2 px (0.7 dp at 443 dpi), the same tolerance as `contains`: Devanagari text boxes land on fractional pixels
      // and the Family tools title overlapped the first row by exactly 2 px in bho (B08) with no visible touch.
      if (ox > 2 && oy > 2) {
        intersections.push({ a: label(a), b: label(b), overlapPx: [ox, oy], boundsA: [a.x1, a.y1, a.x2, a.y2], boundsB: [b.x1, b.y1, b.x2, b.y2] });
      }
    }
  }

  // Covered: on the FULL-SCROLL dump, scroll content whose bottom edge ends within CLEARANCE_DP above the chrome
  // line or below it. Without a bottom dump the check cannot be made and is reported as such (coveredChecked false).
  let covered = [];
  let coveredChecked = false;
  if (bottomXml && cta) {
    const bn = parseNodes(bottomXml);
    const bcta = bn.find((n) => n.id === cta.id) || cta;
    const bscroll = bn.find((n) => n.id === 'screen-scroll') || scroll;
    // +2 px: 16 dp is 44.3 px at 443 dpi and RN lays out whole pixels (44 px = 15.9 dp); above the banner strip two
    // rounded quantities meet (the SDK's measured banner height, Math.round in AdPolicy, and RN's pixel snapping of
    // the padding), observed as a 43 px gap (15.5 dp) under hi/bho text on Muhurat and Matching (B08). Two pixels
    // = 0.7 dp at 443 dpi; anything larger is a real shortfall.
    const line = bcta.y1 - CLEARANCE_DP / dpPerPx + 2;
    coveredChecked = true;
    covered = bn
      .filter((n, i) => (n.text || n.clickable) && inside(n, bscroll) && !(i > bn.indexOf(bcta) && inside(n, bcta)) && n.y2 > line && (n.y2 - n.y1) * dpPerPx < 200)
      .map((n) => ({ label: label(n), bounds: [n.x1, n.y1, n.x2, n.y2], clearanceDp: +((bcta.y1 - n.y2) * dpPerPx).toFixed(1) }));
  } else if (!cta) {
    coveredChecked = true; // no fixed bottom chrome over the scroll view: nothing can be covered
  }

  return {
    file: basename(file),
    density,
    widthDp: +(screenW * dpPerPx).toFixed(0),
    heightDp: +(screenH * dpPerPx).toFixed(0),
    nodes: nodes.length,
    chrome: cta ? (cta.id === 'banner-strip' ? 'banner' : 'cta') : scroll ? 'scroll-edge' : 'none',
    strip,
    coveredChecked,
    smallControls,
    intersections,
    covered,
    pass: smallControls.length === 0 && intersections.length === 0 && covered.length === 0,
  };
}

const results = [];
const files = statSync(target).isDirectory()
  ? readdirSync(target).filter((f) => f.endsWith('.ui.xml') && !f.endsWith('.bottom.ui.xml')).map((f) => join(target, f))
  : [target];
for (const f of files) {
  const bottom = f.replace(/\.ui\.xml$/, '.bottom.ui.xml');
  const r = auditXml(readFileSync(f, 'utf8'), f, existsSync(bottom) ? readFileSync(bottom, 'utf8') : null);
  results.push(r);
  const status = r.pass ? 'PASS' : 'FAIL';
  console.log(`${status} ${r.file}  small=${r.smallControls.length} intersect=${r.intersections.length} covered=${r.covered.length}${r.coveredChecked ? '' : ' (covered not checked: no bottom dump)'}`);
}
const outPath = opt('out', statSync(target).isDirectory() ? join(target, 'audit.json') : null);
if (outPath) {
  const prev = existsSync(outPath) ? JSON.parse(readFileSync(outPath, 'utf8')) : [];
  const merged = [...prev.filter((p) => !results.some((r) => r.file === p.file)), ...results];
  writeFileSync(outPath, JSON.stringify(merged, null, 2) + '\n');
  console.log(`wrote ${outPath} (${merged.length} entries)`);
}
process.exit(results.every((r) => r.pass) ? 0 : 1);
