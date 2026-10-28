// Where the model lives and what state it is in (F35): <documents>/models/gemma-4-E2B-it.litertlm. `ready` means the
// file exists AND is exactly MODEL_BYTES long AND its SHA-256 was verified once after download (the verified flag is
// kept in app_state so a 2.6 GB hash is not recomputed on every launch); `partial` means a download was interrupted
// (the paused DownloadTask state is persisted so it can resume on Wi-Fi); `absent` otherwise. The file operations are
// behind a small interface so the state machine and the screens are unit-tested without expo-file-system.
import { Directory, File, Paths } from 'expo-file-system';
import { getAppState, setAppState } from '../db/appState';
import { hasDb } from '../db/connection';
import { MODEL_BYTES, MODEL_DIR_NAME, MODEL_FILE_NAME } from './model';

export type ModelStatus = 'absent' | 'partial' | 'ready';

export interface ModelFileOps {
  /** Absolute URI of the model file (shown on the consent screen as the storage location). */
  uri(): string;
  exists(): boolean;
  size(): number | null;
  delete(): void;
  /** Streams the file through the platform's SHA-256 (expo-file-system File.digest); lower-case hex. */
  sha256(): Promise<string>;
  ensureDir(): void;
}

export interface PersistedDownload {
  /** JSON of DownloadTask.savable() while paused, or null. */
  savable: string | null;
  /** Bytes written when paused (for the "x of 2.6 GB" line before the task reports again). */
  bytesWritten: number;
  /** True once the completed file's size and SHA-256 matched (MODEL_BYTES / MODEL_SHA256). */
  verified: boolean;
}

const EMPTY: PersistedDownload = { savable: null, bytesWritten: 0, verified: false };

export function modelDirectory(): Directory {
  return new Directory(Paths.document, MODEL_DIR_NAME);
}

export function modelFile(): File {
  return new File(modelDirectory(), MODEL_FILE_NAME);
}

export const realModelFileOps: ModelFileOps = {
  uri: () => modelFile().uri,
  exists: () => modelFile().exists,
  size: () => {
    const f = modelFile();
    return f.exists ? f.size : null;
  },
  delete: () => {
    const f = modelFile();
    if (f.exists) f.delete();
  },
  sha256: async () => (await modelFile().digest('SHA-256')).toLowerCase(),
  ensureDir: () => {
    const d = modelDirectory();
    if (!d.exists) d.create({ intermediates: true, idempotent: true });
  },
};

export function readPersistedDownload(): PersistedDownload {
  if (!hasDb()) return EMPTY;
  const raw = getAppState('ask_model');
  if (!raw) return EMPTY;
  try {
    const p = JSON.parse(raw) as Partial<PersistedDownload>;
    return { savable: typeof p.savable === 'string' ? p.savable : null, bytesWritten: typeof p.bytesWritten === 'number' ? p.bytesWritten : 0, verified: p.verified === true };
  } catch {
    return EMPTY;
  }
}

export function writePersistedDownload(p: PersistedDownload): void {
  if (!hasDb()) return;
  setAppState('ask_model', JSON.stringify(p));
}

export function clearPersistedDownload(): void {
  writePersistedDownload(EMPTY);
}

/** Status from the file and the persisted flags (synchronous; no hashing here). */
export function modelStatus(ops: ModelFileOps = realModelFileOps): ModelStatus {
  let size: number | null;
  try {
    size = ops.exists() ? ops.size() : null;
  } catch {
    size = null;
  }
  const p = readPersistedDownload();
  if (size === MODEL_BYTES && p.verified) return 'ready';
  if (size !== null || p.savable) return 'partial';
  return 'absent';
}

/** Deletes the model file and forgets the download state ("Delete model" everywhere). */
export function deleteModel(ops: ModelFileOps = realModelFileOps): void {
  try {
    ops.delete();
  } catch (e) {
    if (__DEV__) console.warn('model delete failed', e);
  }
  clearPersistedDownload();
}
