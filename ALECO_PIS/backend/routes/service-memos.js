import express from 'express';
import pool from '../config/db.js';

const router = express.Router();

// Helper function to generate control number (SM-YYYY-XXXX format)
async function generateControlNumber() {
    const year = new Date().getFullYear();
    try {
        // Get the highest control number for the current year
        const [rows] = await pool.execute(
            `SELECT control_number FROM aleco_service_memos WHERE control_number LIKE ? ORDER BY control_number DESC LIMIT 1`,
            [`SM-${year}-%`]
        );

        let nextNumber = 1;
        if (rows.length > 0) {
            const lastNumber = parseInt(rows[0].control_number.split('-')[2]);
            nextNumber = lastNumber + 1;
        }

        // Pad with leading zeros (4 digits)
        const paddedNumber = String(nextNumber).padStart(4, '0');
        return `SM-${year}-${paddedNumber}`;
    } catch (error) {
        console.error("❌ Control Number Generation Error:", error);
        // Fallback to timestamp-based number
        return `SM-${year}-${Date.now().toString().slice(-4)}`;
    }
}

// GET /api/service-memos - Fetch service memos with filters
router.get('/service-memos', async (req, res) => {
    try {
        const {
            tab = 'all',
            search,
            status,
            startDate,
            endDate,
            owner
        } = req.query;

        const currentUserEmail = req.headers['user-email'] || null;

        let query = `
            SELECT 
                sm.*,
                t.ticket_id,
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
                t.status as ticket_status,
                t.assigned_crew,
                t.dispatched_at
            FROM aleco_service_memos sm
            LEFT JOIN aleco_tickets t ON sm.ticket_id = t.ticket_id
            WHERE 1=1
        `;
        const params = [];

        // Tab filter: draft/saved/closed (owner's memos only) or all (all memos)
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
        // 'all' tab shows all memos regardless of status

        // Search filter (ticket ID, customer name)
        if (search && search.trim()) {
            const searchWildcard = `%${search.trim()}%`;
            query += ` AND (
                sm.ticket_id LIKE ? OR
                t.first_name LIKE ? OR
                t.last_name LIKE ? OR
                CONCAT(t.first_name, ' ', t.last_name) LIKE ?
            )`;
            params.push(searchWildcard, searchWildcard, searchWildcard, searchWildcard);
        }

        // Status filter (ticket status)
        if (status && status.trim()) {
            query += ` AND sm.ticket_status = ?`;
            params.push(status.trim());
        }

        // Owner filter (only in 'all' tab)
        if (tab === 'all' && owner && owner.trim()) {
            query += ` AND sm.owner_email = ?`;
            params.push(owner.trim());
        }

        // Date range filter
        if (startDate && endDate) {
            query += ` AND DATE(sm.created_at) BETWEEN ? AND ?`;
            params.push(startDate, endDate);
        }

        query += ` ORDER BY sm.created_at DESC`;

        console.log('📋 Service Memos Query:', query);
        console.log('📋 With Params:', params);

        const [rows] = await pool.execute(query, params);

        console.log(`✅ Service Memos Fetched: ${rows.length} memos`);
        res.json({ success: true, data: rows });

    } catch (error) {
        console.error("❌ Service Memos Fetch Error:", error);
        res.status(500).json({ success: false, message: "Failed to fetch service memos." });
    }
});

