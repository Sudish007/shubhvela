// FEAT-B06 share-a-code (F30 mode A): the payload of a profile carries no name; the QR URL is the versioned /m/ URL
// (no `n=`), the typed code is 20 Crockford characters shown in groups of four; URL and code decode to the same payload;
// the one invalid message covers length / alphabet / CRC / version; the share screen shows QR + code + Copy + the privacy
// copy; the profile editor's ⋮ control offers "Share for matching" (M3) and no "profile menu" wording exists.
import { fireEvent, screen } from '@testing-library/react-native';
import { SHARE_BASE_URL, decodeShareCode, parseShareUrl } from '@shubhvela/engine';
import * as Clipboard from 'expo-clipboard';
import { PixelRatio } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import ShareCodeScreen from '../app/family/share-code';
import ProfileEditor from '../app/profile/[id]';
import { getProfile, insertProfile } from '../src/db/profiles';
import { SAMPLE_AMMA, SAMPLE_PRIYA } from '../src/dev/seed';
import { carriersFor, decodeShared, payloadFromProfile, typedCodeProgress } from '../src/share/payload';
import { installTestDb } from './helpers/nodeDb';
import { allTexts, renderWithProviders, textOf } from './helpers/render';

const NOW = Date.UTC(2026, 9, 22, 5, 28);
const CODE_RE = /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){4}$/;

// Same router mock as test/setup.ts with mutable params so the editor can open a given id.
const mockParams: { id?: string; profile?: string } = {};
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
  return {
    useRouter: () => mockRouter,
    router: mockRouter,
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
    Redirect: () => null,
    Link: ({ children }: { children?: unknown }) => children ?? null,
    Stack: Object.assign(() => null, { Screen: () => null }),
  };
});

