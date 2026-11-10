/**
 * Normalize Express req.params / req.query values to string.
 * Express can type these as string | string[]; use this for strict string expectations.
 */
export function asParam(value: string | string[] | undefined): string {
  if (value === undefined) return '';
  return Array.isArray(value) ? (value[0] ?? '') : value;
}
