// LessonCard (F32, design.md 10.7): one 44 dp+ row per lesson - number, title, "5 min" and a tick when done. The tick is a
// glyph AND the word "Done" for TalkBack (colour is never the only carrier). Rows live inside a flush Card and draw their
// own hairline divider.
import type { Lesson } from '@shubhvela/content';
import { StyleSheet, View } from 'react-native';
import { CheckIcon } from '../components/icons';
import { Num } from '../components/Num';
import { Pressable44 } from '../components/Pressable44';
import { Txt } from '../components/Txt';
import { useLang } from '../i18n';
import { useTokens } from '../theme/ThemeProvider';

export interface LessonCardProps {
  lesson: Lesson;
  done: boolean;
  onPress: () => void;
  divider?: boolean;
  testID?: string;
}

export function LessonCard({ lesson, done, onPress, divider = true, testID }: LessonCardProps) {
  const { t } = useLang();
  const { colors } = useTokens();
  const minutes = t('learn.minutes', { minutes: lesson.minutes });
  const state = t(done ? 'learn.done' : 'learn.notDone');
  return (
    <Pressable44
      testID={testID}
      accessibilityLabel={t('learn.lessonA11y', { n: lesson.n, title: lesson.title, minutes: lesson.minutes, state })}
      accessibilityState={{ checked: done }}
      onPress={onPress}
      style={[styles.row, divider && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hair }]}
    >
      <View style={[styles.number, { borderColor: done ? colors.accent : colors.hair2, backgroundColor: done ? colors.accentTint : colors.surface }]}>
        <Num kind="label" weight={600} color={done ? 'accent' : 'ink2'} testID={testID ? `${testID}-n` : undefined}>
          {String(lesson.n)}
        </Num>
      </View>
      <View style={styles.text}>
        <Txt kind="body" weight={600} testID={testID ? `${testID}-title` : undefined}>
          {lesson.title}
        </Txt>
        <View style={styles.metaRow}>
          <Num kind="caption" color="ink3">
            {minutes}
          </Num>
          {done ? (
            <View style={styles.doneRow} testID={testID ? `${testID}-done` : undefined}>
              <CheckIcon color={colors.accent} size={16} />
              <Txt kind="caption" color="accent" weight={600}>
                {t('learn.done')}
              </Txt>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable44>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 16, alignSelf: 'stretch', justifyContent: 'flex-start' },
  number: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0, gap: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
