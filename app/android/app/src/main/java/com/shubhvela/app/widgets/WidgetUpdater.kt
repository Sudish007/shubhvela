package com.shubhvela.app.widgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews
import com.shubhvela.app.MainActivity
import com.shubhvela.app.R
import java.io.File

/**
 * Builds the RemoteViews of both widgets from files/widget_state.json and pushes them to every placed instance
 * (design.md 10.2 F9). States: fresh (band / verdict + Now line), stale (> 36 h: same content plus the footer "Open
 * Shubhvela to refresh"), exhausted (no day covers now: the last known day, its date, the footer) and missing (no file
 * yet: the one-line setup text). No ads, no fake numbers: every value is read from the file the engine produced.
 */
object WidgetUpdater {
  const val TAG = "ShubhvelaWidget"

  fun stateFile(context: Context): File = File(context.filesDir, WidgetState.FILE_NAME)

  fun readState(context: Context): WidgetState? = WidgetState.read(stateFile(context))

  private fun ids(context: Context, manager: AppWidgetManager, cls: Class<*>): IntArray = manager.getAppWidgetIds(ComponentName(context, cls))

  fun hasAnyWidget(context: Context): Boolean {
    val manager = AppWidgetManager.getInstance(context)
    return ids(context, manager, SmallWidgetProvider::class.java).isNotEmpty() || ids(context, manager, MediumWidgetProvider::class.java).isNotEmpty()
  }

  /** Redraws every instance of both widgets and schedules the next boundary alarm. Called by providers, worker, alarm, boot. */
  fun updateAll(context: Context, nowMs: Long = System.currentTimeMillis()) {
    val manager = AppWidgetManager.getInstance(context)
    val state = readState(context)
    for (id in ids(context, manager, SmallWidgetProvider::class.java)) {
      manager.updateAppWidget(id, buildSmall(context, state, nowMs))
    }
    for (id in ids(context, manager, MediumWidgetProvider::class.java)) {
      manager.updateAppWidget(id, buildMedium(context, state, nowMs, manager.getAppWidgetOptions(id)))
    }
    WidgetScheduler.scheduleBoundary(context, state, nowMs)
  }

