package com.shubhvela.app.widgets

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.ZoneOffset
import java.time.ZonedDateTime

/**
 * JVM unit test (plan C01, design.md 12 "widget render test with a fixed 7-day state file and an exhausted file").
 * Fixture: src/test/resources/widget_state_delhi_2026-10-22.json = REAL engine output (goodHours, Delhi 28.6139/77.209,
 * Asia/Kolkata, 2026-10-22..28) in the shape app/src/widgets/state.ts writes; the day matches the A03 sample truths
 * (avoid 06:26-10:40, neutral 10:40-11:42 Chal, good 11:42-13:30 Abhijit+Labh, avoid 13:30-16:19 Rahu Kaal, good 16:19-17:44).
 * Canvas drawing itself is not run here (android.graphics is stubbed on the JVM); C05 photographs the real widgets.
 */
class BandRendererTest {
  private val json: String = javaClass.getResourceAsStream("/widget_state_delhi_2026-10-22.json")!!.bufferedReader().readText()
  private val state: WidgetState = WidgetState.parse(json)!!
  private val day: WidgetDay = state.days[0]

  /** 2026-10-(22 + dayOffset) hh:mm IST as UTC ms (java.time is fine on the test JVM; the widget code itself avoids it for API 24). */
  private fun ist(hour: Int, minute: Int, dayOffset: Int = 0): Long =
    ZonedDateTime.of(2026, 10, 22, hour, minute, 0, 0, ZoneOffset.ofHoursMinutes(5, 30)).plusDays(dayOffset.toLong()).toInstant().toEpochMilli()

  @Test
  fun `parses seven days with the engine offset and times`() {
    assertEquals(1, state.version)
    assertEquals(7, state.days.size)
    assertEquals("2026-10-22", day.date)
    assertEquals("2026-10-28", state.days.last().date)
    assertEquals(330, day.offsetMinutes)
    assertEquals("06:26", day.formatTime(day.sunrise))
    assertEquals("17:44", day.formatTime(day.sunset))
    assertEquals("06:26", day.formatTime(day.nextSunrise))
    assertEquals(11, day.spans.size)
    assertEquals("Avoid", day.spans[0].label)
    assertEquals(listOf("Yamaganda", "Rog choghadiya", "Gulika", "Udveg choghadiya"), day.spans[0].reasons.map { it.name })
  }

  @Test
  fun `span to pixel mapping - daylight takes 75 percent, spans are contiguous, marker follows the clock`() {
    val width = 326.0
    val rects = BandGeometry.spanRects(day, width)
    assertEquals(0.0, rects.first().x, 1e-9)
    assertEquals(width, rects.last().x + rects.last().w, 1e-6)
    for (i in 1 until rects.size) assertEquals(rects[i - 1].x + rects[i - 1].w, rects[i].x, 1e-6)
    val dayWidth = rects.filter { !it.span.night }.sumOf { it.w }
    assertEquals(0.75 * width, dayWidth, 1e-6)
    assertEquals(0.75 * width, BandGeometry.markerX(day.sunset, day, width), 1e-9)
    assertEquals(width, BandGeometry.markerX(day.nextSunrise + 1, day, width), 1e-9)
    // 06:26 -> 10:40 is 254 of 678 daylight minutes (seconds in the engine's instants allow a few tenths of a dp).
    assertEquals(0.75 * width * 254.0 / 678.0, rects[0].w, 0.5)
    // Exact mapping from the span's own instants.
    val s0 = rects[0].span
    assertEquals(0.75 * width * (s0.end - s0.start).toDouble() / (day.sunset - day.sunrise).toDouble(), rects[0].w, 1e-6)
    // The now-marker at 10:58 sits inside the Chal span.
    val now = ist(10, 58)
    val x = BandGeometry.markerX(now, day, width)
    val chal = rects[1]
    assertTrue(x > chal.x && x < chal.x + chal.w)
  }

