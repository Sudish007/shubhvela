// The honest free-tier refusal (design.md 10.1 F3; plan A09): when entitlements.ts refuses, the UI explains instead
// of failing silently. Until B03 ships the Pro screen the sheet says plainly that Pro is not in this build.
import type { Refusal } from '../entitlements';
import { useLang } from '../i18n';
import { PrimaryButton } from './Button';
import { Sheet } from './Sheet';
import { Tag } from './Tag';
import { Txt } from './Txt';

export interface CapSheetProps {
  visible: boolean;
  onClose: () => void;
  reason: Refusal;
}

export function CapSheet({ visible, onClose, reason }: CapSheetProps) {
  const { t } = useLang();
  const title = reason === 'pro_profiles' ? t('family.profileCapTitle') : reason === 'pro_reminders' ? t('reminders.capTitle') : t('common.proNotYetTitle');
  const body = reason === 'pro_profiles' ? t('family.profileCapBody') : reason === 'pro_reminders' ? t('reminders.capBody') : t('common.proNotYetBody');
  return (
    <Sheet visible={visible} onClose={onClose} title={title} footer={<PrimaryButton label={t('common.ok')} onPress={onClose} />}>
      <Tag variant="kind">{t('common.pro')}</Tag>
      <Txt kind="body">{body}</Txt>
    </Sheet>
  );
}