  private fun launchIntent(context: Context, requestCode: Int): PendingIntent {
    val intent = Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    return PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  /** The current segment's name: the deciding reasons of the span, else the choghadiya covering now. */
  fun currentSegmentName(day: WidgetDay, span: WidgetSpan, nowMs: Long): String {
    if (span.reasons.isNotEmpty()) return span.reasons.joinToString(" \u00b7 ") { it.name }
    return day.choghadiyaAt(nowMs)?.name ?: ""
  }

  /** "next: <segment> <time>" for the span after the current one; the segment is the one that starts there (cause of the verdict). */
  fun nextLine(state: WidgetState, day: WidgetDay, span: WidgetSpan): String? {
    val next = day.spanAfter(span) ?: return null
    val starting = day.segments.filter { it.start == next.start }
    val cause = starting.firstOrNull { it.verdict == next.verdict } ?: starting.firstOrNull()
    val name = cause?.name ?: next.reasons.firstOrNull()?.name ?: state.strings.verdictWord(next.verdict)
    return state.strings.nextLine(name, day.formatTime(next.start))
  }

  /** "Now 10:58 · Neutral · Chal · Mercury · next: Abhijit 11:42" (the app's Now line without the hora word, which the file does not carry per language). */
  fun nowLine(state: WidgetState, day: WidgetDay, span: WidgetSpan, nowMs: Long): String {
    val parts = ArrayList<String>()
    parts.add("${state.strings.now} ${day.formatTime(nowMs)}")
    parts.add(state.strings.verdictWord(span.verdict))
    day.choghadiyaAt(nowMs)?.let { parts.add(it.name) }
    day.horaAt(nowMs)?.let { parts.add(it.name) }
    nextLine(state, day, span)?.let { parts.add(it) }
    return parts.joinToString(" \u00b7 ")
  }

  fun buildSmall(context: Context, state: WidgetState?, nowMs: Long): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.widget_small)
    views.setOnClickPendingIntent(R.id.widget_root, launchIntent(context, 1))
    val resolved = state?.resolve(nowMs)
    if (state == null || resolved == null) {
      views.setViewVisibility(R.id.widget_verdict_row, View.GONE)
      views.setViewVisibility(R.id.widget_segment, View.GONE)
      views.setTextViewText(R.id.widget_footer, context.getString(R.string.widget_no_state))
      views.setViewVisibility(R.id.widget_footer, View.VISIBLE)
      return views
    }
    val span = resolved.span
    if (span != null) {
      views.setViewVisibility(R.id.widget_verdict_row, View.VISIBLE)
      views.setImageViewBitmap(R.id.widget_swatch, BandRenderer.swatch(context, span))
      views.setTextViewText(R.id.widget_verdict, span.label)
      val segment = currentSegmentName(resolved.day, span, nowMs)
      val next = nextLine(state, resolved.day, span)
      val line = listOfNotNull(segment.ifBlank { null }, next).joinToString(" \u00b7 ")
      views.setTextViewText(R.id.widget_segment, line)
      views.setViewVisibility(R.id.widget_segment, if (line.isBlank()) View.GONE else View.VISIBLE)
    } else {
      // Exhausted: no verdict can be claimed for now; name the last known day instead.
      views.setViewVisibility(R.id.widget_verdict_row, View.GONE)
      views.setTextViewText(R.id.widget_segment, state.strings.lastKnownLine(resolved.day.dateText))
      views.setViewVisibility(R.id.widget_segment, View.VISIBLE)
    }
    if (resolved.showFooter) {
      views.setTextViewText(R.id.widget_footer, state.strings.stale)
      views.setViewVisibility(R.id.widget_footer, View.VISIBLE)
    } else {
      views.setViewVisibility(R.id.widget_footer, View.GONE)
    }
    return views
  }

  /** Usable band width in dp from the host's options (portrait: min width), minus the layout padding; 250 dp when unknown. */
  fun bandWidthDp(options: Bundle?, paddingDp: Int = 12): Int {
    val min = options?.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0) ?: 0
    val w = if (min > 0) min else 250
    return (w - 2 * paddingDp).coerceIn(120, 800)
  }

  fun buildMedium(context: Context, state: WidgetState?, nowMs: Long, options: Bundle?): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.widget_medium)
    views.setOnClickPendingIntent(R.id.widget_root, launchIntent(context, 2))
    val resolved = state?.resolve(nowMs)
    if (state == null || resolved == null) {
      views.setViewVisibility(R.id.widget_band, View.GONE)
      views.setViewVisibility(R.id.widget_now, View.GONE)
      views.setViewVisibility(R.id.widget_next_event, View.GONE)
      views.setTextViewText(R.id.widget_footer, context.getString(R.string.widget_no_state))
      views.setViewVisibility(R.id.widget_footer, View.VISIBLE)
      return views
    }
    val fontScale = context.resources.configuration.fontScale
    val day = resolved.day
    views.setViewVisibility(R.id.widget_band, View.VISIBLE)
    views.setImageViewBitmap(R.id.widget_band, BandRenderer.render(context, day, nowMs, bandWidthDp(options), fontScale))
    val span = resolved.span
    if (span != null) {
      views.setTextViewText(R.id.widget_now, nowLine(state, day, span, nowMs))
    } else {
      views.setTextViewText(R.id.widget_now, state.strings.lastKnownLine(day.dateText))
    }
    views.setViewVisibility(R.id.widget_now, View.VISIBLE)
    if (resolved.showFooter) {
      views.setTextViewText(R.id.widget_footer, state.strings.stale)
      views.setViewVisibility(R.id.widget_footer, View.VISIBLE)
      views.setViewVisibility(R.id.widget_next_event, View.GONE)
    } else {
      views.setViewVisibility(R.id.widget_footer, View.GONE)
      val event = state.nextEvent ?: state.strings.noUpcoming
      views.setTextViewText(R.id.widget_next_event, event)
      views.setViewVisibility(R.id.widget_next_event, if (event.isBlank()) View.GONE else View.VISIBLE)
    }
    return views
  }
}
