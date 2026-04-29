import express from 'express';
import ExcelJS from 'exceljs';
import { stringify } from 'csv-stringify/sync';
import pool from '../config/db.js';
import { requireAdmin } from '../middleware/requireRole.js';

const router = express.Router();

const MODULES = new Set(['tickets', 'interruptions', 'personnel', 'users', 'data_management', 'b2b']);

function toInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

function parseModules(raw) {
  if (!raw) return Array.from(MODULES);
  const parts = String(raw)
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  const picked = parts.filter((v) => MODULES.has(v));
  return picked.length > 0 ? picked : Array.from(MODULES);
}

const COLLATE = 'utf8mb4_unicode_ci';

const C = (expr) => `CONVERT(${expr} USING utf8mb4) COLLATE ${COLLATE}`;

const HISTORY_COLUMNS = [
  { key: 'createdAt', header: 'Date' },
  { key: 'module', header: 'Module' },
  { key: 'action', header: 'Action' },
  { key: 'title', header: 'Title' },
  { key: 'detail', header: 'Details' },
  { key: 'actorEmail', header: 'Actor Email' },
  { key: 'actorName', header: 'Actor Name' },
  { key: 'entityId', header: 'Entity ID' },
  { key: 'entityLabel', header: 'Entity Label' },
  { key: 'severityTag', header: 'Severity' },
];

function getDateRangeFromPreset(preset) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();

  if (preset === 'today') {
    const d = now.toISOString().slice(0, 10);
    return { startDate: d, endDate: d };
  }
  if (preset === 'last7') {
    const end = new Date(now);
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
  }
  if (preset === 'thisWeek') {
    const dayOfWeek = now.getDay();
    const start = new Date(now);
    start.setDate(day - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
  }
  if (preset === 'thisMonth') {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
  }
  if (preset === 'lastMonth') {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
  }
  if (preset === 'thisYear') {
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
  }
  return null;
}

function buildDateFilter(preset, startDate, endDate) {
  if (startDate && endDate) return { startDate, endDate };
  const fromPreset = preset ? getDateRangeFromPreset(preset) : null;
  return fromPreset || null;
}

