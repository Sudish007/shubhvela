// Charts shell (A09): the kundli, planet table, houses, dasha and sheets are A11's. Nothing is drawn until then; the
// screen states it. (Design.md 3: the profile picker pill is the ONE profile control here and arrives with A11.)
import { EmptyState, Screen } from '../../src/components';
import { useLang } from '../../src/i18n';

export default function ChartsScreen() {
  const { t } = useLang();
  return (
    <Screen title={t('charts.title')} route="Charts" testID="charts-screen">
      <EmptyState title={t('charts.notYetTitle')} body={t('charts.notYetBody')} />
    </Screen>
  );
}
