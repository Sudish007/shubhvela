// "Type a code" field (F30, design.md 11): 20 Crockford base32 characters, case-insensitive, I/L -> 1 and O -> 0,
// hyphens and spaces ignored; the ONE inline error "This code isn't valid - check the 20 characters or scan the QR" for a
// bad length, alphabet, CRC or version. When the code decodes, the hint says what was read (date, no name).
import { formatShareCode } from '@shubhvela/engine';
import { TextField } from '../components/TextField';
import { formatIsoDate } from '../format';
import { useLang } from '../i18n';
import { typedState } from '../match/draft';
import { decodeShared, typedCodeProgress } from './payload';

export interface TypeCodeFieldProps {
  value: string;
  onChangeText: (s: string) => void;
  /** True once the user left the field or pressed Match: incomplete input then shows the error too. */
  touched: boolean;
  onBlur?: () => void;
  /** Clock for the payload's date-range check (the pick screen's mount clock). */
  nowMs: number;
  testID?: string;
}

export function TypeCodeField({ value, onChangeText, touched, onBlur, nowMs, testID }: TypeCodeFieldProps) {
  const { t, lang } = useLang();
  const state = typedState(value, touched, nowMs);
  const payload = state === 'valid' ? decodeShared(value, nowMs) : null;
  const hint = payload ? `${t('share.decoded')} · ${t('share.codeDate', { date: formatIsoDate(payload.date, lang) })}` : t('share.typeHint');
  return (
    <TextField
      label={t('share.type')}
      value={value}
      onChangeText={(s) => {
        // Re-group as the user types so the field reads like the sheet: ABCD-EFGH-....
        const p = typedCodeProgress(s);
        onChangeText(p.alphabetOk && p.normalised.length <= 20 ? formatShareCode(p.normalised) : s);
      }}
      onBlur={onBlur}
      autoCapitalize="characters"
      autoCorrect={false}
      maxLength={29}
      numeric
      error={state === 'invalid' ? t('share.invalid') : null}
      hint={hint}
      testID={testID}
    />
  );
}
