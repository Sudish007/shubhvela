package com.shubhvela.app.widgets

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Fires at the next span boundary (AlarmManager.setWindow, or setExactAndAllowWhileIdle after the opt-in): redraws the
 * widgets, which schedules the following boundary. The alarm holds a wake lock only while onReceive runs (a few ms).
 */
class BoundaryAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != WidgetScheduler.ACTION_BOUNDARY) return
    WidgetUpdater.updateAll(context)
  }
}