  @Test
  fun `N3 labels - verdict word at phone width, reason names when every reason is 60 dp wide, hidden under the threshold`() {
    val avoidMorning = day.spans[0]
    val chal = day.spans[1]
    val goodMidday = day.spans[2]
    val avoidAfternoon = day.spans[3]
    // 326 dp (390 dp phone minus gutters): the merged morning avoid span is ~91.6 dp -> labelled with the verdict word,
    // because its 84-minute reasons are ~30 dp each.
    assertEquals(BandGeometry.Label.Verdict("Avoid"), BandGeometry.labelFor(avoidMorning, day, 326.0))
    assertNull(BandGeometry.labelFor(chal, day, 326.0))
    assertNull(BandGeometry.labelFor(goodMidday, day, 326.0))
    // 13:30-16:19 = 169 min = ~61 dp: labelled at 1.0x, hidden (not clipped) at 1.3x where the threshold is 78 dp.
    assertEquals(BandGeometry.Label.Verdict("Avoid"), BandGeometry.labelFor(avoidAfternoon, day, 326.0, 1.0))
    assertNull(BandGeometry.labelFor(avoidAfternoon, day, 326.0, 1.3))
    // Tablet / large widget (1200 dp): every reason of the morning span is >= 60 dp -> the reason names.
    val wide = BandGeometry.labelFor(avoidMorning, day, 1200.0)
    assertTrue(wide is BandGeometry.Label.Reasons)
    assertEquals("Yamaganda \u00b7 Rog choghadiya \u00b7 Gulika \u00b7 Udveg choghadiya", wide!!.text)
    // Chal's own extent (62 min) is ~82 dp at 1200: the reason name "Chal choghadiya".
    assertEquals(BandGeometry.Label.Reasons(listOf("Chal choghadiya")), BandGeometry.labelFor(chal, day, 1200.0))
  }

  @Test
  fun `fresh state at 10 58 - Chal, next Abhijit 11 42, boundary alarm at the span end`() {
    val now = ist(10, 58)
    val r = state.resolve(now)!!
    assertEquals(WidgetState.Status.FRESH, r.status)
    assertFalse(r.showFooter)
    assertEquals("neutral", r.span!!.verdict)
    assertEquals("Chal choghadiya", WidgetUpdater.currentSegmentName(r.day, r.span!!, now))
    assertEquals("next: Abhijit 11:42", WidgetUpdater.nextLine(state, r.day, r.span!!))
    val line = WidgetUpdater.nowLine(state, r.day, r.span!!, now)
    // C-REVIEW-NIT-3: the file carries "<planet> hora" (state.ts, band.hora) so the widget reads like the app's Now line.
    assertTrue(line, line.startsWith("Now 10:58 \u00b7 Neutral \u00b7 Chal choghadiya \u00b7 Mercury hora \u00b7 next: Abhijit 11:42"))
    assertEquals(r.span!!.end, state.nextBoundaryAfter(now))
    assertEquals("11:42", r.day.formatTime(state.nextBoundaryAfter(now)!!))
    // 13:30-16:19 avoid span = Rahu Kaal (13:30-14:55) then Kaal choghadiya (14:55-16:19): at 14:00 only Rahu Kaal is
    // running (C-REVIEW-MEDIUM-1), at 15:00 only Kaal; the following span is Shubh choghadiya at 16:19.
    val rahu = state.resolve(ist(14, 0))!!
    assertEquals("Rahu Kaal", WidgetUpdater.currentSegmentName(rahu.day, rahu.span!!, ist(14, 0)))
    assertEquals("Kaal choghadiya", WidgetUpdater.currentSegmentName(rahu.day, rahu.span!!, ist(15, 0)))
    assertEquals("next: Shubh choghadiya 16:19", WidgetUpdater.nextLine(state, rahu.day, rahu.span!!))
  }

