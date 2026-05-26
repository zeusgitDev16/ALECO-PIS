import express from 'express';
import pool from '../config/db.js';
import { sendPhilSMS } from '../utils/sms.js';
import { insertTicketLog } from '../utils/ticketLogHelper.js';
import { nowPhilippineForMysql } from '../utils/dateTimeUtils.js';
import { mapTicketRowToDto } from '../utils/ticketDto.js';
import { requireStaff } from '../middleware/requireRole.js';
import { normalizeExpectedUpdatedAt } from '../utils/concurrencyControl.js';
import { syncCrewStatusByTicketId } from '../utils/crewStatusSync.js';

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

        if (masterStatus === 'Ongoing') {
            await connection.rollback();
            return res.status(400).json({ success: false, message: 'Cannot ungroup tickets while the group is currently Ongoing. Please resolve or hold the group first.' });
        }

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

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const [masterRows] = await connection.execute(
            `SELECT group_type, status, updated_at FROM aleco_tickets WHERE ticket_id = ?`,
            [mainTicketId]
        );
        if (masterRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Group not found.' });
        }
        const groupType = masterRows[0]?.group_type || 'similar_incident';
        const masterStatusBefore = masterRows[0]?.status || 'Pending';
        const masterUpdatedAt = masterRows[0]?.updated_at;

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

        const [members] = await connection.execute(
            `SELECT ticket_id, phone_number, visit_order, first_name, middle_name, last_name, address, concern, action_desired
             FROM aleco_tickets
             WHERE parent_ticket_id = ? AND status IN ('Pending', 'Unresolved')`,
            [mainTicketId]
        );

        if (members.length === 0) {
            await connection.rollback();
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
            await connection.rollback();
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

        // Single SMS to lineman for the whole group.
        // New template: deliver per-ticket details. Keyword reply flow has been retired.
        const buildMemberBlock = (m) => {
            const fullName = [m.first_name, m.middle_name, m.last_name]
                .filter((part) => part && String(part).trim() !== '')
                .join(' ');
            return `${m.ticket_id}
name of consumer: ${fullName || 'N/A'}
address: ${m.address || 'N/A'}
concern: ${m.concern || 'N/A'}
action desired: ${m.action_desired || 'N/A'}
phone number: ${m.phone_number || 'N/A'}`;
        };
        const memberDetails = sortedMembers.map(buildMemberBlock).join('\n\n');
        const linemanMsg = `Hi crew/linemen ${assigned_crew} this is your assigned tickets:

${memberDetails}

keep safe!`;
        const linemanSmsResult = await sendPhilSMS(linemanPhone, linemanMsg);
        if (!linemanSmsResult.success) {
            await connection.rollback();
            console.log(`❌ Group lineman SMS failed for ${mainTicketId}; no tickets updated.`);
            return res.status(502).json({
                success: false,
                message:
                    'Crew dispatch SMS could not be sent. No tickets in the group were updated. Check PhilSMS (API key, URL, sender ID) and server logs.',
                sms: { lineman: linemanSmsResult }
            });
        }

        const consumerSmsResults = [];
        const phNow = nowPhilippineForMysql();
        const actorEmail = req.body.actor_email || req.headers['x-user-email'];
        const actorName = req.body.actor_name || req.headers['x-user-name'];

        // Update master ticket status to Ongoing (with optimistic locking if expectedUpdatedAt provided)
        const masterWhereClause = expectedUpdatedAt && masterUpdatedAt ? 'ticket_id = ? AND updated_at = ?' : 'ticket_id = ?';
        const masterWhereParams = expectedUpdatedAt && masterUpdatedAt ? [mainTicketId, masterUpdatedAt] : [mainTicketId];
        const [masterUpdateResult] = await connection.execute(
            `UPDATE aleco_tickets
             SET status = 'Ongoing', assigned_crew = ?, eta = ?, is_consumer_notified = ?, dispatch_notes = ?, concern_resolution_notes = NULL, dispatched_at = ?
             WHERE ${masterWhereClause}`,
            [assigned_crew, eta, is_consumer_notified ? 1 : 0, dispatch_notes || '', phNow, ...masterWhereParams]
        );
        if (masterUpdateResult.affectedRows === 0 && expectedUpdatedAt) {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                code: 'CONFLICT_STALE_TICKET',
                message: 'This group was updated by someone else. Reload and try again.',
                latest: { ticket_id: mainTicketId, updated_at: masterUpdatedAt },
            });
        }

        // Log master ticket status change
        await insertTicketLog(pool, {
            ticket_id: mainTicketId,
            action: 'group_dispatch',
            from_status: masterStatusBefore,
            to_status: 'Ongoing',
            actor_type: actorEmail || actorName ? 'dispatcher' : 'system',
            actor_email: actorEmail || null,
            actor_name: actorName || 'System',
            metadata: { assigned_crew, eta, dispatch_notes: dispatch_notes || null, group_dispatch: true }
        });

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

            await connection.execute(
                `UPDATE aleco_tickets
                 SET status = 'Ongoing', assigned_crew = ?, eta = ?, is_consumer_notified = ?, dispatch_notes = ?, concern_resolution_notes = NULL, dispatched_at = ?
                 WHERE ticket_id = ?`,
                [assigned_crew, eta, is_consumer_notified ? 1 : 0, dispatch_notes || '', phNow, member.ticket_id]
            );
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

        await connection.commit();

        // Sync crew status after committing group dispatch
        await syncCrewStatusByTicketId(mainTicketId);

        console.log(`✅ GROUP DISPATCH: ${mainTicketId} - ${members.length} tickets + master dispatched to ${assigned_crew}`);
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
    } finally {
        connection.release();
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
        const { status, referred_to, accomplished_by } = req.body;
        // Accept both field names for compatibility with TicketDetailPane (sends `remarks`) and BulkResolveModal (sends `resolution_remarks`)
        const resolution_remarks = req.body.resolution_remarks || req.body.remarks || null;

        // Match the actual enum values in the database
        if (!['Pending', 'Ongoing', 'Restored', 'Unresolved', 'NoFaultFound', 'AccessDenied'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be Pending, Ongoing, Restored, Unresolved, NoFaultFound, or AccessDenied'
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

        // Resolution statuses that include accountability fields
        const resolutionStatuses = ['Restored', 'Unresolved', 'NoFaultFound', 'AccessDenied'];
        const isResolution = resolutionStatuses.includes(status);

        // Build master update query - include accountability fields for resolution statuses
        if (isResolution && (resolution_remarks || referred_to || accomplished_by)) {
            await connection.execute(
                `UPDATE aleco_tickets SET status = ?, resolution_remarks = ?, referred_to = ?, accomplished_by = ? WHERE ticket_id = ?`,
                [status, resolution_remarks || null, referred_to || null, accomplished_by || null, mainTicketId]
            );
        } else {
            await connection.execute(
                `UPDATE aleco_tickets SET status = ? WHERE ticket_id = ?`,
                [status, mainTicketId]
            );
        }

        // Get all child tickets
        const [members] = await connection.execute(
            `SELECT ticket_id FROM aleco_tickets WHERE parent_ticket_id = ?`,
            [mainTicketId]
        );

        // Update all child tickets to the same status (and accountability fields for resolution)
        const allTicketIds = [mainTicketId, ...members.map(m => m.ticket_id)];
        if (members.length > 0) {
            const ticketIds = members.map(m => m.ticket_id);
            const placeholders = ticketIds.map(() => '?').join(', ');

            if (isResolution && (resolution_remarks || referred_to || accomplished_by)) {
                await connection.execute(
                    `UPDATE aleco_tickets SET status = ?, resolution_remarks = ?, referred_to = ?, accomplished_by = ? WHERE ticket_id IN (${placeholders})`,
                    [status, resolution_remarks || null, referred_to || null, accomplished_by || null, ...ticketIds]
                );
            } else {
                await connection.execute(
                    `UPDATE aleco_tickets SET status = ? WHERE ticket_id IN (${placeholders})`,
                    [status, ...ticketIds]
                );
            }
        }

        // Sync with service memo for the master ticket (children inherit via parent reference)
        if (isResolution) {
            const statusToMemoStatus = {
                'Restored': 'resolved',
                'Unresolved': 'unresolved',
                'NoFaultFound': 'nofaultfound',
                'AccessDenied': 'accessdenied'
            };
            const targetMemoStatus = statusToMemoStatus[status];

            const [memoRows] = await connection.execute(
                `SELECT id, work_performed, memo_status FROM aleco_service_memos WHERE ticket_id = ? LIMIT 1`,
                [mainTicketId]
            );

            if (memoRows.length > 0) {
                const memo = memoRows[0];
                const closedMemoStatuses = ['resolved', 'unresolved', 'nofaultfound', 'accessdenied', 'closed'];
                const isMemoClosed = closedMemoStatuses.includes(memo.memo_status);

                // Append remarks to memo work_performed if not closed
                if (!isMemoClosed && resolution_remarks) {
                    const currentWorkPerformed = memo.work_performed || '';
                    const newRemarks = resolution_remarks.trim();
                    const lastRemarkBlock = currentWorkPerformed.split('\n\n').pop().trim();

                    if (lastRemarkBlock !== newRemarks) {
                        const updatedWorkPerformed = currentWorkPerformed
                            ? `${currentWorkPerformed}\n\n${newRemarks}`
                            : newRemarks;

                        const updateFields = ['work_performed = ?'];
                        const updateValues = [updatedWorkPerformed];

                        if (referred_to) {
                            updateFields.push('referred_to = ?');
                            updateValues.push(referred_to);
                        }
                        if (accomplished_by) {
                            updateFields.push('closed_by = ?');
                            updateValues.push(accomplished_by);
                        }
                        updateValues.push(memo.id);

                        await connection.execute(
                            `UPDATE aleco_service_memos SET ${updateFields.join(', ')} WHERE id = ?`,
                            updateValues
                        );
                    }
                }

                // Sync memo_status with ticket status if not closed
                if (targetMemoStatus && !isMemoClosed) {
                    const allowedTransitions = {
                        'saved': ['deployed', 'resolved', 'unresolved', 'nofaultfound', 'accessdenied'],
                        'deployed': ['resolved', 'unresolved', 'nofaultfound', 'accessdenied'],
                        'resolved': ['unresolved', 'nofaultfound', 'accessdenied'],
                        'unresolved': ['resolved', 'nofaultfound', 'accessdenied'],
                        'nofaultfound': ['resolved', 'unresolved', 'accessdenied'],
                        'accessdenied': ['resolved', 'unresolved', 'nofaultfound'],
                        'closed': []
                    };

                    const allowedFromCurrent = allowedTransitions[memo.memo_status] || [];
                    if (allowedFromCurrent.includes(targetMemoStatus)) {
                        await connection.execute(
                            `UPDATE aleco_service_memos SET memo_status = ? WHERE id = ?`,
                            [targetMemoStatus, memo.id]
                        );
                    } else {
                        console.warn(`⚠️ Group: Skipped memo status sync for ${mainTicketId}: ${memo.memo_status} → ${targetMemoStatus} not allowed`);
                    }
                }
            }
        }

        await connection.commit();

        // Sync crew status after status update
        await syncCrewStatusByTicketId(mainTicketId);

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
 * BULK UPDATE TICKET STATUS
 * Updates multiple tickets with individual status, remarks, and other fields
 * PUT /api/tickets/bulk/status
 * 
 * Payload format:
 * {
 *   tickets: [
 *     { ticket_id: "T-123", status: "Restored", resolution_remarks: "...", referred_to: "...", accomplished_by: "..." },
 *     ...
 *   ],
 *   actor_email: "..."
 * }
 */
router.put('/tickets/bulk/status', requireStaff, async (req, res) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { tickets } = req.body;

        if (!Array.isArray(tickets) || tickets.length === 0) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'No tickets provided'
            });
        }

        // ✅ HARDENING: Valid status enum (only resolution statuses for bulk update)
        const ALLOWED_BULK_STATUSES = ['Restored', 'Unresolved', 'NoFaultFound', 'AccessDenied'];

        // ✅ HARDENING: Dedupe by ticket_id (last write wins for any duplicates)
        const dedupedTickets = Array.from(
            new Map(tickets.map(t => [t.ticket_id, t])).values()
        );

        // ✅ HARDENING: Validate every ticket up-front before touching DB
        for (const ticket of dedupedTickets) {
            if (!ticket.ticket_id || typeof ticket.ticket_id !== 'string') {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Each ticket must have a valid ticket_id'
                });
            }
            // Reject group-prefixed IDs (they must go through /tickets/group/:mainTicketId/status)
            if (ticket.ticket_id.startsWith('GROUP-')) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: `Ticket ${ticket.ticket_id} is a group master. Use the group status endpoint instead.`
                });
            }
            if (!ALLOWED_BULK_STATUSES.includes(ticket.status)) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: `Invalid status "${ticket.status}" for ticket ${ticket.ticket_id}. Allowed: ${ALLOWED_BULK_STATUSES.join(', ')}`
                });
            }
            if (!ticket.resolution_remarks || !String(ticket.resolution_remarks).trim()) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: `Resolution remarks are required for ticket ${ticket.ticket_id}`
                });
            }
        }

        const ticketIds = dedupedTickets.map(t => t.ticket_id);
        const placeholders = ticketIds.map(() => '?').join(', ');

        // ✅ HARDENING: Check that all tickets actually exist before updating
        const [statusRows] = await connection.execute(
            `SELECT ticket_id, status FROM aleco_tickets WHERE ticket_id IN (${placeholders})`,
            ticketIds
        );
        const statusMap = Object.fromEntries(statusRows.map(r => [r.ticket_id, r.status]));

        const missingTickets = ticketIds.filter(id => !(id in statusMap));
        if (missingTickets.length > 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: `Ticket(s) not found: ${missingTickets.join(', ')}`,
                missing: missingTickets
            });
        }

        // ✅ HARDENING: Normalize tickets array to deduped + trimmed copy used downstream
        const normalizedTickets = dedupedTickets.map(t => ({
            ticket_id: t.ticket_id,
            status: t.status,
            resolution_remarks: String(t.resolution_remarks).trim(),
            referred_to: t.referred_to ? String(t.referred_to).trim() || null : null,
            accomplished_by: t.accomplished_by ? String(t.accomplished_by).trim() || null : null,
            expected_updated_at: t.expected_updated_at || null,
        }));

        // Resolution statuses that sync with service memos
        const resolutionStatuses = ['Restored', 'Unresolved', 'NoFaultFound', 'AccessDenied'];
        const statusToMemoStatus = {
            'Restored': 'resolved',
            'Unresolved': 'unresolved',
            'NoFaultFound': 'nofaultfound',
            'AccessDenied': 'accessdenied'
        };

        // Track which tickets had memo sync skipped (for reporting)
        const memoSyncSkipped = [];
        
        // Track conflicts for concurrency control
        const conflicts = [];
        const successfullyUpdated = [];

        // Update each ticket individually with its status and remarks
        for (const ticket of normalizedTickets) {
            // ✅ CONCURRENCY CONTROL: Use buildOptimisticWhere for version checking
            const optimistic = await buildOptimisticWhere(connection, {
                table: 'aleco_tickets',
                idCol: 'ticket_id',
                idValue: ticket.ticket_id,
                selectCols: ['status'],
                expectedUpdatedAt: ticket.expected_updated_at
            });

            if (optimistic.missing) {
                await connection.rollback();
                return res.status(404).json({
                    success: false,
                    message: `Ticket ${ticket.ticket_id} not found (possibly deleted concurrently).`
                });
            }

            if (optimistic.conflict) {
                // Version mismatch - record conflict and skip this ticket
                conflicts.push({
                    ticket_id: ticket.ticket_id,
                    expected_updated_at: ticket.expected_updated_at,
                    actual_updated_at: optimistic.latest.updated_at
                });
                continue;
            }
            
            const [updateResult] = await connection.execute(
                `UPDATE aleco_tickets SET status = ?, resolution_remarks = ?, referred_to = ?, accomplished_by = ? WHERE ${optimistic.whereSql}`,
                [ticket.status, ticket.resolution_remarks, ticket.referred_to, ticket.accomplished_by, ...optimistic.whereParams]
            );

            // ✅ HARDENING: Defensive check — every ticket should have been confirmed to exist above
            if (updateResult.affectedRows === 0) {
                await connection.rollback();
                return res.status(404).json({
                    success: false,
                    message: `Ticket ${ticket.ticket_id} could not be updated (possibly deleted concurrently).`
                });
            }
            
            successfullyUpdated.push(ticket.ticket_id);

            // Sync with service memo if ticket has one and status is a resolution status
            if (resolutionStatuses.includes(ticket.status)) {
                const [memoRows] = await connection.execute(
                    `SELECT id, work_performed, memo_status FROM aleco_service_memos WHERE ticket_id = ? LIMIT 1`,
                    [ticket.ticket_id]
                );

                if (memoRows.length > 0) {
                    const memo = memoRows[0];
                    const targetMemoStatus = statusToMemoStatus[ticket.status];

                    // Check if memo is already closed
                    const closedMemoStatuses = ['resolved', 'unresolved', 'nofaultfound', 'accessdenied', 'closed'];
                    const isMemoClosed = closedMemoStatuses.includes(memo.memo_status);

                    // Auto-fill work_performed if memo is not closed (mirrors single-ticket logic)
                    if (!isMemoClosed && ticket.resolution_remarks) {
                        const currentWorkPerformed = memo.work_performed || '';
                        const newRemarks = ticket.resolution_remarks;

                        // Use same duplicate detection as single-ticket: split by \n\n, check last block
                        const lastRemarkBlock = currentWorkPerformed.split('\n\n').pop().trim();
                        const isDuplicate = lastRemarkBlock === newRemarks;

                        if (!isDuplicate) {
                            const updatedWorkPerformed = currentWorkPerformed
                                ? `${currentWorkPerformed}\n\n${newRemarks}`
                                : newRemarks;

                            // Build update with optional referred_to and accomplished_by → closed_by
                            const updateFields = ['work_performed = ?'];
                            const updateValues = [updatedWorkPerformed];

                            if (ticket.referred_to) {
                                updateFields.push('referred_to = ?');
                                updateValues.push(ticket.referred_to);
                            }

                            if (ticket.accomplished_by) {
                                updateFields.push('closed_by = ?');
                                updateValues.push(ticket.accomplished_by);
                            }

                            updateValues.push(memo.id);

                            await connection.execute(
                                `UPDATE aleco_service_memos SET ${updateFields.join(', ')} WHERE id = ?`,
                                updateValues
                            );
                        }
                    } else if (isMemoClosed) {
                        // ✅ HARDENING: Surface skipped memo updates for closed memos
                        memoSyncSkipped.push({
                            ticket_id: ticket.ticket_id,
                            from: memo.memo_status,
                            to: targetMemoStatus,
                            reason: 'memo_already_closed'
                        });
                    }

                    // Sync memo_status with ticket status if not already closed
                    if (targetMemoStatus && !isMemoClosed) {
                        const allowedTransitions = {
                            'saved': ['deployed', 'resolved', 'unresolved', 'nofaultfound', 'accessdenied'],
                            'deployed': ['resolved', 'unresolved', 'nofaultfound', 'accessdenied'],
                            'resolved': ['unresolved', 'nofaultfound', 'accessdenied'],
                            'unresolved': ['resolved', 'nofaultfound', 'accessdenied'],
                            'nofaultfound': ['resolved', 'unresolved', 'accessdenied'],
                            'accessdenied': ['resolved', 'unresolved', 'nofaultfound'],
                            'closed': []
                        };

                        const allowedFromCurrent = allowedTransitions[memo.memo_status] || [];
                        if (allowedFromCurrent.includes(targetMemoStatus)) {
                            await connection.execute(
                                `UPDATE aleco_service_memos SET memo_status = ? WHERE id = ?`,
                                [targetMemoStatus, memo.id]
                            );
                        } else {
                            // Log skipped sync for visibility (bulk should not fail entire batch)
                            memoSyncSkipped.push({
                                ticket_id: ticket.ticket_id,
                                from: memo.memo_status,
                                to: targetMemoStatus,
                                reason: 'invalid_transition'
                            });
                            console.warn(`⚠️ Bulk: Skipped memo status sync for ${ticket.ticket_id}: ${memo.memo_status} → ${targetMemoStatus} not allowed`);
                        }
                    }
                }
            }
        }

        await connection.commit();

        // ✅ CONCURRENCY CONTROL: Return 409 if there were conflicts
        if (conflicts.length > 0) {
            return res.status(409).json({
                success: false,
                message: `Some tickets were modified by another user`,
                conflicts: conflicts,
                updated: successfullyUpdated,
                memoSyncSkipped: memoSyncSkipped.length > 0 ? memoSyncSkipped : undefined
            });
        }

        // Sync crew status after commit (mirrors single-ticket flow)
        // Only sync for successfully updated tickets
        for (const ticketId of successfullyUpdated) {
            try {
                await syncCrewStatusByTicketId(ticketId);
            } catch (crewErr) {
                console.error(`⚠️ Crew sync failed for ${ticketId}:`, crewErr.message);
            }
        }

        const actorEmail = req.body.actor_email || req.headers['x-user-email'];
        const actorName = req.body.actor_name || req.headers['x-user-name'];

        // Log only successfully updated tickets
        for (const ticket of normalizedTickets) {
            if (!successfullyUpdated.includes(ticket.ticket_id)) {
                continue; // Skip conflicted tickets
            }
            await insertTicketLog(pool, {
                ticket_id: ticket.ticket_id,
                action: 'bulk_status_update',
                from_status: statusMap[ticket.ticket_id] || null,
                to_status: ticket.status,
                actor_type: actorEmail || actorName ? 'dispatcher' : 'system',
                actor_email: actorEmail || null,
                actor_name: actorName || 'System',
                metadata: {
                    bulk: true,
                    resolution_remarks: ticket.resolution_remarks,
                    referred_to: ticket.referred_to,
                    accomplished_by: ticket.accomplished_by
                }
            });
        }

        console.log(`✅ BULK STATUS UPDATE: ${successfullyUpdated.length} tickets updated with individual status and remarks`);

        res.json({
            success: true,
            message: `${successfullyUpdated.length} ticket(s) status updated`,
            updated: successfullyUpdated.length,
            memoSyncSkipped: memoSyncSkipped.length > 0 ? memoSyncSkipped : undefined
        });

    } catch (error) {
        await connection.rollback();
        console.error("❌ Error bulk updating ticket status:", error);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        connection.release();
    }
});

export default router;

