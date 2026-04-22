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
 * Next memo # for a prefix — **preview only** (MAX from saved memos + 1). Does not reserve or increment
 * anything until POST /service-memos inserts the memo row.
 * @param {import('mysql2/promise').Pool} pool
 * @param {string} prefixUpper
 * @returns {Promise<string>}
 */
export async function peekNextMemoControlNumber(pool, prefixUpper) {
  const p = String(prefixUpper).toUpperCase();
  if (!/^[A-Z]{3}$/.test(p)) {
    throw new Error('INVALID_MEMO_PREFIX');
  }
  const [maxRows] = await pool.execute(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(control_number, 5) AS UNSIGNED)), 0) AS m
     FROM aleco_service_memos
     WHERE CHAR_LENGTH(control_number) = 14
       AND SUBSTRING(control_number, 4, 1) = '-'
       AND UPPER(SUBSTRING(control_number, 1, 3)) = ?`,
    [p]
  );
  const maxVal = Number(maxRows[0]?.m ?? 0);
  return formatMemoControlNumber(p, maxVal + 1);
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
