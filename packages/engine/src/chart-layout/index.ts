// Shared chart geometry for the North, South and East Indian styles (design.md section 4, plan.md A02).
// `layout()` returns everything a renderer needs in viewBox units (0..320): house polygons, sign labels,
// planet glyph positions with density mode (2x2 -> 3x2 -> "+N" badge), grid lines and the Lagna mark;
// `hitTest()` maps a touch point (viewBox units) to a house and, when unambiguous, a planet (design 4, M19).
// Both the app (react-native-svg) and the web (SVG string) draw from this output, so the chart is identical.
//
// Text sizes are scale-independent (design 4, M20): user-unit size = sp size x fontScale / (renderedWidth / 320),
// so the rendered size is exactly 12 sp (numerals) / 13.5 sp Latin, 14.5 sp Devanagari (glyphs) times fontScale.
// If a glyph grid would overflow its house (checked against the house polygon with a stroke margin, the sign
// label box and, in the South style, the Lagna mark) the layout steps to the next denser mode first, then
// shrinks towards the 12 sp floor, then hides planets behind a "+N" badge. Nothing is ever drawn outside its
// house and no two boxes intersect.
import type { ChartData } from '../kundli/index';
import { glyphScript, planetGlyphs, signNames, type Lang, type PlanetId } from '../locale/index';

export type ChartStyle = 'north' | 'south' | 'east';
export type DensityMode = '2x2' | '3x2' | 'badge';
export type TextAnchor = 'start' | 'middle' | 'end';
export type Point = [number, number];

export interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface LayoutLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface LayoutHouse {
  n: number;
  /** 1 = Mesha ... 12 = Meena. */
  sign: number;
  polygon: Point[];
  centroid: Point;
  /** Centre of the sign numeral (North/East) or of the sign-name label (South). */
  numeralPos: Point;
  mode: DensityMode;
  planets: PlanetId[];
  /** Planets not drawn as glyphs (listed in the house sheet). */
  hidden: PlanetId[];
}

export interface LayoutGlyph {
  planetId: PlanetId;
  house: number;
  text: string;
  /** Centre of the glyph box (used by hitTest). */
  x: number;
  y: number;
  /** Text anchor and the x coordinate to pass to the SVG text element. */
  anchor: TextAnchor;
  anchorX: number;
  /** Approximate baseline for renderers without alignment-baseline support (y + 0.35 x size). */
  baseline: number;
  size: number;
  width: number;
  height: number;
  approx: boolean;
}

export interface LayoutBadge {
  house: number;
  /** Number of planets hidden behind the badge. */
  count: number;
  text: string;
  x: number;
  y: number;
  baseline: number;
  anchor: TextAnchor;
  anchorX: number;
  size: number;
  width: number;
  height: number;
  hidden: PlanetId[];
}

export interface LayoutLabel {
  kind: 'numeral' | 'signName' | 'centre';
  house?: number;
  text: string;
  x: number;
  y: number;
  baseline: number;
  anchor: TextAnchor;
  anchorX: number;
  size: number;
  width: number;
  height: number;
}

export interface ChartLayout {
  style: ChartStyle;
  viewBox: 320;
  /** renderedWidth / 320: multiply user units by this to get dp (or px). */
  scale: number;
  fontScale: number;
  renderedWidth: number;
  lang: Lang;
  /** 12 sp x fontScale in user units. */
  labelSize: number;
  /** 13.5 sp (Latin) or 14.5 sp (Devanagari) x fontScale in user units, before any shrinking. */
  glyphSize: number;
  frame: { x: number; y: number; width: number; height: number };
  grid: LayoutLine[];
  /** South style only: 2 px accent diagonal in the first-house cell. */
  lagnaMark?: LayoutLine;
  houses: LayoutHouse[];
  glyphs: LayoutGlyph[];
  badges: LayoutBadge[];
  labels: LayoutLabel[];
  /** Densest mode used by any house. */
  mode: DensityMode;
}

export interface LayoutOptions {
  lang?: Lang;
  /** Centre text lines (South/East): e.g. ["Priya · D1 Rashi", "Lahiri · mean node"]. */
  centreLines?: string[];
}

export interface HitResult {
  house: number;
  sign: number;
  planetId?: PlanetId;
  /** Two glyph centres within 12 dp of the touch, or hidden planets: open the house sheet. */
  ambiguous: boolean;
}

