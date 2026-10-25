// Now line (design.md 10.2): "Now <time> · <verdict> · <choghadiya> choghadiya · <hora> hora · next: <segment> <time>
// (<verdict>)" read from engine.at(); its 44 dp "Why?" opens the rule sheet of the current span (which kaal /
// choghadiya / muhurta applies, the weekday and sunrise inputs). The line always carries the text, so the band's
// inline labels may hide at 1.3x without losing information.
import { at, type GoodHours, type NowState } from '@shubhvela/engine';
import { Row } from '../components/Row';
import type { WhyInputValue } from '../components/WhySheet';
import { useLang, type Lang, type TFn } from '../i18n';
import { fmtTime, planetName, segmentName, segmentNameById, verdictTag, verdictWord, weekdayName } from './format';
import { num, richPlain, RichText, type RichParams } from './RichText';

export interface NowLineProps {
  gh: GoodHours;
  nowMs: number;
  testID?: string;
}

/** Template key + params of the Now line (shared by the component and its accessible name). */
export function nowLineParams(gh: GoodHours, state: NowState, nowMs: number, t: TFn, lang: Lang): { key: string; params: RichParams } {
  const tz = gh.tz;
  const chog = state.choghadiya?.choghadiya ? t(`band.chog.${state.choghadiya.choghadiya.toLowerCase()}`) : t('common.unknown');
  const hora = state.hora ? planetName(lang, state.hora.lord) : t('common.unknown');
  const base: RichParams = { time: num(fmtTime(nowMs, tz)), verdict: verdictWord(t, state.span.verdict), choghadiya: chog, hora };
  if (!state.next) return { key: 'today.nowLineNoNext', params: base };
  // The segment that starts the next span: prefer one whose own nature is the next verdict (the cause), else the first.
  const starting = state.next.starting.map((id) => gh.segments.find((s) => s.id === id)).filter((s) => !!s);
  const nextVerdict = state.next.verdict;
  const cause = starting.find((s) => s.nature === nextVerdict) ?? starting[0];
  const nextName = cause ? segmentName(t, cause) : verdictWord(t, nextVerdict);
  return { key: 'today.nowLine', params: { ...base, next: nextName, at: num(fmtTime(state.next.at, tz)), nextVerdict: verdictTag(t, nextVerdict) } };
}

/** Why? inputs for the current span: the applicable kaal/choghadiya/muhurta rows, weekday and sunrise/sunset. */
export function nowInputs(gh: GoodHours, state: NowState, t: TFn, lang: Lang): Record<string, WhyInputValue> {
  const tz = gh.tz;
  const ticks = gh.ticks;
  return {
    [t('today.appliesNow')]: state.segments.map((id) => segmentNameById(t, gh, id)).join(', '),
    [t('today.timeRange')]: `${fmtTime(state.span.start, tz)}–${fmtTime(state.span.end, tz)}`,
    [t('panchang.vara')]: weekdayName(lang, gh.vara),
    [t('band.sunrise')]: ticks ? fmtTime(ticks.sunrise, tz) : null,
    [t('band.sunset')]: ticks ? fmtTime(ticks.sunset, tz) : null,
    [t('today.horaLabel')]: state.hora ? `${planetName(lang, state.hora.lord)} ${fmtTime(state.hora.start, tz)}–${fmtTime(state.hora.end, tz)}` : null,
  };
}

/** The rule behind the current verdict: the first deciding segment of the span (an avoid/good cause or Chal). */
export function nowRuleId(gh: GoodHours, state: NowState): string {
  const cause = state.span.reasons.map((id) => gh.segments.find((s) => s.id === id)).find((s) => !!s);
  return cause?.ruleId ?? state.choghadiya?.ruleId ?? 'choghadiya-chal';
}

export function NowLine({ gh, nowMs, testID }: NowLineProps) {
  const { t, lang } = useLang();
  const state = at(gh, nowMs);
  if (!state) return null;
  const { key, params } = nowLineParams(gh, state, nowMs, t, lang);
  const text = richPlain(t, key, params);
  return (
    <Row ruleId={nowRuleId(gh, state)} text={text} inputs={nowInputs(gh, state, t, lang)} glossary={['choghadiya', 'hora']} divider={false} testID={testID}>
      <RichText k={key} params={params} kind="label" weight={400} testID="now-line-text" />
    </Row>
  );
}
