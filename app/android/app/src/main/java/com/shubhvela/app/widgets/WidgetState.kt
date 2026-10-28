package com.shubhvela.app.widgets

import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * The widget data contract (design.md 10.2 F9, plan P4): files/widget_state.json written by app/src/widgets/writeState.ts.
 * Seven Vedic days of merged good-hours spans (engine.goodHours output, the only verdict producer), already localised in
 * the app's UI language. This file only parses, picks the day/span for an instant and formats times with the offset the
 * engine recorded for the day (never the device zone database). Pure Kotlin: covered by the JVM unit test.
 */
data class WidgetReason(val id: String, val name: String, val start: Long, val end: Long)

data class WidgetSpan(
  val start: Long,
  val end: Long,
  /** good | neutral | avoid */
  val verdict: String,
  val night: Boolean,
  /** Verdict word in the UI language (inline label, small widget headline). */
  val label: String,
  val reasons: List<WidgetReason>,
)

data class WidgetSegment(val id: String, val name: String, val start: Long, val end: Long, val verdict: String, val kind: String)

data class WidgetHora(val name: String, val start: Long, val end: Long)

data class WidgetDay(
  val date: String,
  val dateText: String,
  /** Zone offset in minutes east of UTC at this day's sunrise (engine tz table). */
  val offsetMinutes: Int,
  val sunrise: Long,
  val sunset: Long,
  val nextSunrise: Long,
  val moonrise: Long?,
  val spans: List<WidgetSpan>,
  val segments: List<WidgetSegment>,
  val hora: List<WidgetHora>,
) {
  fun covers(nowMs: Long): Boolean = nowMs in sunrise until nextSunrise

  fun spanAt(nowMs: Long): WidgetSpan? = spans.firstOrNull { nowMs >= it.start && nowMs < it.end }

  fun spanAfter(span: WidgetSpan): WidgetSpan? = spans.firstOrNull { it.start == span.end }

  /** The choghadiya row covering the instant (named in the Now line). */
  fun choghadiyaAt(nowMs: Long): WidgetSegment? = segments.firstOrNull { it.kind == "choghadiya" && nowMs >= it.start && nowMs < it.end }

  fun horaAt(nowMs: Long): WidgetHora? = hora.firstOrNull { nowMs >= it.start && nowMs < it.end }

  /** Next instant at which the band changes after `nowMs`: the next span end, else the next sunrise; null when the day is over. */
  fun nextBoundaryAfter(nowMs: Long): Long? {
    val ends = spans.map { it.end }.filter { it > nowMs }
    if (ends.isNotEmpty()) return ends.minOrNull()
    return if (nextSunrise > nowMs) nextSunrise else null
  }

  /** "HH:mm" of an instant in this day's zone offset (Latin digits, 24 h, as the app's fmtTime). */
  fun formatTime(ms: Long): String {
    val local = ms + offsetMinutes * 60_000L
    val dayMs = Math.floorMod(local, 86_400_000L)
    val h = dayMs / 3_600_000L
    val m = (dayMs % 3_600_000L) / 60_000L
    // Locale.ROOT: Latin digits in every system locale (design.md 7).
    return String.format(java.util.Locale.ROOT, "%02d:%02d", h, m)
  }
}

data class WidgetStrings(
  val now: String,
  /** Template with {segment} and {time}. */
  val next: String,
  val good: String,
  val neutral: String,
  val avoid: String,
  val night: String,
  val stale: String,
  /** Template with {date}. */
  val lastKnown: String,
  val noUpcoming: String,
) {
  fun verdictWord(verdict: String): String = when (verdict) {
    "good" -> good
    "avoid" -> avoid
    "night" -> night
    else -> neutral
  }

  fun nextLine(segment: String, time: String): String = next.replace("{segment}", segment).replace("{time}", time)

  fun lastKnownLine(date: String): String = lastKnown.replace("{date}", date)
}

