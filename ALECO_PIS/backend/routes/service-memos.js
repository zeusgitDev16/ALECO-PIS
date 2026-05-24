import express from 'express';
import pool from '../config/db.js';
import {
  parseExtended,
  stringifyExtended,
  mergeMemoForResponse,
  validateMemoPayload,
} from '../utils/serviceMemoExtended.js';
import {
  municipalityToMemoPrefix,
  isValidNewMemoControlNumberFormat,
  peekNextMemoControlNumber,
} from '../utils/memoControlNumber.js';
import { recordMemoNotification, MEMO_EVENT } from '../utils/adminNotifications.js';
import { requireStaff } from '../middleware/requireRole.js';
import { normalizeExpectedUpdatedAt } from '../utils/concurrencyControl.js';

const router = express.Router();

const CLOSED_TICKET_STATUSES = ['Restored', 'Unresolved', 'NoFaultFound', 'AccessDenied'];

/** Shown when a service memo cannot be saved due to ticket status */
const MEMO_SAVE_CLOSED_TICKET_MESSAGE =
  'Save is only allowed when the ticket is closed: Restored, Unresolved, NoFaultFound, or AccessDenied. Pending and Ongoing are not allowed.';

function getActorEmail(req) {
  return req.headers['x-user-email'] || req.headers['user-email'] || null;
}

function getActorName(req) {
  return req.headers['x-user-name'] || req.headers['user-name'] || null;
}

const MEMO_JOIN_SQL = `
    SELECT 
        sm.*,
        t.account_number,
        t.first_name,
        t.middle_name,
        t.last_name,
        t.phone_number,
        t.address,
        t.municipality,
        t.district,
        t.category AS ticket_category,
        t.concern,
        t.action_desired,
        t.status as ticket_live_status,
        t.assigned_crew,
        t.dispatched_at,
        t.created_at AS ticket_created_at
    FROM aleco_service_memos sm
    LEFT JOIN aleco_tickets t ON sm.ticket_id = t.ticket_id
`;

/** Map joined row to API memo + ticket context */
function rowToMemoDto(row) {
  if (!row) return null;
  const ticket = {
    account_number: row.account_number,
    first_name: row.first_name,
    middle_name: row.middle_name,
    last_name: row.last_name,
    phone_number: row.phone_number,
    address: row.address,
    municipality: row.municipality,
    district: row.district,
    category: row.category,
    concern: row.concern,
    action_desired: row.action_desired,
    status: row.ticket_live_status,
    assigned_crew: row.assigned_crew,
    dispatched_at: row.dispatched_at,
    ticket_created_at: row.ticket_created_at ?? null,
  };
  return mergeMemoForResponse(row, ticket);
}

function trimQuery(v) {
  return v != null && String(v).trim() ? String(v).trim() : '';
}

