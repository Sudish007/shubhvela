// Shared Pro-screen pieces (design.md 5, M2) used by app/app/pro.tsx and app/app/settings/pro.tsx: reactive Pro
// status, the Play catalog (localised prices with the spec INR fallback), the one-time report rows with the M2 wording
// ("₹99 · included in Pro"; Varshaphal "₹149 in Free and Pro"), the Restore / Manage rows and inline messages.
// Every price shown is Play's or the spec fallback labelled "store price may differ"; nothing is invented.
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { SecondaryButton } from '../components/Button';
import { InlineNotice } from '../components/Notices';
import { Txt } from '../components/Txt';
import { onEntitlementsChanged, priceLabel, proStatus, reportCredits, reportIncluded, type PriceLabel, type ProStatus, type ReportKind } from '../entitlements';
import { useLang, type TFn } from '../i18n';
import { useTokens } from '../theme/ThemeProvider';
import { EMPTY_CATALOG, buyReport, loadCatalog, onBillingError, type BillingFailure, type Catalog } from './iap';
import { openManageSubscription } from './manage';
import { REPORT_KINDS } from './products';
import { restoreNow } from './restore';

// useSyncExternalStore needs a referentially stable snapshot: re-use the last object while its three fields are equal.
let lastStatus: ProStatus | null = null;
function proSnapshot(): ProStatus {
  const next = proStatus();
  if (lastStatus && lastStatus.pro === next.pro && lastStatus.product === next.product && lastStatus.grace === next.grace) return lastStatus;
  lastStatus = next;
  return next;
}

export function useProStatus(): ProStatus {
  return useSyncExternalStore(onEntitlementsChanged, proSnapshot, proSnapshot);
}

export interface CatalogState {
  catalog: Catalog;
  loading: boolean;
  /** Play could not be reached: prices are the spec fallback. */
  unreachable: boolean;
}

export function useCatalog(load: () => Promise<Catalog> = loadCatalog): CatalogState {
  const [state, setState] = useState<CatalogState>({ catalog: EMPTY_CATALOG, loading: true, unreachable: false });
  useEffect(() => {
    let alive = true;
    load()
      .then((catalog) => alive && setState({ catalog, loading: false, unreachable: false }))
      .catch(() => alive && setState({ catalog: EMPTY_CATALOG, loading: false, unreachable: true }));
    return () => {
      alive = false;
    };
  }, [load]);
  return state;
}

export interface BillingMessage {
  tone: 'info' | 'error';
  text: string;
}

export function failureText(t: TFn, f: BillingFailure): string {
  switch (f.kind) {
    case 'cancelled':
      return t('pro.purchaseCancelled');
    case 'unavailable':
      return t('pro.itemUnavailable');
    case 'network':
    case 'unreachable':
      return t('pro.playUnreachable');
    case 'alreadyOwned':
      return t('pro.active');
    default:
      return f.storeMessage ? `${t('pro.purchaseFailed')} · ${f.storeMessage}` : t('pro.purchaseFailed');
  }
}

/** One message slot; Play's own error listener also lands here (errors never touch the entitlement cache). */
export function useBillingMessage(): [BillingMessage | null, (m: BillingMessage | null) => void] {
  const { t } = useLang();
  const [msg, setMsg] = useState<BillingMessage | null>(null);
  useEffect(() => onBillingError((f) => setMsg({ tone: 'error', text: failureText(t, f) })), [t]);
  return [msg, setMsg];
}

export function reportPrice(kind: ReportKind, catalog: Catalog): PriceLabel {
  return priceLabel(kind, catalog.reports[kind]?.displayPrice);
}

export interface ReportRowsProps {
  catalog: Catalog;
  onMessage: (m: BillingMessage | null) => void;
  buy?: (kind: ReportKind) => Promise<void>;
}

