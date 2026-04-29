import express from 'express';
import pool from '../config/db.js';
import { upload } from '../../cloudinaryConfig.js'; // <-- Adjusted path to go up two folders
import { sendPhilSMS } from '../utils/sms.js';
import { normalizePhoneForDB, INVALID_PHONE_MESSAGE } from '../utils/phoneUtils.js';
import { insertTicketLog } from '../utils/ticketLogHelper.js';
import { nowPhilippineForMysql } from '../utils/dateTimeUtils.js';
import { mapTicketRowToDto } from '../utils/ticketDto.js';
import { toIsoForClient } from '../utils/interruptionsDto.js';
import { listUrgentKeywords } from '../utils/urgentKeywordsDb.js';
import { concernMatchesUrgentKeywords } from '../utils/urgentKeywordMatch.js';
import { DEFAULT_URGENT_KEYWORDS } from '../constants/defaultUrgentKeywords.js';
import { clampSqlInt } from '../utils/safeSqlInt.js';
import { deleteTicketWithCascade } from '../utils/ticketDeleteHelper.js';
import {
  recordPersonnelNotification,
  PERSONNEL_EVENT,
  recordTicketNotification,
  TICKETS_EVENT,
} from '../utils/adminNotifications.js';

import { sendAppMail } from '../utils/appMail.js';
import { requireAdmin } from '../middleware/requireRole.js';

function actorEmailFromReq(req) {
  return req.authUser?.email || String(req.headers['x-user-email'] || '').trim() || null;
}

async function logPersonnelAction(pool, actorEmail, actorName, action, targetName) {
  try {
    await pool.execute(
      'INSERT INTO aleco_personnel_audit_logs (actor_email, actor_name, action, target_name) VALUES (?, ?, ?, ?)',
      [actorEmail || null, actorName || null, action, targetName || null]
    );
  } catch { /* table may not exist yet — silently skip */ }
}

const router = express.Router();

// --- DISTRICT-MUNICIPALITY VALIDATION MAP ---
const ALECO_DISTRICT_MAP = {
    "First District (North Albay)": [
        "Bacacay", "Malilipot", "Malinao", "Santo Domingo", "Tabaco City", "Tiwi"
    ],
    "Second District (Central Albay)": [
        "Camalig", "Daraga", "Legazpi City", "Manito", "Rapu-Rapu"
    ],
    "Third District (South Albay)": [
        "Guinobatan", "Jovellar", "Libon", "Ligao City", "Oas", "Pio Duran", "Polangui"
    ]
};

// --- VALIDATION FUNCTION ---
const validateDistrictMunicipality = (district, municipality) => {
    if (!district || !municipality) return false;
    
    const validMunicipalities = ALECO_DISTRICT_MAP[district];
    if (!validMunicipalities) {
        console.error(`❌ Invalid district: ${district}`);
        return false;
    }
    
    const isValid = validMunicipalities.includes(municipality);
    if (!isValid) {
        console.error(`❌ Municipality "${municipality}" does not belong to "${district}"`);
    }
    
    return isValid;
};

