// Screens behind the deep-link routes (F37, design.md 11 "Web compute / URL state" row): InvalidLinkScreen says what
// was wrong in one line and offers Discard / Open on the web; KundliLinkScreen ("Chart from a link") shows the birth
// form pre-filled with what parsed, inline errors on the fields that did not, and "Save as profile" (under the profile
// cap) / Discard. Nothing is saved before the tap; display extras (ay/nd/st) are shown, never applied to Settings.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { CapSheet, Card, InlineNotice, PrimaryButton, Screen, SecondaryButton, TextButton, Txt } from '../components';
import { countProfiles, insertProfile, type Gender } from '../db/profiles';
import { getSetting } from '../db/settings';
import type { DeepLinkTarget, KundliPrefill } from '../deeplinks';
import { canAddProfile } from '../entitlements';
import { useLang } from '../i18n';
import { webBase } from '../legal';
import { BirthForm } from '../profiles/BirthForm';
import { formToProfile } from '../profiles/mapping';
import { EMPTY_FORM, validateForm, type BirthFormValue, type FormErrors } from '../profiles/validate';
import { AYANAMSA_KEY, CHART_STYLE_KEY, NODE_KEY, shortValue } from '../settingsLabels';

type Invalid = Extract<DeepLinkTarget, { kind: 'invalid' }>;

export function invalidBodyKey(target: Invalid): { key: string; params?: Record<string, string> } {
  switch (target.reason) {
    case 'festival':
      return { key: 'deeplink.unknownFestival', params: { slug: target.detail ?? '' } };
    case 'city':
      return { key: 'deeplink.unknownCity', params: { city: target.detail ?? '' } };
    case 'year':
      return { key: 'deeplink.badYear', params: { year: target.detail ?? '' } };
    case 'version':
      return { key: 'deeplink.wrongVersion' };
    default:
      return { key: 'deeplink.invalidBody' };
  }
}

export interface InvalidLinkScreenProps {
  target: Invalid;
  /** The web page to offer instead (null hides the button). */
  webPath?: string | null;
  openUrl?: (url: string) => Promise<unknown>;
}

export function InvalidLinkScreen({ target, webPath, openUrl = (u) => Linking.openURL(u) }: InvalidLinkScreenProps) {
  const { t } = useLang();
  const router = useRouter();
  const body = invalidBodyKey(target);
  return (
    <Screen title={t('deeplink.invalid')} chrome="stack" onBack={() => router.replace('/')} testID="deeplink-invalid-screen">
      <Card>
        <InlineNotice tone="error">{t(body.key, body.params)}</InlineNotice>
        <View style={styles.actions}>
          <PrimaryButton label={t('deeplink.discard')} onPress={() => router.replace('/')} testID="deeplink-discard" />
          {webPath ? <TextButton label={t('deeplink.openWeb')} onPress={() => void openUrl(`${webBase()}${webPath.replace(/^\//, '')}`)} testID="deeplink-open-web" /> : null}
        </View>
      </Card>
    </Screen>
  );
}

/** BirthFormValue from a (possibly partial) M8 pre-fill: coordinates become a manual place; the name comes from `n`. */
export function formFromPrefill(p: KundliPrefill, defaults: Parameters<typeof EMPTY_FORM>[0]): BirthFormValue {
  const base = EMPTY_FORM(defaults);
  const gender: Gender | null = p.gender === 'f' ? 'female' : p.gender === 'm' ? 'male' : null;
  const place = p.lat !== null && p.lon !== null && p.tz ? { name: `${p.lat.toFixed(2)}, ${p.lon.toFixed(2)}`, admin1: '', country: '', lat: p.lat, lon: p.lon, tz: p.tz, source: 'manual' as const } : null;
  return {
    ...base,
    birthDate: p.birthDate,
    birthTime: p.timeUnknown ? null : p.birthTime,
    timeUnknown: p.timeUnknown,
    timeApprox: p.approx > 0,
    approxMinutes: p.approx === 15 || p.approx === 30 || p.approx === 60 ? p.approx : 30,
    place,
    name: p.name ?? '',
    gender,
  };
}

/** Inline errors for the fields the link did not carry correctly. */
export function errorsFromPrefill(p: KundliPrefill): FormErrors {
  const e: FormErrors = {};
  if (p.errors.includes('date')) e.date = true;
  if (p.errors.includes('time') || p.errors.includes('approx')) e.time = true;
  if (p.errors.includes('lat') || p.errors.includes('lon') || p.errors.includes('tz')) e.place = true;
  if (p.errors.includes('name')) e.name = true;
  return e;
}

export interface KundliLinkScreenProps {
  target: Extract<DeepLinkTarget, { kind: 'kundli' }> | Invalid;
}

export function KundliLinkScreen({ target }: KundliLinkScreenProps) {
  const { t, lang } = useLang();
  const router = useRouter();
  const prefill = target.kind === 'kundli' ? target.prefill : target.prefill;
  const [value, setValue] = useState<BirthFormValue>(() => (prefill ? formFromPrefill(prefill, { tradition: getSetting('traditionDefault'), pdfLanguage: lang, relationship: 'other' }) : EMPTY_FORM({ tradition: getSetting('traditionDefault'), pdfLanguage: lang, relationship: 'other' })));
  const [errors, setErrors] = useState<FormErrors>(() => (prefill ? errorsFromPrefill(prefill) : {}));
  const [capOpen, setCapOpen] = useState(false);
  const invalid = target.kind === 'invalid';
  const extras = target.kind === 'kundli' ? target.extras : {};
  const extrasLine = [extras.ay ? shortValue(t(AYANAMSA_KEY[extras.ay])) : null, extras.nd ? shortValue(t(NODE_KEY[extras.nd])) : null, extras.st ? t(CHART_STYLE_KEY[extras.st]) : null].filter(Boolean).join(' · ');

  function save() {
    const e = validateForm(value);
    setErrors(e);
    if (Object.keys(e).length) return;
    const decision = canAddProfile(countProfiles());
    if (!decision.allowed) return setCapOpen(true);
    insertProfile(formToProfile(value, { isSelf: false, intent: null }));
    router.replace('/(tabs)/family');
  }

  return (
    <Screen title={t('deeplink.kundliTitle')} chrome="stack" onBack={() => router.replace('/')} stickyCta={<PrimaryButton label={t('deeplink.saveProfile')} onPress={save} testID="deeplink-save" />} testID="deeplink-kundli-screen">
      <Txt kind="body">{t('deeplink.kundliBody')}</Txt>
      {invalid ? <InlineNotice tone="error">{target.reason === 'version' ? t('deeplink.wrongVersion') : t('errors.urlState')}</InlineNotice> : null}
      {extrasLine ? (
        <Txt kind="caption" color="ink3" testID="deeplink-extras">
          {extrasLine}
        </Txt>
      ) : null}
      <BirthForm value={value} onChange={setValue} errors={errors} editor />
      <View style={styles.actions}>
        <SecondaryButton label={t('deeplink.discard')} onPress={() => router.replace('/')} testID="deeplink-kundli-discard" />
      </View>
      <CapSheet visible={capOpen} onClose={() => setCapOpen(false)} reason="pro_profiles" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 8, marginTop: 12 },
});