data class WidgetState(
  val version: Int,
  val writtenAt: Long,
  val tz: String,
  val locationName: String?,
  val lang: String,
  val strings: WidgetStrings,
  val nextEvent: String?,
  val days: List<WidgetDay>,
) {
  enum class Status { FRESH, STALE, EXHAUSTED }

  /** What the widget shows at `nowMs`: the covering day (or the last known one) and its status. */
  data class Resolved(val status: Status, val day: WidgetDay, val span: WidgetSpan?) {
    /** The footer "Open Shubhvela to refresh" shows for both non-fresh states (design 10.2 F9). */
    val showFooter: Boolean get() = status != Status.FRESH
  }

  fun resolve(nowMs: Long): Resolved? {
    if (days.isEmpty()) return null
    val day = days.firstOrNull { it.covers(nowMs) } ?: return Resolved(Status.EXHAUSTED, days.last(), null)
    val status = if (nowMs - writtenAt > STALE_AFTER_MS) Status.STALE else Status.FRESH
    return Resolved(status, day, day.spanAt(nowMs))
  }

  /** Next boundary across days (the alarm target), or null when the file has nothing after `nowMs`. */
  fun nextBoundaryAfter(nowMs: Long): Long? {
    for (day in days) {
      val b = day.nextBoundaryAfter(nowMs)
      if (b != null) return b
    }
    return null
  }

  companion object {
    const val FILE_NAME = "widget_state.json"
    const val SUPPORTED_VERSION = 1
    /** plan P4: a file older than 36 h renders the last known day with the footer. */
    const val STALE_AFTER_MS = 36L * 3_600_000L

    fun read(file: File): WidgetState? {
      if (!file.exists()) return null
      return try {
        parse(file.readText(Charsets.UTF_8))
      } catch (e: Exception) {
        null
      }
    }

    /** Parses the file; null for another version or malformed JSON (the caller keeps its last bitmap / shows the setup text). */
    fun parse(json: String): WidgetState? {
      val root = try {
        JSONObject(json)
      } catch (e: Exception) {
        return null
      }
      if (root.optInt("version", -1) != SUPPORTED_VERSION) return null
      val s = root.optJSONObject("strings") ?: return null
      val strings = WidgetStrings(
        now = s.optString("now", "Now"),
        next = s.optString("next", "next: {segment} {time}"),
        good = s.optString("good", "Good"),
        neutral = s.optString("neutral", "Neutral"),
        avoid = s.optString("avoid", "Avoid"),
        night = s.optString("night", "Night"),
        stale = s.optString("stale", "Open Shubhvela to refresh"),
        lastKnown = s.optString("lastKnown", "Last known day \u00b7 {date}"),
        noUpcoming = s.optString("noUpcoming", ""),
      )
      val location = root.optJSONObject("location")
      val days = root.optJSONArray("days")?.let { arr -> (0 until arr.length()).mapNotNull { parseDay(arr.optJSONObject(it)) } } ?: emptyList()
      return WidgetState(
        version = SUPPORTED_VERSION,
        writtenAt = root.optLong("writtenAt", 0L),
        tz = root.optString("tz", "UTC"),
        locationName = location?.let { if (it.isNull("name")) null else it.optString("name") },
        lang = root.optString("lang", "en"),
        strings = strings,
        nextEvent = if (root.isNull("nextEvent")) null else root.optString("nextEvent"),
        days = days.sortedBy { it.sunrise },
      )
    }

    private fun parseDay(o: JSONObject?): WidgetDay? {
      if (o == null) return null
      val sunrise = o.optLong("sunrise", Long.MIN_VALUE)
      val sunset = o.optLong("sunset", Long.MIN_VALUE)
      val nextSunrise = o.optLong("nextSunrise", Long.MIN_VALUE)
      if (sunrise == Long.MIN_VALUE || sunset == Long.MIN_VALUE || nextSunrise == Long.MIN_VALUE) return null
      return WidgetDay(
        date = o.optString("date", ""),
        dateText = o.optString("dateText", o.optString("date", "")),
        offsetMinutes = o.optInt("offsetMinutes", 0),
        sunrise = sunrise,
        sunset = sunset,
        nextSunrise = nextSunrise,
        moonrise = if (o.isNull("moonrise")) null else o.optLong("moonrise"),
        spans = list(o.optJSONArray("spans")) { sp ->
          WidgetSpan(
            start = sp.getLong("start"),
            end = sp.getLong("end"),
            verdict = sp.optString("verdict", "neutral"),
            night = sp.optBoolean("night", false),
            label = sp.optString("label", ""),
            reasons = list(sp.optJSONArray("reasons")) { r -> WidgetReason(r.optString("id", ""), r.optString("name", ""), r.getLong("start"), r.getLong("end")) },
          )
        },
        segments = list(o.optJSONArray("segments")) { sg ->
          WidgetSegment(sg.optString("id", ""), sg.optString("name", ""), sg.getLong("start"), sg.getLong("end"), sg.optString("verdict", "neutral"), sg.optString("kind", ""))
        },
        hora = list(o.optJSONArray("hora")) { h -> WidgetHora(h.optString("name", ""), h.getLong("start"), h.getLong("end")) },
      )
    }

    private fun <T> list(arr: JSONArray?, map: (JSONObject) -> T): List<T> {
      if (arr == null) return emptyList()
      val out = ArrayList<T>(arr.length())
      for (i in 0 until arr.length()) {
        val o = arr.optJSONObject(i) ?: continue
        try {
          out.add(map(o))
        } catch (e: Exception) {
          // skip a malformed entry, keep the rest
        }
      }
      return out
    }
  }
}
