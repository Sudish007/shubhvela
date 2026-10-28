// Phase C cluster C04 (FEAT-C04): Prashna (F18), Ask my chart (F35), encrypted backup/restore, deep links (F37).
// - deviceGate matrix (API 30 / 5 GB RAM / 3 GB free each fail with the right reason; a 12 / 6 GB / 4 GB phone passes);
// - the download machine starts only on Wi-Fi, pauses on Wi-Fi loss and never resumes by itself, verifies size + SHA-256
//   and deletes on mismatch (fake task / network / file ops);
// - the prompt carries the six system rules, the chart JSON and only the snippets the question names;
// - the bridge over a fake module: load -> generate -> unload, the OOM and missing paths, an absent module = unavailable;
// - Prashna: the reading rows all carry rule ids, the screen saves a row and the history lists / deletes it;
// - backup: encrypt/decrypt round trip with Node's crypto (same format as react-native-quick-crypto), wrong passphrase
//   rejected, export -> import Merge and Replace, a failing import leaves nothing behind (transaction);
// - deep links: the four kinds through the shared M8 parser plus the invalid cases;
// - the "More from this chart" card: Prashna first for a time-unknown profile, the honest Ask row; the AI label text.
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'node:crypto';
import { router } from 'expo-router';
import { NetworkStateType, type NetworkState } from 'expo-network';
import { PixelRatio } from 'react-native';
import { ASK_RULE_IDS, computeChartAt, dailyNote, localDateOf, toDeepLink } from '@shubhvela/engine';
import { loadUi } from '@shubhvela/content';
import ChartsScreen from '../app/(tabs)/charts';
import TodayScreen from '../app/(tabs)/today';
import AskGateScreen from '../app/charts/ask/gate';
import AskChatScreen from '../app/charts/ask/chat';
import AskConsentScreen from '../app/charts/ask/consent';
import PrashnaHistoryScreen from '../app/charts/prashna/history';
import PrashnaScreen from '../app/charts/prashna/index';
import { resetAdPolicyForTests } from '../src/ads/AdPolicy';
import { askRouteFor, askRowState } from '../src/ai/askState';
import { AskBridge, AskError, classifyError, LOAD_OPTIONS, type LiteRtModule } from '../src/ai/bridge';
import { evaluateDeviceGate, MIN_API_LEVEL, MIN_FREE_BYTES, MIN_RAM_BYTES } from '../src/ai/deviceGate';
import { isWifi, ModelDownloader, type DownloadDeps, type TaskLike } from '../src/ai/download';
import { AiLabel } from '../src/ai/Label';
import { MODEL_BYTES, MODEL_SHA256, MODEL_URL, modelSizeLabel } from '../src/ai/model';
import { modelStatus, readPersistedDownload, type ModelFileOps } from '../src/ai/modelStore';
import { ASK_MAX, buildPrompt, citedRuleIds, detectHouses, detectPlanets, PROMPT_CHAR_BUDGET, relevantSnippetIds, SYSTEM_RULE_IDS, validateAskQuestion, chartJson } from '../src/ai/prompt';
import { applyBackup } from '../src/backup/apply';
import { BackupScreen } from '../src/backup/BackupScreen';
import { BackupError, decryptBackup, encryptBackup, HEADER_BYTES, PBKDF2_ITERATIONS, readHeader, type CryptoProvider } from '../src/backup/crypto';
import type { BackupDeps } from '../src/backup/deps';
import { BACKUP_TABLES, collectBackup, countsOf, parseBackupDocument } from '../src/backup/document';
import { MoreFromChartCard } from '../src/charts/MoreFromChartCard';
import { castPrashna, PRASHNA_MAX, validateQuestion } from '../src/charts/prashnaModel';
import { moreFromChartOrder } from '../src/charts/unlockState';
import { listAncestors, insertAncestor } from '../src/db/ancestors';
import { getDb } from '../src/db/connection';
import { countEnabledSeries, setSeriesEnabled } from '../src/db/eventSeries';
import { saveJournalEntry, countJournalEntries } from '../src/db/journal';
import { countPrashna, insertPrashna, listPrashna } from '../src/db/prashna';
import { countProfiles, getProfile, insertProfile, listProfiles } from '../src/db/profiles';
import { getSetting, setSetting } from '../src/db/settings';
import { parseDeepLink, prefillFromQuery, routeForTarget, splitDeepLink } from '../src/deeplinks';
import { formFromPrefill, errorsFromPrefill } from '../src/deeplink/LinkScreens';
import { SAMPLE_AMMA, SAMPLE_DADAJI, SAMPLE_PRIYA } from '../src/dev/seed';
import { grantUnlock, setEntitlement } from '../src/entitlements';
import { chartFor, clearChartCache, dashaFor } from '../src/engine-bridge/charts';
import { makeT } from '../src/i18n';
import { installTestDb } from './helpers/nodeDb';
import { allTexts, renderWithProviders, textOf } from './helpers/render';

const NOW = Date.UTC(2026, 9, 22, 5, 28); // Thu 22 Oct 2026 10:58 IST
const now = () => NOW;
const t = makeT('en');
const GIB = 1024 ** 3;

/** Node's crypto behind the backup provider interface: the same algorithms react-native-quick-crypto runs on the phone. */
const nodeCrypto: CryptoProvider = {
  randomBytes: (n) => new Uint8Array(randomBytes(n)),
  pbkdf2Sha256: (pass, salt, iterations, len) => new Uint8Array(pbkdf2Sync(pass, salt, iterations, len, 'sha256')),
  createAesGcmCipher: (key, iv) => {
    const c = createCipheriv('aes-256-gcm', key, iv);
    return { update: (d) => new Uint8Array(c.update(d)), final: () => new Uint8Array(c.final()), getAuthTag: () => new Uint8Array(c.getAuthTag()) };
  },
  createAesGcmDecipher: (key, iv) => {
    const d = createDecipheriv('aes-256-gcm', key, iv);
    return { setAuthTag: (tag) => void d.setAuthTag(tag), update: (x) => new Uint8Array(d.update(x)), final: () => new Uint8Array(d.final()) };
  },
};
/** Fewer PBKDF2 rounds in the round-trip tests (the header records the count; the production constant is asserted separately). */
const FAST_ITER = 1000;

async function goPro(): Promise<void> {
  await act(async () => {
    setEntitlement('shubhvela_pro', 'active', 'tok', new Date(NOW));
  });
}

function texts(): string[] {
  return allTexts().map((x) => textOf(x));
}

