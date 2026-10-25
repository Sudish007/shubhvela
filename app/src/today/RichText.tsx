// RichText: a translated template (or a ready string) whose digit runs - times, dates, ranges, counts - render as Num
// runs inside the sentence (N19: Latin digits in Noto Sans with tabular numerals inside Devanagari text) and whose
// "{from}–{to}" pairs are merged into ONE unbreakable run (N4: time ranges never split). Everything else is the plain
// Txt in the language face.
import type { ReactNode } from 'react';
import type { TranslationParams } from '@shubhvela/content';
import { Num, noBreak } from '../components/Num';
import { Txt, type TxtProps } from '../components/Txt';
import { useLang } from '../i18n';
import { EN_DASH } from './format';

/** Marks a param as a digit/Latin run to be set in Num. */
export interface NumParam {
  num: string;
}
export const num = (v: string | number): NumParam => ({ num: String(v) });
export type RichParam = string | number | boolean | null | undefined | NumParam;
export type RichParams = Record<string, RichParam>;
export interface RichSegment {
  text: string;
  num: boolean;
}

const MARK = '\u0000';
/** A digit run, including the glue of a time range (U+2060, dashes), ":" and "." inside times and dates. */
const DIGIT_RUN = /(\d[\d:.\u2060\u2013\u2014-]*\d|\d)/;

function isNum(v: RichParam): v is NumParam {
  return typeof v === 'object' && v !== null && 'num' in v;
}

/** Splits plain segments at digit runs so every number is a Num run (exported for tests). */
export function splitDigits(segments: RichSegment[]): RichSegment[] {
  const out: RichSegment[] = [];
  for (const seg of segments) {
    if (seg.num) {
      out.push(seg);
      continue;
    }
    const parts = seg.text.split(DIGIT_RUN);
    for (let i = 0; i < parts.length; i++) if (parts[i]) out.push({ text: parts[i], num: i % 2 === 1 });
  }
  return out;
}

/** Interpolated segments: strings stay as they are, numeric runs come back tagged. Exported for tests. */
export function richSegments(template: (p: TranslationParams) => string, params: RichParams): RichSegment[] {
  const nums: string[] = [];
  const plain: TranslationParams = {};
  for (const [k, v] of Object.entries(params)) {
    if (isNum(v)) {
      plain[k] = `${MARK}${nums.length}${MARK}`;
      nums.push(v.num);
    } else plain[k] = v;
  }
  let s = template(plain);
  // "{from}–{to}" with two numeric runs -> one glued run "from–to".
  s = s.replace(new RegExp(`${MARK}(\\d+)${MARK}\\s*[\\u2013\\u2014-]\\s*${MARK}(\\d+)${MARK}`, 'g'), (_m, a: string, b: string) => {
    nums.push(noBreak(`${nums[Number(a)]}${EN_DASH}${nums[Number(b)]}`));
    return `${MARK}${nums.length - 1}${MARK}`;
  });
  const out: RichSegment[] = [];
  const pieces = s.split(MARK);
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    if (i % 2 === 1) out.push({ text: nums[Number(piece)] ?? '', num: true });
    else if (piece) out.push({ text: piece, num: false });
  }
  return splitDigits(out);
}

/** Segments of a ready string: digit runs tagged. */
export function textSegments(text: string): RichSegment[] {
  return splitDigits([{ text, num: false }]);
}

export interface RichTextProps extends Omit<TxtProps, 'children'> {
  /** UI string key (with `params`), or ... */
  k?: string;
  params?: RichParams;
  /** ... a ready string whose digit runs are set in Num. */
  text?: string;
}

export function RichText({ k, params = {}, text, ...rest }: RichTextProps) {
  const { t } = useLang();
  const segments = k ? richSegments((p) => t(k, p), params) : textSegments(text ?? '');
  const children: ReactNode[] = segments.map((seg, i) =>
    seg.num ? (
      <Num key={i} kind={rest.kind} weight={rest.weight} color={rest.color}>
        {seg.text}
      </Num>
    ) : (
      seg.text
    ),
  );
  return <Txt {...rest}>{children}</Txt>;
}

/** Plain-string form of the same sentence (accessible names, sheet titles). */
export function richPlain(t: (key: string, p?: TranslationParams) => string, k: string, params: RichParams = {}): string {
  return richSegments((p) => t(k, p), params)
    .map((s) => s.text)
    .join('');
}
