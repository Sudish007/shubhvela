// text.mjs - text-to-SVG-path for the brand renders. opentype.js 1.3.4 supplies glyph outlines, GSUB lookups and
// kerning; it does NOT parse GPOS mark-to-base/mark-to-mark lookups, so this module reads those from the raw GPOS
// table itself and implements a minimal Devanagari shaper (reph, half forms, rakar, akhand ligatures, pre-base
// i-matra reordering, abvs/blws/psts ligatures, mark anchoring). Scope: the strings used by the brand assets, checked
// by eye against the rendered PNGs. No system fonts are ever used: every glyph becomes an SVG <path>.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';

// ---------- raw table reader ----------
class Reader {
  constructor(buf, base = 0) { this.b = buf; this.base = base; }
  u8(o) { return this.b[this.base + o]; }
  u16(o) { return (this.b[this.base + o] << 8) | this.b[this.base + o + 1]; }
  i16(o) { const v = this.u16(o); return v & 0x8000 ? v - 0x10000 : v; }
  u32(o) { return ((this.b[this.base + o] << 24) | (this.b[this.base + o + 1] << 16) | (this.b[this.base + o + 2] << 8) | this.b[this.base + o + 3]) >>> 0; }
  tag(o) { return String.fromCharCode(this.u8(o), this.u8(o + 1), this.u8(o + 2), this.u8(o + 3)); }
  at(o) { return new Reader(this.b, this.base + o); }
}

function findTable(buf, tag4) {
  const r = new Reader(buf);
  const numTables = r.u16(4);
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    if (r.tag(rec) === tag4) return { offset: r.u32(rec + 8), length: r.u32(rec + 12) };
  }
  return null;
}

function parseCoverage(r) {
  const format = r.u16(0);
  const map = new Map();
  if (format === 1) {
    const n = r.u16(2);
    for (let i = 0; i < n; i++) map.set(r.u16(4 + i * 2), i);
  } else if (format === 2) {
    const n = r.u16(2);
    for (let i = 0; i < n; i++) {
      const o = 4 + i * 6;
      const start = r.u16(o), end = r.u16(o + 2), startIdx = r.u16(o + 4);
      for (let g = start; g <= end; g++) map.set(g, startIdx + (g - start));
    }
  }
  return map;
}

function parseAnchor(r) {
  if (!r) return null;
  const format = r.u16(0);
  return { x: r.i16(2), y: r.i16(4), format };
}

function parseMarkArray(r) {
  const n = r.u16(0);
  const marks = [];
  for (let i = 0; i < n; i++) {
    const cls = r.u16(2 + i * 4);
    const off = r.u16(4 + i * 4);
    marks.push({ cls, anchor: parseAnchor(off ? r.at(off) : null) });
  }
  return marks;
}

function parseBaseArray(r, classCount) {
  const n = r.u16(0);
  const bases = [];
  for (let i = 0; i < n; i++) {
    const anchors = [];
    for (let c = 0; c < classCount; c++) {
      const off = r.u16(2 + (i * classCount + c) * 2);
      anchors.push(off ? parseAnchor(r.at(off)) : null);
    }
    bases.push(anchors);
  }
  return bases;
}

