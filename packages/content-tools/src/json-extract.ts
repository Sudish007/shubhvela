// Response hygiene for the Gemini OpenAI-compatible endpoint (build-rules: strip fences, extract the first balanced {...}).

/** Removes ```json ... ``` / ``` ... ``` fences anywhere in the text (keeps the inside). */
export function stripFences(s: string): string {
  return s.replace(/```[a-zA-Z0-9_-]*\s*\r?\n?/g, '').replace(/```/g, '').trim();
}

/**
 * Returns the first balanced top-level `{...}` object in `s`, honouring string literals and escapes, or null when
 * no complete object exists (truncated output).
 */
export function extractBalanced(s: string): string | null {
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

/** Fence-strip + balanced extraction + JSON.parse; throws a descriptive error on failure. */
export function parseModelJson(raw: string): Record<string, unknown> {
  const body = extractBalanced(stripFences(raw));
  if (!body) throw new Error('model output contains no balanced JSON object');
  const parsed = JSON.parse(body) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('model output is not a JSON object');
  return parsed as Record<string, unknown>;
}
