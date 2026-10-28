// Screenshot-build action (shubhvela://dev/state?...&backup_roundtrip=1; C04 for the C05 audit): runs the backup
// export -> encrypt (react-native-quick-crypto, the real provider) -> write .svb to the cache -> read back -> decrypt
// -> parse -> Merge, plus a wrong-passphrase attempt, entirely on the device and logs the outcome so `adb logcat` shows
// the native crypto path working (Jest covers the same format with Node's crypto). Never compiled into behaviour
// outside the dev route.
import { File, Paths } from 'expo-file-system';
import { applyBackup } from '../backup/apply';
import { BackupError, decryptBackup, encryptBackup, quickCryptoProvider } from '../backup/crypto';
import { collectBackup, countsOf, parseBackupDocument } from '../backup/document';
import { getDb } from '../db/connection';
import { SCHEMA_VERSION } from '../db/schema';
import { appVersion } from '../legal';

export interface RoundtripResult {
  bytes: number;
  uri: string;
  counts: ReturnType<typeof countsOf>;
  merged: { inserted: number; updated: number };
  wrongPassphraseRejected: boolean;
  ms: number;
}

export async function runBackupRoundtrip(passphrase = 'dev-roundtrip-passphrase'): Promise<RoundtripResult> {
  const t0 = Date.now();
  const crypto = quickCryptoProvider();
  const doc = collectBackup(getDb(), { appVersion: appVersion(), schemaVersion: SCHEMA_VERSION });
  const bytes = encryptBackup(JSON.stringify(doc), passphrase, crypto);
  const f = new File(Paths.cache, 'dev-roundtrip.svb');
  if (f.exists) f.delete();
  f.create();
  await f.write(bytes);
  const back = await new File(f.uri).bytes();
  let wrongPassphraseRejected = false;
  try {
    decryptBackup(back, 'not-the-passphrase', crypto);
  } catch (e) {
    wrongPassphraseRejected = e instanceof BackupError && e.code === 'passphrase';
  }
  const json = decryptBackup(back, passphrase, crypto);
  const parsed = parseBackupDocument(json);
  if (!parsed.ok) throw new Error(`roundtrip parse failed: ${parsed.problem}`);
  const merged = applyBackup(parsed.doc, 'merge');
  return { bytes: bytes.length, uri: f.uri, counts: countsOf(parsed.doc), merged: { inserted: merged.inserted, updated: merged.updated }, wrongPassphraseRejected, ms: Date.now() - t0 };
}
