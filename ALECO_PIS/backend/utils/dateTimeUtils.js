/**
 * Backend datetime utilities for Philippine time (UTC+8).
 * Use these when writing to MySQL so stored values align with frontend display.
 *
 * CONVENTION:
 * - WRITE: Use nowPhilippineForMysql() for created_at, updated_at, deleted_at, etc.
 *   Never use NOW() or toISOString() - Aiven uses UTC; we store Philippine wall-clock.
 * - READ: Use toIsoForClient() (interruptionsDto) to convert DB strings to ISO UTC
 *   for API responses. Frontend formatToPhilippineTime adds +8 for display.
 */

/** Philippine timezone offset in hours (UTC+8). */
export const PH_OFFSET_HOURS = 8;

/**
 * Returns current time in Philippine time as MySQL DATETIME format.
 * Use for created_at, updated_at, etc. when INSERT/UPDATE.
 * @returns {string} "YYYY-MM-DD HH:mm:ss"
 */
export function nowPhilippineForMysql() {
  const d = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? '';
  const y = get('year');
  const mo = get('month');
  const day = get('day');
  const h = get('hour');
  const mi = get('minute');
  const s = get('second');
  return `${y}-${mo}-${day} ${h}:${mi}:${s}`;
}
