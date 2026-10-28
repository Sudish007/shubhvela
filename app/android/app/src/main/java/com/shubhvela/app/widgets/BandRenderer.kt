package com.shubhvela.app.widgets

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface
import androidx.core.content.ContextCompat
import com.shubhvela.app.R

/**
 * Pure band maths shared by the medium widget and the JVM unit test (no Android types). Mirrors the engine's bandPosition /
 * labelFor (packages/engine/src/panchang/goodHours.ts) and app/src/today/bandGeometry.ts: daylight = 75 % of the width,
 * night = 25 %, both linear; an inline label needs >= 60 dp x fontScale (N3) and shows the reason names when EVERY
 * deciding reason is that wide inside the span, else the verdict word.
 */
object BandGeometry {
  const val DAY_FRACTION = 0.75
  const val LABEL_MIN_DP = 60.0

  data class SpanRect(val span: WidgetSpan, val x: Double, val w: Double)

  sealed class Label {
    data class Reasons(val names: List<String>) : Label()
    data class Verdict(val word: String) : Label()

    val text: String
      get() = when (this) {
        is Reasons -> names.joinToString(" \u00b7 ")
        is Verdict -> word
      }
  }

  /** 0..1 along the band (clamped). */
  fun position(ms: Long, day: WidgetDay): Double {
    if (ms <= day.sunrise) return 0.0
    if (ms >= day.nextSunrise) return 1.0
    if (ms <= day.sunset) return DAY_FRACTION * (ms - day.sunrise).toDouble() / (day.sunset - day.sunrise).toDouble()
    return DAY_FRACTION + (1 - DAY_FRACTION) * (ms - day.sunset).toDouble() / (day.nextSunrise - day.sunset).toDouble()
  }

  fun spanRects(day: WidgetDay, width: Double): List<SpanRect> = day.spans.map { s ->
    val x0 = position(s.start, day) * width
    val x1 = position(s.end, day) * width
    SpanRect(s, x0, maxOf(0.0, x1 - x0))
  }

  fun markerX(ms: Long, day: WidgetDay, width: Double): Double = position(ms, day) * width

  /** Width in dp of a window clipped to the band. */
  fun widthDp(start: Long, end: Long, day: WidgetDay, bandWidthDp: Double): Double = (position(end, day) - position(start, day)) * bandWidthDp

  /** N3 label decision for one merged span; null when it is narrower than 60 dp x fontScale. */
  fun labelFor(span: WidgetSpan, day: WidgetDay, bandWidthDp: Double, fontScale: Double = 1.0): Label? {
    val threshold = LABEL_MIN_DP * fontScale
    if (widthDp(span.start, span.end, day, bandWidthDp) < threshold) return null
    if (span.reasons.isNotEmpty()) {
      val allWide = span.reasons.all { r -> widthDp(maxOf(r.start, span.start), minOf(r.end, span.end), day, bandWidthDp) >= threshold }
      if (allWide) return Label.Reasons(span.reasons.map { it.name })
    }
    return Label.Verdict(span.label)
  }

  /** Tick labels (sunrise, local noon = daylight midpoint, sunset, next sunrise) with x positions and alignment. */
  data class Tick(val x: Double, val text: String, val align: Align)
  enum class Align { LEFT, CENTER, RIGHT }

  fun ticks(day: WidgetDay, width: Double): List<Tick> {
    val noon = day.sunrise + (day.sunset - day.sunrise) / 2
    return listOf(
      Tick(0.0, day.formatTime(day.sunrise), Align.LEFT),
      Tick(markerX(noon, day, width), day.formatTime(noon), Align.CENTER),
      Tick(markerX(day.sunset, day, width), day.formatTime(day.sunset), Align.CENTER),
      Tick(width, day.formatTime(day.nextSunrise), Align.RIGHT),
    )
  }
}

/**
 * Canvas renderer (design.md 10.2 F9, 2.1): draws the merged band exactly as GoodHoursBand.tsx does - good = saffron +
 * dots, avoid = hatch, neutral = plain, night = indigo with the pattern as the verdict carrier, hairline dividers, moonrise
 * tick, 2 dp ink now-marker, inline labels at 13 sp x fontScale (hidden rather than clipped), tick row below. Colours come
 * from res/values(-night)/widget_tokens.xml (generated from design-tokens.json), so the widget follows the host theme.
 * No gradients, no shadows. Only called from the widget providers / worker (never from the JVM test).
 */
