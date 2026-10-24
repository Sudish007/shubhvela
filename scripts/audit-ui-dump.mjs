#!/usr/bin/env node
// Audits uiautomator dumps against the hard UI rules (spec section 8, build-rules):
//   - clickable nodes smaller than 44 dp in either dimension
//   - sibling bounds that intersect inside the same container (cards)
//   - nodes partly hidden under the tab bar / banner strip at the bottom
// Usage:
//   node scripts/audit-ui-dump.mjs <file.ui.xml | folder> [--density 420] [--tabbar 72] [--strip 0] [--out audit.json]
// With a folder every *.ui.xml inside is audited and the results are appended to <folder>/audit.json.

import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('--'));
if (!target) {
  console.error('usage: node scripts/audit-ui-dump.mjs <file.ui.xml | folder> [--density 420] [--tabbar 72] [--strip 0] [--out audit.json]');
  process.exit(3);
}
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : def;
};
const density = Number(opt('density', '420'));
const tabBarDp = Number(opt('tabbar', '72'));
const stripDp = Number(opt('strip', '0'));
const dpPerPx = 160 / density;
const MIN_DP = 44;

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
      index: Number(attrs.index || 0),
      cls: attrs.class || '',
      text: attrs.text || '',
      desc: attrs['content-desc'] || '',
      clickable: attrs.clickable === 'true',
      x1: +b[1], y1: +b[2], x2: +b[3], y2: +b[4],
      depth: 0,
      start: m.index,
    });
  }
  // depth from nesting: count open/close tags before each node
  let depth = 0;
  const tokens = xml.matchAll(/<node\b[^>]*?(\/?)>|<\/node>/g);
  let i = 0;
  for (const t of tokens) {
    if (t[0] === '</node>') { depth--; continue; }
    if (nodes[i] && nodes[i].start === t.index) { nodes[i].depth = depth; i++; }
    if (!t[1]) depth++;
  }
  return nodes;
}

function auditXml(xml, file) {
  const nodes = parseNodes(xml);
  const screenH = Math.max(...nodes.map((n) => n.y2), 0);
  const screenW = Math.max(...nodes.map((n) => n.x2), 0);
  const bottomChromePx = (tabBarDp + stripDp) / dpPerPx;
  const chromeTop = screenH - bottomChromePx;

  const smallControls = nodes
    .filter((n) => n.clickable)
    .map((n) => ({ ...n, wDp: (n.x2 - n.x1) * dpPerPx, hDp: (n.y2 - n.y1) * dpPerPx }))
    .filter((n) => n.wDp > 0 && n.hDp > 0 && (n.wDp < MIN_DP - 0.5 || n.hDp < MIN_DP - 0.5))
    .map((n) => ({ label: n.text || n.desc || n.cls, wDp: +n.wDp.toFixed(1), hDp: +n.hDp.toFixed(1), bounds: [n.x1, n.y1, n.x2, n.y2] }));

  // Intersections among siblings (same parent = same depth and contiguous in document order under one parent)
  const intersections = [];
  const byParent = new Map();
  const stack = [];
  for (const n of nodes) {
    while (stack.length && stack[stack.length - 1].depth >= n.depth) stack.pop();
    const parent = stack.length ? stack[stack.length - 1] : null;
    const key = parent ? parent.start : -1;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(n);
    stack.push(n);
  }
  for (const sibs of byParent.values()) {
    const visible = sibs.filter((n) => n.x2 > n.x1 && n.y2 > n.y1 && (n.text || n.desc || n.clickable));
    for (let i = 0; i < visible.length; i++) {
      for (let j = i + 1; j < visible.length; j++) {
        const a = visible[i], b = visible[j];
        const ox = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
        const oy = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
        if (ox > 1 && oy > 1) {
          intersections.push({
            a: a.text || a.desc || a.cls, b: b.text || b.desc || b.cls,
            overlapPx: [ox, oy], boundsA: [a.x1, a.y1, a.x2, a.y2], boundsB: [b.x1, b.y1, b.x2, b.y2],
          });
        }
      }
    }
  }

  // Content partly under the bottom chrome: visible content nodes that straddle the chrome line
  const covered = nodes
    .filter((n) => (n.text || n.clickable) && n.y1 < chromeTop && n.y2 > chromeTop + 2 && n.y2 <= screenH)
    .filter((n) => (n.y2 - n.y1) * dpPerPx < 200) // ignore scroll containers
    .map((n) => ({ label: n.text || n.desc || n.cls, bounds: [n.x1, n.y1, n.x2, n.y2] }));

  return {
    file: basename(file),
    density,
    widthDp: +(screenW * dpPerPx).toFixed(0),
    heightDp: +(screenH * dpPerPx).toFixed(0),
    nodes: nodes.length,
    smallControls,
    intersections,
    covered,
    pass: smallControls.length === 0 && intersections.length === 0 && covered.length === 0,
  };
}

const results = [];
const files = statSync(target).isDirectory()
  ? readdirSync(target).filter((f) => f.endsWith('.ui.xml')).map((f) => join(target, f))
  : [target];
for (const f of files) {
  const r = auditXml(readFileSync(f, 'utf8'), f);
  results.push(r);
  const status = r.pass ? 'PASS' : 'FAIL';
  console.log(`${status} ${r.file}  small=${r.smallControls.length} intersect=${r.intersections.length} covered=${r.covered.length}`);
}
const outPath = opt('out', statSync(target).isDirectory() ? join(target, 'audit.json') : null);
if (outPath) {
  const prev = existsSync(outPath) ? JSON.parse(readFileSync(outPath, 'utf8')) : [];
  const merged = [...prev.filter((p) => !results.some((r) => r.file === p.file)), ...results];
  writeFileSync(outPath, JSON.stringify(merged, null, 2) + '\n');
  console.log(`wrote ${outPath} (${merged.length} entries)`);
}
process.exit(results.every((r) => r.pass) ? 0 : 1);