/** Parses GPOS lookups of type 4 (mark-to-base) and 6 (mark-to-mark), unwrapping type 9 extensions, grouped per feature tag of a script. */
function parseGposMarks(buf, scriptTag) {
  const t = findTable(buf, 'GPOS');
  if (!t) return { byFeature: new Map(), lookups: [] };
  const g = new Reader(buf, t.offset);
  const scriptList = g.at(g.u16(4));
  const featureList = g.at(g.u16(6));
  const lookupList = g.at(g.u16(8));

  // script -> default langsys -> feature indexes
  const scriptCount = scriptList.u16(0);
  let featureIdx = [];
  for (let i = 0; i < scriptCount; i++) {
    if (scriptList.tag(2 + i * 6) !== scriptTag) continue;
    const script = scriptList.at(scriptList.u16(6 + i * 6));
    const dls = script.u16(0);
    if (!dls) continue;
    const ls = script.at(dls);
    const n = ls.u16(4);
    for (let k = 0; k < n; k++) featureIdx.push(ls.u16(6 + k * 2));
  }
  const featureCount = featureList.u16(0);
  const byFeature = new Map();
  for (const fi of featureIdx) {
    if (fi >= featureCount) continue;
    const tag = featureList.tag(2 + fi * 6);
    const ft = featureList.at(featureList.u16(6 + fi * 6));
    const n = ft.u16(2);
    const idxs = [];
    for (let k = 0; k < n; k++) idxs.push(ft.u16(4 + k * 2));
    byFeature.set(tag, (byFeature.get(tag) || []).concat(idxs));
  }

  const lookupCount = lookupList.u16(0);
  const lookups = [];
  for (let i = 0; i < lookupCount; i++) {
    const lk = lookupList.at(lookupList.u16(2 + i * 2));
    let type = lk.u16(0);
    const flag = lk.u16(2);
    const subCount = lk.u16(4);
    const subtables = [];
    for (let s = 0; s < subCount; s++) {
      let st = lk.at(lk.u16(6 + s * 2));
      let stType = type;
      if (type === 9) { stType = st.u16(2); st = st.at(st.u32(4)); }
      if (stType === 4 || stType === 6) {
        const markCov = parseCoverage(st.at(st.u16(2)));
        const baseCov = parseCoverage(st.at(st.u16(4)));
        const classCount = st.u16(6);
        const marks = parseMarkArray(st.at(st.u16(8)));
        const bases = parseBaseArray(st.at(st.u16(10)), classCount);
        subtables.push({ type: stType, markCov, baseCov, classCount, marks, bases });
      }
    }
    lookups.push({ type, flag, subtables });
  }
  return { byFeature, lookups };
}

// ---------- GDEF glyph classes (1 base, 2 ligature, 3 mark, 4 component) ----------
function classDefLookup(classDef) {
  if (!classDef) return () => 0;
  if (classDef.format === 1) {
    return (g) => { const i = g - classDef.startGlyph; return i >= 0 && i < classDef.classes.length ? classDef.classes[i] : 0; };
  }
  const ranges = classDef.ranges || [];
  return (g) => { for (const r of ranges) if (g >= r.start && g <= r.end) return r.classId; return 0; };
}

// ---------- font loading ----------
export function loadFont(path) {
  const buf = readFileSync(path);
  // eslint-disable-next-line import/no-named-as-default-member -- opentype.js is CommonJS; the default import is the module
  const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const glyphClass = classDefLookup(font.tables.gdef?.classDef);
  const gposDev = parseGposMarks(buf, 'dev2');
  const gposLatn = parseGposMarks(buf, 'latn');
  const kernDev = safeKern(font, 'dev2');
  const kernLatn = safeKern(font, 'latn') || safeKern(font, 'DFLT');
  return { font, buf, glyphClass, gposDev, gposLatn, kernDev, kernLatn, upem: font.unitsPerEm, path };
}

function safeKern(font, script) {
  try { return font.position.getKerningTables(script) || null; } catch { return null; }
}

// ---------- GSUB helpers (opentype.js parsed lookups) ----------
function coverageIndex(cov, gid) {
  if (!cov) return -1;
  if (cov.format === 1) { const i = cov.glyphs.indexOf(gid); return i; }
  let idx = -1;
  for (const r of cov.ranges) if (gid >= r.start && gid <= r.end) { idx = r.index + (gid - r.start); break; }
  return idx;
}

function featureLookups(font, tag, scriptTag) {
  const gsub = font.tables.gsub;
  if (!gsub) return [];
  const out = [];
  for (const s of gsub.scripts) {
    if (s.tag !== scriptTag) continue;
    const def = s.script.defaultLangSys;
    if (!def) continue;
    for (const fi of def.featureIndexes) {
      const f = gsub.features[fi];
      if (f.tag === tag) for (const li of f.feature.lookupListIndexes) out.push(gsub.lookups[li]);
    }
  }
  return out;
}