// --- 1. THE MASTER TICKET SUBMISSION ROUTE ---
router.post('/tickets/submit', upload.single('image'), async (req, res) => {
    try {
        const manilaTime = nowPhilippineForMysql();

        const {
            account_number, first_name, middle_name, last_name,
            phone_number, address, category, concern, action_desired,
            district, municipality, is_urgent,
            reported_lat, reported_lng, location_accuracy, location_method,
            location_confidence // NEW: Track GPS confidence
        } = req.body;

        console.log("📍 GPS Data Received:", { reported_lat, reported_lng, location_accuracy, location_method });
        console.log("🏛️ Location Data:", { district, municipality });

        // --- CRITICAL: VALIDATE DISTRICT-MUNICIPALITY RELATIONSHIP ---
        if (district && municipality) {
            const isValid = validateDistrictMunicipality(district, municipality);
            if (!isValid) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid location: ${municipality} does not belong to ${district}. Please verify your selection.`
                });
            }
            console.log(`✅ VALIDATION PASSED: ${municipality} belongs to ${district}`);
        } else if (district || municipality) {
            // One is filled but not the other
            return res.status(400).json({
                success: false,
                message: 'Both district and municipality must be provided together.'
            });
        }

        // Normalize consumer phone for DB and SMS
        const normalizedPhone = normalizePhoneForDB(phone_number);
        if (!normalizedPhone) {
            return res.status(400).json({
                success: false,
                message: INVALID_PHONE_MESSAGE
            });
        }

        // IDEMPOTENCY CHECK
        const duplicateCheckSql = `
            SELECT ticket_id FROM aleco_tickets 
            WHERE phone_number = ? 
              AND category = ? 
              AND concern = ? 
              AND created_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
            LIMIT 1
        `;
        const [existingTickets] = await pool.execute(duplicateCheckSql, [
            normalizedPhone, category, concern
        ]);

        if (existingTickets.length > 0) {
            return res.status(200).json({
                success: true,
                ticketId: existingTickets[0].ticket_id,
                message: "Your report has already been received. Thank you!"
            });
        }

        const image_url = req.file ? req.file.path : null;
        const ticket_id = `ALECO-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

        // --- BACKEND URGENT VALIDATION (DB keywords + shared matcher; fallback if table missing) ---
        let urgentKeywordList;
        try {
            urgentKeywordList = await listUrgentKeywords(pool);
        } catch (e) {
            console.error('[tickets/submit] urgent keywords DB:', e?.message || e);
            urgentKeywordList = DEFAULT_URGENT_KEYWORDS;
        }

        const backendUrgentCheck =
            urgentKeywordList.length > 0 &&
            concernMatchesUrgentKeywords(concern, urgentKeywordList);

        // Use backend validation as source of truth
        const finalUrgentStatus = backendUrgentCheck ? 1 : 0;

        // Log discrepancies (for debugging)
        if (is_urgent != finalUrgentStatus) {
            console.warn(`⚠️ URGENT MISMATCH: Frontend=${is_urgent}, Backend=${finalUrgentStatus}`);
            console.warn(`   Concern: "${concern}"`);
        }

        console.log(`🚨 Final Urgent Status: ${finalUrgentStatus} | Concern: "${concern}"`);

        // UPDATED SQL: Now includes GPS columns + action_desired (19 placeholders)
        const sql = `
            INSERT INTO aleco_tickets
            (ticket_id, account_number, first_name, middle_name, last_name,
             phone_number, address, district, municipality,
             category, concern, action_desired, image_url, status, created_at, is_urgent,
             reported_lat, reported_lng, location_accuracy, location_method, location_confidence)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            ticket_id,
            account_number || "",
            first_name,
            middle_name || "",
            last_name,
            normalizedPhone,
            address,
            district || "",
            municipality || "",
            category,
            concern,
            action_desired,
            image_url,
            manilaTime,
            finalUrgentStatus, // Use backend validation
            reported_lat || null,
            reported_lng || null,
            location_accuracy || null,
            location_method || 'manual',
            location_confidence || 'medium' // NEW
        ];

        await pool.execute(sql, values);

        const locHint = [municipality, district].filter(Boolean).join(', ');
        await recordTicketNotification(pool, {
          eventType: TICKETS_EVENT.SUBMITTED_REPORT,
          subjectName: ticket_id,
          detail: locHint ? `Report a problem · ${locHint}` : 'Report a problem',
          actorEmail: null,
        });

        console.log(`✅ TICKET CREATED: ${ticket_id} | ${municipality}, ${district}`);

        res.json({ success: true, ticketId: ticket_id });

    } catch (error) {
        console.error("❌ SUBMISSION ERROR:", error);
        res.status(500).json({ success: false, message: "Server error. Please try again." });
    }
});

// --- 2. TRACK TICKET ROUTE ---
router.get('/tickets/track/:ticketId', async (req, res) => {
    try {
        const { ticketId } = req.params;

        if (!ticketId || ticketId.trim() === '') {
            return res.status(400).json({ success: false, message: "Please provide a valid Ticket ID." });
        }

        // Returns consumer-relevant fields including crew/ETA when Ongoing, lineman_remarks, hold_reason
        const [rows] = await pool.execute(
            `SELECT
                first_name,
                middle_name,
                last_name,
                status,
                created_at,
                concern,
                action_desired,
                municipality,
                district,
                assigned_crew,
                eta,
                dispatch_notes,
                concern_resolution_notes,
                lineman_remarks,
                hold_reason,
                hold_since
             FROM aleco_tickets
             WHERE ticket_id = ?`,
            [ticketId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "Ticket ID not found. Please check your tracking number and try again." });
        }

        res.json({ success: true, data: mapTicketRowToDto(rows[0]) });
        
    } catch (error) {
        console.error("Database Tracking Error:", error);
        res.status(500).json({ success: false, message: "An internal server error occurred. Please try again later." });
    }
});

// --- 2b. EDIT TICKET ROUTE (Dispatcher) ---
router.put('/tickets/:ticketId', requireAdmin, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const body = req.body;

        if (!ticketId || ticketId.startsWith('GROUP-')) {
            return res.status(400).json({ success: false, message: 'Cannot edit GROUP master. Edit child tickets individually.' });
        }

        const [existing] = await pool.execute('SELECT * FROM aleco_tickets WHERE ticket_id = ?', [ticketId]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Ticket not found.' });
        }

        if (existing[0].parent_ticket_id) {
            return res.status(400).json({ success: false, message: 'Cannot edit a ticket that is part of a group. Ungroup first.' });
        }

        const allowed = ['first_name', 'middle_name', 'last_name', 'phone_number', 'account_number', 'address', 'district', 'municipality', 'category', 'concern', 'action_desired'];
        const updates = {};
        for (const key of allowed) {
            if (body[key] !== undefined) updates[key] = body[key];
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ success: false, message: 'No valid fields to update.' });
        }

        if (updates.district && updates.municipality) {
            const isValid = validateDistrictMunicipality(updates.district, updates.municipality);
            if (!isValid) {
                return res.status(400).json({ success: false, message: `Invalid location: ${updates.municipality} does not belong to ${updates.district}.` });
            }
        } else if (updates.district || updates.municipality) {
            return res.status(400).json({ success: false, message: 'Both district and municipality must be provided together.' });
        }

        if (updates.phone_number) {
            const normalized = normalizePhoneForDB(updates.phone_number);
            if (!normalized) {
                return res.status(400).json({ success: false, message: INVALID_PHONE_MESSAGE });
            }
            updates.phone_number = normalized;
        }

        const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
        const values = [...Object.values(updates), ticketId];
        await pool.execute(`UPDATE aleco_tickets SET ${setClause} WHERE ticket_id = ?`, values);

        const actorEmail = req.body.actor_email || req.headers['x-user-email'];
        const actorName = req.body.actor_name || req.headers['x-user-name'];
        await insertTicketLog(pool, {
            ticket_id: ticketId,
            action: 'ticket_edit',
            actor_type: actorEmail || actorName ? 'dispatcher' : 'system',
            actor_email: actorEmail || null,
            actor_name: actorName || 'System',
            metadata: { updated_fields: Object.keys(updates) }
        });

        console.log(`✅ TICKET EDITED: ${ticketId}`);
        res.json({ success: true, message: `Ticket ${ticketId} updated.` });
    } catch (error) {
        console.error('❌ TICKET EDIT ERROR:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to update ticket.' });
    }
});

// --- 2c. HARD DELETE TICKET ROUTE ---
router.delete('/tickets/:ticketId', requireAdmin, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const actorEmail = req.body?.actor_email || req.headers['x-user-email'];
        const result = await deleteTicketWithCascade({
            db: pool,
            ticketId,
            actorEmail,
            allowGrouped: false,
        });
        if (!result.success && result.code === 'not_found') {
            return res.status(404).json({ success: false, message: result.message });
        }
        if (!result.success && result.code === 'grouped') {
            return res.status(400).json({ success: false, message: result.message });
        }
        if (!result.success) {
            return res.status(500).json({ success: false, message: 'Failed to delete ticket.' });
        }

        console.log(`✅ TICKET HARD DELETED: ${ticketId}`);
        res.json({ success: true, message: `Ticket ${ticketId} deleted.` });
    } catch (error) {
        console.error('❌ TICKET DELETE ERROR:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to delete ticket.' });
    }
});

// --- 3. SEND EMAIL COPY ROUTE ---
router.post('/tickets/send-copy', async (req, res) => {
    const { email, ticketId } = req.body;
    
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `ALECO Tracking Number: ${ticketId}`,
        html: `
            <div style="font-family: sans-serif; padding: 20px; background-color: #f4f4f4;">
                <h2 style="color: #006bb3;">ALECO Report Received</h2>
                <p>Thank you for reporting your concern. Your tracking ID is:</p>
                <div style="font-size: 24px; font-weight: bold; color: #ff4d4d; margin: 20px 0;">
                    ${ticketId}
                </div>
                <p>Use this ID on our portal to check the status of your report.</p>
            </div>
        `
    };

    try {
        await sendAppMail({
            from: mailOptions.from,
            to: mailOptions.to,
            subject: mailOptions.subject,
            html: mailOptions.html,
        });
        res.json({ success: true, message: "Copy sent to your email!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Email failed to send." });
    }
}); // <-- Route 3 safely closes here!


// --- ADMIN: DISPATCH TICKET ROUTE (PHILSMS INTEGRATION) ---
router.put('/tickets/:ticket_id/dispatch', requireAdmin, async (req, res) => {
    const { ticket_id } = req.params;
    const { assigned_crew, eta, is_consumer_notified, dispatch_notes } = req.body;

    console.log(`\n🚀 STARTING DYNAMIC DISPATCH for Ticket: ${ticket_id}`);

    try {
        // --- PHASE 1: DYNAMIC PHONE LOOKUP ---
        // We join the ticket with personnel to get both numbers in one hit
        const [contactData] = await pool.execute(`
            SELECT t.phone_number AS consumer_phone, p.phone_number AS lineman_phone
            FROM aleco_tickets t
            LEFT JOIN aleco_personnel p ON p.crew_name = ?
            WHERE t.ticket_id = ?
        `, [assigned_crew, ticket_id]);

        if (contactData.length === 0) {
            return res.status(404).json({ success: false, message: 'Ticket not found.' });
        }

        const { consumer_phone, lineman_phone } = contactData[0];

        // Validation: Ensure the selected crew actually has a number in the DB
        if (!lineman_phone) {
            console.log(`❌ ERROR: No phone number found for crew: ${assigned_crew}`);
            return res.status(400).json({ success: false, message: `Crew ${assigned_crew} has no registered phone number.` });
        }

        // --- PHASE 2: SMS PHASE ---
        // 1. Notify Lineman (Using number from aleco_personnel)
        const linemanMsg = `Hi crew ${assigned_crew}, your assigned ticket is ${ticket_id}

keywords to reply:
fixed
unfixed
nofault
nores

keep safe!`;
        const linemanSmsResult = await sendPhilSMS(lineman_phone, linemanMsg);
        if (!linemanSmsResult.success) {
            console.log(`❌ Lineman SMS failed for crew ${assigned_crew}; ticket not updated.`);
            return res.status(502).json({
                success: false,
                message:
                    'Crew dispatch SMS could not be sent. The ticket was not updated. Check PhilSMS (API key, URL, sender ID) and server logs.',
                sms: { lineman: linemanSmsResult }
            });
        }
        console.log(`✅ SMS sent to Lineman (${assigned_crew}): ${lineman_phone}`);

        // 2. Notify Consumer (optional - only when Notify Consumer toggle is ON)
        let consumerSmsPayload;
        if (is_consumer_notified && consumer_phone) {
            const consumerMsg = `Good day! This is ALECO. Your ticket ${ticket_id} is now under dispatch. Our service crew/linemen are scheduled to arrive at your location to address your concern. Please stay available for coordination, and you may track updates using your ticket ID.

You can enter this ticket to track:
${ticket_id}`;
            const consumerResult = await sendPhilSMS(consumer_phone, consumerMsg);
            consumerSmsPayload = { attempted: true, ...consumerResult };
            if (consumerResult.success) {
                console.log(`✅ SMS sent to Consumer: ${consumer_phone}`);
            } else {
                console.warn(`⚠️ Consumer SMS failed for ticket ${ticket_id}:`, consumerResult);
            }
        } else if (is_consumer_notified) {
            consumerSmsPayload = { attempted: false, skipped: true, reason: 'no_phone_on_ticket' };
        } else {
            consumerSmsPayload = { attempted: false, skipped: true, reason: 'not_requested' };
        }

        // --- PHASE 3: DATABASE UPDATE ---
        console.log("➡️ Phase 3 (DB Update) Starting...");

        const [dispatchStatusRows] = await pool.execute(
            'SELECT status FROM aleco_tickets WHERE ticket_id = ?',
            [ticket_id]
        );
        const dispatchFromStatus = dispatchStatusRows[0]?.status || 'Pending';
        
        const phNow = nowPhilippineForMysql();
        const updateQuery = `
            UPDATE aleco_tickets 
            SET status = 'Ongoing', 
                assigned_crew = ?, 
                eta = ?, 
                is_consumer_notified = ?, 
                dispatch_notes = ?,
                concern_resolution_notes = NULL,
                dispatched_at = ?,
                hold_reason = NULL,
                hold_since = NULL
            WHERE ticket_id = ?
        `;

        const [dbResult] = await pool.execute(updateQuery, [
            assigned_crew, 
            eta, 
            is_consumer_notified ? 1 : 0, 
            dispatch_notes || '', 
            phNow,
            ticket_id
        ]);

        if (dbResult.affectedRows > 0) {
            const actorEmail = req.body.actor_email || req.headers['x-user-email'];
            const actorName = req.body.actor_name || req.headers['x-user-name'];
            await insertTicketLog(pool, {
                ticket_id,
                action: 'dispatch',
                from_status: dispatchFromStatus,
                to_status: 'Ongoing',
                actor_type: actorEmail || actorName ? 'dispatcher' : 'system',
                actor_email: actorEmail || null,
                actor_name: actorName || 'System',
                metadata: { assigned_crew, eta, dispatch_notes: dispatch_notes || null }
            });
            console.log(`✅ DATABASE SUCCESS: Ticket ${ticket_id} updated to Ongoing.`);
            const c = consumerSmsPayload;
            let dispatchMessage;
            if (!c.attempted) {
                if (c.reason === 'not_requested') {
                    dispatchMessage = `Ticket ${ticket_id} dispatched. Crew notified by SMS.`;
                } else {
                    dispatchMessage = `Ticket ${ticket_id} dispatched. Crew notified by SMS. Consumer has no phone on file.`;
                }
            } else if (c.success) {
                dispatchMessage = `Ticket ${ticket_id} dispatched. Crew and consumer notified by SMS.`;
            } else {
                dispatchMessage = `Ticket ${ticket_id} dispatched. Crew notified by SMS. Consumer SMS could not be sent.`;
            }
            res.status(200).json({
                success: true,
                message: dispatchMessage,
                sms: {
                    lineman: { success: true },
                    consumer: consumerSmsPayload
                },
                ...(c.attempted && !c.success ? { warnings: ['consumer_sms_failed'] } : {})
            });
        } else {
            res.status(500).json({ success: false, message: 'Failed to update ticket status.' });
        }

    } catch (error) {
        console.error("❌ CRITICAL DISPATCH ERROR:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

// --- ADMIN: START RESOLUTION FOR NON-LINEMAN CONCERNS (NO CREW REQUIRED) ---
router.put('/tickets/:ticket_id/resolve-concern', requireAdmin, async (req, res) => {
    const { ticket_id } = req.params;
    const { is_consumer_notified, concern_resolution_notes } = req.body;
    const concernNotes = String(concern_resolution_notes || '').trim();

    if (!concernNotes) {
        return res.status(400).json({ success: false, message: 'Concern resolution notes are required.' });
    }

    try {
        const [statusRows] = await pool.execute(
            'SELECT status, phone_number FROM aleco_tickets WHERE ticket_id = ?',
            [ticket_id]
        );
        if (statusRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Ticket not found.' });
        }

        const fromStatus = statusRows[0]?.status || 'Pending';
        const consumerPhone = statusRows[0]?.phone_number;
        const phNow = nowPhilippineForMysql();

        const [dbResult] = await pool.execute(
            `UPDATE aleco_tickets
             SET status = 'Ongoing',
                 assigned_crew = NULL,
                 eta = NULL,
                 is_consumer_notified = ?,
                 dispatch_notes = NULL,
                 concern_resolution_notes = ?,
                 dispatched_at = ?,
                 hold_reason = NULL,
                 hold_since = NULL
             WHERE ticket_id = ?`,
            [is_consumer_notified ? 1 : 0, concernNotes, phNow, ticket_id]
        );

        if (dbResult.affectedRows === 0) {
            return res.status(500).json({ success: false, message: 'Failed to start concern resolution.' });
        }

        let consumerSmsPayload = { attempted: false, skipped: true, reason: 'not_requested' };
        if (is_consumer_notified && consumerPhone) {
            const consumerMsg = `Good day! This is ALECO. Your ticket ${ticket_id} has been endorsed for concern resolution and is now in progress. Our support team is reviewing your concern and will provide updates accordingly. Thank you for your patience and cooperation.`;
            const consumerResult = await sendPhilSMS(consumerPhone, consumerMsg);
            consumerSmsPayload = { attempted: true, ...consumerResult };
        } else if (is_consumer_notified) {
            consumerSmsPayload = { attempted: false, skipped: true, reason: 'no_phone_on_ticket' };
        }

        const actorEmail = req.body.actor_email || req.headers['x-user-email'];
        const actorName = req.body.actor_name || req.headers['x-user-name'];
        await insertTicketLog(pool, {
            ticket_id,
            action: 'status_change',
            from_status: fromStatus,
            to_status: 'Ongoing',
            actor_type: actorEmail || actorName ? 'dispatcher' : 'system',
            actor_email: actorEmail || null,
            actor_name: actorName || 'System',
            metadata: { resolution_mode: 'concern', concern_resolution_notes: concernNotes }
        });

        const c = consumerSmsPayload;
        let message;
        if (!c.attempted) {
            message = c.reason === 'not_requested'
                ? `Ticket ${ticket_id} moved to Ongoing via concern handling.`
                : `Ticket ${ticket_id} moved to Ongoing. Consumer has no phone on file.`;
        } else if (c.success) {
            message = `Ticket ${ticket_id} moved to Ongoing. Consumer notified by SMS.`;
        } else {
            message = `Ticket ${ticket_id} moved to Ongoing. Consumer SMS could not be sent.`;
        }

        return res.status(200).json({
            success: true,
            message,
            sms: { consumer: consumerSmsPayload },
            ...(c.attempted && !c.success ? { warnings: ['consumer_sms_failed'] } : {})
        });
    } catch (error) {
        console.error('❌ RESOLVE CONCERN ERROR:', error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
});

// --- ADMIN: PUT TICKET ON HOLD (Dispatcher-initiated) ---
router.put('/tickets/:ticket_id/hold', requireAdmin, async (req, res) => {
    const { ticket_id } = req.params;
    const { hold_reason, notify_consumer } = req.body;

    if (!hold_reason || !hold_reason.trim()) {
        return res.status(400).json({ success: false, message: 'Hold reason is required.' });
    }

    try {
        const [dbResult] = await pool.execute(
            `UPDATE aleco_tickets SET status = 'OnHold', hold_reason = ?, hold_since = ? WHERE ticket_id = ? AND status = 'Ongoing'`,
            [hold_reason.trim(), nowPhilippineForMysql(), ticket_id]
        );

        if (dbResult.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Ticket not found or not Ongoing.' });
        }

        const sms = { consumer: { attempted: false, skipped: true, reason: 'not_requested' } };

        if (notify_consumer) {
            const [ticketRows] = await pool.execute('SELECT phone_number FROM aleco_tickets WHERE ticket_id = ?', [ticket_id]);
            const consumer_phone = ticketRows[0]?.phone_number;
            if (consumer_phone) {
                const holdMsg = `ALECO: Your ticket ${ticket_id} has been put on hold. Reason: ${hold_reason.trim()}. We will resume work soon. Thank you for your patience.`;
                const holdSmsResult = await sendPhilSMS(consumer_phone, holdMsg);
                sms.consumer = { attempted: true, ...holdSmsResult };
                if (holdSmsResult.success) {
                    console.log(`✅ Hold SMS sent to consumer: ${consumer_phone}`);
                } else {
                    console.warn(`⚠️ Hold consumer SMS failed for ${ticket_id}:`, holdSmsResult);
                }
            } else {
                sms.consumer = { attempted: false, skipped: true, reason: 'no_phone_on_ticket' };
            }
        }

        const actorEmail = req.body.actor_email || req.headers['x-user-email'];
        const actorName = req.body.actor_name || req.headers['x-user-name'];
        await insertTicketLog(pool, {
            ticket_id,
            action: 'hold',
            from_status: 'Ongoing',
            to_status: 'OnHold',
            actor_type: actorEmail || actorName ? 'dispatcher' : 'system',
            actor_email: actorEmail || null,
            actor_name: actorName || 'System',
            metadata: { hold_reason: hold_reason.trim() }
        });

        console.log(`✅ Ticket ${ticket_id} put on hold by dispatcher.`);
        const c = sms.consumer;
        let holdMsgText;
        if (!c.attempted) {
            holdMsgText = c.reason === 'not_requested'
                ? `Ticket ${ticket_id} put on hold.`
                : `Ticket ${ticket_id} put on hold. Consumer has no phone on file.`;
        } else if (c.success) {
            holdMsgText = `Ticket ${ticket_id} put on hold. Consumer notified by SMS.`;
        } else {
            holdMsgText = `Ticket ${ticket_id} put on hold. Consumer SMS could not be sent.`;
        }
        res.status(200).json({
            success: true,
            message: holdMsgText,
            sms,
            ...(c.attempted && !c.success ? { warnings: ['consumer_sms_failed'] } : {})
        });
    } catch (error) {
        console.error("❌ HOLD ERROR:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

// --- RESUME FROM HOLD (Dispatcher) — clears hold fields and returns ticket to Ongoing ---
router.put('/tickets/:ticket_id/resume-hold', requireAdmin, async (req, res) => {
    const { ticket_id } = req.params;

    try {
        const [dbResult] = await pool.execute(
            `UPDATE aleco_tickets SET status = 'Ongoing', hold_reason = NULL, hold_since = NULL WHERE ticket_id = ? AND status = 'OnHold'`,
            [ticket_id]
        );

        if (dbResult.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Ticket not found or not On Hold.' });
        }

        const actorEmail = req.body.actor_email || req.headers['x-user-email'];
        const actorName = req.body.actor_name || req.headers['x-user-name'];
        await insertTicketLog(pool, {
            ticket_id,
            action: 'resume_hold',
            from_status: 'OnHold',
            to_status: 'Ongoing',
            actor_type: actorEmail || actorName ? 'dispatcher' : 'system',
            actor_email: actorEmail || null,
            actor_name: actorName || 'System',
            metadata: null
        });

        console.log(`✅ Ticket ${ticket_id} resumed from hold.`);
        res.status(200).json({ success: true, message: `Ticket ${ticket_id} is back in progress.` });
    } catch (error) {
        console.error('❌ RESUME HOLD ERROR:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});


// ============================================================================
// INBOUND SMS RECEIVER (YEASTAR WEBHOOK)
// ============================================================================

router.get('/tickets/sms/receive', async (req, res) => {
    try {
        // Yeastar will send the data in the URL query string
        // Example: /api/tickets/sms/receive?number=09123456789&text=FIXED ALECO-12345
        const senderNumber = req.query.number || req.query.sender;
        const messageText = req.query.text || req.query.content;

        if (!senderNumber || !messageText) {
            return res.status(400).send("Missing parameters");
        }

        console.log(`\n📩 INBOUND SMS RECEIVED!`);
        console.log(`📱 From: ${senderNumber}`);
        console.log(`💬 Message: "${messageText}"`);

        const normalizedSender = normalizePhoneForDB(senderNumber);

        // Ticket ID pattern: ALECO-XXXXX or GROUP-YYYYMMDD-XXXX
        const TICKET_ID = '(ALECO-[A-Z0-9]+|GROUP-[A-Z0-9-]+)';

        // 0. Parse for ALL (bulk) keywords: all fixed | all unfixed | all nofault | all nores
        const allMatch = messageText.match(/all\s+(fixed|unfixed|nofault|nores)/i);
        if (allMatch) {
            if (!normalizedSender) return res.status(200).send("OK");
            const bulkAction = allMatch[1].toLowerCase();
            const statusMap = { fixed: 'Restored', unfixed: 'Unresolved', nofault: 'NoFaultFound', nores: 'AccessDenied' };
            const newStatus = statusMap[bulkAction];

            const [crewRows] = await pool.execute(
                'SELECT crew_name FROM aleco_personnel WHERE phone_number = ?',
                [normalizedSender]
            );
            if (crewRows.length > 0) {
                const crewName = crewRows[0].crew_name;
                const [ongoingTickets] = await pool.execute(
                    `SELECT ticket_id, parent_ticket_id, status FROM aleco_tickets WHERE assigned_crew = ? AND status IN ('Ongoing', 'OnHold') ORDER BY dispatched_at DESC`,
                    [crewName]
                );
                if (ongoingTickets.length > 0) {
                    const sourcePhoneLast4 = (senderNumber || '').slice(-4);
                    const keywordMap = { fixed: 'fixed', unfixed: 'unfixed', nofault: 'nofault', nores: 'nores' };
                    const keyword = keywordMap[bulkAction] || bulkAction;
                    const parentId = ongoingTickets[0].parent_ticket_id;
                    if (parentId && parentId.startsWith('GROUP-')) {
                        const [updateResult] = await pool.execute(
                            `UPDATE aleco_tickets SET status = ? WHERE ticket_id = ? OR parent_ticket_id = ?`,
                            [newStatus, parentId, parentId]
                        );
                        const affectedIds = [parentId, ...ongoingTickets.map(t => t.ticket_id).filter(id => id !== parentId)];
                        for (const tid of affectedIds) {
                            const row = ongoingTickets.find(t => t.ticket_id === tid);
                            const fromSt = row?.status || 'Ongoing';
                            await insertTicketLog(pool, {
                                ticket_id: tid,
                                action: 'status_change',
                                from_status: fromSt,
                                to_status: newStatus,
                                actor_type: 'sms_lineman',
                                metadata: { source_phone_last4: sourcePhoneLast4, keyword, bulk: true }
                            });
                        }
                        console.log(`✅ BULK: Group ${parentId} and ${updateResult.affectedRows - 1} children → ${newStatus}`);
                    } else {
                        const ticketIds = ongoingTickets.map(t => t.ticket_id);
                        const placeholders = ticketIds.map(() => '?').join(', ');
                        await pool.execute(
                            `UPDATE aleco_tickets SET status = ? WHERE ticket_id IN (${placeholders})`,
                            [newStatus, ...ticketIds]
                        );
                        for (const tid of ticketIds) {
                            const row = ongoingTickets.find(t => t.ticket_id === tid);
                            const fromSt = row?.status || 'Ongoing';
                            await insertTicketLog(pool, {
                                ticket_id: tid,
                                action: 'status_change',
                                from_status: fromSt,
                                to_status: newStatus,
                                actor_type: 'sms_lineman',
                                metadata: { source_phone_last4: sourcePhoneLast4, keyword, bulk: true }
                            });
                        }
                        console.log(`✅ BULK: ${ticketIds.length} tickets → ${newStatus}`);
                    }
                }
            }
            return res.status(200).send("OK");
        }

        // Helper: resolve ticket ID for standalone keyword (find crew's most recent Ongoing ticket)
        const resolveTicketForCrew = async () => {
            if (!normalizedSender) return null;
            const [crewRows] = await pool.execute(
                'SELECT crew_name FROM aleco_personnel WHERE phone_number = ?',
                [normalizedSender]
            );
            if (crewRows.length === 0) return null;
            const [tickets] = await pool.execute(
                `SELECT ticket_id FROM aleco_tickets WHERE assigned_crew = ? AND status IN ('Ongoing', 'OnHold') ORDER BY dispatched_at DESC LIMIT 1`,
                [crewRows[0].crew_name]
            );
            return tickets.length > 0 ? tickets[0].ticket_id : null;
        };

        // 1. Parse for UNRESOLVED first (lineman reports could not fix) - {ticket_id} unfixed or unfixed {ticket_id} or standalone unfixed
        let unresolvedTicketId = null;
        const unresolvedWithId = messageText.match(new RegExp(`(?:UNRESOLVED|FAILED|COULD NOT|UNFIXED)\\s+${TICKET_ID}`, 'i')) ||
            messageText.match(new RegExp(`${TICKET_ID}\\s+unfixed`, 'i'));
        if (unresolvedWithId) unresolvedTicketId = unresolvedWithId[1].toUpperCase();
        else if (/^unfixed$/i.test(messageText.trim())) unresolvedTicketId = await resolveTicketForCrew();
        const unresolvedMatch = unresolvedTicketId ? { 1: unresolvedTicketId } : null;
        // 1b. Parse for NFF (No Fault Found) - includes new keyword "nofault"
        let nffTicketId = null;
        let nffRemarks = null;
        const nffWithId = messageText.match(new RegExp(`(?:NFF|NO FAULT|NO FAULT FOUND|NOFAULT)\\s+${TICKET_ID}(?:\\s*\\|\\s*(.*))?`, 'i')) ||
            messageText.match(new RegExp(`${TICKET_ID}\\s+(?:nofault|no\\s*fault)`, 'i'));
        if (nffWithId) {
            nffTicketId = nffWithId[1].toUpperCase();
            nffRemarks = nffWithId[2] ? nffWithId[2].trim() : null;
        } else if (/^nofault$/i.test(messageText.trim())) {
            nffTicketId = await resolveTicketForCrew();
        }
        const nffMatch = nffTicketId ? { 1: nffTicketId, 2: nffRemarks } : null;
        // 1c. Parse for ACCESS DENIED (consumer not home) - includes new keyword "nores"
        let accessDeniedTicketId = null;
        let accessDeniedRemarks = null;
        const accessDeniedWithId = messageText.match(new RegExp(`(?:ACCESS DENIED|NO ACCESS|NOT HOME|NORES)\\s+${TICKET_ID}(?:\\s*\\|\\s*(.*))?`, 'i')) ||
            messageText.match(new RegExp(`${TICKET_ID}\\s+(?:nores|no\\s*res)`, 'i'));
        if (accessDeniedWithId) {
            accessDeniedTicketId = accessDeniedWithId[1].toUpperCase();
            accessDeniedRemarks = accessDeniedWithId[2] ? accessDeniedWithId[2].trim() : null;
        } else if (/^nores$/i.test(messageText.trim())) {
            accessDeniedTicketId = await resolveTicketForCrew();
        }
        const accessDeniedMatch = accessDeniedTicketId ? { 1: accessDeniedTicketId, 2: accessDeniedRemarks } : null;
        // 1d. Parse for HOLD (P2 - lineman reports waiting for materials/clearance/etc)
        const holdMatch = messageText.match(/(?:HOLD|ON HOLD|WAITING)\s+(ALECO-[A-Z0-9]+)(?:\s*\|\s*(.*))?/i);
        // 1e. Parse for ENROUTE (P3 - lineman reports en route, optional ETA update)
        const enrouteMatch = messageText.match(/(?:ENROUTE|EN ROUTE|ON THE WAY)\s+(ALECO-[A-Z0-9]+)(?:\s*\|\s*(.*))?/i);
        // 1f. Parse for ARRIVED (P3 - lineman reports arrived at site)
        const arrivedMatch = messageText.match(/(?:ARRIVED|ON SITE|HERE)\s+(ALECO-[A-Z0-9]+)/i);

        if (unresolvedMatch) {
            const ticketId = unresolvedMatch[1].toUpperCase();
            console.log(`🔍 Extracted Ticket ID (Unresolved): ${ticketId}`);

            const [prevRows] = await pool.execute(
                `SELECT status FROM aleco_tickets WHERE ticket_id = ? AND status IN ('Ongoing', 'OnHold')`,
                [ticketId]
            );
            if (prevRows.length === 0) {
                console.log(`⚠️ Ticket ${ticketId} not found or is not currently active (Ongoing/On Hold).`);
            } else {
                const fromStatus = prevRows[0].status;
                const [dbResult] = await pool.execute(
                    `UPDATE aleco_tickets SET status = 'Unresolved', hold_reason = NULL, hold_since = NULL WHERE ticket_id = ? AND status IN ('Ongoing', 'OnHold')`,
                    [ticketId]
                );

                if (dbResult.affectedRows > 0) {
                    const sourcePhoneLast4 = (senderNumber || '').slice(-4);
                    await insertTicketLog(pool, {
                        ticket_id: ticketId,
                        action: 'status_change',
                        from_status: fromStatus,
                        to_status: 'Unresolved',
                        actor_type: 'sms_lineman',
                        metadata: { source_phone_last4: sourcePhoneLast4, keyword: 'unfixed' }
                    });
                    console.log(`✅ SUCCESS: Ticket ${ticketId} marked as Unresolved.`);
                }
            }
        } else if (nffMatch) {
            const ticketId = nffMatch[1].toUpperCase();
            const remarks = nffMatch[2] ? nffMatch[2].trim() : null;
            console.log(`🔍 Extracted Ticket ID (No Fault Found): ${ticketId}${remarks ? ` | Remarks: ${remarks}` : ''}`);

            const [prevNff] = await pool.execute(
                `SELECT status FROM aleco_tickets WHERE ticket_id = ? AND status IN ('Ongoing', 'OnHold')`,
                [ticketId]
            );
            if (prevNff.length === 0) {
                console.log(`⚠️ Ticket ${ticketId} not found or is not currently active (Ongoing/On Hold).`);
            } else {
                const fromStatusNff = prevNff[0].status;
                const updateQuery = remarks
                    ? `UPDATE aleco_tickets SET status = 'NoFaultFound', lineman_remarks = ?, hold_reason = NULL, hold_since = NULL WHERE ticket_id = ? AND status IN ('Ongoing', 'OnHold')`
                    : `UPDATE aleco_tickets SET status = 'NoFaultFound', hold_reason = NULL, hold_since = NULL WHERE ticket_id = ? AND status IN ('Ongoing', 'OnHold')`;
                const updateParams = remarks ? [remarks, ticketId] : [ticketId];
                const [dbResult] = await pool.execute(updateQuery, updateParams);

                if (dbResult.affectedRows > 0) {
                    const sourcePhoneLast4 = (senderNumber || '').slice(-4);
                    await insertTicketLog(pool, {
                        ticket_id: ticketId,
                        action: 'status_change',
                        from_status: fromStatusNff,
                        to_status: 'NoFaultFound',
                        actor_type: 'sms_lineman',
                        metadata: { source_phone_last4: sourcePhoneLast4, keyword: 'nofault', lineman_remarks: remarks || null }
                    });
                    console.log(`✅ SUCCESS: Ticket ${ticketId} marked as NoFaultFound.`);
                }
            }
        } else if (accessDeniedMatch) {
            const ticketId = accessDeniedMatch[1].toUpperCase();
            const remarks = accessDeniedMatch[2] ? accessDeniedMatch[2].trim() : null;
            console.log(`🔍 Extracted Ticket ID (Access Denied): ${ticketId}${remarks ? ` | Remarks: ${remarks}` : ''}`);

            const [prevAd] = await pool.execute(
                `SELECT status FROM aleco_tickets WHERE ticket_id = ? AND status IN ('Ongoing', 'OnHold')`,
                [ticketId]
            );
            if (prevAd.length === 0) {
                console.log(`⚠️ Ticket ${ticketId} not found or is not currently active (Ongoing/On Hold).`);
            } else {
                const fromStatusAd = prevAd[0].status;
                const updateQuery = remarks
                    ? `UPDATE aleco_tickets SET status = 'AccessDenied', lineman_remarks = ?, hold_reason = NULL, hold_since = NULL WHERE ticket_id = ? AND status IN ('Ongoing', 'OnHold')`
                    : `UPDATE aleco_tickets SET status = 'AccessDenied', hold_reason = NULL, hold_since = NULL WHERE ticket_id = ? AND status IN ('Ongoing', 'OnHold')`;
                const updateParams = remarks ? [remarks, ticketId] : [ticketId];
                const [dbResult] = await pool.execute(updateQuery, updateParams);

                if (dbResult.affectedRows > 0) {
                    const sourcePhoneLast4 = (senderNumber || '').slice(-4);
                    await insertTicketLog(pool, {
                        ticket_id: ticketId,
                        action: 'status_change',
                        from_status: fromStatusAd,
                        to_status: 'AccessDenied',
                        actor_type: 'sms_lineman',
                        metadata: { source_phone_last4: sourcePhoneLast4, keyword: 'nores', lineman_remarks: remarks || null }
                    });
                    console.log(`✅ SUCCESS: Ticket ${ticketId} marked as AccessDenied.`);
                }
            }
        } else if (holdMatch) {
            const ticketId = holdMatch[1].toUpperCase();
            const reason = holdMatch[2] ? holdMatch[2].trim() : 'Awaiting materials or clearance';
            console.log(`🔍 Extracted Ticket ID (Hold): ${ticketId} | Reason: ${reason}`);

            const [dbResult] = await pool.execute(
                `UPDATE aleco_tickets SET status = 'OnHold', hold_reason = ?, hold_since = ? WHERE ticket_id = ? AND status IN ('Ongoing', 'OnHold')`,
                [reason, nowPhilippineForMysql(), ticketId]
            );

            if (dbResult.affectedRows > 0) {
                console.log(`✅ SUCCESS: Ticket ${ticketId} marked as On Hold.`);
            }
        } else if (enrouteMatch) {
            const ticketId = enrouteMatch[1].toUpperCase();
            const etaUpdate = enrouteMatch[2] ? enrouteMatch[2].trim() : null;
            console.log(`🔍 Extracted Ticket ID (En Route): ${ticketId}${etaUpdate ? ` | ETA: ${etaUpdate}` : ''}`);

            const phNow = nowPhilippineForMysql();
            const updateQuery = etaUpdate
                ? `UPDATE aleco_tickets SET eta = ? WHERE ticket_id = ? AND status IN ('Ongoing', 'OnHold')`
                : `UPDATE aleco_tickets SET updated_at = ? WHERE ticket_id = ? AND status IN ('Ongoing', 'OnHold')`;
            const updateParams = etaUpdate ? [etaUpdate, ticketId] : [phNow, ticketId];
            const [dbResult] = await pool.execute(updateQuery, updateParams);

            if (dbResult.affectedRows > 0) {
                console.log(`✅ SUCCESS: Ticket ${ticketId} marked as En Route.`);
            }
        } else if (arrivedMatch) {
            const ticketId = arrivedMatch[1].toUpperCase();
            console.log(`🔍 Extracted Ticket ID (Arrived): ${ticketId}`);

            const [dbResult] = await pool.execute(
                `UPDATE aleco_tickets SET updated_at = ? WHERE ticket_id = ? AND status IN ('Ongoing', 'OnHold')`,
                [nowPhilippineForMysql(), ticketId]
            );

            if (dbResult.affectedRows > 0) {
                console.log(`✅ SUCCESS: Ticket ${ticketId} - Crew arrived.`);
            }
        } else {
            // 2. Parse for FIXED (lineman reports power restored) - {ticket_id} fixed | fixed {ticket_id} | standalone "fixed"
            const fixedWithId = messageText.match(new RegExp(`(?:FIXED|DONE|RESOLVED)\\s+${TICKET_ID}(?:\\s*\\|\\s*(.*))?`, 'i')) ||
                messageText.match(new RegExp(`${TICKET_ID}\\s+fixed`, 'i'));

            let ticketId = null;
            let remarks = null;

            if (fixedWithId) {
                ticketId = fixedWithId[1].toUpperCase();
                remarks = fixedWithId[2] ? fixedWithId[2].trim() : null;
            } else if (/^fixed$/i.test(messageText.trim())) {
                ticketId = await resolveTicketForCrew();
            }

            if (ticketId) {
                console.log(`🔍 Extracted Ticket ID (Fixed): ${ticketId}${remarks ? ` | Remarks: ${remarks}` : ''}`);

                const [prevFixed] = await pool.execute(
                    `SELECT status FROM aleco_tickets WHERE ticket_id = ? AND status IN ('Ongoing', 'OnHold')`,
                    [ticketId]
                );
                if (prevFixed.length === 0) {
                    console.log(`⚠️ Ticket ${ticketId} not found or is not currently active (Ongoing/On Hold).`);
                } else {
                    const fromStatusFixed = prevFixed[0].status;
                    const updateQuery = remarks
                        ? `UPDATE aleco_tickets SET status = 'Restored', lineman_remarks = ?, hold_reason = NULL, hold_since = NULL WHERE ticket_id = ? AND status IN ('Ongoing', 'OnHold')`
                        : `UPDATE aleco_tickets SET status = 'Restored', hold_reason = NULL, hold_since = NULL WHERE ticket_id = ? AND status IN ('Ongoing', 'OnHold')`;
                    const updateParams = remarks ? [remarks, ticketId] : [ticketId];
                    const [dbResult] = await pool.execute(updateQuery, updateParams);

                    if (dbResult.affectedRows > 0) {
                        const sourcePhoneLast4 = (senderNumber || '').slice(-4);
                        await insertTicketLog(pool, {
                            ticket_id: ticketId,
                            action: 'status_change',
                            from_status: fromStatusFixed,
                            to_status: 'Restored',
                            actor_type: 'sms_lineman',
                            metadata: { source_phone_last4: sourcePhoneLast4, keyword: 'fixed', lineman_remarks: remarks || null }
                        });
                        console.log(`✅ SUCCESS: Ticket ${ticketId} automatically marked as Restored!`);
                    }
                }
            } else {
                console.log(`ℹ️ SMS Ignored: Did not match known keyword format.`);
            }
        }

        // 4. Always return 200 OK so Yeastar knows we received it successfully
        res.status(200).send("OK");

    } catch (error) {
        console.error("❌ YEASTAR WEBHOOK ERROR:", error);
        res.status(500).send("Internal Server Error");
    }
});

// ============================================================================
// DUPLICATE DETECTION ROUTE (Check for similar tickets before creation)
// ============================================================================
router.post('/check-duplicates', async (req, res) => {
    try {
        const { phone_number, concern, category } = req.body;
        const normalizedPhone = normalizePhoneForDB(phone_number);
        if (!normalizedPhone) {
            return res.status(400).json({
                success: false,
                invalidPhone: true,
                message: INVALID_PHONE_MESSAGE
            });
        }

        console.log(`🔍 Checking for duplicates: ${normalizedPhone} | ${concern}`);

        // Search for tickets from the same phone number in the last 24 hours
        const duplicateQuery = `
            SELECT ticket_id, concern, category, status, created_at
            FROM aleco_tickets
            WHERE phone_number = ?
            AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            AND status IN ('Pending', 'Ongoing', 'Unresolved', 'OnHold')
            ORDER BY created_at DESC
            LIMIT 5
        `;

        const [potentialDuplicates] = await pool.execute(duplicateQuery, [normalizedPhone]);

        if (potentialDuplicates.length === 0) {
            return res.status(200).json({
                success: true,
                hasDuplicates: false,
                message: 'No duplicates found'
            });
        }

        // Calculate similarity scores for each potential duplicate
        const duplicatesWithScores = potentialDuplicates.map(ticket => {
            const concernSimilarity = calculateSimilarity(concern.toLowerCase(), ticket.concern.toLowerCase());
            const categorySimilarity = category === ticket.category ? 1 : 0;

            // Calculate time proximity (more recent = higher score)
            const hoursSinceCreation = (Date.now() - new Date(ticket.created_at).getTime()) / (1000 * 60 * 60);
            const timeProximity = Math.max(0, 1 - (hoursSinceCreation / 24));

            // Weighted score: 50% concern, 30% category, 20% time
            const overallScore = (concernSimilarity * 0.5) + (categorySimilarity * 0.3) + (timeProximity * 0.2);

            return {
                ...ticket,
                similarityScore: Math.round(overallScore * 100),
                concernSimilarity: Math.round(concernSimilarity * 100),
                categorySimilarity: Math.round(categorySimilarity * 100),
                timeProximity: Math.round(timeProximity * 100)
            };
        });

        // Filter duplicates with score > 60%
        const likelyDuplicates = duplicatesWithScores.filter(d => d.similarityScore > 60);

        if (likelyDuplicates.length > 0) {
            console.log(`⚠️ Found ${likelyDuplicates.length} likely duplicates`);
            return res.status(200).json({
                success: true,
                hasDuplicates: true,
                duplicates: likelyDuplicates,
                message: `Found ${likelyDuplicates.length} similar ticket(s) from this number in the last 24 hours`
            });
        }

        res.status(200).json({
            success: true,
            hasDuplicates: false,
            message: 'No significant duplicates found'
        });

    } catch (error) {
        console.error("❌ DUPLICATE CHECK ERROR:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});

// Helper function: Calculate text similarity using Levenshtein distance
function calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    return matrix[str2.length][str1.length];
}

// ============================================================================
// GET ALL TICKET LOGS (System-wide History - must be before /:ticketId/logs)
// ============================================================================
router.get('/tickets/logs', requireAdmin, async (req, res) => {
    try {
        const { ticketId, actor_email, startDate, endDate, limit = 50, offset = 0 } = req.query;
        const conditions = [];
        const params = [];

        if (ticketId && ticketId.trim()) {
            conditions.push('ticket_id = ?');
            params.push(ticketId.trim());
        }
        if (actor_email && actor_email.trim()) {
            conditions.push('actor_email = ?');
            params.push(actor_email.trim());
        }
        if (startDate) {
            conditions.push('DATE(created_at) >= ?');
            params.push(startDate);
        }
        if (endDate) {
            conditions.push('DATE(created_at) <= ?');
            params.push(endDate);
        }

        const whereClause = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
        const lim = clampSqlInt(limit, 1, 200, 50);
        const off = clampSqlInt(offset, 0, 50_000, 0);

        const [countRows] = await pool.execute(
            `SELECT COUNT(*) as total FROM aleco_ticket_logs${whereClause}`,
            params
        );
        const total = countRows[0]?.total ?? 0;

        const [rows] = await pool.query(
            `SELECT id, ticket_id, action, from_status, to_status, actor_type, actor_email, actor_name, metadata, created_at
             FROM aleco_ticket_logs${whereClause} ORDER BY created_at DESC LIMIT ${lim} OFFSET ${off}`,
            params
        );
        const data = rows.map(r => {
            let meta = r.metadata;
            if (meta === null || meta === undefined) meta = null;
            else if (typeof meta === 'string' && meta) {
                try { meta = JSON.parse(meta); } catch { meta = null; }
            } else if (Buffer.isBuffer(meta)) {
                try { meta = JSON.parse(meta.toString()); } catch { meta = null; }
            }
            return { ...r, metadata: meta, created_at: toIsoForClient(r.created_at) ?? r.created_at };
        });

        res.json({ success: true, data, total });
    } catch (error) {
        console.error('❌ GET ALL LOGS ERROR:', error);
        const msg = error.message || 'Internal Server Error';
        if (msg.includes("doesn't exist") || msg.includes('aleco_ticket_logs')) {
            return res.status(500).json({ success: false, message: 'Ticket logs table not found.' });
        }
        res.status(500).json({ success: false, message: msg });
    }
});

// ============================================================================
// GET TICKET LOGS (Single ticket - History / Audit Trail)
// ============================================================================
router.get('/tickets/:ticketId/logs', requireAdmin, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const [rows] = await pool.execute(
            `SELECT id, ticket_id, action, from_status, to_status, actor_type, actor_id, actor_email, actor_name, metadata, created_at
             FROM aleco_ticket_logs
             WHERE ticket_id = ?
             ORDER BY created_at DESC`,
            [ticketId]
        );
        const data = rows.map(r => {
            let meta = r.metadata;
            if (meta === null || meta === undefined) meta = null;
            else if (typeof meta === 'string' && meta) {
                try { meta = JSON.parse(meta); } catch { meta = null; }
            } else if (Buffer.isBuffer(meta)) {
                try { meta = JSON.parse(meta.toString()); } catch { meta = null; }
            }
            return { ...r, metadata: meta, created_at: toIsoForClient(r.created_at) ?? r.created_at };
        });
        res.json({ success: true, data });
    } catch (error) {
        console.error('❌ GET LOGS ERROR:', error);
        const msg = error.message || 'Internal Server Error';
        if (msg.includes("doesn't exist") || msg.includes('aleco_ticket_logs')) {
            return res.status(500).json({ success: false, message: 'Ticket logs table not found. Run: node backend/run-migration.js backend/migrations/add_ticket_logs.sql' });
        }
        res.status(500).json({ success: false, message: msg });
    }
});

// ============================================================================
// MANUAL STATUS UPDATE ROUTE (For Resolved/Unresolved)
// Standard path: PUT /api/tickets/:ticketId/status
// ============================================================================
const statusUpdateHandler = async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { status } = req.body;

        console.log(`📊 Manual Status Update Request: ${ticketId} → ${status}`);

        // Validate status - Match the actual database enum
        const validStatuses = ['Pending', 'Ongoing', 'OnHold', 'Restored', 'Unresolved', 'NoFaultFound', 'AccessDenied'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            });
        }

        // Get current status before update
        const [currentRows] = await pool.execute('SELECT status FROM aleco_tickets WHERE ticket_id = ?', [ticketId]);
        const fromStatus = currentRows.length > 0 ? currentRows[0].status : null;

        // Update the database
        const updateQuery = `
            UPDATE aleco_tickets
            SET status = ?
            WHERE ticket_id = ?
        `;
        const [dbResult] = await pool.execute(updateQuery, [status, ticketId]);

        if (dbResult.affectedRows > 0) {
            const actorEmail = req.body.actor_email || req.headers['x-user-email'];
            const actorName = req.body.actor_name || req.headers['x-user-name'];
            await insertTicketLog(pool, {
                ticket_id: ticketId,
                action: 'status_change',
                from_status: fromStatus,
                to_status: status,
                actor_type: actorEmail || actorName ? 'dispatcher' : 'system',
                actor_email: actorEmail || null,
                actor_name: actorName || 'System',
                metadata: null
            });

            console.log(`✅ SUCCESS: Ticket ${ticketId} updated to ${status}`);
            res.status(200).json({ success: true, message: `Ticket ${ticketId} marked as ${status}` });
        } else {
            res.status(404).json({ success: false, message: `Ticket ${ticketId} not found` });
        }

    } catch (error) {
        console.error("❌ STATUS UPDATE ERROR:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

router.put('/tickets/:ticketId/status', requireAdmin, statusUpdateHandler);
router.put('/:ticketId/status', requireAdmin, statusUpdateHandler); // Legacy - backward compat

// ============================================================================
// PERSONNEL MANAGEMENT ROUTES (Surgically Updated for 3-Table Architecture)
// ============================================================================

// --- 1. GET ALL CREWS (With Dynamic Member Counts & Lead Names) ---
router.get('/crews/list', requireAdmin, async (req, res) => {
    try {
        const availableOnly = req.query.availableOnly === 'true';

        const crewSql = `
            SELECT 
                c.id, 
                c.crew_name, 
                c.phone_number, 
                c.status,
                c.lead_lineman AS lead_id,
                l.full_name AS lead_lineman_name,
                l.status AS lead_status,
                l.leave_start AS lead_leave_start,
                l.leave_end AS lead_leave_end
            FROM aleco_personnel c
            LEFT JOIN aleco_linemen_pool l ON c.lead_lineman = l.id
            ORDER BY c.created_at DESC
        `;
        let [crews] = await pool.execute(crewSql);

        if (availableOnly) {
            crews = crews.filter(c => {
                const crewStatus = (c.status || 'Available').toLowerCase();
                const leadStatus = (c.lead_status || 'Active').toLowerCase();
                const isAvailable = crewStatus === 'available';
                const leadActive = leadStatus === 'active';
                const hasPhone = c.phone_number && c.phone_number.trim() !== '';
                return isAvailable && leadActive && hasPhone;
            });
        }

        const [memberships] = await pool.execute(`
            SELECT 
                cm.crew_id, 
                cm.lineman_id,
                l.full_name AS lineman_name
            FROM aleco_crew_members cm
            LEFT JOIN aleco_linemen_pool l ON cm.lineman_id = l.id
        `);

        const formattedCrews = crews.map(crew => {
            const crewMembers = memberships
                .filter(m => String(m.crew_id) === String(crew.id));
                
            return {
                ...crew,
                members: crewMembers.map(m => m.lineman_id),
                member_names: crewMembers.map(m => m.lineman_name || 'Unnamed Lineman'),
                member_count: crewMembers.length
            };
        });

        console.log(`✅ Crews Fetched: ${formattedCrews.length} crews`);
        res.status(200).json(formattedCrews);
    } catch (error) {
        console.error("❌ Error fetching crews:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// --- 2. CREATE NEW CREW (With Junction Table Insertion) ---
router.post('/crews/add', requireAdmin, async (req, res) => {
    const { crew_name, lead_id, phone_number, members } = req.body;

    // P1 Conflict validation: Orphaned crew - must have at least one member
    if (!members || members.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Crew must have at least one member. Cannot create an orphaned crew.'
        });
    }

    // P1 Conflict validation: Inactive linemen in crew
    const memberIds = members.map(Number);
    const placeholders = memberIds.map(() => '?').join(', ');
    const [linemenStatus] = await pool.execute(
        `SELECT id, full_name, status FROM aleco_linemen_pool WHERE id IN (${placeholders})`,
        memberIds
    );
    const inactiveMembers = linemenStatus.filter(l => (l.status || 'Active').toLowerCase() !== 'active');
    if (inactiveMembers.length > 0) {
        const names = inactiveMembers.map(l => l.full_name).join(', ');
        return res.status(400).json({
            success: false,
            message: `Cannot add inactive linemen to crew: ${names}. Please remove them or reactivate them first.`
        });
    }

    // P1 Conflict validation: Lead must be in members when members exist
    if (lead_id && !members.includes(Number(lead_id))) {
        return res.status(400).json({
            success: false,
            message: 'Lead lineman must be one of the selected crew members.'
        });
    }

    // We use a connection from the pool so we can do a transaction (rollback if it fails)
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        const formattedPhone = normalizePhoneForDB(phone_number);
        if (!formattedPhone) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: INVALID_PHONE_MESSAGE
            });
        }

        // 1. Insert the main crew
        const [crewResult] = await connection.execute(
            `INSERT INTO aleco_personnel (crew_name, lead_lineman, phone_number) VALUES (?, ?, ?)`, 
            [crew_name, lead_id || null, formattedPhone]
        );
        const newCrewId = crewResult.insertId;

        // 2. Insert into the Junction Table (aleco_crew_members)
        if (members && members.length > 0) {
            const memberValues = members.map(linemanId => [newCrewId, linemanId]);
            // Bulk insert syntax: INSERT INTO table (c1, c2) VALUES (?, ?), (?, ?)
            const placeholders = members.map(() => '(?, ?)').join(', ');
            const flatValues = memberValues.flat();
            
            await connection.execute(
                `INSERT INTO aleco_crew_members (crew_id, lineman_id) VALUES ${placeholders}`,
                flatValues
            );
        }

        await connection.commit(); // Save everything
        const actorEmail = req.headers['x-user-email'] || null;
        const actorName  = req.headers['x-user-name']  || null;
        await logPersonnelAction(pool, actorEmail, actorName, 'add_crew', crew_name);
        await recordPersonnelNotification(pool, {
          eventType: PERSONNEL_EVENT.CREW_CREATED,
          subjectName: crew_name,
          detail: newCrewId ? `Crew #${newCrewId}` : null,
          actorEmail: actorEmailFromReq(req),
        });
        res.status(201).json({ success: true, message: 'New crew successfully assembled.' });
    } catch (error) {
        await connection.rollback(); // Undo if something broke
        console.error("Error adding crew:", error);
        res.status(500).json({ success: false, message: error.code === 'ER_DUP_ENTRY' ? "Crew name already exists." : "Server error." });
    } finally {
        connection.release();
    }
});

