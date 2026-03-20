/**
 * Format API / DB datetime strings (local wall clock, no timezone suffix) for display.
 * Handles: "2026-03-20 13:30", "2026-03-20T13:30:00", "2026-03-20T05:30:00.000Z" (UTC).
 * @param {string|null|undefined} apiLike - e.g. "2026-03-20 13:30"
 * @returns {Date|null}
 */
export function parseApiDateTimeToLocalDate(apiLike) {
  if (apiLike == null || apiLike === '') return null;
  const s = String(apiLike).trim();
  if (!s) return null;

  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|z)?$/);
  if (isoMatch) {
    const [, y, mo, d, h, mi, sec, tz] = isoMatch;
    if (tz === 'Z' || tz === 'z') {
      const utcDate = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(sec || 0)));
      return Number.isNaN(utcDate.getTime()) ? null : utcDate;
    }
    const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(sec || 0));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  const sec = m[6] != null ? Number(m[6]) : 0;
  const date = new Date(y, mo - 1, d, h, mi, sec);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * @param {string|null|undefined} apiLike
 * @param {{ locale?: string }} [opts]
 */
export function formatAdvisoryDateTime(apiLike, { locale = 'en-US' } = {}) {
  if (apiLike == null || apiLike === '') return '';
  const date = parseApiDateTimeToLocalDate(apiLike);
  if (!date) return String(apiLike);
  const datePart = date.toLocaleDateString(locale, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const timePart = date.toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${datePart} at ${timePart}`;
}

/**
 * `datetime` attribute: local wall time as ISO-like without Z (best-effort).
 * @param {string|null|undefined} apiLike
 */
export function apiDateTimeToDatetimeLocalAttr(apiLike) {
  if (!apiLike) return undefined;
  const d = parseApiDateTimeToLocalDate(apiLike);
  if (!d) return undefined;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Short date range for infographic badge, e.g. "MARCH 16-18".
 * @param {string|null|undefined} startApi - YYYY-MM-DD HH:mm
 * @param {string|null|undefined} endApi - YYYY-MM-DD HH:mm
 */
export function formatDateRangeShort(startApi, endApi) {
  const start = parseApiDateTimeToLocalDate(startApi);
  if (!start) return '';
  const month = start.toLocaleDateString('en-US', { month: 'long' }).toUpperCase();
  const dayStart = start.getDate();
  if (endApi) {
    const end = parseApiDateTimeToLocalDate(endApi);
    if (end && end.getMonth() === start.getMonth() && end.getFullYear() === start.getFullYear()) {
      const dayEnd = end.getDate();
      if (dayEnd !== dayStart) return `${month} ${dayStart}-${dayEnd}`;
    }
  }
  return `${month} ${dayStart}`;
}

/**
 * Short time range for infographic badge, e.g. "8:00 AM - 5:00 PM".
 * @param {string|null|undefined} startApi
 * @param {string|null|undefined} endApi
 */
export function formatTimeRangeShort(startApi, endApi) {
  const start = parseApiDateTimeToLocalDate(startApi);
  const end = parseApiDateTimeToLocalDate(endApi);
  if (!start) return '';
  const startStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (!end) return startStr;
  const endStr = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${startStr} - ${endStr}`;
}

/**
 * Day-of-week short, e.g. "MON-WED".
 * @param {string|null|undefined} startApi
 * @param {string|null|undefined} endApi
 */
export function formatDayRangeShort(startApi, endApi) {
  const start = parseApiDateTimeToLocalDate(startApi);
  const end = parseApiDateTimeToLocalDate(endApi);
  if (!start) return '';
  const startDay = start.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase().slice(0, 3);
  if (!end) return startDay;
  const endDay = end.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase().slice(0, 3);
  return startDay === endDay ? startDay : `${startDay}-${endDay}`;
}

/**
 * True if public_visible_at is set and still in the future (client clock).
 * @param {string|null|undefined} publicVisibleAtApi
 */
export function isPublicVisibilityPending(publicVisibleAtApi) {
  if (!publicVisibleAtApi) return false;
  const d = parseApiDateTimeToLocalDate(publicVisibleAtApi);
  if (!d) return false;
  return d.getTime() > Date.now();
}
