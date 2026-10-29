// Kundli client (spec F42; design.md 9, 10.10; review M1, M8, N13): computes the chart in the browser with the SAME engine
// as the app, from the form or from the M8 query (v=1&d=YYYYMMDD&t=HHMM|u&a=0|15|30|60&lat&lon&tz&g + optional ay nd st n on
// /kundli/ only), renders the chart SVG from engine chart-layout at the real rendered width, the planet table, yogas, the
// Vimshottari rows, a shareable URL (history.replaceState) and the Android intent link, and answers every "Why?" with the
// rule text from the content corpus (assets/rules-<lang>.json). Nothing is uploaded; the only network call is the
// explicit "Search online" (OpenStreetMap Nominatim), never per keystroke.
// Deep imports (not the '@shubhvela/engine' barrel) so esbuild tree-shakes the calendar/muhurat tables out of the bundle;
// the tz transition table stays (every IANA zone a share link may carry must resolve offline).
import { computeChart, type ChartData, type ChartPoint } from '../../../packages/engine/src/kundli/index.ts';
import { layout, type ChartLayout, type ChartStyle } from '../../../packages/engine/src/chart-layout/index.ts';
import { current as dashaCurrent, dasha, type DashaNode } from '../../../packages/engine/src/dasha/index.ts';
import { yogas } from '../../../packages/engine/src/yogas/index.ts';
import { birthFromPayload, parseShareUrl, shareQuery, type KundliExtras, type SharePayload } from '../../../packages/engine/src/share/index.ts';
import { canonicalZone, formatInZone } from '../../../packages/engine/src/tz/index.ts';
import { foldToAscii } from '../../../packages/engine/src/gazetteer/index.ts';
import { WEB_CITIES, type WebCity } from '../../../packages/engine/src/gazetteer/webCities.ts';
import * as locale from '../../../packages/engine/src/locale/index.ts';
import type { Lang, PlanetId } from '../../../packages/engine/src/locale/index.ts';
import tzlookup from 'tz-lookup';
import { chartSvgFromLayout } from '../chart-svg.mjs';

interface Cfg {
  lang: Lang;
  kind: 'kundli' | 'm';
  basePath: string;
  baseUrl: string;
  playUrl: string | null;
  downloadUrl: string;
  appPackage: string;
  appScheme: string;
  rulesUrl: string;
  precision: { ephemeris: string; cases: number; deg: string; arcmin: string };
}

interface RuleEntry {
  text: string;
  source?: string;
  params?: string[];
  lang: string;
  fallback: boolean;
}

type Params = Record<string, string | number | boolean | null | undefined>;

let cfg: Cfg;
let S: Record<string, string> = {};
let rules: Record<string, RuleEntry> | null = null;
let rulesPromise: Promise<Record<string, RuleEntry>> | null = null;
let lastLayout: { style: ChartStyle; chart: ChartData; width: number } | null = null;

const $ = <T extends HTMLElement = HTMLElement>(id: string): T | null => document.getElementById(id) as T | null;

function fill(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (m, k: string) => (k in params && params[k] !== undefined && params[k] !== null ? String(params[k]) : m));
}

function T(key: string, params?: Params): string {
  return fill(S[key] ?? key, params);
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (html) e.innerHTML = html;
  return e;
}

// ---------------------------------------------------------------- formatting (locale tables from the engine)

const lang = (): Lang => cfg.lang;
const signName = (sign: number): string => locale.signNames[lang()][sign - 1];
const planetName = (id: PlanetId): string => locale.planetNames[lang()][id];
const degStr = (p: ChartPoint): string => `${p.degree}°${String(p.minute).padStart(2, '0')}′`;
const pad2 = (n: number): string => (n < 10 ? `0${n}` : String(n));

function ayanamsaLabel(id: string): string {
  return T(`settings.ayanamsa.${id}`).replace(/\s*\(.*\)$/, '');
}
function nodeLabel(node: string): string {
  return T(`settings.nodes.${node}`).replace(/\s*\(.*\)$/, '');
}
function styleLabel(style: ChartStyle): string {
  return T(style === 'north' ? 'charts.styleNorth' : style === 'south' ? 'charts.styleSouth' : 'charts.styleEast');
}

