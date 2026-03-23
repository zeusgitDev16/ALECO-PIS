import express from 'express';
import pool from '../config/db.js';
import { upload } from '../../cloudinaryConfig.js';
import {
  parseAffectedAreas,
  serializeAffectedAreas,
  toMysqlDateTime,
  mapRowToDto,
  computeInitialStatus,
  toMysqlDateTimeFromRow,
} from '../utils/interruptionsDto.js';
import { nowPhilippineForMysql } from '../utils/dateTimeUtils.js';
import {
  listUpdates,
  addUserUpdate,
  insertSystemUpdate,
} from '../services/interruptionLifecycle.js';
import {
  getAlecoInterruptionsDeletedAtSupported,
  getAlecoInterruptionsPulledFromFeedAtSupported,
} from '../utils/interruptionsDbSupport.js';
import { RESOLVED_ARCHIVE_HOURS } from '../constants/interruptionConstants.js';

const router = express.Router();

/** Columns for list + single-row fetch (without leading SELECT … FROM). */
const INTERRUPTION_TABLE_COLS_BASE = `id, type, status, affected_areas, feeder, cause, cause_category, body, control_no, image_url,
  date_time_start, date_time_end_estimated, date_time_restored,
  public_visible_at, created_at, updated_at`;
const INTERRUPTION_TABLE_COLS_WITH_PULLED = `id, type, status, affected_areas, feeder, cause, cause_category, body, control_no, image_url,
  date_time_start, date_time_end_estimated, date_time_restored,
  public_visible_at, pulled_from_feed_at, created_at, updated_at`;

function selectInterruptionRowSql(hasDeletedAt, hasPulledFromFeedAt = true) {
  const cols = hasPulledFromFeedAt ? INTERRUPTION_TABLE_COLS_WITH_PULLED : INTERRUPTION_TABLE_COLS_BASE;
  return hasDeletedAt
    ? `SELECT ${cols}, deleted_at FROM aleco_interruptions`
    : `SELECT ${cols} FROM aleco_interruptions`;
}

function listInterruptionCols(hasDeletedAt, hasPulledFromFeedAt) {
  const cols = hasPulledFromFeedAt ? INTERRUPTION_TABLE_COLS_WITH_PULLED : INTERRUPTION_TABLE_COLS_BASE;
  return hasDeletedAt ? `${cols}, deleted_at` : cols;
}

const TYPES = new Set(['Scheduled', 'Unscheduled']);
const STATUSES = new Set(['Pending', 'Ongoing', 'Restored']);
const CAUSE_CATEGORY_VALUES = new Set([
  'Maintenance',
  'Equipment',
  'Vegetation',
  'Weather',
  'ThirdParty',
  'Load',
  'Other',
]);

/** @returns {{ value: string|null, error?: string }} */
function parseCauseCategoryInput(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return { value: null };
  const v = String(raw).trim();
  if (!CAUSE_CATEGORY_VALUES.has(v)) {
    return {
      value: null,
      error:
        'causeCategory must be one of: Maintenance, Equipment, Vegetation, Weather, ThirdParty, Load, Other (or empty).',
    };
  }
  return { value: v };
}

function validatePayload(body, { partial = false } = {}) {
  const errors = [];
  const type = body.type;
  const status = body.status;
  const feeder = body.feeder;
  const cause = body.cause;
  const bodyText = body.body;
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
  const hasBody = bodyText !== undefined && bodyText !== null && String(bodyText).trim() !== '';
  const hasLegacy = cause !== undefined && cause !== null && String(cause).trim() !== '';
  if (!partial) {
    if (!hasBody && !hasLegacy) {
      errors.push('Provide either body (free-form post) or cause (legacy). At least one is required.');
    }
  }
  if (!partial || dateTimeStart !== undefined) {
    const dt = toMysqlDateTime(dateTimeStart);
    if (!dt) errors.push('dateTimeStart is required and must be a valid date/time');
  }

  if (
    body.publicVisibleAt !== undefined &&
    body.publicVisibleAt !== null &&
    String(body.publicVisibleAt).trim() !== ''
  ) {
    if (!toMysqlDateTime(body.publicVisibleAt)) {
      errors.push('publicVisibleAt must be a valid date/time');
    }
  }

  if (body.causeCategory !== undefined) {
    const cc = parseCauseCategoryInput(body.causeCategory);
    if (cc.error) errors.push(cc.error);
  }

  return errors;
}

