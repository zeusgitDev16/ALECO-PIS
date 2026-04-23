import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

import { PH_OFFSET_HOURS } from '../config/dateTimeConfig';

// We only need the UTC plugin to ensure it reads the database correctly
dayjs.extend(utc);

/**
 * Format UTC/ISO date string to Philippine time for display.
 * Assumes input is UTC; adds 8 hours for Asia/Manila.
 * @param {string|null|undefined} dateString - ISO string or "YYYY-MM-DD HH:mm"
 * @returns {string} e.g. "March 20, 2026 at 1:30 PM"
 */
export const formatToPhilippineTime = (dateString) => {
    if (!dateString) return "Time unavailable";

    try {
        return dayjs.utc(dateString).add(PH_OFFSET_HOURS, 'hour').format('MMMM D, YYYY [at] h:mm A');
    } catch (error) {
        console.error("Day.js formatting error:", error);
        return "Time unavailable";
    }
};

/**
 * Format UTC/ISO date string to Philippine date only.
 * @param {string|null|undefined} dateString - ISO string or "YYYY-MM-DD HH:mm"
 * @returns {string} e.g. "Mar 20, 2026"
 */
export const formatToPhilippineDate = (dateString) => {
    if (!dateString) return "—";
    try {
        return dayjs.utc(dateString).add(PH_OFFSET_HOURS, 'hour').format('MMM D, YYYY');
    } catch {
        return "—";
    }
};

/**
 * Format UTC/ISO date string to Philippine time (compact).
 * @param {string|null|undefined} dateString - ISO string or "YYYY-MM-DD HH:mm"
 * @returns {string} e.g. "Mar 20, 1:30 PM"
 */
export const formatToPhilippineTimeShort = (dateString) => {
    if (!dateString) return "—";
    try {
        return dayjs.utc(dateString).add(PH_OFFSET_HOURS, 'hour').format('MMM D, h:mm A');
    } catch {
        return "—";
    }
};

/**
 * Format "now" in Philippine time for bulletin/header displays.
 * @param {{ month?: boolean, year?: boolean, weekday?: boolean, day?: boolean }} opts
 * @returns {string} e.g. "March, 2026" or "Friday, March 20, 2026"
 */
export const formatPhilippineNow = (opts = {}) => {
    const { month = false, year = false, weekday = false, day = false } = opts;
    const phNow = dayjs.utc().add(PH_OFFSET_HOURS, 'hour');
    const parts = [];
    if (weekday) parts.push(phNow.format('dddd'));
    if (month && day) parts.push(phNow.format('MMMM D'));
    else if (month) parts.push(phNow.format('MMMM'));
    else if (day) parts.push(phNow.format('D'));
    if (year) parts.push(phNow.format('YYYY'));
    return parts.join(', ');
};

/**
 * Current Philippine calendar date (long form), evaluated at call time.
 * @returns {string} e.g. "April 22, 2026"
 */
export const formatPhilippineTemplateDateNow = () =>
    dayjs.utc().add(PH_OFFSET_HOURS, 'hour').format('MMMM D, YYYY');

/**
 * Current Philippine wall-clock time (12h), evaluated at call time.
 * @returns {string} e.g. "3:45 PM"
 */
export const formatPhilippineTemplateTimeNow = () =>
    dayjs.utc().add(PH_OFFSET_HOURS, 'hour').format('h:mm A');

/**
 * Format API datetime (ISO or "YYYY-MM-DD HH:mm" Philippine) for display.
 * Handles both UTC ISO strings and wall-clock Philippine time from forms.
 * @param {string|null|undefined} apiLike - ISO string or "YYYY-MM-DD HH:mm"
 * @returns {string} e.g. "March 20, 2026 at 1:30 PM"
 */
export const formatPhilippineWallClock = (apiLike) => {
    if (!apiLike || !String(apiLike).trim()) return '';
    const s = String(apiLike).trim();
    if (/Z$/i.test(s) || /[+-]\d{2}:?\d{2}$/.test(s)) {
        return formatToPhilippineTime(s);
    }
    const normalized = s.replace(' ', 'T').slice(0, 16);
    const isoWithOffset = normalized.length >= 16 ? `${normalized}:00+08:00` : `${normalized}+08:00`;
    try {
        const d = new Date(isoWithOffset);
        if (Number.isNaN(d.getTime())) return String(apiLike);
        return new Intl.DateTimeFormat('en-PH', {
            timeZone: 'Asia/Manila',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        }).format(d);
    } catch {
        return String(apiLike);
    }
};

/**
 * Convert ISO/UTC date string to MySQL-compatible format (Philippine time).
 * Used for concurrency checks when backend compares DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i').
 * @param {string|null|undefined} isoString
 * @returns {string} e.g. "2026-03-20 13:30:00"
 */
export function toMysqlFormatPhilippine(isoString) {
    if (!isoString || !String(isoString).trim()) return '';
    try {
        return dayjs.utc(isoString).add(PH_OFFSET_HOURS, 'hour').format('YYYY-MM-DD HH:mm:ss');
    } catch {
        return '';
    }
}

