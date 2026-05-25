/**
 * Service memo control number: {PREFIX}-{10-digit-seq} (e.g. LEG-0000089729).
 * PREFIX is 3 letters from ticket municipality (see ALECO district map in routes/tickets.js).
 * Malinao / Malilipot both start with "Mal—" as full names; explicit codes avoid collision.
 */

/** @type {Record<string, string>} Exact municipality string (DB) → 3-letter prefix */
export const MUNICIPALITY_TO_MEMO_PREFIX = {
  // First District (North Albay)
  Bacacay: 'BAC',
  Malilipot: 'MLP', // would collide with Malinao as "Mal…"
  Malinao: 'MLN',
  'Santo Domingo': 'SAN',
  'Tabaco City': 'TAB',
  Tiwi: 'TIW',
  // Second District (Central Albay)
  Camalig: 'CAM',
  Daraga: 'DAR',
  'Legazpi City': 'LEG',
  Manito: 'MAN',
  'Rapu-Rapu': 'RAP',
  // Third District (South Albay)
  Guinobatan: 'GUI',
  Jovellar: 'JOV',
  Libon: 'LIB',
  'Ligao City': 'LIG',
  Oas: 'OAS',
  'Pio Duran': 'PIO',
  Polangui: 'POL',
};

const NEW_MEMO_CONTROL_RE = /^[A-Z]{3}-\d{10}$/;

/**
 * @param {string|null|undefined} municipality
 * @returns {string|null}
 */
export function municipalityToMemoPrefix(municipality) {
  if (municipality == null || typeof municipality !== 'string') return null;
  const key = municipality.trim().replace(/\s+/g, ' ');
  if (!key) return null;
  if (MUNICIPALITY_TO_MEMO_PREFIX[key]) return MUNICIPALITY_TO_MEMO_PREFIX[key];
  const lower = key.toLowerCase();
  for (const [k, v] of Object.entries(MUNICIPALITY_TO_MEMO_PREFIX)) {
    if (k.toLowerCase() === lower) return v;
  }
  return null;
}

/**
 * Next memo # for a prefix — uses sequence table for unique, non-repeating numbers.
 * Atomically increments and returns the next sequence number.
 * @param {import('mysql2/promise').Pool} pool
 * @param {string} prefixUpper
 * @param {import('mysql2/promise').PoolConnection} [existingConnection] - Optional existing connection (for use within transactions)
 * @returns {Promise<string>}
 */
export async function peekNextMemoControlNumber(pool, prefixUpper, existingConnection) {
  const p = String(prefixUpper).toUpperCase();
  if (!/^[A-Z]{3}$/.test(p)) {
    throw new Error('INVALID_MEMO_PREFIX');
  }

  const useOwnTransaction = !existingConnection;
  const connection = existingConnection || await pool.getConnection();

  try {
    if (useOwnTransaction) {
      await connection.beginTransaction();
    }

    // Ensure row exists for this prefix
    await connection.execute(
      `INSERT IGNORE INTO aleco_service_memo_prefix_seq (prefix, next_seq) VALUES (?, 1)`,
      [p]
    );

    // Get current sequence and increment atomically
    const [rows] = await connection.execute(
      `SELECT next_seq FROM aleco_service_memo_prefix_seq WHERE prefix = ? FOR UPDATE`,
      [p]
    );

    if (rows.length === 0) {
      throw new Error('Failed to initialize sequence for prefix');
    }

    const currentSeq = Number(rows[0].next_seq);
    const nextSeq = currentSeq;

    // Increment for next time
    await connection.execute(
      `UPDATE aleco_service_memo_prefix_seq SET next_seq = next_seq + 1 WHERE prefix = ?`,
      [p]
    );

    if (useOwnTransaction) {
      await connection.commit();
      connection.release();
    }

    return formatMemoControlNumber(p, nextSeq);
  } catch (error) {
    if (useOwnTransaction) {
      await connection.rollback();
      connection.release();
    }
    throw error;
  }
}

/**
 * @param {string} prefix - 3 uppercase letters
 * @param {number} seq - positive integer
 * @returns {string}
 */
export function formatMemoControlNumber(prefix, seq) {
  const p = String(prefix || '').toUpperCase();
  const n = Math.floor(Number(seq));
  if (!/^[A-Z]{3}$/.test(p) || !Number.isFinite(n) || n < 1 || n > 9999999999) {
    throw new Error('Invalid prefix or sequence for memo control number.');
  }
  return `${p}-${String(n).padStart(10, '0')}`;
}

/**
 * @param {string|null|undefined} controlNumber
 * @returns {boolean}
 */
export function isValidNewMemoControlNumberFormat(controlNumber) {
  if (controlNumber == null || typeof controlNumber !== 'string') return false;
  return NEW_MEMO_CONTROL_RE.test(controlNumber.trim());
}
