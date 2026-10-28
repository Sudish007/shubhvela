// Model download (F35, design.md 10.7, plan C04): a resumable expo-file-system DownloadTask (SDK 58's successor of
// createDownloadResumable) from the Hugging Face URL into <documents>/models/, driven by one state machine:
//   - starts ONLY when expo-network reports Wi-Fi (type WIFI); on anything else it stays paused with the Wi-Fi message;
//   - on Wi-Fi loss the task is paused with reason 'wifi' ("Download paused - reconnect to Wi-Fi") and is NEVER resumed
//     by itself: resume is an explicit tap, and the tap is refused while the network is not Wi-Fi;
//   - the user may pause ('user') and cancel; the paused task state is persisted so a later launch can resume;
//   - on completion the byte size must equal MODEL_BYTES and the streamed SHA-256 must equal MODEL_SHA256; a mismatch
//     deletes the file and reports 'checksum' (never a usable model with the wrong bytes).
// Everything native is injected (DownloadDeps) so the machine is unit-tested with fakes; realDownloadDeps binds
// expo-file-system / expo-network.
import { Directory, File, type DownloadPauseState, type DownloadProgress, type DownloadTask } from 'expo-file-system';
import { addNetworkStateListener, getNetworkStateAsync, NetworkStateType, type NetworkState } from 'expo-network';
import { MODEL_BYTES, MODEL_DIR_NAME, MODEL_SHA256, MODEL_URL } from './model';
import { clearPersistedDownload, modelDirectory, modelFile, readPersistedDownload, realModelFileOps, writePersistedDownload, type ModelFileOps } from './modelStore';

export type DownloadPhase =
  | { kind: 'idle' }
  | { kind: 'downloading'; bytes: number; total: number }
  | { kind: 'paused'; reason: 'wifi' | 'user'; bytes: number }
  | { kind: 'verifying' }
  | { kind: 'ready' }
  | { kind: 'failed'; reason: 'checksum' | 'size' | 'network' | 'storage'; bytes: number };

/** Minimal task surface the machine needs (DownloadTask in production). */
export interface TaskLike {
  downloadAsync(): Promise<unknown | null>;
  resumeAsync(): Promise<unknown | null>;
  pauseAsync(): Promise<void>;
  cancel(): void;
  savable(): DownloadPauseState;
  release(): void;
}

export interface DownloadDeps {
  /** Creates a fresh task for the URL into the model directory. */
  createTask(onProgress: (p: DownloadProgress) => void): TaskLike;
  /** Restores a paused task from its persisted state. */
  restoreTask(state: DownloadPauseState, onProgress: (p: DownloadProgress) => void): TaskLike;
  networkState(): Promise<NetworkState>;
  onNetworkChange(listener: (s: NetworkState) => void): () => void;
  files: ModelFileOps;
}

export function isWifi(s: NetworkState | null | undefined): boolean {
  return !!s && s.isConnected !== false && s.type === NetworkStateType.WIFI;
}

type Listener = (phase: DownloadPhase) => void;

export class ModelDownloader {
  private phase: DownloadPhase = { kind: 'idle' };
  private task: TaskLike | null = null;
  private readonly listeners = new Set<Listener>();
  private unsubscribeNetwork: (() => void) | null = null;
  private bytes = 0;

  constructor(private readonly deps: DownloadDeps) {
    const p = readPersistedDownload();
    this.bytes = p.bytesWritten;
    if (p.savable) this.phase = { kind: 'paused', reason: 'user', bytes: p.bytesWritten };
  }

  get state(): DownloadPhase {
    return this.phase;
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  }

  private set(phase: DownloadPhase): void {
    this.phase = phase;
    this.listeners.forEach((l) => l(phase));
  }

  private onProgress = (p: DownloadProgress): void => {
    this.bytes = p.bytesWritten;
    if (this.phase.kind === 'downloading') this.set({ kind: 'downloading', bytes: p.bytesWritten, total: p.totalBytes > 0 ? p.totalBytes : MODEL_BYTES });
  };

  private watchNetwork(): void {
    if (this.unsubscribeNetwork) return;
    this.unsubscribeNetwork = this.deps.onNetworkChange((s) => {
      if (!isWifi(s) && this.phase.kind === 'downloading') void this.pause('wifi');
    });
  }

  private unwatchNetwork(): void {
    this.unsubscribeNetwork?.();
    this.unsubscribeNetwork = null;
  }

