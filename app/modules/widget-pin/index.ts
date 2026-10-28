// Local Expo module "ShubhvelaWidgets" (plan C01: app/modules/widget-pin). Android only. The native side lives in
// android/src/main/java/expo/modules/shubhvelawidgets/ShubhvelaWidgetsModule.kt and talks to the app's AppWidgetProviders
// by component name (broadcast ACTION_APPWIDGET_UPDATE / requestPinAppWidget), so this library has no compile-time
// dependency on the app module. Under Jest / iOS / web the module is absent and every function here degrades honestly.
import { requireOptionalNativeModule } from 'expo';

export type WidgetKind = 'small' | 'medium';
export type ExactAlarmState = 'granted' | 'denied' | 'not-applicable';

interface ShubhvelaWidgetsNative {
  /** Broadcasts an update to every placed widget (both providers) so they redraw from files/widget_state.json now. */
  refreshWidgets(): number;
  /** Number of placed widget instances (both sizes). */
  widgetCount(): number;
  /** AppWidgetManager.isRequestPinAppWidgetSupported() (API 26+, launcher-dependent). */
  isPinSupported(): boolean;
  /** AppWidgetManager.requestPinAppWidget(); true when the launcher accepted the request (it then shows its own dialog). */
  requestPin(kind: WidgetKind): boolean;
  /** SCHEDULE_EXACT_ALARM state: 'not-applicable' below Android 12 (no permission exists there). */
  exactAlarmState(): ExactAlarmState;
  /** Opens the system "Alarms & reminders" page for this app (ACTION_REQUEST_SCHEDULE_EXACT_ALARM); false when unavailable. */
  openExactAlarmSettings(): boolean;
}

const native = requireOptionalNativeModule<ShubhvelaWidgetsNative>('ShubhvelaWidgets');

export const isWidgetModuleAvailable = native !== null;

export function refreshWidgets(): number {
  return native?.refreshWidgets() ?? 0;
}

export function widgetCount(): number {
  return native?.widgetCount() ?? 0;
}

export function isPinSupported(): boolean {
  return native?.isPinSupported() ?? false;
}

export function requestPin(kind: WidgetKind): boolean {
  return native?.requestPin(kind) ?? false;
}

export function exactAlarmState(): ExactAlarmState {
  return native?.exactAlarmState() ?? 'not-applicable';
}

export function openExactAlarmSettings(): boolean {
  return native?.openExactAlarmSettings() ?? false;
}
