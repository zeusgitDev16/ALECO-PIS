import express from 'express';
import pool from '../config/db.js';
import { nowPhilippineForMysql } from '../utils/dateTimeUtils.js';

const router = express.Router();

const NOTIFICATION_COUNT_TABS = ['user', 'personnel', 'b2b-mail', 'tickets', 'interruptions', 'memo', 'system'];
let personalReadsTableReady = false;

async function getUserIdByEmail(email) {
  const clean = String(email || '').trim();
  if (!clean) return 0;
  const [rows] = await pool.execute('SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [clean]);
  return Number(rows[0]?.id || 0);
}

async function ensurePersonalReadsTable() {
  if (personalReadsTableReady) return;
  await pool.execute(
    `CREATE TABLE IF NOT EXISTS aleco_admin_notification_reads (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      notification_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      read_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_admin_notif_reads_notif_user (notification_id, user_id),
      KEY idx_admin_notif_reads_user_read (user_id, read_at),
      KEY idx_admin_notif_reads_notif (notification_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  personalReadsTableReady = true;
}

/**
 * GET /notifications/counts
 * Per-tab unread counts and total for the current authenticated user.
 */
router.get('/notifications/counts', async (req, res) => {
  const email = req.authUser?.email;
  if (!email) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  const emptyCounts = () => {
    const o = {};
    for (const t of NOTIFICATION_COUNT_TABS) o[t] = 0;
    return o;
  };

  try {
    await ensurePersonalReadsTable();
    const userId = await getUserIdByEmail(email);
    if (!userId) {
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ success: true, counts: emptyCounts(), total: 0 });
    }

    const placeholders = NOTIFICATION_COUNT_TABS.map(() => '?').join(',');
    const [rows] = await pool.execute(
      `SELECT n.tab, COUNT(*) AS c
       FROM aleco_admin_notifications n
       LEFT JOIN aleco_admin_notification_reads r
         ON r.notification_id = n.id AND r.user_id = ?
       WHERE n.tab IN (${placeholders}) AND r.id IS NULL
       GROUP BY n.tab`,
      [userId, ...NOTIFICATION_COUNT_TABS]
    );

    const counts = emptyCounts();
    for (const row of rows) {
      const tab = String(row.tab || '').toLowerCase();
      if (Object.prototype.hasOwnProperty.call(counts, tab)) {
        counts[tab] = Number(row.c) || 0;
      }
    }

    const total = NOTIFICATION_COUNT_TABS.reduce((sum, t) => sum + (counts[t] || 0), 0);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, counts, total });
  } catch (e) {
    if (e?.code === 'ER_NO_SUCH_TABLE') {
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ success: true, counts: emptyCounts(), total: 0 });
    }
    console.error('[GET /notifications/counts]', e.message);
    res.status(500).json({ success: false, message: 'Failed to load notification counts.' });
  }
});

/**
 * POST /notifications/mark-all-read
 * Marks all unread rows as read for current authenticated user.
 */
router.post('/notifications/mark-all-read', async (req, res) => {
  const email = req.authUser?.email;
  if (!email) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  try {
    await ensurePersonalReadsTable();
    const userId = await getUserIdByEmail(email);
    if (!userId) {
      return res.json({ success: true, updated: 0 });
    }

    const ts = nowPhilippineForMysql();
    const [result] = await pool.execute(
      `INSERT INTO aleco_admin_notification_reads (notification_id, user_id, read_at)
       SELECT n.id, ?, ?
       FROM aleco_admin_notifications n
       LEFT JOIN aleco_admin_notification_reads r
         ON r.notification_id = n.id AND r.user_id = ?
       WHERE r.id IS NULL
       ON DUPLICATE KEY UPDATE read_at = VALUES(read_at)`,
      [userId, ts, userId]
    );
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, updated: result.affectedRows ?? 0 });
  } catch (e) {
    if (e?.code === 'ER_NO_SUCH_TABLE') {
      return res.json({ success: true, updated: 0 });
    }
    console.error('[POST /notifications/mark-all-read]', e.message);
    res.status(500).json({ success: false, message: 'Failed to mark notifications as read.' });
  }
});

/**
 * PATCH /notifications/:id/read
 * Mark a single notification as read for current authenticated user.
 */
router.patch('/notifications/:id/read', async (req, res) => {
  const email = req.authUser?.email;
  if (!email) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid notification id.' });
  }

  try {
    await ensurePersonalReadsTable();
    const userId = await getUserIdByEmail(email);
    if (!userId) {
      return res.json({ success: true, alreadyRead: true });
    }

    const [check] = await pool.execute('SELECT id FROM aleco_admin_notifications WHERE id = ?', [id]);
    if (check.length === 0) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }

    const ts = nowPhilippineForMysql();
    const [result] = await pool.execute(
      `INSERT INTO aleco_admin_notification_reads (notification_id, user_id, read_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE read_at = VALUES(read_at)`,
      [id, userId, ts]
    );

    if (result.affectedRows === 0) {
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ success: true, alreadyRead: true });
    }

    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true });
  } catch (e) {
    if (e?.code === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({ success: false, message: 'Notifications table missing.' });
    }
    console.error('[PATCH /notifications/:id/read]', e.message);
    res.status(500).json({ success: false, message: 'Failed to mark notification as read.' });
  }
});

/**
 * GET /notifications?tab=user
 * Lists recent unread notifications for the given tab for the current user.
 */
router.get('/notifications', async (req, res) => {
  const tab = String(req.query.tab || 'user').trim().toLowerCase() || 'user';
  const email = req.authUser?.email;
  if (!email) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  try {
    await ensurePersonalReadsTable();
    const userId = await getUserIdByEmail(email);
    if (!userId) {
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ success: true, data: [] });
    }

    const [rows] = await pool.execute(
      `SELECT n.id, n.tab, n.event_type AS eventType, n.subject_email AS subjectEmail, n.subject_name AS subjectName,
              n.detail, n.actor_email AS actorEmail, n.created_at AS createdAt
       FROM aleco_admin_notifications n
       LEFT JOIN aleco_admin_notification_reads r
         ON r.notification_id = n.id AND r.user_id = ?
       WHERE n.tab = ? AND r.id IS NULL
       ORDER BY n.created_at DESC
       LIMIT 80`,
      [userId, tab]
    );
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, data: rows });
  } catch (e) {
    if (e?.code === 'ER_NO_SUCH_TABLE') {
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ success: true, data: [] });
    }
    console.error('[GET /notifications]', e.message);
    res.status(500).json({ success: false, message: 'Failed to load notifications.' });
  }
});

export default router;
