// FEAT-B06 matching (F29) + the pick screen's code entry (F30): the result screen's "N of 36 guna" and every koota row
// equal engine.ashtakoota() for the two sample profiles; Why? opens the corpus text at level 1 on free and level 3 on
// Pro; Nadi/Bhakoot rows name their state; Mangal dosha per person with every cancellation rule as a row; the four
// "beyond" rows; the computed summary; no "Matching report PDF" button before B07; the pick screen validates sides,
// routes with the sides as params, rejects a bad typed code with the one message and consumes a scanned code; the
// +30 % pseudo-locale snapshot of the result does not truncate.
import { act, fireEvent, screen } from '@testing-library/react-native';
import { lookup } from '@shubhvela/content';
import { ashtakoota, beyondGunMilan, decodeShareCode, encodeShareCode, mangalDosha, mangalDoshaPair } from '@shubhvela/engine';
import { router } from 'expo-router';
import { PixelRatio } from 'react-native';
import MatchPickScreen from '../app/family/match/index';
import MatchResultScreen from '../app/family/match/result';
import { getProfile, insertProfile } from '../src/db/profiles';
import { SAMPLE_AMMA, SAMPLE_PRIYA } from '../src/dev/seed';
import { chartFor, clearChartCache } from '../src/engine-bridge/charts';
import { setEntitlement } from '../src/entitlements';
import { draftToSide, typedState } from '../src/match/draft';
import { clearCodeChartCache, fmtGuna, fullKootaCount, sideFromParams, sidesToParams } from '../src/match/model';
import { EMPTY_FORM } from '../src/profiles/validate';
import { carriersFor, payloadFromProfile } from '../src/share/payload';
import { codeFromScan, ScanScreen } from '../src/share/ScanScreen';
import { resetScanResultForTests, setScanResult } from '../src/share/scanResult';
import { installTestDb } from './helpers/nodeDb';
import { allTexts, renderWithProviders, textOf } from './helpers/render';

const NOW = Date.UTC(2026, 9, 22, 5, 28); // Thu 22 Oct 2026 10:58 IST
const now = () => NOW;
const INVALID = "This code isn't valid — check the 20 characters or scan the QR";

function assertNoTruncation() {
  for (const tx of allTexts()) expect(tx.props.numberOfLines).toBeUndefined();
}

