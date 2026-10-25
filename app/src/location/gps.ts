// Coarse device location for Today (spec F5: "GPS or chosen city"; design.md 10.2: GPS permission optional, chosen
// city fallback). Asked for only when Settings -> Location is 'Use my location'; a denial or any failure returns
// null and the caller falls back to the self profile's place. Nothing leaves the phone: the fix is turned into a
// zone id locally with tz-lookup -> engine canonicalZone.
import { canonicalZone } from '@shubhvela/engine';
import * as Location from 'expo-location';
import tzLookup from 'tz-lookup';

export interface DeviceFix {
  lat: number;
  lon: number;
  /** Canonical IANA zone id of the fix. */
  tz: string;
}

/** Zone for coordinates, or null when tz-lookup / the engine table has no zone (open ocean, bad fix). */
export function zoneForCoordinates(lat: number, lon: number): string | null {
  try {
    return canonicalZone(tzLookup(lat, lon)) ?? null;
  } catch {
    return null;
  }
}

export interface GpsDeps {
  requestPermission: () => Promise<{ granted: boolean }>;
  lastKnown: () => Promise<{ coords: { latitude: number; longitude: number } } | null>;
  current: () => Promise<{ coords: { latitude: number; longitude: number } }>;
}

const realDeps: GpsDeps = {
  requestPermission: () => Location.requestForegroundPermissionsAsync(),
  lastKnown: () => Location.getLastKnownPositionAsync({ maxAge: 30 * 60_000 }),
  current: () => Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
};

/** Coarse fix (last known within 30 min, else a low-accuracy request). Null = denied, unavailable or no zone. */
export async function getDeviceFix(deps: GpsDeps = realDeps): Promise<DeviceFix | null> {
  try {
    const perm = await deps.requestPermission();
    if (!perm.granted) return null;
    const pos = (await deps.lastKnown()) ?? (await deps.current());
    const { latitude: lat, longitude: lon } = pos.coords;
    const tz = zoneForCoordinates(lat, lon);
    if (!tz) return null;
    return { lat, lon, tz };
  } catch (e) {
    if (__DEV__) console.warn('location unavailable', e);
    return null;
  }
}
