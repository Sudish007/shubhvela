package com.shubhvela.app.widgets

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context

/**
 * 2x1 widget (design.md 10.2 F9): the current verdict word with its pattern swatch, the current segment name and
 * "next: <segment> <time>"; the footer "Open Shubhvela to refresh" when the state file is stale or exhausted. Tap opens
 * the app. Text >= 12 sp (res/layout/widget_small.xml), no ads.
 */
class SmallWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    val now = System.currentTimeMillis()
    val state = WidgetUpdater.readState(context)
    for (id in appWidgetIds) appWidgetManager.updateAppWidget(id, WidgetUpdater.buildSmall(context, state, now))
    WidgetScheduler.ensurePeriodic(context)
    WidgetScheduler.scheduleBoundary(context, state, now)
  }

  override fun onEnabled(context: Context) {
    WidgetScheduler.ensurePeriodic(context)
  }

  override fun onDisabled(context: Context) {
    if (!WidgetUpdater.hasAnyWidget(context)) WidgetScheduler.cancelAll(context)
  }
}
