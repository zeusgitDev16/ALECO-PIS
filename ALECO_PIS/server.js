import express from 'express';
import mysql from 'mysql2/promise'; // We use the /promise version for cleaner 'async' code
import cors from 'cors';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import bcrypt from 'bcrypt';

// 1. Initialize environment variables (Security)
dotenv.config();

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
    rejectUnauthorized: false // Required for Aiven connections
  },
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
// 5. Start the Office
app.listen(PORT, () => {
  console.log(`Server running automatically on http://localhost:${PORT}`);
});