import express from 'express';
import mysql from 'mysql2/promise'; // We use the /promise version for cleaner 'async' code
import cors from 'cors';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import bcrypt from 'bcrypt';
import { upload } from './cloudinaryConfig.js';

// 1. Initialize environment variables (Security)
dotenv.config();

process.env.TZ = 'Asia/Manila';

const app = express();
const PORT = 5000;

// 2. Middleware (The Guards)
app.use(cors());
app.use(express.json());

// 3. The Database Connection Pool (The Filing Cabinet)
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: false
  },
  
  // MOVED THESE OUTSIDE OF SSL:
  timezone: '+08:00',
  dateStrings: true,
  
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// the mailman configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// THE MASTER TICKET SUBMISSION ROUTE
app.post('/api/tickets/submit', upload.single('image'), async (req, res) => {
    try {
        // 1. Pull data from the form fields
        const { 
            account_number, first_name, middle_name, last_name, 
            phone_number, address, location, category, concern 
        } = req.body;

        // 2. IDEMPOTENCY CHECK (Anti-Spam / Double-Click Prevention)
        // Check if the same user submitted the exact same problem in the last 5 minutes
        const duplicateCheckSql = `
            SELECT ticket_id FROM aleco_tickets 
            WHERE phone_number = ? 
              AND category = ? 
              AND concern = ? 
              AND created_at >= NOW() - INTERVAL 5 MINUTE
            LIMIT 1
        `;
        const [existingTickets] = await pool.execute(duplicateCheckSql, [phone_number, category, concern]);

        if (existingTickets.length > 0) {
            // If it's a duplicate, return a 200 OK and give them the existing ID 
            // instead of creating a second ticket in the database.
            return res.status(200).json({
                success: true,
                ticketId: existingTickets[0].ticket_id,
                message: "Your report has already been received. Thank you!"
            });
        }

        // 3. The Cloudinary URL is automatically provided by the middleware
        const image_url = req.file ? req.file.path : null;

        // 4. Generate a professional Ticket ID (e.g., ALECO-X892J)
        const ticket_id = `ALECO-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

        // 5. FIXED SQL Query: Added the correct number of '?' and mapped 'category'
        const sql = `
            INSERT INTO aleco_tickets 
            (ticket_id, account_number, first_name, middle_name, last_name, phone_number, address, location, category, concern, image_url, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
        `;

        // 6. Execute the save (Ensure the array perfectly matches the '?' order)
        await pool.execute(sql, [
            ticket_id, 
            account_number || null, 
            first_name, 
            middle_name || null, 
            last_name, 
            phone_number, 
            address, 
            location || null, 
            category,  // <-- Category safely injected here
            concern, 
            image_url
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

// 4. The Mailbox (The API Route)
app.post('/api/invite', async (req, res) => {
  const { email, role, code } = req.body;
  if (!email || !role || !code) return res.status(400).json({ error: "Missing info." });

  const cleanEmail = email.trim().toLowerCase();

  try {
    // 1. Are they already a fully registered user?
    const [existingUser] = await pool.execute('SELECT * FROM users WHERE email = ?', [cleanEmail]);

    if (existingUser.length > 0) {
      // THE FIX: Do not generate a code. Just update their role in the users table!
      console.log(`--- [DEBUG] User ${cleanEmail} is registered. Promoting to ${role}... ---`);
      await pool.execute('UPDATE users SET role = ? WHERE email = ?', [role, cleanEmail]);
      
      return res.status(200).json({ 
        message: "User is already registered. Role updated successfully!",
        action: "role_updated" 
      });
    }

    // 2. Are they in the waiting room with an old invite?
    const [pendingInvite] = await pool.execute('SELECT * FROM access_codes WHERE email = ?', [cleanEmail]);

    if (pendingInvite.length > 0) {
      console.log("--- [DEBUG] Overwriting existing pending invite... ---");
      // UPDATED: Added status = "pending" to guarantee it resets if needed
      const updateQuery = 'UPDATE access_codes SET code = ?, role_assigned = ?, status = "pending", created_at = CURRENT_TIMESTAMP WHERE email = ?';
      await pool.execute(updateQuery, [code, role, cleanEmail]);
      
      return res.status(200).json({ message: "Invitation code re-generated!", action: "code_regenerated" });
    } 

    // 3. They are brand new.
    console.log("--- [DEBUG] Email is new. Creating fresh invite... ---");
    // UPDATED: Added status column and "pending" value
    const insertQuery = 'INSERT INTO access_codes (email, role_assigned, code, status) VALUES (?, ?, ?, "pending")';
    await pool.execute(insertQuery, [cleanEmail, role, code]);
    
    return res.status(200).json({ message: "New invitation saved!", action: "code_generated" });

  } catch (error) {
    console.error("Database Error:", error.message);
    res.status(500).json({ error: "The filing cabinet is jammed." });
  }
});

app.post('/api/send-email', async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: "Missing email or code in the request." });
  }

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email, 
    subject: 'ALECO PIS - Your Official Invitation Code',
    text: `Hello!\n\nYou have been invited to the ALECO Power Outage Tracking system.\nYour 12-digit invitation code is: ${code}\n\nPlease use this code to register your account.`,
    
    // THE UPDATED HTML: Clean, centered, and massive code display
    html: `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; padding: 20px;">
        <h2 style="color: #2e7d32; border-bottom: 1px solid #eee; padding-bottom: 10px;">Welcome to ALECO PIS</h2>
        
        <p style="font-size: 16px; line-height: 1.5; margin-top: 20px;">
          You have been invited to the ALECO Power Outage Tracking system. To register your account, please enter the following 12-digit invitation code:
        </p>
        
        <div style="text-align: center; margin: 40px 0;">
          <span style="font-size: 2.5rem; font-weight: bold; color: #2e7d32; letter-spacing: 5px;">
            ${code}
          </span>
        </div>
        
        <p style="font-size: 14px; color: #666; margin-top: 40px;">
          If you didn't expect this invitation, you can safely ignore this email.
        </p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`--- [DEBUG] Email successfully delivered to ${email} ---`);
    res.status(200).json({ message: "Email sent successfully!" });
  } catch (error) {
    console.error("--- [DEBUG] Nodemailer Error:", error);
    res.status(500).json({ error: "The mailman couldn't reach the recipient." });
  }
});

