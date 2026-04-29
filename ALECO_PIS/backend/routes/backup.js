import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import pool from '../config/db.js';
import ExcelJS from 'exceljs';
import { stringify } from 'csv-stringify/sync';
import { parse } from 'csv-parse/sync';
import { getAlecoInterruptionsDeletedAtSupported } from '../utils/interruptionsDbSupport.js';
import { requireAdmin } from '../middleware/requireRole.js';
import { deleteTicketWithCascade } from '../utils/ticketDeleteHelper.js';
import { sendAppMail } from '../utils/appMail.js';
import { signArchiveDeleteToken, verifyArchiveDeleteToken } from '../utils/sessionJwt.js';

const router = express.Router();
const DELETE_CODE_EXPIRY_MINUTES = 10;
const DELETE_CODE_ATTEMPT_LIMIT = 5;
const DELETE_CODE_COOLDOWN_SECONDS = 60;
let deleteVerificationTableReady = false;

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function generateSixDigitCode() {
    return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function hashCode(code) {
    return crypto.createHash('sha256').update(String(code)).digest('hex');
}

function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60 * 1000);
}

async function sendArchiveDeleteCodeEmail(adminEmail, code) {
    await sendAppMail({
        to: adminEmail,
        subject: 'ALECO Data Management Delete Verification Code',
        text: `Your ALECO bulk delete verification code is ${code}. This code expires in ${DELETE_CODE_EXPIRY_MINUTES} minutes.`,
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.5;">
                <h2 style="margin-bottom: 8px;">Delete Verification Required</h2>
                <p>Your verification code is:</p>
                <p style="font-size: 22px; font-weight: bold; letter-spacing: 4px;">${code}</p>
                <p>This code expires in ${DELETE_CODE_EXPIRY_MINUTES} minutes.</p>
                <p>If you did not request this, please ignore this message.</p>
            </div>
        `,
    });
}

async function ensureDeleteVerificationTable() {
    if (deleteVerificationTableReady) return;
    await pool.execute(
        `CREATE TABLE IF NOT EXISTS aleco_ticket_archive_delete_verifications (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            admin_email VARCHAR(255) NOT NULL,
            code_hash CHAR(64) NOT NULL,
            status ENUM('pending', 'verified', 'expired', 'revoked') NOT NULL DEFAULT 'pending',
            attempt_count INT NOT NULL DEFAULT 0,
            expires_at DATETIME NOT NULL,
            verified_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_ticket_archive_delete_verifications_code_hash (code_hash),
            KEY idx_ticket_archive_delete_verifications_admin_status (admin_email, status),
            KEY idx_ticket_archive_delete_verifications_expires (expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
    deleteVerificationTableReady = true;
}

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = (file.originalname || '').toLowerCase().split('.').pop();
        if (['xlsx', 'csv'].includes(ext)) cb(null, true);
        else cb(new Error('Only .xlsx and .csv files are allowed'));
    }
});

// --- Date range helpers ---
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
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
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
    if (startDate && endDate) {
        return { type: 'range', startDate, endDate };
    }
    const presetRange = preset ? getDateRangeFromPreset(preset) : null;
    if (presetRange) {
        return { type: 'range', startDate: presetRange.startDate, endDate: presetRange.endDate };
    }
    return null;
}

const ALECO_INTERRUPTION_EXPORT_COLUMNS = [
    'date',
    'time started',
    'time energized',
    'substation/recloser',
    'feeder',
    'caused',
    'indication & magnitude',
    'possible fault location',
    'isolated area',
    'linemen on duty',
    'remarks/reasons',
];

function formatDateForAleco(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
}

function formatTimeForAleco(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    }).format(date);
}

function parseJsonArrayMaybe(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw !== 'string') return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function deriveIsolatedArea(row) {
    const areaParts = [];
    const affectedAreas = parseJsonArrayMaybe(row?.affected_areas);
    if (affectedAreas.length > 0) {
        areaParts.push(...affectedAreas.map((v) => String(v || '').trim()).filter(Boolean));
    } else if (typeof row?.affected_areas === 'string' && row.affected_areas.trim()) {
        areaParts.push(row.affected_areas.trim());
    }

    const grouped = parseJsonArrayMaybe(row?.affected_areas_grouped);
    grouped.forEach((group) => {
        if (!group || typeof group !== 'object') return;
        const municipality = String(group.municipality || '').trim();
        const barangays = Array.isArray(group.barangays) ? group.barangays : [];
        if (municipality) areaParts.push(municipality);
        barangays
            .map((b) => String(b || '').trim())
            .filter(Boolean)
            .forEach((b) => areaParts.push(b));
    });

    const deduped = [...new Set(areaParts)];
    return deduped.join(', ');
}

function mapInterruptionToAlecoRow(row, latestUpdateRemark = '') {
    const caused = String(row?.cause || row?.cause_category || '').trim();
    const remarks = String(row?.scheduled_restore_remark || row?.body || latestUpdateRemark || caused || '').trim();
    const feeder = String(row?.feeder || '').trim();
    const substationRecloser = String(row?.substation_recloser || '').trim();
    const indicationMagnitude = String(row?.indication_magnitude || '').trim();
    const possibleFaultLocation = String(row?.possible_fault_location || '').trim();
    const linemenOnDuty = String(row?.linemen_on_duty || '').trim();

    return {
        'date': formatDateForAleco(row?.date_time_start),
        'time started': formatTimeForAleco(row?.date_time_start),
        'time energized': formatTimeForAleco(row?.date_time_restored),
        'substation/recloser': substationRecloser || feeder,
        'feeder': feeder,
        'caused': caused,
        'indication & magnitude': indicationMagnitude,
        'possible fault location': possibleFaultLocation,
        'isolated area': deriveIsolatedArea(row),
        'linemen on duty': linemenOnDuty,
        'remarks/reasons': remarks,
    };
}

/** Build ticket query with optional filters. Backwards compatible: no filters = date-only. */
function buildTicketQuery(ds, de, filters = {}) {
    let query = `SELECT * FROM aleco_tickets WHERE deleted_at IS NULL AND DATE(created_at) BETWEEN ? AND ?`;
    const params = [ds, de];

    if (filters.groupFilter === 'grouped') {
        query += ` AND ticket_id LIKE 'GROUP-%'`;
    } else if (filters.groupFilter === 'ungrouped') {
        query += ` AND (parent_ticket_id IS NULL OR parent_ticket_id = '') AND ticket_id NOT LIKE 'GROUP-%'`;
    } else {
        query += ` AND (parent_ticket_id IS NULL OR parent_ticket_id = '' OR ticket_id LIKE 'GROUP-%')`;
    }

    if (filters.category && String(filters.category).trim()) {
        query += ` AND category = ?`;
        params.push(filters.category.trim());
    }
    if (filters.district && String(filters.district).trim()) {
        query += ` AND district = ?`;
        params.push(filters.district.trim());
    }
    if (filters.municipality && String(filters.municipality).trim()) {
        query += ` AND municipality = ?`;
        params.push(filters.municipality.trim());
    }
    if (filters.status && String(filters.status).trim()) {
        query += ` AND status = ?`;
        params.push(filters.status.trim());
    }
    if (filters.isNew === 'true' || filters.isNew === true) {
        query += ` AND created_at >= DATE_SUB(NOW(), INTERVAL 48 HOUR)`;
    }
    if (filters.isUrgent === 'true' || filters.isUrgent === true) {
        query += ` AND is_urgent = 1`;
    }
    if (filters.hasMemo === 'true' || filters.hasMemo === true) {
        query += ` AND service_memo_id IS NOT NULL`;
    }

    query += ` ORDER BY created_at ASC`;
    return { query, params };
}