// GET /api/service-memos - Fetch service memos with filters
router.get('/service-memos', requireStaff, async (req, res) => {
  try {
    const {
      tab = 'all',
      search,
      searchMemo,
      searchTicket,
      searchAccount,
      searchCustomer,
      searchAddress,
      status,
      municipality,
      startDate,
      endDate,
      owner,
    } = req.query;

    const currentUserEmail = getActorEmail(req);

    let query = `${MEMO_JOIN_SQL} WHERE 1=1`;
    const params = [];

    if (tab === 'saved') {
      query += ` AND sm.memo_status = 'saved'`;
    } else if (tab === 'deployed') {
      query += ` AND sm.memo_status = 'deployed'`;
    } else if (tab === 'closed') {
      query += ` AND sm.memo_status = 'closed'`;
    }

    const qMemo = trimQuery(searchMemo);
    const qTicket = trimQuery(searchTicket);
    const qAccount = trimQuery(searchAccount);
    const qCustomer = trimQuery(searchCustomer);
    const qAddress = trimQuery(searchAddress);
    const qBroad = trimQuery(search);

    /** Toolbar / API: each field narrows the list (AND). Strip-nav uses a single param at a time. */
    const hasScoped = !!(qMemo || qTicket || qAccount || qCustomer || qAddress);

    if (qMemo) {
      query += ` AND sm.control_number LIKE ?`;
      params.push(`%${qMemo}%`);
    }
    if (qTicket) {
      query += ` AND sm.ticket_id LIKE ?`;
      params.push(`%${qTicket}%`);
    }
    if (qAccount) {
      query += ` AND t.account_number LIKE ?`;
      params.push(`%${qAccount}%`);
    }
    if (qCustomer) {
      const w = `%${qCustomer}%`;
      query += ` AND (
                t.first_name LIKE ? OR
                t.last_name LIKE ? OR
                CONCAT(COALESCE(t.first_name,''), ' ', COALESCE(t.last_name,'')) LIKE ?
            )`;
      params.push(w, w, w);
    }
    if (qAddress) {
      const w = `%${qAddress}%`;
      query += ` AND (t.address LIKE ? OR t.municipality LIKE ? OR t.district LIKE ?)`;
      params.push(w, w, w);
    }

    /** Drawer "Search" only — skipped when any toolbar-style scoped filter is set, so OR-query does not mask AND filters. */
    if (!hasScoped && qBroad) {
      const searchWildcard = `%${qBroad}%`;
      query += ` AND (
                sm.ticket_id LIKE ? OR
                sm.control_number LIKE ? OR
                t.account_number LIKE ? OR
                t.address LIKE ? OR
                t.first_name LIKE ? OR
                t.last_name LIKE ? OR
                CONCAT(COALESCE(t.first_name,''), ' ', COALESCE(t.last_name,'')) LIKE ? OR
                t.concern LIKE ?
            )`;
      params.push(
        searchWildcard,
        searchWildcard,
        searchWildcard,
        searchWildcard,
        searchWildcard,
        searchWildcard,
        searchWildcard,
        searchWildcard
      );
    }

    if (status && status.trim()) {
      query += ` AND sm.memo_status = ?`;
      params.push(status.trim());
    }

    if (municipality && municipality.trim()) {
      query += ` AND t.municipality = ?`;
      params.push(municipality.trim());
    }

    if (tab === 'all' && owner && owner.trim()) {
      query += ` AND sm.owner_email = ?`;
      params.push(owner.trim());
    }

    if (startDate && endDate) {
      query += ` AND DATE(sm.created_at) BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }

    query += ` ORDER BY sm.created_at DESC`;

    const [rows] = await pool.execute(query, params);
    const data = rows.map(rowToMemoDto);
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ Service Memos Fetch Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch service memos.' });
  }
});

// POST /api/service-memos/allocate-control-number — **preview** next PREFIX-########## (saved memos + 1 only; no DB reservation until Save)
router.post('/service-memos/allocate-control-number', requireStaff, async (req, res) => {
  try {
    const currentUserEmail = getActorEmail(req);
    if (!currentUserEmail || !String(currentUserEmail).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Authentication required: missing user email (X-User-Email).',
      });
    }

    const ticket_id = req.body?.ticket_id;
    if (!ticket_id) {
      return res.status(400).json({ success: false, message: 'Ticket ID is required.' });
    }

    const [ticketRows] = await pool.execute(
      `SELECT status, municipality, service_memo_id FROM aleco_tickets WHERE ticket_id = ?`,
      [ticket_id]
    );

    if (ticketRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    const ticketRow = ticketRows[0];
    if (ticketRow.service_memo_id != null && ticketRow.service_memo_id !== '') {
      return res.status(409).json({
        success: false,
        message:
          'A service memo already exists for this ticket. Open the existing memo or delete it before generating a new code.',
      });
    }

    const [existingMemoRow] = await pool.execute(
      `SELECT id FROM aleco_service_memos WHERE ticket_id = ? LIMIT 1`,
      [ticket_id]
    );
    if (existingMemoRow.length > 0) {
      return res.status(409).json({
        success: false,
        message:
          'A service memo already exists for this ticket. Open the existing memo or delete it before generating a new code.',
      });
    }

    const { municipality } = ticketRow;

    const prefix = municipalityToMemoPrefix(municipality);
    if (!prefix) {
      return res.status(400).json({
        success: false,
        message:
          'Ticket municipality is missing or not mapped for memo prefix. Update memo municipality codes if this is a new area.',
      });
    }

    const control_number = await peekNextMemoControlNumber(pool, prefix);
    res.json({
      success: true,
      data: { control_number, prefix },
    });
  } catch (error) {
    console.error('❌ Memo control number preview error:', error);
    let message = 'Could not compute memo number preview.';
    if (error.sqlMessage) {
      message = `Could not compute memo number: ${error.sqlMessage}`;
    } else if (error.message && !String(error.message).includes('stack')) {
      message = `Could not compute memo number: ${error.message}`;
    }
    res.status(500).json({
      success: false,
      message,
    });
  }
});

// GET /api/service-memos/:id - Single memo with ticket join
router.get('/service-memos/:id', requireStaff, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid memo id.' });
    }

    const [rows] = await pool.execute(`${MEMO_JOIN_SQL} WHERE sm.id = ?`, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Service memo not found.' });
    }

    res.json({ success: true, data: rowToMemoDto(rows[0]) });
  } catch (error) {
    console.error('❌ Service Memo Get Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch service memo.' });
  }
});

/** @param {unknown} v @returns {string|null} */
function normalizePhotoUrl(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function buildExtendedFromBody(body) {
  return {
    intake_time: body.intake_time,
    referral_received_date: body.referral_received_date,
    referral_received_time: body.referral_received_time,
    site_arrived_date: body.site_arrived_date || null,
    site_arrived_time: body.site_arrived_time || null,
    finished_date: body.finished_date,
    finished_time: body.finished_time,
  };
}

// POST /api/service-memos - Create service memo
router.post('/service-memos', requireStaff, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const body = req.body || {};
    const {
      ticket_id,
      work_performed,
      resolution_details,
      service_date,
      intake_date,
      received_by,
      referred_to,
      action_taken,
    } = body;

    const currentUserEmail = getActorEmail(req);
    const currentUser = getActorName(req) || '';

    if (!currentUserEmail || !String(currentUserEmail).trim()) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Authentication required: missing user email (X-User-Email).',
      });
    }

    if (!ticket_id) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Ticket ID is required.' });
    }

    const v = validateMemoPayload(body);
    if (!v.ok) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${v.missing.join(', ')}`,
        missing: v.missing,
      });
    }

    const [ticketRows] = await connection.execute(
      `SELECT status, municipality, category, first_name, middle_name, last_name, address, phone_number, account_number FROM aleco_tickets WHERE ticket_id = ?`,
      [ticket_id]
    );

    if (ticketRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    const ticketStatus = ticketRows[0].status;
    const ticketMunicipality = ticketRows[0].municipality;
    const ticketCategory = ticketRows[0].category;
    const firstName = ticketRows[0].first_name || '';
    const middleName = ticketRows[0].middle_name || '';
    const lastName = ticketRows[0].last_name || '';
    const ticketAddress = ticketRows[0].address || '';
    const ticketPhone = ticketRows[0].phone_number || '';
    const ticketAccountNumber = ticketRows[0].account_number || '';

    const bodyCat = body.category != null ? String(body.category).trim() : '';
    const snapCat =
      bodyCat !== ''
        ? bodyCat
        : ticketCategory != null && String(ticketCategory).trim() !== ''
          ? String(ticketCategory).trim()
          : null;

    // Check if ticket already has a service memo
    const [existingMemo] = await connection.execute(`SELECT id FROM aleco_service_memos WHERE ticket_id = ?`, [ticket_id]);

    if (existingMemo.length > 0) {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'Service memo already exists for this ticket.' });
    }

    // Auto-allocate control_number if not provided
    let controlNumber;
    const rawMemo = String(body.control_number ?? '').trim();
    if (rawMemo) {
      // Validate provided control_number
      if (!isValidNewMemoControlNumberFormat(rawMemo)) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'Memo # format is invalid. Use format XXX-########## (e.g. LEG-0000089729).',
        });
      }

      const expectedPrefix = municipalityToMemoPrefix(ticketMunicipality);
      const clientPrefix = rawMemo.slice(0, 3);
      if (!expectedPrefix || clientPrefix !== expectedPrefix) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: "Memo # prefix does not match this ticket's municipality.",
        });
      }
      controlNumber = rawMemo;
    } else {
      // Auto-allocate control_number
      const prefix = municipalityToMemoPrefix(ticketMunicipality);
      if (!prefix) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'Ticket municipality is missing or not mapped for memo prefix.',
        });
      }
      controlNumber = await peekNextMemoControlNumber(connection, prefix);
    }

    // Auto-fill fields from ticket data
    const customerName = [firstName, middleName, lastName].filter(Boolean).join(' ').trim();
    const intakeDate = intake_date || service_date || new Date().toISOString().split('T')[0];
    const actionText = (action_taken || work_performed || '').trim();
    const receivedByValue = received_by || currentUser.trim() || '';
    const referredToValue = referred_to || '';

    const extPayload = buildExtendedFromBody(body);
    const internalNotesValue = stringifyExtended(extPayload);
    const photoUrlValue = normalizePhotoUrl(body.photo_url);

    const [result] = await connection.execute(
      `INSERT INTO aleco_service_memos 
            (ticket_id, ticket_status, category, control_number, service_date, work_performed, resolution_details, internal_notes, photo_url, received_by, referred_to, owner_email, owner_name, memo_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'saved')`,
      [
        ticket_id,
        'Ongoing',
        snapCat,
        controlNumber,
        intakeDate,
        actionText,
        resolution_details != null ? resolution_details : null,
        internalNotesValue,
        photoUrlValue,
        receivedByValue,
        referredToValue,
        currentUserEmail.trim(),
        currentUser.trim() || '—',
      ]
    );

    await connection.execute(`UPDATE aleco_tickets SET service_memo_id = ?, status = 'Ongoing' WHERE ticket_id = ?`, [result.insertId, ticket_id]);

    await recordMemoNotification(connection, {
      eventType: MEMO_EVENT.CREATED,
      subjectName: controlNumber,
      detail: `Ticket ${ticket_id}`,
      actorEmail: currentUserEmail.trim(),
    });

    await connection.commit();

    console.log(`✅ Service Memo Created: ID ${result.insertId}, Control #${controlNumber} for Ticket ${ticket_id}`);
    res.json({
      success: true,
      data: { id: result.insertId, control_number: controlNumber, photo_url: photoUrlValue },
    });
  } catch (error) {
    await connection.rollback();
    if (error.errno === 1062 || error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'This memo number is already in use. Generate a new code and try again.',
      });
    }
    console.error('❌ Service Memo Creation Error:', error);
    res.status(500).json({ success: false, message: 'Failed to create service memo.' });
  } finally {
    connection.release();
  }
});