// Add this inside your Express server/routes file

app.post('/api/check-email', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ status: 'new' });

  const cleanEmail = email.trim().toLowerCase();

  try {
    // 1. Check the Main Office (users table)
    const [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [cleanEmail]);
    if (users.length > 0) {
      return res.json({ status: 'registered', role: users[0].role }); // Fully registered user
    }

    // 2. Check the Waiting Room (access_codes table)
    const [codes] = await pool.execute('SELECT * FROM access_codes WHERE email = ?', [cleanEmail]);
    if (codes.length > 0) {
      return res.json({ status: 'pending', role: codes[0].role_assigned }); // Has an invite, hasn't set up yet
    }

    // 3. Brand New
    return res.json({ status: 'new' });

  } catch (error) {
    console.error("Error checking email:", error.message);
    res.status(500).json({ status: 'error' });
  }
});

app.post('/api/setup-account', async (req, res) => {
  const { email, inviteCode, password, name } = req.body; // Added name for AllUsers display
  if (!email || !inviteCode || !password) return res.status(400).json({ error: "Missing required fields." });

  const cleanEmail = email.trim().toLowerCase();
  try {
    // 1. VERIFY: Ensure the code is valid and still "pending"
    const [inviteRecord] = await pool.execute(
      'SELECT * FROM access_codes WHERE email = ? AND code = ? AND status = "pending"',
      [cleanEmail, inviteCode]
    );

    if (inviteRecord.length === 0) {
      return res.status(401).json({ error: "Invalid email, invite code, or account already active." });
    }

    // 2. SYNC ROLE: Pull the exact role the Admin assigned in access_codes
    const userRole = inviteRecord[0].role_assigned;
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. REGISTER: Official users table with Security Defaults
    // We initialize status as 'Active' and token_version as 1
    const insertUserQuery = `
      INSERT INTO users (name, email, password, role, auth_method, status, token_version) 
      VALUES (?, ?, ?, ?, "password", "Active", 1)
    `;
    await pool.execute(insertUserQuery, [name || "New User", cleanEmail, hashedPassword, userRole]);

    // 4. UPDATE STATUS: Mark the invite as "used"
    await pool.execute('UPDATE access_codes SET status = "used" WHERE email = ?', [cleanEmail]);

    console.log(`--- [REGISTRATION] Standard user ${cleanEmail} created as ${userRole} ---`);
    res.status(200).json({ message: "Account setup successful! You can now log in." });
    
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: "Account already set up." });
    console.error("Setup Error:", error.message);
    res.status(500).json({ error: "Server error during account setup." });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Missing email or password." });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    // Fetch user details including the new status and token_version columns
    const [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [cleanEmail]);

    if (users.length === 0) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const user = users[0];

    // 1. THE KILL SWITCH: Block disabled accounts immediately
    if (user.status === 'Disabled') {
      console.log(`--- [SECURITY] Blocked login attempt for disabled account: ${cleanEmail} ---`);
      return res.status(403).json({ 
        error: "Your account has been disabled by an administrator. Please contact IT support." 
      });
    }

    // 2. PASSWORD CHECK
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    console.log(`--- Success! ${cleanEmail} has logged in. ---`);
    
    // 3. SECURE RESPONSE: Send tokenVersion and user info
    return res.status(200).json({ 
      message: "Login successful!",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        profilePic: user.profile_pic,
        // Send the version to be stored in localStorage for App.jsx checks
        tokenVersion: user.token_version 
      }
    });

  } catch (error) {
    console.error("Login Error:", error.message);
    res.status(500).json({ error: "Server error during login." });
  }
});