/** Build interruption query with optional filters. */
async function buildInterruptionQuery(ds, de, filters = {}) {
    const hasDel = await getAlecoInterruptionsDeletedAtSupported(pool);
    const baseCols = `id, type, status, affected_areas, affected_areas_grouped, feeder, substation_recloser, cause, indication_magnitude, possible_fault_location, linemen_on_duty, cause_category, body, scheduled_restore_remark, control_no, image_url,
      date_time_start, date_time_end_estimated, date_time_restored,
      public_visible_at, created_at, updated_at`;
    const cols = hasDel ? `${baseCols}, deleted_at` : baseCols;
    let query = `SELECT ${cols} FROM aleco_interruptions WHERE DATE(date_time_start) BETWEEN ? AND ?`;
    const params = [ds, de];

    if (hasDel) {
        if (filters.includeArchived === 'true' || filters.includeArchived === true) {
            // include all
        } else {
            query += ` AND deleted_at IS NULL`;
        }
    }

    if (filters.type && String(filters.type).trim()) {
        query += ` AND type = ?`;
        params.push(filters.type.trim());
    }
    if (filters.status && String(filters.status).trim()) {
        query += ` AND status = ?`;
        params.push(filters.status.trim());
    }

    query += ` ORDER BY date_time_start ASC`;
    return { query, params };
}

function buildUserQuery(ds, de, filters = {}) {
    let query = `SELECT id, name, email, role, status, profile_pic, created_at FROM users WHERE DATE(created_at) BETWEEN ? AND ?`;
    const params = [ds, de];
    if (filters.role && String(filters.role).trim()) {
        query += ` AND role = ?`;
        params.push(filters.role.trim());
    }
    if (filters.status && String(filters.status).trim()) {
        query += ` AND status = ?`;
        params.push(filters.status.trim());
    }
    query += ` ORDER BY created_at ASC`;
    return { query, params };
}

/** Crews in date range + related crew_members and linemen (leads + members). */
async function fetchPersonnelExportData(ds, de) {
    const [crewRows] = await pool.execute(
        `SELECT id, crew_name, lead_lineman, phone_number, status, created_at
         FROM aleco_personnel
         WHERE DATE(created_at) BETWEEN ? AND ?
         ORDER BY created_at ASC`,
        [ds, de]
    );
    const crewIds = crewRows.map((r) => r.id);
    let crewMemberRows = [];
    if (crewIds.length > 0) {
        const placeholders = crewIds.map(() => '?').join(', ');
        const [cm] = await pool.execute(
            `SELECT crew_id, lineman_id FROM aleco_crew_members WHERE crew_id IN (${placeholders}) ORDER BY crew_id, lineman_id`,
            crewIds
        );
        crewMemberRows = cm;
    }
    const linemanIds = new Set();
    crewRows.forEach((c) => {
        if (c.lead_lineman != null) linemanIds.add(c.lead_lineman);
    });
    crewMemberRows.forEach((m) => linemanIds.add(m.lineman_id));
    let linemenRows = [];
    if (linemanIds.size > 0) {
        const ids = [...linemanIds];
        const ph = ids.map(() => '?').join(', ');
        const [lm] = await pool.execute(
            `SELECT id, full_name, designation, contact_no, status, leave_start, leave_end, leave_reason
             FROM aleco_linemen_pool WHERE id IN (${ph}) ORDER BY full_name ASC`,
            ids
        );
        linemenRows = lm;
    }
    return { crews: crewRows, crewMembers: crewMemberRows, linemen: linemenRows };
}

router.post('/tickets/archive/request-delete-code', requireAdmin, async (req, res) => {
    try {
        await ensureDeleteVerificationTable();
        const email = normalizeEmail(req.body?.email);
        const sessionEmail = normalizeEmail(req.authUser?.email);
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required.' });
        }
        if (!sessionEmail || email !== sessionEmail) {
            return res.status(403).json({ success: false, message: 'Email must match your logged-in admin account.' });
        }

        await pool.execute(
            `UPDATE aleco_ticket_archive_delete_verifications
             SET status = 'expired'
             WHERE status = 'pending' AND expires_at <= NOW()`
        );

        const [pendingRows] = await pool.execute(
            `SELECT id, created_at
             FROM aleco_ticket_archive_delete_verifications
             WHERE admin_email = ? AND status = 'pending'
             ORDER BY id DESC
             LIMIT 1`,
            [email]
        );
        if (pendingRows.length > 0) {
            const createdAt = new Date(pendingRows[0].created_at);
            const remainingMs = createdAt.getTime() + DELETE_CODE_COOLDOWN_SECONDS * 1000 - Date.now();
            if (remainingMs > 0) {
                return res.status(429).json({
                    success: false,
                    message: `Please wait ${Math.ceil(remainingMs / 1000)}s before requesting a new code.`,
                });
            }
        }

        await pool.execute(
            `UPDATE aleco_ticket_archive_delete_verifications
             SET status = 'revoked'
             WHERE admin_email = ? AND status = 'pending'`,
            [email]
        );

        const code = generateSixDigitCode();
        const codeHash = hashCode(code);
        const expiresAt = addMinutes(new Date(), DELETE_CODE_EXPIRY_MINUTES);
        await pool.execute(
            `INSERT INTO aleco_ticket_archive_delete_verifications
             (admin_email, code_hash, status, attempt_count, expires_at)
             VALUES (?, ?, 'pending', 0, ?)`,
            [email, codeHash, expiresAt]
        );

        await sendArchiveDeleteCodeEmail(email, code);
        return res.json({
            success: true,
            message: 'Verification code sent to your registered admin email.',
            cooldownSeconds: DELETE_CODE_COOLDOWN_SECONDS,
        });
    } catch (error) {
        console.error('❌ Request delete code error:', error);
        const message =
            error?.code === 'EAUTH'
                ? 'Email service authentication failed. Check EMAIL_USER/EMAIL_PASS.'
                : error?.code === 'ECONNECTION'
                    ? 'Email service connection failed. Please try again.'
                    : (error?.message || 'Failed to send verification code.');
        return res.status(500).json({ success: false, message });
    }
});

