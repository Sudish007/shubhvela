// Bridge to the on-device runtime (F35, plan P18): expo-litert-lm 0.1.2 -
//   isLiteRtAvailable() / loadLiteRtModel(path, {maxTokens, topK, temperature, preferredBackend}) /
//   generateLiteRtResponse(prompt) / unloadLiteRtModel()
// The module is loaded lazily and through an interface so the flow (load -> generate -> unload, the OOM and
// missing-model paths) is unit-tested with a fake; a module that fails to load (not compiled in, non-Android) reports
// 'unavailable' and the UI shows the honest message - there is no network fallback of any kind (D10/D11).
// generateLiteRtResponse is NON-streaming: the UI shows "Thinking..." and then the whole answer (no typing animation).
export interface LiteRtModule {
  isLiteRtAvailable(): Promise<boolean>;
  loadLiteRtModel(modelPath: string, options?: { maxTokens?: number; topK?: number; temperature?: number; preferredBackend?: 'default' | 'gpu' | 'cpu' }): Promise<{ modelPath: string; backend: string }>;
  generateLiteRtResponse(prompt: string): Promise<string>;
  unloadLiteRtModel(): Promise<void>;
}

/**
 * Load options: top-K 40 and temperature 0.6 as planned; the token cap is 2048 (the module default) rather than the
 * plan's 1024 because `maxTokens` caps prefill + decode together and the grounded prompt (six rules + chart JSON +
 * snippets, see prompt.ts PROMPT_CHAR_BUDGET) needs ~1400 tokens before the answer starts - at 1024 the snippets
 * would be dropped and the answer could not cite them (spec F35). Recorded in verification-c04.md.
 */
export const LOAD_OPTIONS = { maxTokens: 2048, topK: 40, temperature: 0.6 } as const;

export type AskErrorCode = 'unavailable' | 'missing' | 'oom' | 'failed';

export class AskError extends Error {
  constructor(
    public readonly code: AskErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AskError';
  }
}

export function loadLiteRtModule(): LiteRtModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require('expo-litert-lm') as Partial<LiteRtModule>;
    if (typeof m.loadLiteRtModel !== 'function' || typeof m.generateLiteRtResponse !== 'function') return null;
    return m as LiteRtModule;
  } catch {
    return null;
  }
}

/** Maps a native error to the honest UI message: memory -> oom, file -> missing, else failed. */
export function classifyError(e: unknown): AskErrorCode {
  const msg = String((e as { message?: string })?.message ?? e ?? '').toLowerCase();
  if (/out of memory|outofmemory|oom|alloc|enomem|memory/.test(msg)) return 'oom';
  if (/no such file|not found|enoent|does not exist|missing|cannot open|could not open|failed to open/.test(msg)) return 'missing';
  return 'failed';
}

export interface AskBridgeDeps {
  module?: LiteRtModule | null;
  /** Checks the model file exists before asking the runtime to open it. */
  modelExists?: () => boolean;
}

export class AskBridge {
  private readonly mod: LiteRtModule | null;
  private readonly modelExists: () => boolean;
  private loadedPath: string | null = null;
  private backend: string | null = null;
  private busy = false;

  constructor(deps: AskBridgeDeps = {}) {
    this.mod = deps.module === undefined ? loadLiteRtModule() : deps.module;
    this.modelExists = deps.modelExists ?? (() => true);
  }

  get isLoaded(): boolean {
    return this.loadedPath !== null;
  }

  /** Backend the engine attached to after load ('gpu' | 'cpu' | 'default'); null before load. */
  get activeBackend(): string | null {
    return this.backend;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.mod) return false;
    try {
      return await this.mod.isLiteRtAvailable();
    } catch {
      return false;
    }
  }

  /** Loads the model (GPU first, CPU fallback). Throws AskError('unavailable' | 'missing' | 'oom' | 'failed'). */
  async load(modelPath: string): Promise<void> {
    if (!this.mod) throw new AskError('unavailable', 'expo-litert-lm is not available in this build');
    if (this.loadedPath === modelPath) return;
    if (!this.modelExists()) throw new AskError('missing', `model file missing at ${modelPath}`);
    if (this.loadedPath) await this.unload();
    try {
      const r = await this.mod.loadLiteRtModel(modelPath, { ...LOAD_OPTIONS, preferredBackend: 'gpu' });
      this.loadedPath = modelPath;
      this.backend = r.backend;
      return;
    } catch (e) {
      const code = classifyError(e);
      if (code !== 'failed') throw new AskError(code, String((e as Error)?.message ?? e));
    }
    try {
      const r = await this.mod.loadLiteRtModel(modelPath, { ...LOAD_OPTIONS, preferredBackend: 'cpu' });
      this.loadedPath = modelPath;
      this.backend = r.backend;
    } catch (e) {
      throw new AskError(classifyError(e), String((e as Error)?.message ?? e));
    }
  }

  /** One generation at a time; the whole answer arrives at once (non-streaming module). */
  async generate(prompt: string): Promise<string> {
    if (!this.mod) throw new AskError('unavailable', 'expo-litert-lm is not available in this build');
    if (!this.loadedPath) throw new AskError('missing', 'no model loaded');
    if (this.busy) throw new AskError('failed', 'a generation is already running');
    this.busy = true;
    try {
      const text = await this.mod.generateLiteRtResponse(prompt);
      return text.trim();
    } catch (e) {
      throw new AskError(classifyError(e), String((e as Error)?.message ?? e));
    } finally {
      this.busy = false;
    }
  }

  async unload(): Promise<void> {
    if (!this.mod || !this.loadedPath) return;
    try {
      await this.mod.unloadLiteRtModel();
    } finally {
      this.loadedPath = null;
      this.backend = null;
    }
  }
}

let shared: AskBridge | null = null;

export function sharedBridge(): AskBridge {
  if (!shared) shared = new AskBridge();
  return shared;
}

export function resetBridgeForTests(): void {
  shared = null;
}