// NEW: Route to handle "Automatic Detection" Google Login
app.post('/api/google-login', async (req, res) => {
  const { email, profilePic, name } = req.body; // Added name for data consistency
  if (!email) return res.status(400).json({ error: "Missing Google email." });

  try {
    const [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);

    if (users.length === 0) {
      return res.status(401).json({ error: "Account not found. Please use 'First Time Setup' with your 12-digit code." });
    }

    const user = users[0];

    // 1. THE KILL SWITCH: Block disabled accounts even if Google auth is valid
    if (user.status === 'Disabled') {
      console.log(`--- [SECURITY] Blocked Google Login for disabled account: ${email} ---`);
      return res.status(403).json({ 
        error: "This account has been disabled. Access denied." 
      });
    }

    // 2. DATA SYNC: Update profile pic and name from Google every time they log in
    await pool.execute(
      'UPDATE users SET profile_pic = ?, name = ? WHERE email = ?', 
      [profilePic, name || user.name, email]
    );

    // 3. SECURE RESPONSE: Include token_version for App.jsx security handshake
    return res.status(200).json({
      message: "Google Login successful!",
      user: { 
        id: user.id,
        name: name || user.name,
        email: user.email, 
        role: user.role, 
        profilePic: profilePic,
        tokenVersion: user.token_version // Essential for session verification
      }
    });
  } catch (error) {
    console.error("Google Login Error:", error.message);
    res.status(500).json({ error: "Server error during Google login." });
  }
});

