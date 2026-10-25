// Num / Latin / NoBreak (N4, N19): digit and Latin runs inside Devanagari text are set in Noto Sans with tabular
// numerals so times, dates, degrees and Latin terms line up; NoBreak keeps a time range or a "nakshatra pada" pair on
// one line by replacing every space with U+00A0 and gluing dashes/slashes with U+2060 (word joiner).
import { Txt, type TxtProps } from './Txt';

export function Num(props: TxtProps) {
  return <Txt {...props} latin tabular />;
}

export function Latin(props: TxtProps) {
  return <Txt {...props} latin />;
}

const NBSP = '\u00A0';
const WORD_JOINER = '\u2060';

/** Pure helper (tested): no breakable whitespace and no break opportunity around - / – / /. */
export function noBreak(text: string): string {
  return text.replace(/\s+/g, NBSP).replace(/([-\u2013\u2014/])/g, `${WORD_JOINER}$1${WORD_JOINER}`);
}

export interface NoBreakProps extends Omit<TxtProps, 'children'> {
  children: string;
  /** Digit-heavy content (time ranges) is set with Num; nakshatra+pada pairs keep the language face unless `numeric`. */
  numeric?: boolean;
}

export function NoBreak({ children, numeric, ...rest }: NoBreakProps) {
  const text = noBreak(children);
  return numeric ? <Num {...rest}>{text}</Num> : <Txt {...rest}>{text}</Txt>;
}
