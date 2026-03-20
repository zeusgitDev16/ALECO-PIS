/**
 * Philippine phone number utilities
 * Accepts and displays 09XXXXXXXXX format (Filipino standard)
 * Backend converts to 639XXXXXXXXX for SMS/API
 *
 * sanitizePhoneDigits must stay in sync with backend/utils/phoneUtils.js
 */

/** Same text as backend INVALID_PHONE_MESSAGE (keep in sync manually) */
export const INVALID_PHONE_HINT =
    'Invalid phone number. Use Philippine mobile: 09XXXXXXXXX (11 digits), +63 9XX XXX XXXX, or 9XXXXXXXXX (10 digits).';

/**
 * Trim, strip unicode spaces, then digits only — same rules as backend sanitizePhoneDigits.
 * @param {unknown} input
 * @returns {string}
 */
export function sanitizePhoneDigits(input) {
    if (input == null) return '';
    let s = String(input).trim();
    if (!s) return '';
    s = s.replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ');
    return s.replace(/\D/g, '');
}

/**
 * True if digits (after sanitize + optional 00 strip) form a valid PH mobile for DB.
 * @param {string} digits - digits only
 */
function isValidPhilippineMobileDigits(digits) {
    let d = digits;
    if (d.startsWith('00')) d = d.slice(2);
    if (d.startsWith('63') && d.length === 12) {
        const sub = d.slice(2);
        return sub.length === 10 && sub.startsWith('9');
    }
    if (d.startsWith('0') && d.length === 11) {
        return d.charAt(1) === '9';
    }
    if (d.startsWith('9') && d.length === 10) return true;
    return false;
}

/**
 * Convert DB/API format (63xxx or +63xxx) to display format (09xxx)
 * @param {string} phone - Phone from DB (e.g. 639123456789, +639123456789)
 * @returns {string} Display format (e.g. 09123456789) or original if no conversion needed
 */
export const toDisplayFormat = (phone) => {
    if (!phone || typeof phone !== 'string') return '';
    const cleaned = phone.trim();
    let digits = sanitizePhoneDigits(cleaned);
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.startsWith('63') && digits.length === 12) {
        const sub = digits.slice(2);
        if (sub.startsWith('9') && sub.length === 10) return `0${sub}`;
    }
    if (digits.startsWith('0') && digits.length === 11 && digits.charAt(1) === '9') return digits;
    if (digits.startsWith('9') && digits.length === 10) return `0${digits}`;
    return cleaned;
};

/**
 * Format phone for table/card display with spaces (09XX XXX XXXX)
 * @param {string} phone - Raw phone from DB or display format
 * @returns {string} Readable format e.g. "09XX XXX XXXX"; landlines pass through
 */
export const formatPhoneDisplay = (phone) => {
    const display = toDisplayFormat(phone);
    if (!display || typeof display !== 'string') return display;
    if (display.startsWith('09') && display.length === 11) {
        return `${display.slice(0, 4)} ${display.slice(4, 7)} ${display.slice(7)}`;
    }
    return display;
};

/**
 * Normalize user input for API (trim; backend normalizes to 639…)
 * @param {string} phone - User input
 * @returns {string}
 */
export const normalizeForSubmit = (phone) => {
    if (!phone || typeof phone !== 'string') return '';
    return phone.trim();
};

/**
 * Validate Philippine mobile number — mirrors backend normalizePhoneForDB acceptance.
 * @param {string} phone - User input (digits only or with formatting)
 * @returns {{ valid: boolean, error?: string }}
 */
export const validatePhilippineMobile = (phone) => {
    if (!phone || typeof phone !== 'string') {
        return { valid: false, error: 'Phone number is required' };
    }
    const digits = sanitizePhoneDigits(phone);
    if (digits.length === 0) {
        return { valid: false, error: 'Phone number is required' };
    }
    if (digits.length < 10) {
        return { valid: false, error: 'Too short. Use 09…, +63…, or 9XXXXXXXXX (10 digits).' };
    }
    if (digits.length > 15) {
        return { valid: false, error: 'Phone number is too long' };
    }
    if (!isValidPhilippineMobileDigits(digits)) {
        return {
            valid: false,
            error: 'Use Philippine mobile: 09XXXXXXXXX, +63 9XX XXX XXXX, or 9XXXXXXXXX.'
        };
    }
    return { valid: true };
};
