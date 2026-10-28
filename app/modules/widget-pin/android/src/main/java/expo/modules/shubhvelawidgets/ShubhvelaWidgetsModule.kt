package expo.modules.shubhvelawidgets

import android.app.AlarmManager
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Bridge for Settings -> Notifications (C01, F9): "Add widget to home screen" (requestPinAppWidget) and "Exact widget
 * updates" (SCHEDULE_EXACT_ALARM state + the system page that grants it), plus refreshWidgets() which the app calls after it
 * has written files/widget_state.json so the placed widgets redraw at once. The providers are addressed by component name:
 * this library is compiled before the app module and must not depend on it.
 */
class ShubhvelaWidgetsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private fun provider(kind: String): ComponentName {
    val cls = if (kind == "medium") MEDIUM_PROVIDER else SMALL_PROVIDER
    return ComponentName(context.packageName, cls)
  }

  private fun allIds(manager: AppWidgetManager): Map<ComponentName, IntArray> =
    listOf(provider("small"), provider("medium")).associateWith { manager.getAppWidgetIds(it) }

  override fun definition() = ModuleDefinition {
    Name("ShubhvelaWidgets")

    Function("refreshWidgets") {
      val manager = AppWidgetManager.getInstance(context)
      var count = 0
      for ((component, ids) in allIds(manager)) {
        if (ids.isEmpty()) continue
        count += ids.size
        val intent = Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE)
          .setComponent(component)
          .putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
        context.sendBroadcast(intent)
      }
      count
    }

    Function("widgetCount") {
      val manager = AppWidgetManager.getInstance(context)
      allIds(manager).values.sumOf { it.size }
    }

    Function("isPinSupported") {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && AppWidgetManager.getInstance(context).isRequestPinAppWidgetSupported
    }

    Function("requestPin") { kind: String ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return@Function false
      val manager = AppWidgetManager.getInstance(context)
      if (!manager.isRequestPinAppWidgetSupported) return@Function false
      try {
        manager.requestPinAppWidget(provider(kind), null, null)
      } catch (e: Exception) {
        false
      }
    }

    Function("exactAlarmState") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return@Function "not-applicable"
      val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      if (am.canScheduleExactAlarms()) "granted" else "denied"
    }

    Function("openExactAlarmSettings") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return@Function false
      try {
        val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
          .setData(Uri.parse("package:" + context.packageName))
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
        true
      } catch (e: Exception) {
        false
      }
    }
  }

  companion object {
    const val SMALL_PROVIDER = "com.shubhvela.app.widgets.SmallWidgetProvider"
    const val MEDIUM_PROVIDER = "com.shubhvela.app.widgets.MediumWidgetProvider"
  }
}