function buildHistoryUnionSql() {
  return `
      SELECT
        ${C("CONCAT('tickets-', l.id)")} AS id,
        ${C("'tickets'")} AS module,
        ${C('l.action')} AS action,
        ${C(`CASE
          WHEN l.action = 'dispatch' THEN 'Ticket dispatched'
          WHEN l.action = 'group_dispatch' THEN 'Ticket group dispatched'
          WHEN l.action = 'hold' THEN 'Ticket put on hold'
          WHEN l.action = 'ticket_deleted' THEN 'Ticket deleted'
          WHEN l.action = 'ticket_edit' THEN 'Ticket updated'
          WHEN l.action = 'status_change' AND JSON_UNQUOTE(JSON_EXTRACT(l.metadata, '$.resolution_mode')) = 'concern' THEN 'Concern resolution started'
          WHEN l.action = 'status_change' THEN 'Ticket status changed'
          ELSE 'Ticket activity'
        END`)} AS title,
        ${C(`CASE
          WHEN l.action = 'status_change' THEN CONCAT(
            COALESCE(l.from_status, '—'), ' -> ', COALESCE(l.to_status, '—'),
            CASE
              WHEN COALESCE(JSON_UNQUOTE(JSON_EXTRACT(l.metadata, '$.concern_resolution_notes')), '') <> ''
                THEN CONCAT(' | Concern: ', JSON_UNQUOTE(JSON_EXTRACT(l.metadata, '$.concern_resolution_notes')))
              WHEN COALESCE(JSON_UNQUOTE(JSON_EXTRACT(l.metadata, '$.dispatch_notes')), '') <> ''
                THEN CONCAT(' | Notes: ', JSON_UNQUOTE(JSON_EXTRACT(l.metadata, '$.dispatch_notes')))
              ELSE ''
            END
          )
          ELSE COALESCE(JSON_UNQUOTE(JSON_EXTRACT(l.metadata, '$.note')), '')
        END`)} AS detail,
        ${C('l.actor_email')} AS actorEmail,
        ${C('l.actor_name')} AS actorName,
        ${C('l.ticket_id')} AS entityId,
        ${C('l.ticket_id')} AS entityLabel,
        l.created_at AS createdAt,
        ${C(`CASE
          WHEN l.action = 'ticket_deleted' THEN 'danger'
          WHEN l.action IN ('dispatch', 'group_dispatch', 'status_change') THEN 'info'
          ELSE 'neutral'
        END`)} AS severityTag
      FROM aleco_ticket_logs l

      UNION ALL

      SELECT
        ${C("CONCAT('interruptions-', u.id)")} AS id,
        ${C("'interruptions'")} AS module,
        ${C("CASE WHEN u.kind = 'system' THEN 'system_update' ELSE 'user_update' END")} AS action,
        ${C("CASE WHEN u.kind = 'system' THEN 'Interruption system update' ELSE 'Interruption updated' END")} AS title,
        ${C('u.remark')} AS detail,
        ${C('u.actor_email')} AS actorEmail,
        ${C('u.actor_name')} AS actorName,
        ${C('CAST(u.interruption_id AS CHAR)')} AS entityId,
        ${C("COALESCE(i.control_no, CONCAT('Interruption #', u.interruption_id))")} AS entityLabel,
        u.created_at AS createdAt,
        ${C("CASE WHEN u.kind = 'system' THEN 'neutral' ELSE 'info' END")} AS severityTag
      FROM aleco_interruption_updates u
      LEFT JOIN aleco_interruptions i ON i.id = u.interruption_id

      UNION ALL

      SELECT
        ${C("CONCAT('personnel-', p.id)")} AS id,
        ${C("'personnel'")} AS module,
        ${C('p.action')} AS action,
        ${C("'Personnel activity'")} AS title,
        ${C('p.target_name')} AS detail,
        ${C('p.actor_email')} AS actorEmail,
        ${C('p.actor_name')} AS actorName,
        ${C('p.target_name')} AS entityId,
        ${C('p.target_name')} AS entityLabel,
        p.created_at AS createdAt,
        ${C("'info'")} AS severityTag
      FROM aleco_personnel_audit_logs p

      UNION ALL

      SELECT
        ${C("CONCAT('b2b-', b.id)")} AS id,
        ${C("'b2b'")} AS module,
        ${C('b.action')} AS action,
        ${C("'B2B mail activity'")} AS title,
        ${C('b.details')} AS detail,
        ${C('b.actor_email')} AS actorEmail,
        ${C('b.actor_name')} AS actorName,
        ${C('CAST(b.message_id AS CHAR)')} AS entityId,
        ${C("CONCAT('Message #', b.message_id)")} AS entityLabel,
        b.created_at AS createdAt,
        ${C("CASE WHEN b.action IN ('delete') THEN 'danger' ELSE 'info' END")} AS severityTag
      FROM aleco_b2b_mail_audit_logs b

      UNION ALL

      SELECT
        ${C("CONCAT('data-', e.id)")} AS id,
        ${C("'data_management'")} AS module,
        ${C("'export'")} AS action,
        ${C("'Data export generated'")} AS title,
        ${C("CONCAT('Range ', DATE_FORMAT(e.date_start, '%Y-%m-%d'), ' to ', DATE_FORMAT(e.date_end, '%Y-%m-%d'), ' | Count ', e.ticket_count, ' | Logs ', e.log_count, ' | Format ', e.format)")} AS detail,
        ${C('e.exported_by')} AS actorEmail,
        ${C('e.exported_by')} AS actorName,
        ${C('CAST(e.id AS CHAR)')} AS entityId,
        ${C("CONCAT('Export #', e.id)")} AS entityLabel,
        COALESCE(e.created_at, e.export_date) AS createdAt,
        ${C("'neutral'")} AS severityTag
      FROM aleco_export_log e

      UNION ALL

      SELECT
        ${C("CONCAT('users-', u.id)")} AS id,
        ${C("'users'")} AS module,
        ${C("'registered'")} AS action,
        ${C("'User registered'")} AS title,
        ${C("CONCAT('Role: ', COALESCE(u.role, '—'), ' | Status: ', COALESCE(u.status, '—'))")} AS detail,
        ${C('u.email')} AS actorEmail,
        ${C('u.name')} AS actorName,
        ${C('CAST(u.id AS CHAR)')} AS entityId,
        ${C('u.email')} AS entityLabel,
        u.created_at AS createdAt,
        ${C("'info'")} AS severityTag
      FROM users u

      UNION ALL

      SELECT
        ${C("CONCAT('users-invite-', a.id)")} AS id,
        ${C("'users'")} AS module,
        ${C("'invited'")} AS action,
        ${C("'User invitation created'")} AS title,
        ${C("CONCAT('Role assigned: ', COALESCE(a.role_assigned, '—'), ' | Invite status: ', COALESCE(a.status, '—'))")} AS detail,
        ${C('a.email')} AS actorEmail,
        ${C('NULL')} AS actorName,
        ${C('CAST(a.id AS CHAR)')} AS entityId,
        ${C('a.email')} AS entityLabel,
        a.created_at AS createdAt,
        ${C("'neutral'")} AS severityTag
      FROM access_codes a
    `;
}