describe('B06 matching', () => {
  let close: () => void;
  let priyaId: number;
  let ammaId: number;
  beforeEach(() => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1);
    ({ close } = installTestDb());
    clearChartCache();
    clearCodeChartCache();
    resetScanResultForTests();
    (router.push as jest.Mock).mockClear();
    priyaId = insertProfile(SAMPLE_PRIYA, new Date(NOW));
    ammaId = insertProfile(SAMPLE_AMMA, new Date(NOW));
  });
  afterEach(() => {
    globalThis.__PSEUDO_LOCALE__ = undefined;
    close();
  });

  it('route params round-trip profile and code sides; entered details become a lossless code; bad typed codes are one invalid state', () => {
    const code = encodeShareCode(payloadFromProfile(SAMPLE_AMMA));
    const params = sidesToParams({ kind: 'profile', id: 7 }, { kind: 'code', code, label: 'Ravi', source: 'entered' });
    expect(params).toEqual({ a: 'p7', b: `c${code}`, bn: 'Ravi', bs: 'entered' });
    expect(sideFromParams(params, 'a')).toEqual({ kind: 'profile', id: 7 });
    expect(sideFromParams(params, 'b')).toEqual({ kind: 'code', code, label: 'Ravi', source: 'entered' });
    expect(sideFromParams({}, 'a')).toBeNull();
    // Entered details (the onboarding form) -> code -> the same birth data.
    const form = {
      ...EMPTY_FORM({ tradition: 'purnimanta', pdfLanguage: 'en', relationship: 'other' }),
      birthDate: '1970-07-05',
      birthTime: '04:30',
      name: ' Amma ',
      gender: 'female' as const,
      place: { name: 'Patna', admin1: 'Bihar', country: 'India', lat: 25.61, lon: 85.14, tz: 'Asia/Kolkata', source: 'gazetteer' as const },
    };
    const r = draftToSide({ mode: 'enter', form, errors: {} }, new Date(NOW));
    expect(r.ok).toBe(true);
    if (r.ok && r.side.kind === 'code') {
      expect(r.side.label).toBe('Amma');
      expect(r.side.source).toBe('entered');
      expect(decodeShareCode(r.side.code)).toEqual({ v: 1, date: '1970-07-05', time: '04:30', approx: 0, lat: 25.61, lon: 85.14, tz: 'Asia/Kolkata', gender: 'f' });
    }
    // An incomplete form reports its field errors instead.
    const bad = draftToSide({ mode: 'enter', form: { ...form, birthDate: null, place: null }, errors: {} }, new Date(NOW));
    expect(bad.ok).toBe(false);
    if (!bad.ok && bad.draft.mode === 'enter') expect(bad.draft.errors).toEqual({ date: true, place: true });
    // Typed code: wrong length, wrong alphabet, bad CRC, wrong version -> all "invalid"; the real code (any case, with
    // hyphens, I/L/O mapped) -> valid.
    expect(typedState(code.slice(0, 19), true, NOW)).toBe('invalid');
    expect(typedState(`${code.slice(0, 19)}U`, true, NOW)).toBe('invalid');
    const flipped = `${code.slice(0, 19)}${code[19] === '0' ? '1' : '0'}`;
    expect(typedState(flipped, true, NOW)).toBe('invalid');
    const otherVersion = `${code[0] === '0' ? 'G' : '0'}${code.slice(1)}`;
    expect(typedState(otherVersion, true, NOW)).toBe('invalid');
    expect(typedState(code.slice(0, 8), false, NOW)).toBe('typing');
    expect(typedState(code.toLowerCase().replace(/1/g, 'l').replace(/0/g, 'o').replace(/(.{4})(?=.)/g, '$1-'), false, NOW)).toBe('valid');
    const typed = draftToSide({ mode: 'type', text: flipped, touched: false }, new Date(NOW));
    expect(typed.ok).toBe(false);
    if (!typed.ok) expect(typed.problem).toBe('code');
  });

  it('free result: the guna count, eight koota rows, doshas, Mangal rows, beyond rows and the summary all equal the engine; Why? shows level 1; no PDF button', async () => {
    const priya = getProfile(priyaId)!;
    const amma = getProfile(ammaId)!;
    const guna = ashtakoota(chartFor(priya), chartFor(amma));
    const pair = mangalDoshaPair(chartFor(priya), chartFor(amma));
    const beyond = beyondGunMilan(chartFor(priya), chartFor(amma), NOW);
    await renderWithProviders(<MatchResultScreen now={now} sides={{ a: { kind: 'profile', id: priyaId }, b: { kind: 'profile', id: ammaId } }} />);
    expect(textOf(screen.getByTestId('guna-total'))).toBe(`${fmtGuna(guna.total)} of 36 guna`);
    expect(textOf(screen.getByTestId('guna-side-a'))).toMatch(/^A · Priya · Moon in /);
    expect(textOf(screen.getByTestId('guna-side-b'))).toMatch(/^B · Amma · Moon in /);
    for (const k of guna.kootas) {
      expect(textOf(screen.getByTestId(`koota-${k.id}-points`))).toBe(`${k.points} of ${k.max}`);
      expect(textOf(screen.getByTestId(`koota-${k.id}-meaning`))).toBe(lookup('koota', `koota-${k.id}-1`, 'en')!.text);
    }
    expect(screen.getAllByTestId(/^koota-[a-zA-Z]+$/).length).toBe(8);
    // Doshas: Nadi / Bhakoot state words from the engine result.
    const nadi = guna.kootas.find((k) => k.id === 'nadi')!;
    expect(textOf(screen.getByTestId('dosha-nadi'))).toContain(guna.nadiException ? 'lifted' : nadi.detail.dosha ? 'Nadi dosha: present' : 'Nadi dosha: none');
    const bk = guna.kootas.find((k) => k.id === 'bhakoot')!;
    expect(textOf(screen.getByTestId('dosha-bhakoot'))).toContain(bk.detail.dosha ? 'Bhakoot dosha: present' : 'Bhakoot dosha: none');
    // Mangal dosha per person; every cancellation rule is a row with its state when the dosha is present.
    for (const [key, report, name] of [
      ['a', pair.a, 'Priya'],
      ['b', pair.b, 'Amma'],
    ] as const) {
      const status = textOf(screen.getByTestId(`mangal-${key}-status`));
      expect(screen.getByText(`Mangal dosha · ${name}`)).toBeTruthy();
      expect(status).toContain(report.present ? (report.effective ? 'present · effective' : 'present · cancelled') : 'not present');
      if (report.present) {
        for (const c of report.cancellations) {
          const row = screen.getByTestId(`mangal-${key}-${c.ruleId}`);
          expect(textOf(row)).toContain(c.applies ? 'applies' : 'not applied');
        }
        expect(screen.getAllByTestId(new RegExp(`^mangal-${key}-mangal-cancel-`)).length).toBe(5);
      } else {
        expect(screen.queryAllByTestId(new RegExp(`^mangal-${key}-mangal-cancel-`)).length).toBe(0);
      }
      expect(report).toEqual(mangalDosha(chartFor(key === 'a' ? priya : amma)));
    }
    // Beyond gun milan: four rows, tone words only, overlap lines.
    for (const row of beyond.rows) expect(textOf(screen.getByTestId(`beyond-${row.id}`))).toContain(row.tone);
    expect(screen.getAllByTestId(/^beyond-(seventh-lords|venus|moon-sign-relation|dasha-overlap)$/).length).toBe(4);
    expect(screen.getAllByTestId(/^overlap-\d+$/).length).toBe(Math.min(5, beyond.dashaOverlaps.length));
    expect(screen.queryByText(/Manglik girl|Manglik boy|danger|death/i)).toBeNull();
    // Summary (computed) + the free caption; no PDF button before B07.
    const summary = textOf(screen.getByTestId('summary-text'));
    expect(summary).toMatch(new RegExp(`^Priya and Amma score ${fmtGuna(guna.total)} of 36 guna; ${fullKootaCount(guna)} of 8 kootas at full points\\.`));
    expect(screen.getByTestId('summary-free')).toBeTruthy();
    expect(screen.queryByTestId('match-report-pdf')).toBeNull();
    expect(screen.getByText('How this was computed')).toBeTruthy();
    // Why? on the Varna row: level-1 text on free (not the level-3 text).
    await fireEvent.press(screen.getByLabelText(/^Why\? Varna · /));
    expect(screen.getByTestId('why-explanation')).toBeTruthy();
    expect(screen.getAllByText(lookup('koota', 'koota-varna-1', 'en')!.text).length).toBeGreaterThan(0);
    expect(screen.queryByText(lookup('koota', 'koota-varna-3', 'en')!.text)).toBeNull();
    assertNoTruncation();
  });

  it('Pro result: Why? opens the level-3 explanation and the free caption is gone; the PDF button still waits for B07', async () => {
    setEntitlement('shubhvela_pro_lifetime', 'active', 'tok', new Date(NOW));
    await renderWithProviders(<MatchResultScreen now={now} sides={{ a: { kind: 'profile', id: priyaId }, b: { kind: 'profile', id: ammaId } }} />);
    expect(screen.queryByTestId('summary-free')).toBeNull();
    expect(screen.queryByTestId('match-report-pdf')).toBeNull();
    await fireEvent.press(screen.getByLabelText(/^Why\? Nadi · /));
    expect(screen.getAllByText(lookup('koota', 'koota-nadi-3', 'en')!.text).length).toBeGreaterThan(0);
    expect(screen.getByText('Full explanation')).toBeTruthy();
  });

  it('a code side computes the same chart locally and is labelled without a name', async () => {
    const priya = getProfile(priyaId)!;
    const amma = getProfile(ammaId)!;
    const guna = ashtakoota(chartFor(priya), chartFor(amma));
    const { code } = carriersFor(payloadFromProfile(amma));
    await renderWithProviders(<MatchResultScreen now={now} sides={{ a: { kind: 'profile', id: priyaId }, b: { kind: 'code', code, label: null, source: 'scanned' } }} />);
    expect(textOf(screen.getByTestId('guna-total'))).toBe(`${fmtGuna(guna.total)} of 36 guna`);
    expect(textOf(screen.getByTestId('guna-side-b'))).toMatch(/^B · From a code · Moon in /);
    expect(screen.queryByText(/Amma/)).toBeNull();
    expect(textOf(screen.getByTestId('summary-text'))).toMatch(/^Priya and From a code score /);
  });

  it('an invalid code in the route shows the one message instead of a result', async () => {
    await renderWithProviders(<MatchResultScreen now={now} sides={{ a: { kind: 'profile', id: priyaId }, b: { kind: 'code', code: 'ABCDEFGHJKMNPQRSTVWX', label: null, source: 'typed' } }} />);
    expect(screen.getByText(INVALID)).toBeTruthy();
    expect(screen.queryByTestId('guna-total')).toBeNull();
  });

  it('pick screen: self preselected as A; Match needs two different sides; profiles route as params; a typed code is validated inline', async () => {
    const code = encodeShareCode(payloadFromProfile(SAMPLE_AMMA));
    await renderWithProviders(<MatchPickScreen now={now} />);
    expect(screen.getByTestId(`side-a-profile-${priyaId}`).props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('match-privacy').props.children).toBe('This code contains birth date, time and place but no name.');
    await fireEvent.press(screen.getByTestId('match-go'));
    expect(screen.getByText('Choose both sides to match')).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId(`side-b-profile-${priyaId}`));
    await fireEvent.press(screen.getByTestId('match-go'));
    expect(screen.getByText('Pick two different profiles')).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`side-b-profile-${ammaId}`));
    await fireEvent.press(screen.getByTestId('match-go'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/family/match/result', params: { a: `p${priyaId}`, b: `p${ammaId}` } });
    // Swap puts Amma first.
    await fireEvent.press(screen.getByTestId('match-swap'));
    expect(screen.getByTestId(`side-a-profile-${ammaId}`).props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId(`side-b-profile-${priyaId}`).props.accessibilityState.selected).toBe(true);
    // Type a code for B: a bad code shows the one message; the real code is read and routed as c<CODE>.
    await fireEvent.press(screen.getByTestId('side-b-type'));
    const field = screen.getByTestId('side-b-code');
    await fireEvent.changeText(field, 'ABCD');
    await fireEvent(field, 'blur');
    expect(screen.getByText(INVALID)).toBeTruthy();
    (router.push as jest.Mock).mockClear();
    await fireEvent.press(screen.getByTestId('match-go'));
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByText('Check the highlighted fields')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('side-b-code'), code.toLowerCase());
    expect(screen.queryByText(INVALID)).toBeNull();
    expect(screen.getByText('Birth details read; no name was included · Birth date 5 Jul 1970')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('match-go'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/family/match/result', params: { a: `p${ammaId}`, b: `c${code}`, bs: 'typed' } });
    // Scan a code opens the camera route for that side.
    await fireEvent.press(screen.getByTestId('side-b-scan'));
    expect(router.push).toHaveBeenCalledWith('/family/scan?side=b');
    assertNoTruncation();
  });

  it('a scanned code is handed to the asking side on focus; the scan screen decodes the QR URL locally and rejects other QRs', async () => {
    const { code, url } = carriersFor(payloadFromProfile(SAMPLE_AMMA));
    setScanResult('b', code);
    await renderWithProviders(<MatchPickScreen now={now} />);
    expect(screen.getByTestId('side-b-scan').props.accessibilityState.selected).toBe(true);
    expect(textOf(screen.getByTestId('side-b-scanned'))).toContain('Scanned code · ');
    await fireEvent.press(screen.getByTestId('match-go'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/family/match/result', params: { a: `p${priyaId}`, b: `c${code}`, bs: 'scanned' } });
    // Scan screen: the mocked camera exposes onBarcodeScanned.
    expect(codeFromScan(url, NOW)).toBe(code);
    expect(codeFromScan(`shubhvela://m?${url.split('?')[1]}`, NOW)).toBe(code);
    expect(codeFromScan(code.toLowerCase(), NOW)).toBe(code);
    expect(codeFromScan('https://example.com/not-a-code', NOW)).toBeNull();
    const onDecoded = jest.fn();
    await renderWithProviders(<ScanScreen onDecoded={onDecoded} onTypeInstead={jest.fn()} now={now} />);
    expect(screen.getByText('Point the camera at the QR')).toBeTruthy();
    const cam = screen.getByTestId('mock-camera-view');
    expect(cam.props.barcodeScannerSettings).toEqual({ barcodeTypes: ['qr'] });
    await act(async () => cam.props.onBarcodeScanned({ data: 'https://example.com/other', type: 'qr' }));
    expect(onDecoded).not.toHaveBeenCalled();
    expect(screen.getByText(INVALID)).toBeTruthy();
    await act(async () => cam.props.onBarcodeScanned({ data: url, type: 'qr' }));
    expect(onDecoded).toHaveBeenCalledWith(code);
  });

  it('+30 % pseudo-locale (en) result screen renders every string whole', async () => {
    globalThis.__PSEUDO_LOCALE__ = true;
    const tree = await renderWithProviders(<MatchResultScreen now={now} sides={{ a: { kind: 'profile', id: priyaId }, b: { kind: 'profile', id: ammaId } }} />);
    assertNoTruncation();
    expect(screen.getAllByText(/^Kootas x+$/).length).toBe(1);
    expect(screen.getAllByText(/^Beyond gun milan x+$/).length).toBe(1);
    expect(tree.toJSON()).toMatchSnapshot();
  });

  it('same-profile sides: the engine agrees with itself (36 of 36, Nadi dosha lifted by the same nakshatra-pada rule or kept)', () => {
    const chart = chartFor(getProfile(priyaId)!);
    const g = ashtakoota(chart, chart);
    // Same Moon: every koota but Nadi/Bhakoot is full; Bhakoot 1/1 is fine; Nadi same nadi same pada keeps the dosha.
    expect(g.kootas.filter((k) => k.id !== 'nadi' && k.id !== 'bhakoot').every((k) => k.points === k.max)).toBe(true);
    expect(fmtGuna(23.5)).toBe('23.5');
    expect(fmtGuna(24)).toBe('24');
  });
});
