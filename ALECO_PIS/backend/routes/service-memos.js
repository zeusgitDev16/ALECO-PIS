import express from 'express';
import pool from '../config/db.js';
import {
  parseExtended,
  stringifyExtended,
  mergeMemoForResponse,
  validateMemoPayload,
} from '../utils/serviceMemoExtended.js';

const router = express.Router();

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
        t.category,
        t.concern,
        t.action_desired,
        t.status as ticket_live_status,
        t.assigned_crew,
        t.dispatched_at
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
  };
  return mergeMemoForResponse(row, ticket);
}

// Helper function to generate control number (SM-YYYY-NNNN format)
async function generateControlNumber() {
  const year = new Date().getFullYear();
  try {
    const [rows] = await pool.execute(
      `SELECT control_number FROM aleco_service_memos WHERE control_number LIKE ? ORDER BY control_number DESC LIMIT 1`,
      [`SM-${year}-%`]
    );

    let nextNumber = 1;
    if (rows.length > 0 && rows[0].control_number) {
      const parts = rows[0].control_number.split('-');
      const lastNumber = parseInt(parts[2], 10);
      if (!Number.isNaN(lastNumber)) nextNumber = lastNumber + 1;
    }

    const paddedNumber = String(nextNumber).padStart(4, '0');
    return `SM-${year}-${paddedNumber}`;
  } catch (error) {
    console.error('❌ Control Number Generation Error:', error);
    return `SM-${year}-${Date.now().toString().slice(-4)}`;
  }
}

// GET /api/service-memos - Fetch service memos with filters
router.get('/service-memos', async (req, res) => {
  try {
    const { tab = 'all', search, status, startDate, endDate, owner } = req.query;

    const currentUserEmail = getActorEmail(req);

    let query = `${MEMO_JOIN_SQL} WHERE 1=1`;
    const params = [];

    if (tab === 'draft') {
      query += ` AND sm.memo_status = 'draft'`;
      if (currentUserEmail) {
        query += ` AND sm.owner_email = ?`;
        params.push(currentUserEmail);
      }
    } else if (tab === 'saved') {
      query += ` AND sm.memo_status = 'saved'`;
      if (currentUserEmail) {
        query += ` AND sm.owner_email = ?`;
        params.push(currentUserEmail);
      }
    } else if (tab === 'closed') {
      query += ` AND sm.memo_status = 'closed'`;
      if (currentUserEmail) {
        query += ` AND sm.owner_email = ?`;
        params.push(currentUserEmail);
      }
    }

    if (search && search.trim()) {
      const searchWildcard = `%${search.trim()}%`;
      query += ` AND (
                sm.ticket_id LIKE ? OR
                sm.control_number LIKE ? OR
                t.account_number LIKE ? OR
                t.address LIKE ? OR
                t.first_name LIKE ? OR
                t.last_name LIKE ? OR
                CONCAT(t.first_name, ' ', t.last_name) LIKE ? OR
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
      query += ` AND sm.ticket_status = ?`;
      params.push(status.trim());
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

// GET /api/service-memos/:id - Single memo with ticket join
router.get('/service-memos/:id', async (req, res) => {
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
router.post('/service-memos', async (req, res) => {
  try {
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
      return res.status(400).json({
        success: false,
        message: 'Authentication required: missing user email (X-User-Email).',
      });
    }

    if (!ticket_id) {
      return res.status(400).json({ success: false, message: 'Ticket ID is required.' });
    }

    const v = validateMemoPayload(body);
    if (!v.ok) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${v.missing.join(', ')}`,
        missing: v.missing,
      });
    }

    const [ticketRows] = await pool.execute(`SELECT status FROM aleco_tickets WHERE ticket_id = ?`, [ticket_id]);

    if (ticketRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    const ticketStatus = ticketRows[0].status;
    const closedStatuses = ['Restored', 'Unresolved', 'NoFaultFound', 'AccessDenied'];

    if (!closedStatuses.includes(ticketStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Service memo can only be created for closed tickets.',
      });
    }

    const [existingMemo] = await pool.execute(`SELECT id FROM aleco_service_memos WHERE ticket_id = ?`, [ticket_id]);

    if (existingMemo.length > 0) {
      return res.status(400).json({ success: false, message: 'Service memo already exists for this ticket.' });
    }

    const controlNumber = await generateControlNumber();
    const intakeDate = intake_date || service_date || new Date().toISOString().split('T')[0];
    const actionText = (action_taken || work_performed || '').trim();

    const extPayload = buildExtendedFromBody(body);
    const internalNotesValue = stringifyExtended(extPayload);

    const [result] = await pool.execute(
      `INSERT INTO aleco_service_memos 
            (ticket_id, ticket_status, control_number, service_date, work_performed, resolution_details, internal_notes, received_by, referred_to, owner_email, owner_name, memo_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'saved')`,
      [
        ticket_id,
        ticketStatus,
        controlNumber,
        intakeDate,
        actionText,
        resolution_details != null ? resolution_details : null,
        internalNotesValue,
        (received_by || '').trim(),
        (referred_to || '').trim(),
        currentUserEmail.trim(),
        currentUser.trim() || '—',
      ]
    );

    await pool.execute(`UPDATE aleco_tickets SET service_memo_id = ? WHERE ticket_id = ?`, [result.insertId, ticket_id]);

    console.log(`✅ Service Memo Created: ID ${result.insertId}, Control #${controlNumber} for Ticket ${ticket_id}`);
    res.json({ success: true, data: { id: result.insertId, control_number: controlNumber } });
  } catch (error) {
    console.error('❌ Service Memo Creation Error:', error);
    res.status(500).json({ success: false, message: 'Failed to create service memo.' });
  }
});

