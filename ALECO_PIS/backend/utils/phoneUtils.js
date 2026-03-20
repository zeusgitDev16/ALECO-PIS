/**
 * Philippine phone number utilities for backend
 * Normalizes to 639XXXXXXXXX (12 digits) for PhilSMS API and DB storage
 *
 * Keep sanitizePhoneDigits logic in sync with src/utils/phoneUtils.js
 */

/** User-facing hint (reuse in 400 responses where applicable) */
export const INVALID_PHONE_MESSAGE =
    'Invalid phone number. Use Philippine mobile: 09XXXXXXXXX (11 digits), +63 9XX XXX XXXX, or 9XXXXXXXXX (10 digits).';

/**
 * Trim, strip unicode spaces, then digits only — same rules as frontend sanitizePhoneDigits.
 * @param {unknown} input
 * @returns {string} digits only (may be empty)
 */
export function sanitizePhoneDigits(input) {
    if (input == null) return '';
    let s = String(input).trim();
    if (!s) return '';
    s = s.replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ');
    return s.replace(/\D/g, '');
}

/**
 * Normalize phone for SMS sending (PhilSMS expects 639171234567 format)
 * @param {string} phone - Raw phone (09xxx, +63xxx, 63xxx, 9xxxxxxxxx)
 * @returns {string|null} 639XXXXXXXXX (12 digits) or null if invalid
 */
export function normalizePhoneForSMS(phone) {
    return normalizePhoneForDB(phone);
}

/**
 * Normalize phone for DB storage and lookups
 * @param {string} phone - Raw phone from user input or API
 * @returns {string|null} 639XXXXXXXXX (12 digits) or null if invalid
 */
export function normalizePhoneForDB(phone) {
    if (phone == null || typeof phone !== 'string') return null;

    let digits = sanitizePhoneDigits(phone);
    if (digits.length === 0) return null;

    // International access prefix 00 (e.g. 00639171234567)
    if (digits.startsWith('00')) {
        digits = digits.slice(2);
    }

    let normalized;
    if (digits.startsWith('63') && digits.length === 12) {
        normalized = digits;
    } else if (digits.startsWith('0') && digits.length === 11) {
        normalized = '63' + digits.substring(1);
    } else if (digits.startsWith('9') && digits.length === 10) {
        normalized = '63' + digits;
    } else {
        return null;
    }

    if (normalized.length !== 12 || !normalized.startsWith('63')) return null;
    const subscriber = normalized.slice(2);
    if (!subscriber.startsWith('9') || subscriber.length !== 10) return null;

    return normalized;
}