  @Test
  fun `C-REVIEW-MEDIUM-1 - the small widget names only the reasons active now, not the whole merged span`() {
    // 2026-10-23 03:32 IST: the night good span 03:16-06:26 merges Shubh (03:16-04:51), Brahma muhurat (04:45-05:36)
    // and Amrit (04:51-06:26). Only Shubh is running at 03:32.
    val now = ist(3, 32, 1)
    val r = state.resolve(now)!!
    assertEquals("good", r.span!!.verdict)
    assertEquals(listOf("Shubh", "Brahma muhurat", "Amrit"), r.span!!.reasons.map { it.name })
    assertEquals("Shubh", WidgetUpdater.currentSegmentName(r.day, r.span!!, now))
    // 04:48: Shubh and Brahma muhurat overlap -> both; 05:00: Brahma muhurat and Amrit.
    assertEquals("Shubh \u00b7 Brahma muhurat", WidgetUpdater.currentSegmentName(r.day, r.span!!, ist(4, 48, 1)))
    assertEquals("Brahma muhurat \u00b7 Amrit", WidgetUpdater.currentSegmentName(r.day, r.span!!, ist(5, 0, 1)))
    // A span whose reasons are all elsewhere falls back to the choghadiya covering now (never an empty headline).
    val bare = r.span!!.copy(reasons = r.span!!.reasons.filter { it.name == "Amrit" })
    assertEquals("Shubh", WidgetUpdater.currentSegmentName(r.day, bare, now))
  }

  @Test
  fun `the file covers seven Vedic days, the day rolls over at the next sunrise`() {
    for (i in 0 until 7) {
      val noon = ist(12, 0, i)
      val r = state.resolve(noon)!!
      assertEquals(state.days[i].date, r.day.date)
      assertNotNull(r.span)
    }
    // Before 06:26 on the 23rd it is still the Vedic day of the 22nd (night spans).
    val beforeSunrise = ist(5, 0, 1)
    val r = state.resolve(beforeSunrise)!!
    assertEquals("2026-10-22", r.day.date)
    assertTrue(r.span!!.night)
    assertEquals(7, WidgetScheduler.daysRemaining(state, ist(10, 58)))
    assertEquals(1, WidgetScheduler.daysRemaining(state, ist(12, 0, 6)))
  }

  @Test
  fun `stale after 36 hours - same day, footer on`() {
    val now = ist(10, 58, 2) // 48 h after writtenAt
    val r = state.resolve(now)!!
    assertEquals(WidgetState.Status.STALE, r.status)
    assertTrue(r.showFooter)
    assertEquals("2026-10-24", r.day.date)
    assertNotNull(r.span)
    val justUnder = state.writtenAt + WidgetState.STALE_AFTER_MS - 1
    assertEquals(WidgetState.Status.FRESH, state.resolve(justUnder)!!.status)
  }

  @Test
  fun `exhausted file - last known day, no span, footer on, no alarm`() {
    val now = ist(12, 0, 14) // two weeks later
    val r = state.resolve(now)!!
    assertEquals(WidgetState.Status.EXHAUSTED, r.status)
    assertTrue(r.showFooter)
    assertEquals("2026-10-28", r.day.date)
    assertNull(r.span)
    assertNull(state.nextBoundaryAfter(now))
    assertEquals(0, WidgetScheduler.daysRemaining(state, now))
    assertEquals("Last known day \u00b7 Wed 28 Oct 2026", state.strings.lastKnownLine(r.day.dateText))
    // The band still maps the last known day; the marker is outside it (covers == false).
    assertFalse(r.day.covers(now))
    val rects = BandGeometry.spanRects(r.day, 300.0)
    assertEquals(r.day.spans.size, rects.size)
    assertEquals(300.0, rects.last().x + rects.last().w, 1e-6)
  }

  @Test
  fun `malformed or foreign files are rejected, not rendered`() {
    assertNull(WidgetState.parse("not json"))
    assertNull(WidgetState.parse("{\"version\":2,\"days\":[]}"))
    val empty = WidgetState.parse("{\"version\":1,\"writtenAt\":0,\"strings\":{},\"days\":[]}")!!
    assertNull(empty.resolve(ist(10, 0)))
  }

  @Test
  fun `tick row - sunrise, noon, sunset, next sunrise`() {
    val ticks = BandGeometry.ticks(day, 326.0)
    assertEquals(listOf("06:26", "12:05", "17:44", "06:26"), ticks.map { it.text })
    assertEquals(0.0, ticks[0].x, 1e-9)
    assertEquals(0.375 * 326.0, ticks[1].x, 1e-3) // the midpoint instant is rounded to a whole millisecond
    assertEquals(0.75 * 326.0, ticks[2].x, 1e-6)
    assertEquals(326.0, ticks[3].x, 1e-9)
  }
}
