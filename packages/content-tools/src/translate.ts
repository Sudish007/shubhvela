// Gemini translation of the English master corpus into Hindi / Bhojpuri (plan.md 9, build-rules "Gemini" facts).
// Pure orchestration over an injected fetch so the tests run against a mocked endpoint; the CLI (cli.ts) wires the
// real fetch, the file system paths and process.env.GEMINI_API_KEY (read once, never logged).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEVANAGARI_MIN_RATIO, forbiddenHits, hasPercentClaim, isDevanagariDominant, maithiliHits, type Lang } from './forbidden';
import { parseModelJson } from './json-extract';
import { redact, redactValue } from './redact';

export type TargetLang = Exclude<Lang, 'en'>;

export const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
export const MODEL = 'gemini-3.5-flash-lite';
export const SYSTEM_PROMPT = 'single JSON object, no markdown fences, no prose';
export const DEFAULT_MAX_REQUESTS = 450;
export const BATCH_SIZE = 12;
export const LESSON_BATCH_SIZE = 1;
export const MAX_TOKENS = 8000;
export const LENGTH_TOLERANCE = 0.4;
export const REVIEW_SAMPLE = 50;

/** Fields translated per domain; everything else is copied from the English master. */
export const FIELDS_BY_DOMAIN: Record<string, string[]> = {
  festivals: ['name', 'what', 'rule', 'conventionNote'],
  lessons: ['title', 'body'],
  glossary: ['meaning'],
};
const DEFAULT_FIELDS = ['text'];
export const fieldsFor = (domain: string): string[] => FIELDS_BY_DOMAIN[domain] ?? DEFAULT_FIELDS;

export interface Cursor {
  lang: TargetLang;
  domain: string;
  /** Index into the English master of the next untranslated item. */
  index: number;
}

export interface TranslateOptions {
  lang: TargetLang;
  domains: string[] | 'all';
  maxRequests?: number;
  /** packages/content root (contains corpus/). */
  contentRoot: string;
  /** packages/content-tools root (diagnostic.json, cursor, review-queue/). */
  toolsRoot: string;
  apiKey: string;
  fetch: typeof fetch;
  endpoint?: string;
  model?: string;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  now?: () => number;
  /** Label for the review-queue file, e.g. "A" (A08), "B", "C"; defaults to the run date. */
  batchLabel?: string;
  log?: (line: string) => void;
}

export interface Rejection {
  domain: string;
  id: string;
  reasons: string[];
}

export interface Diagnostic {
  startedAt: string;
  finishedAt?: string;
  lang: TargetLang;
  domains: string[];
  model: string;
  requests: number;
  maxRequests: number;
  batches: { domain: string; size: number; ok: boolean; status?: number; retriedWithoutJsonMode?: boolean; halved?: boolean; error?: string }[];
  translated: Record<string, number>;
  rejected: Rejection[];
  errors: string[];
  stoppedAtCap: boolean;
  cursor: Cursor | null;
  reviewQueue?: string;
}

export class LengthError extends Error {
  constructor(message = 'finish_reason length or empty content') {
    super(message);
    this.name = 'LengthError';
  }
}
export class CapReached extends Error {
  constructor() {
    super('request cap reached');
    this.name = 'CapReached';
  }
}

const REGISTER: Record<TargetLang, string> = {
  hi: 'Hindi: respectful आप throughout, standard Khari Boli, Sanskrit terms in Devanagari with a one-line gloss in brackets on first use, Latin digits, no Urdu-heavy or Anglicised phrasing.',
  bho: 'Bhojpuri: respectful standard register (रउआ for you, राउर for your; verb forms होला / करीं / बानी / नइखे), written in Devanagari, NOT Hindi-ised (avoid है/हैं/करें/आप), no rustic slang, no Maithili forms (no अछि/छी/छथि/अहाँ), technical terms in Latin on first mention then Devanagari, Latin digits.',
};

export function buildUserPrompt(lang: TargetLang, domain: string, items: Record<string, unknown>[]): string {
  const fields = fieldsFor(domain);
  const lengths = items.map((it) => fields.map((f) => stringLength(it[f])).reduce((a, b) => a + b, 0));
  const mid = Math.round(lengths.reduce((a, b) => a + b, 0) / Math.max(1, lengths.length));
  return [
    `Translate the following Shubhvela ${domain} snippets from English into ${lang === 'hi' ? 'Hindi' : 'Bhojpuri'}.`,
    `Register: ${REGISTER[lang]}`,
    'Content rules (binding): no outcome guarantees, no health or medical claims, no fear language, no gendered assumptions, no commercial remedies (no gemstones, pujas, consultations for sale), no accuracy percentages; plain, calm, respectful; each item must keep its id and must still name the rule it explains.',
    `Length: aim for the English length (midpoint ${mid} characters per item; minimum ${Math.round(mid * (1 - LENGTH_TOLERANCE))}, maximum ${Math.round(mid * (1 + LENGTH_TOLERANCE))}); never add new claims to fill space.`,
    `Translate ONLY these fields: ${fields.join(', ')}. Keep {placeholders} exactly as written. Keep arrays as arrays of strings.`,
    'Return exactly one JSON object of the form {"items":[{"id":"...", <translated fields>}, ...]} with every input id present once and no other keys.',
    'Input:',
    JSON.stringify({ items: items.map((it) => pick(it, ['id', ...fields])) }),
  ].join('\n');
}

