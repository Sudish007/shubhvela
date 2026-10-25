// Learn shell: lessons, glossary and journal are Phase C (C02/C03). Honest empty state, no fake rows (FEAT-A09).
import { EmptyState, Screen } from '../../src/components';
import { useLang } from '../../src/i18n';

export default function LearnScreen() {
  const { t } = useLang();
  return (
    <Screen title={t('tabs.learn')} route="LearnRoot" testID="learn-screen">
      <EmptyState title={t('common.learnNotYetTitle')} body={t('common.learnNotYetBody')} />
    </Screen>
  );
}