/** The web city within ~3 km of the coordinates, if any (the payload carries no place name). */
function nearestCity(lat: number, lon: number): WebCity | null {
  let best: WebCity | null = null;
  let bestD = 0.03;
  for (const c of WEB_CITIES) {
    const d = Math.hypot(c.lat - lat, (c.lon - lon) * Math.cos((lat * Math.PI) / 180));
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

function cityLabel(c: WebCity): string {
  const name = lang() !== 'en' && c.nameHi ? c.nameHi : c.name;
  return c.admin1 ? `${name}, ${c.admin1}` : `${name}, ${c.countryName}`;
}

/** The neighbouring sign an approx value could belong to (within 1° of a boundary, or the drift crosses one). */
function otherSign(p: ChartPoint): number {
  if (p.drift) {
    const minus = Math.floor(((p.drift.minus % 360) + 360) % 360 / 30) + 1;
    const plus = Math.floor(((p.drift.plus % 360) + 360) % 360 / 30) + 1;
    if (minus !== p.sign) return minus;
    if (plus !== p.sign) return plus;
  }
  return p.degree < 15 ? ((p.sign + 10) % 12) + 1 : (p.sign % 12) + 1;
}

// ---------------------------------------------------------------- query <-> form

interface Parsed {
  payload: SharePayload;
  extras: KundliExtras;
}

function parseLocation(): { ok: true; parsed: Parsed } | { ok: false; code: string | null } {
  if (!/(^|[?&])v=/.test(location.search)) return { ok: false, code: null };
  try {
    const r = parseShareUrl(`?${location.search.replace(/^\?/, '')}`, { allowKundliExtras: cfg.kind === 'kundli' });
    return { ok: true, parsed: { payload: r.payload, extras: cfg.kind === 'kundli' ? r.extras : {} } };
  } catch (e) {
    return { ok: false, code: (e as { code?: string }).code ?? 'error' };
  }
}

function fillForm(form: HTMLFormElement, { payload, extras }: Parsed): void {
  const set = (id: string, v: string) => {
    const e = $<HTMLInputElement>(id);
    if (e) e.value = v;
  };
  set('dob', payload.date);
  const unk = $<HTMLInputElement>('unk');
  const apx = $<HTMLInputElement>('apx');
  if (payload.time === null) {
    if (unk) unk.checked = true;
    set('tob', '');
  } else {
    if (unk) unk.checked = false;
    set('tob', payload.time);
  }
  if (apx) apx.checked = payload.approx > 0 && payload.time !== null;
  set('apxw', payload.approx > 0 ? String(payload.approx) : '30');
  set('lat', String(payload.lat));
  set('lon', String(payload.lon));
  set('tz', payload.tz);
  const city = nearestCity(payload.lat, payload.lon);
  set('pl', city ? cityLabel(city) : `${payload.lat}, ${payload.lon}`);
  const hint = $('pl-hint');
  if (hint) hint.textContent = T('form.placePicked', { lat: payload.lat, lon: payload.lon, tz: payload.tz });
  set('g', payload.gender);
  set('ay', extras.ay ?? 'lahiri');
  set('nd', extras.nd ?? 'mean');
  set('nm', extras.n ?? '');
  const st = extras.st ?? 'north';
  form.querySelectorAll<HTMLInputElement>('input[name="st"]').forEach((r) => {
    r.checked = r.value === st;
    r.parentElement?.classList.toggle('on', r.checked);
  });
  syncTimeControls();
}

function syncTimeControls(): void {
  const unk = $<HTMLInputElement>('unk');
  const apx = $<HTMLInputElement>('apx');
  const tob = $<HTMLInputElement>('tob');
  const row = $('apx-row');
  const unknown = Boolean(unk?.checked);
  if (tob) tob.disabled = unknown;
  if (apx) apx.disabled = unknown;
  if (row) row.hidden = unknown || !apx?.checked;
}

/** Builds the raw M8 query from the form and validates it through the ONE parser (design 11, M8). */
function readForm(form: HTMLFormElement): { ok: true; parsed: Parsed } | { ok: false; message: string } {
  const v = (id: string) => ($<HTMLInputElement>(id)?.value ?? '').trim();
  const unknown = Boolean($<HTMLInputElement>('unk')?.checked);
  const approx = !unknown && Boolean($<HTMLInputElement>('apx')?.checked) ? v('apxw') || '30' : '0';
  const date = v('dob');
  const time = v('tob');
  if (!unknown && !/^\d{2}:\d{2}$/.test(time)) return { ok: false, message: T('onboarding.timeError') };
  if (!v('lat') || !v('lon') || !v('tz')) return { ok: false, message: T('form.needPlace') };
  const st = (form.querySelector<HTMLInputElement>('input[name="st"]:checked')?.value ?? 'north') as ChartStyle;
  const parts = [
    'v=1',
    `d=${date.replace(/-/g, '')}`,
    `t=${unknown ? 'u' : time.replace(':', '')}`,
    `a=${approx}`,
    `lat=${encodeURIComponent(v('lat'))}`,
    `lon=${encodeURIComponent(v('lon'))}`,
    `tz=${encodeURIComponent(v('tz'))}`,
    `g=${v('g') || 'x'}`,
    `ay=${v('ay') || 'lahiri'}`,
    `nd=${v('nd') || 'mean'}`,
    `st=${st}`,
  ];
  const name = v('nm');
  if (name) parts.push(`n=${encodeURIComponent(name.slice(0, 40))}`);
  try {
    const r = parseShareUrl(`?${parts.join('&')}`, { allowKundliExtras: true });
    return { ok: true, parsed: { payload: r.payload, extras: r.extras } };
  } catch (e) {
    const code = (e as { code?: string }).code;
    const message = code === 'date' ? T('onboarding.dateError') : code === 'time' ? T('onboarding.timeError') : code === 'tz' || code === 'lat' || code === 'lon' ? T('form.needPlace') : code === 'extra' ? T('onboarding.nameError') : T('form.errorTitle');
    return { ok: false, message };
  }
}

// ---------------------------------------------------------------- place search

function renderPlaces(list: HTMLElement, items: { label: string; sub: string; lat: number; lon: number; tz: string }[]): void {
  list.textContent = '';
  for (const it of items) {
    const li = el('li');
    const b = el('button', { type: 'button' }, `${esc(it.label)}<span class="s num">${esc(it.sub)}</span>`);
    b.addEventListener('click', () => pickPlace(it));
    li.appendChild(b);
    list.appendChild(li);
  }
}

function pickPlace(it: { label: string; lat: number; lon: number; tz: string }): void {
  const set = (id: string, v: string) => {
    const e = $<HTMLInputElement>(id);
    if (e) e.value = v;
  };
  const lat = Math.round(it.lat * 100) / 100;
  const lon = Math.round(it.lon * 100) / 100;
  set('lat', String(lat));
  set('lon', String(lon));
  set('tz', it.tz);
  set('pl', it.label);
  const hint = $('pl-hint');
  if (hint) hint.textContent = T('form.placePicked', { lat, lon, tz: it.tz });
  const list = $('pl-list');
  if (list) list.textContent = '';
  const status = $('pl-status');
  if (status) status.textContent = '';
}

function searchOffline(q: string): WebCity[] {
  const query = foldToAscii(q.trim()).toLowerCase();
  if (!query) return [];
  const starts = (s: string | null): boolean => {
    if (!s) return false;
    const f = foldToAscii(s).toLowerCase();
    return f.startsWith(query) || f.split(/[\s-]+/).some((w) => w.startsWith(query));
  };
  return WEB_CITIES.filter((c) => starts(c.nameAscii) || starts(c.name) || (c.nameHi ? c.nameHi.startsWith(q.trim()) : false))
    .sort((a, b) => b.population - a.population)
    .slice(0, 8);
}

async function searchOnline(q: string): Promise<void> {
  const status = $('pl-status');
  const list = $('pl-list');
  if (!q.trim() || !list) return;
  if (status) status.textContent = T('form.searching');
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(q.trim())}`;
    const res = await fetch(url, { headers: { Accept: 'application/json', 'Accept-Language': cfg.lang === 'bho' ? 'hi' : cfg.lang } });
    if (!res.ok) throw new Error(String(res.status));
    const rows = (await res.json()) as { display_name: string; lat: string; lon: string }[];
    const items = rows
      .map((r) => {
        const lat = Number(r.lat);
        const lon = Number(r.lon);
        const tz = canonicalZone(tzlookup(lat, lon)) ?? '';
        return { label: r.display_name, sub: tz, lat, lon, tz };
      })
      .filter((r) => r.tz);
    if (status) status.textContent = items.length ? '' : T('form.noPlace');
    renderPlaces(list, items);
  } catch {
    if (status) status.textContent = T('form.onlineFailed');
  }
}

function wireForm(form: HTMLFormElement): void {
  $('unk')?.addEventListener('change', syncTimeControls);
  $('apx')?.addEventListener('change', syncTimeControls);
  syncTimeControls();
  form.querySelectorAll<HTMLInputElement>('input[name="st"]').forEach((r) => {
    r.addEventListener('change', () => {
      form.querySelectorAll<HTMLInputElement>('input[name="st"]').forEach((o) => o.parentElement?.classList.toggle('on', o.checked));
    });
  });
  const pl = $<HTMLInputElement>('pl');
  const list = $('pl-list');
  pl?.addEventListener('input', () => {
    // Typing invalidates the picked coordinates until a row is chosen again.
    const hits = searchOffline(pl.value);
    if (list) {
      renderPlaces(
        list,
        hits.map((c) => ({ label: cityLabel(c), sub: `${c.countryName} · ${c.tz}`, lat: c.lat, lon: c.lon, tz: c.tz })),
      );
    }
    const status = $('pl-status');
    if (status) status.textContent = pl.value.trim() && !hits.length ? T('form.noPlace') : '';
  });
  $('pl-online')?.addEventListener('click', () => void searchOnline(pl?.value ?? ''));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submit(form);
  });
}

function submit(form: HTMLFormElement): void {
  const err = $('form-err');
  const r = readForm(form);
  if (!r.ok) {
    if (err) err.textContent = r.message;
    return;
  }
  if (err) err.textContent = '';
  const query = shareQuery(r.parsed.payload, r.parsed.extras);
  history.replaceState(null, '', `${location.pathname}?${query}`);
  run(r.parsed);
  $('result')?.scrollIntoView({ block: 'start' });
}

// ---------------------------------------------------------------- compute + render

function run({ payload, extras }: Parsed): void {
  const status = $('result-status');
  if (status) status.textContent = T('result.computing');
  const chart = computeChart(birthFromPayload(payload), { ayanamsa: extras.ay ?? 'lahiri', node: extras.nd ?? 'mean' });
  const style: ChartStyle = extras.st ?? 'north';
  renderResult(chart, style, payload, extras);
  renderDetail(chart, payload);
  if (status) status.textContent = '';
}

function renderResult(chart: ChartData, style: ChartStyle, payload: SharePayload, extras: KundliExtras): void {
  const empty = $('result-empty');
  if (empty) empty.hidden = true;
  const name = extras.n;
  const title = chart.moonChart ? (name ? T('result.moonTitle', { name }) : T('result.moonTitleAnon')) : name ? T('result.d1Title', { name }) : T('result.d1TitleAnon');
  const h = $('resh');
  if (h) h.textContent = title;
  const tz = chart.meta.tz;
  const date = formatInZone(chart.meta.utcMs, tz, 'd MMM yyyy', lang());
  const city = nearestCity(payload.lat, payload.lon);
  const place = city ? cityLabel(city) : T('result.placeCoords', { lat: payload.lat, lon: payload.lon });
  const ay = ayanamsaLabel(chart.meta.ayanamsa);
  const nd = nodeLabel(chart.meta.node);
  let time = formatInZone(chart.meta.utcMs, tz, 'HH:mm');
  if (payload.approx > 0 && payload.time !== null) time += ` ${T('common.approxMinutes', { minutes: payload.approx })}`;
  const born = $('born');
  if (born) born.textContent = chart.moonChart ? T('result.bornLineUnknown', { date, place, ayanamsa: ay, node: nd }) : T('result.bornLine', { date, time, place, ayanamsa: ay, node: nd });
  const tag = $('style-tag');
  if (tag) {
    tag.textContent = styleLabel(style);
    tag.hidden = false;
  }

  // Chart at the real rendered width (re-laid out on resize), so text is never below 12 px (M1) and never overflows.
  const wrap = $('chart-wrap');
  if (wrap) {
    lastLayout = { style, chart, width: 0 };
    drawChart(wrap);
  }

  // Interpretive rows, each with its "Why?" (design 6).
  const rows = $('rows');
  if (rows) {
    rows.textContent = '';
    if (!chart.moonChart && chart.lagna) {
      const l = chart.lagna;
      const note = l.approx ? T('result.lagnaApproxNote', { other: signName(otherSign(l)) }) : T('result.lagnaNote');
      const inputs: Params = { lagnaSign: signName(l.sign), lagnaDegree: degStr(l), birthTime: payload.time ?? '', lat: payload.lat, lon: payload.lon };
      rows.appendChild(row(`<strong>${esc(T('result.lagnaRow', { sign: signName(l.sign) }))}</strong> <span class="num">${esc(degStr(l))}</span>${l.approx ? ` <span class="tag tag-approx">${esc(T('common.approx'))}</span>` : ''}<br><span class="s">${esc(note)}</span>`, l.approx ? ['lagna', payload.approx > 0 ? 'approx-birth-time' : 'approx-sign-boundary'] : ['lagna'], inputs, T('charts.lagna')));
    }
    const moon = chart.planets.find((p) => p.id === 'Mo');
    if (moon) {
      const nak = locale.nakshatraNames[lang()][moon.nakshatra - 1];
      const note = chart.moonChart ? T('result.moonUnknownNote') : moon.approx ? T('result.moonNoteApprox', { other: signName(otherSign(moon)) }) : T('result.moonNote');
      const ruleIds = chart.moonChart ? ['moon-chart'] : moon.approx ? ['approx-sign-boundary'] : [];
      rows.appendChild(row(`<strong>${esc(T('result.moonRow', { sign: signName(moon.sign), nakshatra: nak, pada: moon.pada }))}</strong>${moon.approx ? ` <span class="tag tag-approx">${esc(T('common.approx'))}</span>` : ''}<br><span class="s">${esc(note)}</span>`, ruleIds, { moonSign: signName(moon.sign), planet: planetName('Mo'), longitude: moon.longitude.toFixed(2) }, planetName('Mo')));
    }
    const yr = yogas(chart);
    const shown = yr.yogas.filter((y) => y.formed || y.cancelledBy);
    if (!shown.length) {
      rows.appendChild(row(`<strong>${esc(T('result.yogasRow'))}</strong><br><span class="s">${esc(T('result.yogasNone', { checked: yr.checked.length }))}</span>`, [], {}, T('result.yogasRow')));
    }
    for (const y of shown) {
      const yname = T(`yogas.name.${y.id}`);
      const label = y.formed ? yname : T('result.yogaCancelled', { name: yname });
      const ids = y.cancelledBy ? [y.ruleId, y.cancelledBy] : [y.ruleId];
      rows.appendChild(row(`<strong>${esc(T('result.yogasRow'))}</strong> ${esc(label)}<br><span class="s">${esc(y.participants.map(planetName).join(', '))} · ${esc(T('result.rulesOnTap'))}</span>`, ids, { participants: y.participants.map(planetName).join(', '), houses: y.houses.join(', '), formed: y.formed, cancelledBy: y.cancelledBy ?? '' }, yname));
    }
  }

  // Shareable URL (this page, this language) and the Android intent link (M9): Play, or the download page until the listing exists.
  const query = shareQuery(payload, cfg.kind === 'kundli' ? extras : {});
  const share = $('share');
  const url = $('share-url');
  if (share && url) {
    url.textContent = `${cfg.baseUrl}${cfg.lang}/${cfg.kind}/?${query}`;
    share.hidden = false;
  }
  const actions = $('result-actions');
  if (actions) actions.hidden = false;
  const intent = $<HTMLAnchorElement>('intent-link');
  if (intent) {
    const fallback = cfg.playUrl ?? cfg.downloadUrl;
    intent.href = `intent://${cfg.kind}?${query}#Intent;scheme=${cfg.appScheme};package=${cfg.appPackage};S.browser_fallback_url=${encodeURIComponent(fallback)};end`;
  }
}

