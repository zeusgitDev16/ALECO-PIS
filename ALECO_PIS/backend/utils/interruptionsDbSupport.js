import { parseMysqlEnumColumnType } from './interruptionTypeDbEnum.js';

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

/** @type {Set<string>|null|undefined} undefined = unknown, null = not enum / no row */
let interruptionTypeEnumCache;

/** @type {Promise<Set<string>|null>|null} */
let interruptionTypeEnumLoadPromise = null;

/**
 * Literals allowed by `aleco_interruptions.type` (MySQL ENUM), or null if unknown / not ENUM.
 * Cached for the process lifetime.
 * @param {import('mysql2/promise').Pool} pool
 * @returns {Promise<Set<string>|null>}
 */
export async function getAlecoInterruptionsTypeDbEnum(pool) {
  if (interruptionTypeEnumCache !== undefined) {
    return interruptionTypeEnumCache;
  }
  if (!interruptionTypeEnumLoadPromise) {
    interruptionTypeEnumLoadPromise = loadInterruptionTypeEnum(pool).finally(() => {
      interruptionTypeEnumLoadPromise = null;
    });
  }
  return interruptionTypeEnumLoadPromise;
}

/** For tests or after manual DDL in the same process. */
export function resetAlecoInterruptionsTypeEnumCache() {
  interruptionTypeEnumCache = undefined;
}

/**
 * @param {import('mysql2/promise').Pool} pool
 * @returns {Promise<Set<string>|null>}
 */
async function loadInterruptionTypeEnum(pool) {
  try {
    let ct = null;
    const [rows] = await pool.query(
      `SELECT COLUMN_TYPE AS ct FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'aleco_interruptions' AND COLUMN_NAME = 'type'
       LIMIT 1`
    );
    ct = rows?.[0]?.ct;
    if (!ct) {
      const [showRows] = await pool.query("SHOW COLUMNS FROM aleco_interruptions LIKE 'type'");
      ct = showRows?.[0]?.Type;
    }
    if (!ct) {
      interruptionTypeEnumCache = null;
      return null;
    }
    const parsed = parseMysqlEnumColumnType(ct);
    interruptionTypeEnumCache = parsed;
    return parsed;
  } catch (e) {
    console.warn('[interruptions] Could not read type ENUM from INFORMATION_SCHEMA:', e?.message || e);
    interruptionTypeEnumCache = null;
    return null;
  }
}

/** @type {Set<string>|null|undefined} */
let interruptionStatusEnumCache;

/** @type {Promise<Set<string>|null>|null} */
let interruptionStatusEnumLoadPromise = null;

/**
 * Literals allowed by `aleco_interruptions.status` (MySQL ENUM), or null if unknown.
 * @param {import('mysql2/promise').Pool} pool
 * @returns {Promise<Set<string>|null>}
 */
export async function getAlecoInterruptionsStatusDbEnum(pool) {
  if (interruptionStatusEnumCache !== undefined) {
    return interruptionStatusEnumCache;
  }
  if (!interruptionStatusEnumLoadPromise) {
    interruptionStatusEnumLoadPromise = loadInterruptionStatusEnum(pool).finally(() => {
      interruptionStatusEnumLoadPromise = null;
    });
  }
  return interruptionStatusEnumLoadPromise;
}

export function resetAlecoInterruptionsStatusEnumCache() {
  interruptionStatusEnumCache = undefined;
}

/**
 * @param {import('mysql2/promise').Pool} pool
 * @returns {Promise<Set<string>|null>}
 */
async function loadInterruptionStatusEnum(pool) {
  try {
    let ct = null;
    const [rows] = await pool.query(
      `SELECT COLUMN_TYPE AS ct FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'aleco_interruptions' AND COLUMN_NAME = 'status'
       LIMIT 1`
    );
    ct = rows?.[0]?.ct;
    if (!ct) {
      const [showRows] = await pool.query("SHOW COLUMNS FROM aleco_interruptions LIKE 'status'");
      ct = showRows?.[0]?.Type;
    }
    if (!ct) {
      interruptionStatusEnumCache = null;
      return null;
    }
    const parsed = parseMysqlEnumColumnType(ct);
    interruptionStatusEnumCache = parsed;
    return parsed;
  } catch (e) {
    console.warn('[interruptions] Could not read status ENUM from INFORMATION_SCHEMA:', e?.message || e);
    interruptionStatusEnumCache = null;
    return null;
  }
}
