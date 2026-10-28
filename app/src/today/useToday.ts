// useToday (plan A10): decides WHEN the Today model is (re)computed. Observer = the self profile's place, or the
// coarse device fix when Settings -> Location is 'Use my location' (permission optional; denial falls back to the
// place and says so). Re-renders every 60 s (now-marker), recomputes at the next sunrise (new Vedic day), on return
// to the foreground, on focus (settings may have changed) and when the observer or the profile changes. The language
// does not enter the model: components format in the UI language at render time. Every successful compute also hands
// its observer to the widget state writer (C01, F9) so the home-screen widgets show the same place as Today.
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { Profile } from '../db/profiles';
import { getSetting, type LocationMode } from '../db/settings';
import { hasDb } from '../db/connection';
import { enabledVratFamilies } from '../db/eventSeries';
import { getDeviceFix, type DeviceFix } from '../location/gps';
import { writeWidgetState } from '../widgets/writeState';
import { computeToday, nextBoundaryAfter, observerFromProfile, type Observer, type TodayModel } from './model';

export interface TodayState {
  model: TodayModel | null;
  nowMs: number;
  /** True until the first model exists. */
  loading: boolean;
  /** The engine threw for this profile (design.md 11: "Couldn't compute this chart"). */
  error: boolean;
  /** 'gps' was chosen but no fix was available: the profile's place is used instead. */
  locationFallback: boolean;
}

export interface UseTodayOptions {
  /** Clock (tests). */
  now?: () => number;
  /** Device-fix provider (tests). */
  fix?: () => Promise<DeviceFix | null>;
  /** F37: a city observer from a shubhvela://panchang/<city> link replaces the place/GPS rule while set. */
  observerOverride?: Observer | null;
}

const MINUTE = 60_000;

function readMode(): LocationMode {
  try {
    return hasDb() ? getSetting('locationMode') : 'city';
  } catch {
    return 'city';
  }
}

type FixState = { status: 'idle' } | { status: 'resolved'; fix: DeviceFix | null };
type Computed = { model: TodayModel | null; error: boolean; key: string };

export function useToday(self: Profile | null, profiles: readonly Profile[], opts: UseTodayOptions = {}): TodayState {
  const now = opts.now ?? Date.now;
  const fix = opts.fix ?? getDeviceFix;
  const [mode, setMode] = useState<LocationMode>(readMode);
  const [fixState, setFixState] = useState<FixState>({ status: 'idle' });
  const [computed, setComputed] = useState<Computed | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => now());
  const [tick, setTick] = useState(0);
  const modelRef = useRef<TodayModel | null>(null);

  // Settings may change while Today is in the background stack: re-read on every focus.
  useFocusEffect(
    useCallback(() => {
      setMode(readMode());
      setTick((n) => n + 1);
    }, []),
  );

  // Device fix (optional permission), only in 'gps' mode; resolved asynchronously, the place is used meanwhile.
  useEffect(() => {
    if (!self || mode !== 'gps') return;
    let alive = true;
    fix()
      .then((f) => alive && setFixState({ status: 'resolved', fix: f }))
      .catch(() => alive && setFixState({ status: 'resolved', fix: null }));
    return () => {
      alive = false;
    };
  }, [self, mode, fix, tick]);

  const override = opts.observerOverride ?? null;
  const observer = useMemo<Observer | null>(() => {
    if (!self) return null;
    if (override) return override;
    if (mode === 'gps' && fixState.status === 'resolved' && fixState.fix) {
      const f = fixState.fix;
      return { lat: f.lat, lon: f.lon, tz: f.tz, placeName: null, source: 'gps' };
    }
    return observerFromProfile(self);
  }, [self, mode, fixState, override]);
  const locationFallback = !override && mode === 'gps' && fixState.status === 'resolved' && fixState.fix === null;

  // Model: computed after the first paint (skeleton), recomputed when observer / profile / focus / day change.
  const key = self && observer ? `${self.id}|${observer.lat}|${observer.lon}|${observer.tz}|${tick}|${profiles.length}` : '';
  useEffect(() => {
    if (!self || !observer) return;
    const id = setTimeout(() => {
      try {
        const m = computeToday(self, observer, now(), { profiles, vratFamilies: hasDb() ? enabledVratFamilies() : [] });
        modelRef.current = m;
        setComputed({ model: m, error: false, key });
        // F9 data contract: the widgets follow Today's observer (chosen city or device fix); debounced inside, Android only.
        void writeWidgetState({ observer: m.observer, nowMs: m.nowMs });
      } catch (e) {
        if (__DEV__) console.warn('today failed', e);
        modelRef.current = null;
        setComputed({ model: null, error: true, key });
      }
    }, 0);
    return () => clearTimeout(id);
  }, [self, observer, profiles, key, now]);
  const current = self && observer && computed ? computed : null;
  const model = current?.model ?? null;

  // Minute tick for the now-marker and the Now line; recompute when the Vedic day rolls over.
  useEffect(() => {
    const id = setInterval(() => {
      const n = now();
      setNowMs(n);
      const m = modelRef.current;
      if (m && m.goodHours.ticks && n >= m.goodHours.ticks.nextSunrise) setTick((k) => k + 1);
    }, MINUTE);
    return () => clearInterval(id);
  }, [now]);

  // Exact re-render at the next span boundary (the minute tick alone could be up to 59 s late).
  useEffect(() => {
    if (!model) return;
    const n = now();
    const next = nextBoundaryAfter(model.goodHours, n);
    if (next === null) return;
    const id = setTimeout(() => {
      const at = now();
      setNowMs(at);
      if (model.goodHours.ticks && at >= model.goodHours.ticks.nextSunrise) setTick((k) => k + 1);
    }, Math.max(0, next - n) + 250);
    return () => clearTimeout(id);
  }, [model, nowMs, now]);

  // Returning to the foreground after a long pause: refresh the clock and the day.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const n = now();
      setNowMs(n);
      const m = modelRef.current;
      if (!m || (m.goodHours.ticks && n >= m.goodHours.ticks.nextSunrise)) setTick((k) => k + 1);
    });
    return () => sub.remove();
  }, [now]);

  return { model, nowMs, loading: !!self && !!observer && !current, error: !!current?.error, locationFallback };
}
