// The honest free-tier refusal (design.md 10.1 F3; plan A09, B03): when entitlements.ts refuses, the UI explains the
// cap and offers the Pro screen ("Go Pro" -> /pro) or "Not now". Phase A's "Pro is not in this build yet" sheet is gone.
import { useRouter } from 'expo-router';
import type { Refusal } from '../entitlements';
import { useLang } from '../i18n';
import { PrimaryButton, TextButton } from './Button';
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
  const router = useRouter();
  const title = reason === 'pro_profiles' ? t('family.profileCapTitle') : reason === 'pro_reminders' ? t('reminders.capTitle') : t('common.proFeatureTitle');
  const body = reason === 'pro_profiles' ? t('family.profileCapBody') : reason === 'pro_reminders' ? t('reminders.capBody') : t('common.proFeatureBody');
  const goPro = () => {
    onClose();
    router.push('/pro');
  };
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      footer={
        <>
          <PrimaryButton label={t('pro.goPro')} onPress={goPro} testID="cap-go-pro" />
          <TextButton label={t('common.notNow')} onPress={onClose} testID="cap-not-now" />
        </>
      }
    >
      <Tag variant="kind">{t('common.pro')}</Tag>
      <Txt kind="body">{body}</Txt>
    </Sheet>
  );
}
