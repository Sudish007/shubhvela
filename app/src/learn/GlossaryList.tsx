// GlossaryList (F33, design.md 10.7): search field + one row per term "term_dev · term_lat · one line" (>= 150 terms from
// packages/content). The filter matches Devanagari, Latin and the meaning, case-insensitively; the list is rendered in
// full (it lives inside the Screen's ScrollView - no nested virtualised list). Route GlossaryList is banner-allow-listed.
import { loadGlossary, type GlossaryEntry } from '@shubhvela/content';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { TextButton } from '../components/Button';
import { Card } from '../components/Card';
import { ChevronIcon } from '../components/icons';
import { Num } from '../components/Num';
import { Pressable44 } from '../components/Pressable44';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { Txt } from '../components/Txt';
import { useLang } from '../i18n';
import { useTokens } from '../theme/ThemeProvider';
import { RichText } from '../today/RichText';

/** Pure filter (tested): empty query = every term; otherwise substring match on the three fields, case-insensitive. */
export function filterGlossary(items: readonly GlossaryEntry[], query: string): GlossaryEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...items];
  return items.filter((g) => g.term_dev.toLowerCase().includes(q) || g.term_lat.toLowerCase().includes(q) || g.meaning.toLowerCase().includes(q) || g.id.includes(q));
}

/** Sorted by the Latin headword (the Devanagari sort order of three scripts is not meaningful to every reader). */
export function sortGlossary(items: readonly GlossaryEntry[]): GlossaryEntry[] {
  return [...items].sort((a, b) => a.term_lat.localeCompare(b.term_lat, 'en'));
}

export interface GlossaryRowProps {
  entry: GlossaryEntry;
  onPress: () => void;
  divider?: boolean;
  testID?: string;
}

export function GlossaryRow({ entry, onPress, divider = true, testID }: GlossaryRowProps) {
  const { colors } = useTokens();
  return (
    <Pressable44
      testID={testID}
      accessibilityLabel={`${entry.term_lat}, ${entry.meaning}`}
      onPress={onPress}
      style={[styles.row, divider && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hair }]}
    >
      <View style={styles.text}>
        <Txt kind="label" weight={600}>
          {entry.term_dev}
          {' · '}
          <Num kind="label" weight={400} color="ink2">
            {entry.term_lat}
          </Num>
        </Txt>
        <Txt kind="caption" color="ink3">
          {entry.meaning}
        </Txt>
      </View>
      <ChevronIcon color={colors.ink3} />
    </Pressable44>
  );
}

export default function GlossaryList() {
  const { t, lang } = useLang();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const all = sortGlossary(loadGlossary(lang).items);
  const items = filterGlossary(all, query);
  return (
    <Screen title={t('glossary.title')} chrome="stack" route="GlossaryList" testID="glossary-list">
      <View style={styles.searchRow}>
        <View style={styles.search}>
          <TextField label={t('common.search')} placeholder={t('glossary.searchPlaceholder')} value={query} onChangeText={setQuery} autoCorrect={false} testID="glossary-search" />
        </View>
        {query ? <TextButton label={t('glossary.clear')} onPress={() => setQuery('')} style={styles.clear} testID="glossary-clear" /> : null}
      </View>
      <RichText kind="caption" color="ink3" k="glossary.count" params={{ count: items.length }} testID="glossary-count" />
      {items.length ? (
        <Card flush testID="glossary-rows">
          {items.map((g, i) => (
            <GlossaryRow key={g.id} entry={g} onPress={() => router.push(`/learn/glossary/${g.id}`)} divider={i < items.length - 1} testID={`glossary-${g.id}`} />
          ))}
        </Card>
      ) : (
        <Txt kind="body" color="ink2" testID="glossary-empty">
          {t('glossary.noResults', { query })}
        </Txt>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  search: { flex: 1, minWidth: 0 },
  clear: { marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 16, alignSelf: 'stretch', justifyContent: 'flex-start' },
  text: { flex: 1, minWidth: 0, gap: 2 },
});
