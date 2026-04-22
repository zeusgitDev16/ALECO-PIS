/**
 * Defense-in-depth helpers for numeric SQL bounds (LIMIT / OFFSET / similar).
 * Always use with `?` placeholders — never embed numbers in SQL template strings.
 */

/**
 * @param {unknown} value
 * @param {number} min
 * @param {number} max
 * @param {number} fallback - used when value is NaN or non-finite
 * @returns {number}
 */
export function clampSqlInt(value, min, max, fallback) {
  const n = parseInt(String(value), 10);
  if (Number.isNaN(n) || !Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}