function buildHistoryWhereSql({ modules, q, actor, startDate, endDate }) {
  const where = [];
  const esc = (v) => pool.escape(v);

  if (Array.isArray(modules) && modules.length > 0) {
    where.push(`h.module IN (${modules.map((m) => esc(m)).join(',')})`);
  }
  if (q) {
    const like = `%${q}%`;
    where.push(`(h.title LIKE ${esc(like)} OR h.detail LIKE ${esc(like)} OR h.entityLabel LIKE ${esc(like)})`);
  }
  if (actor) {
    const like = `%${actor}%`;
    where.push(`(h.actorEmail LIKE ${esc(like)} OR h.actorName LIKE ${esc(like)})`);
  }
  if (startDate) {
    where.push(`DATE(h.createdAt) >= ${esc(startDate)}`);
  }
  if (endDate) {
    where.push(`DATE(h.createdAt) <= ${esc(endDate)}`);
  }
  return where.length ? `WHERE ${where.join(' AND ')}` : '';
}

router.get('/history', requireAdmin, async (req, res) => {
  try {
    const page = toInt(req.query.page, 0);
    const limit = Math.min(Math.max(toInt(req.query.limit, 50), 10), 200);
    const offset = page * limit;
    const modules = parseModules(req.query.modules);
    const q = String(req.query.q || '').trim();
    const actor = String(req.query.actor || '').trim();
    const preset = String(req.query.preset || '').trim();
    const rawStartDate = String(req.query.startDate || '').trim();
    const rawEndDate = String(req.query.endDate || '').trim();
    const dateFilter = buildDateFilter(preset, rawStartDate, rawEndDate);
    const startDate = dateFilter?.startDate || rawStartDate;
    const endDate = dateFilter?.endDate || rawEndDate;

    const unionSql = buildHistoryUnionSql();
    const whereSql = buildHistoryWhereSql({ modules, q, actor, startDate, endDate });
    const esc = (v) => pool.escape(v);

    const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM (${unionSql}) h ${whereSql}`);
    const total = Number(countRows[0]?.total || 0);

    const [rows] = await pool.query(
      `SELECT * FROM (${unionSql}) h ${whereSql} ORDER BY h.createdAt DESC LIMIT ${esc(limit)} OFFSET ${esc(offset)}`
    );

    const [countByModuleRows] = await pool.query(
      `SELECT h.module, COUNT(*) AS total FROM (${unionSql}) h ${whereSql} GROUP BY h.module`
    );
    const countsByModule = countByModuleRows.reduce((acc, row) => {
      acc[row.module] = Number(row.total || 0);
      return acc;
    }, {});

    res.json({
      success: true,
      data: rows,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      countsByModule,
      selectedModules: modules,
    });
  } catch (error) {
    console.error('History feed error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to load history feed.' });
  }
});

router.get('/history/export/preview', requireAdmin, async (req, res) => {
  try {
    const { preset, startDate, endDate } = req.query;
    const dateFilter = buildDateFilter(
      String(preset || '').trim(),
      String(startDate || '').trim(),
      String(endDate || '').trim()
    );
    if (!dateFilter) {
      return res.status(400).json({ success: false, message: 'Provide preset or startDate and endDate' });
    }

    const modules = parseModules(req.query.modules);
    const q = String(req.query.q || '').trim();
    const actor = String(req.query.actor || '').trim();
    const limit = Math.min(Math.max(toInt(req.query.limit, 300), 50), 1000);
    const unionSql = buildHistoryUnionSql();
    const whereSql = buildHistoryWhereSql({
      modules,
      q,
      actor,
      startDate: dateFilter.startDate,
      endDate: dateFilter.endDate,
    });
    const esc = (v) => pool.escape(v);

    const [rows] = await pool.query(
      `SELECT * FROM (${unionSql}) h ${whereSql} ORDER BY h.createdAt DESC LIMIT ${esc(limit)}`
    );
    const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM (${unionSql}) h ${whereSql}`);

    return res.json({
      success: true,
      metadata: {
        dateStart: dateFilter.startDate,
        dateEnd: dateFilter.endDate,
        selectedModules: modules,
        total: Number(countRows[0]?.total || 0),
      },
      history: rows,
    });
  } catch (error) {
    console.error('History export preview error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to generate history export preview.' });
  }
});

