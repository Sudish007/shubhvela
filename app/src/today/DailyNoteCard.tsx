// F6 daily note (design.md 10.2): card "Your day, {name}" with the engine's rows in their fixed order (Chandra bala ->
// Tara bala -> tithi/nakshatra (+ Bhadra/Panchak) -> Sade Sati/Dhaiya -> dasha lords). Each row is a Row (ruleId
// required) whose sentence is the corpus fragment(s) of the row's keys with the engine params interpolated, and whose
// "Why?" shows the rule, the inputs with values and the source. Footer: "Guidance for reflection ... Not a prediction."
// F10 (C01): the title row carries a 44 dp "Listen" text button that toggles to "Stop" while expo-speech reads the rows'
// sentences in the UI language (useListen: en-IN/hi-IN voice lookup, Bhojpuri -> Hindi voice with a one-time toast). When no
// voice is installed an inline notice says so and offers the Android text-to-speech settings - nothing is faked.
// Corpus language: the content package resolves bho -> hi -> en per id (carry-over A-INFO-1); the chrome stays in the
// UI language and the resolved snippet is shown as is, without a badge.
import { interpolate, lookup, type TranslationParams } from '@shubhvela/content';
import type { DailyRule, RuleParam } from '@shubhvela/engine';
import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';
import { TextButton } from '../components/Button';
import { Card } from '../components/Card';
import { InlineNotice } from '../components/Notices';
import { Latin, Num } from '../components/Num';
import { Row } from '../components/Row';
import { Txt } from '../components/Txt';
import type { WhyInputValue } from '../components/WhySheet';
import { useLang, type Lang, type TFn } from '../i18n';
import { useListen, type SpeechDeps } from '../tts/useListen';
import { fmtDate, fmtTime, fmtTimeOrDayTime, nakshatraName, ordinal, planetName, signName, tithiName, weekdayName } from './format';
import { num, RichText, richSegments, type RichParams } from './RichText';

export interface DailyNoteCardProps {
  rows: DailyRule[];
  name: string | null;
  /** Civil date shown (for same-day vs other-day time formatting). */
  day: string;
  tz: string;
  /** Speech bridge override for tests (production: expo-speech). */
  speech?: SpeechDeps;
  testID?: string;
}

/** Fragment text for a daily key: the daily corpus, else the dasha-pairs corpus (dasha-<Maha>-<Antar> ids). */
export function fragmentText(key: string, lang: Lang): string | null {
  return lookup('daily', key, lang)?.text ?? lookup('dasha-pairs', key, lang)?.text ?? null;
}

const SADE_SATI_EVENT_KEYS = ['sadesati-start', 'sadesati-phase', 'sadesati-end', 'dhaiya-start', 'dhaiya-end'];

/** Engine params -> display values for the fragment placeholders (times, dates, ordinals, event names). */
export function fragmentParams(rule: DailyRule, tz: string, day: string, t: TFn, lang: Lang): RichParams {
  const out: RichParams = {};
  for (const [k, v] of Object.entries(rule.params)) {
    if (v === null || v === undefined || Array.isArray(v)) continue;
    if (typeof v === 'number') {
      if (/(Start|End|EndsAt)$/.test(k)) out[k] = num(fmtTimeOrDayTime(v, tz, lang, day));
      else if (k === 'since' || k === 'until' || k === 'nextAt' || k === 'mahaEnd' || k === 'antarEnd') out[k] = num(fmtDate(v, tz, lang));
      else if (k === 'saturnHouseFromMoon' || k === 'house' || k === 'nextHouse') out[k] = num(ordinal(v, lang));
      else out[k] = num(v);
    } else if (typeof v === 'string') {
      out[k] = k === 'nextKind' && SADE_SATI_EVENT_KEYS.includes(v) ? t(`sadesati.event.${v}`) : v;
    } else out[k] = v ? t('common.yes') : t('common.no');
  }
  return out;
}

