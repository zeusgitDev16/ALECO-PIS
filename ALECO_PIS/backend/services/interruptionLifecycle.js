import { mapUpdateRowToDto } from '../utils/interruptionsDto.js';
import { nowPhilippineForMysql } from '../utils/dateTimeUtils.js';
import { getAlecoInterruptionsDeletedAtSupported } from '../utils/interruptionsDbSupport.js';
import { RESOLVED_ARCHIVE_HOURS } from '../constants/interruptionConstants.js';

const SYSTEM_START_REMARK =
  'Status set to Ongoing automatically at scheduled outage start time.';

/**
 * @param {import('mysql2/promise').Pool} pool
 * @param {number} interruptionId
 */
export async function listUpdates(pool, interruptionId) {
  const [rows] = await pool.execute(
    `SELECT id, interruption_id, remark, kind, actor_email, actor_name, created_at
     FROM aleco_interruption_updates
     WHERE interruption_id = ?
     ORDER BY created_at ASC, id ASC`,
    [interruptionId]
  );
  return Array.isArray(rows) ? rows.map((r) => mapUpdateRowToDto(r)).filter(Boolean) : [];
}

/**
 * @param {import('mysql2/promise').Pool} pool
 * @param {number} interruptionId
 */
export async function countUserMemos(pool, interruptionId) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS c FROM aleco_interruption_updates
     WHERE interruption_id = ? AND kind = 'user'`,
    [interruptionId]
  );
  const n = rows[0]?.c;
  return typeof n === 'bigint' ? Number(n) : parseInt(String(n ?? 0), 10) || 0;
}

/**
 * @param {import('mysql2/promise').Pool} pool
 * @param {number} interruptionId
 * @param {{ remark: string, actorEmail?: string|null, actorName?: string|null }} opts
 */
export async function addUserUpdate(pool, interruptionId, { remark, actorEmail, actorName }) {
  const text = String(remark ?? '').trim();
  if (!text) {
    const err = new Error('remark is required');
    err.statusCode = 400;
    throw err;
  }
  const phNow = nowPhilippineForMysql();
  const [result] = await pool.execute(
    `INSERT INTO aleco_interruption_updates (interruption_id, remark, kind, actor_email, actor_name, created_at)
     VALUES (?, ?, 'user', ?, ?, ?)`,
    [interruptionId, text, actorEmail ?? null, actorName ?? null, phNow]
  );
  const insertId = result.insertId;
  const [rows] = await pool.execute(
    `SELECT id, interruption_id, remark, kind, actor_email, actor_name, created_at
     FROM aleco_interruption_updates WHERE id = ?`,
    [insertId]
  );
  return rows[0] ? mapUpdateRowToDto(rows[0]) : null;
}

/**
 * @param {import('mysql2/promise').Pool} pool
 * @param {number} interruptionId
 * @param {string} remark
 * @param {{ actorEmail?: string|null, actorName?: string|null }} [opts]
 */
export async function insertSystemUpdate(pool, interruptionId, remark, { actorEmail, actorName } = {}) {
  const phNow = nowPhilippineForMysql();
  await pool.execute(
    `INSERT INTO aleco_interruption_updates (interruption_id, remark, kind, actor_email, actor_name, created_at)
     VALUES (?, ?, 'system', ?, ?, ?)`,
    [interruptionId, remark, actorEmail ?? null, actorName ?? null, phNow]
  );
}

/**
 * @param {import('mysql2/promise').Pool} pool
 * @param {import('mysql2/promise').PoolConnection} conn
 * @param {number} interruptionId
 * @param {string} remark
 */
export async function insertSystemUpdateConn(conn, interruptionId, remark) {
  const phNow = nowPhilippineForMysql();
  await conn.execute(
    `INSERT INTO aleco_interruption_updates (interruption_id, remark, kind, actor_email, actor_name, created_at)
     VALUES (?, ?, 'system', NULL, NULL, ?)`,
    [interruptionId, remark, phNow]
  );
}

/**
 * Auto-archive Restored advisories that have been resolved for more than 1 day 12 hours (36h).
 * Runs independently of API requests so public display hides them even if nobody fetches.
 * @param {import('mysql2/promise').Pool} pool
 * @returns {Promise<{ archived: number }>}
 */
export async function autoArchiveResolvedInterruptions(pool) {
  const hasDel = await getAlecoInterruptionsDeletedAtSupported(pool);
  if (!hasDel) return { archived: 0 };
  const phNow = nowPhilippineForMysql();
  const [result] = await pool.query(
    `UPDATE aleco_interruptions SET deleted_at = ? WHERE status = 'Restored' AND deleted_at IS NULL
     AND date_time_restored IS NOT NULL AND DATE_ADD(date_time_restored, INTERVAL ? HOUR) <= ?`,
    [phNow, RESOLVED_ARCHIVE_HOURS, phNow]
  );
  const archived = result?.affectedRows ?? 0;
  if (archived > 0) {
    console.log(`[interruptions] Auto-archived ${archived} Resolved advisory(ies) past ${RESOLVED_ARCHIVE_HOURS}h.`);
  }
  return { archived };
}

/**
 * Scheduled advisories: Pending → Ongoing when start time reached; one system memo each.
 * @param {import('mysql2/promise').Pool} pool
 */
export async function transitionScheduledStarts(pool) {
  const hasDel = await getAlecoInterruptionsDeletedAtSupported(pool);
  const delClause = hasDel ? ' AND deleted_at IS NULL' : '';
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [pending] = await conn.query(
      `SELECT id FROM aleco_interruptions
       WHERE type = 'Scheduled' AND status = 'Pending' AND date_time_start <= NOW()${delClause}
       FOR UPDATE`
    );
    const rows = Array.isArray(pending) ? pending : [];
    if (rows.length === 0) {
      await conn.commit();
      return { transitioned: 0 };
    }
    const ids = rows.map((r) => r.id);
    const placeholders = ids.map(() => '?').join(',');
    await conn.query(
      `UPDATE aleco_interruptions SET status = 'Ongoing' WHERE id IN (${placeholders})`,
      ids
    );
    for (const id of ids) {
      await insertSystemUpdateConn(conn, id, SYSTEM_START_REMARK);
    }
    await conn.commit();
    return { transitioned: ids.length };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
