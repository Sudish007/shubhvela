// Settings -> Privacy -> Backup and restore (spec section 10, design.md 10.1, plan C04 step 3, N9).
// Create backup: passphrase (>= 8) typed twice -> the rows of the user tables as JSON -> AES-256-GCM under a PBKDF2
// (600,000 rounds) key -> shubhvela-backup-<yyyy-mm-dd>.svb in the cache -> the system share sheet. The passphrase is
// used once for the key and is never stored; the screen says so.
// Restore: pick a file (MIME */*) -> passphrase -> decrypt (wrong passphrase = GCM failure = "Couldn't open this
// backup — check the passphrase"; newer version = "This backup needs a newer app"; neither imports anything) ->
// preview of counts -> Merge or Replace (Replace asks once more) -> one transaction -> "Restored · N items".
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, InlineNotice, PrimaryButton, SecondaryButton, Sheet, TextField, Txt } from '../components';
import { getDb } from '../db/connection';
import { clearChartCache } from '../engine-bridge/charts';
import { useLang } from '../i18n';
import { fmtDate } from '../today/format';
import { RichText } from '../today/RichText';
import { applyBackup, type ImportMode } from './apply';
import { BackupError, decryptBackup, encryptBackup, PASSPHRASE_MIN, passphraseLength } from './crypto';
import { realBackupDeps, type BackupDeps } from './deps';
import { collectBackup, countsOf, parseBackupDocument, totalItems, type BackupCounts, type BackupDocument } from './document';

export interface BackupScreenProps {
  deps?: BackupDeps;
  now?: () => Date;
}

type ExportState = { kind: 'idle' } | { kind: 'busy' } | { kind: 'done'; size: number } | { kind: 'failed' };
type ImportState =
  | { kind: 'idle' }
  | { kind: 'picked'; name: string; bytes: Uint8Array }
  | { kind: 'opening' }
  | { kind: 'preview'; doc: BackupDocument; counts: BackupCounts }
  | { kind: 'restoring' }
  | { kind: 'done'; count: number; mode: ImportMode };

export function fileNameFor(t: (k: string, p?: Record<string, string>) => string, now: Date): string {
  const date = now.toISOString().slice(0, 10);
  return t('backup.fileName', { date });
}

