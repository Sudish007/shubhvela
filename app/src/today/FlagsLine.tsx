// Flags line (F27, design.md 6/10.2): Bhadra and Panchak are TEXT, never a colour or an outline on the band or the
// list. "Flags · Panchak till <day time> · Bhadra on earth <from>–<to>: no new beginnings". Times on another civil
// day carry the weekday and date; ranges are glued (N4).
import type { GoodHours } from '@shubhvela/engine';
import { useLang, type Lang, type TFn } from '../i18n';
import { fmtTimeOrDayTime, glueRanges } from './format';
import { RichText } from './RichText';

/** The flag sentences of the day, or an empty list. */
export function flagSentences(gh: GoodHours, t: TFn, lang: Lang): string[] {
  const tz = gh.tz;
  const out: string[] = [];
  const f = gh.flags;
  if (f.panchak) out.push(t('today.flagPanchak', { until: fmtTimeOrDayTime(f.panchak.end, tz, lang, gh.day) }));
  if (f.bhadra) {
    const key = f.bhadra.location === 'earth' ? 'today.flagBhadraEarth' : f.bhadra.location === 'heaven' ? 'today.flagBhadraHeaven' : 'today.flagBhadraPatal';
    out.push(glueRanges(t(key, { from: fmtTimeOrDayTime(f.bhadra.start, tz, lang, gh.day), to: fmtTimeOrDayTime(f.bhadra.end, tz, lang, gh.day) })));
  }
  return out;
}

/** "Panchak till … · Bhadra on earth …" or null when the day has no flag (the line then reads "No flags today"). */
export function flagsText(gh: GoodHours, t: TFn, lang: Lang): string | null {
  const parts = flagSentences(gh, t, lang);
  return parts.length ? parts.join(' · ') : null;
}

export function FlagsLine({ gh, testID }: { gh: GoodHours; testID?: string }) {
  const { t, lang } = useLang();
  const text = flagsText(gh, t, lang);
  return <RichText kind="label" weight={400} color="ink2" text={text ? `${t('today.flags')} · ${text}` : t('today.noFlags')} testID={testID} />;
}
