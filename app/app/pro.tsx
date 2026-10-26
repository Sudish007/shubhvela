// Pro screen (spec F39/F40, section 9; design.md 5 / mocks/pro.html): title, one honest lede, three radio plan cards
// (monthly, yearly preselected with "Save N%" = 1 - yearly / (monthly x 12) over the SHOWN prices, lifetime), the
// restore caption, the spec section 9 matrix as a three-column table, the one-time report rows with the M2 wording,
// Restore and Manage rows, the disclaimer, and a sticky CTA "Continue · <price> per year" with "Recurring. Cancel in
// Play -> Subscriptions." and a 44 dp Terms link. Scroll padding = CTA height + 16 + inset (Screen). No banner, no
// testimonials, counts, timers or "most popular" badges. Prices are Play's localised prices; offline they are the spec
// INR strings captioned "store price may differ". Already Pro: the status replaces the CTA; rows stay usable.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { buyPlan, type BillingFailure, type Catalog } from '../src/billing/iap';
import { INR_FALLBACK, priceLabel, type PriceLabel } from '../src/entitlements';
import { monthlyEquivalent, savingPercent, type Plan } from '../src/billing/products';
import { BillingNotice, ProStatusLines, ReportRows, RestoreManageRows, failureText, useBillingMessage, useCatalog, useProStatus } from '../src/billing/ui';
import { Card, Pressable44, PrimaryButton, Screen, Tag, TextButton, Txt } from '../src/components';
import { useLang } from '../src/i18n';
import { webBase } from '../src/legal';
import { useTokens } from '../src/theme/ThemeProvider';
import { radius } from '../src/theme/tokens';

const MATRIX_ROWS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export interface PlanPrices {
  monthly: PriceLabel;
  yearly: PriceLabel;
  lifetime: PriceLabel;
  /** Numeric inputs behind the two labels the saving is computed from (null when the sources differ). */
  monthlyAmount: number | null;
  yearlyAmount: number | null;
}

/** Labels and the arithmetic inputs; the saving uses two prices from the SAME source (both Play or both fallback). */
export function planPrices(catalog: Catalog): PlanPrices {
  const monthly = priceLabel('monthly', catalog.plans.monthly?.displayPrice);
  const yearly = priceLabel('yearly', catalog.plans.yearly?.displayPrice);
  const lifetime = priceLabel('lifetime', catalog.plans.lifetime?.displayPrice);
  let monthlyAmount: number | null = null;
  let yearlyAmount: number | null = null;
  if (!monthly.fallback && !yearly.fallback) {
    monthlyAmount = catalog.plans.monthly?.amount ?? null;
    yearlyAmount = catalog.plans.yearly?.amount ?? null;
  } else if (monthly.fallback && yearly.fallback) {
    monthlyAmount = INR_FALLBACK.monthly.amount;
    yearlyAmount = INR_FALLBACK.yearly.amount;
  }
  return { monthly, yearly, lifetime, monthlyAmount, yearlyAmount };
}

export function savingFor(p: PlanPrices): number | null {
  if (p.monthlyAmount == null || p.yearlyAmount == null) return null;
  return savingPercent(p.monthlyAmount, p.yearlyAmount);
}

/** Currency symbol / prefix of a shown price, so the monthly equivalent is printed in the same unit as the label. */
function unitOf(label: string): { prefix: string; suffix: string } {
  const m = label.match(/^([^\d]*)[\d.,\s]+([^\d]*)$/);
  return { prefix: m?.[1]?.trim() ?? '', suffix: m?.[2]?.trim() ?? '' };
}

