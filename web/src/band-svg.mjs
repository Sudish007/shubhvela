// Good-hours band as an SVG string (design.md 10.2, 2.1, 8; FEAT-D02): the SAME construction as the app's GoodHoursBand —
// engine goodHours spans placed with engine bandPosition (day 75 % / night 25 %), good = saffron + dot pattern, avoid =
// hatch pattern, neutral = plain, night spans indigo with the pattern as the verdict carrier (N1), moonrise tick on the
// top edge, tick row (sunrise · noon · sunset · next sunrise), inline labels decided by engine labelFor (N3: hidden
// under 60 dp × fontScale, reason names only when every reason is that wide). No gradients, no shadows, no "now" marker
// (the page is static; the app draws the live line). Two modes:
//  - 'web': width "100%" with percentage x positions (the SVG stretches with its column, text stays at CSS px), fills via
//    classes coloured by site.css from the tokens (theme-aware).
//  - 'standalone': fixed pixel width, inline light-palette fills (OG images rendered by resvg; no text — the OG renderer
//    adds the tick times with Pango because resvg mis-shapes Devanagari).
// Pure: takes the loaded engine module and a GoodHours object, returns markup.

export const BAND_LIGHT = {
  good: '#C57030',
  goodInk: '#1C1A17',
  neutral: '#F1ECE3',
  avoid: '#E3DCD0',
  avoidHatch: '#6F6960',
  night: '#2E2A6E',
  nightInk: '#FFFFFF',
  indigo: '#2E2A6E',
  hair2: '#CFC7BA',
  ink: '#1C1A17',
  ink3: '#6F6960',
};

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fmt(n) {
  return Number.isInteger(n) ? String(n) : Number(n).toFixed(2).replace(/\.?0+$/, '');
}

/** Span fill token: night spans are indigo whatever the verdict (the pattern carries it), as in the app's fillFor. */
export function fillTokenFor(span) {
  if (span.night) return 'night';
  return span.verdict === 'good' ? 'good' : span.verdict === 'avoid' ? 'avoid' : 'neutral';
}

/** Pattern token: dots for good, hatch for avoid, none for neutral; night variants in night-ink (app patternFor). */
export function patternTokenFor(span) {
  if (span.verdict === 'good') return span.night ? 'dotsNight' : 'dots';
  if (span.verdict === 'avoid') return span.night ? 'hatchNight' : 'hatch';
  return null;
}

/** Display name of a segment: choghadiya rows at night use the bare name; everything else band.seg.<name> (app segmentName). */
export function segmentLabel(t, seg) {
  if (seg.kind === 'choghadiya' && seg.night && seg.choghadiya) return t(`band.chog.${seg.choghadiya.toLowerCase()}`);
  return t(`band.seg.${seg.name}`);
}

export function segmentLabelById(t, gh, id) {
  const seg = gh.segments.find((s) => s.id === id);
  return seg ? segmentLabel(t, seg) : id;
}

/** Labels to draw: engine labelFor decides visibility and whether reason names or the verdict word show (N3). */
export function bandLabels(engine, gh, widthDp, fontScale, t) {
  const out = [];
  const ticks = gh.ticks;
  if (!ticks) return out;
  for (const span of gh.spans) {
    const label = engine.labelFor(span, gh, widthDp, fontScale);
    if (!label) continue;
    const text = label.kind === 'reasons' ? label.segments.map((id) => segmentLabelById(t, gh, id)).join(' · ') : t(`band.${label.verdict}_band`);
    out.push({ span, text, x0: engine.bandPosition(span.start, ticks), x1: engine.bandPosition(span.end, ticks) });
  }
  return out;
}

const A11Y_MIN_MS = 60_000;

