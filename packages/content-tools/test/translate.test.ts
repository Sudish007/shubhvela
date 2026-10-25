import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { extractBalanced, parseModelJson, stripFences } from '../src/json-extract';
import { redact, redactValue } from '../src/redact';
import { CapReached, LengthError, chatOnce, checkTranslated, translateAll, translateBatch, type TranslateOptions } from '../src/translate';

const FAKE_KEY = 'AIza' + 'Q'.repeat(35);

interface Call {
  url: string;
  body: Record<string, unknown>;
  headers: Record<string, string>;
}

function responder(handlers: ((call: Call, n: number) => { status: number; body: unknown } | { status: number; text: string })[]) {
  const calls: Call[] = [];
  const fetchMock: typeof fetch = async (url, init) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    const headers = Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>));
    const call = { url: String(url), body, headers };
    calls.push(call);
    const h = handlers[Math.min(calls.length - 1, handlers.length - 1)];
    const r = h(call, calls.length);
    if ('text' in r) return new Response(r.text, { status: r.status });
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } });
  };
  return { fetchMock, calls };
}

const ok = (content: string, finish = 'stop') => ({ status: 200, body: { choices: [{ message: { content }, finish_reason: finish }] } });

const DEVA = 'राहु काल दिन के आठवाँ हिस्सा होला, जे दिन के हिसाब से तय होला आ नया काम एह में ना शुरू कइल जाला।';

function hindiFor(id: string, enText: string): string {
  // Devanagari filler sized like the English so the length check passes in tests.
  const base = `यह नियम ${id.length} शब्दों में इस दिन के लिए मार्गदर्शन देता है और नियम का नाम बताता है। `;
  const target = Array.from(enText).length;
  let s = '';
  while (Array.from(s).length < target) s += base;
  return Array.from(s).slice(0, target).join('');
}

let tmp: string;
let contentRoot: string;
let toolsRoot: string;

const master = [
  { id: 'rahu-kaal', rule: 'rahu-kaal', source: 'Muhurta Chintamani', level: 1, review: 'draft', params: ['vara'], text: 'Rahu Kaal is one eighth of the daytime chosen by the weekday; new beginnings are avoided in it.' },
  { id: 'yamaganda', rule: 'yamaganda', source: 'Muhurta Chintamani', level: 1, review: 'draft', params: ['vara'], text: 'Yamaganda is one eighth of the daytime fixed by the weekday and is left out when choosing a time.' },
  { id: 'gulika', rule: 'gulika', source: 'Muhurta Chintamani', level: 1, review: 'draft', params: ['vara'], text: 'Gulika is Saturn\'s eighth of the daytime counted from the weekday lord and is avoided for starting work.' },
];

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'shubhvela-translate-'));
  contentRoot = join(tmp, 'content');
  toolsRoot = join(tmp, 'tools');
  mkdirSync(join(contentRoot, 'corpus', 'rules'), { recursive: true });
  mkdirSync(toolsRoot, { recursive: true });
  writeFileSync(join(contentRoot, 'corpus', 'rules', 'en.json'), JSON.stringify(master), 'utf8');
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

function baseOpts(fetchMock: typeof fetch, lang: 'hi' | 'bho' = 'hi'): TranslateOptions {
  return { lang, domains: 'all', contentRoot, toolsRoot, apiKey: FAKE_KEY, fetch: fetchMock, sleep: async () => {}, random: () => 0.5, now: () => Date.UTC(2026, 9, 25), batchLabel: 'T' };
}

describe('fence stripping and balanced extraction', () => {
  it('strips ```json fences and prose around the object', () => {
    const raw = 'Here you go:\n```json\n{"items":[{"id":"a","text":"x"}]}\n```\nHope this helps.';
    expect(stripFences(raw)).toContain('{"items"');
    expect(parseModelJson(raw)).toEqual({ items: [{ id: 'a', text: 'x' }] });
  });
  it('extracts the first balanced object even with braces inside strings', () => {
    const s = 'noise {"a":"}{","b":{"c":1}} trailing {"d":2}';
    expect(extractBalanced(s)).toBe('{"a":"}{","b":{"c":1}}');
    expect(extractBalanced('{"unterminated": [1,2')).toBeNull();
    expect(() => parseModelJson('no json here')).toThrow(/no balanced JSON/);
    expect(() => parseModelJson('[1,2]')).toThrow(/no balanced JSON/);
  });
});