function drawChart(wrap: HTMLElement): void {
  if (!lastLayout) return;
  const width = Math.max(240, Math.min(640, wrap.clientWidth || 320));
  if (Math.abs(width - lastLayout.width) < 8 && wrap.firstChild) return;
  lastLayout.width = width;
  const { style, chart } = lastLayout;
  const centre = style === 'north' ? undefined : [`${ayanamsaLabel(chart.meta.ayanamsa)} · ${nodeLabel(chart.meta.node)}`];
  // At >= 320 px the chart is laid out in its 320 user units and scales with the SVG (text grows with the chart, as in
  // the mocks); narrower than that the layout runs at the real width so text never renders below 12 px (M1) and the
  // density steps keep every glyph inside its house.
  const lay: ChartLayout = layout(style, chart, 1, Math.min(width, 320), { lang: lang(), centreLines: centre });
  const summary = lay.houses
    .map((h) => (h.planets.length ? T('charts.chartA11yHouse', { n: h.n, sign: signName(h.sign), planets: h.planets.map(planetName).join(', ') }) : T('charts.chartA11yEmpty', { n: h.n, sign: signName(h.sign) })))
    .join(' ');
  wrap.innerHTML = chartSvgFromLayout(lay, { mode: 'web', lang: lang(), ariaLabel: T('result.a11yChart', { style: styleLabel(style), summary }), attrs: { 'data-layout': 'client' } });
}