/** Try to replace glyph sequence `seq` entirely by one glyph via the ligature lookups (type 4) of `tag`. */
function ligate(font, tag, scriptTag, seq) {
  for (const lk of featureLookups(font, tag, scriptTag)) {
    if (lk.lookupType !== 4) continue;
    for (const st of lk.subtables) {
      const ci = coverageIndex(st.coverage, seq[0]);
      if (ci < 0) continue;
      const set = st.ligatureSets[ci] || [];
      for (const lig of set) {
        if (lig.components.length !== seq.length - 1) continue;
        let ok = true;
        for (let k = 0; k < lig.components.length; k++) if (lig.components[k] !== seq[k + 1]) { ok = false; break; }
        if (ok) return lig.ligGlyph;
      }
    }
  }
  return null;
}

/** Greedy pass: apply type 1 singles and type 4 ligatures of a feature over a glyph array (in place, returns new array). */
function applyFeature(font, tag, scriptTag, glyphs) {
  let out = glyphs.slice();
  for (const lk of featureLookups(font, tag, scriptTag)) {
    if (lk.lookupType === 4) {
      let i = 0;
      const next = [];
      while (i < out.length) {
        let matched = false;
        for (const st of lk.subtables) {
          const ci = coverageIndex(st.coverage, out[i]);
          if (ci < 0) continue;
          const set = st.ligatureSets[ci] || [];
          for (const lig of set) {
            const n = lig.components.length;
            if (i + n >= out.length) continue;
            let ok = true;
            for (let k = 0; k < n; k++) if (out[i + 1 + k] !== lig.components[k]) { ok = false; break; }
            if (ok) { next.push(lig.ligGlyph); i += n + 1; matched = true; break; }
          }
          if (matched) break;
        }
        if (!matched) { next.push(out[i]); i++; }
      }
      out = next;
    } else if (lk.lookupType === 1) {
      out = out.map((g) => {
        for (const st of lk.subtables) {
          const ci = coverageIndex(st.coverage, g);
          if (ci < 0) continue;
          if (st.substFormat === 1) return (g + st.deltaGlyphId) & 0xffff;
          return st.substitute[ci];
        }
        return g;
      });
    }
  }
  return out;
}

// ---------- Devanagari classification ----------
const isConsonant = (cp) => (cp >= 0x0915 && cp <= 0x0939) || (cp >= 0x0958 && cp <= 0x095F) || cp === 0x0979 || cp === 0x097A;
const isIndepVowel = (cp) => (cp >= 0x0904 && cp <= 0x0914) || cp === 0x0960 || cp === 0x0961 || cp === 0x0972;
const isMatra = (cp) => (cp >= 0x093E && cp <= 0x094C) || cp === 0x0962 || cp === 0x0963 || cp === 0x093A || cp === 0x093B;
const isAboveMark = (cp) => cp === 0x0901 || cp === 0x0902; // chandrabindu, anusvara
const isVisarga = (cp) => cp === 0x0903;
const NUKTA = 0x093C, VIRAMA = 0x094D, RA = 0x0930, I_MATRA = 0x093F;
const isDeva = (cp) => cp >= 0x0900 && cp <= 0x097F;

function splitClusters(text) {
  const cps = Array.from(text).map((c) => c.codePointAt(0));
  const clusters = [];
  let i = 0;
  while (i < cps.length) {
    const cp = cps[i];
    if (!isDeva(cp)) { clusters.push({ kind: 'raw', cps: [cp] }); i++; continue; }
    if (!(isConsonant(cp) || isIndepVowel(cp))) { clusters.push({ kind: 'raw', cps: [cp] }); i++; continue; }
    const c = { kind: 'deva', cons: [], nukta: [], matras: [], marks: [], visarga: false, trailingVirama: false, indep: null };
    if (isIndepVowel(cp)) { c.indep = cp; i++; }
    else {
      // consonant chain: C (N)? (H C (N)?)*
      for (;;) {
        c.cons.push(cps[i]); i++;
        let nk = false;
        if (cps[i] === NUKTA) { nk = true; i++; }
        c.nukta.push(nk);
        if (cps[i] === VIRAMA && i + 1 < cps.length && isConsonant(cps[i + 1])) { i++; continue; }
        if (cps[i] === VIRAMA) { c.trailingVirama = true; i++; }
        break;
      }
    }
    while (i < cps.length && isMatra(cps[i])) { c.matras.push(cps[i]); i++; }
    while (i < cps.length && (isAboveMark(cps[i]) || isVisarga(cps[i]))) { if (isVisarga(cps[i])) c.visarga = true; else c.marks.push(cps[i]); i++; }
    clusters.push(c);
  }
  return clusters;
}

