// Key scrubbing for anything that is written to disk or printed (build-rules: publish a key-scrubbed diagnostic;
// never log headers). Google API keys start with "AIza" followed by 35 URL-safe characters.
const KEY_RE = /AIza[0-9A-Za-z_-]{30,}/g;
const BEARER_RE = /Bearer\s+[A-Za-z0-9._~+/=-]{16,}/g;

export function redact(text: string): string {
  return text.replace(KEY_RE, 'AIza[redacted]').replace(BEARER_RE, 'Bearer [redacted]');
}

/** Deep-redacts every string in a JSON-serialisable value. */
export function redactValue<T>(value: T): T {
  return JSON.parse(redact(JSON.stringify(value))) as T;
}