function row(html: string, ruleIds: string[], inputs: Params, what: string): HTMLElement {
  const r = el('div', { class: 'row' });
  const p = el('p', {}, html);
  r.appendChild(p);
  if (ruleIds.length) {
    const b = el('button', { class: 'why', type: 'button', 'aria-expanded': 'false', 'aria-label': T('result.whyA11y', { what }) }, esc(T('common.why')));
    const panel = el('div', { class: 'why-panel', hidden: '' });
    b.addEventListener('click', () => void toggleWhy(b, panel, ruleIds, inputs));
    r.appendChild(b);
    r.appendChild(panel);
  }
  return r;
}

async function loadRules(): Promise<Record<string, RuleEntry>> {
  if (rules) return rules;
  rulesPromise = rulesPromise ?? fetch(cfg.rulesUrl).then((r) => r.json() as Promise<Record<string, RuleEntry>>);
  rules = await rulesPromise;
  return rules;
}

async function toggleWhy(button: HTMLElement, panel: HTMLElement, ruleIds: string[], inputs: Params): Promise<void> {
  const open = button.getAttribute('aria-expanded') === 'true';
  if (open) {
    button.setAttribute('aria-expanded', 'false');
    panel.hidden = true;
    return;
  }
  button.setAttribute('aria-expanded', 'true');
  panel.hidden = false;
  panel.textContent = T('why.loading');
  try {
    const table = await loadRules();
    const blocks = ruleIds.map((id) => {
      const r = table[id];
      if (!r) return `<p>${esc(T('why.unavailable'))} (${esc(id)})</p>`;
      const inputRows = Object.entries(inputs)
        .filter(([, v]) => v !== '' && v !== undefined && v !== null)
        .map(([k, v]) => `${esc(k)} = ${esc(v)}`)
        .join(' · ');
      return `<dl><dt>${esc(T('why.rule'))}</dt><dd${r.lang !== cfg.lang ? ` lang="${esc(r.lang)}"` : ''}>${esc(r.text)}</dd><dt>${esc(T('why.source'))}</dt><dd>${esc(!r.source || r.source === 'convention' ? T('why.convention') : r.source)}</dd>${inputRows ? `<dt>${esc(T('why.inputs'))}</dt><dd class="num">${inputRows}</dd>` : ''}</dl>`;
    });
    panel.innerHTML = blocks.join('');
  } catch {
    panel.textContent = T('why.unavailable');
  }
}

