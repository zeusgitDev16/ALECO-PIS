import express from 'express';
import pool from '../config/db.js';
import { upload, cloudinary } from '../../cloudinaryConfig.js';
import {
  serializeAffectedAreas,
  serializeAffectedAreasGroupedForDb,
  toMysqlDateTime,
  mapRowToDto,
  computeInitialStatus,
  toMysqlDateTimeFromRow,
  toIsoForClient,
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
  getAlecoInterruptionsPosterExtrasSupported,
  getAlecoInterruptionsTypeDbEnum,
  getAlecoInterruptionsStatusDbEnum,
} from '../utils/interruptionsDbSupport.js';
import { apiInterruptionTypeToDbLiteral, apiInterruptionStatusToDbLiteral } from '../utils/interruptionTypeDbEnum.js';
import { clampSqlInt } from '../utils/safeSqlInt.js';
import { RESOLVED_ARCHIVE_HOURS } from '../constants/interruptionConstants.js';
import { INTERRUPTION_TYPES, INTERRUPTION_STATUSES } from '../constants/interruptionFieldEnums.js';
import { recordInterruptionNotification, INTERRUPTIONS_EVENT } from '../utils/adminNotifications.js';
import { requireAdmin } from '../middleware/requireRole.js';
import { getPublicAppBaseUrl } from '../utils/posterCaptureUrl.js';
import {
  maybeRegeneratePosterAfterMutation,
  captureInterruptionPosterForAdmin,
} from '../services/interruptionPosterCapture.js';
import { escapeHtmlAttr, shareHeadlineFromType, shareDescriptionFromDto } from '../utils/interruptionShareHtml.js';

const router = express.Router();

/**
 * @param {import('express').Request} req
 * @param {number} id
 */