describe('C04 device gate (F35)', () => {
  const ok = { apiLevel: 33, osVersion: '13', totalMemory: 6 * GIB, freeBytes: 20 * GIB };
  it('a 12+ / 6 GB / 4 GB phone is supported; every threshold is the spec number', () => {
    expect(MIN_API_LEVEL).toBe(31);
    expect(MIN_FREE_BYTES).toBe(4 * GIB);
    expect(MIN_RAM_BYTES).toBeLessThanOrEqual(6 * GIB);
    expect(MIN_RAM_BYTES).toBeGreaterThan(5 * GIB);
    const g = evaluateDeviceGate(ok);
    expect(g.supported).toBe(true);
    expect(g.failing).toEqual([]);
    expect(g.reasons.map((r) => r.value)).toEqual(['13', '6', '20.0']);
  });
  it('API 30 fails on android only', () => {
    const g = evaluateDeviceGate({ ...ok, apiLevel: 30, osVersion: '11' });
    expect(g.supported).toBe(false);
    expect(g.failing).toEqual(['android']);
  });
  it('5 GB RAM fails on ram only (a marketed 6 GB phone reporting 5.7 GiB passes)', () => {
    expect(evaluateDeviceGate({ ...ok, totalMemory: 5 * GIB }).failing).toEqual(['ram']);
    expect(evaluateDeviceGate({ ...ok, totalMemory: 5_000_000_000 }).failing).toEqual(['ram']);
    expect(evaluateDeviceGate({ ...ok, totalMemory: 5.7 * GIB }).supported).toBe(true);
    expect(evaluateDeviceGate({ ...ok, totalMemory: 5.7 * GIB }).reasons[1].value).toBe('6');
  });
  it('3 GB free fails on storage only; unknown facts fail; the x86_64 emulator profile fails on ram', () => {
    expect(evaluateDeviceGate({ ...ok, freeBytes: 3 * GIB }).failing).toEqual(['storage']);
    expect(evaluateDeviceGate({ apiLevel: null, osVersion: null, totalMemory: null, freeBytes: null }).failing).toEqual(['android', 'ram', 'storage']);
    // AVD shubhvela_test (plan P15) boots API 34 with 2 GB RAM: the honest unsupported row, never a cloud fallback.
    const emu = evaluateDeviceGate({ apiLevel: 34, osVersion: '14', totalMemory: 2 * GIB, freeBytes: 6 * GIB });
    expect(emu.supported).toBe(false);
    expect(emu.failing).toEqual(['ram']);
  });
  it('row state: gate first, then tier, then model; routes', () => {
    const bad = evaluateDeviceGate({ ...ok, apiLevel: 30 });
    const good = evaluateDeviceGate(ok);
    expect(askRowState(true, bad, 'ready')).toBe('unsupported');
    expect(askRowState(false, good, 'ready')).toBe('pro');
    expect(askRowState(true, good, 'absent')).toBe('download');
    expect(askRowState(true, good, 'partial')).toBe('download');
    expect(askRowState(true, good, 'ready')).toBe('ready');
    expect(askRouteFor('unsupported')).toBe('/charts/ask/gate');
    expect(askRouteFor('pro')).toBe('/charts/ask/gate');
    expect(askRouteFor('download')).toBe('/charts/ask/consent');
    expect(askRouteFor('ready')).toBe('/charts/ask/chat');
  });
  it('the model facts are the verified Hugging Face values and the size label is computed', () => {
    expect(MODEL_URL).toBe('https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it.litertlm');
    expect(MODEL_BYTES).toBe(2_588_147_712);
    expect(MODEL_SHA256).toBe('181938105e0eefd105961417e8da75903eacda102c4fce9ce90f50b97139a63c');
    expect(modelSizeLabel()).toBe('2.6 GB');
    // The pinned consent strings carry the same figure the constant computes (D8: one number, not two).
    for (const lang of ['en', 'hi', 'bho'] as const) {
      const ui = loadUi(lang);
      expect(ui['ask.consentSize']).toContain(modelSizeLabel());
      expect(ui['ask.consentCta']).toContain(modelSizeLabel());
      expect(ui['ask.rowDownload']).toContain(modelSizeLabel());
    }
  });
});

// ---- download machine ----

class FakeTask implements TaskLike {
  resolve: ((v: unknown | null) => void) | null = null;
  reject: ((e: unknown) => void) | null = null;
  pausedCalls = 0;
  cancelled = false;
  released = false;
  constructor(
    private readonly onProgress: (p: { bytesWritten: number; totalBytes: number }) => void,
    readonly deps: { files: FakeFiles },
  ) {}
  private pending(): Promise<unknown | null> {
    return new Promise((res, rej) => {
      this.resolve = res;
      this.reject = rej;
    });
  }
  downloadAsync(): Promise<unknown | null> {
    return this.pending();
  }
  resumeAsync(): Promise<unknown | null> {
    return this.pending();
  }
  async pauseAsync(): Promise<void> {
    this.pausedCalls++;
    this.resolve?.(null);
  }
  cancel(): void {
    this.cancelled = true;
    this.reject?.(new Error('cancelled'));
  }
  savable() {
    return { url: MODEL_URL, fileUri: 'file:///models/x', isDirectory: false, resumeData: 'resume-token' };
  }
  release(): void {
    this.released = true;
  }
  progress(bytes: number): void {
    this.onProgress({ bytesWritten: bytes, totalBytes: MODEL_BYTES });
  }
  complete(bytes: number): void {
    this.deps.files.bytes = bytes;
    this.resolve?.({ uri: 'file:///models/x' });
  }
}

class FakeFiles implements ModelFileOps {
  bytes: number | null = null;
  hash = MODEL_SHA256;
  deleted = 0;
  uri() {
    return 'file:///models/gemma-4-E2B-it.litertlm';
  }
  exists() {
    return this.bytes !== null;
  }
  size() {
    return this.bytes;
  }
  delete() {
    this.bytes = null;
    this.deleted++;
  }
  async sha256() {
    return this.hash;
  }
  ensureDir() {}
}

function fakeDeps(initial: NetworkState) {
  const files = new FakeFiles();
  let net = initial;
  const listeners = new Set<(s: NetworkState) => void>();
  const tasks: FakeTask[] = [];
  const deps: DownloadDeps = {
    createTask: (onProgress) => {
      const task = new FakeTask(onProgress, { files });
      tasks.push(task);
      return task;
    },
    restoreTask: (_state, onProgress) => {
      const task = new FakeTask(onProgress, { files });
      tasks.push(task);
      return task;
    },
    networkState: async () => net,
    onNetworkChange: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    files,
  };
  const setNetwork = (s: NetworkState) => {
    net = s;
    listeners.forEach((l) => l(s));
  };
  return { deps, files, tasks, setNetwork, listeners };
}

