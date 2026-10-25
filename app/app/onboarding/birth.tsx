// Onboarding 2/3: birth details (F1/F2). Validation per design.md 11; on "Next" the self profile is written to
// SQLite (the chart is computed on the intent screen's "Show my chart").
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { PrimaryButton, Screen, Txt } from '../../src/components';
import { getSelfProfile, insertProfile, updateProfile } from '../../src/db/profiles';
import { getSetting } from '../../src/db/settings';
import { useLang } from '../../src/i18n';
import { BirthForm } from '../../src/profiles/BirthForm';
import { formToProfile, profileToForm } from '../../src/profiles/mapping';
import { EMPTY_FORM, validateForm, type BirthFormValue, type FormErrors } from '../../src/profiles/validate';

export default function BirthScreen() {
  const { t, lang } = useLang();
  const router = useRouter();
  const existing = getSelfProfile();
  const [value, setValue] = useState<BirthFormValue>(() =>
    existing ? profileToForm(existing) : EMPTY_FORM({ tradition: getSetting('traditionDefault'), pdfLanguage: lang, relationship: 'self' }),
  );
  const [errors, setErrors] = useState<FormErrors>({});

  function next() {
    const e = validateForm(value);
    setErrors(e);
    if (Object.keys(e).length) return;
    const input = formToProfile(value, { isSelf: true, intent: existing?.intent ?? null });
    if (existing) updateProfile(existing.id, input);
    else insertProfile(input);
    router.push('/onboarding/intent');
  }

  return (
    <Screen title={t('onboarding.birthTitle')} chrome="stack" testID="birth-screen" stickyCta={<PrimaryButton label={t('common.next')} onPress={next} testID="birth-next" />}>
      <Txt kind="caption" color="ink3">
        {t('onboarding.step', { n: 2, total: 3 })}
      </Txt>
      <BirthForm value={value} onChange={setValue} errors={errors} lockSelf />
    </Screen>
  );
}