/** Shapes one Devanagari cluster into glyph ids (logical order, ready for GPOS). */
function shapeCluster(F, c) {
  const font = F.font;
  const gid = (cp) => font.charToGlyphIndex(String.fromCodePoint(cp));
  const S = 'dev2';
  if (c.indep !== null) {
    let seq = [gid(c.indep)];
    for (const m of c.matras) seq.push(gid(m));
    for (const m of c.marks) seq.push(gid(m));
    if (c.visarga) seq.push(gid(0x0903));
    return applyFeature(font, 'abvs', S, seq);
  }
  // consonant glyphs with nukta applied
  let cons = c.cons.map((cp, k) => {
    let g = gid(cp);
    if (c.nukta[k]) { const lig = ligate(font, 'nukt', S, [g, gid(NUKTA)]); g = lig ?? g; }
    return g;
  });
  const virama = gid(VIRAMA);
  let reph = null;
  if (cons.length >= 2 && c.cons[0] === RA && !c.nukta[0]) {
    const r = ligate(font, 'rphf', S, [cons[0], virama]);
    if (r !== null) { reph = r; cons = cons.slice(1); }
  }
  // akhand ligatures across the whole chain (e.g. ksha, gya, tra)
  const tryAkhn = (arr) => {
    for (let len = arr.length; len >= 2; len--) {
      for (let s = 0; s + len <= arr.length; s++) {
        const seq = [];
        for (let k = 0; k < len; k++) { seq.push(arr[s + k]); if (k < len - 1) seq.push(virama); }
        const lig = ligate(font, 'akhn', S, seq);
        if (lig !== null) return arr.slice(0, s).concat([lig], arr.slice(s + len));
      }
    }
    return arr;
  };
  cons = tryAkhn(cons);
  // rakar: last consonant RA below the previous one
  let rakar = null;
  if (cons.length >= 2 && cons[cons.length - 1] === gid(RA)) {
    const prev = cons[cons.length - 2];
    const rk = ligate(font, 'rkrf', S, [prev, virama, cons[cons.length - 1]]);
    if (rk !== null) cons = cons.slice(0, -2).concat([rk]);
    else {
      const bl = ligate(font, 'blwf', S, [virama, cons[cons.length - 1]]);
      if (bl !== null) { rakar = bl; cons = cons.slice(0, -1); }
    }
  }
  // pre-base consonants -> half forms (or explicit virama when the font has none)
  const base = cons[cons.length - 1];
  let pre = [];
  for (let k = 0; k < cons.length - 1; k++) {
    const half = ligate(font, 'half', S, [cons[k], virama]);
    if (half !== null) pre.push(half); else pre.push(cons[k], virama);
  }
  // conjunct ligatures of half + base (cjct) and pres
  let core = pre.concat([base]);
  core = applyFeature(font, 'cjct', S, core);
  core = applyFeature(font, 'pres', S, core);
  // matras: pre-base i goes first; below-base (u, uu, vocalic r) next so blws ligatures (e.g. ru) can form;
  // then reph, above-base (e, ai, candra e), trailing virama, post-base (aa, ii, o, au), anusvara/candrabindu, visarga.
  const preMatra = [], below = [], above = [], post = [];
  for (const cp of c.matras) {
    if (cp === I_MATRA) preMatra.push(gid(cp));
    else if (cp === 0x0941 || cp === 0x0942 || cp === 0x0943 || cp === 0x0944 || cp === 0x0962 || cp === 0x0963) below.push(gid(cp));
    else if (cp === 0x0945 || cp === 0x0946 || cp === 0x0947 || cp === 0x0948) above.push(gid(cp));
    else post.push(gid(cp));
  }
  let seq = preMatra.concat(core);
  if (rakar !== null) seq.push(rakar);
  seq = seq.concat(below);
  seq = applyFeature(font, 'blws', S, seq);
  if (reph !== null) seq.push(reph);
  seq = seq.concat(above);
  if (c.trailingVirama) seq.push(virama);
  seq = seq.concat(post);
  for (const m of c.marks) seq.push(gid(m));
  if (c.visarga) seq.push(gid(0x0903));
  seq = applyFeature(font, 'abvs', S, seq);
  seq = applyFeature(font, 'psts', S, seq);
  if (c.trailingVirama) seq = applyFeature(font, 'haln', S, seq);
  return seq;
}

