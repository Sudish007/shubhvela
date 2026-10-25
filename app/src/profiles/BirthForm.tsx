// The birth-details form shared by onboarding (F1/F2) and the profile editor (F3): native date/time pickers,
// "I don't know the time" (Moon-chart mode) and "Approximate" with the 15/30/60 min segmented control (N11, default 30),
// PlaceField, optional name (<= 40), gender, relationship; the editor adds tradition and PDF language.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Checkbox } from '../components/Checkbox';
import { Chip } from '../components/Chip';
import { Pressable44 } from '../components/Pressable44';
import { Segmented } from '../components/Segmented';
import { TextField } from '../components/TextField';
import { Txt } from '../components/Txt';
import { Num } from '../components/Num';
import { RELATIONSHIPS, type Gender, type Relationship } from '../db/profiles';
import type { Lang, Tradition } from '../db/settings';
import { formatIsoDate } from '../format';
import { useLang } from '../i18n';
import { useTokens } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';
import { pickDate, pickTime } from './nativePickers';
import { PlaceField } from './PlaceField';
import { NAME_MAX, nameLength, type BirthFormValue, type FormErrors } from './validate';

export interface BirthFormProps {
  value: BirthFormValue;
  onChange: (next: BirthFormValue) => void;
  errors: FormErrors;
  /** Editor mode shows tradition and PDF language; onboarding does not. */
  editor?: boolean;
  /** The self profile keeps relationship "Me" and hides the relationship chips. */
  lockSelf?: boolean;
}

const GENDERS: readonly (Gender | 'skip')[] = ['female', 'male', 'other', 'skip'];