router.post('/tickets/archive/verify-delete-code', requireAdmin, async (req, res) => {
    try {
        await ensureDeleteVerificationTable();
        const email = normalizeEmail(req.body?.email);
        const code = String(req.body?.code || '').trim();
        const sessionEmail = normalizeEmail(req.authUser?.email);
        if (!email || !code) {
            return res.status(400).json({ success: false, message: 'Email and code are required.' });
        }
        if (!sessionEmail || email !== sessionEmail) {
            return res.status(403).json({ success: false, message: 'Email must match your logged-in admin account.' });
        }

        await pool.execute(
            `UPDATE aleco_ticket_archive_delete_verifications
             SET status = 'expired'
             WHERE status = 'pending' AND expires_at <= NOW()`
        );

        const [rows] = await pool.execute(
            `SELECT id, code_hash, attempt_count, expires_at
             FROM aleco_ticket_archive_delete_verifications
             WHERE admin_email = ? AND status = 'pending'
             ORDER BY id DESC
             LIMIT 1`,
            [email]
        );
        if (rows.length === 0) {
            return res.status(400).json({ success: false, message: 'No active verification code. Request a new code.' });
        }
        const verification = rows[0];
        if (new Date(verification.expires_at).getTime() <= Date.now()) {
            await pool.execute(
                `UPDATE aleco_ticket_archive_delete_verifications SET status = 'expired' WHERE id = ?`,
                [verification.id]
            );
            return res.status(400).json({ success: false, message: 'Verification code expired. Request a new one.' });
        }

        const currentAttempts = Number(verification.attempt_count || 0);
        if (currentAttempts >= DELETE_CODE_ATTEMPT_LIMIT) {
            await pool.execute(
                `UPDATE aleco_ticket_archive_delete_verifications SET status = 'expired' WHERE id = ?`,
                [verification.id]
            );
            return res.status(400).json({ success: false, message: 'Verification code is locked. Request a new one.' });
        }

        const codeHash = hashCode(code);
        if (codeHash !== verification.code_hash) {
            const nextAttempts = currentAttempts + 1;
            const nextStatus = nextAttempts >= DELETE_CODE_ATTEMPT_LIMIT ? 'expired' : 'pending';
            await pool.execute(
                `UPDATE aleco_ticket_archive_delete_verifications
                 SET attempt_count = ?, status = ?
                 WHERE id = ?`,
                [nextAttempts, nextStatus, verification.id]
            );
            return res.status(400).json({
                success: false,
                message: nextStatus === 'expired'
                    ? 'Verification code is locked. Request a new one.'
                    : `Invalid verification code. ${DELETE_CODE_ATTEMPT_LIMIT - nextAttempts} attempt(s) remaining.`,
            });
        }

        await pool.execute(
            `UPDATE aleco_ticket_archive_delete_verifications
             SET status = 'verified', verified_at = NOW()
             WHERE id = ?`,
            [verification.id]
        );
        const deleteAuthToken = signArchiveDeleteToken(email);
        return res.json({
            success: true,
            message: 'Verification successful.',
            deleteAuthToken,
            expiresInMinutes: DELETE_CODE_EXPIRY_MINUTES,
        });
    } catch (error) {
        console.error('❌ Verify delete code error:', error);
        return res.status(500).json({ success: false, message: 'Failed to verify code.' });
    }
});

// --- EXPORT PREVIEW (JSON for View in browser) - must be before /tickets/export ---
router.get('/tickets/export/preview', requireAdmin, async (req, res) => {
    try {
        const { preset, startDate, endDate, category, district, municipality, status, groupFilter, isNew, isUrgent, hasMemo } = req.query;
        const dateFilter = buildDateFilter(preset, startDate, endDate);
        if (!dateFilter) {
            return res.status(400).json({ success: false, message: 'Provide preset or startDate and endDate' });
        }

        const { startDate: ds, endDate: de } = dateFilter;
        const filters = { category, district, municipality, status, groupFilter, isNew, isUrgent, hasMemo };
        const { query, params } = buildTicketQuery(ds, de, filters);

        const [ticketRows] = await pool.execute(query, params);

        const ticketIds = ticketRows.map(r => r.ticket_id);
        let logRows = [];
        if (ticketIds.length > 0) {
            const placeholders = ticketIds.map(() => '?').join(', ');
            const [logResult] = await pool.execute(
                `SELECT * FROM aleco_ticket_logs WHERE ticket_id IN (${placeholders}) ORDER BY ticket_id, created_at ASC`,
                ticketIds
            );
            logRows = logResult;
        }

        const metadata = { dateStart: ds, dateEnd: de, ticketCount: ticketRows.length, logCount: logRows.length };
        res.json({ success: true, metadata, tickets: ticketRows, logs: logRows });
    } catch (error) {
        console.error('❌ Export preview error:', error);
        res.status(500).json({ success: false, message: error.message || 'Preview failed' });
    }
});

