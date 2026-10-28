// "Today's lesson" row on Today for the Learn intent (design.md 3; C03): the first lesson not yet marked done, as a 44 dp
// NavRow into the reader. When every lesson is done the row says so and opens the Learn tab. Nothing is interpretive here,
// so it is a NavRow, not a Row with a ruleId.
import { loadLessons } from '@shubhvela/content';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Card } from '../components/Card';
import { NavRow } from '../components/ListRows';
import { useLang } from '../i18n';
import { doneLessonIds } from './progress';

export function TodayLessonRow({ testID }: { testID?: string }) {
  const { t, lang } = useLang();
  const router = useRouter();
  const [done, setDone] = useState<Set<string>>(() => doneLessonIds());
  useFocusEffect(
    useCallback(() => {
      setDone(doneLessonIds());
    }, []),
  );
  const items = loadLessons(lang).items;
  const next = items.find((l) => !done.has(l.id)) ?? null;
  return (
    <Card flush testID={testID}>
      {next ? (
        <NavRow title={t('today.lessonRow')} value={t('learn.lessonNumber', { n: next.n })} caption={next.title} onPress={() => router.push(`/learn/lesson/${next.id}`)} divider={false} testID="today-lesson-row" />
      ) : (
        <NavRow title={t('today.lessonRow')} caption={t('learn.allDone')} onPress={() => router.push('/(tabs)/learn')} divider={false} testID="today-lesson-row" />
      )}
    </Card>
  );
}
