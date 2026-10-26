// "Enter details" side of the matching picker (F29): the onboarding birth form (date, time with unknown / approximate,
// place, optional name, gender) for a person who has no profile on this phone. Nothing is saved - the details become
// a share code for the result route only. The relationship chips are hidden (lockSelf) and no editor fields show.
import { StyleSheet, View } from 'react-native';
import { Txt } from '../components/Txt';
import { useLang } from '../i18n';
import { BirthForm } from '../profiles/BirthForm';
import type { BirthFormValue, FormErrors } from '../profiles/validate';

export interface EnterDetailsFormProps {
  value: BirthFormValue;
  errors: FormErrors;
  onChange: (next: BirthFormValue) => void;
  testID?: string;
}

export function EnterDetailsForm({ value, errors, onChange, testID }: EnterDetailsFormProps) {
  const { t } = useLang();
  return (
    <View testID={testID} style={styles.wrap}>
      <Txt kind="caption" color="ink3">
        {t('match.enteredDetails')}
      </Txt>
      <BirthForm value={value} onChange={onChange} errors={errors} lockSelf />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginTop: 4 },
});