function dashaRow(node: DashaNode, label: string, suffix: string, tz: string): HTMLElement {
  const from = formatInZone(node.start, tz, 'd MMM yyyy', lang());
  const to = formatInZone(node.end, tz, 'd MMM yyyy', lang());
  return row(`<strong>${esc(label)}</strong> ${esc(suffix)}<br><span class="s num">${esc(from)} – ${esc(to)}</span>`, ['dasha-vimshottari'], { lord: planetName(node.lord), level: node.level, from, to }, label);
}

function renderDetail(chart: ChartData, payload: SharePayload): void {
  const detail = $('detail');
  if (!detail) return;
  detail.hidden = false;
  const tbody = detail.querySelector('#planets tbody');
  if (tbody) {
    tbody.textContent = '';
    const approxTag = ` <span class="tag tag-approx">${esc(T('common.approx'))}</span>`;
    const cell = (p: ChartPoint): string => `${esc(signName(p.sign))} ${esc(degStr(p))}${p.approx ? approxTag : ''}`;
    const nak = (p: ChartPoint): string => `${esc(locale.nakshatraShort[lang()][p.nakshatra - 1])}\u00a0${p.pada}`;
    if (!chart.moonChart && chart.lagna) {
      tbody.appendChild(el('tr', {}, `<td><strong>${esc(T('charts.lagna'))}</strong></td><td class="num">${cell(chart.lagna)}</td><td>${nak(chart.lagna)}</td>`));
    }
    for (const p of chart.planets) {
      const tags = p.tags.map((tg) => T(`dignity.${tg}`)).join(' · ');
      tbody.appendChild(el('tr', {}, `<td><strong>${esc(planetName(p.id))}</strong>${tags ? `<br><span class="tag">${esc(tags)}</span>` : ''}</td><td class="num">${cell(p)}</td><td>${nak(p)}</td>`));
    }
  }
  const dashaBox = $('dasha');
  if (dashaBox) {
    dashaBox.textContent = '';
    const tree = dasha(chart);
    const now = Date.now();
    const pos = dashaCurrent(tree, now);
    const tz = chart.meta.tz;
    if (pos) {
      dashaBox.appendChild(dashaRow(pos.maha, T('detail.mahadasha', { lord: planetName(pos.maha.lord) }), '', tz));
      dashaBox.appendChild(dashaRow(pos.antar, T('detail.antardasha', { lord: planetName(pos.antar.lord) }), T('detail.now'), tz));
      const antars = pos.maha.children ?? [];
      const i = antars.indexOf(pos.antar);
      let next: DashaNode | undefined = antars[i + 1];
      if (!next) {
        const mi = tree.mahas.indexOf(pos.maha);
        next = tree.mahas[mi + 1]?.children?.[0];
      }
      if (next) dashaBox.appendChild(dashaRow(next, T('detail.antardasha', { lord: planetName(next.lord) }), T('detail.next'), tz));
    }
    const bal = el('p', { class: 's num' }, esc(T('detail.balance', { lord: planetName(tree.balanceAtBirth.lord), years: tree.balanceAtBirth.years.toFixed(2) })));
    dashaBox.appendChild(bal);
  }
  const computed = $('computed-text');
  if (computed) {
    computed.textContent = T('computed.text', {
      ephemeris: chart.meta.ephemeris,
      cases: cfg.precision.cases,
      deg: cfg.precision.deg,
      arcmin: cfg.precision.arcmin,
      ayanamsa: ayanamsaLabel(chart.meta.ayanamsa),
      node: chart.meta.node === 'true' ? chart.meta.nodeMethod : nodeLabel(chart.meta.node),
      tz: chart.meta.tz,
    });
  }
  void payload;
}

