// POST_NOTIFICATIONS permission (design.md 10.4 F25 / 11): the switch that would enable a series asks first; when the
// OS has denied for good the switch stays Off and the screen shows the inline "Allow notifications in Android settings"
// row that opens the system settings. Nothing is scheduled without a granted permission.
import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unknown';

function toState(p: { granted: boolean; canAskAgain?: boolean }): PermissionState {
  return p.granted ? 'granted' : p.canAskAgain === false ? 'denied' : 'undetermined';
}

export async function getPermissionState(): Promise<PermissionState> {
  try {
    return toState(await Notifications.getPermissionsAsync());
  } catch {
    return 'unknown';
  }
}

/** Asks when still possible; a permanent denial is reported, never re-prompted. */
export async function requestPermission(): Promise<PermissionState> {
  try {
    const current = toState(await Notifications.getPermissionsAsync());
    if (current === 'granted' || current === 'denied') return current;
    return toState(await Notifications.requestPermissionsAsync());
  } catch {
    return 'unknown';
  }
}

export function openSystemNotificationSettings(): void {
  Linking.openSettings().catch(() => {});
}