/**
 * Build WHERE for list: visibility window + optional soft-delete filters.
 * @param {boolean} hasDeletedAtColumn - false if migration not applied (ignore archive query flags).
 * @param {boolean} hasPulledFromFeedAtColumn - false if migration not applied.
 */
function buildInterruptionsListWhere(req, hasDeletedAtColumn, hasPulledFromFeedAtColumn = true) {
  const includeFuture =
    req.query.includeFuture === '1' ||
    req.query.includeFuture === 'true' ||
    req.query.includeScheduled === '1';
  const includeDeleted =
    req.query.includeDeleted === '1' || req.query.includeDeleted === 'true';
  const deletedOnly = req.query.deletedOnly === '1' || req.query.deletedOnly === 'true';

  const clauses = [];
  if (!includeFuture) {
    clauses.push('(public_visible_at IS NULL OR public_visible_at <= NOW())');
    if (hasPulledFromFeedAtColumn) {
      clauses.push('pulled_from_feed_at IS NULL');
    }
  }
  if (hasDeletedAtColumn) {
    if (deletedOnly) {
      clauses.push('deleted_at IS NOT NULL');
    } else if (!includeDeleted) {
      clauses.push('deleted_at IS NULL');
    }
  }
  return clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
}

/** Public + admin list (default: non-deleted only; admin archive via query flags). */
router.get('/interruptions', async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit), 10) || 100, 1), 200);
    const hasDel = await getAlecoInterruptionsDeletedAtSupported(pool);
    // Auto-upgrade Pending -> Ongoing when go-live (publicVisibleAt or dateTimeStart) has passed
    const upgradeWhere = hasDel
      ? "status = 'Pending' AND deleted_at IS NULL AND (COALESCE(public_visible_at, date_time_start) <= NOW())"
      : "status = 'Pending' AND (COALESCE(public_visible_at, date_time_start) <= NOW())";
    const phNow = nowPhilippineForMysql();
    await pool.query(
      `UPDATE aleco_interruptions SET status = 'Ongoing', updated_at = ? WHERE ${upgradeWhere}`,
      [phNow]
    );
    // Auto-archive Restored advisories after 1 day 12 hours from restoration time
    if (hasDel) {
      await pool.query(
        `UPDATE aleco_interruptions SET deleted_at = ? WHERE status = 'Restored' AND deleted_at IS NULL
         AND date_time_restored IS NOT NULL AND DATE_ADD(date_time_restored, INTERVAL ? HOUR) <= ?`,
        [phNow, RESOLVED_ARCHIVE_HOURS, phNow]
      );
    }
    const hasPulled = await getAlecoInterruptionsPulledFromFeedAtSupported(pool);
    const visibilityWhere = buildInterruptionsListWhere(req, hasDel, hasPulled);
    const listCols = listInterruptionCols(hasDel, hasPulled);
    const [rows] = await pool.query(
      `SELECT ${listCols}
       FROM aleco_interruptions${visibilityWhere}
       ORDER BY date_time_start DESC
       LIMIT ${limit}`
    );
    const list = Array.isArray(rows) ? rows.map(mapRowToDto).filter(Boolean) : [];
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, data: list });
  } catch (error) {
    console.error('Interruptions fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch interruptions.' });
  }
});

/** Upload image for advisory (optional). Returns imageUrl for form. */
router.post('/interruptions/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file || !req.file.path) {
      return res.status(400).json({ success: false, message: 'No image file uploaded.' });
    }
    res.json({ success: true, imageUrl: req.file.path });
  } catch (error) {
    console.error('Interruptions upload image error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload image.' });
  }
});

/** Single advisory + remarks/updates (admin) */
router.get('/interruptions/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid id.' });

  try {
    const hasDel = await getAlecoInterruptionsDeletedAtSupported(pool);
    const hasPulled = await getAlecoInterruptionsPulledFromFeedAtSupported(pool);
    const [rows] = await pool.execute(`${selectInterruptionRowSql(hasDel, hasPulled)} WHERE id = ?`, [id]);
    const row = rows[0];
    if (!row) {
      return res.status(404).json({ success: false, message: 'Interruption not found.' });
    }
    const dto = mapRowToDto(row);
    const updates = await listUpdates(pool, id);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, data: { ...dto, updates } });
  } catch (error) {
    console.error('Interruptions get by id error:', error);
    res.status(500).json({ success: false, message: 'Failed to load interruption.' });
  }
});

