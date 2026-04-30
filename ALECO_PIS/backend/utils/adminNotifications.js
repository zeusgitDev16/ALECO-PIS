import { nowPhilippineForMysql } from './dateTimeUtils.js';

export const USER_TAB = 'user';

export const USER_EVENT = {
  INVITED: 'user_invited',
  DISABLED: 'user_disabled',
  REGISTERED: 'user_registered',
};

export const PERSONNEL_TAB = 'personnel';

export const PERSONNEL_EVENT = {
  CREW_CREATED: 'crew_created',
  CREW_UPDATED: 'crew_updated',
  CREW_DELETED: 'crew_deleted',
  LINEMAN_CREATED: 'lineman_created',
  LINEMAN_UPDATED: 'lineman_updated',
  LINEMAN_DELETED: 'lineman_deleted',
};

/**
 * Persists a user-tab notification. Swallows errors so core flows never fail if the table is missing.
 * @param {import('mysql2/promise').Pool} pool
 * @param {{ eventType: string, subjectEmail?: string|null, subjectName?: string|null, detail?: string|null, actorEmail?: string|null }} p
 */
export async function recordUserNotification(pool, { eventType, subjectEmail, subjectName, detail, actorEmail }) {
  try {
    const ts = nowPhilippineForMysql();
    await pool.execute(
      `INSERT INTO aleco_admin_notifications (tab, event_type, subject_email, subject_name, detail, actor_email, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [USER_TAB, eventType, subjectEmail || null, subjectName || null, detail || null, actorEmail || null, ts]
    );
  } catch (e) {
    if (e?.code === 'ER_NO_SUCH_TABLE') {
      console.warn('[recordUserNotification] aleco_admin_notifications missing — run backend/sql/aleco_admin_notifications.sql');
    } else {
      console.warn('[recordUserNotification]', e.message || e);
    }
  }
}

/**
 * Personnel tab: crews / linemen pool changes.
 * @param {import('mysql2/promise').Pool} pool
 * @param {{ eventType: string, subjectName?: string|null, detail?: string|null, actorEmail?: string|null }} p
 */
export async function recordPersonnelNotification(pool, { eventType, subjectName, detail, actorEmail }) {
  try {
    const ts = nowPhilippineForMysql();
    await pool.execute(
      `INSERT INTO aleco_admin_notifications (tab, event_type, subject_email, subject_name, detail, actor_email, created_at)
       VALUES (?, ?, NULL, ?, ?, ?, ?)`,
      [PERSONNEL_TAB, eventType, subjectName || null, detail || null, actorEmail || null, ts]
    );
  } catch (e) {
    if (e?.code === 'ER_NO_SUCH_TABLE') {
      console.warn('[recordPersonnelNotification] aleco_admin_notifications missing — run backend/sql/aleco_admin_notifications.sql');
    } else {
      console.warn('[recordPersonnelNotification]', e.message || e);
    }
  }
}

export const B2B_MAIL_TAB = 'b2b-mail';

export const B2B_MAIL_EVENT = {
  CONTACT_CREATED: 'b2b_contact_created',
  CONTACT_EDITED: 'b2b_contact_edited',
  CONTACT_DISABLED: 'b2b_contact_disabled',
  MESSAGE_SENT: 'b2b_message_sent',
  REPLY_FETCHED: 'b2b_reply_fetched',
};

/**
 * B2B Mail tab: contacts, outbound sends, inbound replies.
 * @param {import('mysql2/promise').Pool} pool
 * @param {{ eventType: string, subjectEmail?: string|null, subjectName?: string|null, detail?: string|null, actorEmail?: string|null }} p
 */
export async function recordB2BMailNotification(pool, { eventType, subjectEmail, subjectName, detail, actorEmail }) {
  try {
    const ts = nowPhilippineForMysql();
    await pool.execute(
      `INSERT INTO aleco_admin_notifications (tab, event_type, subject_email, subject_name, detail, actor_email, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [B2B_MAIL_TAB, eventType, subjectEmail || null, subjectName || null, detail || null, actorEmail || null, ts]
    );
  } catch (e) {
    if (e?.code === 'ER_NO_SUCH_TABLE') {
      console.warn('[recordB2BMailNotification] aleco_admin_notifications missing — run backend/sql/aleco_admin_notifications.sql');
    } else {
      console.warn('[recordB2BMailNotification]', e.message || e);
    }
  }
}

export const TICKETS_TAB = 'tickets';

export const TICKETS_EVENT = {
  /** Consumer submitted via Report a problem (public form) */
  SUBMITTED_REPORT: 'ticket_submitted_report',
  STATUS_CHANGED: 'ticket_status_changed',
  DELETED: 'ticket_deleted',
};

/**
 * Tickets tab: new reports, status changes, soft deletes.
 * @param {import('mysql2/promise').Pool} pool
 * @param {{ eventType: string, subjectEmail?: string|null, subjectName?: string|null, detail?: string|null, actorEmail?: string|null }} p
 */
export async function recordTicketNotification(pool, { eventType, subjectEmail, subjectName, detail, actorEmail }) {
  try {
    const ts = nowPhilippineForMysql();
    await pool.execute(
      `INSERT INTO aleco_admin_notifications (tab, event_type, subject_email, subject_name, detail, actor_email, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [TICKETS_TAB, eventType, subjectEmail || null, subjectName || null, detail || null, actorEmail || null, ts]
    );
  } catch (e) {
    if (e?.code === 'ER_NO_SUCH_TABLE') {
      console.warn('[recordTicketNotification] aleco_admin_notifications missing — run backend/sql/aleco_admin_notifications.sql');
    } else {
      console.warn('[recordTicketNotification]', e.message || e);
    }
  }
}

export const INTERRUPTIONS_TAB = 'interruptions';

export const INTERRUPTIONS_EVENT = {
  /** New advisory with type Scheduled */
  CREATED_SCHEDULED: 'interruption_created_scheduled',
  /** New advisory with type Emergency (legacy notifications may still use interruption_created_unscheduled) */
  CREATED_EMERGENCY: 'interruption_created_emergency',
  CREATED_UNSCHEDULED: 'interruption_created_unscheduled',
  /** New advisory with type NgcScheduled */
  CREATED_NGC_SCHEDULED: 'interruption_created_ngc_scheduled',
  /** Soft-deleted (archived) */
  ARCHIVED: 'interruption_archived',
  /** Outage type changed on edit */
  TYPE_CHANGED: 'interruption_type_changed',
  /** Pending / Ongoing / Energized transition */
  STATUS_CHANGED: 'interruption_status_changed',
};

/**
 * Power advisories / interruptions tab.
 * @param {import('mysql2/promise').Pool} pool
 * @param {{ eventType: string, subjectEmail?: string|null, subjectName?: string|null, detail?: string|null, actorEmail?: string|null }} p
 */
export async function recordInterruptionNotification(pool, { eventType, subjectEmail, subjectName, detail, actorEmail }) {
  try {
    const ts = nowPhilippineForMysql();
    await pool.execute(
      `INSERT INTO aleco_admin_notifications (tab, event_type, subject_email, subject_name, detail, actor_email, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [INTERRUPTIONS_TAB, eventType, subjectEmail || null, subjectName || null, detail || null, actorEmail || null, ts]
    );
  } catch (e) {
    if (e?.code === 'ER_NO_SUCH_TABLE') {
      console.warn('[recordInterruptionNotification] aleco_admin_notifications missing — run backend/sql/aleco_admin_notifications.sql');
    } else {
      console.warn('[recordInterruptionNotification]', e.message || e);
    }
  }
}

export const MEMO_TAB = 'memo';

export const MEMO_EVENT = {
  CREATED: 'memo_created',
  UPDATED: 'memo_updated',
  CLOSED: 'memo_closed',
  DELETED: 'memo_deleted',
};

/**
 * Service memo tab: create, update, close, delete.
 * @param {import('mysql2/promise').Pool} pool
 * @param {{ eventType: string, subjectEmail?: string|null, subjectName?: string|null, detail?: string|null, actorEmail?: string|null }} p
 */
export async function recordMemoNotification(pool, { eventType, subjectEmail, subjectName, detail, actorEmail }) {
  try {
    const ts = nowPhilippineForMysql();
    await pool.execute(
      `INSERT INTO aleco_admin_notifications (tab, event_type, subject_email, subject_name, detail, actor_email, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [MEMO_TAB, eventType, subjectEmail || null, subjectName || null, detail || null, actorEmail || null, ts]
    );
  } catch (e) {
    if (e?.code === 'ER_NO_SUCH_TABLE') {
      console.warn('[recordMemoNotification] aleco_admin_notifications missing — run backend/sql/aleco_admin_notifications.sql');
    } else {
      console.warn('[recordMemoNotification]', e.message || e);
    }
  }
}
