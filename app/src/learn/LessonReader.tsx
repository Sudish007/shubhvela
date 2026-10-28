// LessonReader (F32, design.md 10.7): Tiro title (Screen display 26/32), body at 17/26 (28 for Devanagari) with the
// reader's own chart values interpolated - Latin/digit runs set in Noto Sans tabular inside Devanagari text (N19) -
// a "Try it on your chart" row that opens the lesson's card, "Terms in this lesson" rows to the glossary pages, and
// "Mark done" (48 dp) -> lessons_done -> deeper Why? text (src/learn/progress). Route LessonReader is NOT on the banner
// allow-list, so Screen never draws a strip here (F38, N11). Draft text is labelled as draft.
import { glossaryTerm, interpolate, lesson as loadLesson, lessonPlaceholders, loadLessons, type Lesson, type LessonValues, type TranslationParams } from '@shubhvela/content';
import { useRouter } from 'expo-router';
import { Fragment, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PrimaryButton, TextButton } from '../components/Button';
import { Card } from '../components/Card';
import { ChevronIcon } from '../components/icons';
import { NavRow } from '../components/ListRows';
import { InlineNotice } from '../components/Notices';
import { Num } from '../components/Num';
import { Pressable44 } from '../components/Pressable44';
import { Screen } from '../components/Screen';
import { Tag } from '../components/Tag';
import { Txt } from '../components/Txt';
import { getSelfProfile } from '../db/profiles';
import { lessonDoneAt, markLessonDone, unmarkLessonDone } from '../db/lessonsDone';
import { chartFor } from '../engine-bridge/charts';
import { useLang, type Lang } from '../i18n';
import { useTokens } from '../theme/ThemeProvider';
import { fmtDate } from '../today/format';
import { num, richSegments, type RichParams, type RichSegment } from '../today/RichText';
import { lessonValues } from './placeholders';
import { unlockedLevel } from './progress';

export interface LessonReaderProps {
  /** Lesson id (`lesson-01`). */
  id: string;
  /** Clock for tests. */
  now?: () => number;
}

/** Latin letters or digits inside a Devanagari sentence get the Noto Sans tabular face; in English only digit runs do. */
export function lessonSegments(paragraph: string, values: LessonValues, lang: Lang): RichSegment[] {
  const params: RichParams = {};
  for (const [k, v] of Object.entries(values)) {
    if (v === undefined) continue;
    const s = String(v);
    params[k] = lang !== 'en' && /[A-Za-z0-9]/.test(s) ? num(s) : s;
  }
  return richSegments((p: TranslationParams) => interpolate(paragraph, p), params);
}

