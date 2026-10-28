// Device gate for "Ask my chart" (spec F35, design.md 10.7, plan C04): Android 12+ (API 31), >= 6 GB RAM, >= 4 GB free
// storage. The decision is a pure function of three facts so the matrix is unit-tested; readDeviceFacts() gathers them
// from Platform.Version, expo-device totalMemory and expo-file-system Paths.availableDiskSpace (all synchronous).
// Unsupported phones get the honest row text and the gate screen; there is NO cloud fallback anywhere (D10/D11).
import { Paths } from 'expo-file-system';
import { Platform } from 'react-native';

export const MIN_API_LEVEL = 31;
const GIB = 1024 ** 3;
/**
 * A phone sold as "6 GB" reports less to apps because the kernel, the modem and the GPU reserve memory before Android
 * counts it (totalMemory on 6 GB devices lands around 5.5-5.8 GiB). The gate therefore accepts a reported total that
 * ROUNDS to 6 GiB or more; 5 GB phones (<= 5 GiB reported) fail. The row prints the rounded figure the user knows.
 */
export const MIN_RAM_BYTES = 5.5 * GIB;
export const MIN_FREE_BYTES = 4 * GIB;

export interface DeviceFacts {
  /** Android API level (Platform.Version); null off Android. */
  apiLevel: number | null;
  /** Android release string for the row ("12", "14"); null when unknown. */
  osVersion: string | null;
  /** Total memory in bytes as reported to the app; null when unknown. */
  totalMemory: number | null;
  /** Free bytes on the app's storage volume; null when unknown. */
  freeBytes: number | null;
}

export type GateReasonKey = 'android' | 'ram' | 'storage';

export interface GateReason {
  key: GateReasonKey;
  ok: boolean;
  /** Display value: Android release, rounded GiB of RAM, free GiB to one decimal. */
  value: string;
}

export interface DeviceGate {
  supported: boolean;
  reasons: GateReason[];
  /** The failing keys, in the order the row text names them. */
  failing: GateReasonKey[];
}

/** Rounded gibibytes ("6" for 5.7 GiB). */
export function ramGbLabel(bytes: number | null): string {
  return bytes === null ? '?' : String(Math.round(bytes / GIB));
}

/** Free space in gibibytes to one decimal ("3.2"). */
export function freeGbLabel(bytes: number | null): string {
  return bytes === null ? '?' : (bytes / GIB).toFixed(1);
}

/** Pure decision: every unknown fact fails its check (an unknown phone is never told it is supported). */
export function evaluateDeviceGate(f: DeviceFacts): DeviceGate {
  const android = f.apiLevel !== null && f.apiLevel >= MIN_API_LEVEL;
  const ram = f.totalMemory !== null && f.totalMemory >= MIN_RAM_BYTES;
  const storage = f.freeBytes !== null && f.freeBytes >= MIN_FREE_BYTES;
  const reasons: GateReason[] = [
    { key: 'android', ok: android, value: f.osVersion ?? (f.apiLevel === null ? '?' : `API ${f.apiLevel}`) },
    { key: 'ram', ok: ram, value: ramGbLabel(f.totalMemory) },
    { key: 'storage', ok: storage, value: freeGbLabel(f.freeBytes) },
  ];
  return { supported: android && ram && storage, reasons, failing: reasons.filter((r) => !r.ok).map((r) => r.key) };
}

/** Gathers the three facts from the platform (synchronous getters; failures read as unknown -> unsupported). */
export function readDeviceFacts(): DeviceFacts {
  let apiLevel: number | null = null;
  let osVersion: string | null = null;
  let totalMemory: number | null = null;
  let freeBytes: number | null = null;
  if (Platform.OS === 'android') {
    const v = Platform.Version;
    apiLevel = typeof v === 'number' ? v : Number.parseInt(String(v), 10) || null;
  }
  try {
    // Lazy so the module loads under Jest without the native module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Device = require('expo-device') as { totalMemory: number | null; osVersion: string | null };
    totalMemory = typeof Device.totalMemory === 'number' ? Device.totalMemory : null;
    osVersion = Device.osVersion ?? null;
  } catch {
    totalMemory = null;
  }
  try {
    const free = Paths.availableDiskSpace;
    freeBytes = Number.isFinite(free) ? free : null;
  } catch {
    freeBytes = null;
  }
  return { apiLevel, osVersion, totalMemory, freeBytes };
}

export function deviceGate(): DeviceGate {
  return evaluateDeviceGate(readDeviceFacts());
}