object BandRenderer {
  class Palette(private val ctx: Context) {
    private fun c(id: Int) = ContextCompat.getColor(ctx, id)
    val surface = c(R.color.widget_surface)
    val ink = c(R.color.widget_ink)
    val ink3 = c(R.color.widget_ink_3)
    val hair2 = c(R.color.widget_hair_2)
    val good = c(R.color.widget_good)
    val goodInk = c(R.color.widget_good_ink)
    val neutral = c(R.color.widget_neutral)
    val avoid = c(R.color.widget_avoid)
    val avoidHatch = c(R.color.widget_avoid_hatch)
    val night = c(R.color.widget_night)
    val nightInk = c(R.color.widget_night_ink)
    val indigo = c(R.color.widget_indigo)

    fun fillFor(span: WidgetSpan): Int = if (span.night) night else when (span.verdict) {
      "good" -> good
      "avoid" -> avoid
      else -> neutral
    }

    fun labelInkFor(span: WidgetSpan): Int = if (span.night) nightInk else if (span.verdict == "good") goodInk else ink
  }

  private fun withAlpha(color: Int, alpha: Double): Int = Color.argb((255 * alpha).toInt(), Color.red(color), Color.green(color), Color.blue(color))

  /** Dots (good) or hatch (avoid) inside `rect`; night spans draw the pattern in night-ink at 85 %. */
  fun drawPattern(canvas: Canvas, rect: RectF, span: WidgetSpan, p: Palette, density: Float) {
    if (span.verdict == "neutral") return
    canvas.save()
    canvas.clipRect(rect)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    if (span.verdict == "good") {
      paint.style = Paint.Style.FILL
      paint.color = if (span.night) withAlpha(p.nightInk, 0.85) else p.goodInk
      val step = 6f * density
      val r = 1.1f * density
      var y = rect.top + step / 2
      while (y < rect.bottom + step) {
        var x = rect.left + step / 2
        while (x < rect.right + step) {
          canvas.drawCircle(x, y, r, paint)
          x += step
        }
        y += step
      }
    } else {
      paint.style = Paint.Style.STROKE
      paint.strokeWidth = 1.4f * density
      paint.color = if (span.night) withAlpha(p.nightInk, 0.85) else p.avoidHatch
      val period = 8f * density
      val h = rect.height()
      // Diagonal lines (bottom-left to top-right) every 8 dp, as the SVG <Pattern> path "M0 8L8 0".
      var x = rect.left - h
      while (x < rect.right + period) {
        val path = Path()
        path.moveTo(x, rect.bottom)
        path.lineTo(x + h, rect.top)
        canvas.drawPath(path, paint)
        x += period
      }
    }
    canvas.restore()
  }

