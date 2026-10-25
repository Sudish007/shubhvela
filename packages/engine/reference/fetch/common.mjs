// Shared helpers for the reference-data fetchers (plan.md section 8, FEAT-A04).
// Rules enforced here, not in the callers:
//   - random 8-15 s delay between page loads, per site counter capped at 60 loads per run;
//   - stop at once on reCAPTCHA / "not a robot" / HTTP 429: write a resume cursor under $env:TEMP and exit 3;
//   - default Chromium user agent (no spoofing), no referer games;
//   - raw HTML only under $env:TEMP; committed files hold extracted facts with source_url + fetched_at.
// Browser: the Chromium already installed under %LOCALAPPDATA%\ms-playwright (playwright-core never downloads here).
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FETCHER_VERSION = 'a04-1';
export const MAX_LOADS_PER_SITE = 60;
export const DELAY_MIN_MS = 8000;
export const DELAY_MAX_MS = 15000;

const here = dirname(fileURLToPath(import.meta.url));
/** packages/engine/reference */
export const REFERENCE_DIR = join(here, '..');
const TEMP = process.env.TEMP || process.env.TMP || '/tmp';
export const RAW_DIR = join(TEMP, 'shubhvela-ref-raw');
export const CURSOR_FILE = join(TEMP, 'shubhvela-ref-cursor.json');

const BLOCK_PATTERNS = [/recaptcha/i, /not a robot/i, /g-recaptcha/i, /unusual traffic/i, /captcha/i];

export class BlockedError extends Error {
  constructor(site, url, reason) {
    super(`${site} blocked (${reason}) at ${url}`);
    this.site = site;
    this.url = url;
    this.reason = reason;
  }
}

export function nowIso() {
  return new Date().toISOString();
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function randomDelayMs() {
  return DELAY_MIN_MS + Math.floor(Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS + 1));
}

export function ensureDir(p) {
  mkdirSync(p, { recursive: true });
}

