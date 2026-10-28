package com.shubhvela.app.widgets

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * BOOT_COMPLETED (and the app's own update): alarms do not survive a reboot, WorkManager's periodic work does. Re-arm the
 * boundary alarm and make sure the periodic job exists, but only when at least one widget is placed.
 */
class WidgetBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action ?: return
    if (action != Intent.ACTION_BOOT_COMPLETED && action != Intent.ACTION_MY_PACKAGE_REPLACED && action != "android.intent.action.QUICKBOOT_POWERON") return
    if (!WidgetUpdater.hasAnyWidget(context)) return
    WidgetScheduler.ensurePeriodic(context)
    WidgetUpdater.updateAll(context)
  }
}
