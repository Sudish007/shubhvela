package com.shubhvela.app.widgets

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import java.util.concurrent.TimeUnit

/**
 * Refresh paths (plan P4; design.md 10.2 F9): WorkManager periodic job every 15 min (platform minimum) redraws from the
 * file; AlarmManager.setWindow (inexact, 2 min window, no permission) at the next span boundary; setExactAndAllowWhileIdle
 * ONLY when the user granted SCHEDULE_EXACT_ALARM from Settings -> Notifications -> "Exact widget updates"; the provider's
 * updatePeriodMillis=1800000 is the system baseline. No foreground service, no battery-optimisation exemption. Doze
 * deferral is accepted (the > 36 h footer covers it). Note: Android 12+ may stretch a setWindow of 2 min to 10 min.
 */
object WidgetScheduler {
  const val PERIODIC_WORK = "shubhvela-widget-refresh"
  const val EXTEND_WORK = "shubhvela-extend-widget-state"
  const val PERIOD_MINUTES = 15L
  const val BOUNDARY_WINDOW_MS = 2L * 60_000L
  const val ACTION_BOUNDARY = "com.shubhvela.app.widgets.BOUNDARY"
  /** Do not ask the JS job to extend more often than this (it also runs on its own 12 h schedule). */
  const val EXTEND_DEBOUNCE_MS = 6L * 3_600_000L
  private const val PREFS = "shubhvela_widgets"
  private const val KEY_LAST_EXTEND = "lastExtendRequest"

  fun ensurePeriodic(context: Context) {
    val request = PeriodicWorkRequestBuilder<WidgetRefreshWorker>(PERIOD_MINUTES, TimeUnit.MINUTES).build()
    WorkManager.getInstance(context).enqueueUniquePeriodicWork(PERIODIC_WORK, ExistingPeriodicWorkPolicy.KEEP, request)
  }

  fun cancelAll(context: Context) {
    WorkManager.getInstance(context).cancelUniqueWork(PERIODIC_WORK)
    alarmManager(context).cancel(boundaryIntent(context))
  }

  private fun alarmManager(context: Context): AlarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

  private fun boundaryIntent(context: Context): PendingIntent {
    val intent = Intent(context, BoundaryAlarmReceiver::class.java).setAction(ACTION_BOUNDARY)
    return PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  /** True only when the user granted the special access (API 31+); below 31 the permission does not exist and inexact is used. */
  fun exactAllowed(context: Context): Boolean =
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && alarmManager(context).canScheduleExactAlarms()

  /** (Re)schedules the one boundary alarm from the file's next span boundary after `nowMs`; cancels it when nothing follows. */
  fun scheduleBoundary(context: Context, state: WidgetState?, nowMs: Long) {
    val am = alarmManager(context)
    val pi = boundaryIntent(context)
    am.cancel(pi)
    if (!WidgetUpdater.hasAnyWidget(context)) return
    val at = state?.nextBoundaryAfter(nowMs) ?: return
    // A second of slack so the redraw sees the new span.
    val trigger = at + 1_000L
    try {
      if (exactAllowed(context)) {
        am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pi)
      } else {
        am.setWindow(AlarmManager.RTC_WAKEUP, trigger, BOUNDARY_WINDOW_MS, pi)
      }
    } catch (e: SecurityException) {
      // Permission revoked between the check and the call: fall back to the inexact window.
      am.setWindow(AlarmManager.RTC_WAKEUP, trigger, BOUNDARY_WINDOW_MS, pi)
    }
    // When the file is running out, ask the registered expo-background-task job to extend it (debounced).
    if (state != null && daysRemaining(state, nowMs) < 2) requestExtension(context, nowMs)
  }

  fun daysRemaining(state: WidgetState, nowMs: Long): Int = state.days.count { it.nextSunrise > nowMs }

  /**
   * Starts the registered `extend-widget-state` job now by enqueuing expo-background-task's own worker class once (unique
   * name of our own, KEEP). The job runs headless JS: it rewrites the file and re-plans reminders (N12). The worker
   * reads the app scope key from its input data exactly as expo-background-task's scheduler provides it.
   */
  fun requestExtension(context: Context, nowMs: Long) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val last = prefs.getLong(KEY_LAST_EXTEND, 0L)
    if (nowMs - last < EXTEND_DEBOUNCE_MS) return
    prefs.edit().putLong(KEY_LAST_EXTEND, nowMs).apply()
    try {
      val request = OneTimeWorkRequestBuilder<expo.modules.backgroundtask.BackgroundTaskWork>()
        .setInputData(workDataOf("appScopeKey" to context.packageName))
        .build()
      WorkManager.getInstance(context).enqueueUniqueWork(EXTEND_WORK, ExistingWorkPolicy.KEEP, request)
    } catch (e: Exception) {
      Log.w(WidgetUpdater.TAG, "could not enqueue extend-widget-state: ${e.message}")
    }
  }
}
