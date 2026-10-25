// Family shell (A09): the profile list with the free-tier quota line and "Add family member" under
// entitlements.canAddProfile() (the 3rd profile on free opens the honest cap sheet). Tithi birthdays, ancestors, vrats,
// the festival calendar and the avatar row are A12's and are stated as not built yet (no fake rows).
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, CapSheet, EmptyState, NavRow, PrimaryButton, Screen, Txt } from '../../src/components';
import { FREE_PROFILE_CAP, canAddProfile, isPro } from '../../src/entitlements';
import { formatIsoDate } from '../../src/format';
import { useLang } from '../../src/i18n';
import { useProfiles } from '../../src/profiles/useProfiles';

export default function FamilyScreen() {
  const { t, lang } = useLang();
  const router = useRouter();
  const { profiles } = useProfiles();
  const [capOpen, setCapOpen] = useState(false);
  const decision = canAddProfile(profiles.length);

  function add() {
    if (!decision.allowed) return setCapOpen(true);
    router.push('/profile/new');
  }

  return (
    <Screen title={t('family.title')} route="Family" testID="family-screen">
      <Card flush>
        <View style={styles.cardHead}>
          <Txt kind="heading">{t('family.members')}</Txt>
          <Txt kind="caption" color="ink3" latin tabular>
            {isPro() ? String(profiles.length) : t('family.profileCount', { count: profiles.length, max: FREE_PROFILE_CAP })}
          </Txt>
        </View>
        {profiles.length === 0 ? (
          <View style={styles.pad}>
            <Txt kind="body" color="ink2">
              {t('family.noMembers')}
            </Txt>
          </View>
        ) : (
          <View style={styles.list}>
            {profiles.map((p, i) => (
              <NavRow
                key={p.id}
                title={p.name ?? (p.isSelf ? t('family.self') : t(`family.relation.${p.relationship}`))}
                caption={`${t(`family.relation.${p.relationship}`)} · ${p.timeUnknown ? t('family.bornUnknownTime', { date: formatIsoDate(p.birthDate, lang) }) : t('family.born', { date: formatIsoDate(p.birthDate, lang) })}`}
                onPress={() => router.push(`/profile/${p.id}`)}
                divider={i < profiles.length - 1}
                testID={`profile-row-${p.id}`}
              />
            ))}
          </View>
        )}
        <View style={styles.pad}>
          <PrimaryButton label={t('family.addMember')} onPress={add} testID="add-member" />
        </View>
      </Card>
      <EmptyState title={t('family.notYetTitle')} body={t('family.notYetBody')} />
      <CapSheet visible={capOpen} onClose={() => setCapOpen(false)} reason="pro_profiles" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  list: {},
  pad: { paddingHorizontal: 16, paddingVertical: 12 },
});
