/**
 * Redacts sensitive information from Authorization headers.
 * Shows first 10 chars + '...' + last 4 chars for Bearer tokens > 29 chars.
 * For shorter strings, replaces non-whitespace chars with '*'.
 * Returns '(none)' for empty/undefined input.
 */
export function redactAuthorization(auth: string | undefined): string {
  if (!auth) return '(none)';
  if (auth.startsWith('Bearer ') && auth.length > 29) {
    return auth.slice(0, 10) + '...' + auth.slice(-4);
  }
  // For short or non-Bearer auth, mask non-whitespace characters
  return auth.replace(/\S/g, '*');
}