export function readJson(p, fallback = undefined) {
  if (!existsSync(p)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing file: ${p}`);
  }
  return JSON.parse(readFileSync(p, 'utf8'));
}

export function writeJson(p, data) {
  ensureDir(dirname(p));
  const text = JSON.stringify(data, null, 2) + '\n';
  // The build machine runs close to full (build-rules: "DISK IS TIGHT"); a transient ENOSPC must not lose a
  // politely fetched page, so the write is retried a few times before giving up.
  for (let attempt = 0; ; attempt++) {
    try {
      writeFileSync(p, text, 'utf8');
      return;
    } catch (err) {
      if (err && err.code === 'ENOSPC' && attempt < 5) {
        console.error(`[common] ENOSPC writing ${p}; retrying in 10 s (${attempt + 1}/5)`);
        const until = Date.now() + 10000;
        while (Date.now() < until) {
          /* busy wait: keep the write synchronous for the callers */
        }
        continue;
      }
      throw err;
    }
  }
}

/** Committed fact file: {case, source, source_url, fetched_at, fetcher_version, values, notes}. */
export function writeFact(p, { caseId, source, sourceUrl, values, notes = [] }) {
  writeJson(p, {
    case: caseId,
    source,
    source_url: sourceUrl,
    fetched_at: nowIso(),
    fetcher_version: FETCHER_VERSION,
    values,
    notes,
  });
}

const RAW_KEEP = 25;

/** Keeps the last few raw pages per site under $env:TEMP for debugging the extractors; best effort only. */
export function saveRaw(site, name, html) {
  try {
    const dir = join(RAW_DIR, site);
    ensureDir(dir);
    const file = join(dir, name.replace(/[^a-z0-9_.-]+/gi, '_') + '.html');
    writeFileSync(file, html, 'utf8');
    const old = readdirSync(dir)
      .filter((f) => f.endsWith('.html'))
      .map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t)
      .slice(RAW_KEEP);
    for (const o of old) rmSync(join(dir, o.f), { force: true });
    return file;
  } catch (err) {
    console.error(`[common] raw page not saved (${err && err.code ? err.code : err}); continuing`);
    return null;
  }
}

export function readCursor() {
  return readJson(CURSOR_FILE, {});
}

export function writeCursor(fetcher, data) {
  const all = readCursor();
  all[fetcher] = { ...data, written_at: nowIso() };
  writeJson(CURSOR_FILE, all);
}

export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > 0) out[a.slice(2, eq)] = a.slice(eq + 1);
      else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) out[a.slice(2)] = argv[++i];
      else out[a.slice(2)] = true;
    } else out._.push(a);
  }
  return out;
}

/**
 * One polite browser session against one site. `load(url, name)` navigates with the delay/cap/captcha rules and
 * returns the page; the caller extracts values with DOM selectors. Loads are counted per process.
 */
export class Session {
  constructor(site, { headless = true, maxLoads = MAX_LOADS_PER_SITE, fetcher = site } = {}) {
    this.site = site;
    this.fetcher = fetcher;
    this.headless = headless;
    this.maxLoads = maxLoads;
    this.loads = 0;
    this.browser = null;
    this.context = null;
    this.page = null;
    this.lastLoadAt = 0;
  }

  async open() {
    this.browser = await chromium.launch({ headless: this.headless });
    // Default UA, default viewport; en-IN locale and Asia/Kolkata so the sites render Indian defaults.
    this.context = await this.browser.newContext({ locale: 'en-IN', timezoneId: 'Asia/Kolkata' });
    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(45000);
    return this.page;
  }

  budgetLeft() {
    return this.maxLoads - this.loads;
  }

  /** Replaces the current tab (pages with beforeunload handlers abort the next navigation otherwise). */
  async newPage() {
    try {
      await this.page?.close({ runBeforeUnload: false });
    } catch {}
    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(45000);
    return this.page;
  }

  /** Waits the polite delay (counted from the previous load), then navigates. Throws BlockedError on a block. */
  async load(url, name, { waitUntil = 'domcontentloaded' } = {}) {
    if (this.loads >= this.maxLoads) throw new Error(`RUN_BUDGET: ${this.maxLoads} page loads reached for ${this.site}`);
    if (this.lastLoadAt) {
      const wait = randomDelayMs() - (Date.now() - this.lastLoadAt);
      if (wait > 0) await sleep(wait);
    }
    this.loads++;
    this.lastLoadAt = Date.now();
    const response = await this.page.goto(url, { waitUntil });
    const status = response ? response.status() : 0;
    const html = await this.page.content();
    saveRaw(this.site, name, html);
    if (status === 429) throw new BlockedError(this.site, url, 'HTTP 429');
    if (status === 403) throw new BlockedError(this.site, url, 'HTTP 403');
    const title = (await this.page.title()) || '';
    const probe = (title + '\n' + html.slice(0, 200000));
    for (const re of BLOCK_PATTERNS) {
      if (re.test(probe)) {
        // Sites embed the reCAPTCHA script on ordinary pages too; only treat it as a block when the page
        // body is a challenge (no substantive content). Callers can override with `isBlocked`.
        if (looksLikeChallenge(html, title)) throw new BlockedError(this.site, url, `pattern ${re}`);
        break;
      }
    }
    return this.page;
  }

  async close() {
    try {
      await this.context?.close();
    } catch {}
    try {
      await this.browser?.close();
    } catch {}
  }
}

function looksLikeChallenge(html, title) {
  if (/not a robot|unusual traffic|verify you are human|are you a human/i.test(html)) return true;
  if (/captcha/i.test(title)) return true;
  // A real reCAPTCHA interstitial is short and carries the widget without the page's own content.
  const textLength = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').length;
  return /g-recaptcha|recaptcha\/api\.js/i.test(html) && textLength < 2500;
}

/**
 * Runs `work(session)`; translates the stop conditions into exit codes:
 * 0 done, 2 run budget reached (resume later), 3 blocked (wait >= 30 min, then resume).
 */
export async function runFetcher(fetcher, site, work, opts = {}) {
  const session = new Session(site, { ...opts, fetcher });
  let code = 0;
  try {
    await session.open();
    await work(session);
    writeCursor(fetcher, { state: 'done', loads: session.loads });
  } catch (err) {
    if (err instanceof BlockedError) {
      console.error(`[${fetcher}] BLOCKED: ${err.message} after ${session.loads} loads. Wait >= 30 min, then rerun (existing outputs are skipped).`);
      writeCursor(fetcher, { state: 'blocked', reason: err.reason, url: err.url, loads: session.loads });
      code = 3;
    } else if (String(err.message).startsWith('RUN_BUDGET')) {
      console.error(`[${fetcher}] ${err.message}; rerun to continue (existing outputs are skipped).`);
      writeCursor(fetcher, { state: 'budget', loads: session.loads });
      code = 2;
    } else {
      console.error(`[${fetcher}] ERROR after ${session.loads} loads:`, err);
      writeCursor(fetcher, { state: 'error', message: String(err.message), loads: session.loads });
      code = 1;
    }
  } finally {
    await session.close();
  }
  console.error(`[${fetcher}] page loads this run: ${session.loads}`);
  process.exit(code);
}

/** Parses "06:26 AM" / "6:26:14 PM" / "05:05 PM, Oct 23" style times to {hh, mm, ss, dayOffsetText}. */
export function parseClock(text) {
  const m = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i.exec(text);
  if (!m) return null;
  let hh = Number(m[1]);
  const mm = Number(m[2]);
  const ss = m[3] ? Number(m[3]) : 0;
  const ap = m[4] ? m[4].toUpperCase() : null;
  if (ap === 'PM' && hh < 12) hh += 12;
  if (ap === 'AM' && hh === 12) hh = 0;
  return { hh, mm, ss };
}

export function pad2(n) {
  return n < 10 ? `0${n}` : String(n);
}

export function hhmm(c) {
  return c ? `${pad2(c.hh)}:${pad2(c.mm)}${c.ss ? ':' + pad2(c.ss) : ''}` : null;
}