// ---- geometry constants (viewBox 0..320, frame stroke centred on 1 and 319) ----
const F0 = 1;
const F1 = 319;
const C = 160;
const FRAME_MARGIN = 1.5; // keep text this far from any grid or frame line
const LABEL_PAD = 5;
const EM_LINE_GAP = 18 / 13.5; // design: line gap 18 units at glyph size 13.5
const EM_TEXT_HEIGHT = 1.2;
const DENSE_FACTOR = 0.9; // 3x2 mode draws glyphs at 0.9 x size (design 4)
const AMBIGUOUS_DP = 12;

// Estimated glyph advance (centre to centre) in em: Latin two-letter glyphs ("Mo" is the widest, ~1.5 em)
// plus a 0.3 em gap; Devanagari short forms are ~0.95 em plus the gap.
const EM_ADVANCE: Record<'latin' | 'devanagari', number> = { latin: 1.8, devanagari: 1.35 };
const EM_GLYPH_WIDTH: Record<'latin' | 'devanagari', Record<string, number>> = {
  latin: { Su: 1.2, Mo: 1.5, Ma: 1.45, Me: 1.45, Ju: 0.95, Ve: 1.25, Sa: 1.15, Ra: 1.2, Ke: 1.2 },
  devanagari: { Su: 0.95, Mo: 0.8, Ma: 0.85, Me: 0.8, Ju: 0.8, Ve: 0.85, Sa: 0.7, Ra: 0.95, Ke: 0.85 },
};

const DEVANAGARI_MARK = /[\u0900-\u0903\u093A-\u094F\u0951-\u0957\u0962\u0963]/;

// Approximate Noto Sans advance widths in em (used for overflow checks, not for drawing).
const LATIN_WIDTHS: Record<string, number> = {
  i: 0.28, j: 0.28, l: 0.28, t: 0.36, f: 0.34, r: 0.41, s: 0.49, c: 0.5, z: 0.48, a: 0.56, e: 0.56, g: 0.62, k: 0.55,
  v: 0.52, x: 0.52, y: 0.52, o: 0.61, n: 0.62, u: 0.62, h: 0.62, d: 0.62, b: 0.62, p: 0.62, q: 0.62, m: 0.93, w: 0.8,
  I: 0.3, J: 0.34, L: 0.52, T: 0.56, E: 0.57, F: 0.53, S: 0.56, Z: 0.58, P: 0.6, B: 0.63, R: 0.62, K: 0.63, V: 0.64,
  A: 0.65, C: 0.64, D: 0.7, G: 0.7, H: 0.73, N: 0.73, U: 0.71, O: 0.75, Q: 0.75, M: 0.87, W: 0.95, X: 0.6, Y: 0.6,
  ' ': 0.26, '.': 0.27, ',': 0.27, '+': 0.57, '-': 0.33, '·': 0.27, '°': 0.4, '′': 0.25, "'": 0.22, ':': 0.27, '/': 0.4, '(': 0.3, ')': 0.3,
};

/** Estimated text width in user units (Noto Sans metrics for Latin and digits; 0.72 em per Devanagari base letter). */
export function estimateTextWidth(text: string, size: number): number {
  let em = 0;
  for (const ch of text) {
    if (/[\u0900-\u097F]/.test(ch)) em += DEVANAGARI_MARK.test(ch) ? 0.08 : 0.72;
    else if (/[0-9]/.test(ch)) em += 0.57;
    else em += LATIN_WIDTHS[ch] ?? 0.6;
  }
  return em * size;
}

function polygonCentroid(poly: Point[]): Point {
  // Area-weighted centroid (exact for the triangles, rhombi and rectangles used here).
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    const cross = x0 * y1 - x1 * y0;
    a += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  a *= 0.5;
  return [cx / (6 * a), cy / (6 * a)];
}

