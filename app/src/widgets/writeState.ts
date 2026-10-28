// Writes files/widget_state.json (design.md 10.2 F9, plan P4) and asks the placed widgets to redraw. Called on app launch
// (root layout), on language change (WidgetStateSync) and whenever Today's observer changes (useToday: chosen city or the
// device fix), and by the background task when the file is running out of days. The observer is the same one Today uses:
// the self profile's place, or the coarse device fix when Settings -> Location is 'Use my location' (falls back to the
// place). Android-only: on any other platform (and under Jest, where Platform.OS is 'ios') the write is a no-op.
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { hasDb } from '../db/connection';
import { getSelfProfile } from '../db/profiles';
import { getSetting } from '../db/settings';
import { chartFor } from '../engine-bridge/charts';
import { makeT, type Lang } from '../i18n';
import { getDeviceFix } from '../location/gps';
import { observerFromProfile, type Observer } from '../today/model';
import { buildWidgetState, WIDGET_STATE_FILE, type WidgetStateFile } from './state';
import { refreshWidgets } from '../../modules/widget-pin';

export interface WidgetFileDeps {
  /** Writes the whole file (atomic enough for a 100 KB JSON: the widget tolerates a failed parse by keeping its last bitmap). */
  write(text: string): Promise<void>;
  /** The current file text, or null when it does not exist. */
  read(): Promise<string | null>;
  /** Tells the placed widgets to redraw now; returns how many were told. */
  refresh(): number;
}

/** expo-file-system (Paths.document = the Android files dir the Kotlin side reads) + the local widget module. */
export const androidFileDeps: WidgetFileDeps = {
  async write(text) {
    const file = new File(Paths.document, WIDGET_STATE_FILE);
    if (!file.exists) file.create();
    await file.write(text);
  },
  async read() {
    const file = new File(Paths.document, WIDGET_STATE_FILE);
    if (!file.exists) return null;
    return file.text();
  },
  refresh: refreshWidgets,
};

/** No-op deps for platforms without widgets (and Jest). */
export const noopFileDeps: WidgetFileDeps = {
  async write() {},
  async read() {
    return null;
  },
  refresh: () => 0,
};

export function defaultFileDeps(): WidgetFileDeps {
  return Platform.OS === 'android' ? androidFileDeps : noopFileDeps;
}

export interface WriteWidgetStateOptions {
  /** Observer to use; default: the self profile's place or the device fix per Settings -> Location. */
  observer?: Observer;
  lang?: Lang;
  nowMs?: number;
  deps?: WidgetFileDeps;
  /** Skip the 10-minute same-key debounce (background task, dev route). */
  force?: boolean;
}

export interface WriteWidgetStateResult {
  written: boolean;
  /** Why nothing was written ('unsupported' = not Android and no deps injected). */
  skipped?: 'unsupported' | 'no-db' | 'no-profile' | 'unchanged' | 'error';
  file?: WidgetStateFile;
  widgetsRefreshed: number;
}

/** Observer for the widgets: the Today observer rules (city = self profile's place; gps = device fix, place as fallback). */
export async function widgetObserver(self = getSelfProfile()): Promise<Observer | null> {
  if (!self) return null;
  if (getSetting('locationMode') === 'gps') {
    const fix = await getDeviceFix();
    if (fix) return { lat: fix.lat, lon: fix.lon, tz: fix.tz, placeName: null, source: 'gps' };
  }
  return observerFromProfile(self);
}

let lastKey: { key: string; at: number } | null = null;
const DEBOUNCE_MS = 10 * 60_000;

/** For tests: forget the last written key. */
export function resetWriteDebounce(): void {
  lastKey = null;
}

/** Computes and writes the state file; never throws. */
export async function writeWidgetState(opts: WriteWidgetStateOptions = {}): Promise<WriteWidgetStateResult> {
  if (!opts.deps && Platform.OS !== 'android') return { written: false, skipped: 'unsupported', widgetsRefreshed: 0 };
  const deps = opts.deps ?? defaultFileDeps();
  if (!hasDb()) return { written: false, skipped: 'no-db', widgetsRefreshed: 0 };
  const self = getSelfProfile();
  if (!self) return { written: false, skipped: 'no-profile', widgetsRefreshed: 0 };
  try {
    const observer = opts.observer ?? (await widgetObserver(self));
    if (!observer) return { written: false, skipped: 'no-profile', widgetsRefreshed: 0 };
    const lang = opts.lang ?? getSetting('language');
    const nowMs = opts.nowMs ?? Date.now();
    const chart = chartFor(self);
    const key = `${observer.lat.toFixed(3)}|${observer.lon.toFixed(3)}|${observer.tz}|${lang}|${self.id}`;
    if (!opts.force && lastKey && lastKey.key === key && nowMs - lastKey.at < DEBOUNCE_MS) return { written: false, skipped: 'unchanged', widgetsRefreshed: 0 };
    const file = buildWidgetState({ observer, lang, theme: getSetting('theme'), nowMs, t: makeT(lang), ayanamsa: chart.meta.ayanamsa, self: { profile: self, chart } });
    await deps.write(JSON.stringify(file));
    lastKey = { key, at: nowMs };
    const widgetsRefreshed = deps.refresh();
    return { written: true, file, widgetsRefreshed };
  } catch (e) {
    if (__DEV__) console.warn('widget state write failed', e);
    return { written: false, skipped: 'error', widgetsRefreshed: 0 };
  }
}

/** The current file, parsed; null when absent, unparsable or of another version. */
export async function readWidgetState(deps: WidgetFileDeps = defaultFileDeps()): Promise<WidgetStateFile | null> {
  try {
    const text = await deps.read();
    if (!text) return null;
    const parsed = JSON.parse(text) as Partial<WidgetStateFile>;
    if (parsed.version !== 1 || !Array.isArray(parsed.days)) return null;
    return parsed as WidgetStateFile;
  } catch {
    return null;
  }
}
