import express from 'express';
import pool from '../config/db.js';

const router = express.Router();

// ============================================================================
// TICKET GROUPING SYSTEM
// Purpose: Group similar tickets under a single "Main Ticket ID" for unified resolution
// Uses existing parent_ticket_id column in aleco_tickets table
// ============================================================================

/**
 * CREATE TICKET GROUP
 * Generates a main ticket ID and links all selected tickets to it using parent_ticket_id
 * POST /api/tickets/group/create
 */
router.post('/tickets/group/create', async (req, res) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { title, category, remarks, ticketIds } = req.body;

        // Validation
        if (!ticketIds || ticketIds.length < 2) {
            return res.status(400).json({
                success: false,
                message: 'At least 2 tickets are required to create a group'
            });
        }

        if (!category) {
            return res.status(400).json({
                success: false,
                message: 'Category is required'
            });
        }

        // Generate Main Ticket ID (Format: GROUP-YYYYMMDD-XXXX)
        const date = new Date();
        const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

        // Get the next group number for today
        const [existingGroups] = await connection.execute(
            `SELECT ticket_id FROM aleco_tickets
             WHERE ticket_id LIKE ?
             ORDER BY ticket_id DESC LIMIT 1`,
            [`GROUP-${dateStr}-%`]
        );

        let groupNumber = 1;
        if (existingGroups.length > 0) {
            const lastId = existingGroups[0].ticket_id;
            const lastNumber = parseInt(lastId.split('-')[2]);
            groupNumber = lastNumber + 1;
        }

        const mainTicketId = `GROUP-${dateStr}-${String(groupNumber).padStart(4, '0')}`;

        // Create a master ticket record for the group
        const createdAt = new Date().toISOString().slice(0, 19).replace('T', ' ');

        // Get info from first ticket for the master record
        const [firstTicket] = await connection.execute(
            `SELECT * FROM aleco_tickets WHERE ticket_id = ? LIMIT 1`,
            [ticketIds[0]]
        );

        if (firstTicket.length === 0) {
            throw new Error('First ticket not found');
        }

        const ticket = firstTicket[0];

        // Insert master ticket
        await connection.execute(
            `INSERT INTO aleco_tickets
             (ticket_id, first_name, last_name, phone_number, address, category, concern,
              district, municipality, status, created_at, remarks, is_urgent)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, 0)`,
            [
                mainTicketId,
                'GROUP',
                'MASTER',
                ticket.phone_number,
                title || `Grouped Incident - ${category}`,
                category,
                `Master ticket for ${ticketIds.length} grouped incidents. ${remarks || ''}`,
                ticket.district,
                ticket.municipality,
                createdAt,
                remarks || `Grouped ${ticketIds.length} tickets`
            ]
        );

        // Update all child tickets to link to this master ticket
        const ticketPlaceholders = ticketIds.map(() => '?').join(', ');
        await connection.execute(
            `UPDATE aleco_tickets
             SET parent_ticket_id = ?
             WHERE ticket_id IN (${ticketPlaceholders})`,
            [mainTicketId, ...ticketIds]
        );

        await connection.commit();

        console.log(`✅ TICKET GROUP CREATED: ${mainTicketId} with ${ticketIds.length} tickets`);

        res.json({
            success: true,
            mainTicketId,
            message: `Successfully grouped ${ticketIds.length} tickets under ${mainTicketId}`
        });

    } catch (error) {
        await connection.rollback();
        console.error("❌ Error creating ticket group:", error);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        connection.release();
    }
});

/**
 * GET ALL TICKET GROUPS
 * Returns all ticket groups with their member tickets
 * GET /api/tickets/groups
 */
router.get('/tickets/groups', async (req, res) => {
    try {
        // Get all master tickets (groups)
        const [groups] = await pool.execute(
            `SELECT * FROM aleco_tickets
             WHERE ticket_id LIKE 'GROUP-%'
             ORDER BY created_at DESC`
        );

        // Get all child tickets for each group
        const groupsWithMembers = await Promise.all(
            groups.map(async (group) => {
                const [members] = await pool.execute(
                    `SELECT * FROM aleco_tickets
                     WHERE parent_ticket_id = ?`,
                    [group.ticket_id]
                );

                return {
                    ...group,
                    ticket_count: members.length,
                    tickets: members
                };
            })
        );

        res.json({ success: true, data: groupsWithMembers });

    } catch (error) {
        console.error("❌ Error fetching ticket groups:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * UPDATE GROUP STATUS
 * Updates the status of a ticket group and all its member tickets
 * PUT /api/tickets/group/:mainTicketId/status
 */
router.put('/tickets/group/:mainTicketId/status', async (req, res) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { mainTicketId } = req.params;
        const { status } = req.body; // 'Ongoing', 'Restored', or 'Unresolved'

        // Match the actual enum values in the database
        if (!['Pending', 'Ongoing', 'Restored', 'Unresolved'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be Pending, Ongoing, Restored, or Unresolved'
            });
        }

        // Update the master ticket status
        await connection.execute(
            `UPDATE aleco_tickets SET status = ? WHERE ticket_id = ?`,
            [status, mainTicketId]
        );

        // Get all child tickets
        const [members] = await connection.execute(
            `SELECT ticket_id FROM aleco_tickets WHERE parent_ticket_id = ?`,
            [mainTicketId]
        );

        // Update all child tickets to the same status
        if (members.length > 0) {
            const ticketIds = members.map(m => m.ticket_id);
            const placeholders = ticketIds.map(() => '?').join(', ');

            await connection.execute(
                `UPDATE aleco_tickets SET status = ? WHERE ticket_id IN (${placeholders})`,
                [status, ...ticketIds]
            );
        }

        await connection.commit();

        console.log(`✅ GROUP STATUS UPDATED: ${mainTicketId} → ${status} (${members.length} tickets)`);

        res.json({
            success: true,
            message: `Group ${mainTicketId} and ${members.length} tickets updated to ${status}`
        });

    } catch (error) {
        await connection.rollback();
        console.error("❌ Error updating group status:", error);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        connection.release();
    }
});

/**
 * BULK RESTORE TICKETS
 * Marks multiple tickets as Restored (using correct enum value)
 * PUT /api/tickets/bulk/restore
 */
router.put('/tickets/bulk/restore', async (req, res) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { ticketIds } = req.body;

        if (!ticketIds || ticketIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No tickets provided'
            });
        }

        const placeholders = ticketIds.map(() => '?').join(', ');

        // Use 'Restored' instead of 'Resolved' to match the enum
        await connection.execute(
            `UPDATE aleco_tickets SET status = 'Restored' WHERE ticket_id IN (${placeholders})`,
            ticketIds
        );

        await connection.commit();

        console.log(`✅ BULK RESTORE: ${ticketIds.length} tickets marked as Restored`);

        res.json({
            success: true,
            message: `${ticketIds.length} tickets marked as Restored`
        });

    } catch (error) {
        await connection.rollback();
        console.error("❌ Error bulk restoring tickets:", error);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        connection.release();
    }
});

export default router;

