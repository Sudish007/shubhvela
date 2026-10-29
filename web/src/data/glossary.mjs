// Glossary page data (spec F42 "glossary (>= 150 terms) as individual pages"; FEAT-D02): every term of corpus/glossary
// (264 entries today; the build asserts >= 150) in the resolved language, related terms resolved to existing ids, and the
// lessons (corpus/lessons) whose `terms` list names the id. Lessons have no web page: the term page lists their titles
// and points at the app's Learn tab.
export const GLOSSARY_MIN = 150;

export function glossaryData(content, lang) {
  const g = content.loadGlossary(lang);
  if (g.items.length < GLOSSARY_MIN) throw new Error(`glossary has ${g.items.length} terms (< ${GLOSSARY_MIN})`);
  const ids = new Set(g.items.map((e) => e.id));
  const lessons = content.loadLessons(lang).items;
  const byId = new Map();
  for (const e of g.items) {
    const related = (e.related ?? []).filter((r) => ids.has(r) && r !== e.id);
    const inLessons = lessons.filter((l) => (l.terms ?? []).includes(e.id)).map((l) => ({ n: l.n, title: l.title }));
    byId.set(e.id, { ...e, related, lessons: inLessons });
  }
  // Index order: Latin term, case-insensitive (one list for every language; the Devanagari form is shown beside it).
  const items = [...byId.values()].sort((a, b) => a.term_lat.localeCompare(b.term_lat, 'en', { sensitivity: 'base' }));
  return { items, byId, lang: g.lang, fallback: g.fallback, count: items.length };
}

/** Index letters: first Latin letter of each term. */
export function letterGroups(items) {
  const groups = new Map();
  for (const e of items) {
    const letter = (e.term_lat[0] ?? '#').toUpperCase();
    if (!groups.has(letter)) groups.set(letter, []);
    groups.get(letter).push(e);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}