describe('redaction', () => {
  it('scrubs API keys and bearer tokens from text and nested values', () => {
    expect(redact(`key=${FAKE_KEY} ok`)).toBe('key=AIza[redacted] ok');
    expect(redact('Authorization: Bearer abcdefghijklmnopqrstuvwxyz0123')).toBe('Authorization: Bearer [redacted]');
    expect(redactValue({ a: [FAKE_KEY], b: { c: `x ${FAKE_KEY}` } })).toEqual({ a: ['AIza[redacted]'], b: { c: 'x AIza[redacted]' } });
    expect(redact('AIza short')).toBe('AIza short');
  });
});

describe('chatOnce', () => {
  it('sends the build-rules request shape and the key only in the Authorization header', async () => {
    const { fetchMock, calls } = responder([() => ok('{"items":[]}')]);
    const budget = { requests: 0, max: 450 };
    const out = await chatOnce(baseOpts(fetchMock), 'prompt', budget, {});
    expect(out).toBe('{"items":[]}');
    expect(calls[0].url).toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
    expect(calls[0].headers.authorization).toBe(`Bearer ${FAKE_KEY}`);
    expect(calls[0].body).toMatchObject({ model: 'gemini-3.5-flash-lite', max_tokens: 8000, reasoning_effort: 'low', response_format: { type: 'json_object' } });
    expect((calls[0].body.messages as { role: string; content: string }[])[0]).toEqual({ role: 'system', content: 'single JSON object, no markdown fences, no prose' });
    expect(JSON.stringify(calls[0].body)).not.toContain(FAKE_KEY);
    expect(budget.requests).toBe(1);
  });

  it('retries once without response_format on HTTP 400', async () => {
    const { fetchMock, calls } = responder([() => ({ status: 400, text: 'json mode unsupported' }), () => ok('{"items":[]}')]);
    const meta: { retriedWithoutJsonMode?: boolean } = {};
    await chatOnce(baseOpts(fetchMock), 'p', { requests: 0, max: 450 }, meta);
    expect(calls.length).toBe(2);
    expect('response_format' in calls[0].body).toBe(true);
    expect('response_format' in calls[1].body).toBe(false);
    expect(meta.retriedWithoutJsonMode).toBe(true);
  });

  it('backs off three times on 429/5xx then fails with a redacted message', async () => {
    const slept: number[] = [];
    const { fetchMock, calls } = responder([() => ({ status: 429, text: `rate limited ${FAKE_KEY}` })]);
    const opts = { ...baseOpts(fetchMock), sleep: async (ms: number) => void slept.push(ms) };
    await expect(chatOnce(opts, 'p', { requests: 0, max: 450 }, {})).rejects.toThrow(/HTTP 429: rate limited AIza\[redacted\]/);
    expect(calls.length).toBe(4);
    expect(slept).toEqual([2000, 4000, 8000]);
  });

  it('treats finish_reason length and null content as errors', async () => {
    const a = responder([() => ok('{"items":[', 'length')]);
    await expect(chatOnce(baseOpts(a.fetchMock), 'p', { requests: 0, max: 450 }, {})).rejects.toBeInstanceOf(LengthError);
    const b = responder([() => ({ status: 200, body: { choices: [{ message: { content: null }, finish_reason: 'stop' }] } })]);
    await expect(chatOnce(baseOpts(b.fetchMock), 'p', { requests: 0, max: 450 }, {})).rejects.toBeInstanceOf(LengthError);
  });

  it('stops at the request cap before sending', async () => {
    const { fetchMock, calls } = responder([() => ok('{}')]);
    await expect(chatOnce(baseOpts(fetchMock), 'p', { requests: 450, max: 450 }, {})).rejects.toBeInstanceOf(CapReached);
    expect(calls.length).toBe(0);
  });
});