function sharePageAbsoluteUrl(req, id) {
  const proto = String(req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
  const host = String(req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim();
  if (!host) return '';
  return `${proto}://${host}/api/share/interruption/${id}`;
}

/**
 * @param {import('mysql2/promise').Pool} pool
 * @param {number} id
 */
async function loadPublicVisibleInterruptionRowById(pool, id) {
  const hasDel = await getAlecoInterruptionsDeletedAtSupported(pool);
  const hasPulled = await getAlecoInterruptionsPulledFromFeedAtSupported(pool);
  const hasPoster = await getAlecoInterruptionsPosterExtrasSupported(pool);
  const vis = publicInterruptionVisibilityAndClauses(hasDel, hasPulled).join(' AND ');
  const sql = `${selectInterruptionRowSql(hasDel, hasPulled, hasPoster)} WHERE id = ? AND ${vis}`;
  const [rows] = await pool.execute(sql, [id]);
  return rows[0] || null;
}

/** Columns for list + single-row fetch (see `selectInterruptionRowSql`). */
function buildInterruptionTableColList({ includeDeletedAt, hasPulledFromFeedAt, hasPosterExtras }) {
  const parts = ['id', 'type', 'status', 'affected_areas'];
  if (hasPosterExtras) parts.push('affected_areas_grouped');
  parts.push('feeder', 'feeder_id', 'cause', 'cause_category', 'body', 'control_no', 'image_url');
  if (hasPosterExtras) parts.push('poster_image_url');
  parts.push(
    'date_time_start',
    'date_time_end_estimated',
    'date_time_restored',
    'public_visible_at',
    'scheduled_restore_at',
    'scheduled_restore_remark'
  );
  if (hasPulledFromFeedAt) parts.push('pulled_from_feed_at');
  parts.push('created_at', 'updated_at');
  if (includeDeletedAt) parts.push('deleted_at');
  return parts.join(', ');
}

/** Minimal column set for PUT conflict / load existing row (no pulled_from_feed_at / timestamps for audit). */
function buildInterruptionUpdateLoadCols(includeDeletedAt, hasPosterExtras) {
  const parts = ['id', 'type', 'status', 'affected_areas'];
  if (hasPosterExtras) parts.push('affected_areas_grouped');
  parts.push('feeder', 'feeder_id', 'cause', 'cause_category', 'body', 'control_no', 'image_url');
  if (hasPosterExtras) parts.push('poster_image_url');
  parts.push(
    'date_time_start',
    'date_time_end_estimated',
    'date_time_restored',
    'public_visible_at',
    'scheduled_restore_at',
    'scheduled_restore_remark'
  );
  if (includeDeletedAt) parts.push('deleted_at');
  return parts.join(', ');
}

function selectInterruptionRowSql(hasDeletedAt, hasPulledFromFeedAt, hasPosterExtras) {
  const cols = buildInterruptionTableColList({
    includeDeletedAt: hasDeletedAt,
    hasPulledFromFeedAt,
    hasPosterExtras,
  });
  return `SELECT ${cols} FROM aleco_interruptions`;
}

function listInterruptionCols(hasDeletedAt, hasPulledFromFeedAt, hasPosterExtras) {
  return buildInterruptionTableColList({
    includeDeletedAt: hasDeletedAt,
    hasPulledFromFeedAt,
    hasPosterExtras,
  });
}

const TYPES = INTERRUPTION_TYPES;
const STATUSES = INTERRUPTION_STATUSES;
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
  const isNgcpScheduled = type === 'NgcScheduled';
  const status = body.status;
  const feeder = body.feeder;
  const feederIdRaw = body.feederId;
  const cause = body.cause;
  const bodyText = body.body;
  const dateTimeStart = body.dateTimeStart;

  if (!partial || type !== undefined) {
    if (!type || !TYPES.has(type)) {
      errors.push('type must be Scheduled, Emergency, or NgcScheduled');
    }
  }
  if (!partial || status !== undefined) {
    if (!status || !STATUSES.has(status)) errors.push('status must be Pending, Ongoing, or Energized');
  }
  if (!isNgcpScheduled && (!partial || feeder !== undefined || feederIdRaw !== undefined)) {
    const hasFeederText = feeder != null && String(feeder).trim() !== '';
    const hasFeederId =
      feederIdRaw !== undefined &&
      feederIdRaw !== null &&
      String(feederIdRaw).trim() !== '' &&
      Number.isInteger(Number(feederIdRaw)) &&
      Number(feederIdRaw) > 0;
    if (!hasFeederText && !hasFeederId) {
      errors.push('feeder is required');
    }
  }
  const hasBody = bodyText !== undefined && bodyText !== null && String(bodyText).trim() !== '';
  const hasLegacy = cause !== undefined && cause !== null && String(cause).trim() !== '';
  if (!partial) {
    if (!hasBody && !hasLegacy) {
      errors.push('Provide either body (free-form post) or cause (legacy). At least one is required.');
    }
    if (type === 'NgcScheduled') {
      const img = body.imageUrl;
      if (img == null || String(img).trim() === '') {
        errors.push('imageUrl is required for NgcScheduled advisories.');
      }
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

  if (body.affectedAreasGrouped !== undefined && body.affectedAreasGrouped !== null) {
    if (!Array.isArray(body.affectedAreasGrouped)) {
      errors.push('affectedAreasGrouped must be an array when provided');
    }
  }

  if (!partial) {
    const sra = body.scheduledRestoreAt;
    if (sra != null && String(sra).trim() !== '') {
      const baseline = isNgcpScheduled ? body.dateTimeStart : body.dateTimeEndEstimated;
      const baselineLabel = isNgcpScheduled ? 'dateTimeStart' : 'dateTimeEndEstimated (ERT)';
      if (baseline == null || String(baseline).trim() === '') {
        errors.push(`${baselineLabel} is required when scheduledRestoreAt is set.`);
      } else {
        const tS = toMysqlDateTime(sra);
        const tB = toMysqlDateTime(baseline);
        if (tS && tB && tS <= tB) {
          errors.push(
            isNgcpScheduled
              ? 'scheduledRestoreAt must be after dateTimeStart.'
              : 'scheduledRestoreAt must be after dateTimeEndEstimated (ERT).'
          );
        }
      }
    }
  }

  return errors;
}

/**
 * When setting a non-empty scheduled restore, ensure it is strictly after ERT (use row ERT if body omits it).
 * @param {string|null|undefined} scheduledRaw
 * @param {string|null|undefined} ertFromBody
 * @param {unknown} ertFromRow - existing DB value
 * @returns {string|null} error message or null
 */
function assertScheduledRestoreAfterBaseline(
  scheduledRaw,
  baselineFromBody,
  baselineFromRow,
  { baselineLabel = 'dateTimeEndEstimated (ERT)' } = {}
) {
  if (scheduledRaw === undefined) return null;
  if (scheduledRaw === null || String(scheduledRaw).trim() === '') return null;
  const tS = toMysqlDateTime(scheduledRaw);
  if (!tS) return 'scheduledRestoreAt must be a valid date/time.';
  const baseline =
    baselineFromBody != null && String(baselineFromBody).trim() !== '' ? baselineFromBody : baselineFromRow;
  if (baseline == null || String(baseline).trim() === '') {
    return `${baselineLabel} is required when scheduling automatic restoration.`;
  }
  const tB = toMysqlDateTime(baseline) || toMysqlDateTimeFromRow(baseline);
  if (!tB) return `${baselineLabel} is invalid.`;
  if (tS <= tB) {
    return baselineLabel === 'dateTimeStart'
      ? 'Auto-restore time must be after Start time.'
      : 'Auto-restore time must be after ERT (estimated restoration).';
  }
  return null;
}

async function resolveFeederById(feederId) {
  const id = Number(feederId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const [rows] = await pool.execute(
    `SELECT f.id, f.feeder_label
     FROM aleco_feeders f
     JOIN aleco_feeder_areas a ON a.id = f.area_id
     WHERE f.id = ? AND f.is_active = 1 AND a.is_active = 1
     LIMIT 1`,
    [id]
  );
  return rows?.[0] || null;
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
    clauses.push('(public_visible_at IS NULL OR public_visible_at <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))');
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

/**
 * AND fragments for rows visible on the public bulletin (same as default `GET /interruptions` list).
 * @param {boolean} hasDeletedAtColumn
 * @param {boolean} hasPulledFromFeedAtColumn
 * @returns {string[]}
 */
function publicInterruptionVisibilityAndClauses(hasDeletedAtColumn, hasPulledFromFeedAtColumn) {
  const clauses = ['(public_visible_at IS NULL OR public_visible_at <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))'];
  if (hasPulledFromFeedAtColumn) {
    clauses.push('pulled_from_feed_at IS NULL');
  }
  if (hasDeletedAtColumn) {
    clauses.push('deleted_at IS NULL');
  }
  return clauses;
}

/** If query asks for admin-only views (archive / future / scheduled), enforce admin role. */
function requireAdminIfListQueryFlags(req, res, next) {
  const q = req.query || {};
  const adminList =
    q.includeDeleted === '1' ||
    q.includeDeleted === 'true' ||
    q.deletedOnly === '1' ||
    q.deletedOnly === 'true' ||
    q.includeFuture === '1' ||
    q.includeFuture === 'true' ||
    q.includeScheduled === '1';
  if (adminList) return requireAdmin(req, res, next);
  return next();
}

/** Public + admin list (default: non-deleted only; admin archive via query flags). */
router.get('/interruptions', requireAdminIfListQueryFlags, async (req, res) => {
  try {
    const limit = clampSqlInt(req.query.limit, 1, 200, 100);
    const hasDel = await getAlecoInterruptionsDeletedAtSupported(pool);
    const hasPulled = await getAlecoInterruptionsPulledFromFeedAtSupported(pool);
    const hasPoster = await getAlecoInterruptionsPosterExtrasSupported(pool);
    // Resolve 'Energized' vs 'Restored' depending on what the DB ENUM actually contains
    const statusDbEnum = await getAlecoInterruptionsStatusDbEnum(pool);
    const energizedDbLiteral = apiInterruptionStatusToDbLiteral('Energized', statusDbEnum).status ?? 'Energized';
    // Auto-upgrade Pending -> Ongoing when go-live (publicVisibleAt or dateTimeStart) has passed
    const upgradeWhere = hasDel
      ? "status = 'Pending' AND deleted_at IS NULL AND (COALESCE(public_visible_at, date_time_start) <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))"
      : "status = 'Pending' AND (COALESCE(public_visible_at, date_time_start) <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))";
    const phNow = nowPhilippineForMysql();

    // If a scheduled advisory goes live now and still has no poster URL, queue poster generation.
    // This fills the same gap as "display immediately" advisories that generate poster on create.
    let goLivePosterCandidates = [];
    if (hasPoster) {
      const goLivePosterWhere = `${upgradeWhere} AND (poster_image_url IS NULL OR TRIM(poster_image_url) = '')`;
      const [candRows] = await pool.query(
        `SELECT ${listInterruptionCols(hasDel, hasPulled, hasPoster)}
         FROM aleco_interruptions
         WHERE ${goLivePosterWhere}
         LIMIT 80`
      );
      goLivePosterCandidates = Array.isArray(candRows) ? candRows : [];
    }

    await pool.query(
      `UPDATE aleco_interruptions SET status = 'Ongoing', updated_at = ? WHERE ${upgradeWhere}`,
      [phNow]
    );
    if (goLivePosterCandidates.length > 0) {
      setImmediate(async () => {
        try {
          const cols = listInterruptionCols(hasDel, hasPulled, hasPoster);
          for (const prevRaw of goLivePosterCandidates) {
            const id = Number(prevRaw?.id);
            if (!Number.isFinite(id) || id <= 0) continue;
            const [latestRows] = await pool.query(
              `SELECT ${cols} FROM aleco_interruptions WHERE id = ? LIMIT 1`,
              [id]
            );
            const nextRaw = Array.isArray(latestRows) ? latestRows[0] : null;
            if (!nextRaw) continue;
            await maybeRegeneratePosterAfterMutation(pool, id, prevRaw, nextRaw);
          }
        } catch (e) {
          console.warn('[poster] go-live auto regen:', e?.message || e);
        }
      });
    }
    // Auto-restore: mark as Energized when scheduled_restore_at has passed
    {
      const autoRestoreWhere = hasDel
        ? "status IN ('Pending','Ongoing') AND deleted_at IS NULL AND scheduled_restore_at IS NOT NULL AND scheduled_restore_at <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR)"
        : "status IN ('Pending','Ongoing') AND scheduled_restore_at IS NOT NULL AND scheduled_restore_at <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR)";
      const [dueRows] = await pool.query(
        `SELECT id, scheduled_restore_remark, feeder FROM aleco_interruptions WHERE ${autoRestoreWhere}`
      );
      for (const due of dueRows) {
        await pool.execute(
          `UPDATE aleco_interruptions SET status = '${energizedDbLiteral}', date_time_restored = ?, scheduled_restore_at = NULL, updated_at = ? WHERE id = ?`,
          [phNow, phNow, due.id]
        );
        const remark = due.scheduled_restore_remark
          ? String(due.scheduled_restore_remark).trim()
          : 'Automatically restored per schedule.';
        await insertSystemUpdate(
          pool,
          due.id,
          `Auto-restored: ${remark}`,
          { actorEmail: null, actorName: 'System' }
        );
      }
    }
    // Auto-archive Energized advisories after 1 day 12 hours from restoration time
    if (hasDel) {
      await pool.query(
        `UPDATE aleco_interruptions SET deleted_at = ? WHERE status = '${energizedDbLiteral}' AND deleted_at IS NULL
         AND date_time_restored IS NOT NULL AND DATE_ADD(date_time_restored, INTERVAL ? HOUR) <= ?`,
        [phNow, RESOLVED_ARCHIVE_HOURS, phNow]
      );
    }
    const visibilityWhere = buildInterruptionsListWhere(req, hasDel, hasPulled);
    const listCols = listInterruptionCols(hasDel, hasPulled, hasPoster);
    // Use a literal LIMIT: some MySQL/MariaDB builds reject `LIMIT ?` in prepared statements (ER_WRONG_ARGUMENTS).
    // `limit` is server-clamped to 1–200 (safe to interpolate).
    const [rows] = await pool.query(
      `SELECT ${listCols}
       FROM aleco_interruptions${visibilityWhere}
       ORDER BY date_time_start DESC
       LIMIT ${limit}`
    );
    const list = Array.isArray(rows) ? rows.map(mapRowToDto).filter(Boolean) : [];

    // Fetch earliest future public_visible_at so public page can schedule a precise refetch.
    const nextWhere = ['public_visible_at > DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR)'];
    if (hasDel) nextWhere.push('deleted_at IS NULL');
    if (hasPulled) nextWhere.push('pulled_from_feed_at IS NULL');
    const [[schedRow]] = await pool.query(
      `SELECT MIN(public_visible_at) AS next_at FROM aleco_interruptions WHERE ${nextWhere.join(' AND ')}`
    );
    const nextScheduledAt = schedRow?.next_at ? toIsoForClient(schedRow.next_at) : null;

    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, data: list, meta: { nextScheduledAt } });
  } catch (error) {
    console.error('Interruptions fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch interruptions.' });
  }
});

/** Upload image for advisory (optional). Returns imageUrl for form. */
router.post('/interruptions/upload-image', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    if (!req.file || !req.file.path) {
      return res.status(400).json({ success: false, message: 'No image file uploaded.' });
    }
    const contextType = req.body?.contextType != null ? String(req.body.contextType).trim() : '';
    const minNgcpWidth = 1200;
    const minNgcpHeight = 700;
    if (contextType === 'NgcScheduled') {
      const w = Number(req.file.width);
      const h = Number(req.file.height);
      if (Number.isFinite(w) && Number.isFinite(h)) {
        if (w < minNgcpWidth || h < minNgcpHeight) {
          console.warn(
            `[interruptions] low-resolution NGCP image accepted: ${w}x${h} (recommended >= ${minNgcpWidth}x${minNgcpHeight})`
          );
        }
      }
    }
    res.json({ success: true, imageUrl: req.file.path });
  } catch (error) {
    console.error('Interruptions upload image error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload image.' });
  }
});

