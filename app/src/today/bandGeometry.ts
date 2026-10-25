// Pure band geometry (tested): minutes -> x via the engine's bandPosition (day 75 % / night 25 %), label visibility
// via the engine's labelFor (N3: hidden under 60 dp x fontScale, reason names only when every reason is that wide),
// and the accessibility text alternative generated from the same merged spans (design.md 8).
import { bandPosition, labelFor, type GoodHours, type GoodHoursSpan, type GoodHoursTicks } from '@shubhvela/engine';
import type { TFn } from '../i18n';
import { fmtTime, segmentNameById, verdictBandLabel, verdictWord } from './format';

export interface SpanRect {
  span: GoodHoursSpan;
  x: number;
  w: number;
}

/** Pixel rectangles of the merged spans across a band of `width` dp. */
export function spanRects(gh: Pick<GoodHours, 'spans' | 'ticks'>, width: number): SpanRect[] {
  const ticks = gh.ticks;
  if (!ticks) return [];
  return gh.spans.map((span) => {
    const x0 = bandPosition(span.start, ticks) * width;
    const x1 = bandPosition(span.end, ticks) * width;
    return { span, x: x0, w: Math.max(0, x1 - x0) };
  });
}

/** x of an instant on the band (clamped to the band). */
export function markerX(utcMs: number, ticks: GoodHoursTicks, width: number): number {
  return bandPosition(utcMs, ticks) * width;
}

export interface BandLabel {
  x: number;
  w: number;
  text: string;
  span: GoodHoursSpan;
}

/** Inline labels to draw: engine labelFor decides visibility and whether reason names or the verdict word show. */
export function bandLabels(gh: Pick<GoodHours, 'spans' | 'ticks' | 'segments'>, width: number, fontScale: number, t: TFn): BandLabel[] {
  const out: BandLabel[] = [];
  for (const r of spanRects(gh, width)) {
    const label = labelFor(r.span, gh, width, fontScale);
    if (!label) continue;
    const text = label.kind === 'reasons' ? label.segments.map((id) => segmentNameById(t, gh, id)).join(' · ') : verdictBandLabel(t, label.verdict);
    out.push({ x: r.x, w: r.w, text, span: r.span });
  }
  return out;
}

/** The four tick labels (sunrise, local noon, sunset, next sunrise) with their x positions. */
export function tickMarks(ticks: GoodHoursTicks, width: number, tz: string): { x: number; text: string; align: 'left' | 'center' | 'right' }[] {
  return [
    { x: 0, text: fmtTime(ticks.sunrise, tz), align: 'left' },
    { x: markerX(ticks.noon, ticks, width), text: fmtTime(ticks.noon, tz), align: 'center' },
    { x: markerX(ticks.sunset, ticks, width), text: fmtTime(ticks.sunset, tz), align: 'center' },
    { x: width, text: fmtTime(ticks.nextSunrise, tz), align: 'right' },
  ];
}

/** Spans shorter than a minute exist at Brahma/choghadiya boundaries; they are drawn but left out of the spoken text. */
const A11Y_MIN_MS = 60_000;

/** "Good hours band. Avoid 06:27 to 10:40 (Yamaganda, Rog, Gulika). ... Night: ... Now 10:58. Flags: ...". */
export function bandA11yText(gh: GoodHours, nowMs: number, t: TFn, flagsText: string | null): string {
  const tz = gh.tz;
  const parts: string[] = [];
  let nightStarted = false;
  for (const span of gh.spans) {
    if (span.end - span.start < A11Y_MIN_MS) continue;
    if (span.night && !nightStarted) {
      parts.push(t('today.bandA11yNight'));
      nightStarted = true;
    }
    const reasons = span.reasons.map((id) => segmentNameById(t, gh, id)).join(', ');
    const p = { verdict: verdictWord(t, span.verdict), from: fmtTime(span.start, tz), to: fmtTime(span.end, tz), reasons };
    parts.push(reasons ? t('today.bandA11ySpan', p) : t('today.bandA11ySpanPlain', p));
  }
  const spans = parts.join(' ');
  const time = fmtTime(nowMs, tz);
  return flagsText ? t('today.bandA11y', { spans, time, flags: flagsText }) : t('today.bandA11yNoFlags', { spans, time });
}
