// "Try it on your chart" arrival params (F32; the C02 contract in packages/content/src/lessons.ts): a lesson's tryIt route
// may carry `?card=planets|houses|sadesati|yogas` (Charts scrolls to that card) or `?sheet=panchang` (Today opens the
// panchang sheet). The screen reads the value once, acts, and calls consume(), which clears the param on the route so a
// later plain visit of the tab does not repeat the scroll or re-open the sheet. Unknown values are ignored.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';

/** Cards a lesson may point at on the Charts tab (the anchors in app/(tabs)/charts.tsx). */
export const TRY_IT_CARDS = ['planets', 'houses', 'sadesati', 'yogas'] as const;
export type TryItCard = (typeof TRY_IT_CARDS)[number];

/** Sheets a lesson may open on Today. */
export const TRY_IT_SHEETS = ['panchang'] as const;
export type TryItSheet = (typeof TRY_IT_SHEETS)[number];

export interface ArrivalParam<T extends string> {
  /** The validated value, or null when absent or unknown. */
  value: T | null;
  /** Clears the param on the current route once the screen has acted on it. */
  consume: () => void;
}

export function useArrivalParam<T extends string>(key: string, allowed: readonly T[], override?: T): ArrivalParam<T> {
  const params = useLocalSearchParams<Record<string, string | undefined>>();
  const router = useRouter();
  const raw = override ?? params[key];
  const value = raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : null;
  const consume = useCallback(() => {
    if (value) router.setParams({ [key]: undefined });
  }, [key, router, value]);
  return { value, consume };
}
