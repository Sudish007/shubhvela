package com.shubhvela.app.widgets

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.os.Bundle

/**
 * 4x2 widget (design.md 10.2 F9): the same merged good-hours band as the app, drawn with Canvas into an ImageView
 * (BandRenderer), the Now line under it and the next family date; footer "Open Shubhvela to refresh" when stale or
 * exhausted. Redrawn on resize (onAppWidgetOptionsChanged) so the band always spans the widget width.
 */
class MediumWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    val now = System.currentTimeMillis()
    val state = WidgetUpdater.readState(context)
    for (id in appWidgetIds) appWidgetManager.updateAppWidget(id, WidgetUpdater.buildMedium(context, state, now, appWidgetManager.getAppWidgetOptions(id)))
    WidgetScheduler.ensurePeriodic(context)
    WidgetScheduler.scheduleBoundary(context, state, now)
  }

  override fun onAppWidgetOptionsChanged(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int, newOptions: Bundle) {
    appWidgetManager.updateAppWidget(appWidgetId, WidgetUpdater.buildMedium(context, WidgetUpdater.readState(context), System.currentTimeMillis(), newOptions))
  }

  override fun onEnabled(context: Context) {
    WidgetScheduler.ensurePeriodic(context)
  }

  override fun onDisabled(context: Context) {
    if (!WidgetUpdater.hasAnyWidget(context)) WidgetScheduler.cancelAll(context)
  }
}
