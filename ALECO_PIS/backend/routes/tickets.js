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

// ============================================================================
// PERSONNEL MANAGEMENT ROUTES (Surgically Updated for 3-Table Architecture)
// ============================================================================

// --- 1. GET ALL CREWS (With Dynamic Member Counts & Lead Names) ---
router.get('/crews/list', async (req, res) => {
    try {
        // Fetch crews and join with the linemen pool to get the Lead's real name
        const crewSql = `
            SELECT 
                c.id, 
                c.crew_name, 
                c.phone_number, 
                c.status,
                c.lead_lineman AS lead_id,
                l.full_name AS lead_lineman_name
            FROM aleco_personnel c
            LEFT JOIN aleco_linemen_pool l ON c.lead_lineman = l.id
            ORDER BY c.created_at DESC
        `;
        const [crews] = await pool.execute(crewSql);

        // Fetch all crew members to attach to their respective crews
        const [memberships] = await pool.execute('SELECT crew_id, lineman_id FROM aleco_crew_members');

        // Map the members into an array for the React Frontend (e.g., members: [5, 8, 12])
        const formattedCrews = crews.map(crew => {
            const crewMembers = memberships
                .filter(m => m.crew_id === crew.id)
                .map(m => m.lineman_id);
                
            return {
                ...crew,
                members: crewMembers,
                member_count: crewMembers.length
            };
        });

        res.status(200).json(formattedCrews);
    } catch (error) {
        console.error("Error fetching crews:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// --- 2. CREATE NEW CREW (With Junction Table Insertion) ---
router.post('/crews/add', async (req, res) => {
    const { crew_name, lead_id, phone_number, members } = req.body;
    
    // We use a connection from the pool so we can do a transaction (rollback if it fails)
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        let formattedPhone = phone_number.trim();
        if (formattedPhone.startsWith('0')) formattedPhone = '63' + formattedPhone.substring(1);

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
router.put('/crews/update/:id', async (req, res) => {
    const { id } = req.params;
    const { crew_name, lead_id, phone_number, status, members } = req.body;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        let formattedPhone = phone_number.trim();
        if (formattedPhone.startsWith('0')) formattedPhone = '63' + formattedPhone.substring(1);

        // 1. Update the main crew table
        await connection.execute(
            `UPDATE aleco_personnel SET crew_name = ?, lead_lineman = ?, phone_number = ?, status = ? WHERE id = ?`,
            [crew_name, lead_id || null, formattedPhone, status || 'Available', id]
        );

        // 2. Wipe existing members for this crew
        await connection.execute(`DELETE FROM aleco_crew_members WHERE crew_id = ?`, [id]);

        // 3. Insert the newly selected members
        if (members && members.length > 0) {
            const memberValues = members.map(linemanId => [id, linemanId]);
            const placeholders = members.map(() => '(?, ?)').join(', ');
            const flatValues = memberValues.flat();
            
            await connection.execute(
                `INSERT INTO aleco_crew_members (crew_id, lineman_id) VALUES ${placeholders}`,
                flatValues
            );
        }

        await connection.commit();
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
router.delete('/crews/delete/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Because we set ON DELETE CASCADE in SQL, deleting the crew automatically deletes their mappings in aleco_crew_members!
        await pool.execute('DELETE FROM aleco_personnel WHERE id = ?', [id]);
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
router.get('/pool/list', async (req, res) => {
    try {
        const [linemen] = await pool.execute('SELECT * FROM aleco_linemen_pool ORDER BY full_name ASC');
        res.status(200).json(linemen);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST: Add new Lineman
router.post('/pool/add', async (req, res) => {
    const { full_name, designation, contact_no } = req.body;
    try {
        let formattedPhone = contact_no.trim();
        if (formattedPhone.startsWith('0')) formattedPhone = '63' + formattedPhone.substring(1);

        await pool.execute(
            `INSERT INTO aleco_linemen_pool (full_name, designation, contact_no) VALUES (?, ?, ?)`,
            [full_name, designation, formattedPhone]
        );
        res.status(201).json({ success: true, message: 'Lineman registered.' });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error." });
    }
});

// PUT: Update Lineman
router.put('/pool/update/:id', async (req, res) => {
    const { id } = req.params;
    const { full_name, designation, contact_no, status } = req.body;
    try {
        let formattedPhone = contact_no.trim();
        if (formattedPhone.startsWith('0')) formattedPhone = '63' + formattedPhone.substring(1);

        await pool.execute(
            `UPDATE aleco_linemen_pool SET full_name = ?, designation = ?, contact_no = ?, status = ? WHERE id = ?`,
            [full_name, designation, formattedPhone, status || 'Active', id]
        );
        res.status(200).json({ success: true, message: 'Lineman updated.' });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error." });
    }
});

export default router;