describe('translateBatch', () => {
  it('halves the batch on a length error and retries each half once', async () => {
    const { fetchMock, calls } = responder([
      () => ok('{"items":[{"id":"a"', 'length'),
      (c) => ok(JSON.stringify({ items: (JSON.parse((c.body.messages as { content: string }[])[1].content.split('Input:\n')[1]) as { items: { id: string }[] }).items.map((i) => ({ id: i.id, text: DEVA })) })),
    ]);
    const batch = ['a', 'b', 'c', 'd'].map((id) => ({ id, text: 'English text long enough for the test of halving.' }));
    const res = await translateBatch(baseOpts(fetchMock), 'rules', batch, { requests: 0, max: 450 });
    expect(res.halved).toBe(true);
    expect(calls.length).toBe(3);
    expect(res.items.map((i) => i.id)).toEqual(['a', 'b', 'c', 'd']);
  });
  it('gives up on a single item that is still too long instead of aborting', async () => {
    const { fetchMock } = responder([() => ok('{"items":[', 'length')]);
    const res = await translateBatch(baseOpts(fetchMock), 'rules', [{ id: 'a', text: 'x' }, { id: 'b', text: 'y' }], { requests: 0, max: 450 });
    expect(res.items).toEqual([]);
    expect(res.halved).toBe(true);
  });
});

describe('post-checks', () => {
  const en = { id: 'rahu-kaal', text: master[0].text };
  it('accepts a Devanagari translation of similar length', () => {
    expect(checkTranslated('hi', 'rules', en, { id: 'rahu-kaal', text: hindiFor('rahu-kaal', en.text) })).toEqual([]);
  });
  it('rejects id mismatch, Latin text, forbidden words, percentages and length drift', () => {
    expect(checkTranslated('hi', 'rules', en, { id: 'other', text: hindiFor('x', en.text) })).toContain('id mismatch');
    expect(checkTranslated('hi', 'rules', en, { id: 'rahu-kaal', text: 'This is still English text of about the same length as the source sentence here.' })).toContain('text not Devanagari-dominant');
    expect(checkTranslated('hi', 'rules', en, { id: 'rahu-kaal', text: hindiFor('r', en.text) + ' रत्न धारण करें' }).join()).toMatch(/forbidden/);
    expect(checkTranslated('hi', 'rules', en, { id: 'rahu-kaal', text: hindiFor('r', en.text) + ' 95% सही' }).join()).toMatch(/percentage/);
    expect(checkTranslated('hi', 'rules', en, { id: 'rahu-kaal', text: 'छोटा।' }).join()).toMatch(/length/);
    expect(checkTranslated('bho', 'rules', en, { id: 'rahu-kaal', text: hindiFor('r', en.text) + ' हम अछि' }).join()).toMatch(/Maithili/);
    expect(checkTranslated('hi', 'rules', en, { id: 'rahu-kaal' })).toContain('missing text');
  });
});

