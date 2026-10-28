// C01 (F10) TTS: pickVoice prefers the Indian regional voice and falls back to any voice of the language (Bhojpuri ->
// Hindi); the daily note's "Listen" button speaks the rows' own sentences and toggles to "Stop"; Bhojpuri shows the
// one-time "Reading in the Hindi voice" toast exactly once; with no voice installed nothing is spoken and the inline
// notice offers the Android TTS settings; an engine error shows the honest failure notice.
import { dailyNote } from '@shubhvela/engine';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { insertProfile, getSelfProfile } from '../src/db/profiles';
import { SAMPLE_PRIYA } from '../src/dev/seed';
import { chartFor } from '../src/engine-bridge/charts';
import { makeT } from '../src/i18n';
import { DailyNoteCard, noteSentences } from '../src/today/DailyNoteCard';
import { pickVoice, speechText, TTS_LANGUAGE, type SpeechDeps, type VoiceInfo } from '../src/tts/useListen';
import { installTestDb } from './helpers/nodeDb';
import { renderWithProviders } from './helpers/render';

const FIND = { timeout: 20000 };
const NOW = Date.UTC(2026, 9, 22, 5, 28);
const DAY = '2026-10-22';

const VOICES: VoiceInfo[] = [
  { identifier: 'en-us-x-a', language: 'en-US' },
  { identifier: 'en-in-x-b', language: 'en-IN' },
  { identifier: 'hi-in-x-c', language: 'hi-IN' },
  { identifier: 'ta-in-x-d', language: 'ta-IN' },
];

type Speak = SpeechDeps['speak'];
function fakeSpeech(voices: VoiceInfo[], opts: { fail?: boolean } = {}) {
  let toastShown = false;
  const calls: { text: string; language: string; voice?: string }[] = [];
  let last: Parameters<Speak>[1] | null = null;
  const deps: SpeechDeps & { calls: typeof calls; finish: () => void; toasts: string[]; opened: number } = {
    calls,
    toasts: [],
    opened: 0,
    finish: () => last?.onDone(),
    voices: jest.fn(async () => voices),
    speak: jest.fn((text, o) => {
      calls.push({ text, language: o.language, voice: o.voice });
      last = o;
      if (opts.fail) o.onError(new Error('engine'));
    }),
    stop: jest.fn(async () => {
      last?.onStopped();
    }),
    toast: jest.fn((m: string) => {
      deps.toasts.push(m);
    }),
    openTtsSettings: jest.fn(async () => {
      deps.opened++;
    }),
    hindiToastShown: () => toastShown,
    markHindiToastShown: () => {
      toastShown = true;
    },
  };
  return deps;
}

describe('pickVoice', () => {
  it('prefers en-IN / hi-IN, falls back to any voice of the language, Bhojpuri reads with the Hindi voice', () => {
    expect(pickVoice(VOICES, 'en')?.identifier).toBe('en-in-x-b');
    expect(pickVoice(VOICES, 'hi')?.identifier).toBe('hi-in-x-c');
    expect(pickVoice(VOICES, 'bho')?.identifier).toBe('hi-in-x-c');
    expect(pickVoice([{ identifier: 'en-gb', language: 'en_GB' }], 'en')?.identifier).toBe('en-gb');
    expect(pickVoice([{ identifier: 'en-gb', language: 'en-GB' }], 'hi')).toBeNull();
    expect(pickVoice([], 'bho')).toBeNull();
    expect(TTS_LANGUAGE).toEqual({ en: 'en', hi: 'hi', bho: 'hi' });
  });

  it('speechText joins the rows with sentence stops and drops blanks', () => {
    expect(speechText(['Moon in the 6th house', 'Tara: Kshema.', '', ' Bhadra till 14:48 '])).toBe('Moon in the 6th house. Tara: Kshema. Bhadra till 14:48.');
  });
});