/** "Good hours band. Avoid 06:27 to 10:40 (Yamaganda, Rog, Gulika). ... Night: ... No flags." (app bandA11yText, no "now"). */
export function bandA11yText(engine, gh, t, flagsText) {
  const tz = gh.tz;
  const parts = [];
  let nightStarted = false;
  for (const span of gh.spans) {
    if (span.end - span.start < A11Y_MIN_MS) continue;
    if (span.night && !nightStarted) {
      parts.push(t('today.bandA11yNight'));
      nightStarted = true;
    }
    const reasons = span.reasons.map((id) => segmentLabelById(t, gh, id)).join(', ');
    const p = { verdict: t(`verdict.${span.verdict}`), from: engine.formatInZone(span.start, tz, 'HH:mm'), to: engine.formatInZone(span.end, tz, 'HH:mm'), reasons };
    parts.push(reasons ? t('today.bandA11ySpan', p) : t('today.bandA11ySpanPlain', p));
  }
  const spans = parts.join(' ');
  // The static page has no "now", so the web strings carry the app's sentence without its "Now {time}." clause.
  return flagsText ? t('band.a11yFlags', { spans, flags: flagsText }) : t('band.a11yNoFlags', { spans });
}

/** Flag sentences (Panchak till …, Bhadra on earth …) from gh.flags, as the app's FlagsLine (text, never a colour). */
export function flagSentences(engine, gh, t, lang) {
  const tz = gh.tz;
  const dayTime = (ms) => (engine.formatInZone(ms, tz, 'yyyy-MM-dd') === gh.day ? engine.formatInZone(ms, tz, 'HH:mm') : engine.formatInZone(ms, tz, 'EEE d MMM HH:mm', lang));
  const out = [];
  const f = gh.flags ?? {};
  if (f.panchak) out.push(t('today.flagPanchak', { until: dayTime(f.panchak.end) }));
  if (f.bhadra) {
    const key = f.bhadra.location === 'earth' ? 'today.flagBhadraEarth' : f.bhadra.location === 'heaven' ? 'today.flagBhadraHeaven' : 'today.flagBhadraPatal';
    out.push(t(key, { from: dayTime(f.bhadra.start), to: dayTime(f.bhadra.end) }));
  }
  return out;
}

/**
 * The band.
 * opts: { mode 'web'|'standalone', t, lang, width (px number; 'web' ignores it and uses 100 %), nominalWidth (dp the N3
 *         check runs at; default 326 = the app's default band width), fontScale (1), stripHeight (32), labelSize (13),
 *         tickSize (12), ticksRow (true), id (unique suffix for pattern ids), colors (standalone palette), ariaLabel }
 */
