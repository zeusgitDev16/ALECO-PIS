import express from 'express';
import pool from '../config/db.js';
import { sendPhilSMS } from '../utils/sms.js';
import { insertTicketLog } from '../utils/ticketLogHelper.js';
import { nowPhilippineForMysql } from '../utils/dateTimeUtils.js';
import { mapTicketRowToDto } from '../utils/ticketDto.js';
import { requireStaff } from '../middleware/requireRole.js';
import { normalizeExpectedUpdatedAt } from '../utils/concurrencyControl.js';

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
router.post('/tickets/group/create', requireStaff, async (req, res) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { title, category, remarks, ticketIds, group_type, visit_order } = req.body;

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

        // Validate no ticket is already in a group
        const [alreadyGrouped] = await connection.execute(
            `SELECT ticket_id FROM aleco_tickets WHERE ticket_id IN (${ticketIds.map(() => '?').join(', ')}) AND parent_ticket_id IS NOT NULL`,
            ticketIds
        );
        if (alreadyGrouped.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Ticket(s) already in a group: ${alreadyGrouped.map(r => r.ticket_id).join(', ')}. Ungroup first.`
            });
        }

        const effectiveGroupType = group_type === 'routing_batch' ? 'routing_batch' : 'similar_incident';

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
        const createdAt = nowPhilippineForMysql();

        // Get info from first ticket for the master record
        const [firstTicket] = await connection.execute(
            `SELECT * FROM aleco_tickets WHERE ticket_id = ? LIMIT 1`,
            [ticketIds[0]]
        );

        if (firstTicket.length === 0) {
            throw new Error('First ticket not found');
        }

        const ticket = firstTicket[0];

        // Insert master ticket (with group_type)
        await connection.execute(
            `INSERT INTO aleco_tickets
             (ticket_id, first_name, last_name, phone_number, address, category, concern,
              district, municipality, status, created_at, remarks, is_urgent, group_type)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, 0, ?)`,
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
                remarks || `Grouped ${ticketIds.length} tickets`,
                effectiveGroupType
            ]
        );

        // Build visit_order map: ticketId -> order (1, 2, 3...)
        const orderMap = {};
        const orderedIds = Array.isArray(visit_order) && visit_order.length === ticketIds.length
            ? visit_order
            : ticketIds;
        orderedIds.forEach((id, idx) => { orderMap[id] = idx + 1; });

        // Update all child tickets: parent_ticket_id and visit_order (for routing_batch)
        for (const tid of ticketIds) {
            const vo = effectiveGroupType === 'routing_batch' ? (orderMap[tid] || null) : null;
            await connection.execute(
                `UPDATE aleco_tickets SET parent_ticket_id = ?, visit_order = ? WHERE ticket_id = ?`,
                [mainTicketId, vo, tid]
            );
        }

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
router.get('/tickets/groups', requireStaff, async (req, res) => {
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
                    ...mapTicketRowToDto(group),
                    ticket_count: members.length,
                    tickets: members.map(mapTicketRowToDto)
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
 * GET SINGLE TICKET GROUP
 * Returns the group master with its children (for detail pane when viewing a parent)
 * GET /api/tickets/group/:mainTicketId
 */
router.get('/tickets/group/:mainTicketId', requireStaff, async (req, res) => {
    const { mainTicketId } = req.params;

    if (!mainTicketId || !mainTicketId.startsWith('GROUP-')) {
        return res.status(400).json({
            success: false,
            message: 'Invalid group ID'
        });
    }

    try {
        const [masterRows] = await pool.execute(
            `SELECT * FROM aleco_tickets WHERE ticket_id = ?`,
            [mainTicketId]
        );

        if (masterRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        const [children] = await pool.execute(
            `SELECT * FROM aleco_tickets WHERE parent_ticket_id = ? ORDER BY visit_order ASC, ticket_id ASC`,
            [mainTicketId]
        );

        const data = {
            ...mapTicketRowToDto(masterRows[0]),
            children: children.map(mapTicketRowToDto)
        };

        res.json({ success: true, data });

    } catch (error) {
        console.error("❌ Error fetching ticket group:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * UNGROUP
 * Dissolves a group: clears parent_ticket_id and visit_order for all children, deletes GROUP master
 * PUT /api/tickets/group/:mainTicketId/ungroup
 */
router.put('/tickets/group/:mainTicketId/ungroup', requireStaff, async (req, res) => {
    const { mainTicketId } = req.params;

    if (!mainTicketId || !mainTicketId.startsWith('GROUP-')) {
        return res.status(400).json({
            success: false,
            message: 'Invalid group ID'
        });
    }

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // Read master's current status and children's current statuses for audit log
        const [masterRows] = await connection.execute(
            `SELECT status, updated_at FROM aleco_tickets WHERE ticket_id = ?`,
            [mainTicketId]
        );
        if (masterRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Group not found.' });
        }
        const masterStatus = masterRows[0].status;
        const masterUpdatedAt = masterRows[0].updated_at;

        const expectedUpdatedAt = normalizeExpectedUpdatedAt(req.body?.expected_updated_at ?? req.body?.expectedUpdatedAt);
        if (expectedUpdatedAt) {
            const dbIso = masterUpdatedAt ? new Date(masterUpdatedAt).toISOString() : '';
            let clientIso = '';
            try { clientIso = new Date(expectedUpdatedAt).toISOString(); } catch { /* invalid */ }
            if (!dbIso || dbIso !== clientIso) {
                await connection.rollback();
                return res.status(409).json({
                    success: false,
                    code: 'CONFLICT_STALE_TICKET',
                    message: 'This group was updated by someone else. Reload and try again.',
                    latest: { ticket_id: mainTicketId, updated_at: masterUpdatedAt },
                });
            }
        }

        const [childRows] = await connection.execute(
            `SELECT ticket_id, status FROM aleco_tickets WHERE parent_ticket_id = ?`,
            [mainTicketId]
        );

        // Sync children's status to master's current status, then unlink them
        const [result] = await connection.execute(
            `UPDATE aleco_tickets SET status = ?, parent_ticket_id = NULL, visit_order = NULL WHERE parent_ticket_id = ?`,
            [masterStatus, mainTicketId]
        );

        // Delete the GROUP master record
        await connection.execute(
            `DELETE FROM aleco_tickets WHERE ticket_id = ?`,
            [mainTicketId]
        );

        await connection.commit();

        const actorEmail = req.body?.actor_email || req.headers['x-user-email'];
        const actorName = req.body?.actor_name || req.headers['x-user-name'];
        for (const child of childRows) {
            if (child.status !== masterStatus) {
                await insertTicketLog(pool, {
                    ticket_id: child.ticket_id,
                    action: 'status_change',
                    from_status: child.status,
                    to_status: masterStatus,
                    actor_type: actorEmail || actorName ? 'dispatcher' : 'system',
                    actor_email: actorEmail || null,
                    actor_name: actorName || 'System',
                    metadata: { reason: 'ungroup_status_sync', main_ticket_id: mainTicketId }
                });
            }
        }

        const affected = result.affectedRows || 0;
        console.log(`✅ UNGROUP: ${mainTicketId} - ${affected} tickets ungrouped, status synced to "${masterStatus}"`);

        res.json({
            success: true,
            message: `Group dissolved. ${affected} tickets ungrouped with status "${masterStatus}".`,
            ungroupedCount: affected
        });
    } catch (error) {
        await connection.rollback();
        console.error('❌ Ungroup error:', error);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        connection.release();
    }
});

/**
 * DISPATCH WHOLE GROUP
 * Dispatches same crew/ETA/notes to all child tickets in the group
 * PUT /api/tickets/group/:mainTicketId/dispatch
 */
router.put('/tickets/group/:mainTicketId/dispatch', requireStaff, async (req, res) => {
    const { mainTicketId } = req.params;
    const { assigned_crew, eta, is_consumer_notified, dispatch_notes } = req.body;

    if (!assigned_crew || !eta) {
        return res.status(400).json({
            success: false,
            message: 'assigned_crew and eta are required'
        });
    }

    try {
        const [masterRows] = await pool.execute(
            `SELECT group_type, updated_at FROM aleco_tickets WHERE ticket_id = ?`,
            [mainTicketId]
        );
        const groupType = masterRows[0]?.group_type || 'similar_incident';

        const expectedUpdatedAt = normalizeExpectedUpdatedAt(req.body?.expected_updated_at ?? req.body?.expectedUpdatedAt);
        if (expectedUpdatedAt && masterRows[0]) {
            const masterUpdatedAt = masterRows[0].updated_at;
            const dbIso = masterUpdatedAt ? new Date(masterUpdatedAt).toISOString() : '';
            let clientIso = '';
            try { clientIso = new Date(expectedUpdatedAt).toISOString(); } catch { /* invalid */ }
            if (!dbIso || dbIso !== clientIso) {
                return res.status(409).json({
                    success: false,
                    code: 'CONFLICT_STALE_TICKET',
                    message: 'This group was updated by someone else. Reload and try again.',
                    latest: { ticket_id: mainTicketId, updated_at: masterUpdatedAt },
                });
            }
        }

        const [members] = await pool.execute(
            `SELECT ticket_id, phone_number, visit_order FROM aleco_tickets WHERE parent_ticket_id = ? AND status IN ('Pending', 'Unresolved')`,
            [mainTicketId]
        );

        if (members.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No Pending or Unresolved tickets in this group'
            });
        }

        const [contactData] = await pool.execute(
            `SELECT phone_number FROM aleco_personnel WHERE crew_name = ?`,
            [assigned_crew]
        );

        if (contactData.length === 0 || !contactData[0].phone_number) {
            return res.status(400).json({
                success: false,
                message: `Crew ${assigned_crew} has no registered phone number.`
            });
        }

        const linemanPhone = contactData[0].phone_number;

        // Sort by visit_order for routing groups
        const sortedMembers = groupType === 'routing_batch'
            ? [...members].sort((a, b) => (a.visit_order || 999) - (b.visit_order || 999))
            : members;

        // Single SMS to lineman for the whole group
        const ticketList = sortedMembers.map(m => m.ticket_id).join(', ');
        const linemanMsg = `Hi crew ${assigned_crew}, your assigned ticket is ${mainTicketId}

keywords to reply (per ticket):
{ticket_id} fixed | unfixed | nofault | nores
Tickets: ${ticketList}

or bulk: all fixed | all unfixed | all nofault | all nores

keep safe!`;
        const linemanSmsResult = await sendPhilSMS(linemanPhone, linemanMsg);
        if (!linemanSmsResult.success) {
            console.log(`❌ Group lineman SMS failed for ${mainTicketId}; no tickets updated.`);
            return res.status(502).json({
                success: false,
                message:
                    'Crew dispatch SMS could not be sent. No tickets in the group were updated. Check PhilSMS (API key, URL, sender ID) and server logs.',
                sms: { lineman: linemanSmsResult }
            });
        }

        const consumerSmsResults = [];

        for (const member of sortedMembers) {
            if (is_consumer_notified && member.phone_number) {
                const consumerMsg = `Greetings! This is from ALECO! Your ticket ${member.ticket_id} is currently grouped. Master ticket id is ${mainTicketId} and is now being processed. Please be in touch or visit our website to track your ticket and for follow ups.

You can enter these tickets to track:
${member.ticket_id}
${mainTicketId}`;
                const consumerResult = await sendPhilSMS(member.phone_number, consumerMsg);
                consumerSmsResults.push({ ticket_id: member.ticket_id, attempted: true, ...consumerResult });
                if (!consumerResult.success) {
                    console.warn(`⚠️ Group consumer SMS failed for ${member.ticket_id}:`, consumerResult);
                }
            } else {
                consumerSmsResults.push({
                    ticket_id: member.ticket_id,
                    attempted: false,
                    skipped: true,
                    reason: is_consumer_notified ? 'no_phone_on_ticket' : 'not_requested'
                });
            }

            const phNow = nowPhilippineForMysql();
            await pool.execute(
                `UPDATE aleco_tickets
                 SET status = 'Ongoing', assigned_crew = ?, eta = ?, is_consumer_notified = ?, dispatch_notes = ?, concern_resolution_notes = NULL, dispatched_at = ?
                 WHERE ticket_id = ?`,
                [assigned_crew, eta, is_consumer_notified ? 1 : 0, dispatch_notes || '', phNow, member.ticket_id]
            );
            const actorEmail = req.body.actor_email || req.headers['x-user-email'];
            const actorName = req.body.actor_name || req.headers['x-user-name'];
            await insertTicketLog(pool, {
                ticket_id: member.ticket_id,
                action: 'group_dispatch',
                from_status: 'Pending',
                to_status: 'Ongoing',
                actor_type: actorEmail || actorName ? 'dispatcher' : 'system',
                actor_email: actorEmail || null,
                actor_name: actorName || 'System',
                metadata: { assigned_crew, eta, dispatch_notes: dispatch_notes || null, main_ticket_id: mainTicketId }
            });
        }

        console.log(`✅ GROUP DISPATCH: ${mainTicketId} - ${members.length} tickets dispatched to ${assigned_crew}`);
        const total = consumerSmsResults.length;
        const attempted = consumerSmsResults.filter(r => r.attempted).length;
        const successCount = consumerSmsResults.filter(r => r.attempted && r.success).length;
        const failedCount = consumerSmsResults.filter(r => r.attempted && !r.success).length;
        const noPhoneCount = consumerSmsResults.filter(r => r.reason === 'no_phone_on_ticket').length;
        const notRequested = consumerSmsResults.filter(r => r.reason === 'not_requested').length;

        let groupMsg;
        if (notRequested === total) {
            groupMsg = `${members.length} ticket(s) dispatched to ${assigned_crew}. Crew notified by SMS.`;
        } else if (attempted === 0) {
            groupMsg = noPhoneCount === total && total > 0
                ? `${members.length} ticket(s) dispatched. Crew notified. All consumers have no phone on file.`
                : `${members.length} ticket(s) dispatched to ${assigned_crew}. Crew notified by SMS.`;
        } else if (successCount === attempted) {
            groupMsg = `${members.length} ticket(s) dispatched. Crew and all ${successCount} consumer(s) notified by SMS.`;
        } else {
            const parts = [`${members.length} ticket(s) dispatched. Crew notified.`];
            if (successCount > 0) parts.push(`${successCount} consumer(s) notified.`);
            if (failedCount > 0) parts.push(`${failedCount} consumer(s) could not be reached.`);
            if (noPhoneCount > 0) parts.push(`${noPhoneCount} consumer(s) have no phone.`);
            groupMsg = parts.join(' ');
        }

        const consumerAnyFailed = failedCount > 0;
        res.json({
            success: true,
            message: groupMsg,
            dispatchedCount: members.length,
            sms: {
                lineman: { success: true },
                consumers: consumerSmsResults
            },
            ...(consumerAnyFailed ? { warnings: ['consumer_sms_failed'] } : {})
        });
    } catch (error) {
        console.error('❌ Group dispatch error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * UPDATE GROUP STATUS
 * Updates the status of a ticket group and all its member tickets
 * PUT /api/tickets/group/:mainTicketId/status
 */
router.put('/tickets/group/:mainTicketId/status', requireStaff, async (req, res) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { mainTicketId } = req.params;
        const { status } = req.body;

        // Match the actual enum values in the database
        if (!['Pending', 'Ongoing', 'OnHold', 'Restored', 'Unresolved', 'NoFaultFound', 'AccessDenied'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be Pending, Ongoing, On Hold, Restored, Unresolved, NoFaultFound, or AccessDenied'
            });
        }

        // Get current statuses before update
        const [statusRows] = await connection.execute(
            `SELECT ticket_id, status, updated_at FROM aleco_tickets WHERE ticket_id = ? OR parent_ticket_id = ?`,
            [mainTicketId, mainTicketId]
        );
        const statusMap = Object.fromEntries(statusRows.map(r => [r.ticket_id, r.status]));

        const masterRow = statusRows.find(r => r.ticket_id === mainTicketId);
        const expectedUpdatedAt = normalizeExpectedUpdatedAt(req.body?.expected_updated_at ?? req.body?.expectedUpdatedAt);
        if (expectedUpdatedAt && masterRow) {
            const dbIso = masterRow.updated_at ? new Date(masterRow.updated_at).toISOString() : '';
            let clientIso = '';
            try { clientIso = new Date(expectedUpdatedAt).toISOString(); } catch { /* invalid */ }
            if (!dbIso || dbIso !== clientIso) {
                await connection.rollback();
                return res.status(409).json({
                    success: false,
                    code: 'CONFLICT_STALE_TICKET',
                    message: 'This group was updated by someone else. Reload and try again.',
                    latest: { ticket_id: mainTicketId, updated_at: masterRow.updated_at },
                });
            }
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
        const allTicketIds = [mainTicketId, ...members.map(m => m.ticket_id)];
        if (members.length > 0) {
            const ticketIds = members.map(m => m.ticket_id);
            const placeholders = ticketIds.map(() => '?').join(', ');

            await connection.execute(
                `UPDATE aleco_tickets SET status = ? WHERE ticket_id IN (${placeholders})`,
                [status, ...ticketIds]
            );
        }

        await connection.commit();

        const actorEmail = req.body.actor_email || req.headers['x-user-email'];
        const actorName = req.body.actor_name || req.headers['x-user-name'];
        for (const tid of allTicketIds) {
            const fromStatus = statusMap[tid] || null;
            await insertTicketLog(pool, {
                ticket_id: tid,
                action: 'status_change',
                from_status: fromStatus,
                to_status: status,
                actor_type: actorEmail || actorName ? 'dispatcher' : 'system',
                actor_email: actorEmail || null,
                actor_name: actorName || 'System',
                metadata: { group_update: true, main_ticket_id: mainTicketId }
            });
        }

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
router.put('/tickets/bulk/restore', requireStaff, async (req, res) => {
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

        const [statusRows] = await connection.execute(
            `SELECT ticket_id, status FROM aleco_tickets WHERE ticket_id IN (${placeholders})`,
            ticketIds
        );
        const statusMap = Object.fromEntries(statusRows.map(r => [r.ticket_id, r.status]));

        // Use 'Restored' instead of 'Resolved' to match the enum
        await connection.execute(
            `UPDATE aleco_tickets SET status = 'Restored' WHERE ticket_id IN (${placeholders})`,
            ticketIds
        );

        await connection.commit();

        const actorEmail = req.body.actor_email || req.headers['x-user-email'];
        const actorName = req.body.actor_name || req.headers['x-user-name'];
        for (const tid of ticketIds) {
            await insertTicketLog(pool, {
                ticket_id: tid,
                action: 'bulk_restore',
                from_status: statusMap[tid] || null,
                to_status: 'Restored',
                actor_type: actorEmail || actorName ? 'dispatcher' : 'system',
                actor_email: actorEmail || null,
                actor_name: actorName || 'System',
                metadata: { bulk: true }
            });
        }

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

