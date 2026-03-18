import express from 'express';
import multer from 'multer';
import pool from '../config/db.js';
import ExcelJS from 'exceljs';
import { stringify } from 'csv-stringify/sync';
import { parse } from 'csv-parse/sync';

const router = express.Router();

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

    query += ` ORDER BY created_at ASC`;
    return { query, params };
}

// --- EXPORT PREVIEW (JSON for View in browser) - must be before /tickets/export ---
router.get('/tickets/export/preview', async (req, res) => {
    try {
        const { preset, startDate, endDate, category, district, municipality, status, groupFilter, isNew, isUrgent } = req.query;
        const dateFilter = buildDateFilter(preset, startDate, endDate);
        if (!dateFilter) {
            return res.status(400).json({ success: false, message: 'Provide preset or startDate and endDate' });
        }

        const { startDate: ds, endDate: de } = dateFilter;
        const filters = { category, district, municipality, status, groupFilter, isNew, isUrgent };
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
router.get('/tickets/export', async (req, res) => {
    try {
        const { preset, startDate, endDate, format, category, district, municipality, status, groupFilter, isNew, isUrgent } = req.query;
        const fmt = (format || 'excel').toLowerCase();
        if (fmt !== 'excel' && fmt !== 'csv') {
            return res.status(400).json({ success: false, message: 'Format must be excel or csv' });
        }

        const dateFilter = buildDateFilter(preset, startDate, endDate);
        if (!dateFilter) {
            return res.status(400).json({ success: false, message: 'Provide preset or startDate and endDate' });
        }

        const { startDate: ds, endDate: de } = dateFilter;
        const filters = { category, district, municipality, status, groupFilter, isNew, isUrgent };
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
            ticketSheet.addRow(ticketCols);
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
            logSheet.addRow(logCols);
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

// --- ARCHIVE ROUTE ---
router.post('/tickets/archive', async (req, res) => {
    try {
        const { startDate, endDate, preset, category, district, municipality, status, groupFilter, isNew, isUrgent } = req.body;

        const dateFilter = buildDateFilter(preset, startDate, endDate);
        if (!dateFilter) {
            return res.status(400).json({ success: false, message: 'Provide preset or startDate and endDate' });
        }

        const { startDate: ds, endDate: de } = dateFilter;
        const filters = { category, district, municipality, status, groupFilter, isNew, isUrgent };
        const { query, params } = buildTicketQuery(ds, de, filters);

        const countQuery = query.replace('SELECT *', 'SELECT ticket_id');
        const [ticketRows] = await pool.execute(countQuery, params);

        const ticketIds = ticketRows.map(r => r.ticket_id);
        let archivedCount = 0;

        if (ticketIds.length > 0) {
            const placeholders = ticketIds.map(() => '?').join(', ');
            await pool.execute(
                `DELETE FROM aleco_ticket_logs WHERE ticket_id IN (${placeholders})`,
                ticketIds
            );
            const { query: selQuery, params: selParams } = buildTicketQuery(ds, de, filters);
            const updateQuery = selQuery
                .replace('SELECT * FROM aleco_tickets WHERE', 'UPDATE aleco_tickets SET deleted_at = NOW() WHERE')
                .replace(' ORDER BY created_at ASC', '');
            const [updateResult] = await pool.execute(updateQuery, selParams);
            archivedCount = updateResult.affectedRows ?? ticketIds.length;
        }

        res.json({ success: true, archivedCount });
    } catch (error) {
        console.error('❌ Archive error:', error);
        res.status(500).json({ success: false, message: error.message || 'Archive failed' });
    }
});

const REQUIRED_TICKET_FIELDS = ['ticket_id', 'first_name', 'last_name', 'phone_number', 'category', 'concern'];

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
router.post('/tickets/import', upload.single('file'), async (req, res) => {
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
        const valid = [];
        for (let i = 0; i < tickets.length; i++) {
            const errs = validateTicket(tickets[i], i);
            if (errs.length) errors.push(...errs);
            else valid.push(tickets[i]);
        }

        const existingIds = new Set();
        if (valid.length > 0) {
            const [existing] = await pool.execute(
                `SELECT ticket_id FROM aleco_tickets WHERE ticket_id IN (${valid.map(() => '?').join(',')})`,
                valid.map(t => t.ticket_id)
            );
            existing.forEach(r => existingIds.add(r.ticket_id));
        }

        const toImport = valid.filter(t => !existingIds.has(String(t.ticket_id).trim()));
        const skipped = valid.filter(t => existingIds.has(String(t.ticket_id).trim()));

        if (dryRun) {
            return res.json({
                success: true,
                valid: valid.length,
                skipped: skipped.length,
                toImport: toImport.length,
                failed: errors.length,
                errors: errors.slice(0, 50)
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
                'lineman_remarks', 'hold_reason', 'hold_since', 'dispatched_at', 'deleted_at', 'reported_lat', 'reported_lng',
                'location_accuracy', 'location_method', 'location_confidence', 'group_type', 'visit_order', 'remarks'];

            for (const t of toImport) {
                const cols = [];
                const vals = [];
                for (const c of ticketCols) {
                    if (t[c] !== undefined) {
                        cols.push(c);
                        vals.push(t[c] === '' || t[c] === null ? null : t[c]);
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