export function bandSvg(engine, gh, opts = {}) {
  const mode = opts.mode ?? 'web';
  const t = opts.t;
  const ticks = gh.ticks;
  if (!ticks) return '';
  const tz = gh.tz;
  const c = { ...BAND_LIGHT, ...(opts.colors ?? {}) };
  const H = opts.stripHeight ?? 32;
  const labelSize = opts.labelSize ?? 13;
  const tickSize = opts.tickSize ?? 12;
  const ticksRow = opts.ticksRow !== false;
  const tickRowH = ticksRow ? Math.round(tickSize * 1.9) : 0;
  const total = H + tickRowH;
  const pct = mode === 'web';
  const W = pct ? 100 : opts.width ?? 1000;
  const nominal = opts.nominalWidth ?? (pct ? 326 : W / (labelSize / 13));
  const fontScale = opts.fontScale ?? 1;
  const id = opts.id ?? 'b';
  const X = (pos) => (pct ? `${fmt(pos * 100)}%` : fmt(pos * W));
  const WD = (a, b) => (pct ? `${fmt(Math.max(0, (b - a) * 100))}%` : fmt(Math.max(0, (b - a) * W)));
  const pos = (ms) => engine.bandPosition(ms, ticks);
  const hm = (ms) => engine.formatInZone(ms, tz, 'HH:mm');

  const attrs = [`xmlns="http://www.w3.org/2000/svg"`, pct ? `width="100%" height="${total}"` : `width="${W}" height="${total}" viewBox="0 0 ${W} ${total}"`];
  if (mode === 'web') attrs.push('class="band"', 'role="img"');
  if (opts.ariaLabel) attrs.push(`aria-label="${esc(opts.ariaLabel)}"`);
  const parts = [`<svg ${attrs.join(' ')}>`];

  // Patterns: identical geometry to the app (dots r 1.1 on a 6 px grid; hatch 1.4 px strokes on an 8 px grid).
  const pat = (pid, w, inner) => `<pattern id="${pid}" patternUnits="userSpaceOnUse" width="${w}" height="${w}">${inner}</pattern>`;
  const dot = (cls, fill, op) => `<circle class="${cls}" cx="3" cy="3" r="1.1"${mode === 'standalone' ? ` fill="${fill}"${op ? ` fill-opacity="${op}"` : ''}` : ''}/>`;
  const hatch = (cls, stroke, op) => `<path class="${cls}" d="M-2 2L2 -2M0 8L8 0M6 10L10 6" stroke-width="1.4"${mode === 'standalone' ? ` stroke="${stroke}"${op ? ` stroke-opacity="${op}"` : ''}` : ''}/>`;
  parts.push('<defs>');
  parts.push(pat(`${id}-dots`, 6, dot('pd', c.goodInk)));
  parts.push(pat(`${id}-dotsNight`, 6, dot('pdn', c.nightInk, 0.85)));
  parts.push(pat(`${id}-hatch`, 8, hatch('ph', c.avoidHatch)));
  parts.push(pat(`${id}-hatchNight`, 8, hatch('phn', c.nightInk, 0.85)));
  parts.push(`<clipPath id="${id}-clip"><rect x="0" y="0" width="${pct ? '100%' : W}" height="${H}" rx="4"/></clipPath>`);
  parts.push('</defs>');

  // Strip background (neutral) + spans + pattern overlays + dividers + moonrise tick, clipped to the rounded strip.
  parts.push(`<g clip-path="url(#${id}-clip)">`);
  parts.push(`<rect class="sp-neutral" x="0" y="0" width="${pct ? '100%' : W}" height="${H}"${mode === 'standalone' ? ` fill="${c.neutral}"` : ''}/>`);
  const rects = gh.spans.map((span) => ({ span, x0: pos(span.start), x1: pos(span.end) }));
  for (const r of rects) {
    const tok = fillTokenFor(r.span);
    parts.push(`<rect class="sp-${tok}" x="${X(r.x0)}" y="0" width="${WD(r.x0, r.x1)}" height="${H}"${mode === 'standalone' ? ` fill="${c[tok]}"` : ''}/>`);
  }
  for (const r of rects) {
    const p = patternTokenFor(r.span);
    if (p) parts.push(`<rect x="${X(r.x0)}" y="0" width="${WD(r.x0, r.x1)}" height="${H}" fill="url(#${id}-${p})"/>`);
  }
  for (const r of rects.slice(1)) {
    const night = r.span.night;
    parts.push(`<line class="${night ? 'dv-night' : 'dv'}" x1="${X(r.x0)}" y1="0" x2="${X(r.x0)}" y2="${H}" stroke-width="1"${mode === 'standalone' ? ` stroke="${night ? c.nightInk : c.hair2}"${night ? ' stroke-opacity="0.35"' : ''}` : ''}/>`);
  }
  if (ticks.moonrise !== null && ticks.moonrise !== undefined) {
    const mx = pos(ticks.moonrise);
    parts.push(`<rect class="moon" x="${pct ? `calc(${fmt(mx * 100)}% - 1px)` : fmt(mx * W - 1)}" y="0" width="2" height="7"${mode === 'standalone' ? ` fill="${c.indigo}"` : ''}/>`);
  }
  parts.push('</g>');
  // Hairline frame of the strip (the app's 1 px border in hair-2).
  parts.push(`<rect class="frame" x="0.5" y="0.5" width="${pct ? 'calc(100% - 1px)' : fmt(W - 1)}" height="${H - 1}" rx="4" fill="none" stroke-width="1"${mode === 'standalone' ? ` stroke="${c.hair2}"` : ''}/>`);

  // Inline labels (web mode only: resvg's Devanagari shaping is wrong, so the OG image draws no label text).
  if (mode === 'web' && t) {
    for (const l of bandLabels(engine, gh, nominal, fontScale, t)) {
      const tok = fillTokenFor(l.span);
      const inkCls = l.span.night ? 'lbl-night' : l.span.verdict === 'good' ? 'lbl-good' : 'lbl';
      const cx = (l.x0 + l.x1) / 2;
      // Backing box in the span fill (as the app's label background) sized from a per-glyph estimate; clipped to the span.
      const estW = Math.round(l.text.length * labelSize * 0.6 + 10);
      parts.push(`<clipPath id="${id}-c${parts.length}"><rect x="${X(l.x0)}" y="0" width="${WD(l.x0, l.x1)}" height="${H}"/></clipPath>`);
      parts.push(`<g clip-path="url(#${id}-c${parts.length - 1})">`);
      parts.push(`<rect class="sp-${tok}" x="calc(${fmt(cx * 100)}% - ${estW / 2}px)" y="${(H - labelSize - 6) / 2}" width="${estW}" height="${labelSize + 6}" rx="3"/>`);
      parts.push(`<text class="${inkCls}" x="${X(cx)}" y="${fmt(H / 2 + labelSize * 0.36)}" text-anchor="middle" font-size="${labelSize}" font-weight="600">${esc(l.text)}</text>`);
      parts.push('</g>');
    }
  }

  // Tick row: sunrise (left), noon, sunset, next sunrise (right); 4 px marks in hair-2, 12 px tabular text.
  if (ticksRow) {
    const marks = [
      { x: 0, text: hm(ticks.sunrise), anchor: 'start' },
      { x: pos(ticks.noon), text: hm(ticks.noon), anchor: 'middle' },
      { x: pos(ticks.sunset), text: hm(ticks.sunset), anchor: 'middle' },
      { x: 1, text: hm(ticks.nextSunrise), anchor: 'end' },
    ];
    for (const m of marks) {
      const x = pct ? (m.x === 0 ? '0.5' : m.x === 1 ? 'calc(100% - 0.5px)' : `${fmt(m.x * 100)}%`) : fmt(Math.min(W - 0.5, Math.max(0.5, m.x * W)));
      parts.push(`<line class="tk" x1="${x}" y1="${H + 2}" x2="${x}" y2="${H + 6}" stroke-width="1"${mode === 'standalone' ? ` stroke="${c.hair2}"` : ''}/>`);
      if (mode === 'web') {
        parts.push(`<text class="tkt num" x="${X(m.x)}" y="${H + 7 + tickSize}" text-anchor="${m.anchor}" font-size="${tickSize}">${esc(m.text)}</text>`);
      }
    }
  }
  parts.push('</svg>');
  return parts.join('');
}

/** The tick-row texts for renderers that draw text themselves (OG): [{pos 0..1, text, anchor}]. */
export function bandTickTexts(engine, gh) {
  const ticks = gh.ticks;
  if (!ticks) return [];
  const hm = (ms) => engine.formatInZone(ms, gh.tz, 'HH:mm');
  return [
    { pos: 0, text: hm(ticks.sunrise), anchor: 'start' },
    { pos: engine.bandPosition(ticks.noon, ticks), text: hm(ticks.noon), anchor: 'middle' },
    { pos: engine.bandPosition(ticks.sunset, ticks), text: hm(ticks.sunset), anchor: 'middle' },
    { pos: 1, text: hm(ticks.nextSunrise), anchor: 'end' },
  ];
}