describe('B06 share-a-code', () => {
  let close: () => void;
  let priyaId: number;
  let ammaId: number;
  beforeEach(() => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1);
    ({ close } = installTestDb());
    (Clipboard.setStringAsync as jest.Mock).mockClear();
    priyaId = insertProfile(SAMPLE_PRIYA, new Date(NOW));
    ammaId = insertProfile(SAMPLE_AMMA, new Date(NOW));
    delete mockParams.id;
    delete mockParams.profile;
  });
  afterEach(() => {
    globalThis.__PSEUDO_LOCALE__ = undefined;
    close();
  });

  it('payload, QR URL and typed code carry birth date, time, place, zone and gender - never the name', () => {
    const payload = payloadFromProfile(SAMPLE_PRIYA);
    expect(payload).toEqual({ v: 1, date: '1998-03-14', time: '06:42', approx: 0, lat: 26.85, lon: 80.95, tz: 'Asia/Kolkata', gender: 'f' });
    expect(JSON.stringify(payload)).not.toMatch(/Priya|name/i);
    const c = carriersFor(payload);
    expect(c.url).toBe(`${SHARE_BASE_URL}m/?v=1&d=19980314&t=0642&a=0&lat=26.85&lon=80.95&tz=Asia%2FKolkata&g=f`);
    expect(c.url).not.toMatch(/[?&]n=|Priya|Lucknow/);
    expect(c.code).toMatch(/^[0-9A-HJKMNP-TV-Z]{20}$/);
    expect(c.grouped).toMatch(CODE_RE);
    expect(c.grouped.replace(/-/g, '')).toBe(c.code);
    // Both carriers decode to the same payload; the web /m/ parser agrees.
    expect(decodeShared(c.url, NOW)).toEqual(payload);
    expect(decodeShared(c.code, NOW)).toEqual(payload);
    expect(decodeShared(c.grouped.toLowerCase(), NOW)).toEqual(payload);
    expect(parseShareUrl(c.url, { nowMs: NOW }).payload).toEqual(payload);
    expect(decodeShareCode(c.code)).toEqual(payload);
    // Unknown time -> t=u and a null time; approximate time keeps its minutes.
    const unknown = carriersFor(payloadFromProfile({ ...SAMPLE_AMMA, birthTime: null, timeUnknown: true }));
    expect(unknown.url).toContain('&t=u&a=0&');
    expect(decodeShared(unknown.code, NOW)!.time).toBeNull();
    const approx = carriersFor(payloadFromProfile({ ...SAMPLE_AMMA, timeApproxMinutes: 30 }));
    expect(approx.url).toContain('&t=0430&a=30&');
    expect(decodeShared(approx.code, NOW)!.approx).toBe(30);
    // One failure state for length / alphabet / CRC / version / garbage.
    expect(decodeShared(c.code.slice(0, 19), NOW)).toBeNull();
    expect(decodeShared(`${c.code.slice(0, 19)}U`, NOW)).toBeNull();
    expect(decodeShared(`${c.code.slice(0, 19)}${c.code[19] === '0' ? '1' : '0'}`, NOW)).toBeNull();
    expect(decodeShared(`${c.code[0] === '0' ? 'G' : '0'}${c.code.slice(1)}`, NOW)).toBeNull();
    expect(decodeShared(`${SHARE_BASE_URL}m/?v=2&d=19980314&t=0642&a=0&lat=26.85&lon=80.95&tz=Asia%2FKolkata&g=f`, NOW)).toBeNull();
    expect(decodeShared(`${SHARE_BASE_URL}m/?v=1&d=19980314&t=0642&a=0&lat=26.85&lon=80.95&tz=Asia%2FKolkata&g=f&n=Priya`, NOW)).toBeNull();
    expect(decodeShared('', NOW)).toBeNull();
    expect(typedCodeProgress('abcd-efgh ijkm')).toEqual({ normalised: 'ABCDEFGH1JKM', complete: false, alphabetOk: true });
    expect(typedCodeProgress('ABCU').alphabetOk).toBe(false);
  });

  it('the share screen shows the QR of the /m/ URL, the grouped code, Copy, the privacy copy and what is / is not carried', async () => {
    mockParams.profile = String(ammaId);
    const amma = getProfile(ammaId)!;
    const c = carriersFor(payloadFromProfile(amma));
    await renderWithProviders(<ShareCodeScreen />);
    expect(textOf(screen.getByTestId('share-for'))).toBe('Code for Amma');
    expect(screen.getByTestId('share-qr').props.accessibilityLabel).toBe('QR code carrying the birth date, time and place for matching');
    expect(textOf(screen.getByTestId('share-code'))).toBe(c.grouped);
    expect(textOf(screen.getByTestId('share-privacy'))).toBe('This code contains birth date, time and place but no name.');
    expect(screen.getByText('20 characters, shown in groups of four')).toBeTruthy();
    const fields = textOf(screen.getByTestId('share-fields'));
    expect(fields).toContain('Birth date5 Jul 1970');
    expect(fields).toContain('Birth time04:30');
    expect(fields).toContain('Place (rounded to 0.01°)25.61, 85.14');
    expect(fields).toContain('Time zoneAsia/Kolkata');
    expect(fields).toContain('GenderFemale');
    expect(fields).toContain('Not included: name, relationship, anything else');
    expect(screen.queryByText(/Patna/)).toBeNull(); // the place travels as coordinates only
    expect(screen.getAllByText(/Amma/).length).toBe(1); // only the "Code for Amma" caption names the profile
    expect(screen.queryByText(/^[0-9A-Z]{8}$/)).toBeNull(); // no 8-character relay code anywhere (P5)
    await fireEvent.press(screen.getByTestId('share-copy'));
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(c.grouped);
    expect(await screen.findByText('Code copied')).toBeTruthy();
    for (const tx of allTexts()) expect(tx.props.numberOfLines).toBeUndefined();
  });

  it('without a profile param the self profile is shared; the QR value is the /m/ URL without a name', async () => {
    await renderWithProviders(<ShareCodeScreen />);
    expect(textOf(screen.getByTestId('share-for'))).toBe('Code for Priya');
    const c = carriersFor(payloadFromProfile(getProfile(priyaId)!));
    expect(textOf(screen.getByTestId('share-code'))).toBe(c.grouped);
    // The QR renders as a real SVG (react-native-qrcode-svg paints the modules as one stroked path, no gradient in use);
    // its content is the /m/ URL, which carries no name.
    const qr = screen.getByTestId('share-qr');
    const svg = qr.queryAll((i) => i.type === 'RNSVGSvgView');
    expect(svg.length).toBe(1);
    const paths = qr.queryAll((i) => i.type === 'RNSVGPath');
    expect(paths.length).toBe(1);
    expect(typeof paths[0].props.d).toBe('string');
    expect(paths[0].props.stroke).not.toEqual(expect.stringContaining('url('));
    expect(c.url).not.toMatch(/[?&]n=|Priya/);
    expect(typeof QRCode).toBe('function');
  });

  it("the profile editor's ⋮ control opens More actions with Share for matching -> the share sheet; a new profile has no ⋮; no 'profile menu' wording", async () => {
    mockParams.id = String(ammaId);
    await renderWithProviders(<ProfileEditor />);
    const more = screen.getByTestId('editor-more-button');
    expect(more.props.accessibilityLabel).toBe('More actions');
    expect(more.props.accessibilityState.expanded).toBe(false);
    await fireEvent.press(more);
    const item = screen.getByTestId('menu-share-matching');
    expect(item.props.accessibilityRole).toBe('menuitem');
    expect(item.props.accessibilityLabel).toBe('Share for matching');
    await fireEvent.press(item);
    expect(textOf(screen.getByTestId('share-for'))).toBe('Code for Amma');
    expect(textOf(screen.getByTestId('share-privacy'))).toBe('This code contains birth date, time and place but no name.');
    expect(textOf(screen.getByTestId('share-code'))).toMatch(CODE_RE);
    expect(screen.queryByText(/profile menu/i)).toBeNull();
    mockParams.id = 'new';
    await renderWithProviders(<ProfileEditor />);
    expect(screen.queryByTestId('editor-more-button')).toBeNull();
  });
});