// POST /api/service-memos - Create service memo manually
router.post('/service-memos', async (req, res) => {
    try {
        const {
            ticket_id,
            work_performed,
            resolution_details,
            internal_notes,
            service_date,
            received_by,
            referred_to
        } = req.body;

        const currentUserEmail = req.headers['user-email'] || null;
        const currentUser = req.headers['user-name'] || null;

        if (!ticket_id) {
            return res.status(400).json({ success: false, message: "Ticket ID is required." });
        }

        // Check if ticket exists and is in closed status
        const [ticketRows] = await pool.execute(
            `SELECT status FROM aleco_tickets WHERE ticket_id = ?`,
            [ticket_id]
        );

        if (ticketRows.length === 0) {
            return res.status(404).json({ success: false, message: "Ticket not found." });
        }

        const ticketStatus = ticketRows[0].status;
        const closedStatuses = ['Restored', 'Unresolved', 'NoFaultFound', 'AccessDenied'];

        if (!closedStatuses.includes(ticketStatus)) {
            return res.status(400).json({ success: false, message: "Service memo can only be created for closed tickets." });
        }

        // Check if memo already exists for this ticket
        const [existingMemo] = await pool.execute(
            `SELECT id FROM aleco_service_memos WHERE ticket_id = ?`,
            [ticket_id]
        );

        if (existingMemo.length > 0) {
            return res.status(400).json({ success: false, message: "Service memo already exists for this ticket." });
        }

        // Generate control number
        const controlNumber = await generateControlNumber();

        // Create service memo
        const [result] = await pool.execute(
            `INSERT INTO aleco_service_memos 
            (ticket_id, ticket_status, control_number, service_date, work_performed, resolution_details, internal_notes, received_by, referred_to, owner_email, owner_name)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [ticket_id, ticketStatus, controlNumber, service_date || new Date().toISOString().split('T')[0], work_performed || null, resolution_details || null, internal_notes || null, received_by || null, referred_to || null, currentUserEmail, currentUser]
        );

        // Update ticket with service_memo_id
        await pool.execute(
            `UPDATE aleco_tickets SET service_memo_id = ? WHERE ticket_id = ?`,
            [result.insertId, ticket_id]
        );

        console.log(`✅ Service Memo Created: ID ${result.insertId}, Control #${controlNumber} for Ticket ${ticket_id}`);
        res.json({ success: true, data: { id: result.insertId, control_number: controlNumber } });

    } catch (error) {
        console.error("❌ Service Memo Creation Error:", error);
        res.status(500).json({ success: false, message: "Failed to create service memo." });
    }
});

// PUT /api/service-memos/:id - Update service memo
router.put('/service-memos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            work_performed,
            resolution_details,
            internal_notes,
            memo_status,
            service_date,
            received_by,
            referred_to
        } = req.body;

        const currentUserEmail = req.headers['user-email'] || null;

        // Check if memo exists and belongs to current user
        const [memoRows] = await pool.execute(
            `SELECT * FROM aleco_service_memos WHERE id = ?`,
            [id]
        );

        if (memoRows.length === 0) {
            return res.status(404).json({ success: false, message: "Service memo not found." });
        }

        const memo = memoRows[0];

        // Permission check: only owner can edit
        if (memo.owner_email !== currentUserEmail) {
            return res.status(403).json({ success: false, message: "You do not have permission to edit this service memo." });
        }

        // Can only edit if memo is in draft or saved status
        if (memo.memo_status === 'closed') {
            return res.status(400).json({ success: false, message: "Cannot edit a closed service memo." });
        }

        // Update memo
        const updateFields = [];
        const updateParams = [];

        if (work_performed !== undefined) {
            updateFields.push('work_performed = ?');
            updateParams.push(work_performed);
        }
        if (resolution_details !== undefined) {
            updateFields.push('resolution_details = ?');
            updateParams.push(resolution_details);
        }
        if (internal_notes !== undefined) {
            updateFields.push('internal_notes = ?');
            updateParams.push(internal_notes);
        }
        if (memo_status !== undefined) {
            // Only allow transition from draft to saved
            if (memo.memo_status === 'draft' && memo_status === 'saved') {
                updateFields.push('memo_status = ?');
                updateParams.push(memo_status);
            } else if (memo.memo_status !== memo_status) {
                return res.status(400).json({ success: false, message: "Invalid status transition." });
            }
        }
        if (service_date !== undefined) {
            updateFields.push('service_date = ?');
            updateParams.push(service_date);
        }
        if (received_by !== undefined) {
            updateFields.push('received_by = ?');
            updateParams.push(received_by);
        }
        if (referred_to !== undefined) {
            updateFields.push('referred_to = ?');
            updateParams.push(referred_to);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ success: false, message: "No valid fields to update." });
        }

        updateParams.push(id);

        const query = `UPDATE aleco_service_memos SET ${updateFields.join(', ')} WHERE id = ?`;
        await pool.execute(query, updateParams);

        console.log(`✅ Service Memo Updated: ID ${id}`);
        res.json({ success: true, message: "Service memo updated successfully." });

    } catch (error) {
        console.error("❌ Service Memo Update Error:", error);
        res.status(500).json({ success: false, message: "Failed to update service memo." });
    }
});

// PUT /api/service-memos/:id/close - Close service memo
router.put('/service-memos/:id/close', async (req, res) => {
    try {
        const { id } = req.params;
        const currentUserEmail = req.headers['user-email'] || null;

        // Check if memo exists and belongs to current user
        const [memoRows] = await pool.execute(
            `SELECT * FROM aleco_service_memos WHERE id = ?`,
            [id]
        );

        if (memoRows.length === 0) {
            return res.status(404).json({ success: false, message: "Service memo not found." });
        }

        const memo = memoRows[0];

        // Permission check: only owner can close
        if (memo.owner_email !== currentUserEmail) {
            return res.status(403).json({ success: false, message: "You do not have permission to close this service memo." });
        }

        // Can only close if memo is in saved status
        if (memo.memo_status !== 'saved') {
            return res.status(400).json({ success: false, message: "Can only close a saved service memo." });
        }

        // Close memo
        await pool.execute(
            `UPDATE aleco_service_memos SET memo_status = 'closed', closed_at = NOW() WHERE id = ?`,
            [id]
        );

        console.log(`✅ Service Memo Closed: ID ${id}`);
        res.json({ success: true, message: "Service memo closed successfully." });

    } catch (error) {
        console.error("❌ Service Memo Close Error:", error);
        res.status(500).json({ success: false, message: "Failed to close service memo." });
    }
});

// DELETE /api/service-memos/:id - Delete service memo
router.delete('/service-memos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const currentUserEmail = req.headers['user-email'] || null;

        // Check if memo exists and belongs to current user
        const [memoRows] = await pool.execute(
            `SELECT * FROM aleco_service_memos WHERE id = ?`,
            [id]
        );

        if (memoRows.length === 0) {
            return res.status(404).json({ success: false, message: "Service memo not found." });
        }

        const memo = memoRows[0];

        // Permission check: only owner can delete
        if (memo.owner_email !== currentUserEmail) {
            return res.status(403).json({ success: false, message: "You do not have permission to delete this service memo." });
        }

        // Cannot delete if memo is in saved or closed status
        if (memo.memo_status === 'saved' || memo.memo_status === 'closed') {
            return res.status(400).json({ success: false, message: "Can only delete draft service memos." });
        }

        // Update ticket to remove service_memo_id
        await pool.execute(
            `UPDATE aleco_tickets SET service_memo_id = NULL WHERE ticket_id = ?`,
            [memo.ticket_id]
        );

        // Delete memo
        await pool.execute(
            `DELETE FROM aleco_service_memos WHERE id = ?`,
            [id]
        );

        console.log(`✅ Service Memo Deleted: ID ${id}`);
        res.json({ success: true, message: "Service memo deleted successfully." });

    } catch (error) {
        console.error("❌ Service Memo Delete Error:", error);
        res.status(500).json({ success: false, message: "Failed to delete service memo." });
    }
});

export default router;
