import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

// We only need the UTC plugin to ensure it reads the database correctly
dayjs.extend(utc);

const PH_OFFSET_HOURS = 8;

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