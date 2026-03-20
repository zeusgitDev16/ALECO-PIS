import express from 'express';
import pool from '../config/db.js';

const router = express.Router();

const TYPES = new Set(['Scheduled', 'Unscheduled']);
const STATUSES = new Set(['Pending', 'Ongoing', 'Restored']);

/** Parse DB text: JSON array or comma-separated */
function parseAffectedAreas(text) {
  if (!text || typeof text !== 'string') return [];
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const j = JSON.parse(trimmed);
      if (Array.isArray(j)) return j.map(String).filter(Boolean);
    } catch {
      /* fall through */
    }
  }
  return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
}

/** Store as JSON array string for consistent reads */
function serializeAffectedAreas(areas) {
  if (Array.isArray(areas)) {
    return JSON.stringify(areas.filter(Boolean).map(String));
  }
  if (typeof areas === 'string' && areas.trim()) {
    return serializeAffectedAreas(parseAffectedAreas(areas));
  }
  return JSON.stringify([]);
}

function formatDisplayDateTime(val) {
  if (!val) return null;
  if (val instanceof Date) {
    return val.toISOString().slice(0, 16).replace('T', ' ');
  }
  const s = String(val).replace('T', ' ');
  return s.length >= 16 ? s.slice(0, 16) : s;
}

function toMysqlDateTime(input) {
  if (input === undefined || input === null || input === '') return null;
  const d = new Date(input);
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 19).replace('T', ' ');
  }
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}/.test(input)) {
    return input.replace('T', ' ').slice(0, 19);
  }
  return null;
}

function mapRowToDto(row) {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    affectedAreas: parseAffectedAreas(row.affected_areas),
    feeder: row.feeder,
    cause: row.cause,
    dateTimeStart: formatDisplayDateTime(row.date_time_start),
    dateTimeEndEstimated: row.date_time_end_estimated
      ? formatDisplayDateTime(row.date_time_end_estimated)
      : null,
    dateTimeRestored: row.date_time_restored
      ? formatDisplayDateTime(row.date_time_restored)
      : null,
  };
}

function validatePayload(body, { partial = false } = {}) {
  const errors = [];
  const type = body.type;
  const status = body.status;
  const feeder = body.feeder;
  const cause = body.cause;
  const dateTimeStart = body.dateTimeStart;

  if (!partial || type !== undefined) {
    if (!type || !TYPES.has(type)) errors.push('type must be Scheduled or Unscheduled');
  }
  if (!partial || status !== undefined) {
    if (!status || !STATUSES.has(status)) errors.push('status must be Pending, Ongoing, or Restored');
  }
  if (!partial || feeder !== undefined) {
    if (feeder === undefined || feeder === null || String(feeder).trim() === '') {
      errors.push('feeder is required');
    }
  }
  if (!partial || cause !== undefined) {
    if (cause === undefined || cause === null || String(cause).trim() === '') {
      errors.push('cause is required');
    }
  }
  if (!partial || dateTimeStart !== undefined) {
    const dt = toMysqlDateTime(dateTimeStart);
    if (!dt) errors.push('dateTimeStart is required and must be a valid date/time');
  }

  return errors;
}

/** Public + admin list */
router.get('/interruptions', async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 200);
    const [rows] = await pool.execute(
      `SELECT id, type, status, affected_areas, feeder, cause,
       date_time_start, date_time_end_estimated, date_time_restored
       FROM aleco_interruptions
       ORDER BY date_time_start DESC
       LIMIT ?`,
      [limit]
    );
    res.json({ success: true, data: rows.map(mapRowToDto) });
  } catch (error) {
    console.error('Interruptions fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch interruptions.' });
  }
});

