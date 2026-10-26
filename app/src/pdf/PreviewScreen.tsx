// Report preview (design.md 10.6 F31 / M9; plan B07): the SAME HTML string the PDF is printed from, rendered by
// react-native-webview at device width inside the Screen's scroll (the WebView reports its content height), with the
// sticky CTA per the Screen padding rule: "Buy ₹99" (free, not purchased) / "Download" (Pro, delivered, or a credit
// about to be delivered) + "Share"; Download and Share = expo-print printToFileAsync + expo-sharing; failure -> "Couldn't
// create the PDF" with Retry; a Play failure shows Play's message inline and keeps the preview; after a successful
// Download/Share the "Done" control asks AdPolicy for the `reportDone` interstitial, then goes back. No banner here.
// Gating is read from entitlements (reportAccess: M2 table + P19 delivery); this screen never compares SKUs.
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { useInterstitial } from '../ads/useInterstitial';
import { buyReport, type BillingFailure } from '../billing/iap';
import { failureText, reportPrice, useCatalog } from '../billing/ui';
import { InlineNotice, PrimaryButton, Screen, SecondaryButton, TextButton, Txt } from '../components';
import { getSetting } from '../db/settings';
import { deliverReport, onEntitlementsChanged, reportAccess, type ReportKind } from '../entitlements';
import { useLang, type Lang } from '../i18n';
import { useProfiles } from '../profiles/useProfiles';
import { useTokens } from '../theme/ThemeProvider';
import { fontCssFor } from './fonts';
import { createPdf, sharePdf, type PdfDeps, type PdfFile } from './generate';
import { buildReport, type BuiltReport, type ReportParams } from './report';

export interface PreviewScreenProps {
  params: ReportParams | null;
  now?: () => number;
  /** Injection for tests. */
  pdf?: PdfDeps;
  buy?: (kind: ReportKind) => Promise<void>;
  fonts?: (lang: Lang) => Promise<string>;
  /** Called after Done (default router.back()). */
  onDone?: () => void;
}

type Flow = { kind: 'idle' } | { kind: 'busy' } | { kind: 'done'; file: PdfFile } | { kind: 'failed'; retry: 'download' | 'share' };

/** Height-reporting script: the Screen scrolls, the WebView does not. */
const MEASURE_JS = `(function(){function post(){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(String(document.documentElement.scrollHeight));}post();setTimeout(post,300);setTimeout(post,1500);window.addEventListener('load',post);})();true;`;