export function BirthForm({ value, onChange, errors, editor, lockSelf }: BirthFormProps) {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  const [nameTouched, setNameTouched] = useState(false);
  const set = <K extends keyof BirthFormValue>(k: K, v: BirthFormValue[K]) => onChange({ ...value, [k]: v });
  const pickerStyle = [styles.picker, { borderColor: colors.hair2, backgroundColor: colors.surface }];
  const nameError = errors.name || (nameTouched && nameLength(value.name) > NAME_MAX) ? t('onboarding.nameError') : null;

  return (
    <View style={styles.form}>
      <View style={styles.field}>
        <Txt kind="label" weight={400} color="ink2">
          {t('onboarding.birthDate')}
        </Txt>
        <Pressable44 accessibilityLabel={t('onboarding.birthDate')} onPress={() => pickDate(value.birthDate, (iso) => set('birthDate', iso))} style={[pickerStyle, errors.date && { borderColor: colors.accent }]} testID="pick-date">
          {value.birthDate ? (
            <Num kind="body">{formatIsoDate(value.birthDate, lang)}</Num>
          ) : (
            <Txt kind="body" color="ink3">
              {t('onboarding.pickDate')}
            </Txt>
          )}
        </Pressable44>
        {errors.date ? (
          <Txt kind="caption" color="accent">
            {t('onboarding.dateError')}
          </Txt>
        ) : null}
      </View>

      <View style={styles.field}>
        <Txt kind="label" weight={400} color="ink2">
          {t('onboarding.birthTime')}
        </Txt>
        <Pressable44
          accessibilityLabel={t('onboarding.birthTime')}
          accessibilityState={{ disabled: value.timeUnknown }}
          disabled={value.timeUnknown}
          onPress={() => pickTime(value.birthTime, (hhmm) => set('birthTime', hhmm))}
          style={[pickerStyle, value.timeUnknown && styles.disabled, errors.time && { borderColor: colors.accent }]}
          testID="pick-time"
        >
          {value.birthTime && !value.timeUnknown ? (
            <Num kind="body">{value.birthTime}</Num>
          ) : (
            <Txt kind="body" color="ink3">
              {value.timeUnknown ? t('common.unknown') : t('onboarding.pickTime')}
            </Txt>
          )}
        </Pressable44>
        {errors.time ? (
          <Txt kind="caption" color="accent">
            {t('onboarding.timeError')}
          </Txt>
        ) : null}
        <Checkbox label={t('onboarding.timeUnknown')} checked={value.timeUnknown} onChange={(c) => onChange({ ...value, timeUnknown: c, timeApprox: c ? false : value.timeApprox })} testID="time-unknown" />
        <Checkbox label={t('onboarding.timeApprox')} checked={value.timeApprox} disabled={value.timeUnknown} onChange={(c) => set('timeApprox', c)} testID="time-approx" />
        {value.timeApprox && !value.timeUnknown ? (
          <View style={styles.approx}>
            <Txt kind="caption" color="ink3">
              {t('onboarding.timeApproxHint')}
            </Txt>
            <Segmented
              accessibilityLabel={t('onboarding.timeApprox')}
              value={value.approxMinutes}
              onChange={(m) => set('approxMinutes', m)}
              options={[
                { value: 15, label: t('onboarding.approx15') },
                { value: 30, label: t('onboarding.approx30') },
                { value: 60, label: t('onboarding.approx60') },
              ]}
              testID="approx-minutes"
            />
          </View>
        ) : null}
      </View>

      <PlaceField value={value.place} onChange={(p) => set('place', p)} error={errors.place ? t('onboarding.placeError') : null} birthDate={value.birthDate} birthTime={value.timeUnknown ? null : value.birthTime} />

      <TextField
        label={`${t('onboarding.name')} (${t('common.optional')})`}
        value={value.name}
        onChangeText={(s) => {
          setNameTouched(true);
          set('name', s);
        }}
        maxLength={NAME_MAX + 10}
        autoCapitalize="words"
        error={nameError}
      />

      <View style={styles.field}>
        <Txt kind="label" weight={400} color="ink2">
          {`${t('onboarding.gender')} (${t('common.optional')})`}
        </Txt>
        <View style={styles.chips}>
          {GENDERS.map((g) => (
            <Chip
              key={g}
              label={g === 'skip' ? t('onboarding.genderSkip') : t(`onboarding.gender${g[0].toUpperCase()}${g.slice(1)}`)}
              selected={g === 'skip' ? value.gender === null : value.gender === g}
              onPress={() => set('gender', g === 'skip' ? null : g)}
            />
          ))}
        </View>
      </View>

      {lockSelf ? null : (
        <View style={styles.field}>
          <Txt kind="label" weight={400} color="ink2">
            {t('onboarding.relationship')}
          </Txt>
          <View style={styles.chips}>
            {RELATIONSHIPS.filter((r) => r !== 'self').map((r: Relationship) => (
              <Chip key={r} label={t(`family.relation.${r}`)} selected={value.relationship === r} onPress={() => set('relationship', r)} />
            ))}
          </View>
        </View>
      )}

      {editor ? (
        <>
          <View style={styles.field}>
            <Txt kind="label" weight={400} color="ink2">
              {t('family.tradition')}
            </Txt>
            <Segmented<Tradition>
              accessibilityLabel={t('family.tradition')}
              value={value.tradition}
              onChange={(v) => set('tradition', v)}
              options={[
                { value: 'purnimanta', label: t('family.traditionPurnimanta') },
                { value: 'amanta', label: t('family.traditionAmanta') },
              ]}
            />
          </View>
          <View style={styles.field}>
            <Txt kind="label" weight={400} color="ink2">
              {t('family.pdfLanguage')}
            </Txt>
            <Segmented<Lang>
              accessibilityLabel={t('family.pdfLanguage')}
              value={value.pdfLanguage}
              onChange={(v) => set('pdfLanguage', v)}
              options={[
                { value: 'en', label: t('settings.lang.en') },
                { value: 'hi', label: t('settings.lang.hi') },
                { value: 'bho', label: t('settings.lang.bho') },
              ]}
            />
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16 },
  field: { gap: 6 },
  picker: { minHeight: 44, borderWidth: 1, borderRadius: radius.button, paddingHorizontal: 12, alignItems: 'flex-start', alignSelf: 'stretch' },
  disabled: { opacity: 0.5 },
  approx: { gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
