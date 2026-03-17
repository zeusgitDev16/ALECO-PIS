/**
 * Philippine phone number utilities for backend
 * Normalizes to 63XXXXXXXXX (11 digits) for PhilSMS API and DB storage
 */

/**
 * Normalize phone for SMS sending (PhilSMS expects 639171234567 format)
 * @param {string} phone - Raw phone (09xxx, +63xxx, 63xxx, 9xxxxxxxxx)
 * @returns {string|null} 63XXXXXXXXX or null if invalid
 */
export function normalizePhoneForSMS(phone) {
    return normalizePhoneForDB(phone);
}

/**
 * Normalize phone for DB storage and lookups
 * @param {string} phone - Raw phone from user input or API
 * @returns {string|null} 63XXXXXXXXX (11 digits) or null if invalid
 */
export function normalizePhoneForDB(phone) {
    if (!phone || typeof phone !== 'string') return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 0) return null;

    let normalized;
    if (digits.startsWith('63') && digits.length === 11) {
        normalized = digits;
    } else if (digits.startsWith('0') && digits.length === 11) {
        normalized = '63' + digits.substring(1);
    } else if (digits.startsWith('9') && digits.length === 10) {
        normalized = '63' + digits;
    } else {
        return null;
    }

    return normalized.length === 11 ? normalized : null;
}
