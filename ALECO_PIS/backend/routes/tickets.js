import express from 'express';
import nodemailer from 'nodemailer';
import pool from '../config/db.js';
import { upload } from '../../cloudinaryConfig.js'; // <-- Adjusted path to go up two folders
import axios from 'axios';

const router = express.Router();

// The Mailman Configuration (Needed for sending ticket copies)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendPhilSMS = async (number, messageBody) => {
    try {
        let formattedNumber = number.startsWith('0') ? '63' + number.substring(1) : number;
        
        // Exact endpoint from your dashboard
        const url = 'https://dashboard.philsms.com/api/v3/sms/send';

        const payload = {
            recipient: formattedNumber,
            message: messageBody,
            sender_id: process.env.PHILSMS_SENDER_ID || 'PhilSMS'
        };

        const response = await axios.post(url, payload, {
            headers: { 
                'Authorization': `Bearer ${process.env.PHILSMS_API_KEY}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        if (response.data.status === 'success') {
            console.log(`✅ PhilSMS Success! Message sent to ${formattedNumber}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error(`❌ PhilSMS Error:`, error.response?.data || error.message);
        return false;
    }
};

// --- 1. THE MASTER TICKET SUBMISSION ROUTE ---
router.post('/tickets/submit', upload.single('image'), async (req, res) => {
    try {
        // 1. Generate the Manila Timestamp as a MySQL-friendly string
        // This fixes the time drift by using your Node.js system time
        const manilaTime = new Date().toISOString().slice(0, 19).replace('T', ' '); 

        // 2. Pull data from the form fields (REMOVED 'location')
        const { 
            account_number, first_name, middle_name, last_name, 
            phone_number, address, category, concern,
            district, municipality, barangay, purok, is_urgent
        } = req.body;

        console.log("Received Concern:", concern);
        console.log("Received Urgent Flag:", is_urgent);

        // 3. IDEMPOTENCY CHECK (Anti-Spam / Double-Click Prevention)
        // We now pass manilaTime as the 4th parameter to fix the malformed packet error
        const duplicateCheckSql = `
            SELECT ticket_id FROM aleco_tickets 
            WHERE phone_number = ? 
              AND category = ? 
              AND concern = ? 
              AND created_at >= ? - INTERVAL 5 MINUTE
            LIMIT 1
        `;
        const [existingTickets] = await pool.execute(duplicateCheckSql, [
            phone_number, 
            category, 
            concern, 
            manilaTime // Correctly synced 4th parameter
        ]);

        if (existingTickets.length > 0) {
            return res.status(200).json({
                success: true,
                ticketId: existingTickets[0].ticket_id,
                message: "Your report has already been received. Thank you!"
            });
        }

        // 4. Process the Image and Generate Ticket ID
        const image_url = req.file ? req.file.path : null;
        const ticket_id = `ALECO-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

        // 5. THE FIX: Removed 'location' and adjusted placeholders to exactly 16 '?'
        const sql = `
            INSERT INTO aleco_tickets 
            (ticket_id, account_number, first_name, middle_name, last_name, 
             phone_number, address, district, municipality, barangay, purok, 
             category, concern, image_url, status, created_at, is_urgent) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?)
        `;

        // 6. THE FIX: Execution Array now perfectly matches the 16 '?' placeholders
        await pool.execute(sql, [
            ticket_id,                       // 1
            account_number || null,          // 2
            first_name || null,              // 3
            middle_name || null,             // 4
            last_name || null,               // 5
            phone_number || null,            // 6
            address || null,                 // 7
            district || null,                // 8
            municipality || null,            // 9
            barangay || null,                // 10
            purok || null,                   // 11
            category || null,                // 12
            concern || null,                 // 13
            image_url || null,               // 14
            manilaTime,                      // 15
            is_urgent == 1 ? 1 : 0           // 16
        ]);

        // 7. Success Response
        res.status(201).json({ 
            success: true, 
            ticketId: ticket_id,
            message: "Your report has been received by ALECO." 
        });

    } catch (error) {
        console.error("Database Error:", error);
        res.status(500).json({ success: false, message: "Server error, please try again later." });
    }
});

// --- 2. TRACK TICKET ROUTE ---
router.get('/tickets/track/:ticketId', async (req, res) => {
    try {
        const { ticketId } = req.params;

        // 1. ADDED BASIC VALIDATION: Prevents empty queries from hitting the DB
        if (!ticketId || ticketId.trim() === '') {
            return res.status(400).json({ success: false, message: "Please provide a valid Ticket ID." });
        }

        // 2. FIXED SQL QUERY: We are now explicitly asking for the names!
       const [rows] = await pool.execute(
            `SELECT 
                first_name, 
                middle_name, 
                last_name, 
                status, 
                created_at, 
                concern,
                municipality,
                barangay 
             FROM aleco_tickets 
             WHERE ticket_id = ?`,
            [ticketId]
        );

        if (rows.length === 0) {
            // Made the error message a bit more user-friendly
            return res.status(404).json({ success: false, message: "Ticket ID not found. Please check your tracking number and try again." });
        }

        res.json({ success: true, data: rows[0] });
        
    } catch (error) {
        // 3. SECURITY FIX: Never send `error.message` to the frontend in production! 
        // It can expose your SQL table structures to hackers. Log it securely instead.
        console.error("Database Tracking Error:", error);
        res.status(500).json({ success: false, message: "An internal server error occurred. Please try again later." });
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
        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: "Copy sent to your email!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Email failed to send." });
    }
}); // <-- Route 3 safely closes here!


// --- ADMIN: DISPATCH TICKET ROUTE (PHILSMS INTEGRATION) ---
router.put('/tickets/:ticket_id/dispatch', async (req, res) => {
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
        const linemanMsg = `ALECO DISPATCH: Ticket ${ticket_id}. Reply 'FIXED ${ticket_id}' when done.`;
        await sendPhilSMS(lineman_phone, linemanMsg);
        console.log(`✅ SMS sent to Lineman (${assigned_crew}): ${lineman_phone}`);

        // 2. Notify Consumer (If toggled & number exists)
        if (is_consumer_notified && consumer_phone) {
            const consumerMsg = `ALECO: Crew ${assigned_crew} dispatched for your concern. ETA: ${eta}. Ticket: ${ticket_id}`;
            await sendPhilSMS(consumer_phone, consumerMsg);
            console.log(`✅ SMS sent to Consumer: ${consumer_phone}`);
        }

        // --- PHASE 3: DATABASE UPDATE ---
        console.log("➡️ Phase 3 (DB Update) Starting...");
        
        const updateQuery = `
            UPDATE aleco_tickets 
            SET status = 'Ongoing', 
                assigned_crew = ?, 
                eta = ?, 
                is_consumer_notified = ?, 
                dispatch_notes = ?
            WHERE ticket_id = ?
        `;

        const [dbResult] = await pool.execute(updateQuery, [
            assigned_crew, 
            eta, 
            is_consumer_notified ? 1 : 0, 
            dispatch_notes || '', 
            ticket_id
        ]);

        if (dbResult.affectedRows > 0) {
            console.log(`✅ DATABASE SUCCESS: Ticket ${ticket_id} updated to Ongoing.`);
            res.status(200).json({ success: true, message: 'Dynamic Dispatch Complete!' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to update ticket status.' });
        }

    } catch (error) {
        console.error("❌ CRITICAL DISPATCH ERROR:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

// --- HELPER: GET ALL CREWS (For Frontend Table & Dropdown) ---
router.get('/crews/list', async (req, res) => {
    try {
        // We now select ID, phone, status, and map lead_lineman properly
        const sql = `
            SELECT 
                id, 
                crew_name, 
                lead_lineman AS lead_lineman_name, 
                phone_number, 
                status 
            FROM aleco_personnel
            ORDER BY created_at DESC
        `;
        const [crews] = await pool.execute(sql);
        res.status(200).json(crews);
    } catch (error) {
        console.error("Error fetching crews:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// --- 5. AUTOMATED SMS WEBHOOK (Lineman Return Trip) ---
router.post('/tickets/sms-webhook', async (req, res) => {
    const { message, sender_number } = req.body;

    if (!message) {
        return res.status(400).json({ success: false, error: 'No message provided' });
    }

    try {
        const regex = /^(FIXED|UNFIXED)\s+([A-Z0-9\-]+)(?:\s+(.*))?$/i;
        const match = message.trim().match(regex);

        if (!match) {
            console.log(`[SMS ERROR] Unrecognized format from ${sender_number}: "${message}"`);
            return res.status(200).send('Format not recognized. Use: FIXED [ID] [Notes]'); 
        }

        const keyword = match[1].toUpperCase();
        const rawTicketId = match[2].toUpperCase();
        const linemanNotes = match[3] || 'No additional remarks provided.';

        const newStatus = keyword === 'FIXED' ? 'Restored' : 'Unresolved';

        const updateQuery = `
            UPDATE aleco_tickets 
            SET status = ?, 
                lineman_remarks = ?
            WHERE ticket_id = ? OR ticket_id LIKE CONCAT('%', ?)
        `;
        
        const [result] = await pool.execute(updateQuery, [newStatus, linemanNotes, rawTicketId, rawTicketId]);

        if (result.affectedRows === 0) {
            console.log(`[SMS ERROR] Ticket ${rawTicketId} not found in database.`);
            return res.status(200).send('Ticket ID not found.');
        }

        console.log(`\n==============================================`);
        console.log(`[🤖 AUTOMATION] Lineman SMS Received!`);
        console.log(`Action: ${keyword} | Ticket: ${rawTicketId}`);
        console.log(`Notes: ${linemanNotes}`);
        console.log(`Database Status changed to: ${newStatus}`);
        console.log(`==============================================\n`);

        res.status(200).send('SMS Processed Successfully');

    } catch (error) {
        console.error('Error processing SMS webhook:', error);
        res.status(500).send('Internal Server Error');
    }
});

// --- 6. PERSONNEL MANAGEMENT: CREATE (Add New Crew) ---
router.post('/crews/add', async (req, res) => {
    const { crew_name, lead_lineman, phone_number } = req.body;
    
    try {
        // Validation: Ensure the phone number starts with '63' for PhilSMS compatibility
        let formattedPhone = phone_number.trim();
        if (formattedPhone.startsWith('0')) {
            formattedPhone = '63' + formattedPhone.substring(1);
        }

        const sql = `INSERT INTO aleco_personnel (crew_name, lead_lineman, phone_number) VALUES (?, ?, ?)`;
        await pool.execute(sql, [crew_name, lead_lineman, formattedPhone]);

        res.status(201).json({ success: true, message: 'New crew successfully registered.' });
    } catch (error) {
        console.error("Error adding crew:", error);
        res.status(500).json({ success: false, message: error.code === 'ER_DUP_ENTRY' ? "Crew name already exists." : "Server error." });
    }
});

// --- 7. PERSONNEL MANAGEMENT: UPDATE (Edit Crew Details) ---
router.put('/crews/update/:id', async (req, res) => {
    const { id } = req.params;
    const { crew_name, lead_lineman, phone_number, status } = req.body;

    try {
        let formattedPhone = phone_number.trim();
        if (formattedPhone.startsWith('0')) {
            formattedPhone = '63' + formattedPhone.substring(1);
        }

        const sql = `
            UPDATE aleco_personnel 
            SET crew_name = ?, lead_lineman = ?, phone_number = ?, status = ? 
            WHERE id = ?
        `;
        await pool.execute(sql, [crew_name, lead_lineman, formattedPhone, status, id]);

        res.status(200).json({ success: true, message: 'Crew information updated.' });
    } catch (error) {
        console.error("Error updating crew:", error);
        res.status(500).json({ success: false, message: "Failed to update crew." });
    }
});

// --- 8. PERSONNEL MANAGEMENT: DELETE (Remove Crew) ---
router.delete('/crews/delete/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.execute('DELETE FROM aleco_personnel WHERE id = ?', [id]);
        res.status(200).json({ success: true, message: 'Crew removed from system.' });
    } catch (error) {
        console.error("Error deleting crew:", error);
        res.status(500).json({ success: false, message: "Cannot delete crew; they may be linked to active tickets." });
    }
});

export default router;