// --- EXPORT ROUTE (must be before /tickets/:ticketId to avoid conflict) ---
router.get('/tickets/export', requireAdmin, async (req, res) => {
    try {
        const { preset, startDate, endDate, format, category, district, municipality, status, groupFilter, isNew, isUrgent, hasMemo } = req.query;
        const fmt = (format || 'excel').toLowerCase();
        if (fmt !== 'excel' && fmt !== 'csv') {
            return res.status(400).json({ success: false, message: 'Format must be excel or csv' });
        }

        const dateFilter = buildDateFilter(preset, startDate, endDate);
        if (!dateFilter) {
            return res.status(400).json({ success: false, message: 'Provide preset or startDate and endDate' });
        }

        const { startDate: ds, endDate: de } = dateFilter;
        const filters = { category, district, municipality, status, groupFilter, isNew, isUrgent, hasMemo };
        const { query, params } = buildTicketQuery(ds, de, filters);

        const [ticketRows] = await pool.execute(query, params);

        const ticketIds = ticketRows.map(r => r.ticket_id);
        let logRows = [];
        if (ticketIds.length > 0) {
            const placeholders = ticketIds.map(() => '?').join(', ');
            const [logResult] = await pool.execute(
                `SELECT * FROM aleco_ticket_logs WHERE ticket_id IN (${placeholders}) ORDER BY ticket_id, created_at ASC`,
                ticketIds
            );
            logRows = logResult;
        }

        const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
        const baseFilename = `aleco_tickets_${ds}_to_${de}_${timestamp}`;
        const ext = fmt === 'excel' ? 'xlsx' : 'csv';
        const filename = `${baseFilename}.${ext}`;

        const exportedBy = req.headers['x-user-email'] || req.headers['x-user-name'] || null;

        await pool.execute(
            `INSERT INTO aleco_export_log (export_date, date_start, date_end, ticket_count, log_count, format, exported_by)
             VALUES (NOW(), ?, ?, ?, ?, ?, ?)`,
            [ds, de, ticketRows.length, logRows.length, fmt, exportedBy]
        );

        if (fmt === 'excel') {
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'ALECO PIS';
            workbook.created = new Date();

            const metaSheet = workbook.addWorksheet('Metadata', { properties: { tabColor: { argb: 'FF4472C4' } } });
            metaSheet.addRow(['Export Info']);
            metaSheet.addRow(['Schema Version', '1']);
            metaSheet.addRow(['Export Date', new Date().toISOString()]);
            metaSheet.addRow(['Date Range', `${ds} to ${de}`]);
            metaSheet.addRow(['Ticket Count', ticketRows.length]);
            metaSheet.addRow(['Log Count', logRows.length]);
            metaSheet.addRow(['Format', 'excel']);
            metaSheet.addRow(['Exported By', exportedBy || '']);

            const ticketSheet = workbook.addWorksheet('Tickets', { properties: { tabColor: { argb: 'FF70AD47' } } });
            const ticketCols = ticketRows.length > 0 ? Object.keys(ticketRows[0]) : [];
            const ticketHeaderRow = ticketSheet.addRow(ticketCols);
            ticketHeaderRow.font = { bold: true };
            ticketRows.forEach(row => {
                ticketSheet.addRow(ticketCols.map(c => {
                    const v = row[c];
                    if (v instanceof Date) return v;
                    if (Buffer.isBuffer(v)) return v.toString();
                    return v;
                }));
            });

            const logSheet = workbook.addWorksheet('TicketLogs', { properties: { tabColor: { argb: 'FFFFC000' } } });
            const logCols = logRows.length > 0 ? Object.keys(logRows[0]) : [];
            const logHeaderRow = logSheet.addRow(logCols);
            logHeaderRow.font = { bold: true };
            logRows.forEach(row => {
                logSheet.addRow(logCols.map(c => {
                    const v = row[c];
                    if (v instanceof Date) return v;
                    if (Buffer.isBuffer(v)) return v.toString();
                    if (c === 'metadata' && typeof v === 'object') return v ? JSON.stringify(v) : '';
                    return v;
                }));
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            await workbook.xlsx.write(res);
        } else {
            const ticketCols = ticketRows.length > 0 ? Object.keys(ticketRows[0]) : [];
            const ticketCsv = stringify(ticketRows.map(r => ticketCols.map(c => {
                const v = r[c];
                if (v instanceof Date) return v.toISOString();
                if (Buffer.isBuffer(v)) return v.toString();
                return v ?? '';
            })), { header: true, columns: ticketCols });

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(ticketCsv);
        }
    } catch (error) {
        console.error('❌ Export error:', error);
        res.status(500).json({ success: false, message: error.message || 'Export failed' });
    }
});

// --- INTERRUPTIONS EXPORT PREVIEW ---
router.get('/interruptions/export/preview', requireAdmin, async (req, res) => {
    try {
        const { preset, startDate, endDate, type, status, includeArchived } = req.query;
        const dateFilter = buildDateFilter(preset, startDate, endDate);
        if (!dateFilter) {
            return res.status(400).json({ success: false, message: 'Provide preset or startDate and endDate' });
        }
        const { startDate: ds, endDate: de } = dateFilter;
        const filters = { type, status, includeArchived };
        const { query, params } = await buildInterruptionQuery(ds, de, filters);
        const [interruptionRows] = await pool.execute(query, params);
        const interruptionIds = interruptionRows.map((r) => r.id);
        let updateRows = [];
        if (interruptionIds.length > 0) {
            const placeholders = interruptionIds.map(() => '?').join(', ');
            const [updResult] = await pool.execute(
                `SELECT id, interruption_id, remark, kind, actor_email, actor_name, created_at
                 FROM aleco_interruption_updates
                 WHERE interruption_id IN (${placeholders})
                 ORDER BY interruption_id, created_at ASC`,
                interruptionIds
            );
            updateRows = updResult;
        }
        const latestUpdateByInterruptionId = new Map();
        updateRows.forEach((u) => {
            const key = String(u.interruption_id ?? '');
            if (!key) return;
            latestUpdateByInterruptionId.set(key, String(u.remark || '').trim());
        });
        const alecoInterruptions = interruptionRows.map((row) =>
            mapInterruptionToAlecoRow(row, latestUpdateByInterruptionId.get(String(row.id)) || '')
        );

        const metadata = {
            dateStart: ds,
            dateEnd: de,
            interruptionCount: interruptionRows.length,
            updateCount: updateRows.length,
        };
        res.json({ success: true, metadata, interruptions: interruptionRows, alecoInterruptions, updates: updateRows });
    } catch (error) {
        console.error('❌ Interruptions export preview error:', error);
        res.status(500).json({ success: false, message: error.message || 'Preview failed' });
    }
});

// --- INTERRUPTIONS EXPORT ---
router.get('/interruptions/export', requireAdmin, async (req, res) => {
    try {
        const { preset, startDate, endDate, format, type, status, includeArchived, view } = req.query;
        const fmt = (format || 'excel').toLowerCase();
        if (fmt !== 'excel' && fmt !== 'csv') {
            return res.status(400).json({ success: false, message: 'Format must be excel or csv' });
        }
        const dateFilter = buildDateFilter(preset, startDate, endDate);
        if (!dateFilter) {
            return res.status(400).json({ success: false, message: 'Provide preset or startDate and endDate' });
        }
        const { startDate: ds, endDate: de } = dateFilter;
        const filters = { type, status, includeArchived };
        const { query, params } = await buildInterruptionQuery(ds, de, filters);
        const [interruptionRows] = await pool.execute(query, params);
        const interruptionIds = interruptionRows.map((r) => r.id);
        let updateRows = [];
        if (interruptionIds.length > 0) {
            const placeholders = interruptionIds.map(() => '?').join(', ');
            const [updResult] = await pool.execute(
                `SELECT id, interruption_id, remark, kind, actor_email, actor_name, created_at
                 FROM aleco_interruption_updates
                 WHERE interruption_id IN (${placeholders})
                 ORDER BY interruption_id, created_at ASC`,
                interruptionIds
            );
            updateRows = updResult;
        }
        const latestUpdateByInterruptionId = new Map();
        updateRows.forEach((u) => {
            const key = String(u.interruption_id ?? '');
            if (!key) return;
            latestUpdateByInterruptionId.set(key, String(u.remark || '').trim());
        });
        const alecoInterruptions = interruptionRows.map((row) =>
            mapInterruptionToAlecoRow(row, latestUpdateByInterruptionId.get(String(row.id)) || '')
        );
        const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
        const baseFilename = `aleco_interruptions_${ds}_to_${de}_${timestamp}`;
        const ext = fmt === 'excel' ? 'xlsx' : 'csv';
        const filename = `${baseFilename}.${ext}`;
        const exportedBy = req.headers['x-user-email'] || req.headers['x-user-name'] || null;

        await pool.execute(
            `INSERT INTO aleco_export_log (export_date, date_start, date_end, ticket_count, log_count, format, exported_by)
             VALUES (NOW(), ?, ?, ?, ?, ?, ?)`,
            [ds, de, interruptionRows.length, updateRows.length, fmt, exportedBy]
        );

        if (fmt === 'excel') {
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'ALECO PIS';
            workbook.created = new Date();
            const metaSheet = workbook.addWorksheet('Metadata', { properties: { tabColor: { argb: 'FF4472C4' } } });
            metaSheet.addRow(['Export Info']);
            metaSheet.addRow(['Schema Version', '1']);
            metaSheet.addRow(['Export Date', new Date().toISOString()]);
            metaSheet.addRow(['Date Range', `${ds} to ${de}`]);
            metaSheet.addRow(['Interruption Count', interruptionRows.length]);
            metaSheet.addRow(['Update Count', updateRows.length]);
            metaSheet.addRow(['Format', 'excel']);
            metaSheet.addRow(['Exported By', exportedBy || '']);

            const intCols = interruptionRows.length > 0 ? Object.keys(interruptionRows[0]) : [];
            const intSheet = workbook.addWorksheet('Interruptions', { properties: { tabColor: { argb: 'FF70AD47' } } });
            const intHeaderRow = intSheet.addRow(intCols);
            intHeaderRow.font = { bold: true };
            interruptionRows.forEach((row) => {
                intSheet.addRow(
                    intCols.map((c) => {
                        const v = row[c];
                        if (v instanceof Date) return v;
                        if (Buffer.isBuffer(v)) return v.toString();
                        if (c === 'affected_areas' && (typeof v === 'string' || Array.isArray(v)))
                            return typeof v === 'string' ? v : JSON.stringify(v);
                        return v;
                    })
                );
            });

            const updCols = updateRows.length > 0 ? Object.keys(updateRows[0]) : [];
            const updSheet = workbook.addWorksheet('InterruptionUpdates', {
                properties: { tabColor: { argb: 'FFFFC000' } },
            });
            const updHeaderRow = updSheet.addRow(updCols);
            updHeaderRow.font = { bold: true };
            updateRows.forEach((row) => {
                updSheet.addRow(
                    updCols.map((c) => {
                        const v = row[c];
                        if (v instanceof Date) return v;
                        if (Buffer.isBuffer(v)) return v.toString();
                        return v;
                    })
                );
            });

            const alecoSheet = workbook.addWorksheet('ALECO_Interruptions', {
                properties: { tabColor: { argb: 'FF9BC2E6' } },
            });
            const alecoHeaderRow = alecoSheet.addRow(ALECO_INTERRUPTION_EXPORT_COLUMNS);
            alecoHeaderRow.font = { bold: true };
            alecoInterruptions.forEach((row) => {
                alecoSheet.addRow(ALECO_INTERRUPTION_EXPORT_COLUMNS.map((col) => row[col] ?? ''));
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            await workbook.xlsx.write(res);
        } else {
            const csvMode = String(view || 'aleco').toLowerCase();
            const intCsv = csvMode === 'raw'
                ? (() => {
                    const intCols = interruptionRows.length > 0 ? Object.keys(interruptionRows[0]) : [];
                    return stringify(
                        interruptionRows.map((r) =>
                            intCols.map((c) => {
                                const v = r[c];
                                if (v instanceof Date) return v.toISOString();
                                if (Buffer.isBuffer(v)) return v.toString();
                                if (c === 'affected_areas' && (typeof v === 'string' || Array.isArray(v)))
                                    return typeof v === 'string' ? v : JSON.stringify(v);
                                return v ?? '';
                            })
                        ),
                        { header: true, columns: intCols }
                    );
                })()
                : stringify(
                    alecoInterruptions.map((r) => ALECO_INTERRUPTION_EXPORT_COLUMNS.map((col) => r[col] ?? '')),
                    { header: true, columns: ALECO_INTERRUPTION_EXPORT_COLUMNS }
                );
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(intCsv);
        }
    } catch (error) {
        console.error('❌ Interruptions export error:', error);
        res.status(500).json({ success: false, message: error.message || 'Export failed' });
    }
});

// --- USERS EXPORT PREVIEW ---
router.get('/users/export/preview', requireAdmin, async (req, res) => {
    try {
        const { preset, startDate, endDate, role, status } = req.query;
        const dateFilter = buildDateFilter(preset, startDate, endDate);
        if (!dateFilter) {
            return res.status(400).json({ success: false, message: 'Provide preset or startDate and endDate' });
        }
        const { startDate: ds, endDate: de } = dateFilter;
        const filters = { role, status };
        const { query, params } = buildUserQuery(ds, de, filters);
        const [userRows] = await pool.execute(query, params);
        const metadata = { dateStart: ds, dateEnd: de, userCount: userRows.length };
        res.json({ success: true, metadata, users: userRows });
    } catch (error) {
        console.error('❌ Users export preview error:', error);
        res.status(500).json({ success: false, message: error.message || 'Preview failed' });
    }
});

// --- USERS EXPORT ---
router.get('/users/export', requireAdmin, async (req, res) => {
    try {
        const { preset, startDate, endDate, format, role, status } = req.query;
        const fmt = (format || 'excel').toLowerCase();
        if (fmt !== 'excel' && fmt !== 'csv') {
            return res.status(400).json({ success: false, message: 'Format must be excel or csv' });
        }
        const dateFilter = buildDateFilter(preset, startDate, endDate);
        if (!dateFilter) {
            return res.status(400).json({ success: false, message: 'Provide preset or startDate and endDate' });
        }
        const { startDate: ds, endDate: de } = dateFilter;
        const filters = { role, status };
        const { query, params } = buildUserQuery(ds, de, filters);
        const [userRows] = await pool.execute(query, params);

        const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
        const baseFilename = `aleco_users_${ds}_to_${de}_${timestamp}`;
        const ext = fmt === 'excel' ? 'xlsx' : 'csv';
        const filename = `${baseFilename}.${ext}`;
        const exportedBy = req.headers['x-user-email'] || req.headers['x-user-name'] || null;

        await pool.execute(
            `INSERT INTO aleco_export_log (export_date, date_start, date_end, ticket_count, log_count, format, exported_by)
             VALUES (NOW(), ?, ?, ?, ?, ?, ?)`,
            [ds, de, userRows.length, 0, fmt, exportedBy]
        );

        if (fmt === 'excel') {
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'ALECO PIS';
            workbook.created = new Date();
            const metaSheet = workbook.addWorksheet('Metadata', { properties: { tabColor: { argb: 'FF4472C4' } } });
            metaSheet.addRow(['Export Info']);
            metaSheet.addRow(['Schema Version', '1']);
            metaSheet.addRow(['Export Date', new Date().toISOString()]);
            metaSheet.addRow(['Date Range', `${ds} to ${de}`]);
            metaSheet.addRow(['User Count', userRows.length]);
            metaSheet.addRow(['Format', 'excel']);
            metaSheet.addRow(['Exported By', exportedBy || '']);

            const userCols = userRows.length > 0 ? Object.keys(userRows[0]) : [];
            const userSheet = workbook.addWorksheet('Users', { properties: { tabColor: { argb: 'FF70AD47' } } });
            const userHeaderRow = userSheet.addRow(userCols);
            userHeaderRow.font = { bold: true };
            userRows.forEach((row) => {
                userSheet.addRow(
                    userCols.map((c) => {
                        const v = row[c];
                        if (v instanceof Date) return v;
                        if (Buffer.isBuffer(v)) return v.toString();
                        return v;
                    })
                );
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            await workbook.xlsx.write(res);
        } else {
            const userCols = userRows.length > 0 ? Object.keys(userRows[0]) : [];
            const userCsv = stringify(
                userRows.map((r) =>
                    userCols.map((c) => {
                        const v = r[c];
                        if (v instanceof Date) return v.toISOString();
                        if (Buffer.isBuffer(v)) return v.toString();
                        return v ?? '';
                    })
                ),
                { header: true, columns: userCols }
            );
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(userCsv);
        }
    } catch (error) {
        console.error('❌ Users export error:', error);
        res.status(500).json({ success: false, message: error.message || 'Export failed' });
    }
});

// --- PERSONNEL EXPORT PREVIEW ---
router.get('/personnel/export/preview', requireAdmin, async (req, res) => {
    try {
        const { preset, startDate, endDate } = req.query;
        const dateFilter = buildDateFilter(preset, startDate, endDate);
        if (!dateFilter) {
            return res.status(400).json({ success: false, message: 'Provide preset or startDate and endDate' });
        }
        const { startDate: ds, endDate: de } = dateFilter;
        const { crews, crewMembers, linemen } = await fetchPersonnelExportData(ds, de);
        const metadata = {
            dateStart: ds,
            dateEnd: de,
            crewCount: crews.length,
            crewMemberCount: crewMembers.length,
            linemanCount: linemen.length,
        };
        res.json({ success: true, metadata, crews, crewMembers, linemen });
    } catch (error) {
        console.error('❌ Personnel export preview error:', error);
        res.status(500).json({ success: false, message: error.message || 'Preview failed' });
    }
});

// --- PERSONNEL EXPORT ---
// Excel: all sheets. CSV: crews only (primary table), same pattern as interruptions.
router.get('/personnel/export', requireAdmin, async (req, res) => {
    try {
        const { preset, startDate, endDate, format } = req.query;
        const fmt = (format || 'excel').toLowerCase();
        if (fmt !== 'excel' && fmt !== 'csv') {
            return res.status(400).json({ success: false, message: 'Format must be excel or csv' });
        }
        const dateFilter = buildDateFilter(preset, startDate, endDate);
        if (!dateFilter) {
            return res.status(400).json({ success: false, message: 'Provide preset or startDate and endDate' });
        }
        const { startDate: ds, endDate: de } = dateFilter;
        const { crews, crewMembers, linemen } = await fetchPersonnelExportData(ds, de);

        const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
        const baseFilename = `aleco_personnel_${ds}_to_${de}_${timestamp}`;
        const ext = fmt === 'excel' ? 'xlsx' : 'csv';
        const filename = `${baseFilename}.${ext}`;
        const exportedBy = req.headers['x-user-email'] || req.headers['x-user-name'] || null;

        await pool.execute(
            `INSERT INTO aleco_export_log (export_date, date_start, date_end, ticket_count, log_count, format, exported_by)
             VALUES (NOW(), ?, ?, ?, ?, ?, ?)`,
            [ds, de, crews.length, crewMembers.length, fmt, exportedBy]
        );

        if (fmt === 'excel') {
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'ALECO PIS';
            workbook.created = new Date();
            const metaSheet = workbook.addWorksheet('Metadata', { properties: { tabColor: { argb: 'FF4472C4' } } });
            metaSheet.addRow(['Export Info']);
            metaSheet.addRow(['Schema Version', '1']);
            metaSheet.addRow(['Export Date', new Date().toISOString()]);
            metaSheet.addRow(['Date Range', `${ds} to ${de}`]);
            metaSheet.addRow(['Crew Count', crews.length]);
            metaSheet.addRow(['Crew Member Rows', crewMembers.length]);
            metaSheet.addRow(['Lineman Count', linemen.length]);
            metaSheet.addRow(['Format', 'excel']);
            metaSheet.addRow(['Exported By', exportedBy || '']);

            const crewCols = crews.length > 0 ? Object.keys(crews[0]) : [];
            const crewSheet = workbook.addWorksheet('Crews', { properties: { tabColor: { argb: 'FF70AD47' } } });
            const crewHeaderRow = crewSheet.addRow(crewCols);
            crewHeaderRow.font = { bold: true };
            crews.forEach((row) => {
                crewSheet.addRow(
                    crewCols.map((c) => {
                        const v = row[c];
                        if (v instanceof Date) return v;
                        if (Buffer.isBuffer(v)) return v.toString();
                        return v;
                    })
                );
            });

            const cmCols = crewMembers.length > 0 ? Object.keys(crewMembers[0]) : ['crew_id', 'lineman_id'];
            const cmSheet = workbook.addWorksheet('CrewMembers', { properties: { tabColor: { argb: 'FFFFC000' } } });
            const cmHeaderRow = cmSheet.addRow(cmCols);
            cmHeaderRow.font = { bold: true };
            crewMembers.forEach((row) => {
                cmSheet.addRow(
                    cmCols.map((c) => {
                        const v = row[c];
                        if (v instanceof Date) return v;
                        if (Buffer.isBuffer(v)) return v.toString();
                        return v;
                    })
                );
            });

            const lmCols = linemen.length > 0 ? Object.keys(linemen[0]) : [];
            const lmSheet = workbook.addWorksheet('Linemen', { properties: { tabColor: { argb: 'FF9BC2E6' } } });
            const lmHeaderRow = lmSheet.addRow(lmCols);
            lmHeaderRow.font = { bold: true };
            linemen.forEach((row) => {
                lmSheet.addRow(
                    lmCols.map((c) => {
                        const v = row[c];
                        if (v instanceof Date) return v;
                        if (Buffer.isBuffer(v)) return v.toString();
                        return v;
                    })
                );
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            await workbook.xlsx.write(res);
        } else {
            const crewCols = crews.length > 0 ? Object.keys(crews[0]) : [];
            const crewCsv = stringify(
                crews.map((r) =>
                    crewCols.map((c) => {
                        const v = r[c];
                        if (v instanceof Date) return v.toISOString();
                        if (Buffer.isBuffer(v)) return v.toString();
                        return v ?? '';
                    })
                ),
                { header: true, columns: crewCols }
            );
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(crewCsv);
        }
    } catch (error) {
        console.error('❌ Personnel export error:', error);
        res.status(500).json({ success: false, message: error.message || 'Export failed' });
    }
});

router.post('/tickets/archive/preview', requireAdmin, async (req, res) => {
    try {
        const { startDate, endDate, preset, category, district, municipality, status, groupFilter, isNew, isUrgent, hasMemo } = req.body;
        const dateFilter = buildDateFilter(preset, startDate, endDate);
        if (!dateFilter) {
            return res.status(400).json({ success: false, message: 'Provide preset or startDate and endDate' });
        }

        const { startDate: ds, endDate: de } = dateFilter;
        const filters = { category, district, municipality, status, groupFilter, isNew, isUrgent, hasMemo };
        const { query, params } = buildTicketQuery(ds, de, filters);
        const [ticketRows] = await pool.execute(query, params);
        const candidateIds = ticketRows.map((r) => r.ticket_id);
        if (candidateIds.length === 0) {
            return res.json({
                success: true,
                metadata: { dateStart: ds, dateEnd: de, ticketCount: 0, logCount: 0, blockedGroupedCount: 0, eligibleDeleteCount: 0 },
                tickets: [],
                logs: [],
            });
        }

        const placeholders = candidateIds.map(() => '?').join(', ');
        const [childrenRows] = await pool.execute(
            `SELECT DISTINCT parent_ticket_id FROM aleco_tickets
             WHERE parent_ticket_id IN (${placeholders}) AND deleted_at IS NULL`,
            candidateIds
        );
        const parentIdsWithChildren = new Set(childrenRows.map((r) => r.parent_ticket_id));

        const eligibleTickets = ticketRows.filter((row) =>
            !String(row.ticket_id || '').startsWith('GROUP-') &&
            !row.parent_ticket_id &&
            !parentIdsWithChildren.has(row.ticket_id)
        );

        const metadata = {
            dateStart: ds,
            dateEnd: de,
            ticketCount: eligibleTickets.length,
            logCount: 0,
            blockedGroupedCount: ticketRows.length - eligibleTickets.length,
            eligibleDeleteCount: eligibleTickets.length,
        };
        return res.json({ success: true, metadata, tickets: eligibleTickets, logs: [] });
    } catch (error) {
        console.error('❌ Archive preview error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Archive preview failed' });
    }
});

// --- ARCHIVE ROUTE ---
router.post('/tickets/archive', requireAdmin, async (req, res) => {
    try {
        const token = String(req.body?.deleteAuthToken || req.headers['x-delete-auth-token'] || '').trim();
        if (!token) {
            return res.status(401).json({ success: false, message: 'Delete verification required.' });
        }
        let verifiedEmail = '';
        try {
            const payload = verifyArchiveDeleteToken(token);
            verifiedEmail = normalizeEmail(payload.email);
        } catch (verifyErr) {
            return res.status(401).json({ success: false, message: 'Delete verification expired or invalid.' });
        }
        const sessionEmail = normalizeEmail(req.authUser?.email);
        if (!sessionEmail || verifiedEmail !== sessionEmail) {
            return res.status(403).json({ success: false, message: 'Delete verification does not match your active session.' });
        }

        const { startDate, endDate, preset, category, district, municipality, status, groupFilter, isNew, isUrgent, hasMemo } = req.body;

        const dateFilter = buildDateFilter(preset, startDate, endDate);
        if (!dateFilter) {
            return res.status(400).json({ success: false, message: 'Provide preset or startDate and endDate' });
        }

        const { startDate: ds, endDate: de } = dateFilter;
        const filters = { category, district, municipality, status, groupFilter, isNew, isUrgent, hasMemo };
        const { query, params } = buildTicketQuery(ds, de, filters);

        const selectQuery = query.replace('SELECT *', 'SELECT ticket_id, parent_ticket_id');
        const [ticketRows] = await pool.execute(selectQuery, params);
        const candidateIds = ticketRows.map((r) => r.ticket_id);
        if (candidateIds.length === 0) {
            return res.json({ success: true, deletedCount: 0, blockedGroupedCount: 0, blockedSampleIds: [] });
        }

        const placeholders = candidateIds.map(() => '?').join(', ');
        const [childrenRows] = await pool.execute(
            `SELECT DISTINCT parent_ticket_id FROM aleco_tickets
             WHERE parent_ticket_id IN (${placeholders}) AND deleted_at IS NULL`,
            candidateIds
        );
        const parentIdsWithChildren = new Set(childrenRows.map((r) => r.parent_ticket_id));

        const blockedRows = ticketRows.filter((row) =>
            String(row.ticket_id || '').startsWith('GROUP-') ||
            Boolean(row.parent_ticket_id) ||
            parentIdsWithChildren.has(row.ticket_id)
        );
        const blockedIds = blockedRows.map((r) => r.ticket_id);
        const blockedSet = new Set(blockedIds);
        const eligibleRows = ticketRows.filter((row) => !blockedSet.has(row.ticket_id));

        let deletedCount = 0;
        if (eligibleRows.length > 0) {
            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();
                const actorEmail = req.authUser?.email || req.headers['x-user-email'] || null;
                for (const row of eligibleRows) {
                    const del = await deleteTicketWithCascade({
                        db: connection,
                        ticketId: row.ticket_id,
                        actorEmail,
                        allowGrouped: false,
                    });
                    if (del.success) deletedCount += 1;
                }
                await connection.commit();
            } catch (txErr) {
                await connection.rollback();
                throw txErr;
            } finally {
                connection.release();
            }
        }

        res.json({
            success: true,
            deletedCount,
            blockedGroupedCount: blockedIds.length,
            blockedSampleIds: blockedIds.slice(0, 15),
            message: blockedIds.length > 0
                ? 'Some tickets were not deleted because they are grouped. Ungroup first.'
                : 'Tickets permanently deleted.',
        });
    } catch (error) {
        console.error('❌ Archive error:', error);
        res.status(500).json({ success: false, message: error.message || 'Delete failed' });
    }
});

const REQUIRED_TICKET_FIELDS = ['ticket_id', 'first_name', 'last_name', 'phone_number', 'category', 'concern'];

function normalizeTicketId(v) {
    return String(v ?? '').trim();
}

function toPreviewTicketRow(row) {
    const first = String(row.first_name ?? '').trim();
    const last = String(row.last_name ?? '').trim();
    const fullName = [first, last].filter(Boolean).join(' ').trim();
    return {
        rowNumber: row.__rowNumber ?? null,
        ticket_id: normalizeTicketId(row.ticket_id),
        customer_name: fullName || '—',
        category: row.category ?? '—',
        status: row.status ?? '—',
        municipality: row.municipality ?? '—',
    };
}

function validateTicket(row, index) {
    const errors = [];
    for (const f of REQUIRED_TICKET_FIELDS) {
        const v = row[f];
        if (v === undefined || v === null || String(v).trim() === '') {
            errors.push(`Row ${index + 1}: missing required field "${f}"`);
        }
    }
    return errors;
}

function parseExcelFile(buffer) {
    return new Promise(async (resolve, reject) => {
        try {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer);
            const ticketSheet = workbook.getWorksheet('Tickets') || workbook.worksheets[1] || workbook.worksheets[0];
            const logSheet = workbook.getWorksheet('TicketLogs') || workbook.worksheets[2];
            if (!ticketSheet) return reject(new Error('No Tickets sheet found'));
            const tickets = [];
            ticketSheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return;
                const headers = ticketSheet.getRow(1).values;
                const obj = {};
                row.eachCell((cell, colNumber) => {
                    const key = headers[colNumber];
                    if (key) obj[key] = cell.value;
                });
                if (Object.keys(obj).length > 0) tickets.push(obj);
            });
            const logs = [];
            if (logSheet) {
                logSheet.eachRow((row, rowNumber) => {
                    if (rowNumber === 1) return;
                    const headers = logSheet.getRow(1).values;
                    const obj = {};
                    row.eachCell((cell, colNumber) => {
                        const key = headers[colNumber];
                        if (key) obj[key] = cell.value;
                    });
                    if (Object.keys(obj).length > 0) logs.push(obj);
                });
            }
            resolve({ tickets, logs });
        } catch (e) {
            reject(e);
        }
    });
}

function parseCsvFile(buffer) {
    const text = buffer.toString('utf8');
    const records = parse(text, { columns: true, skip_empty_lines: true, relax_column_count: true });
    return { tickets: records, logs: [] };
}

// --- IMPORT ROUTE ---
router.post('/tickets/import', requireAdmin, upload.single('file'), async (req, res) => {
    try {
        if (!req.file || !req.file.buffer) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }
        const dryRun = req.query.dryRun === 'true';
        const ext = (req.file.originalname || '').toLowerCase().split('.').pop();
        let tickets = [];
        let logs = [];

        if (ext === 'xlsx') {
            const parsed = await parseExcelFile(req.file.buffer);
            tickets = parsed.tickets;
            logs = parsed.logs;
        } else if (ext === 'csv') {
            const parsed = parseCsvFile(req.file.buffer);
            tickets = parsed.tickets;
            logs = parsed.logs;
        } else {
            return res.status(400).json({ success: false, message: 'Format must be .xlsx or .csv' });
        }

        const errors = [];
        const invalidRows = [];
        const valid = [];
        for (let i = 0; i < tickets.length; i++) {
            const errs = validateTicket(tickets[i], i);
            if (errs.length) {
                errors.push(...errs);
                invalidRows.push({
                    rowNumber: i + 1,
                    ticket_id: normalizeTicketId(tickets[i]?.ticket_id) || '—',
                    reason: errs.join('; '),
                });
            } else {
                valid.push({ ...tickets[i], __rowNumber: i + 1 });
            }
        }

        // Normalize IDs + prevent duplicate ticket_id rows inside the same import file.
        const dedupedValid = [];
        const seenIds = new Set();
        for (let i = 0; i < valid.length; i++) {
            const row = valid[i];
            const normalizedId = normalizeTicketId(row.ticket_id);
            if (!normalizedId) {
                errors.push(`Row ${i + 1}: invalid ticket_id`);
                invalidRows.push({
                    rowNumber: row.__rowNumber ?? (i + 1),
                    ticket_id: '—',
                    reason: 'invalid ticket_id',
                });
                continue;
            }
            if (seenIds.has(normalizedId)) {
                errors.push(`Row ${i + 1}: duplicate ticket_id "${normalizedId}" in uploaded file`);
                invalidRows.push({
                    rowNumber: row.__rowNumber ?? (i + 1),
                    ticket_id: normalizedId,
                    reason: `duplicate ticket_id "${normalizedId}" in uploaded file`,
                });
                continue;
            }
            seenIds.add(normalizedId);
            row.ticket_id = normalizedId;
            dedupedValid.push(row);
        }

        const existingIds = new Set();
        if (dedupedValid.length > 0) {
            const [existing] = await pool.execute(
                `SELECT ticket_id FROM aleco_tickets WHERE ticket_id IN (${dedupedValid.map(() => '?').join(',')})`,
                dedupedValid.map((t) => t.ticket_id)
            );
            existing.forEach((r) => existingIds.add(normalizeTicketId(r.ticket_id)));
        }

        const toImport = dedupedValid.filter((t) => !existingIds.has(normalizeTicketId(t.ticket_id)));
        const skipped = dedupedValid.filter((t) => existingIds.has(normalizeTicketId(t.ticket_id)));

        if (dryRun) {
            return res.json({
                success: true,
                valid: dedupedValid.length,
                skipped: skipped.length,
                toImport: toImport.length,
                failed: errors.length,
                errors: errors.slice(0, 50),
                importableTickets: toImport.slice(0, 300).map(toPreviewTicketRow),
                existingTickets: skipped.slice(0, 300).map(toPreviewTicketRow),
                invalidRows: invalidRows.slice(0, 300),
            });
        }

        // All records already exist in DB: explicitly block import and notify user.
        if (toImport.length === 0) {
            return res.status(409).json({
                success: false,
                message: 'All tickets in this file already exist. No missing tickets to restore.',
                imported: 0,
                skipped: skipped.length,
                failed: errors.length,
            });
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const idSet = new Set(toImport.map(t => String(t.ticket_id).trim()));
            const ordered = [];
            const remaining = [...toImport];
            while (remaining.length > 0) {
                const before = ordered.length;
                for (let i = remaining.length - 1; i >= 0; i--) {
                    const t = remaining[i];
                    const pid = t.parent_ticket_id ? String(t.parent_ticket_id).trim() : '';
                    const parentInList = pid && idSet.has(pid);
                    const parentInserted = !parentInList || ordered.some(o => String(o.ticket_id).trim() === pid);
                    if (!parentInList || parentInserted) {
                        ordered.push(t);
                        remaining.splice(i, 1);
                    }
                }
                if (ordered.length === before) break;
            }
            toImport.length = 0;
            toImport.push(...ordered);

            const ticketCols = ['ticket_id', 'parent_ticket_id', 'account_number', 'first_name', 'middle_name', 'last_name',
                'phone_number', 'address', 'district', 'municipality', 'category', 'concern', 'is_urgent', 'image_url',
                'status', 'created_at', 'updated_at', 'assigned_crew', 'eta', 'dispatch_notes', 'is_consumer_notified',
                'concern_resolution_notes', 'lineman_remarks', 'hold_reason', 'hold_since', 'dispatched_at', 'deleted_at', 'reported_lat', 'reported_lng',
                'location_accuracy', 'location_method', 'location_confidence', 'group_type', 'visit_order', 'remarks'];

            for (const t of toImport) {
                const cols = [];
                const vals = [];
                for (const c of ticketCols) {
                    if (t[c] !== undefined) {
                        cols.push(c);
                        // Imported backups may contain stale Cloudinary URLs if the original ticket
                        // was hard-deleted (asset already cleaned up). Force NULL to avoid broken links.
                        if (c === 'image_url') {
                            vals.push(null);
                        } else {
                            vals.push(t[c] === '' || t[c] === null ? null : t[c]);
                        }
                    }
                }
                if (cols.length === 0) continue;
                const placeholders = cols.map(() => '?').join(', ');
                await connection.execute(
                    `INSERT INTO aleco_tickets (${cols.join(', ')}) VALUES (${placeholders})`,
                    vals
                );
            }

            const logCols = ['ticket_id', 'action', 'from_status', 'to_status', 'actor_type', 'actor_id', 'actor_email', 'actor_name', 'metadata', 'created_at'];
            for (const l of logs) {
                const tid = l.ticket_id;
                if (!toImport.some(t => String(t.ticket_id).trim() === String(tid).trim())) continue;
                const cols = [];
                const vals = [];
                for (const c of logCols) {
                    if (l[c] !== undefined) {
                        cols.push(c);
                        let v = l[c];
                        if (c === 'metadata' && typeof v === 'object') v = JSON.stringify(v);
                        vals.push(v === '' || v === null ? null : v);
                    }
                }
                if (cols.length === 0) continue;
                const placeholders = cols.map(() => '?').join(', ');
                await connection.execute(
                    `INSERT INTO aleco_ticket_logs (${cols.join(', ')}) VALUES (${placeholders})`,
                    vals
                );
            }

            await connection.commit();
            res.json({ success: true, imported: toImport.length, skipped: skipped.length, failed: errors.length });
        } catch (txErr) {
            await connection.rollback();
            throw txErr;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('❌ Import error:', error);
        res.status(500).json({ success: false, message: error.message || 'Import failed' });
    }
});

export default router;