// --- 3. UPDATE CREW (Wipe old members, insert new ones) ---
router.put('/crews/update/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { crew_name, lead_id, phone_number, status, members } = req.body;

    // P1 Conflict validation: Orphaned crew - must have at least one member
    const memberList = Array.isArray(members) ? members : [];
    if (memberList.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Crew must have at least one member. Cannot save an orphaned crew.'
        });
    }

    // P1 Conflict validation: Inactive linemen in crew
    const memberIds = memberList.map(Number);
    const placeholders = memberIds.map(() => '?').join(', ');
    const [linemenStatus] = await pool.execute(
        `SELECT id, full_name, status FROM aleco_linemen_pool WHERE id IN (${placeholders})`,
        memberIds
    );
    const inactiveMembers = linemenStatus.filter(l => (l.status || 'Active').toLowerCase() !== 'active');
    if (inactiveMembers.length > 0) {
        const names = inactiveMembers.map(l => l.full_name).join(', ');
        return res.status(400).json({
            success: false,
            message: `Cannot add inactive linemen to crew: ${names}. Please remove them or reactivate them first.`
        });
    }

    // P1 Conflict validation: Lead must be in members
    if (lead_id && !memberList.includes(Number(lead_id))) {
        return res.status(400).json({
            success: false,
            message: 'Lead lineman must be one of the selected crew members.'
        });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        const formattedPhone = normalizePhoneForDB(phone_number);
        if (!formattedPhone) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: INVALID_PHONE_MESSAGE
            });
        }

        // 1. Update the main crew table
        await connection.execute(
            `UPDATE aleco_personnel SET crew_name = ?, lead_lineman = ?, phone_number = ?, status = ? WHERE id = ?`,
            [crew_name, lead_id || null, formattedPhone, status || 'Available', id]
        );

        // 2. Wipe existing members for this crew
        await connection.execute(`DELETE FROM aleco_crew_members WHERE crew_id = ?`, [id]);

        // 3. Insert the newly selected members
        if (memberList.length > 0) {
            const memberValues = memberList.map(linemanId => [id, linemanId]);
            const placeholders = members.map(() => '(?, ?)').join(', ');
            const flatValues = memberValues.flat();
            
            await connection.execute(
                `INSERT INTO aleco_crew_members (crew_id, lineman_id) VALUES ${placeholders}`,
                flatValues
            );
        }

        await connection.commit();
        const actorEmail = req.headers['x-user-email'] || null;
        const actorName  = req.headers['x-user-name']  || null;
        await logPersonnelAction(pool, actorEmail, actorName, 'update_crew', crew_name);
        res.status(200).json({ success: true, message: 'Crew information updated.' });
    } catch (error) {
        await connection.rollback();
        console.error("Error updating crew:", error);
        res.status(500).json({ success: false, message: "Failed to update crew." });
    } finally {
        connection.release();
    }
});

