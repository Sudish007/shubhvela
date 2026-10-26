// Share for matching (F30 mode A, design.md 10.6 F30, plan P5): the QR of the versioned /m/ URL (no name, lat/lon to
// 0.01 deg) via react-native-qrcode-svg, the 20-character typed code in groups of four, Copy, the privacy copy "This
// code contains birth date, time and place but no name." and the list of what is / is not carried. No relay, no 8-char
// code anywhere (offline-first decision P5). Used as a Sheet (Family tools row, profile editor menu) and as the body of
// the /family/share-code route.
import * as Clipboard from 'expo-clipboard';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SecondaryButton } from '../components/Button';
import { Num } from '../components/Num';
import { Sheet } from '../components/Sheet';
import { Txt } from '../components/Txt';
import type { Profile } from '../db/profiles';
import { formatIsoDate } from '../format';
import { useLang } from '../i18n';
import { profileLabel } from '../muhurat/ForField';
import { useTokens } from '../theme/ThemeProvider';
import { colors as palette, radius } from '../theme/tokens';
import { carriersFor, payloadFromProfile } from './payload';

// A QR is scanned by another phone's camera: it stays ink-on-surface of the LIGHT palette in both themes (inverted
// modules are not read reliably by every scanner); the box around it takes the current theme.
const QR_INK = palette.light.ink;
const QR_PAPER = palette.light.surface;

export interface ShareCodeContentProps {
  profile: Profile;
  /** Clipboard writer (injected in tests). */
  copy?: (text: string) => Promise<unknown>;
  testID?: string;
}

const QR_SIZE = 220;

export function ShareCodeContent({ profile, copy = (s) => Clipboard.setStringAsync(s), testID }: ShareCodeContentProps) {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  const [copied, setCopied] = useState(false);
  const payload = useMemo(() => payloadFromProfile(profile), [profile]);
  const carriers = useMemo(() => carriersFor(payload), [payload]);
  const gender = payload.gender === 'f' ? t('onboarding.genderFemale') : payload.gender === 'm' ? t('onboarding.genderMale') : t('onboarding.genderSkip');
  const fields: [string, string][] = [
    [t('share.fieldDate'), formatIsoDate(payload.date, lang)],
    [t('share.fieldTime'), payload.time === null ? t('common.unknown') : payload.approx ? `${payload.time} · ${t('common.approxMinutes', { minutes: payload.approx })}` : payload.time],
    [t('share.fieldPlace'), `${payload.lat.toFixed(2)}, ${payload.lon.toFixed(2)}`],
    [t('share.fieldZone'), payload.tz],
    [t('share.fieldGender'), gender],
  ];
  return (
    <View testID={testID} style={styles.wrap}>
      <Txt kind="label" weight={400} color="ink2" testID="share-for">
        {t('share.forProfile', { name: profileLabel(profile, t) })}
      </Txt>
      <View style={[styles.qrBox, { backgroundColor: QR_PAPER, borderColor: colors.hair }]} accessibilityLabel={t('share.qrA11y')} accessibilityRole="image" testID="share-qr">
        <QRCode value={carriers.url} size={QR_SIZE} color={QR_INK} backgroundColor={QR_PAPER} ecl="M" quietZone={8} />
      </View>
      <Txt kind="body" weight={600} testID="share-privacy">
        {t('share.codeContains')}
      </Txt>
      <View style={styles.codeBlock}>
        <Txt kind="micro" weight={600} color="ink3">
          {t('share.typedCode')}
        </Txt>
        <Num kind="heading" weight={600} testID="share-code" accessibilityLabel={`${t('share.typedCode')} ${carriers.grouped.split('').join(' ')}`}>
          {carriers.grouped}
        </Num>
        <Txt kind="caption" color="ink3">
          {t('share.typeHint')}
        </Txt>
        <SecondaryButton
          label={copied ? t('share.copied') : t('share.copy')}
          onPress={() => {
            void copy(carriers.grouped).then(() => setCopied(true));
          }}
          style={styles.copy}
          testID="share-copy"
        />
      </View>
      <View style={[styles.fields, { borderColor: colors.hair }]} testID="share-fields">
        <Txt kind="micro" weight={600} color="ink3">
          {t('share.whatIsShared')}
        </Txt>
        {fields.map(([k, v]) => (
          <View key={k} style={styles.fieldRow}>
            <Txt kind="caption" color="ink2" style={styles.fieldKey}>
              {k}
            </Txt>
            <Num kind="caption" style={styles.fieldValue}>
              {v}
            </Num>
          </View>
        ))}
        <Txt kind="caption" color="ink3" testID="share-not-shared">
          {t('share.notShared')}
        </Txt>
      </View>
    </View>
  );
}

export interface ShareCodeSheetProps {
  visible: boolean;
  onClose: () => void;
  profile: Profile | null;
}

export function ShareCodeSheet({ visible, onClose, profile }: ShareCodeSheetProps) {
  const { t } = useLang();
  if (!profile) return null;
  return (
    <Sheet visible={visible} onClose={onClose} title={t('share.title')}>
      <ShareCodeContent profile={profile} testID="share-sheet" />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  qrBox: { alignSelf: 'center', padding: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.card },
  codeBlock: { gap: 4 },
  copy: { alignSelf: 'flex-start', marginTop: 4 },
  fields: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, gap: 4 },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  fieldKey: { flexShrink: 1 },
  fieldValue: { flexShrink: 1, textAlign: 'right' },
});