/**
 * Convert ISO/UTC date string to datetime-local value (YYYY-MM-DDTHH:mm) in Philippine time.
 * Used for datetime-local inputs when API returns UTC.
 * @param {string|null|undefined} dateString
 * @returns {string} e.g. "2026-03-20T13:30"
 */
export const isoToDatetimeLocalPhilippine = (dateString) => {
    if (!dateString) return '';
    try {
        return dayjs.utc(dateString).add(PH_OFFSET_HOURS, 'hour').format('YYYY-MM-DDTHH:mm');
    } catch {
        return '';
    }
};

/**
 * True if public_visible_at (ISO/UTC) is set and still in the future.
 * @param {string|null|undefined} publicVisibleAtApi
 */
export const isPublicVisibilityPending = (publicVisibleAtApi) => {
    if (!publicVisibleAtApi) return false;
    try {
        return dayjs.utc(publicVisibleAtApi).valueOf() > Date.now();
    } catch {
        return false;
    }
};

/** Resolved advisories stay on feed for 36h after restoration. */
const RESOLVED_DISPLAY_MS = 36 * 60 * 60 * 1000;

/**
 * True if this advisory would appear on the public feed (InterruptionList).
 * Mirrors InterruptionList visibleInterruptions logic.
 * @param {object} item - Advisory DTO (deletedAt, status, publicVisibleAt, dateTimeRestored)
 * @param {number} [now] - Unix ms (default: Date.now())
 */
export function isCurrentlyOnPublicFeed(item, now = Date.now()) {
    if (!item) return false;
    if (item.deletedAt) return false;
    if (item.pulledFromFeedAt) return false;
    const pv = item.publicVisibleAt ? dayjs.utc(item.publicVisibleAt).valueOf() : 0;
    if (pv > 0 && pv > now) return false;
    if (item.status === 'Restored' || item.status === 'Energized') {
        const restored = item.dateTimeRestored ? dayjs.utc(item.dateTimeRestored).valueOf() : 0;
        if (!restored) return false;
        if (now >= restored + RESOLVED_DISPLAY_MS) return false;
    }
    return true;
}

/** Parse UTC/ISO to dayjs in Philippine time for formatting. */
function toPhilippineDayjs(dateString) {
    if (!dateString) return null;
    try {
        return dayjs.utc(dateString).add(PH_OFFSET_HOURS, 'hour');
    } catch {
        return null;
    }
}

/** Short date range for badges, e.g. "MARCH 16-18". */
export const formatToPhilippineDateRangeShort = (startApi, endApi) => {
    const start = toPhilippineDayjs(startApi);
    if (!start) return '';
    const month = start.format('MMMM').toUpperCase();
    const dayStart = start.date();
    if (endApi) {
        const end = toPhilippineDayjs(endApi);
        if (end && end.isValid() && end.month() === start.month() && end.year() === start.year()) {
            const dayEnd = end.date();
            if (dayEnd !== dayStart) return `${month} ${dayStart}-${dayEnd}`;
        }
    }
    return `${month} ${dayStart}`;
};

/** Short time range, e.g. "8:00 AM - 5:00 PM". */
export const formatToPhilippineTimeRangeShort = (startApi, endApi) => {
    const start = toPhilippineDayjs(startApi);
    if (!start) return '';
    const startStr = start.format('h:mm A');
    if (!endApi) return startStr;
    const end = toPhilippineDayjs(endApi);
    if (!end || !end.isValid()) return startStr;
    return `${startStr} - ${end.format('h:mm A')}`;
};

/** Month name only for poster date card, e.g. "APRIL". */
export const formatToPhilippineMonthOnly = (startApi) => {
    const start = toPhilippineDayjs(startApi);
    if (!start) return '';
    return start.format('MMMM').toUpperCase();
};

/** Day number(s) only for poster date card, e.g. "23" or "23-25". */
export const formatToPhilippineDayNumberRange = (startApi, endApi) => {
    const start = toPhilippineDayjs(startApi);
    if (!start) return '';
    const dayStart = start.date();
    if (endApi) {
        const end = toPhilippineDayjs(endApi);
        if (end && end.isValid() && end.month() === start.month() && end.year() === start.year()) {
            const dayEnd = end.date();
            if (dayEnd !== dayStart) return `${dayStart}-${dayEnd}`;
        }
    }
    return String(dayStart);
};

/** Day-of-week short, e.g. "MON-WED". */
export const formatToPhilippineDayRangeShort = (startApi, endApi) => {
    const start = toPhilippineDayjs(startApi);
    if (!start) return '';
    const startDay = start.format('ddd').toUpperCase();
    if (!endApi) return startDay;
    const end = toPhilippineDayjs(endApi);
    if (!end || !end.isValid()) return startDay;
    const endDay = end.format('ddd').toUpperCase();
    return startDay === endDay ? startDay : `${startDay}-${endDay}`;
};