/** Create (admin UI) */
router.post('/interruptions', async (req, res) => {
  const errs = validatePayload(req.body, { partial: false });
  if (errs.length) return res.status(400).json({ success: false, message: errs.join(' ') });

  const {
    type,
    status,
    affectedAreas,
    feeder,
    cause,
    dateTimeStart,
    dateTimeEndEstimated,
    dateTimeRestored,
  } = req.body;

  const areasText = serializeAffectedAreas(affectedAreas ?? []);
  const start = toMysqlDateTime(dateTimeStart);
  const endEst = dateTimeEndEstimated ? toMysqlDateTime(dateTimeEndEstimated) : null;
  const restored = dateTimeRestored ? toMysqlDateTime(dateTimeRestored) : null;

  try {
    const [result] = await pool.execute(
      `INSERT INTO aleco_interruptions
       (type, status, affected_areas, feeder, cause, date_time_start, date_time_end_estimated, date_time_restored)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [type, status, areasText, String(feeder).trim(), String(cause).trim(), start, endEst, restored]
    );
    const [rows] = await pool.execute(
      `SELECT id, type, status, affected_areas, feeder, cause,
       date_time_start, date_time_end_estimated, date_time_restored
       FROM aleco_interruptions WHERE id = ?`,
      [result.insertId]
    );
    res.status(201).json({ success: true, data: mapRowToDto(rows[0]) });
  } catch (error) {
    console.error('Interruptions create error:', error);
    res.status(500).json({ success: false, message: 'Failed to create interruption.' });
  }
});

/** Update */
router.put('/interruptions/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid id.' });

  const errs = validatePayload(req.body, { partial: true });
  if (errs.length) return res.status(400).json({ success: false, message: errs.join(' ') });

  const {
    type,
    status,
    affectedAreas,
    feeder,
    cause,
    dateTimeStart,
    dateTimeEndEstimated,
    dateTimeRestored,
  } = req.body;

  try {
    const [existing] = await pool.execute('SELECT id FROM aleco_interruptions WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Interruption not found.' });
    }

    const fields = [];
    const params = [];

    if (type !== undefined) {
      if (!TYPES.has(type)) return res.status(400).json({ success: false, message: 'Invalid type.' });
      fields.push('type = ?');
      params.push(type);
    }
    if (status !== undefined) {
      if (!STATUSES.has(status)) return res.status(400).json({ success: false, message: 'Invalid status.' });
      fields.push('status = ?');
      params.push(status);
    }
    if (affectedAreas !== undefined) {
      fields.push('affected_areas = ?');
      params.push(serializeAffectedAreas(affectedAreas));
    }
    if (feeder !== undefined) {
      fields.push('feeder = ?');
      params.push(String(feeder).trim());
    }
    if (cause !== undefined) {
      fields.push('cause = ?');
      params.push(String(cause).trim());
    }
    if (dateTimeStart !== undefined) {
      const dt = toMysqlDateTime(dateTimeStart);
      if (!dt) return res.status(400).json({ success: false, message: 'Invalid dateTimeStart.' });
      fields.push('date_time_start = ?');
      params.push(dt);
    }
    if (dateTimeEndEstimated !== undefined) {
      fields.push('date_time_end_estimated = ?');
      params.push(dateTimeEndEstimated ? toMysqlDateTime(dateTimeEndEstimated) : null);
    }
    if (dateTimeRestored !== undefined) {
      fields.push('date_time_restored = ?');
      params.push(dateTimeRestored ? toMysqlDateTime(dateTimeRestored) : null);
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    params.push(id);
    await pool.execute(`UPDATE aleco_interruptions SET ${fields.join(', ')} WHERE id = ?`, params);

    const [rows] = await pool.execute(
      `SELECT id, type, status, affected_areas, feeder, cause,
       date_time_start, date_time_end_estimated, date_time_restored
       FROM aleco_interruptions WHERE id = ?`,
      [id]
    );
    res.json({ success: true, data: mapRowToDto(rows[0]) });
  } catch (error) {
    console.error('Interruptions update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update interruption.' });
  }
});

/** Delete */
router.delete('/interruptions/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid id.' });

  try {
    const [result] = await pool.execute('DELETE FROM aleco_interruptions WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Interruption not found.' });
    }
    res.json({ success: true, message: 'Deleted.' });
  } catch (error) {
    console.error('Interruptions delete error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete interruption.' });
  }
});

export default router;