export default function LessonReader({ id, now }: LessonReaderProps) {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  const router = useRouter();
  const [nowMs] = useState(() => (now ? now() : Date.now()));
  const resolved = loadLesson(id, lang);
  const [doneAt, setDoneAt] = useState<string | null>(() => lessonDoneAt(id));
  const [justUnlocked, setJustUnlocked] = useState<number | null>(null);
  const self = getSelfProfile();
  // Values are computed once per mount for the placeholders this lesson uses (the reader is a pushed screen).
  const [values] = useState<LessonValues>(() => {
    if (!resolved || !self) return {};
    try {
      return lessonValues({ profile: self, chart: chartFor(self), nowMs, lang, t }, lessonPlaceholders(resolved.item));
    } catch (e) {
      if (__DEV__) console.warn('lesson values failed', e);
      return {};
    }
  });

  if (!resolved) {
    return (
      <Screen title={t('learn.title')} chrome="stack" route="LessonReader" testID="lesson-reader">
        <Txt kind="body" color="ink2">
          {t('errors.generic')}
        </Txt>
      </Screen>
    );
  }
  const l: Lesson = resolved.item;
  const all = loadLessons(lang).items;
  const index = all.findIndex((x) => x.id === l.id);
  const prev = index > 0 ? all[index - 1] : null;
  const next = index >= 0 && index + 1 < all.length ? all[index + 1] : null;
  const tz = self?.tz ?? 'UTC';

  const onMarkDone = () => {
    const before = unlockedLevel();
    const at = markLessonDone(l.id, new Date(nowMs));
    setDoneAt(at);
    const after = unlockedLevel();
    setJustUnlocked(after > before ? after : null);
  };
  const onUnmark = () => {
    unmarkLessonDone(l.id);
    setDoneAt(null);
    setJustUnlocked(null);
  };

  const subtitle = (
    <View style={styles.subtitle}>
      <Txt kind="label" weight={400} color="ink2" testID="lesson-meta">
        <Num kind="label" weight={400} color="ink2">
          {t('learn.lessonNumber', { n: l.n })}
        </Num>
        {' · '}
        <Num kind="label" weight={400} color="ink2">
          {t('lesson.readingTime', { minutes: l.minutes })}
        </Num>
      </Txt>
      {self ? (
        <Txt kind="caption" color="ink3" testID="lesson-values-from">
          {t('lesson.valuesFrom', { name: self.name ?? t('family.relation.self') })}
        </Txt>
      ) : null}
    </View>
  );

  return (
    <Screen title={l.title} chrome="stack" route="LessonReader" subtitle={subtitle} testID="lesson-reader">
      {!self ? <InlineNotice>{t('learn.noProfile')}</InlineNotice> : null}
      {l.review === 'draft' ? (
        <View style={styles.tagRow} testID="lesson-draft">
          <Tag variant="kind" accessibilityLabel={t('lesson.draft')}>
            {t('lesson.draft')}
          </Tag>
        </View>
      ) : null}
      <Card testID="lesson-body">
        <View style={styles.body}>
          {l.body.map((para, i) => (
            <Txt key={i} kind="body" testID={`lesson-para-${i + 1}`}>
              {lessonSegments(para, values, lang).map((s, j) =>
                s.num ? (
                  <Num key={j} kind="body">
                    {s.text}
                  </Num>
                ) : (
                  <Fragment key={j}>{s.text}</Fragment>
                ),
              )}
            </Txt>
          ))}
        </View>
      </Card>

      <Card flush testID="lesson-try">
        <NavRow title={t('lesson.tryIt')} caption={t('lesson.tryItOpens', { card: t(l.tryIt.label) })} onPress={() => router.push(l.tryIt.route)} divider={false} testID="lesson-try-row" />
      </Card>

      {l.terms.length ? (
        <Card flush testID="lesson-terms">
          <View style={styles.termsHead}>
            <Txt kind="label" weight={600} color="ink2">
              {t('lesson.terms')}
            </Txt>
          </View>
          {l.terms.map((termId, i) => {
            const g = glossaryTerm(termId, lang)?.item;
            if (!g) return null;
            return (
              <Pressable44
                key={termId}
                accessibilityLabel={`${g.term_lat}, ${g.meaning}`}
                onPress={() => router.push(`/learn/glossary/${termId}`)}
                style={[styles.termRow, i < l.terms.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hair }]}
                testID={`lesson-term-${termId}`}
              >
                <View style={styles.termText}>
                  <Txt kind="label" weight={600}>
                    {g.term_dev}
                    {' '}
                    <Num kind="label" weight={400} color="ink2">
                      {g.term_lat}
                    </Num>
                  </Txt>
                  <Txt kind="caption" color="ink3">
                    {g.meaning}
                  </Txt>
                </View>
                <ChevronIcon color={colors.ink3} />
              </Pressable44>
            );
          })}
        </Card>
      ) : null}

      <Card testID="lesson-done-card">
        {doneAt ? (
          <View style={styles.doneBlock}>
            <Txt kind="label" weight={600} color="accent" testID="lesson-done-on">
              {t('lesson.markedDone', { date: fmtDate(Date.parse(doneAt), tz, lang) })}
            </Txt>
            {justUnlocked ? (
              <View testID="lesson-unlocked">
                <InlineNotice>{`${t('lesson.unlocked')} ${t('lesson.unlockedBody', { level: justUnlocked })}`}</InlineNotice>
              </View>
            ) : null}
            <TextButton label={t('lesson.undo')} onPress={onUnmark} style={styles.undo} testID="lesson-undo" />
          </View>
        ) : (
          <View style={styles.doneBlock}>
            <Txt kind="caption" color="ink3" testID="lesson-unlocks">
              {t('lesson.unlocksLevel', { level: l.unlocksLevel })}
            </Txt>
            <PrimaryButton label={t('lesson.markDone')} onPress={onMarkDone} testID="lesson-mark-done" />
          </View>
        )}
      </Card>

      {prev || next ? (
        <Card flush testID="lesson-nav">
          {prev ? <NavRow title={t('lesson.previous')} value={prev.title} onPress={() => router.push(`/learn/lesson/${prev.id}`)} divider={!!next} testID="lesson-prev" /> : null}
          {next ? <NavRow title={t('lesson.next')} value={next.title} onPress={() => router.push(`/learn/lesson/${next.id}`)} divider={false} testID="lesson-next" /> : null}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { gap: 2 },
  tagRow: { flexDirection: 'row' },
  body: { gap: 16 },
  termsHead: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  termRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 16, alignSelf: 'stretch', justifyContent: 'flex-start' },
  termText: { flex: 1, minWidth: 0, gap: 2 },
  doneBlock: { gap: 12 },
  undo: { alignSelf: 'flex-start' },
});