const WIFI: NetworkState = { type: NetworkStateType.WIFI, isConnected: true, isInternetReachable: true };
const CELL: NetworkState = { type: NetworkStateType.CELLULAR, isConnected: true, isInternetReachable: true };
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('C04 model download (F35)', () => {
  let close: () => void;
  beforeEach(() => {
    ({ close } = installTestDb());
  });
  afterEach(() => close());

  it('isWifi reads only the WIFI type', () => {
    expect(isWifi(WIFI)).toBe(true);
    expect(isWifi(CELL)).toBe(false);
    expect(isWifi({ type: NetworkStateType.WIFI, isConnected: false })).toBe(false);
    expect(isWifi(null)).toBe(false);
  });

  it('does not start on mobile data: paused with the Wi-Fi reason and no task created', async () => {
    const f = fakeDeps(CELL);
    const dl = new ModelDownloader(f.deps);
    await dl.start();
    expect(dl.state).toEqual({ kind: 'paused', reason: 'wifi', bytes: 0 });
    expect(f.tasks).toHaveLength(0);
    // An explicit resume on mobile data is refused the same way (never resumes on data).
    await dl.resume();
    expect(f.tasks).toHaveLength(0);
    expect(dl.state.kind).toBe('paused');
  });

  it('starts on Wi-Fi, reports progress, pauses on Wi-Fi loss and does NOT resume by itself when Wi-Fi returns', async () => {
    const f = fakeDeps(WIFI);
    const dl = new ModelDownloader(f.deps);
    const phases: string[] = [];
    dl.subscribe((p) => phases.push(p.kind));
    const run = dl.start();
    await flush();
    expect(f.tasks).toHaveLength(1);
    f.tasks[0].progress(1_000_000_000);
    expect(dl.state).toEqual({ kind: 'downloading', bytes: 1_000_000_000, total: MODEL_BYTES });
    f.setNetwork(CELL);
    await flush();
    await run;
    expect(dl.state).toEqual({ kind: 'paused', reason: 'wifi', bytes: 1_000_000_000 });
    expect(f.tasks[0].pausedCalls).toBe(1);
    expect(readPersistedDownload().savable).toContain('resume-token');
    expect(readPersistedDownload().bytesWritten).toBe(1_000_000_000);
    f.setNetwork(WIFI);
    await flush();
    expect(dl.state.kind).toBe('paused');
    expect(f.tasks).toHaveLength(1);
    // The user's tap resumes the SAME task.
    const resumed = dl.resume();
    await flush();
    expect(dl.state.kind).toBe('downloading');
    f.tasks[0].complete(MODEL_BYTES);
    await resumed;
    expect(dl.state).toEqual({ kind: 'ready' });
    expect(phases).toContain('verifying');
    expect(readPersistedDownload()).toEqual({ savable: null, bytesWritten: MODEL_BYTES, verified: true });
    expect(modelStatus(f.files)).toBe('ready');
  });

  it('deletes the file on a size mismatch and on a SHA-256 mismatch', async () => {
    const f = fakeDeps(WIFI);
    const dl = new ModelDownloader(f.deps);
    let run = dl.start();
    await flush();
    f.tasks[0].complete(MODEL_BYTES - 1);
    await run;
    expect(dl.state).toEqual({ kind: 'failed', reason: 'size', bytes: MODEL_BYTES - 1 });
    expect(f.files.deleted).toBe(1);
    expect(f.files.exists()).toBe(false);
    f.files.hash = 'deadbeef';
    run = dl.start();
    await flush();
    f.tasks[1].complete(MODEL_BYTES);
    await run;
    expect(dl.state).toEqual({ kind: 'failed', reason: 'checksum', bytes: 0 });
    expect(f.files.deleted).toBe(2);
    expect(modelStatus(f.files)).toBe('absent');
  });

  it('cancel deletes the partial file and forgets the paused state', async () => {
    const f = fakeDeps(WIFI);
    const dl = new ModelDownloader(f.deps);
    const run = dl.start();
    await flush();
    f.files.bytes = 5000;
    dl.cancel();
    await run.catch(() => undefined);
    await flush();
    expect(dl.state).toEqual({ kind: 'idle' });
    expect(f.files.exists()).toBe(false);
    expect(readPersistedDownload().savable).toBeNull();
    expect(f.tasks[0].cancelled).toBe(true);
  });

  it('a persisted paused state restores on the next launch and resumes through restoreTask', async () => {
    const f = fakeDeps(WIFI);
    const first = new ModelDownloader(f.deps);
    const run = first.start();
    await flush();
    await first.pause('user');
    await run;
    expect(first.state).toEqual({ kind: 'paused', reason: 'user', bytes: 0 });
    const second = new ModelDownloader(f.deps);
    expect(second.state.kind).toBe('paused');
    const resumed = second.start();
    await flush();
    expect(f.tasks).toHaveLength(2);
    f.tasks[1].complete(MODEL_BYTES);
    await resumed;
    expect(second.state).toEqual({ kind: 'ready' });
  });
});

// ---- bridge ----

function fakeModule(opts: { loadError?: (backend: string) => Error | null; generate?: (p: string) => Promise<string>; available?: boolean } = {}) {
  const calls: string[] = [];
  const mod: LiteRtModule = {
    isLiteRtAvailable: async () => opts.available ?? true,
    loadLiteRtModel: async (path, o) => {
      calls.push(`load:${o?.preferredBackend}:${o?.maxTokens}:${o?.topK}:${o?.temperature}`);
      const err = opts.loadError?.(o?.preferredBackend ?? 'default');
      if (err) throw err;
      return { modelPath: path, backend: o?.preferredBackend ?? 'default' };
    },
    generateLiteRtResponse: async (p) => {
      calls.push('generate');
      return opts.generate ? opts.generate(p) : `Answer citing [${SYSTEM_RULE_IDS[0]}].`;
    },
    unloadLiteRtModel: async () => {
      calls.push('unload');
    },
  };
  return { mod, calls };
}

describe('C04 bridge over a mocked expo-litert-lm (P18)', () => {
  it('load (gpu, plan options) -> generate -> unload', async () => {
    const { mod, calls } = fakeModule();
    const b = new AskBridge({ module: mod, modelExists: () => true });
    expect(await b.isAvailable()).toBe(true);
    await b.load('/data/models/gemma-4-E2B-it.litertlm');
    expect(b.isLoaded).toBe(true);
    expect(b.activeBackend).toBe('gpu');
    const answer = await b.generate('prompt');
    expect(answer).toContain(SYSTEM_RULE_IDS[0]);
    await b.unload();
    expect(b.isLoaded).toBe(false);
    expect(calls).toEqual([`load:gpu:${LOAD_OPTIONS.maxTokens}:${LOAD_OPTIONS.topK}:${LOAD_OPTIONS.temperature}`, 'generate', 'unload']);
    expect(LOAD_OPTIONS).toEqual({ maxTokens: 2048, topK: 40, temperature: 0.6 });
  });
  it('falls back to the CPU backend when the GPU load fails for a non-memory reason', async () => {
    const { mod, calls } = fakeModule({ loadError: (b) => (b === 'gpu' ? new Error('GPU delegate not supported') : null) });
    const b = new AskBridge({ module: mod });
    await b.load('/m');
    expect(b.activeBackend).toBe('cpu');
    expect(calls.filter((c) => c.startsWith('load'))).toHaveLength(2);
  });
  it('OOM on load surfaces as AskError oom (no CPU retry on a memory error); missing file as missing; no module as unavailable', async () => {
    const oom = fakeModule({ loadError: () => new Error('Failed to allocate: out of memory') });
    await expect(new AskBridge({ module: oom.mod }).load('/m')).rejects.toMatchObject({ code: 'oom' });
    expect(oom.calls.filter((c) => c.startsWith('load'))).toHaveLength(1);
    await expect(new AskBridge({ module: fakeModule().mod, modelExists: () => false }).load('/m')).rejects.toMatchObject({ code: 'missing' });
    const none = new AskBridge({ module: null });
    expect(await none.isAvailable()).toBe(false);
    await expect(none.load('/m')).rejects.toMatchObject({ code: 'unavailable' });
    await expect(none.generate('x')).rejects.toBeInstanceOf(AskError);
    expect(classifyError(new Error('ENOENT: no such file'))).toBe('missing');
    expect(classifyError(new Error('OutOfMemoryError'))).toBe('oom');
    expect(classifyError(new Error('weird'))).toBe('failed');
  });
  it('generate before load is a missing-model error; a generation failure maps to failed', async () => {
    const { mod } = fakeModule({ generate: async () => Promise.reject(new Error('session closed')) });
    const b = new AskBridge({ module: mod });
    await expect(b.generate('x')).rejects.toMatchObject({ code: 'missing' });
    await b.load('/m');
    await expect(b.generate('x')).rejects.toMatchObject({ code: 'failed' });
  });
});

// ---- prompt ----

