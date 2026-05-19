/**
 * Interruption Log Helper - Full CRUD audit trail for interruption advisories.
 * Tracks create, update, delete, archive, restore, status changes, and feed operations.
 */

import { nowPhilippineForMysql } from './dateTimeUtils.js';
import { toIsoForClient } from './interruptionsDto.js';

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
 * Normalize a datetime value to "YYYY-MM-DD HH:mm" (Philippine wall-clock) for comparison.
 * Handles both ISO UTC strings (from mapRowToDto) and wall-clock PH strings (from req.body).
 * Returns null for empty/invalid values.
 * @param {string|null} val
 * @returns {string|null}
 */
function normalizeDateTimeForCompare(val) {
  if (val == null || String(val).trim() === '' || String(val).trim() === 'null') return null;
  const s = String(val).trim();
  // ISO UTC string e.g. "2026-05-19T02:12:00.000Z" → convert to PH wall-clock
  if (/Z$/i.test(s) || /[+-]\d{2}:?\d{2}$/.test(s)) {
    try {
      const ms = Date.parse(s);
      if (Number.isNaN(ms)) return s;
      const phMs = ms + 8 * 60 * 60 * 1000;
      const d = new Date(phMs);
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
    } catch {
      return s;
    }
  }
  // Wall-clock PH "YYYY-MM-DD HH:mm" or "YYYY-MM-DD HH:mm:ss" — normalize to "YYYY-MM-DD HH:mm"
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  if (m) return `${m[1]} ${m[2]}`;
  return s;
}

const DATETIME_FIELDS = new Set([
  'dateTimeStart', 'dateTimeEndEstimated', 'dateTimeRestored',
  'scheduledRestoreAt', 'publicVisibleAt'
]);

/**
 * Convert a Philippine wall-clock string ("YYYY-MM-DD HH:mm") to ISO UTC.
 * If the value already has a timezone offset it is returned as-is.
 * @param {string|null} val
 * @returns {string|null}
 */
function phWallClockToIso(val) {
  if (val == null || String(val).trim() === '') return null;
  const s = String(val).trim();
  if (/Z$/i.test(s) || /[+-]\d{2}:?\d{2}$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? s : d.toISOString();
  }
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return s;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+08:00`);
  return Number.isNaN(d.getTime()) ? s : d.toISOString();
}

/**
 * Log multiple field changes for an update operation.
 * NOTE: 'status' is intentionally excluded — status changes are already
 * tracked separately via insertInterruptionLog(action:'status_change').
 * Including it here would create a duplicate entry on every UpdateAdvisoryModal save.
 * @param {import('mysql2/promise').Pool} pool
 * @param {number} interruption_id
 * @param {Object} oldItem - Original item values (from mapRowToDto — ISO UTC datetimes)
 * @param {Object} newItem - Updated item values (from req.body — only contains submitted fields)
 * @param {Object} actor - { actor_id, actor_email, actor_name }
 * @param {string} [ip_address]
 */
export async function logFieldChanges(pool, interruption_id, oldItem, newItem, actor, ip_address = null) {
  const fieldsToTrack = [
    'type', 'feeder', 'controlNo', 'cause', 'causeCategory',
    'dateTimeStart', 'dateTimeEndEstimated', 'dateTimeRestored',
    'substationRecloser', 'indicationMagnitude', 'possibleFaultLocation', 'linemenOnDuty',
    'scheduledRestoreAt', 'scheduledRestoreRemark', 'publicVisibleAt',
    'body', 'affectedAreas', 'affectedAreasGrouped', 'imageUrl', 'posterImageUrl'
  ];

  for (const field of fieldsToTrack) {
    // Skip fields that were not submitted in this request — only log what the user actually touched
    if (!(field in newItem)) continue;

    const oldVal = oldItem?.[field] ?? null;
    const newVal = newItem?.[field] ?? null;

    let isChanged = false;
    let storedOldVal = null;
    let storedNewVal = null;

    if (DATETIME_FIELDS.has(field)) {
      const oldCmp = normalizeDateTimeForCompare(oldVal);
      const newCmp = normalizeDateTimeForCompare(newVal);
      isChanged = (oldCmp !== newCmp);
      storedOldVal = oldVal != null ? String(oldVal) : null;
      storedNewVal = newVal != null ? phWallClockToIso(newVal) : null;
    } else if (field === 'affectedAreas') {
      const oldArr = Array.isArray(oldVal) ? oldVal : [];
      const newArr = Array.isArray(newVal) ? newVal : [];
      const oldStr = oldArr.map((x) => String(x).trim()).filter(Boolean).join(', ');
      const newStr = newArr.map((x) => String(x).trim()).filter(Boolean).join(', ');
      isChanged = (oldStr !== newStr);
      storedOldVal = oldStr || null;
      storedNewVal = newStr || null;
    } else if (field === 'affectedAreasGrouped') {
      const oldGrouped = Array.isArray(oldVal) ? oldVal : [];
      const newGrouped = Array.isArray(newVal) ? newVal : [];
      const cleanGrouped = (arr) =>
        arr
          .map((g) => ({
            heading: String(g?.heading || '').trim(),
            items: Array.isArray(g?.items) ? g.items.map((x) => String(x).trim()).filter(Boolean) : [],
          }))
          .filter((g) => g.heading || g.items.length > 0);
      const oldCleanStr = JSON.stringify(cleanGrouped(oldGrouped));
      const newCleanStr = JSON.stringify(cleanGrouped(newGrouped));
      isChanged = (oldCleanStr !== newCleanStr);
      storedOldVal = oldCleanStr;
      storedNewVal = newCleanStr;
    } else {
      const oldCmp = oldVal != null ? String(oldVal).trim() : '';
      const newCmp = newVal != null ? String(newVal).trim() : '';
      isChanged = (oldCmp !== newCmp);
      storedOldVal = oldVal != null ? String(oldVal) : null;
      storedNewVal = newVal != null ? String(newVal) : null;
    }

    if (isChanged) {
      await insertInterruptionLog(pool, {
        interruption_id,
        action: 'update',
        field_changed: field,
        old_value: storedOldVal,
        new_value: storedNewVal,
        actor_type: 'user',
        actor_id: actor?.actor_id || null,
        actor_email: actor?.actor_email || null,
        actor_name: actor?.actor_name || null,
        ip_address,
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
  return (rows || []).map((r) => ({
    ...r,
    created_at: toIsoForClient(r.created_at) ?? r.created_at,
  }));
}