export function pointInPolygon(x: number, y: number, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Shortest distance from a point to the polygon boundary (segments). */
export function distanceToPolygonEdges(x: number, y: number, poly: Point[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((x - x0) * dx + (y - y0) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const px = x0 + t * dx;
    const py = y0 + t * dy;
    best = Math.min(best, Math.hypot(x - px, y - py));
  }
  return best;
}

/** True when the box lies inside the convex polygon with at least `margin` clearance from every edge. */
export function boxInsidePolygon(box: Box, poly: Point[], margin = FRAME_MARGIN): boolean {
  const corners: Point[] = [
    [box.x1, box.y1],
    [box.x2, box.y1],
    [box.x2, box.y2],
    [box.x1, box.y2],
  ];
  return corners.every(([x, y]) => pointInPolygon(x, y, poly) && distanceToPolygonEdges(x, y, poly) >= margin);
}

export function boxesIntersect(a: Box, b: Box): boolean {
  return a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
}

/** True when the segment comes within `margin` of the box (used for the South Lagna diagonal). */
export function segmentNearBox(seg: LayoutLine, box: Box, margin = FRAME_MARGIN): boolean {
  const b: Box = { x1: box.x1 - margin, y1: box.y1 - margin, x2: box.x2 + margin, y2: box.y2 + margin };
  const inside = (x: number, y: number): boolean => x >= b.x1 && x <= b.x2 && y >= b.y1 && y <= b.y2;
  if (inside(seg.x1, seg.y1) || inside(seg.x2, seg.y2)) return true;
  // Liang-Barsky clip of the segment against the expanded box.
  const dx = seg.x2 - seg.x1;
  const dy = seg.y2 - seg.y1;
  let t0 = 0;
  let t1 = 1;
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  return clip(-dx, seg.x1 - b.x1) && clip(dx, b.x2 - seg.x1) && clip(-dy, seg.y1 - b.y1) && clip(dy, b.y2 - seg.y1);
}

function textBox(anchor: TextAnchor, anchorX: number, cy: number, width: number, height: number): Box {
  const x1 = anchor === 'start' ? anchorX : anchor === 'end' ? anchorX - width : anchorX - width / 2;
  return { x1, y1: cy - height / 2, x2: x1 + width, y2: cy + height / 2 };
}

function boxCentreX(box: Box): number {
  return (box.x1 + box.x2) / 2;
}

// ---- house regions per style ----

interface HouseRegion {
  n: number;
  polygon: Point[];
  centroid: Point;
  /** Where the sign numeral / name goes (centre of its box) and its anchor. */
  labelPos: Point;
  labelAnchor: TextAnchor;
  /** How the glyph block is placed inside the region. */
  placement:
    | { kind: 'centroid'; cx: number; cy: number }
    | { kind: 'corner'; anchor: 'start' | 'end'; anchorX: number; vDir: 1 | -1; edgeY: number };
}

function northRegions(): HouseRegion[] {
  const m = (F0 + C) / 2; // 80.5
  const M = (C + F1) / 2; // 239.5
  const polys: Point[][] = [
    [[C, F0], [m, m], [C, C], [M, m]],
    [[F0, F0], [C, F0], [m, m]],
    [[F0, F0], [m, m], [F0, C]],
    [[F0, C], [m, m], [C, C], [m, M]],
    [[F0, C], [m, M], [F0, F1]],
    [[F0, F1], [m, M], [C, F1]],
    [[C, F1], [m, M], [C, C], [M, M]],
    [[C, F1], [M, M], [F1, F1]],
    [[F1, F1], [M, M], [F1, C]],
    [[F1, C], [M, M], [C, C], [M, m]],
    [[F1, C], [M, m], [F1, F0]],
    [[F1, F0], [M, m], [C, F0]],
  ];
  // Inner vertex and bisector direction for the numeral (design 4: 20-24 units inside the inner vertex).
  const inner: { v: Point; d: Point; inset: number }[] = [
    { v: [C, C], d: [0, -1], inset: 22 },
    { v: [m, m], d: [0, -1], inset: 24 },
    { v: [m, m], d: [-1, 0], inset: 24 },
    { v: [C, C], d: [-1, 0], inset: 22 },
    { v: [m, M], d: [-1, 0], inset: 24 },
    { v: [m, M], d: [0, 1], inset: 24 },
    { v: [C, C], d: [0, 1], inset: 22 },
    { v: [M, M], d: [0, 1], inset: 24 },
    { v: [M, M], d: [1, 0], inset: 24 },
    { v: [C, C], d: [1, 0], inset: 22 },
    { v: [M, m], d: [1, 0], inset: 24 },
    { v: [M, m], d: [0, -1], inset: 24 },
  ];
  return polys.map((polygon, i) => {
    const centroid = polygonCentroid(polygon);
    const { v, d, inset } = inner[i];
    return {
      n: i + 1,
      polygon,
      centroid,
      labelPos: [v[0] + d[0] * inset, v[1] + d[1] * inset],
      labelAnchor: 'middle',
      placement: { kind: 'centroid', cx: centroid[0], cy: centroid[1] },
    };
  });
}

/** South: cells (col,row) clockwise from Meena at the top-left; index 0 = Meena (sign 12), 1 = Mesha ... */
const SOUTH_CELLS: Point[] = [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3], [2, 3], [1, 3], [0, 3], [0, 2], [0, 1]];
const SOUTH_CELL = (F1 - F0) / 4; // 79.5

function southCellForSign(sign: number): { col: number; row: number } {
  const idx = sign % 12; // Meena (12) -> 0, Mesha (1) -> 1, ...
  const [col, row] = SOUTH_CELLS[idx];
  return { col, row };
}

const SOUTH_LAGNA_MARK = 22; // the Lagna diagonal occupies the top-left 22 x 22 units of the first-house cell

function southRegions(firstHouseSign: number, labelSize: number): HouseRegion[] {
  const regions: HouseRegion[] = [];
  const labelHeight = labelSize * EM_TEXT_HEIGHT;
  for (let n = 1; n <= 12; n++) {
    const sign = ((firstHouseSign - 1 + n - 1) % 12) + 1;
    const { col, row } = southCellForSign(sign);
    const x1 = F0 + col * SOUTH_CELL;
    const y1 = F0 + row * SOUTH_CELL;
    const x2 = x1 + SOUTH_CELL;
    const y2 = y1 + SOUTH_CELL;
    const polygon: Point[] = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
    // Sign name at the bottom-left; the glyph block is centred in the area above the label strip and,
    // in the first-house cell, below the Lagna mark.
    const labelCy = y2 - 4 - labelHeight / 2;
    const stripTop = y2 - 4 - labelHeight - 2;
    const areaTop = n === 1 ? y1 + SOUTH_LAGNA_MARK : y1;
    regions.push({
      n,
      polygon,
      centroid: polygonCentroid(polygon),
      labelPos: [x1 + 7, labelCy],
      labelAnchor: 'start',
      placement: { kind: 'centroid', cx: (x1 + x2) / 2, cy: (areaTop + stripTop) / 2 },
    });
  }
  return regions;
}

const EAST_G = (F1 - F0) / 3; // 106
const EX1 = F0 + EAST_G; // 107
const EX2 = F0 + 2 * EAST_G; // 213

function eastRegions(labelSize: number): HouseRegion[] {
  const inset = labelSize / 2 + 5;
  type Corner = { R: Point; hDir: 1 | -1; vDir: 1 | -1 };
  const rect = (x1: number, y1: number, x2: number, y2: number): Point[] => [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
  const defs: { polygon: Point[]; label: Point; corner?: Corner }[] = [
    { polygon: rect(EX1, F0, EX2, EX1), label: [C, EX1 - inset] }, // H1 top centre (numeral at the inner edge, as in the mock)
    { polygon: [[F0, F0], [EX1, F0], [EX1, EX1]], label: [EX1 - inset, F0 + inset], corner: { R: [EX1, F0], hDir: -1, vDir: 1 } }, // H2
    { polygon: [[F0, F0], [F0, EX1], [EX1, EX1]], label: [F0 + inset, EX1 - inset], corner: { R: [F0, EX1], hDir: 1, vDir: -1 } }, // H3
    { polygon: rect(F0, EX1, EX1, EX2), label: [F0 + inset, EX2 - inset] }, // H4 left centre
    { polygon: [[F0, EX2], [EX1, EX2], [F0, F1]], label: [F0 + inset, EX2 + inset], corner: { R: [F0, EX2], hDir: 1, vDir: 1 } }, // H5
    { polygon: [[EX1, EX2], [EX1, F1], [F0, F1]], label: [EX1 - inset, F1 - inset], corner: { R: [EX1, F1], hDir: -1, vDir: -1 } }, // H6
    { polygon: rect(EX1, EX2, EX2, F1), label: [C, F1 - inset] }, // H7 bottom centre
    { polygon: [[EX2, EX2], [EX2, F1], [F1, F1]], label: [EX2 + inset, F1 - inset], corner: { R: [EX2, F1], hDir: 1, vDir: -1 } }, // H8
    { polygon: [[EX2, EX2], [F1, EX2], [F1, F1]], label: [F1 - inset, EX2 + inset], corner: { R: [F1, EX2], hDir: -1, vDir: 1 } }, // H9
    { polygon: rect(EX2, EX1, F1, EX2), label: [F1 - inset, EX2 - inset] }, // H10 right centre
    { polygon: [[F1, F0], [F1, EX1], [EX2, EX1]], label: [F1 - inset, EX1 - inset], corner: { R: [F1, EX1], hDir: -1, vDir: -1 } }, // H11
    { polygon: [[EX2, F0], [F1, F0], [EX2, EX1]], label: [EX2 + inset, F0 + inset], corner: { R: [EX2, F0], hDir: 1, vDir: 1 } }, // H12
  ];
  return defs.map((d, i) => {
    const centroid = polygonCentroid(d.polygon);
    let placement: HouseRegion['placement'];
    if (d.corner) {
      const { R, hDir, vDir } = d.corner;
      // Glyphs hug the vertical leg of the right angle (anchored toward the outer corner) and stack away
      // from the horizontal leg, past the numeral, so they never touch the diagonal (design 4).
      placement = {
        kind: 'corner',
        anchor: hDir === -1 ? 'end' : 'start',
        anchorX: R[0] + hDir * LABEL_PAD,
        vDir,
        edgeY: R[1] + vDir * (2 * LABEL_PAD + labelSize * EM_TEXT_HEIGHT),
      };
    } else {
      placement = { kind: 'centroid', cx: centroid[0], cy: centroid[1] };
    }
    return { n: i + 1, polygon: d.polygon, centroid, labelPos: d.label, labelAnchor: 'middle', placement };
  });
}

// ---- glyph block planning ----

interface Slot {
  cx: number;
  cy: number;
  anchor: TextAnchor;
  anchorX: number;
}

interface BlockPlan {
  mode: DensityMode;
  size: number;
  visible: PlanetId[];
  hidden: PlanetId[];
  slots: Slot[]; // one per visible planet, then one for the badge when hidden.length > 0
  boxes: Box[];
}

interface PlanContext {
  script: 'latin' | 'devanagari';
  glyphText: (id: PlanetId) => string;
  obstacles: Box[];
  segments: LayoutLine[];
  polygon: Point[];
  placement: HouseRegion['placement'];
}

function badgeText(count: number): string {
  return `+${count}`;
}

function buildPlan(ctx: PlanContext, mode: DensityMode, size: number, visible: PlanetId[], hidden: PlanetId[]): BlockPlan {
  const perLine = mode === '2x2' ? 2 : 3;
  const advance = EM_ADVANCE[ctx.script] * size;
  const lineGap = EM_LINE_GAP * size;
  const height = EM_TEXT_HEIGHT * size;
  const slotCount = visible.length + (hidden.length ? 1 : 0);
  const lines = Math.max(1, Math.ceil(slotCount / perLine));
  const rows: number[] = [];
  for (let i = 0; i < lines; i++) rows.push(Math.min(perLine, slotCount - i * perLine));
  const slots: Slot[] = [];
  const p = ctx.placement;
  for (let r = 0; r < lines; r++) {
    const k = rows[r];
    let cy: number;
    if (p.kind === 'centroid') {
      cy = p.cy + (r - (lines - 1) / 2) * lineGap;
    } else if (p.vDir === 1) {
      cy = p.edgeY + height / 2 + r * lineGap;
    } else {
      cy = p.edgeY - height / 2 - (lines - 1 - r) * lineGap;
    }
    for (let j = 0; j < k; j++) {
      if (p.kind === 'centroid') {
        const cx = p.cx + (j - (k - 1) / 2) * advance;
        slots.push({ cx, cy, anchor: 'middle', anchorX: cx });
      } else if (p.anchor === 'start') {
        const left = p.anchorX + j * advance;
        slots.push({ cx: left + advance / 2, cy, anchor: 'start', anchorX: left });
      } else {
        const right = p.anchorX - (k - 1 - j) * advance;
        slots.push({ cx: right - advance / 2, cy, anchor: 'end', anchorX: right });
      }
    }
  }
  const boxes: Box[] = slots.map((s, i) => {
    const isBadge = i >= visible.length;
    const w = isBadge ? estimateTextWidth(badgeText(hidden.length), size) : (EM_GLYPH_WIDTH[ctx.script][visible[i]] ?? 1.5) * size;
    return textBox(s.anchor, s.anchorX, s.cy, Math.min(w, advance), height);
  });
  return { mode, size, visible, hidden, slots, boxes };
}

function planFits(ctx: PlanContext, plan: BlockPlan): boolean {
  for (const b of plan.boxes) {
    if (!boxInsidePolygon(b, ctx.polygon)) return false;
    for (const o of ctx.obstacles) if (boxesIntersect(b, o)) return false;
    for (const s of ctx.segments) if (segmentNearBox(s, b)) return false;
  }
  return true;
}

/** Density modes a house with n planets may use, densest last (design 4: 2x2 -> 3x2 at 5+ -> badge beyond 6). */
function modesFor(n: number): DensityMode[] {
  return n <= 2 ? ['2x2'] : n <= 4 ? ['2x2', '3x2'] : n <= 6 ? ['3x2'] : ['badge'];
}

/**
 * Plans one house at a given shrink step: every allowed mode in order (the next denser mode is tried before
 * any shrinking); null when nothing fits at this step.
 */
function planHouseAtStep(ctx: PlanContext, planets: PlanetId[], glyphSize: number, floorSize: number, step: number): BlockPlan | null {
  for (const mode of modesFor(planets.length)) {
    const size = Math.max(floorSize, glyphSize * step * (mode === '2x2' ? 1 : DENSE_FACTOR));
    const visible = mode === 'badge' ? planets.slice(0, 5) : planets;
    const hidden = mode === 'badge' ? planets.slice(5) : [];
    const plan = buildPlan(ctx, mode, size, visible, hidden);
    if (planFits(ctx, plan)) return plan;
  }
  return null;
}

/** Last resort at the floor size: fewer visible glyphs behind the "+N" badge; badge-only always fits. */
function planHouseFallback(ctx: PlanContext, planets: PlanetId[], floorSize: number): BlockPlan {
  for (const keep of [3, 1, 0]) {
    if (keep >= planets.length) continue;
    const plan = buildPlan(ctx, 'badge', floorSize, planets.slice(0, keep), planets.slice(keep));
    if (planFits(ctx, plan)) return plan;
  }
  return buildPlan(ctx, 'badge', floorSize, [], planets);
}

const SHRINK_STEPS = [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6];

/**
 * Plans every house with ONE chart-wide shrink step (uniform glyph size apart from the 0.9 factor of 3x2
 * houses): the first step at which every house fits; houses that still do not fit at the 12 sp floor fall
 * back to a badge with fewer visible glyphs.
 */
function planAllHouses(ctxs: PlanContext[], planetsPerHouse: PlanetId[][], glyphSize: number, floorSize: number): BlockPlan[] {
  let best: (BlockPlan | null)[] = [];
  for (const step of SHRINK_STEPS) {
    best = ctxs.map((ctx, i) => planHouseAtStep(ctx, planetsPerHouse[i], glyphSize, floorSize, step));
    if (best.every((p) => p !== null)) return best as BlockPlan[];
    if (glyphSize * step <= floorSize) break;
  }
  return best.map((p, i) => p ?? planHouseFallback(ctxs[i], planetsPerHouse[i], floorSize));
}

// ---- public API ----

export function layout(style: ChartStyle, chart: ChartData, fontScale: number, renderedWidth: number, opts: LayoutOptions = {}): ChartLayout {
  if (!(fontScale > 0)) throw new Error(`fontScale must be positive: ${fontScale}`);
  if (!(renderedWidth > 0)) throw new Error(`renderedWidth must be positive: ${renderedWidth}`);
  const lang: Lang = opts.lang ?? 'en';
  const script = glyphScript(lang);
  const scale = renderedWidth / 320;
  const labelSize = (12 * fontScale) / scale;
  const glyphSize = ((script === 'latin' ? 13.5 : 14.5) * fontScale) / scale;
  const floorSize = 12 / scale; // 12 sp absolute floor (spec 8)
  const glyphText = (id: PlanetId): string => planetGlyphs[script][id];

  const regions = style === 'north' ? northRegions() : style === 'south' ? southRegions(chart.firstHouseSign, labelSize) : eastRegions(labelSize);
  const labels: LayoutLabel[] = [];
  const houses: LayoutHouse[] = [];
  const glyphs: LayoutGlyph[] = [];
  const badges: LayoutBadge[] = [];
  let densest: DensityMode = '2x2';
  const rank: Record<DensityMode, number> = { '2x2': 0, '3x2': 1, badge: 2 };

  // South: Lagna (first house) mark, a short diagonal in the top-left corner of the first-house cell.
  let lagnaMark: LayoutLine | undefined;
  if (style === 'south') {
    const [x1, y1] = regions[0].polygon[0];
    lagnaMark = { x1: x1 + 3, y1: y1 + SOUTH_LAGNA_MARK - 1, x2: x1 + SOUTH_LAGNA_MARK - 1, y2: y1 + 3 };
  }

  // Pass 1: sign labels (fixed positions) and the planning context of every house.
  const labelHeight = labelSize * EM_TEXT_HEIGHT;
  const ctxs: PlanContext[] = [];
  const planetsPerHouse: PlanetId[][] = [];
  const labelBoxes: Box[] = [];
  for (const region of regions) {
    const n = region.n;
    const sign = ((chart.firstHouseSign - 1 + n - 1) % 12) + 1;
    planetsPerHouse.push(chart.planets.filter((p) => p.house === n).map((p) => p.id));

    // Numeral for North/East; sign name for South, falling back to the numeral when the name would overflow
    // the cell at this fontScale (12 sp floor and "no overflow" both hold).
    let text = String(sign);
    let kind: LayoutLabel['kind'] = 'numeral';
    if (style === 'south') {
      kind = 'signName';
      const name = signNames[lang][sign - 1];
      text = estimateTextWidth(name, labelSize) <= SOUTH_CELL - 7 - LABEL_PAD ? name : String(sign);
    }
    const labelWidth = estimateTextWidth(text, labelSize);
    const labelAnchorX = region.labelPos[0];
    const labelBox = textBox(region.labelAnchor, labelAnchorX, region.labelPos[1], labelWidth, labelHeight);
    labelBoxes.push(labelBox);
    labels.push({
      kind,
      house: n,
      text,
      x: boxCentreX(labelBox),
      y: region.labelPos[1],
      baseline: region.labelPos[1] + 0.35 * labelSize,
      anchor: region.labelAnchor,
      anchorX: labelAnchorX,
      size: labelSize,
      width: labelWidth,
      height: labelHeight,
    });
    ctxs.push({
      script,
      glyphText,
      obstacles: [labelBox],
      segments: style === 'south' && n === 1 && lagnaMark ? [lagnaMark] : [],
      polygon: region.polygon,
      placement: region.placement,
    });
  }

  // Pass 2: glyph blocks with one chart-wide shrink step.
  const plans = planAllHouses(ctxs, planetsPerHouse, glyphSize, floorSize);

  regions.forEach((region, idx) => {
    const n = region.n;
    const sign = ((chart.firstHouseSign - 1 + n - 1) % 12) + 1;
    const planets = planetsPerHouse[idx];
    const labelBox = labelBoxes[idx];
    const plan = plans[idx];
    if (rank[plan.mode] > rank[densest]) densest = plan.mode;

    plan.visible.forEach((id, i) => {
      const slot = plan.slots[i];
      const box = plan.boxes[i];
      const planet = chart.planets.find((p) => p.id === id);
      glyphs.push({
        planetId: id,
        house: n,
        text: glyphText(id),
        x: boxCentreX(box),
        y: slot.cy,
        anchor: slot.anchor,
        anchorX: slot.anchorX,
        baseline: slot.cy + 0.35 * plan.size,
        size: plan.size,
        width: box.x2 - box.x1,
        height: box.y2 - box.y1,
        approx: planet?.approx ?? false,
      });
    });
    if (plan.hidden.length) {
      const slot = plan.slots[plan.visible.length];
      const box = plan.boxes[plan.visible.length];
      badges.push({
        house: n,
        count: plan.hidden.length,
        text: badgeText(plan.hidden.length),
        x: boxCentreX(box),
        y: slot.cy,
        baseline: slot.cy + 0.35 * plan.size,
        anchor: slot.anchor,
        anchorX: slot.anchorX,
        size: plan.size,
        width: box.x2 - box.x1,
        height: box.y2 - box.y1,
        hidden: plan.hidden,
      });
    }
    houses.push({
      n,
      sign,
      polygon: region.polygon,
      centroid: region.centroid,
      numeralPos: [boxCentreX(labelBox), region.labelPos[1]],
      mode: plan.mode,
      planets,
      hidden: plan.hidden,
    });
  });

  // Centre text (South/East) when the caller supplies it.
  if (style !== 'north' && opts.centreLines && opts.centreLines.length) {
    const lines = opts.centreLines.slice(0, 3);
    const gap = labelSize * 1.5;
    lines.forEach((t, i) => {
      const cy = C + (i - (lines.length - 1) / 2) * gap;
      const w = estimateTextWidth(t, labelSize);
      labels.push({ kind: 'centre', text: t, x: C, y: cy, baseline: cy + 0.35 * labelSize, anchor: 'middle', anchorX: C, size: labelSize, width: w, height: labelHeightOf(labelSize) });
    });
  }

  return {
    style,
    viewBox: 320,
    scale,
    fontScale,
    renderedWidth,
    lang,
    labelSize,
    glyphSize,
    frame: { x: F0, y: F0, width: F1 - F0, height: F1 - F0 },
    grid: gridFor(style),
    lagnaMark,
    houses,
    glyphs,
    badges,
    labels,
    mode: densest,
  };
}

function labelHeightOf(size: number): number {
  return size * EM_TEXT_HEIGHT;
}

function gridFor(style: ChartStyle): LayoutLine[] {
  if (style === 'north') {
    return [
      { x1: F0, y1: F0, x2: F1, y2: F1 },
      { x1: F1, y1: F0, x2: F0, y2: F1 },
      { x1: C, y1: F0, x2: F1, y2: C },
      { x1: F1, y1: C, x2: C, y2: F1 },
      { x1: C, y1: F1, x2: F0, y2: C },
      { x1: F0, y1: C, x2: C, y2: F0 },
    ];
  }
  if (style === 'south') {
    const a = F0 + SOUTH_CELL;
    const b = F0 + 2 * SOUTH_CELL;
    const c = F0 + 3 * SOUTH_CELL;
    return [
      { x1: a, y1: F0, x2: a, y2: F1 },
      { x1: c, y1: F0, x2: c, y2: F1 },
      { x1: F0, y1: a, x2: F1, y2: a },
      { x1: F0, y1: c, x2: F1, y2: c },
      { x1: b, y1: F0, x2: b, y2: a },
      { x1: b, y1: c, x2: b, y2: F1 },
      { x1: F0, y1: b, x2: a, y2: b },
      { x1: c, y1: b, x2: F1, y2: b },
    ];
  }
  return [
    { x1: EX1, y1: F0, x2: EX1, y2: F1 },
    { x1: EX2, y1: F0, x2: EX2, y2: F1 },
    { x1: F0, y1: EX1, x2: F1, y2: EX1 },
    { x1: F0, y1: EX2, x2: F1, y2: EX2 },
    { x1: F0, y1: F0, x2: EX1, y2: EX1 },
    { x1: F1, y1: F0, x2: EX2, y2: EX1 },
    { x1: F0, y1: F1, x2: EX1, y2: EX2 },
    { x1: F1, y1: F1, x2: EX2, y2: EX2 },
  ];
}

/**
 * Maps a touch point (viewBox units; convert dp with x / layout.scale) to a house and planet (design 4, M19):
 * point-in-polygon over the 12 houses, then the glyph whose centre is nearest within that house. Ambiguous
 * (open the house sheet) when the two nearest glyph centres are both within 12 dp or the house hides planets;
 * an empty house is returned without a planet. Returns null outside every house (e.g. the South/East centre).
 */
export function hitTest(lay: ChartLayout, x: number, y: number): HitResult | null {
  const house = lay.houses.find((h) => pointInPolygon(x, y, h.polygon));
  if (!house) return null;
  const inHouse = lay.glyphs.filter((g) => g.house === house.n);
  if (inHouse.length === 0) return { house: house.n, sign: house.sign, ambiguous: house.hidden.length > 0 };
  const threshold = AMBIGUOUS_DP / lay.scale;
  const sorted = inHouse
    .map((g) => ({ g, d: Math.hypot(g.x - x, g.y - y) }))
    .sort((a, b) => a.d - b.d);
  const nearest = sorted[0];
  const second = sorted[1];
  const ambiguous = house.hidden.length > 0 || (second !== undefined && nearest.d <= threshold && second.d <= threshold);
  return { house: house.n, sign: house.sign, planetId: nearest.g.planetId, ambiguous };
}

/** Bounding box of a glyph / badge / label as laid out (for audits and tests). */
export function itemBox(item: { x: number; y: number; width: number; height: number }): Box {
  return { x1: item.x - item.width / 2, y1: item.y - item.height / 2, x2: item.x + item.width / 2, y2: item.y + item.height / 2 };
}