/** Why? inputs for a row: every engine param in display form (sign and nakshatra numbers named, planets named). */
export function ruleInputs(rule: DailyRule, tz: string, day: string, t: TFn, lang: Lang): Record<string, WhyInputValue> {
  const out: Record<string, WhyInputValue> = {};
  const fmt = (k: string, v: RuleParam): WhyInputValue => {
    if (v === null || v === undefined) return null;
    if (Array.isArray(v)) return v.map((w) => `${fmtTime(w.start, tz)}–${fmtTime(w.end, tz)}`).join(', ');
    if (typeof v === 'boolean') return v ? t('common.yes') : t('common.no');
    if (typeof v === 'number') {
      if (/(Start|End|EndsAt)$/.test(k)) return fmtTimeOrDayTime(v, tz, lang, day);
      if (k === 'since' || k === 'until' || k === 'nextAt' || k === 'mahaEnd' || k === 'antarEnd') return fmtDate(v, tz, lang);
      if (/Sign$/.test(k)) return signName(lang, v);
      if (/Nakshatra$/.test(k) || k === 'nakshatra') return nakshatraName(lang, v);
      if (k === 'vara') return weekdayName(lang, v);
      if (k === 'tithi' && rule.ruleId === 'day-tithi-nakshatra') return tithiName(lang, v - 1 + (rule.params.paksha === 'krishna' ? 15 : 0));
      return v;
    }
    if (['maha', 'antar', 'pratyantar', 'varaLord'].includes(k)) return planetName(lang, v as 'Su');
    if (k === 'nextKind' && SADE_SATI_EVENT_KEYS.includes(v)) return t(`sadesati.event.${v}`);
    return v;
  };
  for (const [k, v] of Object.entries(rule.params)) {
    const d = fmt(k, v);
    if (d !== null && d !== undefined && d !== '') out[k] = d;
  }
  return out;
}

/** Sentence of a row: its fragments in key order, params interpolated, numeric runs tagged for Num. */
export function rowSegments(rule: DailyRule, tz: string, day: string, t: TFn, lang: Lang): { text: string; num: boolean }[] {
  const params = fragmentParams(rule, tz, day, t, lang);
  const out: { text: string; num: boolean }[] = [];
  for (const key of rule.keys) {
    const text = fragmentText(key, lang);
    if (!text) continue;
    if (out.length) out.push({ text: ' ', num: false });
    out.push(...richSegments((p: TranslationParams) => interpolate(text, p), params));
  }
  return out;
}

/** Caption under a row from the engine's own params: house/tara names, dasha pair + end date. */
export function rowCaption(rule: DailyRule, tz: string, t: TFn, lang: Lang): string | null {
  const p = rule.params;
  switch (rule.ruleId) {
    case 'chandra-bala': {
      const base = t('note.houseFromMoon', { house: ordinal(p.house as number, lang) });
      return typeof p.moonSignEndsAt === 'number' ? `${base} · ${t('common.till', { time: fmtTime(p.moonSignEndsAt, tz) })}` : base;
    }
    case 'tara-bala': {
      const base = t('note.taraName', { tara: t(`note.tara.${p.taraKey as string}`) });
      return typeof p.nakshatraEndsAt === 'number' ? `${base} · ${t('common.till', { time: fmtTime(p.nakshatraEndsAt, tz) })}` : base;
    }
    case 'dasha-lords': {
      const pair = t('dasha.pair', { maha: planetName(lang, p.maha as 'Su'), antar: planetName(lang, p.antar as 'Su') });
      return typeof p.antarEnd === 'number' ? `${pair} · ${t('dasha.changeOn', { date: fmtDate(p.antarEnd, tz, lang) })}` : pair;
    }
    default:
      return null;
  }
}

