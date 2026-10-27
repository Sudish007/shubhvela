// FEAT-B07 documents and share cards: the three report HTML documents carry every spec F31 / design 10.6 section in
// en, hi and bho (heading snapshot) with the engine chart SVG, the disclaimer and "How this was computed"; the fonts
// are embedded as @font-face from the runtime loader; the M2 x P19 gating matrix (free/Pro x janam/matching/varshaphal
// x purchased); the preview screen's Buy -> purchases row -> CTA flips, a Play failure keeps the preview, Download ->
// expo-print + expo-sharing (mocked) -> Done asks the interstitial exactly once, a print failure shows Retry; the share
// sheet captures a 1080x1350 PNG through the mocked view-shot, the switch hides the birth time by default, and Close
// after a share asks the interstitial exactly once (never without a share).
import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { PixelRatio } from 'react-native';
import { getDb } from '../src/db/connection';
import { getProfile, insertProfile } from '../src/db/profiles';
import { SAMPLE_AMMA, SAMPLE_PRIYA } from '../src/dev/seed';
import { chartFor, clearChartCache } from '../src/engine-bridge/charts';
import { deliverReport, reportAccess, reportCredits, setEntitlement } from '../src/entitlements';
import { makeT } from '../src/i18n';
import { clearCodeChartCache } from '../src/match/model';
import { BillingFailure } from '../src/billing/iap';
import { chartSvg } from '../src/pdf/chartSvg';
import { facesFor, fontCssFor, fontFaceCss, resetFontCacheForTests } from '../src/pdf/fonts';
import { sectionHeadings, sectionIds } from '../src/pdf/html/common';
import { JANAM_PATRI_SECTIONS } from '../src/pdf/html/janamPatri';
import { MATCHING_SECTIONS } from '../src/pdf/html/matchingReport';
import { VARSHAPHAL_SECTIONS } from '../src/pdf/html/varshaphalReport';
import PreviewScreen from '../src/pdf/PreviewScreen';
import { buildReport, reportParamsFrom, reportParamsToQuery, reportRefId, type ReportParams } from '../src/pdf/report';
import { CARD_H, CARD_W, PNG_H, PNG_W } from '../src/share/ShareCard';
import { KundliCard, kundliBornLine } from '../src/share/cards/KundliCard';
import { SharePreviewSheet } from '../src/share/SharePreviewSheet';
import { installTestDb } from './helpers/nodeDb';
import { renderWithProviders, textOf } from './helpers/render';

// The interstitial hook is the only path to AdPolicy for screens; here it is a spy so the trigger calls are counted.
const mockShow = jest.fn(() => false);
jest.mock('../src/ads/useInterstitial', () => ({ useInterstitial: () => ({ ready: false, show: mockShow }) }));

const NOW = Date.UTC(2026, 9, 22, 5, 28); // Thu 22 Oct 2026 10:58 IST
const now = () => NOW;
const t = makeT('en');
const fonts = jest.fn(async () => "@font-face{font-family:'Noto Sans';font-weight:400;font-style:normal;src:url(data:font/ttf;base64,AAAA) format('truetype');}");

/** Simulates expo-iap -> handlePurchase for a consumable: a credit row with delivered_at NULL. */
function creditRow(product: string, token: string) {
  getDb().runSync('INSERT INTO purchases (product, ref_id, token, delivered_at) VALUES (?, NULL, ?, NULL)', [product, token]);
}

