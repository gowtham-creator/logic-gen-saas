/**
 * Safe JSON parse and pretty-print for result display in chat/code blocks.
 */

/**
 * Safely parse a string as JSON. Returns parsed value or undefined if invalid.
 */
export function safeJsonParse<T = unknown>(str: string): T | undefined {
  if (typeof str !== 'string' || !str.trim()) return undefined;
  const trimmed = str.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return undefined;
  }
}

/**
 * Check if a string looks like JSON (starts with { or [).
 */
export function looksLikeJson(str: string): boolean {
  const t = str.trim();
  return t.startsWith('{') || t.startsWith('[');
}

/**
 * Format a value for display: if it's a string that parses as JSON, pretty-print it;
 * if it's already an object, stringify with indentation. Otherwise return as-is.
 */
export function formatJsonForDisplay(value: unknown, maxLength?: number): string {
  if (value === null || value === undefined) return String(value);
  let parsed: unknown;
  if (typeof value === 'string') {
    parsed = safeJsonParse(value);
    if (parsed === undefined) return value;
  } else {
    parsed = value;
  }
  try {
    let out = JSON.stringify(parsed, null, 2);
    if (typeof maxLength === 'number' && out.length > maxLength) {
      out = out.slice(0, maxLength) + '\n… (truncated)';
    }
    return out;
  } catch {
    return String(value);
  }
}
