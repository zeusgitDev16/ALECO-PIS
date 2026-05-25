import { mapUpdateRowToDto } from '../utils/interruptionsDto.js';
import { nowPhilippineForMysql } from '../utils/dateTimeUtils.js';
import { getAlecoInterruptionsDeletedAtSupported, getAlecoInterruptionsStatusDbEnum } from '../utils/interruptionsDbSupport.js';
import { RESOLVED_ARCHIVE_HOURS } from '../constants/interruptionConstants.js';
import { INTERRUPTION_SCHEDULED_LIKE_TYPES } from '../constants/interruptionFieldEnums.js';
import { insertInterruptionLog } from '../utils/interruptionLogHelper.js';
import { apiInterruptionStatusToDbLiteral } from '../utils/interruptionTypeDbEnum.js';

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
 * Auto-archive Energized, Cancelled, and Rescheduled advisories past the resolved display window (168h).
 * Runs independently of API requests so public display hides them even if nobody fetches.
 * Energized: from date_time_restored (restoration time)
 * Cancelled/Rescheduled: from updated_at (when status changed)
 * @param {import('mysql2/promise').Pool} pool
 * @returns {Promise<{ archived: number }>}
 */
export async function autoArchiveResolvedInterruptions(pool) {
  const hasDel = await getAlecoInterruptionsDeletedAtSupported(pool);
  if (!hasDel) return { archived: 0 };
  const statusDbEnum = await getAlecoInterruptionsStatusDbEnum(pool);
  const energizedDbLiteral = apiInterruptionStatusToDbLiteral('Energized', statusDbEnum).status ?? 'Energized';
  const cancelledDbLiteral = apiInterruptionStatusToDbLiteral('Cancelled', statusDbEnum).status ?? 'Cancelled';
  const rescheduledDbLiteral = apiInterruptionStatusToDbLiteral('Rescheduled', statusDbEnum).status ?? 'Rescheduled';
  const phNow = nowPhilippineForMysql();
  
  let totalArchived = 0;
  
  // Archive Energized advisories based on restoration time
  const [energizedResult] = await pool.query(
    `UPDATE aleco_interruptions SET deleted_at = ? WHERE status = '${energizedDbLiteral}' AND deleted_at IS NULL
     AND date_time_restored IS NOT NULL AND DATE_ADD(date_time_restored, INTERVAL ? HOUR) <= ?`,
    [phNow, RESOLVED_ARCHIVE_HOURS, phNow]
  );
  totalArchived += energizedResult?.affectedRows ?? 0;
  
  // Archive Cancelled advisories based on updated_at
  const [cancelledResult] = await pool.query(
    `UPDATE aleco_interruptions SET deleted_at = ? WHERE status = '${cancelledDbLiteral}' AND deleted_at IS NULL
     AND DATE_ADD(updated_at, INTERVAL ? HOUR) <= ?`,
    [phNow, RESOLVED_ARCHIVE_HOURS, phNow]
  );
  totalArchived += cancelledResult?.affectedRows ?? 0;
  
  // Archive Rescheduled advisories based on updated_at
  const [rescheduledResult] = await pool.query(
    `UPDATE aleco_interruptions SET deleted_at = ? WHERE status = '${rescheduledDbLiteral}' AND deleted_at IS NULL
     AND DATE_ADD(updated_at, INTERVAL ? HOUR) <= ?`,
    [phNow, RESOLVED_ARCHIVE_HOURS, phNow]
  );
  totalArchived += rescheduledResult?.affectedRows ?? 0;
  
  if (totalArchived > 0) {
    console.log(`[interruptions] Auto-archived ${totalArchived} advisory(ies) past ${RESOLVED_ARCHIVE_HOURS}h.`);
  }
  return { archived: totalArchived };
}

/**
 * Transactionally transitions Pending -> Ongoing (auto-live) and Ongoing/Pending -> Energized (auto-restore)
 * when their scheduled times pass.
 * @param {import('mysql2/promise').Pool} pool
 */
export async function runAutoTransitions(pool) {
  const hasDel = await getAlecoInterruptionsDeletedAtSupported(pool);
  const delClause = hasDel ? ' AND deleted_at IS NULL' : '';
  const statusDbEnum = await getAlecoInterruptionsStatusDbEnum(pool);
  const energizedDbLiteral = apiInterruptionStatusToDbLiteral('Energized', statusDbEnum).status ?? 'Energized';
  const phNow = nowPhilippineForMysql();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Pending -> Ongoing (auto-live)
    const upgradeWhere = `status = 'Pending'${delClause} AND (COALESCE(public_visible_at, date_time_start) <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))`;
    const [upgradeCandidates] = await conn.query(
      `SELECT id, type, status, feeder, date_time_start, public_visible_at, poster_image_url 
       FROM aleco_interruptions 
       WHERE ${upgradeWhere} FOR UPDATE`
    );
    
    let goLivePosterCandidates = [];
    if (upgradeCandidates.length > 0) {
      const upgradeIds = upgradeCandidates.map(c => c.id);
      const upgradePlaceholders = upgradeIds.map(() => '?').join(',');
      await conn.query(
        `UPDATE aleco_interruptions SET status = 'Ongoing', updated_at = ? WHERE id IN (${upgradePlaceholders})`,
        [phNow, ...upgradeIds]
      );
      for (const c of upgradeCandidates) {
        await insertSystemUpdateConn(conn, c.id, SYSTEM_START_REMARK);
        await insertInterruptionLog(conn, {
          interruption_id: c.id,
          action: 'status_change',
          from_status: 'Pending',
          to_status: 'Ongoing',
          actor_type: 'system',
          actor_name: 'System',
          metadata: { remark: 'Advisory automatically marked as Ongoing (go-live time reached).' }
        });
        
        if (!c.poster_image_url || !String(c.poster_image_url).trim()) {
          goLivePosterCandidates.push(c);
        }
      }
    }

    // 2. Ongoing/Pending -> Energized (auto-restore)
    const autoRestoreWhere = `status IN ('Pending','Ongoing')${delClause} AND scheduled_restore_at IS NOT NULL AND scheduled_restore_at <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR)`;
    const [dueRows] = await conn.query(
      `SELECT id, status, scheduled_restore_remark, feeder FROM aleco_interruptions WHERE ${autoRestoreWhere} FOR UPDATE`
    );
    for (const due of dueRows) {
      await conn.execute(
        `UPDATE aleco_interruptions SET status = ?, date_time_restored = ?, scheduled_restore_at = NULL, updated_at = ? WHERE id = ?`,
        [energizedDbLiteral, phNow, phNow, due.id]
      );
      const remark = due.scheduled_restore_remark
        ? String(due.scheduled_restore_remark).trim()
        : 'Automatically restored per schedule.';
      
      await insertSystemUpdateConn(conn, due.id, `Auto-restored: ${remark}`);

      await insertInterruptionLog(conn, {
        interruption_id: due.id,
        action: 'status_change',
        from_status: due.status === 'Restored' ? 'Energized' : due.status,
        to_status: energizedDbLiteral === 'Restored' ? 'Energized' : energizedDbLiteral,
        actor_type: 'system',
        actor_name: 'System',
        metadata: { remark: remark }
      });
    }

    await conn.commit();
    return {
      transitioned: upgradeCandidates.length,
      restored: dueRows.length,
      goLivePosterCandidates
    };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
