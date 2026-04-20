/**
 * Ticket Log Helper - Inserts audit log entries for ticket actions.
 * Used by tickets.js and ticket-grouping.js to track dispatcher actions,
 * crew dispatch, status changes, and (future) lineman SMS-based resolution.
 */

import { nowPhilippineForMysql } from './dateTimeUtils.js';
import { recordTicketNotification, TICKETS_EVENT } from './adminNotifications.js';

/**
 * @param {import('mysql2/promise').Pool} pool
 * @param {Object} opts
 * @param {string} opts.ticket_id
 * @param {string} opts.action - dispatch | hold | status_change | group_dispatch | bulk_restore
 * @param {string} [opts.from_status]
 * @param {string} [opts.to_status]
 * @param {'dispatcher'|'sms_lineman'|'system'} [opts.actor_type='dispatcher']
 * @param {number} [opts.actor_id]
 * @param {string} [opts.actor_email]
 * @param {string} [opts.actor_name]
 * @param {Object} [opts.metadata] - JSON-serializable object
 */
export async function insertTicketLog(pool, {
  ticket_id,
  action,
  from_status = null,
  to_status = null,
  actor_type = 'dispatcher',
  actor_id = null,
  actor_email = null,
  actor_name = null,
  metadata = null
}) {
  if (!ticket_id || !action) return;

  const metadataJson = metadata ? JSON.stringify(metadata) : null;

  try {
    const phNow = nowPhilippineForMysql();
    await pool.execute(
      `INSERT INTO aleco_ticket_logs 
       (ticket_id, action, from_status, to_status, actor_type, actor_id, actor_email, actor_name, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ticket_id,
        action,
        from_status,
        to_status,
        actor_type,
        actor_id,
        actor_email || null,
        actor_name || null,
        metadataJson,
        phNow
      ]
    );

    if (
      from_status != null &&
      to_status != null &&
      String(from_status) !== String(to_status)
    ) {
      await recordTicketNotification(pool, {
        eventType: TICKETS_EVENT.STATUS_CHANGED,
        subjectName: ticket_id,
        detail: `${from_status} → ${to_status}`,
        actorEmail: actor_email || null,
      });
    }
  } catch (err) {
    console.error('❌ insertTicketLog failed:', err.message);
  }
}