/** F40 one-time reports with contents (design.md 10.6/10.9) and the M2 captions. */
export function ReportRows({ catalog, onMessage, buy = buyReport }: ReportRowsProps) {
  const { t } = useLang();
  const { colors } = useTokens();
  const [busy, setBusy] = useState<ReportKind | null>(null);
  const status = useProStatus();
  const credits = useSyncExternalStore(
    onEntitlementsChanged,
    () => REPORT_KINDS.map((k) => reportCredits(k)).join(','),
    () => REPORT_KINDS.map((k) => reportCredits(k)).join(','),
  ).split(',');
  const onBuy = useCallback(
    async (kind: ReportKind) => {
      setBusy(kind);
      onMessage(null);
      try {
        await buy(kind);
        onMessage({ tone: 'info', text: t('pro.reportPurchased') });
      } catch (e) {
        onMessage({ tone: 'error', text: failureText(t, e as BillingFailure) });
      } finally {
        setBusy(null);
      }
    },
    [buy, onMessage, t],
  );
  const KEY: Record<ReportKind, string> = { janam_patri: 'janamPatri', matching: 'matching', varshaphal: 'varshaphal' };
  return (
    <View testID="report-rows">
      {REPORT_KINDS.map((kind, i) => {
        const price = reportPrice(kind, catalog);
        const included = reportIncluded(kind);
        const caption = kind === 'varshaphal' ? t('pro.bothTiers', { price: price.label }) : `${price.label} · ${t('pro.includedInPro')}`;
        const credit = Number(credits[i]) || 0;
        return (
          <View key={kind} testID={`report-row-${kind}`} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hair }]}>
            <View style={styles.text}>
              <Txt kind="label" weight={600}>
                {t(`pro.report.${KEY[kind]}`)}
              </Txt>
              <Txt kind="caption" color="ink2">
                {t(`pro.report.${KEY[kind]}Desc`)}
              </Txt>
              <Txt kind="caption" color="ink3" testID={`report-caption-${kind}`}>
                {caption}
                {price.fallback ? ` · ${t('pro.storePriceMayDiffer')}` : ''}
              </Txt>
              {credit > 0 ? (
                <Txt kind="caption" color="ink2" testID={`report-credit-${kind}`}>
                  {t('pro.reportCredit', { count: credit })}
                </Txt>
              ) : null}
            </View>
            {included && status.pro ? (
              <Txt kind="label" weight={600} color="ink2" testID={`report-included-${kind}`}>
                {t('pro.includedInPro')}
              </Txt>
            ) : (
              <SecondaryButton
                label={price.label}
                accessibilityLabel={`${t(`pro.report.${KEY[kind]}`)}, ${price.label}`}
                onPress={() => void onBuy(kind)}
                disabled={busy !== null}
                style={styles.priceButton}
                testID={`report-buy-${kind}`}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

export interface RestoreManageRowsProps {
  onMessage: (m: BillingMessage | null) => void;
  restore?: () => Promise<'restored' | 'nothing' | 'unreachable'>;
  manage?: () => Promise<boolean>;
}

export function RestoreManageRows({ onMessage, restore = restoreNow, manage = openManageSubscription }: RestoreManageRowsProps) {
  const { t } = useLang();
  const { colors } = useTokens();
  const [restoring, setRestoring] = useState(false);
  const onRestore = async () => {
    setRestoring(true);
    onMessage({ tone: 'info', text: t('pro.restoring') });
    const r = await restore();
    setRestoring(false);
    onMessage(r === 'restored' ? { tone: 'info', text: t('pro.restored') } : r === 'nothing' ? { tone: 'info', text: t('pro.nothingToRestore') } : { tone: 'error', text: t('pro.playUnreachable') });
  };
  return (
    <View testID="restore-manage-rows">
      <View style={styles.row}>
        <Txt kind="label" weight={400} style={styles.text}>
          {t('pro.restoreTitle')}
        </Txt>
        <SecondaryButton label={t('pro.restore')} onPress={() => void onRestore()} disabled={restoring} style={styles.priceButton} testID="pro-restore" />
      </View>
      <View style={[styles.row, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hair }]}>
        <Txt kind="label" weight={400} style={styles.text}>
          {t('pro.manageTitle')}
        </Txt>
        <SecondaryButton label={t('pro.manage')} onPress={() => void manage()} style={styles.priceButton} testID="pro-manage" />
      </View>
    </View>
  );
}

export function BillingNotice({ message }: { message: BillingMessage | null }) {
  if (!message) return null;
  return <InlineNotice tone={message.tone}>{message.text}</InlineNotice>;
}

/** Status line for Settings and the Pro screen: Pro (lifetime / subscription) and the grace notice. */
export function ProStatusLines({ status }: { status: ProStatus }) {
  const { t } = useLang();
  if (!status.pro) return null;
  return (
    <View style={styles.status} testID="pro-status">
      <Txt kind="label" weight={600}>
        {status.product === 'shubhvela_pro_lifetime' ? t('pro.activeLifetime') : t('pro.active')}
      </Txt>
      <Txt kind="caption" color="ink2">
        {t('pro.thanks')}
      </Txt>
      {status.grace ? <InlineNotice tone="error">{t('pro.graceNotice')}</InlineNotice> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  priceButton: { alignSelf: 'center', minWidth: 72 },
  status: { gap: 6 },
});