// ---------- shaping + positioning ----------
/**
 * Shapes a string into positioned glyphs (font units). Devanagari runs go through the mini shaper; everything else
 * maps 1:1 with Latin 'liga'/'kern' via opentype.js. Returns { glyphs: [{gid, x, y}], advance } in font units.
 */
export function shape(F, text, opts = {}) {
  const { font } = F;
  const letterSpacing = opts.letterSpacing ?? 0; // font units added after each base glyph
  const clusters = splitClusters(text);
  const gids = [];
  let pendingRaw = [];
  const flushRaw = () => {
    if (!pendingRaw.length) return;
    const s = String.fromCodePoint(...pendingRaw);
    const gl = font.stringToGlyphs(s, { kerning: false, features: { liga: true, rlig: true } });
    for (const g of gl) gids.push(g.index);
    pendingRaw = [];
  };
  for (const c of clusters) {
    if (c.kind === 'raw') { pendingRaw.push(c.cps[0]); continue; }
    flushRaw();
    for (const g of shapeCluster(F, c)) gids.push(g);
  }
  flushRaw();

  // positioning
  const positioned = [];
  let x = 0;
  let lastBase = -1; // index in positioned of the last base glyph
  let lastMark = -1;
  const isDevaGlyph = (gid) => { const u = font.glyphs.get(gid).unicode; return u !== undefined && isDeva(u); };
  for (let i = 0; i < gids.length; i++) {
    const gid = gids[i];
    const glyph = font.glyphs.get(gid);
    const cls = F.glyphClass(gid);
    const isMark = cls === 3 || (glyph.advanceWidth === 0 && cls !== 1 && positioned.length > 0);
    if (isMark) {
      // Fallback when no anchor exists: the pen position (the glyph outline already sits left of its origin).
      let px = x, py = 0, attached = false;
      // 1. mark-to-mark when the previous glyph is a mark the font stacks on (e.g. e-matra + anusvara)
      if (lastMark >= 0 && lastMark > lastBase) {
        const mPos = positioned[lastMark];
        const anc = findAnchor(F, mPos.gid, gid, 6);
        if (anc) { px = mPos.x + anc.bx - anc.mx; py = mPos.y + anc.by - anc.my; attached = true; }
      }
      // 2. mark-to-base
      if (!attached && lastBase >= 0) {
        const basePos = positioned[lastBase];
        const anc = findAnchor(F, basePos.gid, gid, 4);
        if (anc) { px = basePos.x + anc.bx - anc.mx; py = basePos.y + anc.by - anc.my; attached = true; }
      }
      positioned.push({ gid, x: px, y: py, cls: 3, mark: true, attached });
      lastMark = positioned.length - 1;
      continue;
    }
    // base glyph: kerning with the previous base
    if (lastBase >= 0) {
      const prev = positioned[lastBase].gid;
      const tables = isDevaGlyph(gid) || isDevaGlyph(prev) ? F.kernDev : F.kernLatn;
      if (tables) { try { x += font.position.getKerningValue(tables, prev, gid); } catch { /* ignore */ } }
    }
    positioned.push({ gid, x, y: 0, cls, mark: false });
    lastBase = positioned.length - 1;
    lastMark = -1;
    x += glyph.advanceWidth + letterSpacing;
  }
  return { glyphs: positioned, advance: x };
}