// PUT /api/service-memos/:id - Update service memo
router.put('/service-memos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const currentUserEmail = getActorEmail(req);

    const [memoRows] = await pool.execute(`SELECT * FROM aleco_service_memos WHERE id = ?`, [id]);

    if (memoRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Service memo not found.' });
    }

    const memo = memoRows[0];

    if (memo.owner_email !== currentUserEmail) {
      return res.status(403).json({ success: false, message: 'You do not have permission to edit this service memo.' });
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

    if (body.memo_status !== undefined) {
      if (memo.memo_status === 'draft' && body.memo_status === 'saved') {
        updateFields.push('memo_status = ?');
        updateParams.push(body.memo_status);
      } else if (memo.memo_status !== body.memo_status) {
        return res.status(400).json({ success: false, message: 'Invalid status transition.' });
      }
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

    updateParams.push(id);

    const query = `UPDATE aleco_service_memos SET ${updateFields.join(', ')} WHERE id = ?`;
    await pool.execute(query, updateParams);

    console.log(`✅ Service Memo Updated: ID ${id}`);
    res.json({ success: true, message: 'Service memo updated successfully.' });
  } catch (error) {
    console.error('❌ Service Memo Update Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update service memo.' });
  }
});

// PUT /api/service-memos/:id/close - Close service memo
router.put('/service-memos/:id/close', async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserEmail = getActorEmail(req);

    const [memoRows] = await pool.execute(`SELECT * FROM aleco_service_memos WHERE id = ?`, [id]);

    if (memoRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Service memo not found.' });
    }

    const memo = memoRows[0];

    if (memo.owner_email !== currentUserEmail) {
      return res.status(403).json({ success: false, message: 'You do not have permission to close this service memo.' });
    }

    if (memo.memo_status !== 'saved') {
      return res.status(400).json({ success: false, message: 'Can only close a saved service memo.' });
    }

    await pool.execute(`UPDATE aleco_service_memos SET memo_status = 'closed', closed_at = NOW() WHERE id = ?`, [id]);

    console.log(`✅ Service Memo Closed: ID ${id}`);
    res.json({ success: true, message: 'Service memo closed successfully.' });
  } catch (error) {
    console.error('❌ Service Memo Close Error:', error);
    res.status(500).json({ success: false, message: 'Failed to close service memo.' });
  }
});

// DELETE /api/service-memos/:id - Delete service memo
router.delete('/service-memos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserEmail = getActorEmail(req);

    const [memoRows] = await pool.execute(`SELECT * FROM aleco_service_memos WHERE id = ?`, [id]);

    if (memoRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Service memo not found.' });
    }

    const memo = memoRows[0];

    if (memo.owner_email !== currentUserEmail) {
      return res.status(403).json({ success: false, message: 'You do not have permission to delete this service memo.' });
    }

    if (memo.memo_status === 'saved' || memo.memo_status === 'closed') {
      return res.status(400).json({ success: false, message: 'Can only delete draft service memos.' });
    }

    await pool.execute(`UPDATE aleco_tickets SET service_memo_id = NULL WHERE ticket_id = ?`, [memo.ticket_id]);

    await pool.execute(`DELETE FROM aleco_service_memos WHERE id = ?`, [id]);

    console.log(`✅ Service Memo Deleted: ID ${id}`);
    res.json({ success: true, message: 'Service memo deleted successfully.' });
  } catch (error) {
    console.error('❌ Service Memo Delete Error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete service memo.' });
  }
});

export default router;