describe('C04 prompt (F35)', () => {
  let close: () => void;
  beforeEach(() => {
    ({ close } = installTestDb());
    clearChartCache();
    insertProfile(SAMPLE_PRIYA, new Date(NOW));
  });
  afterEach(() => close());

  function built(question: string, lang: 'en' | 'hi' = 'en') {
    const p = getProfile(1)!;
    const chart = chartFor(p);
    const tree = dashaFor(chart);
    const today = dailyNote(chart, localDateOf(NOW, p.tz), { lat: p.lat, lon: p.lon }, p.tz);
    return { chart, tree, today, out: buildPrompt({ chart, tree, today, nowMs: NOW, question, lang, profileName: 'Priya' }) };
  }

  it('contains the six system rules (ASK_RULE_IDS minus the label), the chart JSON and the question, within the budget', () => {
    expect(SYSTEM_RULE_IDS).toEqual(ASK_RULE_IDS.filter((id) => id !== 'ask-label'));
    expect(SYSTEM_RULE_IDS).toHaveLength(6);
    const { chart, tree, today, out } = built('What does my Moon say about my mind?');
    for (const id of SYSTEM_RULE_IDS) expect(out.prompt).toContain(`[${id}]`);
    const json = chartJson(chart, tree, NOW, today);
    expect(out.prompt).toContain(JSON.stringify(json));
    expect(json.planets).toHaveLength(9);
    expect(Object.keys(json.houses)).toHaveLength(12);
    expect(json.dasha).not.toBeNull();
    expect(json.today.length).toBeGreaterThan(0);
    expect(out.prompt).toContain('QUESTION: What does my Moon say about my mind?');
    expect(out.chars).toBeLessThanOrEqual(PROMPT_CHAR_BUDGET);
    expect(out.prompt).not.toMatch(/http|cloud|api/i);
  });

  it('includes only snippets matching the question (baseline Lagna + Moon + dasha pair, then the named planet)', () => {
    const { chart, out } = built('Where is Saturn in my chart?');
    const sat = chart.planets.find((p) => p.id === 'Sa')!;
    const moon = chart.planets.find((p) => p.id === 'Mo')!;
    expect(out.snippetIds).toContain(`saturn-${['mesha', 'vrishabha', 'mithuna', 'karka', 'simha', 'kanya', 'tula', 'vrishchika', 'dhanu', 'makara', 'kumbha', 'meena'][sat.sign - 1]}`);
    expect(out.snippetIds).toContain(`saturn-${sat.house}`);
    expect(out.snippetIds).toContain(`moon-${moon.house}`);
    expect(out.snippetIds.some((id) => id.startsWith('lagna-'))).toBe(true);
    expect(out.snippetIds.some((id) => id.startsWith('dasha-'))).toBe(true);
    // Mars was not named and does not rule / occupy a named house: its snippets stay out.
    const mars = chart.planets.find((p) => p.id === 'Ma')!;
    const marsNamedThroughHouse = [...out.snippetIds].some((id) => id === `mars-${mars.house}`);
    expect(detectPlanets('Where is Saturn in my chart?', 'en')).toEqual(['Sa']);
    if (!marsNamedThroughHouse) expect(out.snippetIds.filter((id) => id.startsWith('mars-'))).toEqual([]);
    expect(out.ruleIds.slice(0, 6)).toEqual([...SYSTEM_RULE_IDS]);
  });

  it('house themes and explicit house numbers pull the house lord and occupants', () => {
    expect(detectHouses('Will my career change? Anything about the 7th house?')).toEqual([7, 10]);
    expect(detectHouses('नौकरी और विवाह के बारे में')).toEqual([7, 6, 10].sort((a, b) => a - b));
    const { chart, out } = built('What about my career?');
    const tenth = chart.houses.find((h) => h.n === 10)!;
    expect(out.snippetIds.some((id) => id.startsWith(`${{ Su: 'sun', Mo: 'moon', Ma: 'mars', Me: 'mercury', Ju: 'jupiter', Ve: 'venus', Sa: 'saturn', Ra: 'rahu', Ke: 'ketu' }[tenth.lord]}-`))).toBe(true);
    const json = chartJson(chart, dashaFor(chart), NOW, []);
    const refs = relevantSnippetIds(chart, json, 'career', 'en');
    expect(refs[0].domain).toBe('lagna');
  });

  it('trims to the budget (dropped ids recorded) and validates the 300-character limit', () => {
    const { out } = built('Tell me about Sun Moon Mars Mercury Jupiter Venus Saturn Rahu Ketu career marriage money health children home travel');
    expect(out.chars).toBeLessThanOrEqual(PROMPT_CHAR_BUDGET);
    expect(out.dropped.length).toBeGreaterThan(0);
    expect(ASK_MAX).toBe(300);
    expect(validateAskQuestion('')).toBe('empty');
    expect(validateAskQuestion('x'.repeat(301))).toBe('tooLong');
    expect(validateAskQuestion('x'.repeat(300))).toBeNull();
    expect(citedRuleIds('Because [moon-4] and [dasha-Sa-Ju] and [made-up].', ['moon-4', 'dasha-Sa-Ju'])).toEqual(['moon-4', 'dasha-Sa-Ju']);
  });
});

// ---- Prashna ----

describe('C04 Prashna (F18)', () => {
  let close: () => void;
  beforeEach(() => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1);
    ({ close } = installTestDb());
    clearChartCache();
    resetAdPolicyForTests();
    (router.push as jest.Mock).mockClear();
    insertProfile(SAMPLE_PRIYA, new Date(NOW));
  });
  afterEach(() => close());

  it('question validation: required, <= 120 code points', () => {
    expect(PRASHNA_MAX).toBe(120);
    expect(validateQuestion('   ')).toBe('empty');
    expect(validateQuestion('क'.repeat(120))).toBeNull();
    expect(validateQuestion('क'.repeat(121))).toBe('tooLong');
  });

  it('castPrashna: the chart of the instant at the observer, every row with a rule id and the snippet it came from', () => {
    const obs = { lat: 26.85, lon: 80.95, tz: 'Asia/Kolkata', placeName: 'Lucknow, Uttar Pradesh, India' };
    const r = castPrashna(NOW, obs, 'en', t);
    const direct = computeChartAt(NOW, { lat: obs.lat, lon: obs.lon }, obs.tz, { ayanamsa: getSetting('ayanamsa'), node: getSetting('node') });
    expect(r.chart.firstHouseSign).toBe(direct.firstHouseSign);
    expect(r.chart.lagna?.longitude).toBe(direct.lagna?.longitude);
    expect(r.lagnaLord).toBe(direct.houses[0].lord);
    expect(r.hora).not.toBeNull();
    expect(r.rows.length).toBeGreaterThanOrEqual(6);
    for (const row of r.rows) {
      expect(row.ruleId).toBeTruthy();
      expect(row.text.length).toBeGreaterThan(0);
    }
    expect(r.rows[0].ruleId).toBe('prashna-chart-of-the-moment');
    expect(r.rows[1].ruleId).toBe('prashna-lagna-of-the-hour');
    expect(r.rows.at(-1)!.ruleId).toBe('prashna-question-private');
    expect(r.snippetIds.some((id) => id.startsWith('lagna-'))).toBe(true);
    expect(r.rows[0].text).toContain('Lucknow');
    // The same instant and place always give the same reading (history re-renders from the stored facts).
    expect(castPrashna(NOW, obs, 'en', t).rows.map((x) => x.text)).toEqual(r.rows.map((x) => x.text));
  });

  it('screen: locked on free -> unlock sheet; after the 24-h unlock a question is cast, saved and listed; delete removes it', async () => {
    await renderWithProviders(<PrashnaScreen now={now} profileId={1} />);
    expect(screen.getByTestId('prashna-locked')).toBeTruthy();
    await act(async () => {
      grantUnlock('prashna', new Date(NOW));
    });
    expect(screen.queryByTestId('prashna-locked')).toBeNull();
    await fireEvent.press(screen.getByTestId('prashna-cast'));
    expect(texts()).toContain(t('prashna.questionEmpty'));
    await fireEvent.changeText(screen.getByTestId('prashna-question'), 'Should I take the new job?');
    await fireEvent.press(screen.getByTestId('prashna-cast'));
    expect(screen.getByTestId('prashna-reading-card')).toBeTruthy();
    expect(screen.getByTestId('prashna-chart')).toBeTruthy();
    expect(screen.getByTestId('prashna-row-moment')).toBeTruthy();
    expect(screen.getByTestId('prashna-row-private')).toBeTruthy();
    expect(screen.getByTestId('prashna-how')).toBeTruthy();
    const rows = listPrashna();
    expect(rows).toHaveLength(1);
    expect(rows[0].question).toBe('Should I take the new job?');
    expect(rows[0].ts).toBe(new Date(NOW).toISOString());
    expect(rows[0].lat).toBe(26.85);
    expect(rows[0].tz).toBe('Asia/Kolkata');
    await screen.unmount();

    await renderWithProviders(<PrashnaHistoryScreen now={now} />);
    expect(screen.getByTestId(`prashna-history-${rows[0].id}`)).toBeTruthy();
    expect(texts()).toContain('Should I take the new job?');
    await fireEvent.press(screen.getByTestId(`prashna-history-open-${rows[0].id}`));
    expect(router.push).toHaveBeenCalledWith(`/charts/prashna?id=${rows[0].id}`);
    await fireEvent.press(screen.getByTestId(`prashna-history-delete-${rows[0].id}`));
    await fireEvent.press(screen.getByTestId('prashna-delete-confirm'));
    expect(countPrashna()).toBe(0);
    expect(screen.getByTestId('prashna-deleted')).toBeTruthy();
    expect(texts()).toContain(t('prashna.historyEmpty'));
    await screen.unmount();

    // A stored entry re-renders its reading from the stored instant (no interpretation stored).
    const id = insertPrashna({ question: 'Stored question', ts: new Date(NOW).toISOString(), lat: 28.61, lon: 77.21, tz: 'Asia/Kolkata' });
    await renderWithProviders(<PrashnaScreen now={now} profileId={1} entryId={id} />);
    expect(textOf(screen.getByTestId('prashna-shown-question'))).toBe('Stored question');
    expect(screen.getByTestId('prashna-chart')).toBeTruthy();
  });

  it('More from this chart: Prashna is the FIRST row for a time-unknown profile, after Varshaphal otherwise', () => {
    expect(moreFromChartOrder(true)[0]).toBe('prashna');
    expect(moreFromChartOrder(false)).toEqual(['vargas', 'ashtakavarga', 'kp', 'varshaphal', 'prashna']);
  });

  it('Charts tab renders the Prashna row and the Ask row with the honest unsupported text; tapping opens the gate', async () => {
    await renderWithProviders(<ChartsScreen now={now} chartWidth={326} ask={() => 'unsupported'} />);
    expect(screen.getByTestId('more-row-prashna')).toBeTruthy();
    expect(textOf(screen.getByTestId('more-state-ask'))).toBe(t('ask.rowUnsupported'));
    expect(t('ask.rowUnsupported')).toBe('Not available on this phone — needs Android 12, 6 GB RAM and 4 GB free');
    await fireEvent.press(screen.getByTestId('more-row-ask'));
    expect(router.push).toHaveBeenCalledWith('/charts/ask/gate?profile=1');
    // Prashna is locked on free: the unlock sheet for that key opens.
    await fireEvent.press(screen.getByTestId('more-row-prashna'));
    expect(screen.getByTestId('unlock-watch')).toBeTruthy();
  });
});

