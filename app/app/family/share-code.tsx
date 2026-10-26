// Share for matching route (F30 mode A): /family/share-code?profile=<id> (defaults to the self profile). The same
// content as the ShareCodeSheet - QR of the /m/ URL, 20-character code, Copy, privacy copy - as a pushed screen, so the
// Family tools row, the profile editor and (C04) deep links all land on one place.
import { useLocalSearchParams } from 'expo-router';
import { Card, EmptyState, Screen } from '../../src/components';
import { useLang } from '../../src/i18n';
import { useProfiles } from '../../src/profiles/useProfiles';
import { ShareCodeContent } from '../../src/share/ShareCodeSheet';

export interface ShareCodeScreenProps {
  profileId?: number;
}

export default function ShareCodeScreen({ profileId }: ShareCodeScreenProps) {
  const { t } = useLang();
  const params = useLocalSearchParams<{ profile?: string }>();
  const { profiles, self } = useProfiles();
  const id = profileId ?? (params.profile ? Number(params.profile) : NaN);
  const profile = (Number.isFinite(id) ? profiles.find((p) => p.id === id) : null) ?? self;
  return (
    <Screen title={t('share.title')} chrome="stack" testID="share-code-screen">
      {profile ? (
        <Card>
          <ShareCodeContent profile={profile} testID="share-content" />
        </Card>
      ) : (
        <EmptyState title={t('share.title')} body={t('charts.noProfile')} />
      )}
    </Screen>
  );
}
