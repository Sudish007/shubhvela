// "Timing and documents" card (design-review M3; plan B04): rows Muhurat finder (B05 route), Janam Patri PDF with the
// price / Download / "included in Pro" state from entitlements (B07 route), Share chart card (B07 share preview). A row
// is rendered ONLY when its route flag is true (src/charts/routeFlags.ts, flipped by B05/B07); while every flag is
// false the card itself is not rendered - nothing fake, no "coming soon".
import { Card } from '../components/Card';
import { NavRow } from '../components/ListRows';
import { Txt } from '../components/Txt';
import { priceLabel, reportCredits, reportIncluded } from '../entitlements';
import { useLang, type TFn } from '../i18n';
import { ROUTE_FLAGS, type TimingRouteFlags } from './routeFlags';

export interface TimingDocumentsCardProps {
  /** Override for tests; production reads ROUTE_FLAGS. */
  flags?: TimingRouteFlags;
  onMuhurat: () => void;
  onJanamPatri: () => void;
  onShareCard: () => void;
  testID?: string;
}

/** Caption of the Janam Patri row (M2): "included in Pro", "Download" when a credit is unused, else the price. */
export function janamPatriState(t: TFn): string {
  if (reportIncluded('janam_patri')) return t('pdf.includedInPro');
  if (reportCredits('janam_patri') > 0) return t('pdf.download');
  const price = priceLabel('janam_patri', null);
  return price.fallback ? `${price.label} · ${t('pro.storePriceMayDiffer')}` : price.label;
}

export function TimingDocumentsCard({ flags = ROUTE_FLAGS, onMuhurat, onJanamPatri, onShareCard, testID }: TimingDocumentsCardProps) {
  const { t } = useLang();
  const rows: { key: keyof TimingRouteFlags; title: string; caption: string; onPress: () => void }[] = [];
  if (flags.muhuratFinder) rows.push({ key: 'muhuratFinder', title: t('muhurat.title'), caption: t('charts.muhuratDesc'), onPress: onMuhurat });
  if (flags.janamPatriPdf) rows.push({ key: 'janamPatriPdf', title: t('pdf.janamPatri'), caption: janamPatriState(t), onPress: onJanamPatri });
  if (flags.shareChartCard) rows.push({ key: 'shareChartCard', title: t('share.cardTitle'), caption: t('charts.shareCardDesc'), onPress: onShareCard });
  if (rows.length === 0) return null;
  return (
    <Card flush testID={testID}>
      <Txt kind="heading" accessibilityRole="header" style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}>
        {t('charts.timingDocs')}
      </Txt>
      {rows.map((r, i) => (
        <NavRow key={r.key} title={r.title} caption={r.caption} onPress={r.onPress} divider={i < rows.length - 1} testID={`timing-row-${r.key}`} />
      ))}
    </Card>
  );
}
