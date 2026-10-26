// Profile editor (F3, design.md 10.1): the birth form plus relationship, tradition (Purnimanta/Amanta) and PDF language;
// /profile/new creates (under entitlements.canAddProfile(), refused with the honest cap sheet), /profile/<id> edits.
// No "deceased" toggle (M16: ancestors are not profiles). B06 (M3): the header ⋮ control opens "More actions" with "Share for
// matching" (the share-code sheet for this profile); the phrase "profile menu" appears nowhere.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CapSheet, Card, ChevronIcon, MoreIcon, NavRow, Pressable44, PrimaryButton, Screen, SecondaryButton, Sheet, Txt } from '../../src/components';
import { useMountClock } from '../../src/charts/LockedFeature';
import { isNewborn } from '../../src/family/naamkaranModel';
import { countProfiles, deleteProfile, getProfile, insertProfile, updateProfile } from '../../src/db/profiles';
import { getSetting } from '../../src/db/settings';
import { canAddProfile } from '../../src/entitlements';
import { useLang } from '../../src/i18n';
import { BirthForm } from '../../src/profiles/BirthForm';
import { formToProfile, profileToForm } from '../../src/profiles/mapping';
import { EMPTY_FORM, validateForm, type BirthFormValue, type FormErrors } from '../../src/profiles/validate';
import { ShareCodeSheet } from '../../src/share/ShareCodeSheet';
import { useTokens } from '../../src/theme/ThemeProvider';
import { radius } from '../../src/theme/tokens';

export default function ProfileEditor() {
  const { t, lang } = useLang();
  const { colors } = useTokens();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const existing = isNew ? null : getProfile(Number(id));
  const [value, setValue] = useState<BirthFormValue>(() =>
    existing ? profileToForm(existing) : EMPTY_FORM({ tradition: getSetting('traditionDefault'), pdfLanguage: lang, relationship: 'mother' }),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [capOpen, setCapOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const mountedAt = useMountClock();

  function save() {
    const e = validateForm(value);
    setErrors(e);
    if (Object.keys(e).length) return;
    if (existing) {
      updateProfile(existing.id, formToProfile(value, { isSelf: existing.isSelf, intent: existing.intent }));
    } else {
      const decision = canAddProfile(countProfiles());
      if (!decision.allowed) return setCapOpen(true);
      insertProfile(formToProfile(value, { isSelf: false, intent: null }));
    }
    router.back();
  }

  function remove() {
    if (!existing) return;
    deleteProfile(existing.id);
    setConfirmDelete(false);
    // Deleting the self profile re-opens onboarding through the gate.
    if (existing.isSelf) router.replace('/');
    else router.back();
  }

  if (!isNew && !existing) {
    return (
      <Screen title={t('family.editProfile')} chrome="stack">
        <Txt kind="body" color="ink2">
          {t('charts.noProfile')}
        </Txt>
      </Screen>
    );
  }

  const name = existing?.name ?? '';
  return (
    <Screen
      title={isNew ? t('family.newProfile') : t('family.editProfile')}
      chrome="stack"
      testID="profile-editor"
      headerRight={
        existing ? (
          <Pressable44
            accessibilityLabel={t('family.moreActions')}
            accessibilityState={{ expanded: menuOpen }}
            onPress={() => setMenuOpen(true)}
            style={[styles.menuButton, menuOpen && { borderColor: colors.accent, backgroundColor: colors.accentTint }]}
            testID="editor-more-button"
          >
            <MoreIcon color={colors.ink} />
          </Pressable44>
        ) : undefined
      }
      stickyCta={<PrimaryButton label={t('common.save')} onPress={save} testID="profile-save" />}
    >
      <BirthForm value={value} onChange={setValue} errors={errors} editor lockSelf={!!existing?.isSelf} />
      {existing && isNewborn(existing, mountedAt) ? (
        // F28 (B05): a profile younger than a year offers the naamkaran helper from its editor.
        <Card flush>
          <NavRow title={t('naamkaran.title')} caption={t('naamkaran.newborn')} onPress={() => router.push(`/family/naamkaran?profile=${existing.id}`)} divider={false} testID="profile-naamkaran" />
        </Card>
      ) : null}
      {existing ? (
        <View style={styles.danger}>
          <SecondaryButton label={t('family.deleteProfile')} onPress={() => setConfirmDelete(true)} testID="profile-delete" />
        </View>
      ) : null}
      <CapSheet visible={capOpen} onClose={() => setCapOpen(false)} reason="pro_profiles" />
      <Sheet
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('family.deleteProfile')}
        footer={
          <View style={styles.confirm}>
            <PrimaryButton label={t('common.delete')} onPress={remove} testID="profile-delete-confirm" />
            <SecondaryButton label={t('common.cancel')} onPress={() => setConfirmDelete(false)} />
          </View>
        }
      >
        <Txt kind="body">{t('family.deleteProfileConfirm', { name: name || t(`family.relation.${existing?.relationship ?? 'other'}`) })}</Txt>
      </Sheet>
      {existing ? (
        <Sheet visible={menuOpen} onClose={() => setMenuOpen(false)} title={t('family.moreActions')}>
          <Pressable44
            accessibilityRole="menuitem"
            accessibilityLabel={t('share.title')}
            onPress={() => {
              setMenuOpen(false);
              setShareOpen(true);
            }}
            style={styles.menuRow}
            testID="menu-share-matching"
          >
            <Txt kind="label" weight={400} style={styles.menuRowText}>
              {t('share.title')}
            </Txt>
            <ChevronIcon color={colors.ink3} />
          </Pressable44>
        </Sheet>
      ) : null}
      <ShareCodeSheet visible={shareOpen} onClose={() => setShareOpen(false)} profile={existing} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  danger: { marginTop: 8 },
  confirm: { gap: 8 },
  menuButton: { borderWidth: 1, borderColor: 'transparent', borderRadius: radius.button },
  menuRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, alignSelf: 'stretch', paddingVertical: 4 },
  menuRowText: { flex: 1 },
});
