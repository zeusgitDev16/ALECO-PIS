/**
 * Detects whether `aleco_interruptions.deleted_at` exists (soft-delete migration applied).
 * Result is cached for the process lifetime.
 * @param {import('mysql2/promise').Pool} pool
 * @returns {Promise<boolean>}
 */
export async function getAlecoInterruptionsDeletedAtSupported(pool) {
  if (deletedAtSupportedCache !== null) {
    return deletedAtSupportedCache;
  }
  if (!deletedAtProbePromise) {
    deletedAtProbePromise = probeDeletedAtColumn(pool).finally(() => {
      deletedAtProbePromise = null;
    });
  }
  return deletedAtProbePromise;
}

/** @type {boolean|null} */
let deletedAtSupportedCache = null;

/** @type {Promise<boolean>|null} */
let deletedAtProbePromise = null;

function isMissingDeletedAtError(e) {
  return (
    e?.code === 'ER_BAD_FIELD_ERROR' ||
    e?.errno === 1054 ||
    (typeof e?.sqlMessage === 'string' && e.sqlMessage.includes('deleted_at'))
  );
}

async function probeDeletedAtColumn(pool) {
  try {
    await pool.query('SELECT deleted_at FROM aleco_interruptions LIMIT 0');
    deletedAtSupportedCache = true;
    return true;
  } catch (e) {
    if (isMissingDeletedAtError(e)) {
      deletedAtSupportedCache = false;
      console.warn(
        '[interruptions] Column deleted_at missing on aleco_interruptions — lists use legacy mode. Run: node backend/run-migration.js backend/migrations/add_deleted_at_aleco_interruptions.sql'
      );
      return false;
    }
    throw e;
  }
}

/** For tests or after migrations in same process (optional). */
export function resetAlecoInterruptionsDeletedAtCache() {
  deletedAtSupportedCache = null;
}