router.get('/history/export', requireAdmin, async (req, res) => {
  try {
    const { preset, startDate, endDate, format } = req.query;
    const dateFilter = buildDateFilter(
      String(preset || '').trim(),
      String(startDate || '').trim(),
      String(endDate || '').trim()
    );
    if (!dateFilter) {
      return res.status(400).json({ success: false, message: 'Provide preset or startDate and endDate' });
    }

    const fmt = String(format || 'excel').toLowerCase() === 'csv' ? 'csv' : 'excel';
    const modules = parseModules(req.query.modules);
    const q = String(req.query.q || '').trim();
    const actor = String(req.query.actor || '').trim();
    const unionSql = buildHistoryUnionSql();
    const whereSql = buildHistoryWhereSql({
      modules,
      q,
      actor,
      startDate: dateFilter.startDate,
      endDate: dateFilter.endDate,
    });

    const [rows] = await pool.query(
      `SELECT * FROM (${unionSql}) h ${whereSql} ORDER BY h.createdAt DESC`
    );
    const fileStamp = new Date().toISOString().replace(/[:.]/g, '-');
    const exportedBy = String(req.headers['x-user-email'] || req.user?.email || '').trim();

    await pool.execute(
      `INSERT INTO aleco_export_log (export_date, date_start, date_end, ticket_count, log_count, format, exported_by)
       VALUES (NOW(), ?, ?, ?, ?, ?, ?)`,
      [dateFilter.startDate, dateFilter.endDate, rows.length, 0, fmt, exportedBy || null]
    );

    if (fmt === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('History');
      ws.columns = HISTORY_COLUMNS.map((col) => ({ header: col.header, key: col.key, width: 24 }));
      ws.getRow(1).font = { bold: true };
      ws.getRow(1).alignment = { vertical: 'middle' };

      rows.forEach((row) => {
        ws.addRow({
          createdAt: row.createdAt ? new Date(row.createdAt) : '',
          module: row.module || '',
          action: row.action || '',
          title: row.title || '',
          detail: row.detail || '',
          actorEmail: row.actorEmail || '',
          actorName: row.actorName || '',
          entityId: row.entityId || '',
          entityLabel: row.entityLabel || '',
          severityTag: row.severityTag || '',
        });
      });
      ws.getColumn('createdAt').numFmt = 'yyyy-mm-dd hh:mm:ss';

      const buffer = await workbook.xlsx.writeBuffer();
      const filename = `aleco_history_export_${fileStamp}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(Buffer.from(buffer));
    }

    const csvRows = rows.map((row) => ({
      Date: row.createdAt ? new Date(row.createdAt).toISOString() : '',
      Module: row.module || '',
      Action: row.action || '',
      Title: row.title || '',
      Details: row.detail || '',
      'Actor Email': row.actorEmail || '',
      'Actor Name': row.actorName || '',
      'Entity ID': row.entityId || '',
      'Entity Label': row.entityLabel || '',
      Severity: row.severityTag || '',
    }));
    const csv = stringify(csvRows, { header: true });
    const filename = `aleco_history_export_${fileStamp}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csv);
  } catch (error) {
    console.error('History export error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to export history.' });
  }
});

export default router;