  /** Starts (or resumes a persisted) download; refuses with the Wi-Fi pause when the network is not Wi-Fi. */
  async start(): Promise<void> {
    if (this.phase.kind === 'downloading' || this.phase.kind === 'verifying') return;
    const net = await this.deps.networkState();
    if (!isWifi(net)) {
      this.set({ kind: 'paused', reason: 'wifi', bytes: this.bytes });
      return;
    }
    const persisted = readPersistedDownload();
    if (persisted.savable && !this.task) {
      try {
        this.task = this.deps.restoreTask(JSON.parse(persisted.savable) as DownloadPauseState, this.onProgress);
      } catch {
        this.task = null;
        clearPersistedDownload();
      }
    }
    this.watchNetwork();
    this.set({ kind: 'downloading', bytes: this.bytes, total: MODEL_BYTES });
    try {
      if (this.task) {
        await this.run(() => this.task!.resumeAsync());
      } else {
        this.deps.files.ensureDir();
        this.task = this.deps.createTask(this.onProgress);
        await this.run(() => this.task!.downloadAsync());
      }
    } catch (e) {
      // A cancel() rejects the pending promise after the machine is already idle: nothing to report then.
      if (this.phase.kind === 'idle') return;
      if (__DEV__) console.warn('model download failed', e);
      this.unwatchNetwork();
      this.task = null;
      this.set({ kind: 'failed', reason: 'network', bytes: this.bytes });
    }
  }

  /** Explicit resume: identical to start() (the network check happens again; mobile data keeps it paused). */
  resume(): Promise<void> {
    return this.start();
  }

  private async run(op: () => Promise<unknown | null>): Promise<void> {
    const result = await op();
    if (result === null) {
      // Paused: the native task produced resume data; persist it so a later launch can continue.
      if (this.task) writePersistedDownload({ savable: JSON.stringify(this.task.savable()), bytesWritten: this.bytes, verified: false });
      return;
    }
    this.unwatchNetwork();
    this.task?.release();
    this.task = null;
    await this.verify();
  }

  async pause(reason: 'wifi' | 'user'): Promise<void> {
    if (this.phase.kind !== 'downloading' || !this.task) return;
    this.set({ kind: 'paused', reason, bytes: this.bytes });
    try {
      await this.task.pauseAsync();
    } catch (e) {
      if (__DEV__) console.warn('pause failed', e);
    }
  }

  cancel(): void {
    this.task?.cancel();
    this.task = null;
    this.unwatchNetwork();
    this.deps.files.delete();
    clearPersistedDownload();
    this.bytes = 0;
    this.set({ kind: 'idle' });
  }

  /** Size, then streamed SHA-256; any mismatch deletes the file (the model is never left half-right). */
  private async verify(): Promise<void> {
    this.set({ kind: 'verifying' });
    const size = this.deps.files.size();
    if (size !== MODEL_BYTES) {
      this.deps.files.delete();
      clearPersistedDownload();
      this.set({ kind: 'failed', reason: 'size', bytes: size ?? 0 });
      return;
    }
    let hash: string;
    try {
      hash = (await this.deps.files.sha256()).toLowerCase();
    } catch (e) {
      if (__DEV__) console.warn('digest failed', e);
      hash = '';
    }
    if (hash !== MODEL_SHA256) {
      this.deps.files.delete();
      clearPersistedDownload();
      this.set({ kind: 'failed', reason: 'checksum', bytes: 0 });
      return;
    }
    writePersistedDownload({ savable: null, bytesWritten: MODEL_BYTES, verified: true });
    this.set({ kind: 'ready' });
  }

  dispose(): void {
    this.unwatchNetwork();
    this.listeners.clear();
  }
}

function wrap(task: DownloadTask): TaskLike {
  return task;
}

export const realDownloadDeps: DownloadDeps = {
  createTask: (onProgress) => wrap(File.createDownloadTask(MODEL_URL, modelFile(), { onProgress })),
  restoreTask: (state, onProgress) => {
    // Lazy import keeps the DownloadTask class out of modules that only need the types.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DownloadTask: Task } = require('expo-file-system') as { DownloadTask: { fromSavable(s: DownloadPauseState, o?: { onProgress?: (p: DownloadProgress) => void }): DownloadTask } };
    return wrap(Task.fromSavable(state, { onProgress }));
  },
  networkState: () => getNetworkStateAsync(),
  onNetworkChange: (listener) => {
    const sub = addNetworkStateListener(listener);
    return () => sub.remove();
  },
  files: realModelFileOps,
};

/** Destination directory URI for the consent screen's "stored in" row. */
export function modelLocationLabel(): string {
  try {
    const d: Directory = modelDirectory();
    return d.uri.replace(/^file:\/\//, '');
  } catch {
    // The platform could not name the directory (never on a device); say only what is certain.
    return `${MODEL_DIR_NAME}/`;
  }
}

let shared: ModelDownloader | null = null;

/** One downloader per app process (the download screen and the chat screen read the same state). */
export function sharedDownloader(deps: DownloadDeps = realDownloadDeps): ModelDownloader {
  if (!shared) shared = new ModelDownloader(deps);
  return shared;
}

export function resetDownloaderForTests(): void {
  shared?.dispose();
  shared = null;
}
