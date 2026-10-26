// Profile of a pushed Charts screen: `?profile=<id>` (expo-router) or the test override; null when it does not exist.
import { useLocalSearchParams } from 'expo-router';
import { getProfile, type Profile } from '../db/profiles';

export function useRouteProfile(override?: number): Profile | null {
  const params = useLocalSearchParams<{ profile?: string }>();
  const id = override ?? Number(params.profile);
  return Number.isFinite(id) ? getProfile(id) : null;
}

/** `?year=<n>` for the Varshaphal screen, or the test override. */
export function useRouteYear(override?: number): number | null {
  const params = useLocalSearchParams<{ year?: string }>();
  const y = override ?? Number(params.year);
  return Number.isFinite(y) && y > 0 ? y : null;
}

/** `?varga=<id>` for the vargas table, or the test override. */
export function useRouteVarga(override?: string): string | null {
  const params = useLocalSearchParams<{ varga?: string }>();
  return override ?? params.varga ?? null;
}