// ---- Ask screens ----

describe('C04 Ask my chart screens (F35)', () => {
  let close: () => void;
  beforeEach(() => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1);
    ({ close } = installTestDb());
    clearChartCache();
    resetAdPolicyForTests();
    (router.push as jest.Mock).mockClear();
    (router.replace as jest.Mock).mockClear();
    insertProfile(SAMPLE_PRIYA, new Date(NOW));
  });
  afterEach(() => close());

  const emulator = evaluateDeviceGate({ apiLevel: 34, osVersion: '14', totalMemory: 2 * GIB, freeBytes: 6 * GIB });
  const phone = evaluateDeviceGate({ apiLevel: 34, osVersion: '14', totalMemory: 8 * GIB, freeBytes: 12 * GIB });

  it('gate screen on the emulator: the three rows with values, ram below, the unsupported sentence, no download / no cloud', async () => {
    await renderWithProviders(<AskGateScreen snapshot={() => ({ state: 'unsupported', gate: emulator, status: 'absent' })} />);
    expect(textOf(screen.getByTestId('ask-gate-android-state'))).toBe(t('ask.gatePass'));
    expect(textOf(screen.getByTestId('ask-gate-ram-state'))).toBe(t('ask.gateFail'));
    expect(textOf(screen.getByTestId('ask-gate-storage-state'))).toBe(t('ask.gatePass'));
    expect(texts().join('\n')).toContain('Memory: 2 GB (needs 6)');
    expect(textOf(screen.getByTestId('ask-gate-unsupported'))).toBe(t('ask.rowUnsupported'));
    expect(screen.queryByTestId('ask-gate-open')).toBeNull();
    expect(screen.queryByTestId('ask-gate-go-pro')).toBeNull();
    // The body states the absence of an online version; no screen offers one.
    expect(texts().join('\n')).toContain('There is no online version');
    expect(texts().join('\n')).not.toMatch(/cloud|server|try online/i);
  });

  it('gate screen on a supported free phone offers Pro; on Pro without the model it continues to consent', async () => {
    await renderWithProviders(<AskGateScreen snapshot={() => ({ state: 'pro', gate: phone, status: 'absent' })} />);
    expect(screen.getByTestId('ask-gate-go-pro')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('ask-gate-go-pro'));
    expect(router.push).toHaveBeenCalledWith('/pro');
    await screen.unmount();
    await renderWithProviders(<AskGateScreen snapshot={() => ({ state: 'download', gate: phone, status: 'absent' })} />);
    await fireEvent.press(screen.getByTestId('ask-gate-open'));
    expect(router.push).toHaveBeenCalledWith('/charts/ask/consent');
  });

  it('consent: size, Wi-Fi, storage path, delete, offline, model + terms link, sticky CTA; the CTA opens the download', async () => {
    const openUrl = jest.fn(async () => true);
    await renderWithProviders(<AskConsentScreen openUrl={openUrl} location="/data/user/0/com.shubhvela.app/files/models" />);
    expect(textOf(screen.getByTestId('ask-consent-size'))).toBe('Model size: 2.6 GB');
    expect(textOf(screen.getByTestId('ask-consent-storage'))).toContain('/data/user/0/com.shubhvela.app/files/models');
    for (const id of ['ask-consent-wifi', 'ask-consent-delete', 'ask-consent-offline', 'ask-consent-model']) expect(screen.getByTestId(id)).toBeTruthy();
    expect(screen.getByTestId('screen-cta')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('ask-consent-terms'));
    expect(openUrl).toHaveBeenCalledWith('https://ai.google.dev/gemma/terms');
    await fireEvent.press(screen.getByTestId('ask-consent-download'));
    expect(router.replace).toHaveBeenCalledWith('/charts/ask/download');
  });

  it('chat: Thinking… then the whole answer under the exact 13 sp label and the rule ids; OOM shows Delete model / Retry', async () => {
    await goPro();
    let fail = false;
    const { mod } = fakeModule({
      generate: async (prompt) => {
        if (fail) throw new Error('out of memory');
        const id = /\[(moon-\d+)\]/.exec(prompt)?.[1] ?? SYSTEM_RULE_IDS[0];
        return `The Moon's house is read for the mind [${id}].`;
      },
    });
    const bridge = new AskBridge({ module: mod, modelExists: () => true });
    await renderWithProviders(<AskChatScreen now={now} profileId={1} bridge={bridge} snapshot={() => ({ state: 'ready', gate: phone, status: 'ready' })} modelPath={() => '/m'} />);
    await fireEvent.changeText(screen.getByTestId('ask-chat-question'), 'What does my Moon say?');
    await fireEvent.press(screen.getByTestId('ask-chat-send'));
    expect(screen.getByTestId('ask-turn-1-answer')).toBeTruthy();
    expect(textOf(screen.getByTestId('ask-turn-1-label-text'))).toBe('AI explanation from your chart — can be wrong');
    expect(textOf(screen.getByTestId('ask-turn-1-rules'))).toMatch(/^Rules used: moon-\d+$/);
    expect(bridge.isLoaded).toBe(true);
    // The label is 13 sp (caption) and never larger.
    const label = screen.getByTestId('ask-turn-1-label-text');
    const style = Array.isArray(label.props.style) ? Object.assign({}, ...label.props.style.flat(Infinity).filter(Boolean)) : label.props.style;
    expect(style.fontSize).toBe(13);
    fail = true;
    await fireEvent.changeText(screen.getByTestId('ask-chat-question'), 'Again?');
    await fireEvent.press(screen.getByTestId('ask-chat-send'));
    expect(screen.getByTestId('ask-chat-error')).toBeTruthy();
    expect(texts()).toContain("Couldn't run the model on this phone right now");
    expect(screen.getByTestId('ask-chat-error-delete')).toBeTruthy();
    expect(screen.getByTestId('ask-chat-error-retry')).toBeTruthy();
    expect(texts()).toContain(t('errors.modelMemory'));
  });

  it('chat refuses the free tier and a missing model (never a cloud answer)', async () => {
    await renderWithProviders(<AskChatScreen now={now} profileId={1} snapshot={() => ({ state: 'pro', gate: phone, status: 'absent' })} />);
    expect(texts()).toContain(t('ask.proOnly'));
    expect(screen.queryByTestId('ask-chat-send')).toBeNull();
    await screen.unmount();
    await goPro();
    await renderWithProviders(<AskChatScreen now={now} profileId={1} snapshot={() => ({ state: 'download', gate: phone, status: 'absent' })} />);
    expect(texts()).toContain(t('ask.rowDownload'));
    expect(screen.queryByTestId('ask-chat-send')).toBeNull();
  });

  it('AiLabel renders the pinned sentence with a Why? (rule ask-label)', async () => {
    await renderWithProviders(<AiLabel ruleIds={['moon-4']} />);
    expect(textOf(screen.getByTestId('ai-label-text'))).toBe(t('ask.label'));
    expect(screen.getByLabelText(/Why\?/)).toBeTruthy();
  });
});

