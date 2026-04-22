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

/** @type {boolean|null} */
let pulledFromFeedAtSupportedCache = null;

/** @type {Promise<boolean>|null} */
let pulledFromFeedAtProbePromise = null;

function isMissingColumnError(e, col) {
  return (
    e?.code === 'ER_BAD_FIELD_ERROR' ||
    e?.errno === 1054 ||
    (typeof e?.sqlMessage === 'string' && e.sqlMessage.includes(col))
  );
}

/**
 * Detects whether aleco_interruptions.pulled_from_feed_at exists.
 * @param {import('mysql2/promise').Pool} pool
 * @returns {Promise<boolean>}
 */
export async function getAlecoInterruptionsPulledFromFeedAtSupported(pool) {
  if (pulledFromFeedAtSupportedCache !== null) {
    return pulledFromFeedAtSupportedCache;
  }
  if (!pulledFromFeedAtProbePromise) {
    pulledFromFeedAtProbePromise = probePulledFromFeedAtColumn(pool).finally(() => {
      pulledFromFeedAtProbePromise = null;
    });
  }
  return pulledFromFeedAtProbePromise;
}

async function probePulledFromFeedAtColumn(pool) {
  try {
    await pool.query('SELECT pulled_from_feed_at FROM aleco_interruptions LIMIT 0');
    pulledFromFeedAtSupportedCache = true;
    return true;
  } catch (e) {
    if (isMissingColumnError(e, 'pulled_from_feed_at')) {
      pulledFromFeedAtSupportedCache = false;
      console.warn(
        '[interruptions] Column pulled_from_feed_at missing. Run: node backend/run-migration.js backend/migrations/add_pulled_from_feed_at_interruptions.sql'
      );
      return false;
    }
    throw e;
  }
}

export function resetAlecoInterruptionsPulledFromFeedAtCache() {
  pulledFromFeedAtSupportedCache = null;
}

/** @type {boolean|null} */
let posterExtrasSupportedCache = null;

/** @type {Promise<boolean>|null} */
let posterExtrasProbePromise = null;

/**
 * Whether `affected_areas_grouped` and `poster_image_url` exist (poster alignment migration).
 * @param {import('mysql2/promise').Pool} pool
 * @returns {Promise<boolean>}
 */
export async function getAlecoInterruptionsPosterExtrasSupported(pool) {
  if (posterExtrasSupportedCache !== null) {
    return posterExtrasSupportedCache;
  }
  if (!posterExtrasProbePromise) {
    posterExtrasProbePromise = probePosterExtrasColumns(pool).finally(() => {
      posterExtrasProbePromise = null;
    });
  }
  return posterExtrasProbePromise;
}

async function probePosterExtrasColumns(pool) {
  try {
    await pool.query('SELECT affected_areas_grouped, poster_image_url FROM aleco_interruptions LIMIT 0');
    posterExtrasSupportedCache = true;
    return true;
  } catch (e) {
    if (isMissingColumnError(e, 'affected_areas_grouped') || isMissingColumnError(e, 'poster_image_url')) {
      posterExtrasSupportedCache = false;
      console.warn(
        '[interruptions] Poster extras columns missing. Run: node backend/run-migration.js backend/migrations/add_affected_areas_grouped_and_poster_image_url.sql'
      );
      return false;
    }
    throw e;
  }
}

export function resetAlecoInterruptionsPosterExtrasCache() {
  posterExtrasSupportedCache = null;
}