// NEW: Google Setup (The 12-Digit Guard for NEW Google Users)
app.post('/api/setup-google-account', async (req, res) => {
  // Added 'name' to the request body to ensure the AllUsers table is populated
  const { email, inviteCode, profilePic, name } = req.body; 
  if (!email || !inviteCode) return res.status(400).json({ error: "Missing info." });

  const cleanEmail = email.trim().toLowerCase();
  try {
    // 1. VERIFY: Ensure the code matches and is still "pending"
    const [invite] = await pool.execute(
      'SELECT * FROM access_codes WHERE email = ? AND code = ? AND status = "pending"',
      [cleanEmail, inviteCode]
    );

    if (invite.length === 0) {
      return res.status(401).json({ error: "Invalid invite code or account already active." });
    }

    const userRole = invite[0].role_assigned;

    // 2. REGISTER: Create user with Google info and Security Defaults
    // We initialize 'status' as 'Active' and 'token_version' as 1
    const insertQuery = `
      INSERT INTO users (name, email, role, profile_pic, auth_method, status, token_version) 
      VALUES (?, ?, ?, ?, "google", "Active", 1)
    `;
    await pool.execute(insertQuery, [name || "Google User", cleanEmail, userRole, profilePic]);

    // 3. UPDATE STATUS: Mark the invitation as "used"
    await pool.execute('UPDATE access_codes SET status = "used" WHERE email = ?', [cleanEmail]);

    console.log(`--- [NEW USER] ${cleanEmail} linked Google as ${userRole} (Invite used) ---`);
    res.status(200).json({ message: "Google account linked successfully!" });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: "Account already exists." });
    console.error("Google Setup Error:", error.message);
    res.status(500).json({ error: "Database error during Google setup." });
  }
});

app.post('/api/logout-all', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Missing email." });

  try {
    // Incrementing the version 'bricks' all current session tokens for this user
    const [result] = await pool.execute(
      'UPDATE users SET token_version = token_version + 1 WHERE email = ?',
      [email]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    res.status(200).json({ message: "Successfully logged out from all devices." });
  } catch (error) {
    console.error("Global Logout Error:", error.message);
    res.status(500).json({ error: "Failed to perform global logout." });
  }
});

// Fetch all registered users from the 'users' table
app.get('/api/users', async (req, res) => {
  try {
    // We select the specific columns needed for the AllUsers table
    const [rows] = await pool.execute(
      'SELECT id, name, email, role, status FROM users ORDER BY created_at DESC'
    );
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching users:", error.message);
    res.status(500).json({ error: "Failed to fetch users from the filing cabinet." });
  }
});

// Toggle User Status (Enable/Disable)
app.post('/api/users/toggle-status', async (req, res) => {
  const { id, currentStatus } = req.body;
  const newStatus = currentStatus === 'Active' ? 'Disabled' : 'Active';

  try {
    await pool.execute('UPDATE users SET status = ? WHERE id = ?', [newStatus, id]);
    res.status(200).json({ message: `User status updated to ${newStatus}` });
  } catch (error) {
    res.status(500).json({ error: "Failed to update user status." });
  }
});

