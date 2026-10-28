// JournalToday (F34, design.md 10.7): "How was today?" with the five mood WORDS as chips (Calm · Low · Busy · Bright ·
// Tense; never emoji) and an optional note. An entry is two taps: a chip, then Save. A saved day shows "Saved for <date>"
// with Edit and Remove. Moods are keys in SQLite and words on screen (ui journal.mood.*).
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PrimaryButton, TextButton } from '../components/Button';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { TextField } from '../components/TextField';
import { Txt } from '../components/Txt';
import { deleteJournalEntry, getJournalEntry, MOODS, saveJournalEntry, type JournalEntry, type Mood } from '../db/journal';
import { useLang } from '../i18n';
import { fmtCivilDate } from '../today/format';
import { RichText } from '../today/RichText';

export interface JournalTodayProps {
  /** Civil date (YYYY-MM-DD) in the profile's zone. */
  day: string;
  /** Called after every save or removal so the month grid re-reads. */
  onChange?: (entry: JournalEntry | null) => void;
  testID?: string;
}

export function JournalToday({ day, onChange, testID }: JournalTodayProps) {
  const { t, lang } = useLang();
  const [saved, setSaved] = useState<JournalEntry | null>(() => getJournalEntry(day));
  const [editing, setEditing] = useState<boolean>(() => getJournalEntry(day) === null);
  const [mood, setMood] = useState<Mood | null>(() => getJournalEntry(day)?.mood ?? null);
  const [note, setNote] = useState<string>(() => getJournalEntry(day)?.note ?? '');

  const save = () => {
    const e = saveJournalEntry(day, mood, note);
    setSaved(e);
    setEditing(false);
    onChange?.(e);
  };
  const remove = () => {
    deleteJournalEntry(day);
    setSaved(null);
    setMood(null);
    setNote('');
    setEditing(true);
    onChange?.(null);
  };

  return (
    <Card testID={testID}>
      <Txt kind="heading" accessibilityRole="header">
        {t('journal.howWasToday')}
      </Txt>
      <Txt kind="caption" color="ink3" testID="journal-day">
        {fmtCivilDate(day, lang)}
      </Txt>
      {editing ? (
        <View style={styles.form}>
          <View style={styles.chips} accessibilityRole="radiogroup" testID="journal-moods">
            {MOODS.map((m) => (
              <Chip
                key={m}
                label={t(`journal.mood.${m}`)}
                selected={mood === m}
                onPress={() => setMood(m)}
                accessibilityLabel={t('journal.moodA11y', { mood: t(`journal.mood.${m}`), state: mood === m ? t('common.yes') : t('common.no') })}
                testID={`journal-mood-${m}`}
              />
            ))}
          </View>
          <TextField label={t('journal.noteHint')} placeholder={t('journal.notePlaceholder')} value={note} onChangeText={setNote} multiline testID="journal-note" />
          <PrimaryButton label={t('journal.save')} onPress={save} disabled={!mood && !note.trim()} testID="journal-save" />
        </View>
      ) : (
        <View style={styles.savedBlock} testID="journal-saved">
          <RichText kind="label" weight={600} color="accent" k="journal.saved" params={{ date: fmtCivilDate(day, lang) }} testID="journal-saved-line" />
          <Txt kind="body" testID="journal-saved-mood">
            {saved?.mood ? t(`journal.mood.${saved.mood}`) : t('journal.noMood')}
          </Txt>
          {saved?.note ? (
            <Txt kind="body" color="ink2" testID="journal-saved-note">
              {saved.note}
            </Txt>
          ) : null}
          <View style={styles.actions}>
            <TextButton label={t('journal.edit')} onPress={() => setEditing(true)} testID="journal-edit" />
            <TextButton label={t('journal.clearDay')} onPress={remove} testID="journal-remove" />
          </View>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  form: { marginTop: 8, gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  savedBlock: { marginTop: 8, gap: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
});