/** The spoken text of the note: every row's sentence in the UI language, in row order (same text the rows display). */
export function noteSentences(rows: readonly DailyRule[], tz: string, day: string, t: TFn, lang: Lang): string[] {
  return rows.map((rule) =>
    rowSegments(rule, tz, day, t, lang)
      .map((s) => s.text)
      .join(''),
  );
}

export function DailyNoteCard({ rows, name, day, tz, speech, testID }: DailyNoteCardProps) {
  const { t, lang } = useLang();
  const sentences = noteSentences(rows, tz, day, t, lang);
  const listen = useListen(sentences, lang, { deps: speech, hindiVoiceToast: t('tts.hindiVoice') });
  // The Latin name run inside a Devanagari title (N19): split the template around {name}.
  const MARK = '\u0000';
  const [before = '', after = ''] = name ? t('today.yourDay', { name: MARK }).split(MARK) : [t('today.yourDayNoName'), ''];
  const speaking = listen.status === 'speaking';
  return (
    <Card testID={testID}>
      <View style={styles.titleRow}>
        <Txt kind="heading" accessibilityRole="header" style={styles.title} testID="note-title">
          {before}
          {name ? <Latin kind="heading">{name}</Latin> : null}
          {after}
        </Txt>
        {rows.length ? (
          <TextButton
            label={speaking ? t('tts.stop') : t('tts.listen')}
            accessibilityLabel={speaking ? t('tts.stop') : t('tts.listen')}
            onPress={() => void listen.toggle()}
            testID="note-listen"
          />
        ) : null}
      </View>
      {listen.status === 'noVoice' ? (
        <View style={styles.notice} testID="note-tts-notice">
          <InlineNotice>{t('errors.tts', { language: t(`tts.language.${lang}`) })}</InlineNotice>
          <TextButton label={t('tts.openSettings')} onPress={() => void listen.openTtsSettings()} style={styles.noticeAction} testID="note-tts-settings" />
        </View>
      ) : null}
      {listen.status === 'error' ? (
        <View style={styles.notice} testID="note-tts-error">
          <InlineNotice tone="error">{t('tts.failed')}</InlineNotice>
          {/* C-REVIEW-MEDIUM-3: a synthesis failure (e.g. an advertised but uninstalled hi-IN voice) needs the same path to the
              voice-data settings as the no-voice case (design.md 11 "TTS: notice + link"). */}
          <TextButton label={t('tts.openSettings')} onPress={() => void listen.openTtsSettings()} style={styles.noticeAction} testID="note-tts-error-settings" />
        </View>
      ) : null}
      <View style={styles.rows}>
        {rows.map((rule, i) => {
          const segments = rowSegments(rule, tz, day, t, lang);
          const plain = segments.map((s) => s.text).join('');
          const caption = rowCaption(rule, tz, t, lang);
          return (
            <Row
              key={rule.ruleId}
              ruleId={rule.ruleId}
              text={plain}
              inputs={ruleInputs(rule, tz, day, t, lang)}
              glossary={rule.keys.filter((k) => /^(tithi|nakshatra|vara)-\d+$/.test(k) === false)}
              divider={i < rows.length - 1}
              caption={caption ? <RichText kind="caption" color="ink3" text={caption} /> : undefined}
              testID={`note-row-${rule.ruleId}`}
            >
              <Txt kind="body" testID={`note-text-${rule.ruleId}`}>
                {segments.map((s, j) =>
                  s.num ? (
                    <Num key={j} kind="body">
                      {s.text}
                    </Num>
                  ) : (
                    <Fragment key={j}>{s.text}</Fragment>
                  ),
                )}
              </Txt>
            </Row>
          );
        })}
      </View>
      <Txt kind="caption" color="ink3" style={styles.footer} testID="note-footer">
        {t('today.noteFooter')}
      </Txt>
    </Card>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, minWidth: 0 },
  notice: { marginTop: 8, gap: 4 },
  noticeAction: { alignSelf: 'flex-start' },
  rows: { marginTop: 8 },
  footer: { marginTop: 12 },
});