// PUT /api/service-memos/:id - Update service memo
router.put('/service-memos/:id', requireStaff, async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const currentUserEmail = getActorEmail(req);

    const [memoRows] = await pool.execute(`SELECT * FROM aleco_service_memos WHERE id = ?`, [id]);

    if (memoRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Service memo not found.' });
    }

    const memo = memoRows[0];

    const expectedUpdatedAt = normalizeExpectedUpdatedAt(body.expected_updated_at ?? body.expectedUpdatedAt);
    if (expectedUpdatedAt) {
      const dbIso = memo.updated_at ? new Date(memo.updated_at).toISOString() : '';
      let clientIso = '';
      try { clientIso = new Date(expectedUpdatedAt).toISOString(); } catch { /* invalid */ }
      if (!dbIso || dbIso !== clientIso) {
        return res.status(409).json({
          success: false,
          code: 'CONFLICT_STALE_MEMO',
          message: 'This memo was updated by someone else. Reload it and try again.',
          latest: { id: memo.id, memo_status: memo.memo_status, updated_at: memo.updated_at },
        });
      }
    }

    if (memo.memo_status === 'closed') {
      return res.status(400).json({ success: false, message: 'Cannot edit a closed service memo.' });
    }

    const mergedBody = { ...mergeMemoForResponse(memo, null), ...body };

    const v = validateMemoPayload(mergedBody);
    if (!v.ok) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${v.missing.join(', ')}`,
        missing: v.missing,
      });
    }

    const prevExt = parseExtended(memo.internal_notes);
    const extPayload = buildExtendedFromBody(mergedBody);
    if (prevExt.user_notes != null && body.internal_notes === undefined) {
      extPayload.user_notes = prevExt.user_notes;
    }
    if (body.internal_notes !== undefined && body.internal_notes !== null) {
      extPayload.user_notes = String(body.internal_notes).trim();
    }
    const internalNotesValue = stringifyExtended(extPayload);

    const updateFields = [];
    const updateParams = [];

    updateFields.push('work_performed = ?');
    updateParams.push((mergedBody.action_taken || mergedBody.work_performed || '').trim());

    if (body.resolution_details !== undefined) {
      updateFields.push('resolution_details = ?');
      updateParams.push(body.resolution_details);
    }

    updateFields.push('internal_notes = ?');
    updateParams.push(internalNotesValue);

    if (body.memo_status !== undefined && body.memo_status !== memo.memo_status) {
      return res.status(400).json({ success: false, message: 'Memo status cannot be changed via this update.' });
    }

    const intakeDate = mergedBody.intake_date || mergedBody.service_date;
    if (intakeDate) {
      updateFields.push('service_date = ?');
      updateParams.push(intakeDate);
    }

    updateFields.push('received_by = ?');
    updateParams.push((mergedBody.received_by || '').trim());

    updateFields.push('referred_to = ?');
    updateParams.push((mergedBody.referred_to || '').trim());

    const mergedCat =
      mergedBody.category != null && String(mergedBody.category).trim() !== ''
        ? String(mergedBody.category).trim()
        : null;
    updateFields.push('category = ?');
    updateParams.push(mergedCat);

    if (body.photo_url !== undefined) {
      updateFields.push('photo_url = ?');
      updateParams.push(normalizePhotoUrl(body.photo_url));
    }

    updateParams.push(id);
    let memoWhereClause = 'id = ?';
    if (expectedUpdatedAt && memo.updated_at) {
      updateParams.push(memo.updated_at);
      memoWhereClause += ' AND updated_at = ?';
    }

    const query = `UPDATE aleco_service_memos SET ${updateFields.join(', ')} WHERE ${memoWhereClause}`;
    const [updateResult] = await pool.execute(query, updateParams);

    if (updateResult.affectedRows === 0 && expectedUpdatedAt) {
      return res.status(409).json({
        success: false,
        code: 'CONFLICT_STALE_MEMO',
        message: 'This memo was updated by someone else. Reload it and try again.',
        latest: { id: memo.id, memo_status: memo.memo_status, updated_at: memo.updated_at },
      });
    }

    await recordMemoNotification(pool, {
      eventType: MEMO_EVENT.UPDATED,
      subjectName: memo.control_number || String(id),
      detail: memo.ticket_id ? `Ticket ${memo.ticket_id}` : null,
      actorEmail: currentUserEmail && String(currentUserEmail).trim() ? String(currentUserEmail).trim() : null,
    });

    console.log(`✅ Service Memo Updated: ID ${id}`);
    res.json({ success: true, message: 'Service memo updated successfully.' });
  } catch (error) {
    console.error('❌ Service Memo Update Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update service memo.' });
  }
});

// PUT /api/service-memos/:id/close - Close service memo
router.put('/service-memos/:id/close', requireStaff, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserEmail = getActorEmail(req);

    const [memoRows] = await pool.execute(`SELECT * FROM aleco_service_memos WHERE id = ?`, [id]);

    if (memoRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Service memo not found.' });
    }

    const memo = memoRows[0];

    const expectedUpdatedAt = normalizeExpectedUpdatedAt(req.body?.expected_updated_at ?? req.body?.expectedUpdatedAt);
    if (expectedUpdatedAt) {
      const dbIso = memo.updated_at ? new Date(memo.updated_at).toISOString() : '';
      let clientIso = '';
      try { clientIso = new Date(expectedUpdatedAt).toISOString(); } catch { /* invalid */ }
      if (!dbIso || dbIso !== clientIso) {
        return res.status(409).json({
          success: false,
          code: 'CONFLICT_STALE_MEMO',
          message: 'This memo was updated by someone else. Reload it and try again.',
          latest: { id: memo.id, memo_status: memo.memo_status, updated_at: memo.updated_at },
        });
      }
    }

    if (memo.memo_status !== 'saved') {
      return res.status(400).json({ success: false, message: 'Can only close a saved service memo.' });
    }

    const closeWhereSql = expectedUpdatedAt && memo.updated_at ? 'id = ? AND updated_at = ?' : 'id = ?';
    const closeWhereParams = expectedUpdatedAt && memo.updated_at ? [id, memo.updated_at] : [id];
    const currentUserName = getActorName(req) || '';
    const [closeResult] = await pool.execute(
      `UPDATE aleco_service_memos SET memo_status = 'closed', closed_at = NOW(), closed_by = ? WHERE ${closeWhereSql}`,
      [currentUserName, ...closeWhereParams]
    );

    if (closeResult.affectedRows === 0 && expectedUpdatedAt) {
      return res.status(409).json({
        success: false,
        code: 'CONFLICT_STALE_MEMO',
        message: 'This memo was updated by someone else. Reload it and try again.',
        latest: { id: memo.id, memo_status: memo.memo_status, updated_at: memo.updated_at },
      });
    }

    await recordMemoNotification(pool, {
      eventType: MEMO_EVENT.CLOSED,
      subjectName: memo.control_number || String(id),
      detail: memo.ticket_id ? `Ticket ${memo.ticket_id}` : null,
      actorEmail: currentUserEmail && String(currentUserEmail).trim() ? String(currentUserEmail).trim() : null,
    });

    console.log(`✅ Service Memo Closed: ID ${id}`);
    res.json({ success: true, message: 'Service memo closed successfully.' });
  } catch (error) {
    console.error('❌ Service Memo Close Error:', error);
    res.status(500).json({ success: false, message: 'Failed to close service memo.' });
  }
});

// DELETE /api/service-memos/:id - Delete service memo (keeps ticket status unchanged)
router.delete('/service-memos/:id', requireStaff, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserEmail = getActorEmail(req);

    const [memoRows] = await pool.execute(`SELECT * FROM aleco_service_memos WHERE id = ?`, [id]);

    if (memoRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Service memo not found.' });
    }

    const memo = memoRows[0];

    await pool.execute(`UPDATE aleco_tickets SET service_memo_id = NULL WHERE ticket_id = ?`, [memo.ticket_id]);

    const controlNo = memo.control_number || String(id);
    const ticketRef = memo.ticket_id ? `Ticket ${memo.ticket_id}` : null;
    const deleter =
      currentUserEmail && String(currentUserEmail).trim() ? String(currentUserEmail).trim() : null;

    await pool.execute(`DELETE FROM aleco_service_memos WHERE id = ?`, [id]);

    await recordMemoNotification(pool, {
      eventType: MEMO_EVENT.DELETED,
      subjectName: controlNo,
      detail: ticketRef,
      actorEmail: deleter,
    });

    console.log(`✅ Service Memo Deleted: ID ${id}`);
    res.json({ success: true, message: 'Service memo deleted successfully.' });
  } catch (error) {
    console.error('❌ Service Memo Delete Error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete service memo.' });
  }
});

// DELETE /api/service-memos/:id/undo - Undo service memo (deletes memo AND reverts ticket to Pending)
router.delete('/service-memos/:id/undo', requireStaff, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserEmail = getActorEmail(req);

    const [memoRows] = await pool.execute(`SELECT * FROM aleco_service_memos WHERE id = ?`, [id]);

    if (memoRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Service memo not found.' });
    }

    const memo = memoRows[0];

    // Revert ticket status to Pending and clear service_memo_id
    await pool.execute(`UPDATE aleco_tickets SET service_memo_id = NULL, status = 'Pending' WHERE ticket_id = ?`, [memo.ticket_id]);

    const controlNo = memo.control_number || String(id);
    const ticketRef = memo.ticket_id ? `Ticket ${memo.ticket_id}` : null;
    const deleter =
      currentUserEmail && String(currentUserEmail).trim() ? String(currentUserEmail).trim() : null;

    await pool.execute(`DELETE FROM aleco_service_memos WHERE id = ?`, [id]);

    await recordMemoNotification(pool, {
      eventType: MEMO_EVENT.DELETED,
      subjectName: controlNo,
      detail: `${ticketRef} (status reverted to Pending)`,
      actorEmail: deleter,
    });

    console.log(`✅ Service Memo Undone: ID ${id}, Ticket ${memo.ticket_id} reverted to Pending`);
    res.json({ success: true, message: 'Service memo undone and ticket reverted to Pending.' });
  } catch (error) {
    console.error('❌ Service Memo Undo Error:', error);
    res.status(500).json({ success: false, message: 'Failed to undo service memo.' });
  }
});

// POST /api/service-memos/bulk - Bulk create service memos for multiple tickets
router.post('/service-memos/bulk', requireStaff, async (req, res) => {
  try {
    const body = req.body || {};
    const { ticket_ids, municipality, skip_existing = false } = body;

    const currentUserEmail = getActorEmail(req);
    const currentUser = getActorName(req) || '';

    if (!currentUserEmail || !String(currentUserEmail).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Authentication required: missing user email (X-User-Email).',
      });
    }

    if (!ticket_ids || !Array.isArray(ticket_ids) || ticket_ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Ticket IDs array is required.' });
    }

    // Backward compatibility: if municipality is provided, use old behavior (single prefix, block on existing)
    const useLegacyMode = municipality != null;

    if (useLegacyMode) {
      // Legacy mode: single municipality, block on existing memos
      if (!municipality) {
        return res.status(400).json({ success: false, message: 'Municipality is required for memo number generation.' });
      }

      // Get memo prefix from municipality
      const prefix = municipalityToMemoPrefix(municipality);
      if (!prefix) {
        return res.status(400).json({ success: false, message: 'Invalid municipality for memo number generation.' });
      }

      // Fetch next memo number
      const nextNumber = await peekNextMemoControlNumber(pool, prefix);
      const controlNumber = `${prefix}-${String(nextNumber).padStart(8, '0')}`;

      // Check if any tickets already have service memos
      const [existingMemos] = await pool.execute(
        `SELECT ticket_id FROM aleco_service_memos WHERE ticket_id IN (${ticket_ids.map(() => '?').join(',')})`,
        ticket_ids
      );

      if (existingMemos.length > 0) {
        const existingTicketIds = existingMemos.map(m => m.ticket_id);
        return res.status(409).json({
          success: false,
          message: `Some tickets already have service memos: ${existingTicketIds.join(', ')}`,
        });
      }

      // Create service memos in transaction
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        const createdMemos = [];
        for (let i = 0; i < ticket_ids.length; i++) {
          const ticketId = ticket_ids[i];
          const memoNumber = `${prefix}-${String(nextNumber + i).padStart(8, '0')}`;

          // Get ticket info
          const [ticketRows] = await connection.execute(
            `SELECT status, category FROM aleco_tickets WHERE ticket_id = ?`,
            [ticketId]
          );

          if (ticketRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: `Ticket ${ticketId} not found.` });
          }

          const ticketStatus = ticketRows[0].status;
          const ticketCategory = ticketRows[0].category;

          // Insert service memo
          const [result] = await connection.execute(
            `INSERT INTO aleco_service_memos 
              (ticket_id, ticket_status, category, control_number, service_date, work_performed, resolution_details, internal_notes, photo_url, received_by, referred_to, owner_email, owner_name, memo_status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'saved')`,
            [
              ticketId,
              'Ongoing',
              ticketCategory,
              memoNumber,
              new Date().toISOString().split('T')[0],
              null,
              null,
              null,
              null,
              '',
              '',
              currentUserEmail.trim(),
              currentUser.trim() || '—',
            ]
          );

          // Update ticket status to Ongoing and link memo
          await connection.execute(
            `UPDATE aleco_tickets SET service_memo_id = ?, status = 'Ongoing' WHERE ticket_id = ?`,
            [result.insertId, ticketId]
          );

          createdMemos.push({
            id: result.insertId,
            ticket_id: ticketId,
            control_number: memoNumber,
          });
        }

        await connection.commit();

        console.log(`✅ Bulk Service Memos Created (Legacy): ${createdMemos.length} memos`);
        res.json({
          success: true,
          message: `Created ${createdMemos.length} service memos successfully.`,
          data: createdMemos,
        });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } else {
      // New mode: per-ticket municipality, skip existing memos
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        // Fetch all tickets with their municipalities
        const placeholders = ticket_ids.map(() => '?').join(',');
        const [ticketRows] = await connection.execute(
          `SELECT ticket_id, status, category, municipality FROM aleco_tickets WHERE ticket_id IN (${placeholders})`,
          ticket_ids
        );

        if (ticketRows.length === 0) {
          await connection.rollback();
          return res.status(404).json({ success: false, message: 'No tickets found.' });
        }

        // Check which tickets already have memos
        const [existingMemos] = await connection.execute(
          `SELECT ticket_id FROM aleco_service_memos WHERE ticket_id IN (${placeholders})`,
          ticket_ids
        );
        const existingTicketIds = new Set(existingMemos.map(m => m.ticket_id));

        // Group tickets by municipality
        const byMunicipality = {};
        for (const ticket of ticketRows) {
          const muni = ticket.municipality;
          if (!byMunicipality[muni]) byMunicipality[muni] = [];
          byMunicipality[muni].push(ticket);
        }

        const createdMemos = [];
        const skippedMemos = [];

        // For each municipality, generate sequential memo numbers
        for (const [muni, muniTickets] of Object.entries(byMunicipality)) {
          const prefix = municipalityToMemoPrefix(muni);
          if (!prefix) {
            // Skip tickets with unmapped municipality
            for (const ticket of muniTickets) {
              skippedMemos.push({
                ticket_id: ticket.ticket_id,
                reason: 'unmapped_municipality',
              });
            }
            continue;
          }

          const nextNumFull = await peekNextMemoControlNumber(connection, prefix);
          const nextNum = parseInt(nextNumFull.split('-')[1], 10);

          for (let i = 0; i < muniTickets.length; i++) {
            const ticket = muniTickets[i];
            const ticketId = ticket.ticket_id;

            // Skip if ticket already has memo
            if (existingTicketIds.has(ticketId)) {
              skippedMemos.push({
                ticket_id: ticketId,
                reason: 'existing_memo',
              });
              continue;
            }

            const memoNumber = `${prefix}-${String(nextNum + i).padStart(10, '0')}`;

            const [result] = await connection.execute(
              `INSERT INTO aleco_service_memos 
                (ticket_id, ticket_status, category, control_number, service_date, work_performed, resolution_details, internal_notes, photo_url, received_by, referred_to, owner_email, owner_name, memo_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'saved')`,
              [
                ticketId,
                'Ongoing',
                ticket.category,
                memoNumber,
                new Date().toISOString().split('T')[0],
                null,
                null,
                null,
                null,
                '',
                '',
                currentUserEmail.trim(),
                currentUser.trim() || '—',
              ]
            );

            await connection.execute(
              `UPDATE aleco_tickets SET service_memo_id = ?, status = 'Ongoing' WHERE ticket_id = ?`,
              [result.insertId, ticketId]
            );

            createdMemos.push({
              id: result.insertId,
              ticket_id: ticketId,
              control_number: memoNumber,
            });
          }
        }

        await connection.commit();

        console.log(`✅ Bulk Service Memos Created: ${createdMemos.length} created, ${skippedMemos.length} skipped`);
        res.json({
          success: true,
          message: `Created ${createdMemos.length} service memos${skippedMemos.length > 0 ? `, skipped ${skippedMemos.length}` : ''}.`,
          data: {
            created: createdMemos,
            skipped: skippedMemos,
          },
        });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
  } catch (error) {
    console.error('❌ Bulk Service Memo Creation Error:', error);
    res.status(500).json({ success: false, message: 'Failed to create bulk service memos.' });
  }
});

export default router;