describe('translateAll', () => {
  it('writes <lang>.json with review draft, a redacted diagnostic and respects the cap with a cursor', async () => {
    const { fetchMock, calls } = responder([
      (c) => {
        const input = JSON.parse((c.body.messages as { content: string }[])[1].content.split('Input:\n')[1]) as { items: { id: string; text: string }[] };
        return ok(JSON.stringify({ items: input.items.map((i) => ({ id: i.id, text: hindiFor(i.id, i.text) })) }));
      },
    ]);
    const diag = await translateAll({ ...baseOpts(fetchMock), maxRequests: 5 });
    expect(calls.length).toBe(1);
    expect(diag.requests).toBe(1);
    expect(diag.translated.rules).toBe(3);
    expect(diag.rejected).toEqual([]);
    expect(diag.stoppedAtCap).toBe(false);
    const out = JSON.parse(readFileSync(join(contentRoot, 'corpus', 'rules', 'hi.json'), 'utf8')) as { id: string; review: string; text: string; source: string }[];
    expect(out.map((o) => o.id)).toEqual(['rahu-kaal', 'yamaganda', 'gulika']);
    expect(out.every((o) => o.review === 'draft')).toBe(true);
    expect(out[0].source).toBe('Muhurta Chintamani');
    expect(/[\u0900-\u097F]/.test(out[0].text)).toBe(true);
    const diagText = readFileSync(join(toolsRoot, 'diagnostic.json'), 'utf8');
    expect(diagText).not.toContain(FAKE_KEY);
    expect(diagText).not.toMatch(/authorization/i);
    expect(existsSync(join(toolsRoot, 'review-queue'))).toBe(false);
  });

  it('stops at the cap, saves a cursor and resumes from it on the next run', async () => {
    // 3 items with batch size 12 -> 1 request; force a cap of 0 remaining by pre-counting: use maxRequests 1 with a first-call length error that halves (needs 3 requests).
    const { fetchMock, calls } = responder([
      () => ok('{"items":[', 'length'),
      (c) => {
        const input = JSON.parse((c.body.messages as { content: string }[])[1].content.split('Input:\n')[1]) as { items: { id: string; text: string }[] };
        return ok(JSON.stringify({ items: input.items.map((i) => ({ id: i.id, text: hindiFor(i.id, i.text) })) }));
      },
    ]);
    const first = await translateAll({ ...baseOpts(fetchMock), maxRequests: 2 });
    expect(first.stoppedAtCap).toBe(true);
    expect(first.requests).toBe(2);
    expect(first.cursor).toEqual({ lang: 'hi', domain: 'rules', index: 0 });
    expect(JSON.parse(readFileSync(join(toolsRoot, 'cursor-hi.json'), 'utf8'))).toEqual({ lang: 'hi', domain: 'rules', index: 0 });
    expect(existsSync(join(contentRoot, 'corpus', 'rules', 'hi.json'))).toBe(false);
    const before = calls.length;
    const second = await translateAll({ ...baseOpts(fetchMock), maxRequests: 10 });
    expect(calls.length - before).toBe(1);
    expect(second.stoppedAtCap).toBe(false);
    expect(second.translated.rules).toBe(3);
    expect(JSON.parse(readFileSync(join(toolsRoot, 'cursor-hi.json'), 'utf8'))).toMatchObject({ done: true });
  });

  it('records rejected items and errors without aborting, and writes the Bhojpuri review queue', async () => {
    const { fetchMock } = responder([
      (c) => {
        const input = JSON.parse((c.body.messages as { content: string }[])[1].content.split('Input:\n')[1]) as { items: { id: string; text: string }[] };
        const items = input.items.map((i, n) => ({ id: i.id, text: n === 0 ? 'Latin only text that should be rejected by the Devanagari ratio check here.' : hindiFor(i.id, i.text).replace(/है/g, 'बा') }));
        return ok(JSON.stringify({ items }));
      },
    ]);
    const diag = await translateAll({ ...baseOpts(fetchMock, 'bho'), maxRequests: 5 });
    expect(diag.translated.rules).toBe(2);
    expect(diag.rejected.map((r) => r.id)).toEqual(['rahu-kaal']);
    expect(diag.rejected[0].reasons.join()).toMatch(/Devanagari/);
    expect(diag.reviewQueue).toBe(resolve(toolsRoot, 'review-queue', 'bho-T.md'));
    const md = readFileSync(diag.reviewQueue as string, 'utf8');
    expect(md).toMatch(/^# Bhojpuri review queue · batch T/);
    expect(md).toMatch(/2 of 2 newly translated/);
    expect(md).toContain('- [ ] **text**');
    const out = JSON.parse(readFileSync(join(contentRoot, 'corpus', 'rules', 'bho.json'), 'utf8')) as { id: string }[];
    expect(out.map((o) => o.id)).toEqual(['yamaganda', 'gulika']);
  });

  it('surfaces HTTP failures as redacted errors and keeps going', async () => {
    const { fetchMock } = responder([() => ({ status: 403, text: `forbidden for ${FAKE_KEY}` })]);
    const diag = await translateAll({ ...baseOpts(fetchMock), maxRequests: 5 });
    expect(diag.errors.length).toBe(1);
    expect(diag.errors[0]).toContain('HTTP 403');
    expect(diag.errors[0]).not.toContain(FAKE_KEY);
    expect(diag.translated.rules).toBe(0);
  });
});