  /** The 18 dp verdict swatch of the small widget: fill + pattern of the current span. */
  fun swatch(context: Context, span: WidgetSpan, sizeDp: Float = 18f): Bitmap {
    val density = context.resources.displayMetrics.density
    val p = Palette(context)
    val px = (sizeDp * density).toInt().coerceAtLeast(1)
    val bmp = Bitmap.createBitmap(px, px, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bmp)
    val rect = RectF(0f, 0f, px.toFloat(), px.toFloat())
    val radius = context.resources.getDimension(R.dimen.widget_radius_band)
    canvas.save()
    val clip = Path().apply { addRoundRect(rect, radius, radius, Path.Direction.CW) }
    canvas.clipPath(clip)
    canvas.drawRect(rect, Paint().apply { color = p.fillFor(span) })
    drawPattern(canvas, rect, span, p, density)
    canvas.restore()
    val border = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = density; color = p.hair2 }
    canvas.drawRoundRect(RectF(0.5f * density, 0.5f * density, px - 0.5f * density, px - 0.5f * density), radius, radius, border)
    return bmp
  }

  /**
   * The medium widget's band bitmap: `widthDp` wide, band 32 dp (design token) + tick row. `nowMs` draws the marker only
   * inside the day; `fontScale` is the system font scale, used for the N3 threshold (labels hide, never clip).
   */
  fun render(context: Context, day: WidgetDay, nowMs: Long, widthDp: Int, fontScale: Float): Bitmap {
    val res = context.resources
    val density = res.displayMetrics.density
    val p = Palette(context)
    val bandH = res.getDimension(R.dimen.widget_band_height)
    val radius = res.getDimension(R.dimen.widget_radius_band)
    val wPx = (widthDp * density).toInt().coerceAtLeast(1)
    // sp dimens already include the system font scale (scaledDensity): never multiply by fontScale again.
    val tickPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      textSize = res.getDimension(R.dimen.widget_text_micro)
      color = p.ink3
    }
    val tickRowH = 8 * density + (tickPaint.descent() - tickPaint.ascent())
    val hPx = (bandH + tickRowH).toInt() + 1
    val bmp = Bitmap.createBitmap(wPx, hPx, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bmp)
    val width = wPx.toDouble()
    val band = RectF(0f, 0f, wPx.toFloat(), bandH)

    canvas.save()
    canvas.clipPath(Path().apply { addRoundRect(band, radius, radius, Path.Direction.CW) })
    canvas.drawRect(band, Paint().apply { color = p.neutral })
    val rects = BandGeometry.spanRects(day, width)
    val fill = Paint()
    for (r in rects) {
      val rect = RectF(r.x.toFloat(), 0f, (r.x + r.w).toFloat(), bandH)
      fill.color = p.fillFor(r.span)
      canvas.drawRect(rect, fill)
      drawPattern(canvas, rect, r.span, p, density)
    }
    // Dividers between spans: hair-2 by day, night-ink at 35 % by night (GoodHoursBand.tsx).
    val divider = Paint().apply { strokeWidth = density }
    for (r in rects.drop(1)) {
      divider.color = if (r.span.night) withAlpha(p.nightInk, 0.35) else p.hair2
      canvas.drawLine(r.x.toFloat(), 0f, r.x.toFloat(), bandH, divider)
    }
    // Moonrise tick on the top edge (indigo, 2 x 7 dp).
    day.moonrise?.let { moon ->
      val mx = BandGeometry.markerX(moon, day, width).toFloat()
      canvas.drawRect(mx - density, 0f, mx + density, 7f * density, Paint().apply { color = p.indigo })
    }
    // Inline labels (13 sp caption, weight 600) per N3; the text must also fit the span minus 10 dp padding.
    val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      textSize = res.getDimension(R.dimen.widget_text_caption)
      typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
      textAlign = Paint.Align.CENTER
    }
    val bandWidthDp = widthDp.toDouble()
    for (r in rects) {
      val label = BandGeometry.labelFor(r.span, day, bandWidthDp, fontScale.toDouble()) ?: continue
      val text = label.text
      val textW = labelPaint.measureText(text)
      if (textW > r.w - 10 * density) continue
      labelPaint.color = p.labelInkFor(r.span)
      val cx = (r.x + r.w / 2).toFloat()
      val baseline = bandH / 2 - (labelPaint.descent() + labelPaint.ascent()) / 2
      // Label pill in the span's own fill so the pattern does not run through the letters (as the app's label background).
      val pad = 5f * density
      canvas.drawRoundRect(RectF(cx - textW / 2 - pad, baseline + labelPaint.ascent() - 1, cx + textW / 2 + pad, baseline + labelPaint.descent() + 1), 3f * density, 3f * density, Paint().apply { color = p.fillFor(r.span) })
      canvas.drawText(text, cx, baseline, labelPaint)
    }
    // Now-marker: 2 dp ink, only inside the Vedic day.
    if (day.covers(nowMs)) {
      val nx = BandGeometry.markerX(nowMs, day, width).toFloat()
      canvas.drawRect(nx - density, 0f, nx + density, bandH, Paint().apply { color = p.ink })
    }
    canvas.restore()
    // 1 dp hair-2 border on the band.
    canvas.drawRoundRect(RectF(0.5f * density, 0.5f * density, wPx - 0.5f * density, bandH - 0.5f * density), radius, radius, Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = density; color = p.hair2 })

    // Tick row: 12 sp micro (the floor), ink-3, Latin digits.
    val tickTop = bandH + 4 * density
    val tickMark = Paint().apply { color = p.hair2 }
    val baseline = tickTop + 4 * density - tickPaint.ascent()
    for (t in BandGeometry.ticks(day, width)) {
      val x = t.x.toFloat()
      canvas.drawRect(x - 0.5f * density, tickTop, x + 0.5f * density, tickTop + 4 * density, tickMark)
      tickPaint.textAlign = when (t.align) {
        BandGeometry.Align.LEFT -> Paint.Align.LEFT
        BandGeometry.Align.CENTER -> Paint.Align.CENTER
        BandGeometry.Align.RIGHT -> Paint.Align.RIGHT
      }
      if (baseline + tickPaint.descent() <= hPx) canvas.drawText(t.text, x, baseline, tickPaint)
    }
    return bmp
  }
}
