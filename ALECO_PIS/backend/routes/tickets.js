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
        const manilaTime = new Date().toISOString().slice(0, 19).replace('T', ' '); 

        const { 
            account_number, first_name, middle_name, last_name, 
            phone_number, address, category, concern,
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

        // IDEMPOTENCY CHECK
        const duplicateCheckSql = `
            SELECT ticket_id FROM aleco_tickets 
            WHERE phone_number = ? 
              AND category = ? 
              AND concern = ? 
              AND created_at >= ? - INTERVAL 5 MINUTE
            LIMIT 1
        `;
        const [existingTickets] = await pool.execute(duplicateCheckSql, [
            phone_number, category, concern, manilaTime
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

        // --- BACKEND URGENT VALIDATION (Double-Check Frontend) ---
        const urgentKeywords = [
            'sparking', 'fire', 'sunog', 'explosion', 'sumabog', 'pumuputok',
            'electrocuted', 'nakuryente', 'live wire', 'nakabitin na wire',
            'smoke', 'usok', 'umuusok', 'burning', 'nasusunog',
            'fallen pole', 'natumba', 'nahulog na poste', 'leaning pole', 'nakahilig',
            'dangling wire', 'nakabitin', 'naputol na wire', 'cutoff wire',
            'walang kuryente', 'patay na kuryente', 'brownout', 'blackout',
            'no power', 'power outage', 'emergency', 'aksidente'
        ];

        const lowerConcern = (concern || '').toLowerCase();
        
        const backendUrgentCheck = urgentKeywords.some(keyword => {
            const regex = new RegExp(`\\b${keyword.replace(/\s+/g, '\\s+')}\\b`, 'i');
            return regex.test(lowerConcern);
        });

        // Use backend validation as source of truth
        const finalUrgentStatus = backendUrgentCheck ? 1 : 0;

        // Log discrepancies (for debugging)
        if (is_urgent != finalUrgentStatus) {
            console.warn(`⚠️ URGENT MISMATCH: Frontend=${is_urgent}, Backend=${finalUrgentStatus}`);
            console.warn(`   Concern: "${concern}"`);
        }

        console.log(`🚨 Final Urgent Status: ${finalUrgentStatus} | Concern: "${concern}"`);

        // UPDATED SQL: Now includes GPS columns (18 placeholders)
        const sql = `
            INSERT INTO aleco_tickets 
            (ticket_id, account_number, first_name, middle_name, last_name, 
             phone_number, address, district, municipality, 
             category, concern, image_url, status, created_at, is_urgent,
             reported_lat, reported_lng, location_accuracy, location_method, location_confidence) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            ticket_id,
            account_number || "",
            first_name,
            middle_name || "",
            last_name,
            phone_number,
            address,
            district || "",
            municipality || "",
            category,
            concern,
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

        console.log(`✅ TICKET CREATED: ${ticket_id} | ${municipality}, ${district}`);

        // SMS NOTIFICATION
        const smsBody = `ALECO: Your report has been received. Tracking ID: ${ticket_id}. We will update you soon.`;
        await sendPhilSMS(phone_number, smsBody);

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

        // CLEANED: Removed barangay from SELECT
        const [rows] = await pool.execute(
            `SELECT 
                first_name, 
                middle_name, 
                last_name, 
                status, 
                created_at, 
                concern,
                municipality,
                district
             FROM aleco_tickets 
             WHERE ticket_id = ?`,
            [ticketId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "Ticket ID not found. Please check your tracking number and try again." });
        }

        res.json({ success: true, data: rows[0] });
        
    } catch (error) {
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

        // 1. Parse the message for our trigger words
        // This Regex looks for "FIXED", "DONE", or "RESOLVED" followed by "ALECO-XXXXX"
        const match = messageText.match(/(?:FIXED|DONE|RESOLVED)\s+(ALECO-[A-Z0-9]+)/i);

        if (match) {
            const ticketId = match[1].toUpperCase();
            console.log(`🔍 Extracted Ticket ID: ${ticketId}`);

            // 2. Update the Database Status to Restored
            const updateQuery = `
                UPDATE aleco_tickets
                SET status = 'Restored'
                WHERE ticket_id = ? AND status = 'Ongoing'
            `;
            const [dbResult] = await pool.execute(updateQuery, [ticketId]);

            if (dbResult.affectedRows > 0) {
                console.log(`✅ SUCCESS: Ticket ${ticketId} automatically marked as Restored!`);

                // 3. OPTIONAL: Automatically text the consumer that the power is back!
                const [ticketData] = await pool.execute(
                    'SELECT phone_number, is_consumer_notified FROM aleco_tickets WHERE ticket_id = ?',
                    [ticketId]
                );

                if (ticketData.length > 0 && ticketData[0].is_consumer_notified === 1 && ticketData[0].phone_number) {
                    const resolveMsg = `ALECO Update: Your report (${ticketId}) has been RESTORED by our field crew. Thank you for your patience!`;
                    await sendPhilSMS(ticketData[0].phone_number, resolveMsg);
                    console.log(`✅ SMS sent to Consumer confirming restoration.`);
                }
            } else {
                console.log(`⚠️ Ticket ${ticketId} not found or is not currently 'Ongoing'.`);
            }
        } else {
            console.log(`ℹ️ SMS Ignored: Did not contain 'FIXED ALECO-XXXXX' format.`);
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

        console.log(`🔍 Checking for duplicates: ${phone_number} | ${concern}`);

        // Search for tickets from the same phone number in the last 24 hours
        const duplicateQuery = `
            SELECT ticket_id, concern, category, status, created_at
            FROM aleco_tickets
            WHERE phone_number = ?
            AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            AND status IN ('Pending', 'Ongoing', 'Unresolved')
            ORDER BY created_at DESC
            LIMIT 5
        `;

        const [potentialDuplicates] = await pool.execute(duplicateQuery, [phone_number]);

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
// MANUAL STATUS UPDATE ROUTE (For Resolved/Unresolved)
// ============================================================================
router.put('/:ticketId/status', async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { status } = req.body;

        console.log(`📊 Manual Status Update Request: ${ticketId} → ${status}`);

        // Validate status - Match the actual database enum
        const validStatuses = ['Pending', 'Ongoing', 'Restored', 'Unresolved'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            });
        }

        // Update the database
        const updateQuery = `
            UPDATE aleco_tickets
            SET status = ?
            WHERE ticket_id = ?
        `;
        const [dbResult] = await pool.execute(updateQuery, [status, ticketId]);

        if (dbResult.affectedRows > 0) {
            console.log(`✅ SUCCESS: Ticket ${ticketId} updated to ${status}`);

            // Optional: Send SMS notification to consumer
            const [ticketData] = await pool.execute(
                'SELECT phone_number, is_consumer_notified FROM aleco_tickets WHERE ticket_id = ?',
                [ticketId]
            );

            if (ticketData.length > 0 && ticketData[0].is_consumer_notified === 1 && ticketData[0].phone_number) {
                let smsMessage = '';
                if (status === 'Restored') {
                    smsMessage = `ALECO Update: Your report (${ticketId}) has been RESTORED. Thank you for your patience!`;
                } else if (status === 'Unresolved') {
                    smsMessage = `ALECO Update: Your report (${ticketId}) could not be resolved at this time. We will contact you shortly.`;
                }

                if (smsMessage) {
                    await sendPhilSMS(ticketData[0].phone_number, smsMessage);
                    console.log(`✅ SMS sent to Consumer confirming ${status} status.`);
                }
            }

            res.status(200).json({ success: true, message: `Ticket ${ticketId} marked as ${status}` });
        } else {
            res.status(404).json({ success: false, message: `Ticket ${ticketId} not found` });
        }

    } catch (error) {
        console.error("❌ STATUS UPDATE ERROR:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});

// ============================================================================
// PERSONNEL MANAGEMENT ROUTES (Surgically Updated for 3-Table Architecture)
// ============================================================================

// --- 1. GET ALL CREWS (With Dynamic Member Counts & Lead Names) ---
router.get('/crews/list', async (req, res) => {
    try {
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

        const [memberships] = await pool.execute('SELECT crew_id, lineman_id FROM aleco_crew_members');

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

        console.log(`✅ Crews Fetched: ${formattedCrews.length} crews`);
        res.status(200).json(formattedCrews);
    } catch (error) {
        console.error("❌ Error fetching crews:", error);
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
