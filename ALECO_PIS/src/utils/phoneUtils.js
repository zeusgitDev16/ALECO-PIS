/**
 * Philippine phone number utilities
 * Accepts and displays 09XXXXXXXXX format (Filipino standard)
 * Backend converts to 63XXXXXXXXX for SMS/API
 */

/**
 * Convert DB/API format (63xxx or +63xxx) to display format (09xxx)
 * @param {string} phone - Phone from DB (e.g. 639123456789, +639123456789)
 * @returns {string} Display format (e.g. 09123456789) or original if no conversion needed
 */
export const toDisplayFormat = (phone) => {
    if (!phone || typeof phone !== 'string') return '';
    const cleaned = phone.trim();
    if (cleaned.startsWith('+63')) return '0' + cleaned.substring(3);
    if (cleaned.startsWith('63') && cleaned.length >= 11) return '0' + cleaned.substring(2);
    if (cleaned.startsWith('9') && cleaned.length === 10) return '09' + cleaned;
    return cleaned;
};

/**
 * Format phone for table/card display with spaces (09XX XXX XXXX)
 * @param {string} phone - Raw phone from DB or display format
 * @returns {string} Readable format e.g. "09XX XXX XXXX"
 */
export const formatPhoneDisplay = (phone) => {
    const display = toDisplayFormat(phone);
    if (!display || typeof display !== 'string') return display;
    // 09XX XXX XXXX (Philippine 11-digit mobile)
    if (display.startsWith('09') && display.length === 11) {
        return `${display.slice(0, 4)} ${display.slice(4, 7)} ${display.slice(7)}`;
    }
    return display;
};

/**
 * Normalize user input for API (ensure 09xxx is accepted; backend converts 0xxx -> 63xxx)
 * User can type: 09xxx, 9xxx, 63xxx, +63xxx - we pass through, backend normalizes
 * @param {string} phone - User input
 * @returns {string} Trimmed value (backend handles 0 -> 63 conversion)
 */
export const normalizeForSubmit = (phone) => {
    if (!phone || typeof phone !== 'string') return '';
    return phone.trim();
};