/** Append remark (optional notes for advisory) */
router.post('/interruptions/:id/updates', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid id.' });

  const remark = req.body?.remark;
  const actorEmail = req.body?.actorEmail ?? null;
  const actorName = req.body?.actorName ?? null;

  try {
    const hasDel = await getAlecoInterruptionsDeletedAtSupported(pool);
    const existsSql = hasDel
      ? 'SELECT id FROM aleco_interruptions WHERE id = ? AND deleted_at IS NULL'
      : 'SELECT id FROM aleco_interruptions WHERE id = ?';
    const [existing] = await pool.execute(existsSql, [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Interruption not found.' });
    }

    const created = await addUserUpdate(pool, id, { remark, actorEmail, actorName });
    const updates = await listUpdates(pool, id);
    res.status(201).json({ success: true, data: { created, updates } });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error('Interruptions add update error:', error);
    res.status(500).json({ success: false, message: 'Failed to add update.' });
  }
});

/** Create (admin UI): no restoration time; status derived from type + start */
router.post('/interruptions', async (req, res) => {
  const errs = validatePayload(req.body, { partial: false });
  if (errs.length) return res.status(400).json({ success: false, message: errs.join(' ') });

  const {
    type,
    affectedAreas,
    feeder,
    cause,
    causeCategory,
    body: bodyText,
    controlNo,
    imageUrl,
    dateTimeStart,
    dateTimeEndEstimated,
    publicVisibleAt,
    actorEmail,
    actorName,
  } = req.body;

  const areasText = serializeAffectedAreas(affectedAreas ?? []);
  const start = toMysqlDateTime(dateTimeStart);
  const endEst = dateTimeEndEstimated ? toMysqlDateTime(dateTimeEndEstimated) : null;
  const restored = null;
  const initialStatus = computeInitialStatus(type, start);
  const causeCat = parseCauseCategoryInput(causeCategory).value;
  const pubVis =
    publicVisibleAt !== undefined && publicVisibleAt !== null && String(publicVisibleAt).trim() !== ''
      ? toMysqlDateTime(publicVisibleAt)
      : null;
  const bodyVal = bodyText != null && String(bodyText).trim() !== '' ? String(bodyText).trim() : null;
  const causeVal = cause != null && String(cause).trim() !== '' ? String(cause).trim() : null;
  const controlNoVal = controlNo != null && String(controlNo).trim() !== '' ? String(controlNo).trim() : null;
  const imageUrlVal = imageUrl != null && String(imageUrl).trim() !== '' ? String(imageUrl).trim() : null;

  try {
    const hasDel = await getAlecoInterruptionsDeletedAtSupported(pool);
    const phNow = nowPhilippineForMysql();
    const [result] = await pool.execute(
      `INSERT INTO aleco_interruptions
       (type, status, affected_areas, feeder, cause, cause_category, body, control_no, image_url, date_time_start, date_time_end_estimated, date_time_restored, public_visible_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        type,
        initialStatus,
        areasText,
        String(feeder).trim(),
        causeVal,
        causeCat,
        bodyVal,
        controlNoVal,
        imageUrlVal,
        start,
        endEst,
        restored,
        pubVis,
        phNow,
        phNow,
      ]
    );
    const hasPulled = await getAlecoInterruptionsPulledFromFeedAtSupported(pool);
    const [rows] = await pool.execute(`${selectInterruptionRowSql(hasDel, hasPulled)} WHERE id = ?`, [result.insertId]);
    const row = rows[0];
    const dto = row ? mapRowToDto(row) : null;
    if (!dto) {
      return res.status(500).json({ success: false, message: 'Failed to load created interruption.' });
    }
    const actor = actorName || actorEmail || 'Staff';
    const createdAtStr = dto.createdAt || '';
    await insertSystemUpdate(
      pool,
      result.insertId,
      `Advisory published by ${actor} at ${createdAtStr}`,
      { actorEmail: actorEmail ?? null, actorName: actorName ?? null }
    );
    res.status(201).json({ success: true, data: dto });
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
    statusChangeRemark,
    affectedAreas,
    feeder,
    cause,
    causeCategory,
    body: bodyText,
    controlNo,
    imageUrl,
    dateTimeStart,
    dateTimeEndEstimated,
    dateTimeRestored,
    publicVisibleAt,
    actorEmail,
    actorName,
  } = req.body;

  try {
    const hasDel = await getAlecoInterruptionsDeletedAtSupported(pool);
    const loadCols = hasDel
      ? `id, type, status, affected_areas, feeder, cause, cause_category, body, control_no, image_url,
       date_time_start, date_time_end_estimated, date_time_restored, public_visible_at, deleted_at`
      : `id, type, status, affected_areas, feeder, cause, cause_category, body, control_no, image_url,
       date_time_start, date_time_end_estimated, date_time_restored, public_visible_at`;
    const [fullRows] = await pool.execute(
      `SELECT ${loadCols}
       FROM aleco_interruptions WHERE id = ?`,
      [id]
    );
    const ex = fullRows[0];
    if (!ex) {
      return res.status(404).json({ success: false, message: 'Interruption not found.' });
    }
    if (hasDel && ex.deleted_at != null && String(ex.deleted_at).trim() !== '') {
      return res.status(410).json({
        success: false,
        message: 'This advisory is archived. Restore it before editing.',
      });
    }

    const expectedUpdatedAt = req.body?.expectedUpdatedAt;
    let expectedMysql = null;
    if (expectedUpdatedAt !== undefined && expectedUpdatedAt !== null && String(expectedUpdatedAt).trim() !== '') {
      expectedMysql = toMysqlDateTime(expectedUpdatedAt);
      if (!expectedMysql) {
        return res.status(400).json({ success: false, message: 'expectedUpdatedAt must be a valid date/time.' });
      }
      // Client sends "YYYY-MM-DD HH:mm:ss" (Philippine) or ISO; toMysqlDateTime normalizes both.
      // Comparison uses minute precision to avoid second-level false conflicts.
    }

    const nextStatus = status !== undefined ? status : ex.status;
    const statusIsChanging = status !== undefined && status !== ex.status;
    const isPendingToOngoing = ex.status === 'Pending' && nextStatus === 'Ongoing';
    if (statusIsChanging && !isPendingToOngoing) {
      const remark = statusChangeRemark != null ? String(statusChangeRemark).trim() : '';
      if (!remark) {
        return res.status(400).json({
          success: false,
          message: 'A remark is required when changing status (except Upcoming to Ongoing). Explain the reason for this change.',
        });
      }
    }
    const hasNonEmptyRestored =
      dateTimeRestored !== undefined &&
      dateTimeRestored !== null &&
      String(dateTimeRestored).trim() !== '';

    if (hasNonEmptyRestored && nextStatus !== 'Restored') {
      return res.status(400).json({
        success: false,
        message: 'dateTimeRestored is only allowed when status is Resolved (Restored).',
      });
    }

    if (nextStatus === 'Restored') {
      let restoredMysql = null;
      if (hasNonEmptyRestored) {
        restoredMysql = toMysqlDateTime(dateTimeRestored);
      } else {
        restoredMysql = ex.date_time_restored ? toMysqlDateTimeFromRow(ex.date_time_restored) : null;
      }
      if (!restoredMysql) {
        return res.status(400).json({
          success: false,
          message: 'Resolved status requires actual restoration date/time (dateTimeRestored).',
        });
      }
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
      params.push(cause != null && String(cause).trim() !== '' ? String(cause).trim() : null);
    }
    if (bodyText !== undefined) {
      fields.push('body = ?');
      params.push(bodyText != null && String(bodyText).trim() !== '' ? String(bodyText).trim() : null);
    }
    if (controlNo !== undefined) {
      fields.push('control_no = ?');
      params.push(controlNo != null && String(controlNo).trim() !== '' ? String(controlNo).trim() : null);
    }
    if (imageUrl !== undefined) {
      fields.push('image_url = ?');
      params.push(imageUrl != null && String(imageUrl).trim() !== '' ? String(imageUrl).trim() : null);
    }
    if (causeCategory !== undefined) {
      const cc = parseCauseCategoryInput(causeCategory);
      if (cc.error) return res.status(400).json({ success: false, message: cc.error });
      fields.push('cause_category = ?');
      params.push(cc.value);
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
      if (nextStatus === 'Restored') {
        const v = hasNonEmptyRestored
          ? toMysqlDateTime(dateTimeRestored)
          : ex.date_time_restored
            ? toMysqlDateTimeFromRow(ex.date_time_restored)
            : null;
        if (v) {
          fields.push('date_time_restored = ?');
          params.push(v);
        }
      } else {
        fields.push('date_time_restored = ?');
        params.push(null);
      }
    }
    if (publicVisibleAt !== undefined) {
      fields.push('public_visible_at = ?');
      const pv =
        publicVisibleAt === null || publicVisibleAt === ''
          ? null
          : toMysqlDateTime(publicVisibleAt);
      params.push(pv);
    }

    if (status !== undefined && status !== 'Restored' && dateTimeRestored === undefined) {
      fields.push('date_time_restored = ?');
      params.push(null);
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }
    fields.push('updated_at = ?');
    params.push(nowPhilippineForMysql());

    let whereSql = 'WHERE id = ?';
    const whereParams = [id];
    if (expectedMysql) {
      whereSql +=
        " AND DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i') = DATE_FORMAT(?, '%Y-%m-%d %H:%i')";
      whereParams.push(expectedMysql);
    }

    const [upd] = await pool.execute(
      `UPDATE aleco_interruptions SET ${fields.join(', ')} ${whereSql}`,
      [...params, ...whereParams]
    );
    if (upd.affectedRows === 0) {
      if (expectedMysql) {
        return res.status(409).json({
          success: false,
          message: 'This advisory was updated elsewhere. Reload the form and try again.',
        });
      }
      return res.status(404).json({ success: false, message: 'Interruption not found.' });
    }

    if (statusIsChanging && !isPendingToOngoing && statusChangeRemark) {
      const remarkText = String(statusChangeRemark).trim();
      if (remarkText) {
        const statusLabels = { Pending: 'Upcoming', Ongoing: 'Ongoing', Restored: 'Resolved' };
        const fromLabel = statusLabels[ex.status] ?? ex.status;
        const toLabel = statusLabels[nextStatus] ?? nextStatus;
        const fullRemark = `Status changed from ${fromLabel} to ${toLabel}: ${remarkText}`;
        await addUserUpdate(pool, id, {
          remark: fullRemark,
          actorEmail: actorEmail ?? null,
          actorName: actorName ?? null,
        });
      }
    }

    const hasPulled = await getAlecoInterruptionsPulledFromFeedAtSupported(pool);
    const [rows] = await pool.execute(`${selectInterruptionRowSql(hasDel, hasPulled)} WHERE id = ?`, [id]);
    const dto = rows[0] ? mapRowToDto(rows[0]) : null;
    if (!dto) {
      return res.status(500).json({ success: false, message: 'Failed to load updated interruption.' });
    }
    res.json({ success: true, data: dto });
  } catch (error) {
    console.error('Interruptions update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update interruption.' });
  }
});

/**
 * Soft delete (UX still uses DELETE). Row and remarks remain for reporting.
 */
router.delete('/interruptions/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid id.' });

  try {
    const hasDel = await getAlecoInterruptionsDeletedAtSupported(pool);
    if (hasDel) {
      const [result] = await pool.execute(
        `UPDATE aleco_interruptions SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL`,
        [nowPhilippineForMysql(), id]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Interruption not found or already archived.' });
      }
      res.json({ success: true, message: 'Archived.' });
      return;
    }
    const [result] = await pool.execute('DELETE FROM aleco_interruptions WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Interruption not found.' });
    }
    res.json({ success: true, message: 'Deleted.' });
  } catch (error) {
    console.error('Interruptions delete error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove interruption.' });
  }
});

/** Permanently delete an archived advisory. Only allowed when deleted_at IS NOT NULL. */
router.delete('/interruptions/:id/permanent', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid id.' });

  try {
    const hasDel = await getAlecoInterruptionsDeletedAtSupported(pool);
    if (!hasDel) {
      return res.status(503).json({
        success: false,
        message: 'Permanent delete requires the soft-delete migration. Archive first, then delete permanently.',
      });
    }
    const [check] = await pool.execute(
      'SELECT id, deleted_at FROM aleco_interruptions WHERE id = ?',
      [id]
    );
    if (check.length === 0) {
      return res.status(404).json({ success: false, message: 'Advisory not found.' });
    }
    if (check[0].deleted_at == null || String(check[0].deleted_at).trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Only archived advisories can be permanently deleted. Archive the advisory first.',
      });
    }
    await pool.execute('DELETE FROM aleco_interruptions WHERE id = ?', [id]);
    res.json({ success: true, message: 'Permanently deleted.' });
  } catch (error) {
    console.error('Interruptions permanent delete error:', error);
    res.status(500).json({ success: false, message: 'Failed to permanently delete.' });
  }
});

/** Restore a soft-deleted advisory (admin). */
router.patch('/interruptions/:id/restore', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid id.' });

  try {
    const hasDel = await getAlecoInterruptionsDeletedAtSupported(pool);
    if (!hasDel) {
      return res.status(503).json({
        success: false,
        message: 'Restore is not available until the database migration for soft delete is applied.',
      });
    }
    const [result] = await pool.execute(
      `UPDATE aleco_interruptions SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL`,
      [id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Interruption not found or not archived.' });
    }
    const hasPulled = await getAlecoInterruptionsPulledFromFeedAtSupported(pool);
    const [rows] = await pool.execute(`${selectInterruptionRowSql(true, hasPulled)} WHERE id = ?`, [id]);
    const dto = rows[0] ? mapRowToDto(rows[0]) : null;
    if (!dto) {
      return res.status(500).json({ success: false, message: 'Failed to load restored interruption.' });
    }
    res.json({ success: true, data: dto });
  } catch (error) {
    console.error('Interruptions restore error:', error);
    res.status(500).json({ success: false, message: 'Failed to restore interruption.' });
  }
});

/** Pull advisory out of public feed (temporarily hide without archiving). */
router.patch('/interruptions/:id/pull-from-feed', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid id.' });

  try {
    const hasDel = await getAlecoInterruptionsDeletedAtSupported(pool);
    const hasPulled = await getAlecoInterruptionsPulledFromFeedAtSupported(pool);
    if (!hasPulled) {
      return res.status(503).json({
        success: false,
        message: 'Pull from feed requires migration. Run: node backend/run-migration.js backend/migrations/add_pulled_from_feed_at_interruptions.sql',
      });
    }
    const [check] = await pool.execute(
      hasDel
        ? 'SELECT id, deleted_at FROM aleco_interruptions WHERE id = ?'
        : 'SELECT id FROM aleco_interruptions WHERE id = ?',
      [id]
    );
    if (check.length === 0) {
      return res.status(404).json({ success: false, message: 'Advisory not found.' });
    }
    if (hasDel && check[0].deleted_at != null && String(check[0].deleted_at).trim() !== '') {
      return res.status(410).json({
        success: false,
        message: 'Archived advisories cannot be pulled. Restore it first.',
      });
    }
    const phNow = nowPhilippineForMysql();
    await pool.execute(
      'UPDATE aleco_interruptions SET pulled_from_feed_at = ?, updated_at = ? WHERE id = ?',
      [phNow, phNow, id]
    );
    const [rows] = await pool.execute(`${selectInterruptionRowSql(hasDel, true)} WHERE id = ?`, [id]);
    const dto = rows[0] ? mapRowToDto(rows[0]) : null;
    res.json({ success: true, data: dto, message: 'Advisory pulled from public feed.' });
  } catch (error) {
    console.error('Pull from feed error:', error);
    res.status(500).json({ success: false, message: 'Failed to pull advisory from feed.' });
  }
});

/** Push advisory back into public feed (make visible again per normal rules). */
router.patch('/interruptions/:id/push-to-feed', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid id.' });

  try {
    const hasDel = await getAlecoInterruptionsDeletedAtSupported(pool);
    const hasPulled = await getAlecoInterruptionsPulledFromFeedAtSupported(pool);
    if (!hasPulled) {
      return res.status(503).json({
        success: false,
        message: 'Push to feed requires migration. Run: node backend/run-migration.js backend/migrations/add_pulled_from_feed_at_interruptions.sql',
      });
    }
    const [check] = await pool.execute(
      hasDel
        ? 'SELECT id, deleted_at FROM aleco_interruptions WHERE id = ?'
        : 'SELECT id FROM aleco_interruptions WHERE id = ?',
      [id]
    );
    if (check.length === 0) {
      return res.status(404).json({ success: false, message: 'Advisory not found.' });
    }
    if (hasDel && check[0].deleted_at != null && String(check[0].deleted_at).trim() !== '') {
      return res.status(410).json({
        success: false,
        message: 'Archived advisories cannot be pushed. Restore it first.',
      });
    }
    await pool.execute(
      'UPDATE aleco_interruptions SET pulled_from_feed_at = NULL, updated_at = ? WHERE id = ?',
      [nowPhilippineForMysql(), id]
    );
    const [rows] = await pool.execute(`${selectInterruptionRowSql(hasDel, true)} WHERE id = ?`, [id]);
    const dto = rows[0] ? mapRowToDto(rows[0]) : null;
    res.json({ success: true, data: dto, message: 'Advisory pushed back to public feed.' });
  } catch (error) {
    console.error('Push to feed error:', error);
    res.status(500).json({ success: false, message: 'Failed to push advisory to feed.' });
  }
});

export default router;
