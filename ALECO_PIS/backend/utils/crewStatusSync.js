import pool from '../config/db.js';
import { recordPersonnelNotification, PERSONNEL_EVENT } from './adminNotifications.js';

/**
 * Synchronizes a crew's status based on their active tickets.
 * If they have any 'Ongoing' tickets, their status becomes 'Deployed'.
 * Otherwise, it becomes 'Available'.
 * 
 * @param {string} crewName The exact name of the crew to sync
 */
export async function syncCrewStatus(crewName) {
    if (!crewName) return;

    try {
        const [crewRows] = await pool.execute(
            `SELECT status FROM aleco_personnel WHERE crew_name = ?`,
            [crewName]
        );
        if (crewRows.length === 0) return;
        const currentStatus = crewRows[0].status;

        const [rows] = await pool.execute(
            `SELECT COUNT(*) as count FROM aleco_tickets WHERE assigned_crew = ? AND status = 'Ongoing'`,
            [crewName]
        );
        
        const count = rows[0].count;
        const newStatus = count > 0 ? 'Deployed' : 'Available';

        if (newStatus !== currentStatus) {
            await pool.execute(
                `UPDATE aleco_personnel SET status = ? WHERE crew_name = ?`,
                [newStatus, crewName]
            );

            await recordPersonnelNotification(pool, {
                eventType: PERSONNEL_EVENT.CREW_STATUS_CHANGED,
                subjectName: crewName,
                detail: `Status changed to ${newStatus}`,
                actorEmail: 'system'
            });

            console.log(`[crewStatusSync] Crew "${crewName}" status synced to ${newStatus} (active tickets: ${count})`);
        }
    } catch (err) {
        console.error('[crewStatusSync] Error syncing crew status:', err);
    }
}

/**
 * Synchronizes the assigned crew's status for a given ticket ID.
 * Useful when the crew name isn't directly available in the payload.
 * 
 * @param {string} ticketId 
 */
export async function syncCrewStatusByTicketId(ticketId) {
    if (!ticketId) return;
    
    try {
        const [rows] = await pool.execute(
            `SELECT assigned_crew FROM aleco_tickets WHERE ticket_id = ?`,
            [ticketId]
        );
        const crewName = rows[0]?.assigned_crew;
        
        if (crewName) {
            await syncCrewStatus(crewName);
        }
    } catch (err) {
        console.error('[crewStatusSync] Error syncing by ticket id:', err);
    }
}
