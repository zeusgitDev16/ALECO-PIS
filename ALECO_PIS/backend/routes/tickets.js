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

        // 2. Pull data from the form fields
        const { 
            account_number, first_name, middle_name, last_name, 
            phone_number, address, location, category, concern 
        } = req.body;

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

        // 5. THE FIX: Balanced SQL Columns and Placeholders
        const sql = `
            INSERT INTO aleco_tickets 
            (ticket_id, account_number, first_name, middle_name, last_name, phone_number, address, location, category, concern, image_url, status, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?)
        `;

        // 6. THE FIX: Execution Array now correctly has 12 items
        await pool.execute(sql, [
            ticket_id,               // 1
            account_number || null,  // 2
            first_name,              // 3
            middle_name || null,     // 4
            last_name,               // 5
            phone_number,            // 6
            address,                 // 7
            location || null,        // 8
            category,                // 9
            concern,                 // 10
            image_url,               // 11
            manilaTime               // 12: Matches the new '?' for created_at
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
                concern 
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
});

export default router;