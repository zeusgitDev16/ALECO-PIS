import express from 'express';
import pool from '../config/db.js';
import { nowPhilippineForMysql } from '../utils/dateTimeUtils.js';

const router = express.Router();

const NOTIFICATION_COUNT_TABS = ['user', 'personnel', 'b2b-mail', 'tickets', 'interruptions', 'memo', 'system'];

/** Unread rows only (read_at IS NULL). Falls back if read_at column missing. */
const UNREAD_SQL = 'read_at IS NULL';

/**
 * GET /notifications/counts
 * Per-tab unread counts and total for admin bell badge. Non-admins get zeros.
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
    const [users] = await pool.execute('SELECT role FROM users WHERE email = ?', [email]);
    const role = String(users[0]?.role || '').toLowerCase();
    if (role !== 'admin') {
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ success: true, counts: emptyCounts(), total: 0 });
    }

    const placeholders = NOTIFICATION_COUNT_TABS.map(() => '?').join(',');
    const [rows] = await pool.execute(
      `SELECT tab, COUNT(*) AS c FROM aleco_admin_notifications WHERE tab IN (${placeholders}) AND ${UNREAD_SQL} GROUP BY tab`,
      NOTIFICATION_COUNT_TABS
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
    if (e?.code === 'ER_BAD_FIELD_ERROR') {
      console.warn('[GET /notifications/counts] read_at missing — run backend/sql/aleco_admin_notifications_read_at.sql');
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ success: true, counts: emptyCounts(), total: 0 });
    }
    console.error('[GET /notifications/counts]', e.message);
    res.status(500).json({ success: false, message: 'Failed to load notification counts.' });
  }
});

/**
 * POST /notifications/mark-all-read
 * Sets read_at on all unread rows (admin). Clears bell/tab counters.
 */
router.post('/notifications/mark-all-read', async (req, res) => {
  const email = req.authUser?.email;
  if (!email) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  try {
    const [users] = await pool.execute('SELECT role FROM users WHERE email = ?', [email]);
    const role = String(users[0]?.role || '').toLowerCase();
    if (role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const ts = nowPhilippineForMysql();
    const [result] = await pool.execute(
      `UPDATE aleco_admin_notifications SET read_at = ? WHERE read_at IS NULL`,
      [ts]
    );
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, updated: result.affectedRows ?? 0 });
  } catch (e) {
    if (e?.code === 'ER_NO_SUCH_TABLE') {
      return res.json({ success: true, updated: 0 });
    }
    if (e?.code === 'ER_BAD_FIELD_ERROR') {
      console.warn('[POST /notifications/mark-all-read] read_at missing — run backend/sql/aleco_admin_notifications_read_at.sql');
      return res.status(503).json({
        success: false,
        message: 'Database migration required: add read_at to aleco_admin_notifications.',
      });
    }
    console.error('[POST /notifications/mark-all-read]', e.message);
    res.status(500).json({ success: false, message: 'Failed to mark notifications as read.' });
  }
});

/**
 * PATCH /notifications/:id/read
 * Mark a single notification as read (admin). Reduces unread counts by one.
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
    const [users] = await pool.execute('SELECT role FROM users WHERE email = ?', [email]);
    const role = String(users[0]?.role || '').toLowerCase();
    if (role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const ts = nowPhilippineForMysql();
    const [result] = await pool.execute(
      `UPDATE aleco_admin_notifications SET read_at = ? WHERE id = ? AND ${UNREAD_SQL}`,
      [ts, id]
    );

    if (result.affectedRows === 0) {
      const [check] = await pool.execute('SELECT id FROM aleco_admin_notifications WHERE id = ?', [id]);
      if (check.length === 0) {
        return res.status(404).json({ success: false, message: 'Notification not found.' });
      }
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ success: true, alreadyRead: true });
    }

    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true });
  } catch (e) {
    if (e?.code === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({ success: false, message: 'Notifications table missing.' });
    }
    if (e?.code === 'ER_BAD_FIELD_ERROR') {
      console.warn('[PATCH /notifications/:id/read] read_at missing — run backend/sql/aleco_admin_notifications_read_at.sql');
      return res.status(503).json({
        success: false,
        message: 'Database migration required: add read_at to aleco_admin_notifications.',
      });
    }
    console.error('[PATCH /notifications/:id/read]', e.message);
    res.status(500).json({ success: false, message: 'Failed to mark notification as read.' });
  }
});

/**
 * GET /notifications?tab=user
 * Lists recent unread admin notifications for the given tab. Admins see rows; others get an empty list.
 */
router.get('/notifications', async (req, res) => {
  const tab = String(req.query.tab || 'user').trim().toLowerCase() || 'user';
  const email = req.authUser?.email;
  if (!email) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  try {
    const [users] = await pool.execute('SELECT role FROM users WHERE email = ?', [email]);
    const role = String(users[0]?.role || '').toLowerCase();
    if (role !== 'admin') {
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ success: true, data: [] });
    }

    const [rows] = await pool.execute(
      `SELECT id, tab, event_type AS eventType, subject_email AS subjectEmail, subject_name AS subjectName,
              detail, actor_email AS actorEmail, created_at AS createdAt
       FROM aleco_admin_notifications
       WHERE tab = ? AND ${UNREAD_SQL}
       ORDER BY created_at DESC
       LIMIT 80`,
      [tab]
    );
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, data: rows });
  } catch (e) {
    if (e?.code === 'ER_NO_SUCH_TABLE') {
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ success: true, data: [] });
    }
    if (e?.code === 'ER_BAD_FIELD_ERROR') {
      console.warn('[GET /notifications] read_at missing — run backend/sql/aleco_admin_notifications_read_at.sql');
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ success: true, data: [] });
    }
    console.error('[GET /notifications]', e.message);
    res.status(500).json({ success: false, message: 'Failed to load notifications.' });
  }
});

export default router;
