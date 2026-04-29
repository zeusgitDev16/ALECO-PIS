import { deleteCloudinaryAssetByUrl } from '../../cloudinaryConfig.js';
import { recordTicketNotification, TICKETS_EVENT } from './adminNotifications.js';

/**
 * Delete a ticket row and its dependent data.
 * Returns structured status so callers can decide response semantics.
 */
export async function deleteTicketWithCascade({
    db,
    ticketId,
    actorEmail = null,
    allowGrouped = false,
}) {
    const [existing] = await db.execute(
        'SELECT ticket_id, parent_ticket_id, image_url, service_memo_id FROM aleco_tickets WHERE ticket_id = ?',
        [ticketId]
    );
    if (existing.length === 0) {
        return { success: false, code: 'not_found', message: 'Ticket not found.' };
    }

    const row = existing[0];
    if (!allowGrouped) {
        if (String(row.ticket_id || '').startsWith('GROUP-')) {
            return { success: false, code: 'grouped', message: 'Cannot delete GROUP master. Ungroup first.' };
        }
        if (row.parent_ticket_id) {
            return { success: false, code: 'grouped', message: 'Cannot delete a ticket that is part of a group. Ungroup first.' };
        }
    }

    if (row.service_memo_id) {
        try {
            await db.execute('UPDATE aleco_tickets SET service_memo_id = NULL WHERE ticket_id = ?', [ticketId]);
            await db.execute('DELETE FROM aleco_service_memos WHERE id = ?', [row.service_memo_id]);
        } catch (memoError) {
            console.error(`⚠️ Failed to delete service memo for ticket ${ticketId}:`, memoError.message);
        }
    }

    await db.execute('DELETE FROM aleco_ticket_logs WHERE ticket_id = ?', [ticketId]);
    const [deleteResult] = await db.execute('DELETE FROM aleco_tickets WHERE ticket_id = ?', [ticketId]);
    if ((deleteResult?.affectedRows || 0) === 0) {
        return { success: false, code: 'not_found', message: 'Ticket not found.' };
    }

    const imageUrl = row.image_url || null;
    setImmediate(() => {
        deleteCloudinaryAssetByUrl(imageUrl).catch((e) =>
            console.warn('[cloudinary] ticket delete cleanup:', e?.message || e)
        );
    });

    try {
        await recordTicketNotification(db, {
            eventType: TICKETS_EVENT.DELETED,
            subjectName: ticketId,
            detail: 'Ticket removed',
            actorEmail: (actorEmail && String(actorEmail).trim()) || null,
        });
    } catch (notifError) {
        console.warn('[ticket-delete] notification logging skipped:', notifError?.message || notifError);
    }

    return { success: true, code: 'deleted' };
}
