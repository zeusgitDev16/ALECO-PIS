import express from 'express';
import nodemailer from 'nodemailer';
import pool from '../config/db.js';
import { upload } from '../../cloudinaryConfig.js'; // <-- Adjusted path to go up two folders

const router = express.Router();

// The Mailman Configuration (Needed for sending ticket copies)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

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

    // --- 4. ADMIN: DISPATCH TICKET ROUTE ---
router.put('/tickets/:ticket_id/dispatch', async (req, res) => {
    const { ticket_id } = req.params;
    const { assigned_crew, eta, is_consumer_notified, dispatch_notes } = req.body;

    try {
        // 1. Prepare the SQL Update Statement
        // Changes status to 'Ongoing' and injects the dispatch data
        const updateQuery = `
            UPDATE aleco_tickets 
            SET status = 'Ongoing', 
                assigned_crew = ?, 
                eta = ?, 
                is_consumer_notified = ?, 
                dispatch_notes = ?
            WHERE ticket_id = ?
        `;

        // Map boolean to tinyint (1 or 0) for MySQL
        const isNotifiedInt = is_consumer_notified ? 1 : 0;
        const values = [assigned_crew, eta, isNotifiedInt, dispatch_notes, ticket_id];

        // 2. Execute the Query
        const [result] = await pool.execute(updateQuery, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Ticket not found.' });
        }

        // 3. The Future SMS Gateway Mocks (Logged to Terminal)
        console.log(`\n==============================================`);
        console.log(`[DISPATCH SYSTEM] Ticket ${ticket_id} moved to ONGOING.`);
        console.log(`Assigned To: ${assigned_crew} | ETA: ${eta}`);
        
        if (is_consumer_notified) {
            console.log(`[SMS OUT] 📱 To Consumer: "ALECO Update: ${assigned_crew} has been dispatched to your area for Ticket ${ticket_id}. ETA: ${eta}."`);
        }

        console.log(`[SMS OUT] 📱 To Lineman: "ALECO DISPATCH: Ticket ${ticket_id}. Reply 'FIXED ${ticket_id}' or 'UNFIXED ${ticket_id} [Reason]' when done."`);
        console.log(`==============================================\n`);

        // 4. Send Success Response to Frontend
        res.status(200).json({ 
            success: true, 
            message: 'Crew dispatched successfully.',
            status: 'Ongoing'
        });

    } catch (error) {
        console.error('Error dispatching ticket:', error);
        res.status(500).json({ success: false, message: 'Internal server error during dispatch.' });
    }
});

    try {
        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: "Copy sent to your email!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Email failed to send." });
    }
});

export default router;