function findAnchor(F, baseGid, markGid, type) {
  const sets = [F.gposDev, F.gposLatn];
  for (const gp of sets) {
    const feats = type === 4 ? ['abvm', 'blwm', 'mark'] : ['abvm', 'blwm', 'mkmk'];
    for (const tag of feats) {
      const idxs = gp.byFeature.get(tag) || [];
      for (const li of idxs) {
        const lk = gp.lookups[li];
        if (!lk) continue;
        for (const st of lk.subtables) {
          if (st.type !== type) continue;
          const mi = st.markCov.get(markGid);
          if (mi === undefined) continue;
          const bi = st.baseCov.get(baseGid);
          if (bi === undefined) continue;
          const mark = st.marks[mi];
          const baseAnchors = st.bases[bi];
          if (!mark || !baseAnchors) continue;
          const ba = baseAnchors[mark.cls];
          if (!ba || !mark.anchor) continue;
          return { bx: ba.x, by: ba.y, mx: mark.anchor.x, my: mark.anchor.y };
        }
      }
    }
  }
  return null;
}

// ---------- SVG output ----------

/**
 * Returns { d, width, ascent, descent, bbox } for text at `size` px with its baseline origin at (x, y).
 * align: 'start' | 'middle' | 'end' (horizontal). Width is the advance width in px.
 */
export function textPath(F, text, size, x, y, opts = {}) {
  const { font } = F;
  const scale = size / F.upem;
  const run = shape(F, text, { letterSpacing: (opts.letterSpacing ?? 0) / scale });
  const width = run.advance * scale;
  const align = opts.align ?? 'start';
  const x0 = align === 'middle' ? x - width / 2 : align === 'end' ? x - width : x;
  const parts = [];
  let bb = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity };
  for (const g of run.glyphs) {
    const glyph = font.glyphs.get(g.gid);
    const p = glyph.getPath(x0 + g.x * scale, y + -g.y * scale, size);
    const d = p.toPathData(2);
    if (d) parts.push(d);
    const gb = p.getBoundingBox();
    if (gb.x1 < bb.x1) bb.x1 = gb.x1; if (gb.y1 < bb.y1) bb.y1 = gb.y1; if (gb.x2 > bb.x2) bb.x2 = gb.x2; if (gb.y2 > bb.y2) bb.y2 = gb.y2;
  }
  return {
    d: parts.join(' '),
    width,
    x: x0,
    ascent: font.ascender * scale,
    descent: -font.descender * scale,
    bbox: bb,
  };
}

/** Convenience: returns a complete <path> element string. */
export function textEl(F, text, size, x, y, fill, opts = {}) {
  const t = textPath(F, text, size, x, y, opts);
  const extra = opts.attrs ? ' ' + opts.attrs : '';
  return { svg: `<path d="${t.d}" fill="${fill}"${extra}/>`, ...t };
}

export function measure(F, text, size, opts = {}) {
  return textPath(F, text, size, 0, 0, opts).width;
}

// The app's bundled TTFs (app/assets/fonts) are the only fonts ever used; no system fonts.
export const FONTS_DIR = fileURLToPath(new URL('../../assets/fonts/', import.meta.url));
let cache = null;
export function fonts() {
  if (!cache) {
    cache = {
      tiro: loadFont(FONTS_DIR + 'TiroDevanagariHindi-Regular.ttf'),
      sans: loadFont(FONTS_DIR + 'NotoSans-Regular.ttf'),
      sansSemi: loadFont(FONTS_DIR + 'NotoSans-SemiBold.ttf'),
      deva: loadFont(FONTS_DIR + 'NotoSansDevanagari-Regular.ttf'),
      devaSemi: loadFont(FONTS_DIR + 'NotoSansDevanagari-SemiBold.ttf'),
    };
  }
  return cache;
}