export default function PreviewScreen({ params, now, pdf, buy = buyReport, fonts = fontCssFor, onDone }: PreviewScreenProps) {
  const { t, lang: uiLang } = useLang();
  const { colors } = useTokens();
  const router = useRouter();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { profiles } = useProfiles();
  const interstitial = useInterstitial();
  const { catalog } = useCatalog();
  const [nowMs] = useState(() => (now ? now() : Date.now()));
  const [fontCss, setFontCss] = useState<string | null>(null);
  const [webHeight, setWebHeight] = useState<number>(Math.round(windowHeight));
  const [flow, setFlow] = useState<Flow>({ kind: 'idle' });
  const [purchaseMsg, setPurchaseMsg] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [buying, setBuying] = useState(false);

  const kind = params?.kind ?? null;

  // The report (model + HTML) in the PDF language; rebuilt only when the fonts arrive or the inputs change.
  const built: BuiltReport | null = useMemo(() => {
    if (!params) return null;
    try {
      return buildReport(params, { profiles, t, uiLang, style: getSetting('chartStyle'), fontCss: fontCss ?? '', nowMs });
    } catch (e) {
      if (__DEV__) console.warn('report failed', e);
      return null;
    }
  }, [params, profiles, t, uiLang, fontCss, nowMs]);

  // Fonts (base64 TTFs) are read once per session; a failure falls back to the WebView's system fonts for the preview.
  const pdfLang = built?.lang ?? uiLang;
  useEffect(() => {
    let alive = true;
    fonts(pdfLang)
      .then((css) => alive && setFontCss(css))
      .catch((e) => {
        if (__DEV__) console.warn('font embed failed', e);
        if (alive) setFontCss('');
      });
    return () => {
      alive = false;
    };
  }, [fonts, pdfLang]);

  const refId = built?.refId ?? '';
  const access = useSyncExternalStore(
    onEntitlementsChanged,
    () => (kind ? reportAccess(kind, refId) : 'buy'),
    () => (kind ? reportAccess(kind, refId) : 'buy'),
  );
  const price = kind ? reportPrice(kind, catalog) : null;

  const produce = useCallback(
    async (action: 'download' | 'share') => {
      if (!built || !kind) return;
      setFlow({ kind: 'busy' });
      try {
        if (access === 'credit') deliverReport(kind, refId, new Date(nowMs));
        const file = await createPdf(built.html, built.fileName, pdf);
        await sharePdf(file, action === 'download' ? built.fileName : built.title, pdf);
        setFlow({ kind: 'done', file });
      } catch (e) {
        if (__DEV__) console.warn('pdf failed', e);
        setFlow({ kind: 'failed', retry: action });
      }
    },
    [built, kind, access, refId, nowMs, pdf],
  );

  const onBuy = useCallback(async () => {
    if (!kind) return;
    setBuying(true);
    setPurchaseMsg(null);
    try {
      await buy(kind);
      // The consumable is bought for THIS profile / pair: deliver it now so the CTA flips to Download.
      deliverReport(kind, refId, new Date(nowMs));
      setPurchaseMsg({ tone: 'info', text: built ? (built.names.length === 2 ? t('report.deliveredPair', { a: built.names[0], b: built.names[1] }) : t('report.deliveredFor', { name: built.names[0] })) : t('pro.reportPurchased') });
    } catch (e) {
      const f = e as BillingFailure;
      setPurchaseMsg({ tone: 'error', text: `${failureText(t, f)} · ${t('report.purchaseFailed')}` });
    } finally {
      setBuying(false);
    }
  }, [kind, buy, refId, nowMs, built, t]);

  const done = () => {
    // Explicit forward action (design.md 5): the only place this screen asks for an interstitial; never on back.
    interstitial.show('reportDone');
    if (onDone) onDone();
    else if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const entitled = access !== 'buy';
  const busy = flow.kind === 'busy' || buying;
  const title = built?.title ?? (kind ? t(`report.${kind === 'janam_patri' ? 'janamPatri' : kind}`) : t('pdf.preview'));

  const cta = kind ? (
    <View style={styles.cta} testID="pdf-cta">
      {purchaseMsg ? <InlineNotice tone={purchaseMsg.tone}>{purchaseMsg.text}</InlineNotice> : null}
      {flow.kind === 'failed' ? <InlineNotice tone="error">{t('pdf.failed')}</InlineNotice> : null}
      {flow.kind === 'busy' ? (
        <Txt kind="caption" color="ink2" accessibilityLiveRegion="polite" testID="pdf-busy">
          {t('pdf.generating')}
        </Txt>
      ) : null}
      {flow.kind === 'done' ? (
        <Txt kind="caption" color="ink2" accessibilityLiveRegion="polite" testID="pdf-created">
          {t('pdf.created', { pages: t('pdf.pages', { count: flow.file.pages }) })}
        </Txt>
      ) : null}
      <View style={styles.ctaRow}>
        {flow.kind === 'failed' ? (
          <PrimaryButton label={t('common.retry')} onPress={() => void produce(flow.retry)} disabled={busy || !built} style={styles.grow} testID="pdf-retry" />
        ) : entitled ? (
          <PrimaryButton label={t('report.download')} onPress={() => void produce('download')} disabled={busy || !built} style={styles.grow} testID="pdf-download" />
        ) : (
          <PrimaryButton label={t('report.buy', { price: price?.label ?? '' })} onPress={() => void onBuy()} disabled={busy} style={styles.grow} testID="pdf-buy" />
        )}
        <SecondaryButton label={t('report.share')} onPress={() => void produce('share')} disabled={busy || !built || !entitled} style={styles.grow} testID="pdf-share" />
        {flow.kind === 'done' ? <TextButton label={t('report.done')} onPress={done} testID="pdf-done" /> : null}
      </View>
      {!entitled ? (
        <Txt kind="caption" color="ink3" testID="pdf-buy-note">
          {kind === 'varshaphal' ? t('report.varshaphalPriceNote', { price: price?.label ?? '' }) : t('pdf.buyToShare')}
          {price?.fallback ? ` · ${t('pro.storePriceMayDiffer')}` : ''}
        </Txt>
      ) : access === 'included' ? (
        <Txt kind="caption" color="ink3" testID="pdf-included">
          {t('report.includedInPro')}
        </Txt>
      ) : null}
    </View>
  ) : null;

  const langName = t(`settings.lang.${pdfLang}`);
  return (
    <Screen
      title={title}
      chrome="stack"
      route="PdfPreview"
      subtitle={
        built ? (
          <Txt kind="label" weight={400} color="ink2" testID="pdf-subject">
            {`${built.subject} · ${t('pdf.language', { language: langName })}`}
          </Txt>
        ) : undefined
      }
      stickyCta={cta}
      testID="pdf-preview"
    >
      {!params || !built ? (
        <Txt kind="body" color="accent">
          {t('errors.chart')}
        </Txt>
      ) : fontCss === null ? (
        <View accessibilityRole="progressbar" accessibilityLabel={t('common.computing')} style={[styles.skeleton, { borderColor: colors.hair, backgroundColor: colors.surface }]} testID="pdf-loading" />
      ) : (
        <View style={[styles.web, { width: windowWidth, height: webHeight }]} testID="pdf-webview-box">
          <WebView
            testID="pdf-webview"
            originWhitelist={['*']}
            source={{ html: built.html }}
            style={{ width: windowWidth, height: webHeight, backgroundColor: colors.paper }}
            scrollEnabled={false}
            injectedJavaScript={MEASURE_JS}
            onMessage={(e) => {
              const h = Number(e.nativeEvent.data);
              if (Number.isFinite(h) && h > 0) setWebHeight(Math.ceil(h));
            }}
            javaScriptEnabled
            setSupportMultipleWindows={false}
            allowFileAccess={false}
            accessibilityLabel={title}
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cta: { gap: 8 },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grow: { flex: 1 },
  web: { marginHorizontal: -16 },
  skeleton: { height: 320, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12 },
});