// HELPER: Generate an 8-character alphanumeric code (e.g., g5hYYu32)
const generateResetCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// --- FORGOT PASSWORD: SEND RESET CODE ---
app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Missing email address." });

  const cleanEmail = email.trim().toLowerCase();

  try {
    // 1. Check if user exists in ALECO PIS system
    const [user] = await pool.execute('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (user.length === 0) return res.status(404).json({ error: "Email not registered in the system." });

    // 2. Generate 8-character alphanumeric token (e.g., g5hYYu32)
    const resetCode = generateResetCode(); 
    const expiresAt = new Date(Date.now() + 15 * 60000); // 15-minute window

    // 3. IDEMPOTENCY: Clear old codes for this email
    await pool.execute('DELETE FROM password_resets WHERE email = ?', [cleanEmail]);
    
    // 4. SAVE: Store in password_resets table
    await pool.execute(
      'INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)', 
      [cleanEmail, resetCode, expiresAt]
    );

    // 5. EMAIL: Send using functional Nodemailer template
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: cleanEmail, 
      subject: 'ALECO PIS - Password Reset Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #d32f2f; border-bottom: 2px solid #d32f2f; padding-bottom: 10px;">Security Alert: Password Reset</h2>
          <p style="font-size: 16px;">Use the 8-character code below to reset your ALECO PIS password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 2.2rem; font-weight: bold; color: #d32f2f; letter-spacing: 4px; background: #f9f9f9; padding: 15px; border-radius: 5px; border: 1px dashed #d32f2f;">
              ${resetCode}
            </span>
          </div>
          <p style="font-size: 14px; color: #888;">Valid for 15 minutes. If this wasn't you, ignore this email.</p>
        </div>`
    };

    await transporter.sendMail(mailOptions);
    console.log(`--- [SECURITY] Reset code successfully delivered to ${cleanEmail} ---`);
    res.status(200).json({ message: "Reset code sent to your email!" });

  } catch (error) {
    console.error("--- [DEBUG] Forgot Password Error:", error.message);
    res.status(500).json({ error: "Failed to send reset code. Please try again later." });
  }
});

app.post('/api/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) return res.status(400).json({ error: "Missing required info." });

  try {
    // 1. VERIFY: Check code and expiration
    const [record] = await pool.execute(
      'SELECT * FROM password_resets WHERE email = ? AND token = ? AND expires_at > NOW()',
      [email, code]
    );

    if (record.length === 0) return res.status(400).json({ error: "Invalid or expired reset code." });

    // 2. UPDATE: Securely hash and update the existing user row
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Bump token_version to flush all existing sessions
    await pool.execute(
      'UPDATE users SET password = ?, token_version = token_version + 1 WHERE email = ?', 
      [hashedPassword, email]
    );

    // 3. CLEANUP: Delete used token
    await pool.execute('DELETE FROM password_resets WHERE email = ?', [email]);

    console.log(`--- [SUCCESS] Password updated for ${email} ---`);
    res.status(200).json({ message: "Password updated successfully!" });

  } catch (error) {
    console.error("--- [DEBUG] Reset Password Error:", error.message);
    res.status(500).json({ error: "Server error during password update." });
  }
});

app.post('/api/tickets/submit', upload.single('image'), async (req, res) => {
    try {
        // Extract based on the snake_case keys we appended in React
        const { 
            first_name, 
            last_name, 
            phone_number, 
            address, 
            concern 
        } = req.body;

        // SERVER-SIDE HARD BLOCK
        if (!first_name || first_name.trim() === "" || 
            !last_name || last_name.trim() === "" || 
            !phone_number || phone_number.trim() === "" || 
            !address || address.trim() === "" || 
            !concern || concern.trim() === "") {
            
            return res.status(400).json({ 
                success: false, 
                message: "Missing mandatory fields on server side." 
            });
        }

        const ticket_id = `ALECO-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        const image_url = req.file ? req.file.path : null;

        const sql = `
            INSERT INTO aleco_tickets 
            (ticket_id, account_number, first_name, middle_name, last_name, phone_number, address, location, concern, image_url, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
        `;

        await pool.execute(sql, [
            ticket_id, 
            req.body.account_number || null, 
            first_name, 
            req.body.middle_name || null, 
            last_name, 
            phone_number, 
            address, 
            req.body.location || null, 
            concern, 
            image_url
        ]);

        res.status(201).json({ success: true, ticketId: ticket_id });

    } catch (error) {
        console.error("Database Error:", error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
});

// --- 2. TRACK TICKET ROUTE ---
app.get('/api/tickets/track/:ticketId', async (req, res) => {
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
app.post('/api/tickets/send-copy', async (req, res) => {
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
// 5. Start the Office
app.listen(PORT, () => {
  console.log(`Server running automatically on http://localhost:${PORT}`);
});