/**
 * Public read-only advisory DTO for poster SPA / Puppeteer (no `updates[]`).
 * Same visibility rules as default public list: not archived, not pulled, public_visible_at passed.
 */
router.get('/public/interruptions/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid id.' });
  }

  try {
    const row = await loadPublicVisibleInterruptionRowById(pool, id);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Advisory not found or not public.' });
    }
    const dto = mapRowToDto(row);
    if (!dto) {
      return res.status(404).json({ success: false, message: 'Advisory not found or not public.' });
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, data: dto });
  } catch (error) {
    console.error('Public interruption snapshot error:', error);
    res.status(500).json({ success: false, message: 'Failed to load advisory.' });
  }
});

/**
 * Minimal HTML for Facebook / Open Graph (crawlers do not execute SPA meta).
 */
router.get('/share/interruption/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).type('text/plain').send('Invalid id.');
  }

  try {
    const row = await loadPublicVisibleInterruptionRowById(pool, id);
    if (!row) {
      return res.status(404).type('text/html').send('<!DOCTYPE html><html><body>Not found</body></html>');
    }
    const dto = mapRowToDto(row);
    if (!dto) {
      return res.status(404).type('text/html').send('<!DOCTYPE html><html><body>Not found</body></html>');
    }

    const env = typeof globalThis.process !== 'undefined' ? globalThis.process.env : {};
    const shareUrl = sharePageAbsoluteUrl(req, id);
    const spaBase = getPublicAppBaseUrl();
    const spaLink = spaBase ? `${spaBase.replace(/\/$/, '')}/` : '/';
    const title = escapeHtmlAttr(`${shareHeadlineFromType(dto.type)} | ALECO`);
    const desc = escapeHtmlAttr(shareDescriptionFromDto(dto));
    let image = dto.posterImageUrl && /^https?:\/\//i.test(String(dto.posterImageUrl).trim())
      ? String(dto.posterImageUrl).trim()
      : '';
    if (!image && env.INTERRUPTION_OG_FALLBACK_IMAGE_URL && String(env.INTERRUPTION_OG_FALLBACK_IMAGE_URL).trim()) {
      image = String(env.INTERRUPTION_OG_FALLBACK_IMAGE_URL).trim();
    }
    const ogImageBlock =
      image !== ''
        ? `<meta property="og:image" content="${escapeHtmlAttr(image)}">
<meta property="og:image:secure_url" content="${escapeHtmlAttr(image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${escapeHtmlAttr(image)}">`
        : '';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<meta property="og:type" content="website"/>
<meta property="og:title" content="${title}"/>
<meta property="og:description" content="${desc}"/>
<meta property="og:url" content="${escapeHtmlAttr(shareUrl)}"/>
${ogImageBlock}
</head>
<body>
<p><a href="${escapeHtmlAttr(spaLink)}">View on ALECO PIS</a></p>
</body>
</html>`;
    res.setHeader('Cache-Control', 'no-store');
    res.type('html').send(html);
  } catch (error) {
    console.error('Share interruption page error:', error);
    res.status(500).type('text/plain').send('Server error');
  }
});

/** Single advisory + remarks/updates (admin) */
router.get('/interruptions/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid id.' });

  try {
    const hasDel = await getAlecoInterruptionsDeletedAtSupported(pool);
    const hasPulled = await getAlecoInterruptionsPulledFromFeedAtSupported(pool);
    const hasPoster = await getAlecoInterruptionsPosterExtrasSupported(pool);
    const [rows] = await pool.execute(`${selectInterruptionRowSql(hasDel, hasPulled, hasPoster)} WHERE id = ?`, [id]);
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
router.post('/interruptions/:id/updates', requireAdmin, async (req, res) => {
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
router.post('/interruptions', requireAdmin, async (req, res) => {
  const errs = validatePayload(req.body, { partial: false });
  if (errs.length) return res.status(400).json({ success: false, message: errs.join(' ') });

  const {
    type,
    affectedAreas,
    feederId,
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
    let feederIdVal = null;
    let feederLabelVal = feeder != null ? String(feeder).trim() : '';
    if (feederId !== undefined && feederId !== null && String(feederId).trim() !== '') {
      const found = await resolveFeederById(feederId);
      if (!found) {
        return res.status(400).json({ success: false, message: 'Invalid feederId.' });
      }
      feederIdVal = Number(found.id);
      feederLabelVal = String(found.feeder_label || '').trim();
    }
    if (type === 'NgcScheduled' && !feederLabelVal) {
      feederLabelVal = 'NGCP NOTICE';
      feederIdVal = null;
    }
    if (!feederLabelVal) {
      return res.status(400).json({ success: false, message: 'feeder is required' });
    }

    const typeDbEnum = await getAlecoInterruptionsTypeDbEnum(pool);
    const typeWrite = apiInterruptionTypeToDbLiteral(type, typeDbEnum);
    if (typeWrite.error) {
      return res.status(400).json({ success: false, message: typeWrite.error });
    }
    const typeForDb = typeWrite.type;

    const hasDel = await getAlecoInterruptionsDeletedAtSupported(pool);
    const hasPulled = await getAlecoInterruptionsPulledFromFeedAtSupported(pool);
    const hasPoster = await getAlecoInterruptionsPosterExtrasSupported(pool);
    const phNow = nowPhilippineForMysql();
    let insertHeader;
    if (hasPoster) {
      const groupedSer = serializeAffectedAreasGroupedForDb(req.body.affectedAreasGrouped ?? []);
      const [h] = await pool.execute(
        `INSERT INTO aleco_interruptions
         (type, status, affected_areas, affected_areas_grouped, feeder, feeder_id, cause, cause_category, body, control_no, image_url, poster_image_url, date_time_start, date_time_end_estimated, date_time_restored, public_visible_at, scheduled_restore_at, scheduled_restore_remark, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          typeForDb,
          initialStatus,
          areasText,
          groupedSer,
          feederLabelVal,
          feederIdVal,
          causeVal,
          causeCat,
          bodyVal,
          controlNoVal,
          imageUrlVal,
          null,
          start,
          endEst,
          restored,
          pubVis,
          toMysqlDateTime(req.body.scheduledRestoreAt) || null,
          req.body.scheduledRestoreRemark != null && String(req.body.scheduledRestoreRemark).trim()
            ? String(req.body.scheduledRestoreRemark).trim()
            : null,
          phNow,
          phNow,
        ]
      );
      insertHeader = h;
    } else {
      const [h] = await pool.execute(
        `INSERT INTO aleco_interruptions
         (type, status, affected_areas, feeder, feeder_id, cause, cause_category, body, control_no, image_url, date_time_start, date_time_end_estimated, date_time_restored, public_visible_at, scheduled_restore_at, scheduled_restore_remark, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          typeForDb,
          initialStatus,
          areasText,
          feederLabelVal,
          feederIdVal,
          causeVal,
          causeCat,
          bodyVal,
          controlNoVal,
          imageUrlVal,
          start,
          endEst,
          restored,
          pubVis,
          toMysqlDateTime(req.body.scheduledRestoreAt) || null,
          req.body.scheduledRestoreRemark != null && String(req.body.scheduledRestoreRemark).trim()
            ? String(req.body.scheduledRestoreRemark).trim()
            : null,
          phNow,
          phNow,
        ]
      );
      insertHeader = h;
    }
    const [rows] = await pool.execute(`${selectInterruptionRowSql(hasDel, hasPulled, hasPoster)} WHERE id = ?`, [
      insertHeader.insertId,
    ]);
    const row = rows[0];
    const dto = row ? mapRowToDto(row) : null;
    if (!dto) {
      return res.status(500).json({ success: false, message: 'Failed to load created interruption.' });
    }
    const actor = actorName || actorEmail || 'Staff';
    const createdAtStr = dto.createdAt || '';
    await insertSystemUpdate(
      pool,
      insertHeader.insertId,
      `Advisory published by ${actor} at ${createdAtStr}`,
      { actorEmail: actorEmail ?? null, actorName: actorName ?? null }
    );

    const createEvent =
      type === 'Scheduled'
        ? INTERRUPTIONS_EVENT.CREATED_SCHEDULED
        : type === 'NgcScheduled'
          ? INTERRUPTIONS_EVENT.CREATED_NGC_SCHEDULED
          : INTERRUPTIONS_EVENT.CREATED_EMERGENCY;
    await recordInterruptionNotification(pool, {
      eventType: createEvent,
      subjectName: String(insertHeader.insertId),
      detail: feederLabelVal || 'Advisory',
      actorEmail: actorEmail != null && String(actorEmail).trim() ? String(actorEmail).trim() : null,
    });

    const newId = insertHeader.insertId;
    setImmediate(() => {
      maybeRegeneratePosterAfterMutation(pool, newId, null, row).catch((e) =>
        console.warn('[poster] post-create regen:', e?.message || e)
      );
    });

    res.status(201).json({ success: true, data: dto });
  } catch (error) {
    console.error('Interruptions create error:', error);
    res.status(500).json({ success: false, message: 'Failed to create interruption.' });
  }
});

/** Update */
router.put('/interruptions/:id', requireAdmin, async (req, res) => {
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
    const hasPoster = await getAlecoInterruptionsPosterExtrasSupported(pool);
    const loadCols = buildInterruptionUpdateLoadCols(hasDel, hasPoster);
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

    if (req.body.scheduledRestoreAt !== undefined) {
      const effectiveType = type !== undefined ? type : String(ex.type || '').trim();
      const isNgcpScheduled = effectiveType === 'NgcScheduled';
      const ertCheck = assertScheduledRestoreAfterBaseline(
        req.body.scheduledRestoreAt,
        isNgcpScheduled ? dateTimeStart : dateTimeEndEstimated,
        isNgcpScheduled ? ex.date_time_start : ex.date_time_end_estimated,
        { baselineLabel: isNgcpScheduled ? 'dateTimeStart' : 'dateTimeEndEstimated (ERT)' }
      );
      if (ertCheck) {
        return res.status(400).json({ success: false, message: ertCheck });
      }
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

    if (hasNonEmptyRestored && nextStatus !== 'Energized') {
      return res.status(400).json({
        success: false,
        message: 'dateTimeRestored is only allowed when status is Energized.',
      });
    }

    if (nextStatus === 'Energized') {
      let restoredMysql = null;
      if (hasNonEmptyRestored) {
        restoredMysql = toMysqlDateTime(dateTimeRestored);
      } else {
        restoredMysql = ex.date_time_restored ? toMysqlDateTimeFromRow(ex.date_time_restored) : null;
      }
      if (!restoredMysql) {
        return res.status(400).json({
          success: false,
          message: 'Energized status requires actual restoration date/time (dateTimeRestored).',
        });
      }
    }

    const fields = [];
    const params = [];

    if (type !== undefined) {
      if (!TYPES.has(type)) return res.status(400).json({ success: false, message: 'Invalid type.' });
      const typeDbEnum = await getAlecoInterruptionsTypeDbEnum(pool);
      const typeWrite = apiInterruptionTypeToDbLiteral(type, typeDbEnum);
      if (typeWrite.error) {
        return res.status(400).json({ success: false, message: typeWrite.error });
      }
      fields.push('type = ?');
      params.push(typeWrite.type);
    }
    if (status !== undefined) {
      if (!STATUSES.has(status)) return res.status(400).json({ success: false, message: 'Invalid status.' });
      const statusDbEnum = await getAlecoInterruptionsStatusDbEnum(pool);
      const statusWrite = apiInterruptionStatusToDbLiteral(status, statusDbEnum);
      if (statusWrite.error) {
        return res.status(400).json({ success: false, message: statusWrite.error });
      }
      fields.push('status = ?');
      params.push(statusWrite.status);
    }
    if (affectedAreas !== undefined) {
      fields.push('affected_areas = ?');
      params.push(serializeAffectedAreas(affectedAreas));
    }
    if (req.body.affectedAreasGrouped !== undefined && hasPoster) {
      fields.push('affected_areas_grouped = ?');
      params.push(serializeAffectedAreasGroupedForDb(req.body.affectedAreasGrouped));
    }
    if (feeder !== undefined || req.body?.feederId !== undefined) {
      if (req.body?.feederId !== undefined && req.body?.feederId !== null && String(req.body.feederId).trim() !== '') {
        const found = await resolveFeederById(req.body.feederId);
        if (!found) return res.status(400).json({ success: false, message: 'Invalid feederId.' });
        fields.push('feeder_id = ?');
        params.push(Number(found.id));
        fields.push('feeder = ?');
        params.push(String(found.feeder_label || '').trim());
      } else {
        fields.push('feeder_id = ?');
        params.push(null);
        fields.push('feeder = ?');
        params.push(feeder != null ? String(feeder).trim() : '');
      }
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
      if (nextStatus === 'Energized') {
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
    if (req.body.scheduledRestoreAt !== undefined) {
      const sra = req.body.scheduledRestoreAt;
      fields.push('scheduled_restore_at = ?');
      params.push(sra && String(sra).trim() ? toMysqlDateTime(sra) : null);
    }
    if (req.body.scheduledRestoreRemark !== undefined) {
      const srr = req.body.scheduledRestoreRemark;
      fields.push('scheduled_restore_remark = ?');
      params.push(srr != null && String(srr).trim() ? String(srr).trim() : null);
    }

    if (status !== undefined && status !== 'Energized' && dateTimeRestored === undefined) {
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
        const statusLabels = { Pending: 'Upcoming', Ongoing: 'Ongoing', Energized: 'Energized', Restored: 'Energized' };
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

    const actorForNotif =
      actorEmail != null && String(actorEmail).trim() ? String(actorEmail).trim() : null;
    if (type !== undefined && type !== ex.type) {
      await recordInterruptionNotification(pool, {
        eventType: INTERRUPTIONS_EVENT.TYPE_CHANGED,
        subjectName: String(id),
        detail: `${ex.type} → ${type}`,
        actorEmail: actorForNotif,
      });
    }
    if (status !== undefined && status !== ex.status) {
      await recordInterruptionNotification(pool, {
        eventType: INTERRUPTIONS_EVENT.STATUS_CHANGED,
        subjectName: String(id),
        detail: `${ex.status} → ${nextStatus}`,
        actorEmail: actorForNotif,
      });
    }

    const hasPulled = await getAlecoInterruptionsPulledFromFeedAtSupported(pool);
    const [rows] = await pool.execute(`${selectInterruptionRowSql(hasDel, hasPulled, hasPoster)} WHERE id = ?`, [
      id,
    ]);
    const dto = rows[0] ? mapRowToDto(rows[0]) : null;
    if (!dto) {
      return res.status(500).json({ success: false, message: 'Failed to load updated interruption.' });
    }
    const nextRaw = rows[0];
    setImmediate(() => {
      maybeRegeneratePosterAfterMutation(pool, id, ex, nextRaw).catch((e) =>
        console.warn('[poster] post-update regen:', e?.message || e)
      );
    });
    res.json({ success: true, data: dto });
  } catch (error) {
    console.error('Interruptions update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update interruption.' });
  }
});

/**
 * Soft delete (UX still uses DELETE). Row and remarks remain for reporting.
 */
router.delete('/interruptions/:id', requireAdmin, async (req, res) => {
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
      const archiver =
        req.authUser?.email ||
        (req.body?.actorEmail && String(req.body.actorEmail).trim()) ||
        null;
      await recordInterruptionNotification(pool, {
        eventType: INTERRUPTIONS_EVENT.ARCHIVED,
        subjectName: String(id),
        detail: 'Advisory archived',
        actorEmail: archiver,
      });
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
router.delete('/interruptions/:id/permanent', requireAdmin, async (req, res) => {
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
router.patch('/interruptions/:id/restore', requireAdmin, async (req, res) => {
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
    const hasPoster = await getAlecoInterruptionsPosterExtrasSupported(pool);
    const [rows] = await pool.execute(`${selectInterruptionRowSql(true, hasPulled, hasPoster)} WHERE id = ?`, [id]);
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
router.patch('/interruptions/:id/pull-from-feed', requireAdmin, async (req, res) => {
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
    const hasPoster = await getAlecoInterruptionsPosterExtrasSupported(pool);
    const [rows] = await pool.execute(`${selectInterruptionRowSql(hasDel, true, hasPoster)} WHERE id = ?`, [id]);
    const dto = rows[0] ? mapRowToDto(rows[0]) : null;
    res.json({ success: true, data: dto, message: 'Advisory pulled from public feed.' });
  } catch (error) {
    console.error('Pull from feed error:', error);
    res.status(500).json({ success: false, message: 'Failed to pull advisory from feed.' });
  }
});

/** Push advisory back into public feed (make visible again per normal rules). */
router.patch('/interruptions/:id/push-to-feed', requireAdmin, async (req, res) => {
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
    const hasPoster = await getAlecoInterruptionsPosterExtrasSupported(pool);
    const [rows] = await pool.execute(`${selectInterruptionRowSql(hasDel, true, hasPoster)} WHERE id = ?`, [id]);
    const dto = rows[0] ? mapRowToDto(rows[0]) : null;
    res.json({ success: true, data: dto, message: 'Advisory pushed back to public feed.' });
  } catch (error) {
    console.error('Push to feed error:', error);
    res.status(500).json({ success: false, message: 'Failed to push advisory to feed.' });
  }
});

/**
 * Capture poster image to Cloudinary and save `poster_image_url`.
 * Uses the live print page when the advisory is public-visible; otherwise (or if print fails) uses an HTML fallback.
 * For the print path, set `PUBLIC_APP_URL` or `FRONTEND_ORIGIN` to the deployed SPA origin.
 */
router.post('/interruptions/:id/poster-capture', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid id.' });

  try {
    const hasPoster = await getAlecoInterruptionsPosterExtrasSupported(pool);
    if (!hasPoster) {
      return res.status(503).json({
        success: false,
        message:
          'poster_image_url column missing. Run: node backend/run-migration.js backend/migrations/add_affected_areas_grouped_and_poster_image_url.sql',
      });
    }
    const hasDel = await getAlecoInterruptionsDeletedAtSupported(pool);
    const hasPulled = await getAlecoInterruptionsPulledFromFeedAtSupported(pool);
    const [capRows] = await pool.execute(`${selectInterruptionRowSql(hasDel, hasPulled, hasPoster)} WHERE id = ?`, [
      id,
    ]);
    const rawRow = capRows[0];
    if (!rawRow) {
      return res.status(404).json({ success: false, message: 'Interruption not found.' });
    }

    const env = typeof globalThis.process !== 'undefined' ? globalThis.process.env : {};
    if (!env.CLOUDINARY_CLOUD_NAME || !cloudinary?.uploader?.upload) {
      return res.status(503).json({
        success: false,
        message: 'Cloudinary must be configured (CLOUDINARY_CLOUD_NAME, etc.) to store poster screenshots.',
      });
    }

    const cap = await captureInterruptionPosterForAdmin(pool, id, rawRow);
    if (cap.error) {
      return res.status(500).json({ success: false, message: cap.error });
    }
    const posterUrl = cap.posterUrl;

    const phNow = nowPhilippineForMysql();
    await pool.execute('UPDATE aleco_interruptions SET poster_image_url = ?, updated_at = ? WHERE id = ?', [
      posterUrl,
      phNow,
      id,
    ]);

    const [rows] = await pool.execute(`${selectInterruptionRowSql(hasDel, hasPulled, hasPoster)} WHERE id = ?`, [id]);
    const dto = rows[0] ? mapRowToDto(rows[0]) : null;
    if (!dto) {
      return res.status(500).json({ success: false, message: 'Failed to load interruption after capture.' });
    }
    return res.json({
      success: true,
      data: dto,
      message: 'Poster screenshot captured and stored.',
    });
  } catch (err) {
    console.error('Interruptions poster-capture error:', err);
    return res.status(500).json({
      success: false,
      message:
        typeof err?.message === 'string'
          ? err.message
          : 'Poster capture failed (ensure the SPA URL is reachable from the API host and try again).',
    });
  }
});

/**
 * Generate poster via HTML fallback (no Puppeteer SPA required).
 * Uses the same `captureInterruptionPosterForAdmin` path — tries print capture first,
 * falls back to the HTML template listing. Replaces the old 1×1-blank stub approach.
 */
router.post('/interruptions/:id/poster-stub', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid id.' });

  try {
    const hasPoster = await getAlecoInterruptionsPosterExtrasSupported(pool);
    if (!hasPoster) {
      return res.status(503).json({
        success: false,
        message:
          'poster_image_url column missing. Run: node backend/run-migration.js backend/migrations/add_affected_areas_grouped_and_poster_image_url.sql',
      });
    }

    const env = typeof globalThis.process !== 'undefined' ? globalThis.process.env : {};
    if (!env.CLOUDINARY_CLOUD_NAME || !cloudinary?.uploader?.upload) {
      return res.status(503).json({
        success: false,
        message: 'Cloudinary must be configured (CLOUDINARY_CLOUD_NAME, etc.) to generate poster images.',
      });
    }

    const hasDel = await getAlecoInterruptionsDeletedAtSupported(pool);
    const hasPulled = await getAlecoInterruptionsPulledFromFeedAtSupported(pool);
    const [capRows] = await pool.execute(`${selectInterruptionRowSql(hasDel, hasPulled, hasPoster)} WHERE id = ?`, [id]);
    const rawRow = capRows[0];
    if (!rawRow) {
      return res.status(404).json({ success: false, message: 'Interruption not found.' });
    }

    const cap = await captureInterruptionPosterForAdmin(pool, id, rawRow);
    if (cap.error) {
      return res.status(500).json({ success: false, message: cap.error });
    }

    const phNow = nowPhilippineForMysql();
    await pool.execute('UPDATE aleco_interruptions SET poster_image_url = ?, updated_at = ? WHERE id = ?', [
      cap.posterUrl,
      phNow,
      id,
    ]);

    const [rows] = await pool.execute(`${selectInterruptionRowSql(hasDel, hasPulled, hasPoster)} WHERE id = ?`, [id]);
    const dto = rows[0] ? mapRowToDto(rows[0]) : null;
    if (!dto) {
      return res.status(500).json({ success: false, message: 'Failed to load interruption after poster generation.' });
    }
    res.json({
      success: true,
      data: dto,
      message: 'Poster image generated and stored.',
    });
  } catch (error) {
    console.error('Interruptions poster-stub error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate poster image.' });
  }
});

export default router;