// --- 4. DELETE CREW ---
router.delete('/crews/delete/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const [[crewRow]] = await pool.execute('SELECT crew_name FROM aleco_personnel WHERE id = ?', [id]);
        // Because we set ON DELETE CASCADE in SQL, deleting the crew automatically deletes their mappings in aleco_crew_members!
        await pool.execute('DELETE FROM aleco_personnel WHERE id = ?', [id]);
        const actorEmail = req.headers['x-user-email'] || null;
        const actorName  = req.headers['x-user-name']  || null;
        await logPersonnelAction(pool, actorEmail, actorName, 'delete_crew', crewRow?.crew_name || null);
        if (crewRow?.crew_name) {
          await recordPersonnelNotification(pool, {
            eventType: PERSONNEL_EVENT.CREW_DELETED,
            subjectName: crewRow.crew_name,
            detail: `Crew #${id}`,
            actorEmail: actorEmailFromReq(req),
          });
        }
        res.status(200).json({ success: true, message: 'Crew removed from system.' });
    } catch (error) {
        console.error("Error deleting crew:", error);
        res.status(500).json({ success: false, message: "Cannot delete crew; they may be linked to active tickets." });
    }
});


// ============================================================================
// LINEMEN POOL ROUTES (New!)
// ============================================================================

// GET: All Linemen
router.get('/pool/list', requireAdmin, async (req, res) => {
    try {
        const [linemen] = await pool.execute('SELECT * FROM aleco_linemen_pool ORDER BY full_name ASC');
        res.status(200).json(linemen);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST: Add new Lineman
router.post('/pool/add', requireAdmin, async (req, res) => {
    const { full_name, designation, contact_no, status, leave_start, leave_end, leave_reason } = req.body;
    try {
        const formattedPhone = normalizePhoneForDB(contact_no);
        if (!formattedPhone) {
            return res.status(400).json({
                success: false,
                message: INVALID_PHONE_MESSAGE
            });
        }

        const finalStatus = status || 'Active';
        const [insertLineman] = await pool.execute(
            `INSERT INTO aleco_linemen_pool (full_name, designation, contact_no, status, leave_start, leave_end, leave_reason) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [full_name, designation, formattedPhone, finalStatus, leave_start || null, leave_end || null, leave_reason || null]
        );
        const newLinemanId = insertLineman.insertId;
        const actorEmail = req.headers['x-user-email'] || null;
        const actorName  = req.headers['x-user-name']  || null;
        await logPersonnelAction(pool, actorEmail, actorName, 'add_lineman', full_name);
        await recordPersonnelNotification(pool, {
          eventType: PERSONNEL_EVENT.LINEMAN_CREATED,
          subjectName: full_name,
          detail: newLinemanId ? `Lineman #${newLinemanId}` : null,
          actorEmail: actorEmailFromReq(req),
        });
        res.status(201).json({ success: true, message: 'Lineman registered.' });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error." });
    }
});

// PUT: Update Lineman
router.put('/pool/update/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { full_name, designation, contact_no, status, leave_start, leave_end, leave_reason } = req.body;
    try {
        const formattedPhone = normalizePhoneForDB(contact_no);
        if (!formattedPhone) {
            return res.status(400).json({
                success: false,
                message: INVALID_PHONE_MESSAGE
            });
        }

        const finalStatus = status || 'Active';
        await pool.execute(
            `UPDATE aleco_linemen_pool SET full_name = ?, designation = ?, contact_no = ?, status = ?, leave_start = ?, leave_end = ?, leave_reason = ? WHERE id = ?`,
            [full_name, designation, formattedPhone, finalStatus, leave_start || null, leave_end || null, leave_reason || null, id]
        );
        const actorEmail = req.headers['x-user-email'] || null;
        const actorName  = req.headers['x-user-name']  || null;
        await logPersonnelAction(pool, actorEmail, actorName, 'update_lineman', full_name);
        res.status(200).json({ success: true, message: 'Lineman updated.' });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error." });
    }
});

// DELETE: Remove lineman from pool (blocked if assigned to a crew or as lead)
router.delete('/pool/delete/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const linemanId = Number(id);
    if (!Number.isFinite(linemanId)) {
        return res.status(400).json({ success: false, message: 'Invalid id.' });
    }
    try {
        const [members] = await pool.execute(
            'SELECT crew_id FROM aleco_crew_members WHERE lineman_id = ? LIMIT 1',
            [linemanId]
        );
        if (members.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete this lineman while they are assigned to a crew. Remove them from the crew first.',
            });
        }
        const [leads] = await pool.execute(
            'SELECT id, crew_name FROM aleco_personnel WHERE lead_lineman = ? LIMIT 1',
            [linemanId]
        );
        if (leads.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete: this lineman is lead of crew "${leads[0].crew_name}". Reassign the crew lead first.`,
            });
        }
        const [[linemanRow]] = await pool.execute('SELECT full_name FROM aleco_linemen_pool WHERE id = ?', [linemanId]);
        const [result] = await pool.execute('DELETE FROM aleco_linemen_pool WHERE id = ?', [linemanId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Lineman not found.' });
        }
        const actorEmail = req.headers['x-user-email'] || null;
        const actorName  = req.headers['x-user-name']  || null;
        await logPersonnelAction(pool, actorEmail, actorName, 'delete_lineman', linemanRow?.full_name || null);
        await recordPersonnelNotification(pool, {
          eventType: PERSONNEL_EVENT.LINEMAN_DELETED,
          subjectName: linemanRow?.full_name || null,
          detail: `Lineman #${linemanId}`,
          actorEmail: actorEmailFromReq(req),
        });
        res.status(200).json({ success: true, message: 'Lineman removed from pool.' });
    } catch (error) {
        console.error('Error deleting lineman from pool:', error);
        res.status(500).json({ success: false, message: 'Cannot delete lineman.' });
    }
});

export default router;
