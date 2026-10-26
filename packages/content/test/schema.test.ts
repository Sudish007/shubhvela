import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertValid, type Schema } from './lib/validate';

const ROOT = resolve(__dirname, '..');
const schema = (name: string): Schema => JSON.parse(readFileSync(resolve(ROOT, 'schema', name), 'utf8')) as Schema;
const json = (p: string): unknown => JSON.parse(readFileSync(p, 'utf8'));

const SCHEMA_BY_DOMAIN: Record<string, string> = {
  festivals: 'festival-text.schema.json',
  lessons: 'lesson.schema.json',
  glossary: 'glossary.schema.json',
  'naamkaran-names': 'naamkaran-names.schema.json',
};

describe('schemas', () => {
  it('every ui/<lang>.json matches ui.schema.json', () => {
    const ui = schema('ui.schema.json');
    for (const lang of ['en', 'hi', 'bho']) assertValid(ui, json(resolve(ROOT, 'ui', `${lang}.json`)), `ui/${lang}.json`);
  });

  it('every corpus/<domain>/<lang>.json matches its schema', () => {
    const corpusDir = resolve(ROOT, 'corpus');
    if (!existsSync(corpusDir)) return;
    let files = 0;
    for (const domain of readdirSync(corpusDir)) {
      const s = schema(SCHEMA_BY_DOMAIN[domain] ?? 'snippet.schema.json');
      for (const f of readdirSync(resolve(corpusDir, domain)).filter((f) => f.endsWith('.json'))) {
        assertValid(s, json(resolve(corpusDir, domain, f)), `corpus/${domain}/${f}`);
        files++;
      }
    }
    expect(files).toBeGreaterThan(0);
  });

  it('snippet ids are unique inside a file and identical across the languages of a domain', () => {
    const corpusDir = resolve(ROOT, 'corpus');
    for (const domain of readdirSync(corpusDir)) {
      const sets: Record<string, string[]> = {};
      for (const f of readdirSync(resolve(corpusDir, domain)).filter((f) => f.endsWith('.json'))) {
        const ids = (json(resolve(corpusDir, domain, f)) as { id: string }[]).map((s) => s.id);
        expect(new Set(ids).size, `${domain}/${f} has duplicate ids`).toBe(ids.length);
        sets[f] = ids.sort();
      }
      const en = sets['en.json'];
      expect(en, `${domain} has no en.json master`).toBeDefined();
      for (const [f, ids] of Object.entries(sets)) if (f !== 'en.json') expect(ids, `${domain}/${f} id set differs from en.json`).toEqual(en);
    }
  });

  it('the mini validator rejects the shapes it is meant to catch', () => {
    const s = schema('snippet.schema.json');
    expect(() => assertValid(s, [{ id: 'x', rule: 'r', level: 1, text: 'too short', review: 'draft' }], 'bad')).toThrow(/schema error/);
    expect(() => assertValid(s, [{ id: 'ok-id', rule: 'rule', level: 4, text: 'long enough text here', review: 'draft' }], 'bad level')).toThrow(/enum/);
    expect(() => assertValid(s, [{ id: 'ok-id', rule: 'rule', level: 1, text: 'long enough text here', review: 'draft', extra: 1 }], 'extra')).toThrow(/additional/);
    expect(() => assertValid(schema('ui.schema.json'), { 'Bad Key': 'x' }, 'ui')).toThrow(/property name/);
    expect(() => assertValid(schema('ui.schema.json'), { 'common.ok': '' }, 'ui')).toThrow(/shorter/);
  });
});