// ---------------------------------------------------------------- entry

export function init(opts: { pendingSubmit?: boolean } = {}): void {
  cfg = JSON.parse($('cfg')?.textContent ?? '{}') as Cfg;
  S = JSON.parse($('i18n')?.textContent ?? '{}') as Record<string, string>;
  const form = $<HTMLFormElement>('kundli-form');
  if (form) {
    wireForm(form);
    // The bundle loads on the first interaction: anything typed into the place field meanwhile is searched now.
    const pl = $<HTMLInputElement>('pl');
    if (pl && pl.value.trim() && !$<HTMLInputElement>('lat')?.value) pl.dispatchEvent(new Event('input'));
  }
  const parsed = parseLocation();
  if (parsed.ok) {
    if (form) fillForm(form, parsed.parsed);
    run(parsed.parsed);
  } else if (parsed.code && location.search) {
    const target = form ? $('form-err') : $('result-empty');
    if (target) target.textContent = form ? T(parsed.code === 'date' ? 'form.linkErrorDate' : 'form.linkError', { code: parsed.code }) : T('m.invalid');
  }
  let pending = 0;
  window.addEventListener('resize', () => {
    if (pending) return;
    pending = window.setTimeout(() => {
      pending = 0;
      const wrap = $('chart-wrap');
      if (wrap) drawChart(wrap);
    }, 150);
  });
  $('copy')?.addEventListener('click', async () => {
    const url = $('share-url')?.textContent ?? '';
    const b = $('copy');
    try {
      await navigator.clipboard.writeText(url);
      if (b) b.textContent = T('result.copied');
    } catch {
      if (b) b.textContent = T('result.copyFailed');
    }
  });
  if (form) {
    form.setAttribute('data-ready', '');
    if (opts.pendingSubmit) submit(form);
  }
}

export const __test = { otherSign, searchOffline, pad2 };