describe('B07 documents', () => {
  let close: () => void;
  let priyaId: number;
  let ammaId: number;
  beforeEach(() => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1);
    ({ close } = installTestDb());
    clearChartCache();
    clearCodeChartCache();
    resetFontCacheForTests();
    mockShow.mockClear();
    (router.back as jest.Mock).mockClear();
    priyaId = insertProfile(SAMPLE_PRIYA, new Date(NOW));
    ammaId = insertProfile(SAMPLE_AMMA, new Date(NOW));
  });
  afterEach(() => close());

  const deps = (fontCss = '') => ({ profiles: [getProfile(priyaId)!, getProfile(ammaId)!], t, uiLang: 'en' as const, style: 'north' as const, fontCss, nowMs: NOW });
  const janam = (): ReportParams => ({ kind: 'janam_patri', profileId: priyaId });
  const matching = (): ReportParams => ({ kind: 'matching', a: { kind: 'profile', id: priyaId }, b: { kind: 'profile', id: ammaId } });
  const varshaphal = (): ReportParams => ({ kind: 'varshaphal', profileId: priyaId, year: 2027 });

  it('route params round-trip; the purchase reference is the profile, the unordered pair, or profile + year', () => {
    expect(reportParamsFrom('janam_patri', { profile: String(priyaId) })).toEqual(janam());
    expect(reportParamsFrom('varshaphal', { profile: String(priyaId), year: '2027' })).toEqual(varshaphal());
    expect(reportParamsFrom('matching', reportParamsToQuery(matching()))).toEqual(matching());
    expect(reportParamsFrom('matching', { a: `p${priyaId}` })).toBeNull();
    expect(reportParamsFrom('nope', { profile: '1' })).toBeNull();
    expect(reportRefId(janam())).toBe(`p${priyaId}`);
    expect(reportRefId(varshaphal())).toBe(`p${priyaId}:2027`);
    expect(reportRefId(matching())).toBe(reportRefId({ kind: 'matching', a: { kind: 'profile', id: ammaId }, b: { kind: 'profile', id: priyaId } }));
  });

  it('every report carries every section, the engine chart SVG, "How this was computed" and the disclaimer in en, hi and bho (heading snapshot)', () => {
    const headings: Record<string, string[]> = {};
    for (const lang of ['en', 'hi', 'bho'] as const) {
      const tl = makeT(lang);
      getDb().runSync('UPDATE profiles SET pdf_language = ?', [lang]);
      const d = { ...deps(), profiles: [getProfile(priyaId)!, getProfile(ammaId)!] };
      const jp = buildReport(janam(), d);
      const mt = buildReport(matching(), d);
      const vp = buildReport(varshaphal(), d);
      expect(jp.lang).toBe(lang);
      expect(mt.lang).toBe(lang);
      expect(vp.lang).toBe(lang);
      expect(sectionIds(jp.html)).toEqual([...JANAM_PATRI_SECTIONS]);
      expect(sectionIds(mt.html)).toEqual([...MATCHING_SECTIONS]);
      expect(sectionIds(vp.html)).toEqual([...VARSHAPHAL_SECTIONS]);
      // Three charts (D1, D9, Moon) in the Janam Patri, two in the matching report, one solar-return chart.
      expect((jp.html.match(/<svg /g) ?? []).length).toBe(3);
      expect((mt.html.match(/<svg /g) ?? []).length).toBe(2);
      expect((vp.html.match(/<svg /g) ?? []).length).toBe(1);
      for (const r of [jp, mt, vp]) {
        expect(r.html).toContain(`<html lang="${lang}">`);
        expect(r.html).toContain(tl('disclaimer.report'));
        expect(r.html).toContain(tl('disclaimer.notAdvice'));
        expect(r.html).toContain(tl('pdf.section.howComputed'));
        expect(r.html).toContain(tl('report.computed.ayanamsa'));
        expect(r.html).toContain('sudish007.github.io/shubhvela');
        expect(r.html).toContain('Shubhvela · शुभवेला');
        // Paper/ink/accent tokens only: no gradients or shadows anywhere in the stylesheet.
        expect(r.html).not.toMatch(/gradient|box-shadow|text-shadow/);
      }
      // F31 values are engine output: the planet table lists all nine planets with degrees; the avakahada rows name the kootas.
      const chart = chartFor(getProfile(priyaId)!);
      for (const p of chart.planets) expect(jp.html).toContain(`${p.degree}°`);
      expect(jp.html).toContain(tl('pdf.avakahada.varna'));
      expect(jp.html).toContain(tl('pdf.ghatak.month'));
      expect(jp.html).toContain(tl('match.mangal'));
      headings[lang] = [...sectionHeadings(jp.html), '|', ...sectionHeadings(mt.html), '|', ...sectionHeadings(vp.html)];
    }
    expect(headings).toMatchSnapshot();
  });

  it('a Devanagari report embeds Tiro + Noto Sans 400/600 + Noto Sans Devanagari 400/600 as @font-face from the runtime loader; English skips the Devanagari faces', async () => {
    const load = jest.fn(async (file: string) => `B64-${file}`);
    const hi = await fontCssFor('hi', load);
    expect(facesFor('hi').map((f) => f.file)).toEqual(['TiroDevanagariHindi', 'NotoSans', 'NotoSans-SemiBold', 'NotoSansDevanagari', 'NotoSansDevanagari-SemiBold']);
    expect(facesFor('en').map((f) => f.file)).toEqual(['TiroDevanagariHindi', 'NotoSans', 'NotoSans-SemiBold']);
    expect((hi.match(/@font-face/g) ?? []).length).toBe(5);
    expect(hi).toContain("font-family:'Noto Sans Devanagari';font-weight:600");
    expect(hi).toContain('src=url(data:font/ttf;base64,B64-NotoSansDevanagari-SemiBold)'.replace('src=', 'src:'));
    expect(load).toHaveBeenCalledTimes(5);
    // Cached per session: the English block re-uses the three loaded faces.
    const en = await fontCssFor('en', load);
    expect((en.match(/@font-face/g) ?? []).length).toBe(3);
    expect(load).toHaveBeenCalledTimes(5);
    expect(fontFaceCss([{ family: 'X', weight: 400, base64: 'QUJD' }])).toBe("@font-face{font-family:'X';font-weight:400;font-style:normal;src:url(data:font/ttf;base64,QUJD) format('truetype');}");
    // The report HTML carries the block verbatim inside <style>.
    getDb().runSync('UPDATE profiles SET pdf_language = ?', ['hi']);
    const html = buildReport(janam(), { ...deps(hi), profiles: [getProfile(priyaId)!, getProfile(ammaId)!] }).html;
    expect(html).toContain(hi);
    // The chart SVG uses the embedded families and the same layout as the app (12 user-unit numerals at 320 px).
    const svg = chartSvg('north', chartFor(getProfile(priyaId)!), { lang: 'hi', width: 320 });
    expect(svg).toContain("font-family:'Tiro Devanagari Hindi'".replace(':', '="').replace("'", "'") || "'Tiro Devanagari Hindi'");
    expect(svg).toContain('font-size="12"');
  });

  it('gating matrix (M2 x P19): Janam Patri and Matching included in Pro, Varshaphal ₹149 on both tiers; credits deliver per reference', () => {
    const ref = `p${priyaId}`;
    // Free, nothing bought.
    expect(reportAccess('janam_patri', ref)).toBe('buy');
    expect(reportAccess('matching', 'pair:x')).toBe('buy');
    expect(reportAccess('varshaphal', `${ref}:2027`)).toBe('buy');
    // Free with a credit: the credit applies to whatever reference uses it first, then stays delivered for that one.
    creditRow('report_janam_patri', 'tok1');
    expect(reportCredits('janam_patri')).toBe(1);
    expect(reportAccess('janam_patri', ref)).toBe('credit');
    expect(reportAccess('janam_patri', `p${ammaId}`)).toBe('credit');
    expect(deliverReport('janam_patri', ref, new Date(NOW))).toBe(true);
    expect(reportCredits('janam_patri')).toBe(0);
    expect(reportAccess('janam_patri', ref)).toBe('delivered');
    expect(reportAccess('janam_patri', `p${ammaId}`)).toBe('buy');
    expect(deliverReport('janam_patri', ref)).toBe(true); // idempotent
    expect(deliverReport('janam_patri', `p${ammaId}`)).toBe(false); // no credit left
    const row = getDb().getFirstSync<{ ref_id: string; delivered_at: string }>('SELECT ref_id, delivered_at FROM purchases WHERE token = ?', ['tok1'])!;
    expect(row.ref_id).toBe(ref);
    expect(row.delivered_at).toBe(new Date(NOW).toISOString());
    // Pro: the two PDFs are included; Varshaphal still needs a purchase; a delivered Varshaphal stays delivered.
    setEntitlement('shubhvela_pro_lifetime', 'active', 'tok', new Date(NOW));
    expect(reportAccess('janam_patri', `p${ammaId}`)).toBe('included');
    expect(reportAccess('matching', 'pair:x')).toBe('included');
    expect(reportAccess('varshaphal', `${ref}:2027`)).toBe('buy');
    creditRow('report_varshaphal', 'tok2');
    expect(reportAccess('varshaphal', `${ref}:2027`)).toBe('credit');
    deliverReport('varshaphal', `${ref}:2027`);
    expect(reportAccess('varshaphal', `${ref}:2027`)).toBe('delivered');
    expect(reportAccess('varshaphal', `${ref}:2028`)).toBe('buy');
  });

  it('preview (free): Buy -> purchase row delivered to this profile and the CTA flips to Download; a Play failure keeps the preview and the cache', async () => {
    const buyOk = jest.fn(async () => creditRow('report_janam_patri', 'tok-buy'));
    await renderWithProviders(<PreviewScreen params={janam()} now={now} fonts={fonts} buy={buyOk} />);
    // Fonts resolve -> the WebView renders the same HTML the PDF prints.
    const web = await screen.findByTestId('pdf-webview');
    const html = (web.props.source as { html: string }).html;
    expect(sectionIds(html)).toEqual([...JANAM_PATRI_SECTIONS]);
    expect(html).toContain('Shubhvela · शुभवेला');
    expect(textOf(screen.getByTestId('pdf-subject'))).toBe('For Priya · PDF language: हिन्दी');
    expect(screen.getByTestId('pdf-buy')).toBeTruthy();
    expect(textOf(screen.getByTestId('pdf-buy'))).toBe('Buy ₹99');
    expect(screen.getByTestId('pdf-share').props.accessibilityState.disabled).toBe(true);
    expect(screen.queryByTestId('pdf-download')).toBeNull();
    expect(screen.queryByTestId('mock-banner-ad')).toBeNull();
    await fireEvent.press(screen.getByTestId('pdf-buy'));
    await screen.findByTestId('pdf-download');
    expect(buyOk).toHaveBeenCalledWith('janam_patri');
    expect(screen.getByText('Delivered for Priya')).toBeTruthy();
    expect(screen.queryByTestId('pdf-buy')).toBeNull();
    expect(screen.getByTestId('pdf-share').props.accessibilityState.disabled).toBe(false);
    const row = getDb().getFirstSync<{ ref_id: string; delivered_at: string | null }>('SELECT ref_id, delivered_at FROM purchases WHERE token = ?', ['tok-buy'])!;
    expect(row.ref_id).toBe(`p${priyaId}`);
    expect(row.delivered_at).not.toBeNull();
    expect(mockShow).not.toHaveBeenCalled();
  });

  it('preview (free): a Play failure shows the inline message, the CTA stays Buy and nothing is written', async () => {
    const buyFail = jest.fn(async () => {
      throw new BillingFailure('unavailable');
    });
    await renderWithProviders(<PreviewScreen params={janam()} now={now} fonts={fonts} buy={buyFail} />);
    await screen.findByTestId('pdf-webview');
    await fireEvent.press(screen.getByTestId('pdf-buy'));
    await screen.findByText(/This item isn't available in Play yet/);
    expect(screen.getByText(/the preview stays/)).toBeTruthy();
    expect(screen.getByTestId('pdf-buy')).toBeTruthy();
    expect(screen.getByTestId('pdf-webview')).toBeTruthy();
    expect(getDb().getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM purchases')!.n).toBe(0);
    expect(reportAccess('janam_patri', `p${priyaId}`)).toBe('buy');
  });

  it('preview (Pro): Download prints the HTML, shares the file, shows the page count; Done asks the reportDone interstitial exactly once; print failure -> Retry', async () => {
    setEntitlement('shubhvela_pro_lifetime', 'active', 'tok', new Date(NOW));
    let fail = true;
    const print = jest.fn(async (html: string) => {
      if (fail) throw new Error('low storage');
      expect(html).toContain('data-section="disclaimer"');
      return { uri: 'file:///cache/Print.pdf', pages: 4 };
    });
    const rename = jest.fn(async (_uri: string, name: string) => `file:///cache/${name}`);
    // The shown page count comes from the PDF bytes (B08: expo-print's numberOfPages was 23 for a 9-page file), so the
    // printer's "4" is overridden by the two page objects in the file; "/Pages" (the tree node) is not a page.
    const readBytes = jest.fn(async () => new TextEncoder().encode('%PDF-1.4\n1 0 obj << /Type /Pages /Kids [2 0 R 3 0 R] /Count 2 >> endobj\n2 0 obj << /Type /Page /Parent 1 0 R >> endobj\n3 0 obj <</Type/Page /Parent 1 0 R>> endobj\n'));
    const share = jest.fn(async () => {});
    const onDone = jest.fn();
    await renderWithProviders(<PreviewScreen params={janam()} now={now} fonts={fonts} pdf={{ print, rename, share, readBytes }} onDone={onDone} />);
    await screen.findByTestId('pdf-webview');
    expect(textOf(screen.getByTestId('pdf-included'))).toBe('included in Pro');
    expect(screen.queryByTestId('pdf-buy')).toBeNull();
    await fireEvent.press(screen.getByTestId('pdf-download'));
    await screen.findByText("Couldn't create the PDF");
    expect(screen.getByTestId('pdf-retry')).toBeTruthy();
    expect(share).not.toHaveBeenCalled();
    fail = false;
    await fireEvent.press(screen.getByTestId('pdf-retry'));
    await screen.findByTestId('pdf-created');
    expect(textOf(screen.getByTestId('pdf-created'))).toBe('PDF created · 2 pages');
    expect(readBytes).toHaveBeenCalledWith('file:///cache/shubhvela-janam-patri-Priya.pdf');
    expect(print).toHaveBeenCalledTimes(2);
    expect(rename).toHaveBeenCalledWith('file:///cache/Print.pdf', 'shubhvela-janam-patri-Priya.pdf');
    expect(share).toHaveBeenCalledWith('file:///cache/shubhvela-janam-patri-Priya.pdf', 'shubhvela-janam-patri-Priya.pdf');
    expect(mockShow).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('pdf-done'));
    expect(mockShow).toHaveBeenCalledTimes(1);
    expect(mockShow).toHaveBeenCalledWith('reportDone');
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('preview: a credit is delivered to the pair on the first Download of the matching report; Varshaphal stays ₹149 for Pro', async () => {
    creditRow('report_matching', 'tok-m');
    const print = jest.fn(async () => ({ uri: 'file:///cache/Print.pdf', pages: 6 }));
    const share = jest.fn(async () => {});
    const rename = jest.fn(async (_u: string, n: string) => `file:///cache/${n}`);
    await renderWithProviders(<PreviewScreen params={matching()} now={now} fonts={fonts} pdf={{ print, rename, share }} />);
    await screen.findByTestId('pdf-webview');
    expect(textOf(screen.getByTestId('pdf-subject'))).toBe('Priya · Amma · PDF language: हिन्दी');
    await fireEvent.press(screen.getByTestId('pdf-download'));
    await screen.findByTestId('pdf-created');
    expect(reportAccess('matching', reportRefId(matching()))).toBe('delivered');
    expect(reportCredits('matching')).toBe(0);
    setEntitlement('shubhvela_pro_lifetime', 'active', 'tok', new Date(NOW));
    await renderWithProviders(<PreviewScreen params={varshaphal()} now={now} fonts={fonts} />);
    const buys = await screen.findAllByTestId('pdf-buy');
    expect(textOf(buys[buys.length - 1])).toBe('Buy ₹149');
    expect(screen.getAllByText(/₹149 · one-time, in Free and Pro/).length).toBeGreaterThan(0);
  });

  it('preview with an incomplete route shows the honest error, no CTA', async () => {
    await renderWithProviders(<PreviewScreen params={null} now={now} fonts={fonts} />);
    expect(screen.getByText('Couldn\'t compute this chart — check the birth details')).toBeTruthy();
    expect(screen.queryByTestId('pdf-cta')).toBeNull();
  });
});

describe('B07 share cards', () => {
  let close: () => void;
  let priyaId: number;
  beforeEach(() => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1);
    ({ close } = installTestDb());
    clearChartCache();
    mockShow.mockClear();
    priyaId = insertProfile(SAMPLE_PRIYA, new Date(NOW));
  });
  afterEach(() => close());

  it('the card is 540x675 dp for a 1080x1350 PNG; capture (mocked view-shot) returns a file that is shared; the switch hides the birth time by default; Close after a share asks the interstitial once', async () => {
    expect([CARD_W * 2, CARD_H * 2]).toEqual([PNG_W, PNG_H]);
    const profile = getProfile(priyaId)!;
    const chart = chartFor(profile);
    expect(kundliBornLine(profile, false, t, 'en')).toBe('Born 14 Mar 1998 · Lucknow');
    expect(kundliBornLine(profile, true, t, 'en')).toBe('Born 14 Mar 1998 · 06:42 · Lucknow');
    const capture = jest.fn(async () => 'file:///cache/card.png');
    const share = jest.fn(async () => {});
    const onClose = jest.fn();
    await renderWithProviders(
      <SharePreviewSheet visible onClose={onClose} title="My kundli card" hasBirthTime capture={capture} share={share} renderCard={(ref, show) => <KundliCard ref={ref} profile={profile} chart={chart} style="north" label="Priya" showBirthTime={show} />} />,
    );
    expect(textOf(screen.getByTestId('share-card-wordmark'))).toBe('Shubhvela · शुभवेला');
    expect(textOf(screen.getByTestId('share-card-url'))).toBe('sudish007.github.io/shubhvela');
    expect(textOf(screen.getByTestId('kundli-card-name'))).toBe("Priya's kundli");
    expect(screen.getByTestId('kundli-card-chart')).toBeTruthy();
    expect(screen.getByTestId('share-show-birth-time').props.accessibilityState.checked).toBe(false);
    expect(textOf(screen.getByTestId('kundli-card-born'))).toBe('Born 14 Mar 1998 · Lucknow');
    expect(screen.getByTestId('share-birth-time-hidden')).toBeTruthy();
    expect(screen.queryByText(/06:42/)).toBeNull();
    await fireEvent.press(screen.getByTestId('share-show-birth-time'));
    expect(screen.getByTestId('share-show-birth-time').props.accessibilityState.checked).toBe(true);
    expect(textOf(screen.getByTestId('kundli-card-born'))).toBe('Born 14 Mar 1998 · 06:42 · Lucknow');
    expect(screen.queryByTestId('share-birth-time-hidden')).toBeNull();
    // Share: capture then the system sheet; Close afterwards is the one interstitial ask.
    await fireEvent.press(screen.getByTestId('share-preview-share'));
    await screen.findByTestId('share-preview-shared');
    expect(capture).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledWith('file:///cache/card.png', 'My kundli card');
    expect(mockShow).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockShow).toHaveBeenCalledTimes(1);
    expect(mockShow).toHaveBeenCalledWith('sharePreviewClosedAfterShare');
  });

  it('a capture failure shows "Couldn\'t create the image" with Retry; Close without a share never asks the interstitial', async () => {
    const profile = getProfile(priyaId)!;
    const chart = chartFor(profile);
    let fail = true;
    const capture = jest.fn(async () => {
      if (fail) throw new Error('view-shot');
      return 'file:///cache/card.png';
    });
    const share = jest.fn(async () => {});
    const onClose = jest.fn();
    await renderWithProviders(<SharePreviewSheet visible onClose={onClose} title="My kundli card" capture={capture} share={share} renderCard={(ref) => <KundliCard ref={ref} profile={profile} chart={chart} style="south" label="Priya" showBirthTime={false} />} />);
    expect(screen.queryByTestId('share-show-birth-time')).toBeNull();
    await fireEvent.press(screen.getByTestId('share-preview-share'));
    await screen.findByText("Couldn't create the image");
    expect(textOf(screen.getByTestId('share-preview-share'))).toBe('Retry');
    expect(share).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Close'));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockShow).not.toHaveBeenCalled();
    fail = false;
    await fireEvent.press(screen.getByTestId('share-preview-share'));
    await screen.findByTestId('share-preview-shared');
    expect(share).toHaveBeenCalledTimes(1);
  });
});