describe('<DailyNoteCard> Listen / Stop', () => {
  let close: () => void;
  let rows: ReturnType<typeof dailyNote>;
  beforeEach(() => {
    ({ close } = installTestDb());
    insertProfile(SAMPLE_PRIYA, new Date(NOW));
    const self = getSelfProfile()!;
    rows = dailyNote(chartFor(self), DAY, { lat: self.lat, lon: self.lon }, self.tz);
  });
  afterEach(() => close());

  it('speaks the rows own sentences with the hi-IN voice, toggles to Stop and back when the engine finishes', async () => {
    const speech = fakeSpeech(VOICES);
    await renderWithProviders(<DailyNoteCard rows={rows} name="Priya" day={DAY} tz="Asia/Kolkata" speech={speech} />, { lang: 'hi' });
    const button = await screen.findByTestId('note-listen', {}, FIND);
    expect(button.props.accessibilityLabel).toBe('सुनें');
    await fireEvent.press(button);
    await screen.findByLabelText('रोकें', {}, FIND);
    expect(speech.calls.length).toBe(1);
    expect(speech.calls[0].language).toBe('hi');
    expect(speech.calls[0].voice).toBe('hi-in-x-c');
    const expected = speechText(noteSentences(rows, 'Asia/Kolkata', DAY, makeT('hi'), 'hi'));
    expect(speech.calls[0].text).toBe(expected);
    expect(expected.length).toBeGreaterThan(40);
    expect(speech.toasts).toEqual([]); // Hindi UI: no "Hindi voice" toast
    await act(async () => {
      speech.finish();
    });
    await screen.findByLabelText('सुनें', {}, FIND);
    // Stop while speaking.
    await fireEvent.press(screen.getByTestId('note-listen'));
    await screen.findByLabelText('रोकें', {}, FIND);
    await fireEvent.press(screen.getByTestId('note-listen'));
    expect(speech.stop).toHaveBeenCalled();
    await screen.findByLabelText('सुनें', {}, FIND);
  });

  it('Bhojpuri reads in the Hindi voice with a one-time toast', async () => {
    const speech = fakeSpeech(VOICES);
    await renderWithProviders(<DailyNoteCard rows={rows} name="Priya" day={DAY} tz="Asia/Kolkata" speech={speech} />, { lang: 'bho' });
    await fireEvent.press(await screen.findByTestId('note-listen', {}, FIND));
    await screen.findByLabelText('रोकीं', {}, FIND);
    expect(speech.calls[0].language).toBe('hi');
    expect(speech.calls[0].voice).toBe('hi-in-x-c');
    expect(speech.toasts).toEqual(['हिंदी आवाज में पढ़ल जा रहल बा']);
    await act(async () => {
      speech.finish();
    });
    await screen.findByLabelText('सुनीं', {}, FIND);
    await fireEvent.press(screen.getByTestId('note-listen'));
    await screen.findByLabelText('रोकीं', {}, FIND);
    expect(speech.toasts.length).toBe(1); // shown once only
  });

  it('with no Hindi voice installed nothing is spoken; the notice names the language and opens TTS settings', async () => {
    const speech = fakeSpeech([{ identifier: 'en-us', language: 'en-US' }]);
    await renderWithProviders(<DailyNoteCard rows={rows} name="Priya" day={DAY} tz="Asia/Kolkata" speech={speech} />, { lang: 'bho' });
    await fireEvent.press(await screen.findByTestId('note-listen', {}, FIND));
    await screen.findByTestId('note-tts-notice', {}, FIND);
    expect(speech.speak).not.toHaveBeenCalled();
    expect(screen.getByText('हिंदी/भोजपुरी आवाज इंस्टॉल नइखे — TTS सेटिंग खोलीं')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('note-tts-settings'));
    expect(speech.opened).toBe(1);
    expect(screen.getByTestId('note-listen').props.accessibilityLabel).toBe('सुनीं');
  });

  it('an engine error shows the failure notice and the button returns to Listen', async () => {
    const speech = fakeSpeech(VOICES, { fail: true });
    await renderWithProviders(<DailyNoteCard rows={rows} name="Priya" day={DAY} tz="Asia/Kolkata" speech={speech} />);
    await fireEvent.press(await screen.findByTestId('note-listen', {}, FIND));
    await screen.findByTestId('note-tts-error', {}, FIND);
    expect(screen.getByText("Couldn't read the note aloud")).toBeTruthy();
    expect(speech.calls[0].language).toBe('en');
    expect(speech.calls[0].voice).toBe('en-in-x-b');
  });
});
