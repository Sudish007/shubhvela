// Civil-date helpers shared by the build, the worker and the browser bundle (pure, no Node imports).

/** Every civil date of a month: 'YYYY-MM' -> ['YYYY-MM-01', ...]. */
export function monthDates(ym) {
  const [y, m] = ym.split('-').map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out = [];
  for (let d = 1; d <= days; d++) out.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  return out;
}

/** Civil date (YYYY-MM-DD) of an instant in a zone via the engine's own zone table (never Intl). */
export function civilDate(engine, utcMs, tz) {
  const w = engine.utcToWall(utcMs, tz);
  return `${w.y}-${String(w.m).padStart(2, '0')}-${String(w.d).padStart(2, '0')}`;
}

/** UTC-ms bounds covering `days` days from a civil date in any zone (±12 h slack). */
export function rangeFromDate(ymd, days) {
  const [y, m, d] = ymd.split('-').map(Number);
  const from = Date.UTC(y, m - 1, d) - 12 * 3_600_000;
  return { from, to: from + days * 86_400_000 + 24 * 3_600_000 };
}
