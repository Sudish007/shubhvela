// "Family tools" card (design-review M3; plan B06): rows Match two profiles (F29) · Share for matching (F30, the
// selected profile) · Name syllables (F28, B05 route). Placed on Family after the event cards and before the Add
// buttons. Every row opens a screen that exists in this build.
import { Card } from '../components/Card';
import { NavRow } from '../components/ListRows';
import { Txt } from '../components/Txt';
import { useLang } from '../i18n';

export interface FamilyToolsCardProps {
  onMatch: () => void;
  onShare: () => void;
  onNaamkaran: () => void;
  testID?: string;
}

export function FamilyToolsCard({ onMatch, onShare, onNaamkaran, testID }: FamilyToolsCardProps) {
  const { t } = useLang();
  return (
    <Card flush testID={testID}>
      <Txt kind="heading" accessibilityRole="header" style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}>
        {t('family.tools')}
      </Txt>
      <NavRow title={t('match.title')} caption={t('family.toolsMatchDesc')} onPress={onMatch} testID="tools-match" />
      <NavRow title={t('share.title')} caption={t('family.toolsShareDesc')} onPress={onShare} testID="tools-share" />
      <NavRow title={t('naamkaran.title')} caption={t('family.toolsNaamkaranDesc')} onPress={onNaamkaran} divider={false} testID="tools-naamkaran" />
    </Card>
  );
}
