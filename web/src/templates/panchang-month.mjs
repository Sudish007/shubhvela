// /<lang>/panchang/<city>/<yyyy-mm>/ — the next month's table (same table renderer as the city page, no today card).
import { renderPanchangCity } from './panchang-city.mjs';

export function renderPanchangMonth(ctx, data, { city, ym }) {
  return renderPanchangCity(ctx, data, { city, ym, isCurrent: false });
}
