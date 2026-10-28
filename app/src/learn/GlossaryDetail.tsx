// GlossaryDetail (F33, design.md 10.7): the term page every Why? sheet links to. Headword in Devanagari and Latin (the two
// scripts every language shares), the meaning in the UI language as resolved by the content package (bho -> hi -> en,
// carry-over A-INFO-1), the meanings of the other languages only when their own text exists (no duplicated fallback
// English), related terms and the lessons that use the term. Not a banner route (M5).
import { CONTENT_LANGUAGES, glossaryTerm, loadLessons, type ContentLanguage, type GlossaryEntry } from '@shubhvela/content';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Card } from '../components/Card';
import { NavRow } from '../components/ListRows';
import { Num } from '../components/Num';
import { Screen } from '../components/Screen';
import { Txt } from '../components/Txt';
import { useLang } from '../i18n';
import { GlossaryRow } from './GlossaryList';

export interface GlossaryDetailProps {
  id: string;
  /** 'why' when opened from a Why? sheet (caption only). */
  from?: string;
}

/** Meanings in the other languages whose OWN text exists (not a fallback) and differs from the shown one. */
export function otherLanguageMeanings(id: string, lang: ContentLanguage): { lang: ContentLanguage; meaning: string }[] {
  const shown = glossaryTerm(id, lang);
  const out: { lang: ContentLanguage; meaning: string }[] = [];
  for (const l of CONTENT_LANGUAGES) {
    if (l === lang) continue;
    const r = glossaryTerm(id, l);
    if (!r || r.fallback || r.item.meaning === shown?.item.meaning) continue;
    out.push({ lang: l, meaning: r.item.meaning });
  }
  return out;
}

export default function GlossaryDetail({ id, from }: GlossaryDetailProps) {
  const { t, lang } = useLang();
  const router = useRouter();
  const resolved = glossaryTerm(id, lang);
  if (!resolved) {
    return (
      <Screen title={t('glossary.title')} chrome="stack" route="GlossaryTerm" testID="glossary-detail">
        <Txt kind="body" color="ink2" testID="glossary-missing">
          {t('charts.glossaryNone', { term: id })}
        </Txt>
      </Screen>
    );
  }
  const g: GlossaryEntry = resolved.item;
  const others = otherLanguageMeanings(id, lang);
  const related = (g.related ?? []).map((r) => glossaryTerm(r, lang)?.item).filter((x): x is GlossaryEntry => !!x);
  const lessons = loadLessons(lang).items.filter((l) => l.terms.includes(id));

  return (
    <Screen
      title={g.term_dev}
      chrome="stack"
      route="GlossaryTerm"
      subtitle={
        <View style={styles.subtitle}>
          <Num kind="label" weight={400} color="ink2" testID="glossary-term-lat">
            {g.term_lat}
          </Num>
          {from === 'why' ? (
            <Txt kind="caption" color="ink3" testID="glossary-from-why">
              {t('glossary.openFromWhy')}
            </Txt>
          ) : null}
        </View>
      }
      testID="glossary-detail"
    >
      <Card testID="glossary-meaning">
        <Txt kind="micro" weight={600} color="ink3">
          {t('glossary.meaning')}
        </Txt>
        <Txt kind="body">{g.meaning}</Txt>
        {resolved.fallback ? (
          <Txt kind="caption" color="ink3">
            {t(`settings.lang.${resolved.lang}`)}
          </Txt>
        ) : null}
        {others.map((o) => (
          <View key={o.lang} style={styles.other} testID={`glossary-meaning-${o.lang}`}>
            <Txt kind="micro" weight={600} color="ink3">
              {t(`settings.lang.${o.lang}`)}
            </Txt>
            <Txt kind="body">{o.meaning}</Txt>
          </View>
        ))}
      </Card>

      {related.length ? (
        <Card flush testID="glossary-related">
          <View style={styles.head}>
            <Txt kind="label" weight={600} color="ink2">
              {t('glossary.related')}
            </Txt>
          </View>
          {related.map((r, i) => (
            <GlossaryRow key={r.id} entry={r} onPress={() => router.push(`/learn/glossary/${r.id}`)} divider={i < related.length - 1} testID={`glossary-related-${r.id}`} />
          ))}
        </Card>
      ) : null}

      {lessons.length ? (
        <Card flush testID="glossary-lessons">
          <View style={styles.head}>
            <Txt kind="label" weight={600} color="ink2">
              {t('glossary.relatedLessons')}
            </Txt>
          </View>
          {lessons.map((l, i) => (
            <NavRow key={l.id} title={t('learn.lessonNumber', { n: l.n })} value={l.title} onPress={() => router.push(`/learn/lesson/${l.id}`)} divider={i < lessons.length - 1} testID={`glossary-lesson-${l.id}`} />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { gap: 2 },
  other: { marginTop: 8, gap: 2 },
  head: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
});