function pick(o: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (o[k] !== undefined) out[k] = o[k];
  return out;
}

function stringLength(v: unknown): number {
  if (typeof v === 'string') return Array.from(v).length;
  if (Array.isArray(v)) return v.reduce<number>((a, s) => a + stringLength(s), 0);
  return 0;
}

interface ChatResponse {
  choices?: { message?: { content?: string | null }; finish_reason?: string | null }[];
}

/**
 * One chat completion with the build-rules limits: json_object (retry once without it on HTTP 400), max_tokens 8000,
 * reasoning_effort low, 429/5xx exponential backoff x3, finish_reason "length" or null content -> LengthError.
 * Counts requests through `budget` and throws CapReached before exceeding it.
 */
export async function chatOnce(
  opts: TranslateOptions,
  userPrompt: string,
  budget: { requests: number; max: number },
  meta: { status?: number; retriedWithoutJsonMode?: boolean },
): Promise<string> {
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  let jsonMode = true;
  let backoffs = 0;
  for (;;) {
    if (budget.requests >= budget.max) throw new CapReached();
    budget.requests++;
    const body: Record<string, unknown> = {
      model: opts.model ?? MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: MAX_TOKENS,
      reasoning_effort: 'low',
    };
    if (jsonMode) body.response_format = { type: 'json_object' };
    const res = await opts.fetch(opts.endpoint ?? ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${opts.apiKey}` },
      body: JSON.stringify(body),
    });
    meta.status = res.status;
    if (res.status === 400 && jsonMode) {
      jsonMode = false;
      meta.retriedWithoutJsonMode = true;
      continue;
    }
    if ((res.status === 429 || res.status >= 500) && backoffs < 3) {
      backoffs++;
      await sleep(2000 * 2 ** (backoffs - 1));
      continue;
    }
    if (!res.ok) {
      const text = redact(await safeText(res));
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    const data = (await res.json()) as ChatResponse;
    const choice = data.choices?.[0];
    const content = choice?.message?.content;
    if (choice?.finish_reason === 'length' || content === null || content === undefined || content === '') throw new LengthError();
    return content;
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

export interface BatchResult {
  items: Record<string, unknown>[];
  halved: boolean;
  retriedWithoutJsonMode: boolean;
  status?: number;
}

/** Translates one batch; on LengthError halves it and retries each half once (a single item that still fails is skipped). */
export async function translateBatch(
  opts: TranslateOptions,
  domain: string,
  batch: Record<string, unknown>[],
  budget: { requests: number; max: number },
  allowHalve = true,
): Promise<BatchResult> {
  const meta: { status?: number; retriedWithoutJsonMode?: boolean } = {};
  try {
    const raw = await chatOnce(opts, buildUserPrompt(opts.lang, domain, batch), budget, meta);
    const parsed = parseModelJson(raw);
    const items = Array.isArray(parsed.items) ? (parsed.items as Record<string, unknown>[]) : [];
    return { items, halved: false, retriedWithoutJsonMode: !!meta.retriedWithoutJsonMode, status: meta.status };
  } catch (e) {
    if (e instanceof LengthError && allowHalve && batch.length > 1) {
      const mid = Math.ceil(batch.length / 2);
      const a = await translateBatch(opts, domain, batch.slice(0, mid), budget, false);
      const b = await translateBatch(opts, domain, batch.slice(mid), budget, false);
      return { items: [...a.items, ...b.items], halved: true, retriedWithoutJsonMode: a.retriedWithoutJsonMode || b.retriedWithoutJsonMode, status: b.status ?? a.status };
    }
    if (e instanceof LengthError && !allowHalve) {
      // Already halved once; give up on this half without aborting the run.
      return { items: [], halved: true, retriedWithoutJsonMode: !!meta.retriedWithoutJsonMode, status: meta.status };
    }
    throw e;
  }
}

/** Post-checks per translated item against its English master: id, fields present, Devanagari ratio, forbidden words, length. */
export function checkTranslated(lang: TargetLang, domain: string, en: Record<string, unknown>, out: Record<string, unknown>): string[] {
  const reasons: string[] = [];
  if (out.id !== en.id) reasons.push('id mismatch');
  for (const f of fieldsFor(domain)) {
    const src = en[f];
    if (src === undefined) continue;
    const got = out[f];
    if (got === undefined) {
      reasons.push(`missing ${f}`);
      continue;
    }
    if (Array.isArray(src) !== Array.isArray(got)) {
      reasons.push(`${f} shape`);
      continue;
    }
    const srcTexts = Array.isArray(src) ? (src as string[]) : [src as string];
    const gotTexts = Array.isArray(got) ? (got as string[]) : [got as string];
    if (srcTexts.length !== gotTexts.length) reasons.push(`${f} paragraph count`);
    for (const t of gotTexts) {
      if (typeof t !== 'string' || !t.trim()) {
        reasons.push(`${f} empty`);
        continue;
      }
      if (!isDevanagariDominant(t, DEVANAGARI_MIN_RATIO[lang])) reasons.push(`${f} not Devanagari-dominant`);
      const fh = forbiddenHits(t, lang);
      if (fh.length) reasons.push(`${f} forbidden: ${fh.join('/')}`);
      if (hasPercentClaim(t)) reasons.push(`${f} percentage claim`);
      if (lang === 'bho' && maithiliHits(t).length) reasons.push(`${f} Maithili: ${maithiliHits(t).join('/')}`);
      const srcParams = placeholders(srcTexts.join(' '));
      const gotParams = placeholders(gotTexts.join(' '));
      if (srcParams.join() !== gotParams.join()) reasons.push(`${f} placeholders changed`);
    }
    const ratio = stringLength(got) / Math.max(1, stringLength(src));
    if (ratio < 1 - LENGTH_TOLERANCE || ratio > 1 + LENGTH_TOLERANCE) reasons.push(`${f} length ${ratio.toFixed(2)}x`);
  }
  return Array.from(new Set(reasons));
}

function placeholders(s: string): string[] {
  return Array.from(s.matchAll(/\{([a-zA-Z0-9_]+)\}/g), (m) => m[1]).sort();
}

/** Domains whose file is not prose and is never translated (B02: name lists are already Devanagari + Latin). */
export const UNTRANSLATED_DOMAINS: readonly string[] = ['naamkaran-names'];

/** Every corpus/<domain>/en.json present on disk (Phase A + B + later C), minus UNTRANSLATED_DOMAINS, so one `--domains all` run covers whatever exists at dispatch time. */
export function listDomains(contentRoot: string): string[] {
  const dir = resolve(contentRoot, 'corpus');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((d) => existsSync(resolve(dir, d, 'en.json')) && !UNTRANSLATED_DOMAINS.includes(d))
    .sort();
}

function readJson<T>(p: string, fallback: T): T {
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T) : fallback;
}

export function cursorPath(toolsRoot: string, lang: TargetLang): string {
  return resolve(toolsRoot, `cursor-${lang}.json`);
}

/** Runs the translation for one language over the requested domains, resuming from the cursor file. */
export async function translateAll(opts: TranslateOptions): Promise<Diagnostic> {
  const log = opts.log ?? (() => {});
  const now = opts.now ?? (() => Date.now());
  const random = opts.random ?? Math.random;
  const max = opts.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const budget = { requests: 0, max };
  const domains = opts.domains === 'all' ? listDomains(opts.contentRoot) : opts.domains;
  const diag: Diagnostic = {
    startedAt: new Date(now()).toISOString(),
    lang: opts.lang,
    domains,
    model: opts.model ?? MODEL,
    requests: 0,
    maxRequests: max,
    batches: [],
    translated: {},
    rejected: [],
    errors: [],
    stoppedAtCap: false,
    cursor: null,
  };
  const cursor = readJson<Cursor | null>(cursorPath(opts.toolsRoot, opts.lang), null);
  const newForReview: { domain: string; en: Record<string, unknown>; out: Record<string, unknown> }[] = [];
  let stopped = false;

  for (const domain of domains) {
    if (stopped) break;
    const enPath = resolve(opts.contentRoot, 'corpus', domain, 'en.json');
    const outPath = resolve(opts.contentRoot, 'corpus', domain, `${opts.lang}.json`);
    const master = readJson<Record<string, unknown>[]>(enPath, []);
    const existing = readJson<Record<string, unknown>[]>(outPath, []);
    const done = new Map(existing.map((it) => [String(it.id), it]));
    let start = 0;
    if (cursor && cursor.domain === domain && cursor.lang === opts.lang) start = Math.min(cursor.index, master.length);
    const pending = master.slice(start).filter((it) => !done.has(String(it.id)));
    const size = domain === 'lessons' ? LESSON_BATCH_SIZE : BATCH_SIZE;
    const fields = fieldsFor(domain);
    let translatedHere = 0;
    for (let i = 0; i < pending.length; i += size) {
      const batch = pending.slice(i, i + size);
      const entry: Diagnostic['batches'][number] = { domain, size: batch.length, ok: false };
      diag.batches.push(entry);
      try {
        const res = await translateBatch(opts, domain, batch, budget);
        entry.status = res.status;
        entry.retriedWithoutJsonMode = res.retriedWithoutJsonMode;
        entry.halved = res.halved;
        const byId = new Map(res.items.map((it) => [String(it.id), it]));
        for (const en of batch) {
          const out = byId.get(String(en.id));
          if (!out) {
            diag.rejected.push({ domain, id: String(en.id), reasons: ['missing from response'] });
            continue;
          }
          const reasons = checkTranslated(opts.lang, domain, en, out);
          if (reasons.length) {
            diag.rejected.push({ domain, id: String(en.id), reasons });
            continue;
          }
          const merged: Record<string, unknown> = { ...en };
          for (const f of fields) if (out[f] !== undefined) merged[f] = out[f];
          if ('review' in en) merged.review = 'draft';
          done.set(String(en.id), merged);
          newForReview.push({ domain, en, out: merged });
          translatedHere++;
        }
        entry.ok = true;
      } catch (e) {
        if (e instanceof CapReached) {
          diag.stoppedAtCap = true;
          diag.cursor = { lang: opts.lang, domain, index: start + i };
          stopped = true;
          break;
        }
        entry.error = redact(String((e as Error).message ?? e));
        diag.errors.push(`${domain} batch@${start + i}: ${entry.error}`);
      }
    }
    if (translatedHere > 0) {
      // Preserve the English order; keep previously translated items even if the master gained new ones.
      const ordered = master.filter((it) => done.has(String(it.id))).map((it) => done.get(String(it.id)) as Record<string, unknown>);
      writeFileSync(outPath, JSON.stringify(ordered, null, 2) + '\n', 'utf8');
      log(`${domain}: wrote ${ordered.length} ${opts.lang} items (${translatedHere} new)`);
    }
    diag.translated[domain] = translatedHere;
  }

  diag.requests = budget.requests;
  const cp = cursorPath(opts.toolsRoot, opts.lang);
  if (diag.cursor) writeFileSync(cp, JSON.stringify(diag.cursor, null, 2) + '\n', 'utf8');
  else if (existsSync(cp)) writeFileSync(cp, JSON.stringify({ lang: opts.lang, domain: '', index: 0, done: true }, null, 2) + '\n', 'utf8');

  if (opts.lang === 'bho' && newForReview.length) {
    diag.reviewQueue = writeReviewQueue(opts, newForReview, random, now);
  }
  diag.finishedAt = new Date(now()).toISOString();
  const diagPath = resolve(opts.toolsRoot, 'diagnostic.json');
  writeFileSync(diagPath, JSON.stringify(redactValue(diag), null, 2) + '\n', 'utf8');
  return redactValue(diag);
}

/** review-queue/<lang>-<batch>.md with up to 50 random snippets (English beside the translation) for the owner. */
export function writeReviewQueue(
  opts: TranslateOptions,
  items: { domain: string; en: Record<string, unknown>; out: Record<string, unknown> }[],
  random: () => number,
  now: () => number,
): string {
  const dir = resolve(opts.toolsRoot, 'review-queue');
  mkdirSync(dir, { recursive: true });
  const label = opts.batchLabel ?? new Date(now()).toISOString().slice(0, 10);
  const file = resolve(dir, `${opts.lang}-${label}.md`);
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const sample = pool.slice(0, REVIEW_SAMPLE);
  const lines: string[] = [
    `# Bhojpuri review queue · batch ${label}`,
    '',
    `${sample.length} of ${items.length} newly translated snippets, chosen at random. For each: tick the box if the Bhojpuri reads naturally in the respectful register (रउआ/राउर, होला/करीं/बानी/नइखे, Devanagari, no Maithili forms), or write the corrected text under it. When the batch is reviewed, flip \`review\` to \`reviewed\` in the corpus files or send the corrections.`,
    '',
  ];
  for (const { domain, en, out } of sample) {
    lines.push(`## ${domain} · ${String(en.id)}`, '');
    for (const f of fieldsFor(domain)) {
      if (en[f] === undefined) continue;
      lines.push(`- [ ] **${f}**`, `  - en: ${flat(en[f])}`, `  - bho: ${flat(out[f])}`, '');
    }
  }
  writeFileSync(file, redact(lines.join('\n')) + '\n', 'utf8');
  return file;
}

function flat(v: unknown): string {
  return Array.isArray(v) ? v.join(' ¶ ') : String(v ?? '');
}
