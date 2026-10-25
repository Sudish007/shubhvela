// F3 avatar row (design.md 10.1 F3, family.html): the ONE profile control on the Family screen. 56 dp circles with the
// initial, name and relationship label; the selected one carries a 2 px accent ring; the last item is the dashed "Add"
// (caption "Pro · unlimited" at 2/2 on free) and the quota line follows. Tapping a person opens the profile editor;
// "Add" goes through entitlements.canAddProfile() (the screen owns the refusal sheet).
import { ScrollView, StyleSheet, View } from 'react-native';
import { Pressable44 } from '../components/Pressable44';
import { Txt } from '../components/Txt';
import type { Profile } from '../db/profiles';
import { useLang } from '../i18n';
import { useTokens } from '../theme/ThemeProvider';

export interface ProfileRowProps {
  profiles: readonly Profile[];
  selectedId: number | null;
  onSelect: (p: Profile) => void;
  onAdd: () => void;
  /** Free tier at the cap: the Add item shows the "Pro · unlimited" caption. */
  atCap: boolean;
  testID?: string;
}

export const AVATAR = 56;

export function profileInitial(p: Profile, fallback: string): string {
  const src = (p.name ?? '').trim() || fallback;
  return src.slice(0, 1).toUpperCase();
}

export function ProfileRow({ profiles, selectedId, onSelect, onAdd, atCap, testID }: ProfileRowProps) {
  const { t } = useLang();
  const { colors } = useTokens();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityRole="list" accessibilityLabel={t('family.profilesLabel')} testID={testID}>
      {profiles.map((p) => {
        const relation = p.isSelf ? t('family.relation.self') : t(`family.relation.${p.relationship}`);
        const name = p.name ?? relation;
        const selected = p.id === selectedId;
        return (
          <Pressable44
            key={p.id}
            accessibilityLabel={`${name}, ${relation}`}
            accessibilityState={{ selected }}
            onPress={() => onSelect(p)}
            style={styles.person}
            pressedStyle={styles.pressed}
            testID={`avatar-${p.id}`}
          >
            <View
              style={[
                styles.avatar,
                { backgroundColor: selected ? colors.accentTint : colors.surface, borderColor: selected ? colors.accent : colors.hair2, borderWidth: selected ? 2 : 1 },
              ]}
            >
              <Txt kind="resultWhen" weight={600} color={selected ? 'accent' : 'ink'} latin>
                {profileInitial(p, relation)}
              </Txt>
            </View>
            <Txt kind="caption" weight={600} style={styles.name}>
              {name}
            </Txt>
            <Txt kind="micro" color="ink3" style={styles.name}>
              {relation}
            </Txt>
          </Pressable44>
        );
      })}
      <Pressable44 accessibilityLabel={t('family.addMember')} onPress={onAdd} style={styles.person} pressedStyle={styles.pressed} testID="avatar-add">
        <View style={[styles.avatar, styles.dashed, { borderColor: colors.hair2, backgroundColor: colors.surface }]}>
          <Txt kind="resultWhen" weight={400} color="ink2" latin>
            +
          </Txt>
        </View>
        <Txt kind="caption" weight={600} style={styles.name}>
          {t('common.add')}
        </Txt>
        {atCap ? (
          <Txt kind="micro" color="ink3" style={styles.name}>
            {t('family.addCaptionPro')}
          </Txt>
        ) : null}
      </Pressable44>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, paddingBottom: 4 },
  person: { minWidth: 72, alignItems: 'center', gap: 4, paddingVertical: 2 },
  pressed: { opacity: 0.85 },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, alignItems: 'center', justifyContent: 'center' },
  dashed: { borderWidth: 1, borderStyle: 'dashed' },
  name: { textAlign: 'center', maxWidth: 96 },
});
