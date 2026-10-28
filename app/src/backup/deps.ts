// Native bindings of the backup screen (export = write the .svb to the cache and hand it to expo-sharing; import =
// expo-document-picker with the any-type MIME filter (N9: Android's picker hides the unknown .svb extension behind
// narrower filters) and read the bytes). Injected into BackupScreen so the flows are unit-tested without native modules.
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { SCHEMA_VERSION } from '../db/schema';
import { appVersion } from '../legal';
import { replanAll } from '../notifications/schedule';
import { quickCryptoProvider, type CryptoProvider } from './crypto';

export interface BackupDeps {
  crypto: () => CryptoProvider;
  /** Writes the bytes to a cache file named `fileName` and opens the system share sheet; returns the file URI. */
  writeAndShare(fileName: string, bytes: Uint8Array): Promise<string>;
  /** Opens the document picker with the any-type MIME filter (N9); null when the user cancelled. */
  pickAndRead(): Promise<{ name: string; bytes: Uint8Array } | null>;
  appVersion(): string;
  schemaVersion(): number;
  /** After a restore: charts are recomputed on next use and reminders re-planned from the restored series. */
  afterRestore(): Promise<void>;
  now?: () => Date;
}

export const realBackupDeps: BackupDeps = {
  crypto: () => quickCryptoProvider(),
  writeAndShare: async (fileName, bytes) => {
    const f = new File(Paths.cache, fileName);
    if (f.exists) f.delete();
    f.create();
    await f.write(bytes);
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(f.uri, { mimeType: 'application/octet-stream', dialogTitle: fileName });
    return f.uri;
  },
  pickAndRead: async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
    if (r.canceled || !r.assets?.length) return null;
    const a = r.assets[0];
    const bytes = await new File(a.uri).bytes();
    return { name: a.name, bytes };
  },
  appVersion: () => appVersion(),
  schemaVersion: () => SCHEMA_VERSION,
  afterRestore: async () => {
    await replanAll();
  },
};