export function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function BackupScreen({ deps = realBackupDeps, now = () => new Date() }: BackupScreenProps) {
  const { t, lang } = useLang();
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [passError, setPassError] = useState<string | null>(null);
  const [exp, setExp] = useState<ExportState>({ kind: 'idle' });
  const [imp, setImp] = useState<ImportState>({ kind: 'idle' });
  const [importPass, setImportPass] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);

  async function createBackup() {
    if (passphraseLength(pass) < PASSPHRASE_MIN) return setPassError(t('backup.passphraseShort'));
    if (pass !== pass2) return setPassError(t('backup.passphraseMismatch'));
    setPassError(null);
    setExp({ kind: 'busy' });
    try {
      const doc = collectBackup(getDb(), { appVersion: deps.appVersion(), schemaVersion: deps.schemaVersion(), now: now() });
      const bytes = encryptBackup(JSON.stringify(doc), pass, deps.crypto());
      await deps.writeAndShare(fileNameFor(t, now()), bytes);
      setExp({ kind: 'done', size: bytes.length });
    } catch (e) {
      if (__DEV__) console.warn('backup export failed', e);
      setExp({ kind: 'failed' });
    } finally {
      // The passphrase leaves memory with the fields.
      setPass('');
      setPass2('');
    }
  }

  async function pick() {
    setImportError(null);
    try {
      const r = await deps.pickAndRead();
      if (!r) return;
      setImp({ kind: 'picked', name: r.name, bytes: r.bytes });
    } catch (e) {
      if (__DEV__) console.warn('backup pick failed', e);
      setImportError(t('backup.notBackup'));
    }
  }

  function open(bytes: Uint8Array) {
    if (passphraseLength(importPass) < PASSPHRASE_MIN) return setImportError(t('backup.passphraseShort'));
    setImportError(null);
    const picked = imp.kind === 'picked' ? imp : null;
    setImp({ kind: 'opening' });
    let json: string;
    try {
      json = decryptBackup(bytes, importPass, deps.crypto());
    } catch (e) {
      const code = e instanceof BackupError ? e.code : 'format';
      setImportError(code === 'passphrase' ? t('backup.wrongPassphrase') : t('backup.notBackup'));
      setImp(picked ?? { kind: 'idle' });
      return;
    } finally {
      setImportPass('');
    }
    const parsed = parseBackupDocument(json);
    if (!parsed.ok) {
      setImportError(parsed.problem === 'newer' ? t('backup.newerApp') : t('backup.notBackup'));
      setImp(picked ?? { kind: 'idle' });
      return;
    }
    setImp({ kind: 'preview', doc: parsed.doc, counts: countsOf(parsed.doc) });
  }

  async function restore(mode: ImportMode) {
    if (imp.kind !== 'preview') return;
    const { doc, counts } = imp;
    setConfirmReplace(false);
    setImp({ kind: 'restoring' });
    try {
      applyBackup(doc, mode);
      clearChartCache();
      await deps.afterRestore();
      setImp({ kind: 'done', count: totalItems(counts), mode });
    } catch (e) {
      if (__DEV__) console.warn('backup restore failed', e);
      setImportError(t('backup.notBackup'));
      setImp({ kind: 'preview', doc, counts });
    }
  }

  const countRows = (c: BackupCounts): string[] =>
    (['profiles', 'ancestors', 'reminders', 'journal', 'prashna', 'muhurats', 'lessons'] as const).map((k) => t(`backup.count.${k}`, { count: c[k] }));

  return (
    <>
      <Txt kind="body">{t('backup.lede')}</Txt>
      <Card testID="backup-export-card">
        <Txt kind="heading" accessibilityRole="header">
          {t('backup.export')}
        </Txt>
        <TextField label={t('backup.passphrase')} value={pass} onChangeText={setPass} secureTextEntry autoCapitalize="none" autoCorrect={false} hint={t('backup.passphraseHint')} testID="backup-pass" />
        <TextField label={t('backup.passphraseRepeat')} value={pass2} onChangeText={setPass2} secureTextEntry autoCapitalize="none" autoCorrect={false} error={passError} testID="backup-pass2" />
        <Txt kind="caption" color="ink3">
          {t('backup.passphraseNoRecovery')}
        </Txt>
        <Txt kind="caption" color="ink3">
          {t('backup.encryptedWith')}
        </Txt>
        <PrimaryButton label={exp.kind === 'busy' ? t('backup.creating') : t('backup.export')} onPress={() => void createBackup()} disabled={exp.kind === 'busy'} style={styles.cta} testID="backup-create" />
        {exp.kind === 'done' ? (
          <RichText kind="caption" color="ink2" accessibilityLiveRegion="polite" text={t('backup.created', { size: sizeLabel(exp.size) })} testID="backup-created" />
        ) : null}
        {exp.kind === 'failed' ? <InlineNotice tone="error">{t('backup.failed')}</InlineNotice> : null}
      </Card>

      <Card testID="backup-import-card">
        <Txt kind="heading" accessibilityRole="header">
          {t('backup.import')}
        </Txt>
        {imp.kind === 'idle' || imp.kind === 'picked' ? <SecondaryButton label={t('backup.pickFile')} onPress={() => void pick()} testID="backup-pick" /> : null}
        {imp.kind === 'picked' ? (
          <View style={styles.block}>
            <Txt kind="caption" color="ink2" testID="backup-picked-name">
              {imp.name}
            </Txt>
            <TextField label={t('backup.passphrase')} value={importPass} onChangeText={setImportPass} secureTextEntry autoCapitalize="none" autoCorrect={false} error={importError} testID="backup-import-pass" />
            <PrimaryButton label={t('backup.import')} onPress={() => open(imp.bytes)} testID="backup-open" />
          </View>
        ) : importError ? (
          <InlineNotice tone="error">{importError}</InlineNotice>
        ) : null}
        {imp.kind === 'opening' ? (
          <Txt kind="body" color="ink2">
            {t('backup.opening')}
          </Txt>
        ) : null}
        {imp.kind === 'preview' ? (
          <View style={styles.block} testID="backup-preview">
            <Txt kind="label" weight={600}>
              {t('backup.previewTitle')}
            </Txt>
            <Txt kind="caption" color="ink2">
              {t('backup.previewFrom', { date: imp.doc.createdAt ? fmtDate(Date.parse(imp.doc.createdAt), 'UTC', lang) : '?', version: imp.doc.appVersion })}
            </Txt>
            {countRows(imp.counts).map((line) => (
              <RichText key={line} kind="body" text={line} testID="backup-count" />
            ))}
            <Txt kind="label" weight={600} style={styles.mode}>
              {t('backup.chooseMode')}
            </Txt>
            <Txt kind="caption" color="ink2">
              {t('backup.mergeBody')}
            </Txt>
            <PrimaryButton label={t('backup.merge')} onPress={() => void restore('merge')} testID="backup-merge" />
            <Txt kind="caption" color="ink2">
              {t('backup.replaceBody')}
            </Txt>
            <SecondaryButton label={t('backup.replace')} onPress={() => setConfirmReplace(true)} testID="backup-replace" />
            <Txt kind="caption" color="ink3">
              {t('backup.proNotIncluded')} {t('backup.modelNotIncluded')}
            </Txt>
            {importError ? <InlineNotice tone="error">{importError}</InlineNotice> : null}
          </View>
        ) : null}
        {imp.kind === 'restoring' ? (
          <Txt kind="body" color="ink2">
            {t('backup.restoring')}
          </Txt>
        ) : null}
        {imp.kind === 'done' ? (
          <View style={styles.block}>
            <RichText kind="body" accessibilityLiveRegion="polite" text={t('backup.restored', { count: imp.count })} testID="backup-restored" />
            <SecondaryButton label={t('backup.pickFile')} onPress={() => void pick()} testID="backup-pick-again" />
          </View>
        ) : null}
      </Card>

      <Sheet
        visible={confirmReplace}
        onClose={() => setConfirmReplace(false)}
        title={t('backup.replace')}
        footer={
          <View style={styles.block}>
            <PrimaryButton label={t('backup.replace')} onPress={() => void restore('replace')} testID="backup-replace-confirm" />
            <SecondaryButton label={t('backup.cancel')} onPress={() => setConfirmReplace(false)} />
          </View>
        }
      >
        <Txt kind="body">{t('backup.replaceConfirm')}</Txt>
        <Txt kind="body" color="ink2">
          {t('backup.replaceBody')}
        </Txt>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  cta: { marginTop: 12 },
  block: { gap: 8, marginTop: 8 },
  mode: { marginTop: 8 },
});
