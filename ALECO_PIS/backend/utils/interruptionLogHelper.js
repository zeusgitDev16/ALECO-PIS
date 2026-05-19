/**
 * Interruption Log Helper - Full CRUD audit trail for interruption advisories.
 * Tracks create, update, delete, archive, restore, status changes, and feed operations.
 */

import { nowPhilippineForMysql } from './dateTimeUtils.js';

/**
 * @param {import('mysql2/promise').Pool} pool
 * @param {Object} opts
 * @param {number} opts.interruption_id
 * @param {string} opts.action - create | update | delete | restore | status_change | pull_feed | push_feed | generate_poster
 * @param {string} [opts.field_changed] - which field was modified (for updates)
 * @param {string} [opts.old_value] - previous value
 * @param {string} [opts.new_value] - new value
 * @param {string} [opts.from_status] - status before (for status_change)
 * @param {string} [opts.to_status] - status after
 * @param {'user'|'system'} [opts.actor_type='user']
 * @param {number} [opts.actor_id]
 * @param {string} [opts.actor_email]
 * @param {string} [opts.actor_name]
 * @param {Object} [opts.metadata] - JSON-serializable object
 * @param {string} [opts.ip_address]
 */
export async function insertInterruptionLog(pool, {
  interruption_id,
  action,
  field_changed = null,
  old_value = null,
  new_value = null,
  from_status = null,
  to_status = null,
  actor_type = 'user',
  actor_id = null,
  actor_email = null,
  actor_name = null,
  metadata = null,
  ip_address = null
}) {
  if (!interruption_id || !action) return;

  const metadataJson = metadata ? JSON.stringify(metadata) : null;

  try {
    const phNow = nowPhilippineForMysql();
    await pool.execute(
      `INSERT INTO aleco_interruption_logs 
       (interruption_id, action, field_changed, old_value, new_value, from_status, to_status, 
        actor_type, actor_id, actor_email, actor_name, metadata, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        interruption_id,
        action,
        field_changed,
        old_value,
        new_value,
        from_status,
        to_status,
        actor_type,
        actor_id,
        actor_email || null,
        actor_name || null,
        metadataJson,
        ip_address || null,
        phNow
      ]
    );
  } catch (err) {
    console.error('❌ insertInterruptionLog failed:', err.message);
  }
}

/**
 * Log multiple field changes for an update operation
 * @param {import('mysql2/promise').Pool} pool
 * @param {number} interruption_id
 * @param {Object} oldItem - Original item values
 * @param {Object} newItem - Updated item values
 * @param {Object} actor - { actor_id, actor_email, actor_name }
 * @param {string} [ip_address]
 */
export async function logFieldChanges(pool, interruption_id, oldItem, newItem, actor, ip_address = null) {
  const fieldsToTrack = [
    'type', 'status', 'feeder', 'controlNo', 'cause', 'causeCategory',
    'dateTimeStart', 'dateTimeEndEstimated', 'dateTimeRestored',
    'substationRecloser', 'indicationMagnitude', 'possibleFaultLocation', 'linemenOnDuty',
    'scheduledRestoreAt', 'scheduledRestoreRemark', 'publicVisibleAt'
  ];

  for (const field of fieldsToTrack) {
    const oldVal = oldItem?.[field] ?? null;
    const newVal = newItem?.[field] ?? null;
    
    if (String(oldVal) !== String(newVal)) {
      await insertInterruptionLog(pool, {
        interruption_id,
        action: 'update',
        field_changed: field,
        old_value: oldVal,
        new_value: newVal,
        actor_type: 'user',
        actor_id: actor?.actor_id || null,
        actor_email: actor?.actor_email || null,
        actor_name: actor?.actor_name || null,
        ip_address
      });
    }
  }
}

/**
 * Fetch interruption logs for display
 * @param {import('mysql2/promise').Pool} pool
 * @param {number} interruptionId
 * @returns {Promise<Array>}
 */
export async function listInterruptionLogs(pool, interruptionId) {
  const [rows] = await pool.execute(
    `SELECT id, interruption_id, action, field_changed, old_value, new_value, 
            from_status, to_status, actor_type, actor_id, actor_email, actor_name, 
            metadata, created_at
     FROM aleco_interruption_logs
     WHERE interruption_id = ?
     ORDER BY created_at DESC, id DESC`,
    [interruptionId]
  );
  return rows || [];
}
