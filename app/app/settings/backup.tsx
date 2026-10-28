// Settings -> Privacy -> Backup and restore (spec section 10, design.md 10.1; plan C04). The screen body lives in
// src/backup/BackupScreen.tsx so its flows are unit-tested with injected native bindings.
import { BackupScreen } from '../../src/backup/BackupScreen';
import { Screen } from '../../src/components';
import { useLang } from '../../src/i18n';

export default function BackupRoute() {
  const { t } = useLang();
  return (
    <Screen title={t('backup.title')} chrome="stack" testID="backup-screen">
      <BackupScreen />
    </Screen>
  );
}