// ---- backup ----

describe('C04 encrypted backup / restore (spec 10, N9)', () => {
  let close: () => void;
  beforeEach(() => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1);
    ({ close } = installTestDb());
    clearChartCache();
    insertProfile(SAMPLE_PRIYA, new Date(NOW));
    insertProfile(SAMPLE_AMMA, new Date(NOW));
    insertAncestor(SAMPLE_DADAJI);
    setSeriesEnabled('tithi_birthday', '1', true);
    setSeriesEnabled('barsi', '1', true);
    setSeriesEnabled('vrat_family', 'ekadashi', true);
    saveJournalEntry('2026-10-20', 'calm', 'quiet day');
    insertPrashna({ question: 'q1', ts: new Date(NOW).toISOString(), lat: 26.85, lon: 80.95, tz: 'Asia/Kolkata' });
    setSetting('chartStyle', 'south');
  });
  afterEach(() => close());

  it('format: SVB1 magic, 600,000 iterations recorded, 16-byte salt, 12-byte IV, 16-byte tag; round trip; wrong passphrase fails the tag', () => {
    expect(PBKDF2_ITERATIONS).toBe(600_000);
    const bytes = encryptBackup('{"hello":"world"}', 'correct horse battery', nodeCrypto, FAST_ITER);
    expect(new TextDecoder().decode(bytes.subarray(0, 4))).toBe('SVB1');
    const h = readHeader(bytes);
    expect(h.iterations).toBe(FAST_ITER);
    expect(h.salt).toHaveLength(16);
    expect(h.iv).toHaveLength(12);
    expect(h.tag).toHaveLength(16);
    expect(bytes.length).toBe(HEADER_BYTES + '{"hello":"world"}'.length);
    expect(decryptBackup(bytes, 'correct horse battery', nodeCrypto)).toBe('{"hello":"world"}');
    expect(() => decryptBackup(bytes, 'correct horse batterx', nodeCrypto)).toThrow(BackupError);
    try {
      decryptBackup(bytes, 'wrong-passphrase', nodeCrypto);
    } catch (e) {
      expect((e as BackupError).code).toBe('passphrase');
    }
    // A flipped ciphertext byte also fails the tag (integrity, not only secrecy).
    const tampered = new Uint8Array(bytes);
    tampered[tampered.length - 1] ^= 0x01;
    expect(() => decryptBackup(tampered, 'correct horse battery', nodeCrypto)).toThrow(BackupError);
    expect(() => readHeader(new TextEncoder().encode('PK\u0003\u0004 not a backup at all, just bytes ................'))).toThrow(BackupError);
    expect(() => encryptBackup('x', 'short', nodeCrypto, FAST_ITER)).toThrow(BackupError);
    // Two salts / IVs never repeat for the same input.
    const a = encryptBackup('same', 'correct horse battery', nodeCrypto, FAST_ITER);
    const b = encryptBackup('same', 'correct horse battery', nodeCrypto, FAST_ITER);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  it('the production provider derives with 600,000 rounds by default (header check)', () => {
    const bytes = encryptBackup('{}', 'correct horse battery', nodeCrypto);
    expect(readHeader(bytes).iterations).toBe(600_000);
    expect(decryptBackup(bytes, 'correct horse battery', nodeCrypto)).toBe('{}');
  });

  it('document: every table collected, counts preview, version checks', () => {
    const doc = collectBackup(getDb(), { appVersion: '0.3.0', schemaVersion: 3, now: new Date(NOW) });
    expect(Object.keys(doc.tables).sort()).toEqual([...BACKUP_TABLES].sort());
    expect(doc.tables.profiles).toHaveLength(2);
    expect(doc.tables.ancestors).toHaveLength(1);
    expect(countsOf(doc)).toEqual({ profiles: 2, ancestors: 1, reminders: 3, journal: 1, prashna: 1, muhurats: 0, lessons: 0 });
    expect(doc.tables.settings.some((r) => r.key === 'chartStyle' && r.value === 'south')).toBe(true);
    const parsed = parseBackupDocument(JSON.stringify(doc));
    expect(parsed.ok).toBe(true);
    expect(parseBackupDocument(JSON.stringify({ ...doc, version: 99 }))).toEqual({ ok: false, problem: 'newer' });
    expect(parseBackupDocument('{"app":"other"}')).toEqual({ ok: false, problem: 'format' });
    expect(parseBackupDocument('not json')).toEqual({ ok: false, problem: 'format' });
    // Nothing that is not the user's data travels in the file.
    expect(JSON.stringify(doc)).not.toMatch(/entitlements|purchases|unlocks|app_state/);
  });

  it('Replace restores the file exactly; Merge keeps the phone and remaps profile/ancestor references', () => {
    const doc = collectBackup(getDb(), { appVersion: '0.3.0', schemaVersion: 3, now: new Date(NOW) });
    // Change the phone after the backup: a new profile, a changed setting, a deleted journal entry.
    insertProfile({ ...SAMPLE_AMMA, name: 'Chachi', relationship: 'other' }, new Date(NOW));
    setSetting('chartStyle', 'east');
    getDb().runSync('DELETE FROM journal');
    expect(countProfiles()).toBe(3);

    const merged = applyBackup(doc, 'merge');
    expect(countProfiles()).toBe(3); // Priya + Amma matched, Chachi kept
    expect(listProfiles().filter((p) => p.isSelf)).toHaveLength(1);
    expect(getSetting('chartStyle')).toBe('south'); // the file's value updated the phone
    expect(countJournalEntries()).toBe(1);
    expect(countPrashna()).toBe(1); // same question + instant not duplicated
    expect(countEnabledSeries()).toBe(3);
    expect(merged.updated).toBeGreaterThan(0);

    // Merge into an EMPTY phone (fresh install) with different autoincrement ids: references follow the new ids.
    getDb().execSync('DELETE FROM profiles; DELETE FROM ancestors; DELETE FROM event_series; DELETE FROM journal; DELETE FROM prashna;');
    insertProfile({ ...SAMPLE_AMMA, name: 'Someone', relationship: 'other' }, new Date(NOW)); // takes id 4
    applyBackup(doc, 'merge');
    const priya = listProfiles().find((p) => p.name === 'Priya')!;
    const dadaji = listAncestors().find((a) => a.name === 'Dadaji')!;
    expect(priya.id).not.toBe(1);
    expect(priya.isSelf).toBe(true); // the phone had no self: the file's self becomes self
    const series = getDb().getAllSync<{ kind: string; ref_id: string; enabled: number }>('SELECT kind, ref_id, enabled FROM event_series');
    expect(series.find((s) => s.kind === 'tithi_birthday')?.ref_id).toBe(String(priya.id));
    expect(series.find((s) => s.kind === 'barsi')?.ref_id).toBe(String(dadaji.id));
    expect(series.find((s) => s.kind === 'vrat_family')?.ref_id).toBe('ekadashi');

    // Replace: only the file remains, ids as in the file.
    const replaced = applyBackup(doc, 'replace');
    expect(replaced.mode).toBe('replace');
    expect(countProfiles()).toBe(2);
    expect(getProfile(1)?.name).toBe('Priya');
    expect(listProfiles().some((p) => p.name === 'Someone')).toBe(false);
    expect(countEnabledSeries()).toBe(3);
    expect(countJournalEntries()).toBe(1);
    expect(getDb().getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM scheduled')?.n).toBe(0);
  });

  it('a failing import leaves nothing behind (single transaction)', () => {
    const doc = collectBackup(getDb(), { appVersion: '0.3.0', schemaVersion: 3, now: new Date(NOW) });
    // A profile row that violates NOT NULL (birth_date) after one valid insert: the whole Replace rolls back.
    const broken = { ...doc, tables: { ...doc.tables, profiles: [...doc.tables.profiles, { ...doc.tables.profiles[0], id: 9, name: 'Broken', birth_date: null }] } };
    const before = JSON.stringify(getDb().getAllSync('SELECT * FROM profiles ORDER BY id'));
    getDb().runSync('DELETE FROM journal');
    expect(() => applyBackup(broken, 'replace')).toThrow();
    expect(JSON.stringify(getDb().getAllSync('SELECT * FROM profiles ORDER BY id'))).toBe(before);
    expect(countJournalEntries()).toBe(0); // the deleted entry was NOT restored either: nothing partial
    expect(countProfiles()).toBe(2);
  });

  it('screen: create (passphrase >= 8, repeat, share) then restore via the picker with the wrong and the right passphrase', async () => {
    let shared: { name: string; bytes: Uint8Array } | null = null;
    let picked: { name: string; bytes: Uint8Array } | null = null;
    const afterRestore = jest.fn(async () => {});
    const deps: BackupDeps = {
      crypto: () => ({ ...nodeCrypto }),
      writeAndShare: async (name, bytes) => {
        shared = { name, bytes };
        return `file:///cache/${name}`;
      },
      pickAndRead: async () => picked,
      appVersion: () => '0.3.0',
      schemaVersion: () => 3,
      afterRestore,
    };
    // 600,000 rounds twice is slow in Jest; the screen takes the deps' provider as is, so swap the iteration count
    // through a provider that records the header count (decrypt reads it back from the file).
    const fast: CryptoProvider = { ...nodeCrypto, pbkdf2Sha256: (p, s, _i, l) => nodeCrypto.pbkdf2Sha256(p, s, FAST_ITER, l) };
    deps.crypto = () => fast;
    await renderWithProviders(<BackupScreen deps={deps} now={() => new Date(NOW)} />);
    await fireEvent.changeText(screen.getByTestId('backup-pass'), 'short');
    await fireEvent.changeText(screen.getByTestId('backup-pass2'), 'short');
    await fireEvent.press(screen.getByTestId('backup-create'));
    expect(texts()).toContain(t('backup.passphraseShort'));
    await fireEvent.changeText(screen.getByTestId('backup-pass'), 'my family 2026');
    await fireEvent.changeText(screen.getByTestId('backup-pass2'), 'my family 2025');
    await fireEvent.press(screen.getByTestId('backup-create'));
    expect(texts()).toContain(t('backup.passphraseMismatch'));
    await fireEvent.changeText(screen.getByTestId('backup-pass2'), 'my family 2026');
    await fireEvent.press(screen.getByTestId('backup-create'));
    expect(shared).not.toBeNull();
    expect(shared!.name).toBe('shubhvela-backup-2026-10-22.svb');
    expect(screen.getByTestId('backup-created')).toBeTruthy();
    // The passphrase fields are cleared after the export (never kept).
    expect(screen.getByTestId('backup-pass').props.value).toBe('');
    expect(texts().join('\n')).toContain('PBKDF2 (600,000 rounds)');

    // Restore: pick, wrong passphrase, nothing imported; right passphrase -> preview -> Merge.
    getDb().runSync('DELETE FROM journal');
    picked = { name: shared!.name, bytes: shared!.bytes };
    await fireEvent.press(screen.getByTestId('backup-pick'));
    expect(textOf(screen.getByTestId('backup-picked-name'))).toBe('shubhvela-backup-2026-10-22.svb');
    await fireEvent.changeText(screen.getByTestId('backup-import-pass'), 'not the passphrase');
    await fireEvent.press(screen.getByTestId('backup-open'));
    expect(texts()).toContain("Couldn't open this backup — check the passphrase");
    expect(countJournalEntries()).toBe(0);
    expect(screen.queryByTestId('backup-preview')).toBeNull();
    await fireEvent.changeText(screen.getByTestId('backup-import-pass'), 'my family 2026');
    await fireEvent.press(screen.getByTestId('backup-open'));
    expect(screen.getByTestId('backup-preview')).toBeTruthy();
    const counts = screen.getAllByTestId('backup-count').map((x) => textOf(x));
    expect(counts).toContain('2 profiles');
    expect(counts).toContain('1 ancestor record');
    expect(counts).toContain('3 reminders');
    expect(counts).toContain('1 journal entry');
    expect(counts).toContain('1 question');
    expect(countJournalEntries()).toBe(0); // preview imports nothing
    await fireEvent.press(screen.getByTestId('backup-merge'));
    expect(screen.getByTestId('backup-restored')).toBeTruthy();
    expect(countJournalEntries()).toBe(1);
    expect(afterRestore).toHaveBeenCalledTimes(1);
  });

  it('a backup made by a newer app is refused before anything is read into the database', async () => {
    const newer = encryptBackup(JSON.stringify({ app: 'shubhvela', version: 2, tables: {} }), 'my family 2026', nodeCrypto, FAST_ITER);
    const deps: BackupDeps = {
      crypto: () => nodeCrypto,
      writeAndShare: async () => '',
      pickAndRead: async () => ({ name: 'newer.svb', bytes: newer }),
      appVersion: () => '0.3.0',
      schemaVersion: () => 3,
      afterRestore: async () => {},
    };
    await renderWithProviders(<BackupScreen deps={deps} now={() => new Date(NOW)} />);
    await fireEvent.press(screen.getByTestId('backup-pick'));
    await fireEvent.changeText(screen.getByTestId('backup-import-pass'), 'my family 2026');
    await fireEvent.press(screen.getByTestId('backup-open'));
    expect(texts()).toContain('This backup needs a newer app');
    expect(screen.queryByTestId('backup-preview')).toBeNull();
  });
});

// ---- deep links ----

describe('C04 deep links (F37, M8)', () => {
  const payload = { date: '1998-03-14', time: '06:42', approx: 0 as const, lat: 26.85, lon: 80.95, tz: 'Asia/Kolkata', gender: 'f' as const };

  it('splits the four link kinds and the web forms', () => {
    expect(splitDeepLink('shubhvela://kundli?v=1&d=19980314')).toEqual({ link: 'kundli', path: [], query: 'v=1&d=19980314' });
    expect(splitDeepLink('shubhvela://m?v=1')).toEqual({ link: 'm', path: [], query: 'v=1' });
    expect(splitDeepLink('shubhvela://festival/diwali/2026')).toEqual({ link: 'festival', path: ['diwali', '2026'], query: '' });
    expect(splitDeepLink('shubhvela://panchang/new-delhi')).toEqual({ link: 'panchang', path: ['new-delhi'], query: '' });
    expect(splitDeepLink('https://sudish007.github.io/shubhvela/festival/diwali/2026/')).toEqual({ link: 'festival', path: ['diwali', '2026'], query: '' });
    expect(splitDeepLink('shubhvela://dev/state?x=1').link).toBeNull();
    expect(splitDeepLink('mailto:x').link).toBeNull();
  });

  it('kundli: the engine M8 parser, extras allowed, pre-fill mirrors the payload', () => {
    const url = toDeepLink(payload, 'kundli', { ay: 'raman', nd: 'true', st: 'south', n: 'Priya' });
    const r = parseDeepLink(url, { nowMs: NOW });
    expect(r.kind).toBe('kundli');
    if (r.kind !== 'kundli') return;
    expect(r.payload).toMatchObject({ v: 1, date: '1998-03-14', time: '06:42', approx: 0, lat: 26.85, lon: 80.95, tz: 'Asia/Kolkata', gender: 'f' });
    expect(r.extras).toEqual({ ay: 'raman', nd: 'true', st: 'south', n: 'Priya' });
    expect(r.prefill).toMatchObject({ birthDate: '1998-03-14', birthTime: '06:42', timeUnknown: false, approx: 0, lat: 26.85, lon: 80.95, tz: 'Asia/Kolkata', gender: 'f', name: 'Priya', errors: [] });
    const form = formFromPrefill(r.prefill, { tradition: 'purnimanta', pdfLanguage: 'en', relationship: 'other' });
    expect(form.birthDate).toBe('1998-03-14');
    expect(form.place).toMatchObject({ lat: 26.85, lon: 80.95, tz: 'Asia/Kolkata', source: 'manual' });
    expect(form.gender).toBe('female');
    expect(form.name).toBe('Priya');
    expect(errorsFromPrefill(r.prefill)).toEqual({});
    expect(routeForTarget(r)).toBe('/kundli');
  });

  it('m: the payload becomes the 20-character code for matching; extras are rejected on /m/ (M8)', () => {
    const r = parseDeepLink(toDeepLink(payload, 'm'), { nowMs: NOW });
    expect(r.kind).toBe('m');
    if (r.kind !== 'm') return;
    expect(r.code).toHaveLength(20);
    expect(routeForTarget(r)).toBe('/family/match');
    const bad = parseDeepLink(`${toDeepLink(payload, 'm')}&n=Priya`, { nowMs: NOW });
    expect(bad).toMatchObject({ kind: 'invalid', reason: 'payload', link: 'm', detail: 'extras-not-allowed' });
  });

  it('festival: slug must be an engine rule, year inside 1900-2100', () => {
    expect(parseDeepLink('shubhvela://festival/diwali/2026')).toEqual({ kind: 'festival', slug: 'diwali', year: 2026 });
    expect(routeForTarget({ kind: 'festival', slug: 'diwali', year: 2026 })).toBe('/family/festival/diwali?year=2026');
    expect(parseDeepLink('shubhvela://festival/not-a-festival/2026')).toMatchObject({ kind: 'invalid', reason: 'festival', detail: 'not-a-festival' });
    expect(parseDeepLink('shubhvela://festival/diwali/1066')).toMatchObject({ kind: 'invalid', reason: 'year', detail: '1066' });
    expect(parseDeepLink('shubhvela://festival/diwali/soon')).toMatchObject({ kind: 'invalid', reason: 'year' });
    expect(parseDeepLink('shubhvela://festival/diwali')).toMatchObject({ kind: 'invalid', reason: 'year' });
  });

  it('panchang: one of the 331 web cities becomes the Today observer; unknown slug -> city error', () => {
    const r = parseDeepLink('shubhvela://panchang/kathmandu');
    expect(r.kind).toBe('panchang');
    if (r.kind !== 'panchang') return;
    expect(r.city.slug).toBe('kathmandu');
    expect(r.observer).toMatchObject({ tz: 'Asia/Kathmandu', source: 'city' });
    expect(r.observer.placeName).toContain('Kathmandu');
    expect(routeForTarget(r)).toBe('/(tabs)/today?city=kathmandu');
    expect(parseDeepLink('shubhvela://panchang/atlantis')).toMatchObject({ kind: 'invalid', reason: 'city', detail: 'atlantis' });
    expect(parseDeepLink('shubhvela://panchang/')).toMatchObject({ kind: 'invalid', reason: 'city' });
  });

  it('invalid kundli links keep what parsed and name the fields that did not', () => {
    const r = parseDeepLink('shubhvela://kundli?v=1&d=19980314&t=2599&a=0&lat=26.85&lon=999&tz=Asia/Kolkata&g=f', { nowMs: NOW });
    expect(r.kind).toBe('invalid');
    if (r.kind !== 'invalid') return;
    expect(r.reason).toBe('payload');
    expect(r.prefill?.birthDate).toBe('1998-03-14');
    expect(r.prefill?.lat).toBe(26.85);
    expect(r.prefill?.lon).toBeNull();
    expect(r.prefill?.birthTime).toBeNull();
    expect(r.prefill?.errors).toEqual(['time', 'lon']);
    expect(errorsFromPrefill(r.prefill!)).toEqual({ time: true, place: true });
    expect(parseDeepLink('shubhvela://kundli?v=2&d=19980314', { nowMs: NOW })).toMatchObject({ kind: 'invalid', reason: 'version' });
    expect(parseDeepLink('shubhvela://kundli', { nowMs: NOW })).toMatchObject({ kind: 'invalid', reason: 'payload' });
    expect(parseDeepLink('shubhvela://nothing/here')).toEqual({ kind: 'invalid', reason: 'path', link: null });
    expect(prefillFromQuery('v=1&d=20991231&t=u&a=15&lat=1&lon=2&tz=UTC', NOW).errors).toEqual(['date']);
  });

  it('Today reads ?city= as the observer (place pill shows the city, panchang computed for it)', async () => {
    const { close } = installTestDb();
    try {
      clearChartCache();
      resetAdPolicyForTests();
      insertProfile(SAMPLE_PRIYA, new Date(NOW));
      await renderWithProviders(<TodayScreen todayOptions={{ now }} city="kathmandu" />);
      await waitFor(() => expect(textOf(screen.getByTestId('place-pill'))).toContain('Kathmandu'), { timeout: 20000 });
      expect(screen.queryByTestId('location-fallback')).toBeNull();
    } finally {
      close();
    }
  });
});

describe('C04 More-from-this-chart card', () => {
  it('renders Prashna first for a Moon chart and the Ask row states', async () => {
    const access = { allowed: true, pro: true, until: null };
    const all = { vargas: access, ashtakavarga: access, kp: access, varshaphal: access, prashna: access };
    await renderWithProviders(<MoreFromChartCard access={all} nowMs={NOW} tz="Asia/Kolkata" vedicYearStart={NOW} moonChart ask="download" onOpen={() => {}} onUnlock={() => {}} testID="more" />);
    const rows = screen.getAllByTestId(/^more-row-/).map((r) => r.props.testID as string);
    expect(rows[0]).toBe('more-row-prashna');
    expect(rows.at(-1)).toBe('more-row-ask');
    expect(textOf(screen.getByTestId('more-state-ask'))).toBe(t('ask.rowDownload'));
  });
});
