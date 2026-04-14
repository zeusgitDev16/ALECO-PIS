/** Keep in sync with backend/utils/urgentKeywordMatch.js */

/** @param {string} s */
export function escapeRegExpToken(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {string | null | undefined} concern
 * @param {string[]} keywords
 * @returns {boolean}
 */
export function concernMatchesUrgentKeywords(concern, keywords) {
    if (concern == null || concern === '') return false;
    if (!Array.isArray(keywords) || keywords.length === 0) return false;

    const lowerConcern = String(concern).toLowerCase();

    return keywords.some((raw) => {
        const keyword = String(raw).trim();
        if (!keyword) return false;

        const tokens = keyword.split(/\s+/).map(escapeRegExpToken);
        const pattern = tokens.join('\\s+');
        const regex = new RegExp(`\\b${pattern}\\b`, 'i');
        return regex.test(lowerConcern);
    });
}
