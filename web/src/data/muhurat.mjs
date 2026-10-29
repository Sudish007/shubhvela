// Muhurat page data (spec F26/F42; FEAT-D02): engine.muhurat.score(activity, month range, [] profiles, New Delhi) for
// each of the 14 activities over 12 rolling months from the build month. No profile is passed, so the two personal rules
// (Chandra bala, Tara bala) are never met here — at most 8/10 — and the page says so (the app scores them against a
// birth chart). One panchang cache serves all 14 activities (the scorer is panchang-bound).
import { monthDates } from '../dates.mjs';

export const MUHURAT_CITY = 'new-delhi';

export function muhuratData(engine, calendar, { log } = {}) {
  const city = engine.webCity(MUHURAT_CITY);
  if (!city) throw new Error(`City ${MUHURAT_CITY} missing from web-cities.json`);
  const geo = { lat: city.lat, lon: city.lon };
  const activities = engine.MUHURAT_ACTIVITIES;
  if (activities.length !== 14) throw new Error(`MUHURAT_ACTIVITIES has ${activities.length} entries, the page set says 14`);
  const cache = new Map();
  const byActivity = new Map();
  for (const a of activities) byActivity.set(a.id, new Map());
  for (const ym of calendar.months12) {
    const dates = monthDates(ym);
    const range = { from: dates[0], to: dates[dates.length - 1] };
    for (const a of activities) {
      const windows = engine.muhurat.score(a.id, range, [], geo, city.tz, { panchangCache: cache });
      const { matches, partials } = engine.splitWindows(windows);
      byActivity.get(a.id).set(ym, { matches, partials, days: dates.length });
    }
  }
  if (log) log(`muhurat windows for ${activities.length} activities × ${calendar.months12.length} months at ${city.name}`);
  return { city, geo, tz: city.tz, activities, byActivity, months: calendar.months12, ruleOrder: engine.MUHURAT_RULE_ORDER, minRules: engine.MUHURAT_MIN_RULES, ruleCount: engine.MUHURAT_RULE_COUNT };
}

/** Activity rule text (corpus/muhurat-activities, id muhurat-<activity>) and the ten rule-chip texts (muhurat-rule-<id>). */
export function muhuratCopy(content, activityId, ruleOrder, lang) {
  const a = content.lookup('muhurat-activities', `muhurat-${activityId}`, lang);
  const rules = ruleOrder.map((r) => {
    const s = content.lookup('muhurat-activities', `muhurat-rule-${r}`, lang);
    return { id: r, text: s?.text ?? null, lang: s?.lang ?? null };
  });
  return { activity: a ? { text: a.text, source: a.snippet.source, lang: a.lang, fallback: a.fallback } : null, rules };
}

/** Window rows sorted by start time within the month (the engine's N18 order is by score; a month table reads by date). */
export function byDate(windows) {
  return [...windows].sort((a, b) => a.start - b.start);
}
