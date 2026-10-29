// Small HTML helpers for the string templates (no template engine, plan.md D01).

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Attribute value (same escaping; kept separate so call sites read clearly). */
export const attr = esc;

/** JSON for an inline <script type="application/ld+json"> or data block: `<` escaped so `</script>` cannot occur. */
export function jsonScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

/** Joins template parts, dropping null/false/undefined. */
export function join(parts, sep = '\n') {
  return parts.filter((p) => p !== null && p !== undefined && p !== false).join(sep);
}

/** Replaces `{name}` placeholders (same syntax as the content package). */
export function fill(template, params = {}) {
  return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (m, k) => (k in params && params[k] !== undefined ? String(params[k]) : m));
}

/** Minimal CSS/JS minifier for inline assets: strips comments and collapses whitespace (safe for our own files). */
export function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s*\n\s*/g, '')
    .replace(/\s*([{}:;,>])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();
}
