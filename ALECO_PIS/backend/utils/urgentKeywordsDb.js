const MAX_KEYWORD_LEN = 128;

/**
 * @param {import('mysql2/promise').Pool} pool
 * @returns {Promise<string[]>}
 */
export async function listUrgentKeywords(pool) {
    const [rows] = await pool.execute(
        `SELECT keyword FROM aleco_urgent_keywords ORDER BY display_order ASC, id ASC`
    );
    return Array.isArray(rows) ? rows.map((r) => String(r.keyword)) : [];
}

/**
 * Replace all keywords (transaction). Normalizes: trim, lowercase, dedupe (first wins), max length.
 * @param {import('mysql2/promise').Pool} pool
 * @param {unknown} rawList
 * @returns {Promise<string[]>} normalized list saved
 */
export async function replaceUrgentKeywords(pool, rawList) {
    if (!Array.isArray(rawList)) {
        throw new TypeError('keywords must be an array');
    }

    const seen = new Set();
    const normalized = [];
    for (const item of rawList) {
        const s = String(item ?? '')
            .trim()
            .toLowerCase()
            .slice(0, MAX_KEYWORD_LEN);
        if (!s) continue;
        const key = s;
        if (seen.has(key)) continue;
        seen.add(key);
        normalized.push(s);
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.execute(`DELETE FROM aleco_urgent_keywords`);
        let order = 0;
        for (const keyword of normalized) {
            order += 1;
            await conn.execute(
                `INSERT INTO aleco_urgent_keywords (keyword, display_order) VALUES (?, ?)`,
                [keyword, order]
            );
        }
        await conn.commit();
    } catch (e) {
        await conn.rollback();
        throw e;
    } finally {
        conn.release();
    }

    return normalized;
}