export default function ProScreen() {
  const { t } = useLang();
  const { colors } = useTokens();
  const router = useRouter();
  const status = useProStatus();
  const { catalog, unreachable } = useCatalog();
  const [plan, setPlan] = useState<Plan>('yearly');
  const [message, setMessage] = useBillingMessage();
  const [buying, setBuying] = useState(false);
  const prices = planPrices(catalog);
  const saving = savingFor(prices);
  const anyFallback = prices.monthly.fallback || prices.yearly.fallback || prices.lifetime.fallback;

  const onContinue = async () => {
    setBuying(true);
    setMessage(null);
    try {
      await buyPlan(plan, catalog);
      setMessage({ tone: 'info', text: t('pro.thanks') });
    } catch (e) {
      setMessage({ tone: 'error', text: failureText(t, e as BillingFailure) });
    } finally {
      setBuying(false);
    }
  };

  const ctaLabel = plan === 'yearly' ? t('pro.cta', { price: prices.yearly.label }) : plan === 'monthly' ? t('pro.ctaMonthly', { price: prices.monthly.label }) : t('pro.ctaLifetime', { price: prices.lifetime.label });
  const stickyCta = status.pro ? undefined : (
    <View style={styles.ctaBox}>
      <PrimaryButton label={ctaLabel} onPress={() => void onContinue()} disabled={buying} testID="pro-cta" />
      <View style={styles.ctaRow}>
        <Txt kind="caption" color="ink3" style={styles.ctaCaption} testID="pro-cta-caption">
          {plan === 'lifetime' ? t('pro.oneTime') : t('pro.recurring')}
        </Txt>
        <TextButton label={t('pro.terms')} onPress={() => void Linking.openURL(`${webBase()}terms/`)} testID="pro-terms" />
      </View>
    </View>
  );

  const unit = unitOf(prices.yearly.label);
  const equiv = prices.yearlyAmount != null ? `${unit.prefix}${monthlyEquivalent(prices.yearlyAmount)}${unit.suffix ? ` ${unit.suffix}` : ''}` : null;

  const planCard = (p: Plan, name: string, desc: string | null, price: PriceLabel, period: string, tag?: string | null) => {
    const selected = plan === p;
    return (
      <Pressable44
        key={p}
        accessibilityRole="radio"
        accessibilityLabel={t('pro.planA11y', { plan: name, price: price.label, period })}
        accessibilityState={{ selected, checked: selected }}
        onPress={() => setPlan(p)}
        style={[styles.plan, { borderColor: selected ? colors.accent : colors.hair2, borderWidth: selected ? 2 : 1, backgroundColor: colors.surface }]}
        testID={`plan-${p}`}
      >
        <View style={[styles.dot, { borderColor: selected ? colors.accent : colors.hair2 }]}>{selected ? <View style={[styles.dotFill, { backgroundColor: colors.accent }]} /> : null}</View>
        <View style={styles.planText}>
          <View style={styles.planName}>
            <Txt kind="label" weight={600}>
              {name}
            </Txt>
            {tag ? (
              <Tag variant="kind" style={{ borderColor: colors.accent }}>
                {tag}
              </Tag>
            ) : null}
          </View>
          {desc ? (
            <Txt kind="caption" color="ink2">
              {desc}
            </Txt>
          ) : null}
        </View>
        <View style={styles.price}>
          <Txt kind="heading" weight={600} latin tabular style={styles.priceText}>
            {price.label}
          </Txt>
          <Txt kind="micro" color="ink3" style={styles.priceText}>
            {period}
          </Txt>
        </View>
      </Pressable44>
    );
  };

  return (
    <Screen title={t('pro.title')} chrome="stack" route="Pro" stickyCta={stickyCta} testID="pro-screen">
      <Txt kind="heading" weight={400} testID="pro-lede">
        {t('pro.lede')}
      </Txt>
      <ProStatusLines status={status} />
      <BillingNotice message={message} />
      {unreachable ? (
        <Txt kind="caption" color="ink2" testID="pro-unreachable">
          {t('pro.playUnreachable')}
        </Txt>
      ) : null}

      <View accessibilityRole="radiogroup" accessibilityLabel={t('pro.plansTitle')} style={styles.plans} testID="plan-group">
        {planCard('monthly', t('pro.monthly'), t('pro.cancelAnyTime'), prices.monthly, t('pro.perMonth'))}
        {planCard('yearly', t('pro.yearly'), equiv ? t('pro.yearlyMonthlyEquiv', { price: equiv }) : null, prices.yearly, t('pro.perYear'), saving != null && saving > 0 ? t('pro.save_tag', { saving }) : null)}
        {planCard('lifetime', t('pro.lifetime'), t('pro.lifetimeNote'), prices.lifetime, t('pro.once'))}
      </View>
      <Txt kind="caption" color="ink3" testID="pro-prices-note">
        {t('pro.pricesNote')}
        {anyFallback ? ` · ${t('pro.storePriceMayDiffer')}` : ''}
      </Txt>

      <Card testID="pro-matrix">
        <Txt kind="heading" weight={600}>
          {t('pro.matrixTitle')}
        </Txt>
        <View style={[styles.tr, styles.th]}>
          <Txt kind="micro" weight={600} color="ink3" style={styles.tdLabel}>
            {t('pro.capability_col').toUpperCase()}
          </Txt>
          <Txt kind="micro" weight={600} color="ink3" style={styles.tdCell}>
            {t('pro.free_col').toUpperCase()}
          </Txt>
          <Txt kind="micro" weight={600} color="ink3" style={styles.tdCell}>
            {t('pro.pro_col').toUpperCase()}
          </Txt>
        </View>
        {MATRIX_ROWS.map((i) => (
          <View key={i} style={[styles.tr, { borderTopColor: colors.hair }]} testID={`matrix-row-${i}`}>
            <Txt kind="caption" color="ink" style={styles.tdLabel}>
              {t(`pro.row.${i}.label`)}
            </Txt>
            <MatrixCell value={t(`pro.row.${i}.free`)} />
            <MatrixCell value={t(`pro.row.${i}.pro`)} strong />
          </View>
        ))}
        <Txt kind="caption" color="ink3" style={styles.note}>
          {t('pro.adsNote')}
        </Txt>
      </Card>

      <Card testID="pro-reports">
        <Txt kind="heading" weight={600}>
          {t('pro.reportsTitle')}
        </Txt>
        <ReportRows catalog={catalog} onMessage={setMessage} />
      </Card>

      <Card>
        <RestoreManageRows onMessage={setMessage} />
        <Txt kind="caption" color="ink3" style={styles.note} testID="pro-disclaimer">
          {t('pro.disclaimer')}
        </Txt>
      </Card>
      {status.pro ? <TextButton label={t('common.back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} /> : null}
    </Screen>
  );
}

function MatrixCell({ value, strong }: { value: string; strong?: boolean }) {
  const { t } = useLang();
  const yes = value === '✓';
  const no = value === '—';
  return (
    <View style={styles.tdCell} accessibilityLabel={yes ? t('pro.cellA11y.yes') : no ? t('pro.cellA11y.no') : undefined}>
      <Txt kind="caption" weight={strong && !no ? 600 : 400} color={yes ? 'accent' : no ? 'ink3' : 'ink'} style={styles.center}>
        {value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  plans: { gap: 10 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 12, paddingHorizontal: 16, borderRadius: radius.card, justifyContent: 'flex-start', alignSelf: 'stretch' },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dotFill: { width: 10, height: 10, borderRadius: 5 },
  planText: { flex: 1, minWidth: 0, gap: 2 },
  planName: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  price: { alignItems: 'flex-end' },
  priceText: { textAlign: 'right' },
  tr: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth },
  th: { borderTopWidth: 0, paddingTop: 12, paddingBottom: 4 },
  tdLabel: { flex: 1, minWidth: 0 },
  tdCell: { width: 88, alignItems: 'center' },
  center: { textAlign: 'center' },
  note: { marginTop: 12 },
  ctaBox: { gap: 4 },
  ctaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44 },
  ctaCaption: { flex: 1, minWidth: 0 },
});
