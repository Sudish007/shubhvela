// Learn tab (F32-F34, design.md 10.7; plan C03): the lesson list (number, title, 5 min, done tick) with a progress line
// and a "Continue with lesson n" row, then the Glossary and Journal rows. Route LearnRoot is on the banner allow-list
// (M5); the reader, glossary term pages and the journal are not. Done state is re-read on every focus (the reader marks
// lessons done on a pushed screen). Lesson text arrives from the content package in the first fallback language that has
// it (carry-over A-INFO-1: English until the Hindi batch runs; chrome stays in the UI language, no badge).
import { loadGlossary, loadLessons } from '@shubhvela/content';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, NavRow, Screen, Txt } from '../../src/components';
import { useLang } from '../../src/i18n';
import { LessonCard } from '../../src/learn/LessonCard';
import { doneLessonIds } from '../../src/learn/progress';
import { useProfiles } from '../../src/profiles/useProfiles';
import { RichText } from '../../src/today/RichText';

export default function LearnScreen() {
  const { t, lang } = useLang();
  const router = useRouter();
  const { self } = useProfiles();
  const lessons = loadLessons(lang);
  const glossaryCount = loadGlossary(lang).items.length;
  const [done, setDone] = useState<Set<string>>(() => doneLessonIds());
  useFocusEffect(
    useCallback(() => {
      setDone(doneLessonIds());
    }, []),
  );
  const items = lessons.items;
  const doneCount = items.filter((l) => done.has(l.id)).length;
  const next = items.find((l) => !done.has(l.id)) ?? null;

  return (
    <Screen title={t('learn.title')} route="LearnRoot" testID="learn-screen">
      <Card flush testID="learn-tools">
        <NavRow title={t('learn.glossaryRow')} caption={t('learn.glossaryRowBody', { count: glossaryCount })} onPress={() => router.push('/learn/glossary')} testID="learn-glossary-row" />
        <NavRow title={t('learn.journalRow')} caption={t('learn.journalRowBody')} onPress={() => router.push('/learn/journal')} divider={false} testID="learn-journal-row" />
      </Card>

      <View style={styles.lessonsHead}>
        <Txt kind="heading" accessibilityRole="header">
          {t('learn.lessonsTitle')}
        </Txt>
        <Txt kind="caption" color="ink2">
          {t('learn.lessonsLede')}
        </Txt>
        <RichText kind="caption" color="ink3" k="learn.progress" params={{ done: doneCount, total: items.length }} testID="learn-progress" />
        {!self ? (
          <Txt kind="caption" color="ink2" testID="learn-no-profile">
            {t('learn.noProfile')}
          </Txt>
        ) : null}
      </View>

      <Card flush testID="lesson-list">
        {next ? <NavRow title={t('learn.continue', { n: next.n })} onPress={() => router.push(`/learn/lesson/${next.id}`)} testID="learn-continue" /> : null}
        {!next && items.length ? (
          <View style={styles.allDone} testID="learn-all-done">
            <Txt kind="label" weight={400} color="ink2">
              {t('learn.allDone')}
            </Txt>
          </View>
        ) : null}
        {items.map((l, i) => (
          <LessonCard key={l.id} lesson={l} done={done.has(l.id)} onPress={() => router.push(`/learn/lesson/${l.id}`)} divider={i < items.length - 1} testID={`lesson-${l.id}`} />
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lessonsHead: { gap: 4, marginTop: 4 },
  allDone: { paddingHorizontal: 16, paddingVertical: 10 },
});
