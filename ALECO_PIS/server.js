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
  const { email, inviteCode, password } = req.body;

  if (!email || !inviteCode || !password) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    // 1. VERIFY: Check if the email and 12-digit code match AND status is still pending
    const [inviteRecord] = await pool.execute(
      'SELECT * FROM access_codes WHERE email = ? AND code = ? AND status = "pending"',
      [cleanEmail, inviteCode]
    );

    if (inviteRecord.length === 0) {
      // If it's 0, either the email/code is wrong, or the account is already active.
      return res.status(401).json({ error: "Invalid email, invite code, or account already active." });
    }

    // Grab the role they were assigned by the Admin when invited
    const userRole = inviteRecord[0].role_assigned;

    // 2. SECURE: Hash the password (salts it 10 times for heavy security)
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. REGISTER: Insert them into your official users table
    const insertUserQuery = 'INSERT INTO users (email, password, role) VALUES (?, ?, ?)';
    await pool.execute(insertUserQuery, [cleanEmail, hashedPassword, userRole]);

    // 4. CLEAN UP: Update the status to 'active' instead of deleting the row!
    await pool.execute('UPDATE access_codes SET status = "active" WHERE email = ?', [cleanEmail]);

    console.log(`--- Success! Account officially set up for ${cleanEmail} (Status changed to active) ---`);
    res.status(200).json({ message: "Account setup successful! You can now log in." });

  } catch (error) {
    console.error("Setup Error:", error.message);
    
    // Safety check: If the email already exists in the users table somehow
    if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: "This account has already been set up. Please use the standard login." });
    }
    
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
    // 1. Search for the user in your official 'users' table
    const [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [cleanEmail]);

    if (users.length === 0) {
      // User not found
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const user = users[0];

    // 2. Compare the typed password with the hashed password in the database
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      // Wrong password
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // 3. Success! Log them in and send back their role for the dashboard
    console.log(`--- Success! ${cleanEmail} has logged in. ---`);
    
    return res.status(200).json({ 
      message: "Login successful!",
      user: {
        email: user.email,
        role: user.role // We pass the role back so React knows if they are an admin or employee
      }
    });

  } catch (error) {
    console.error("Login Error:", error.message);
    res.status(500).json({ error: "Server error during login." });
  }
});

// 5. Start the Office
app.listen(PORT, () => {
  console.log(`Server running automatically on http://localhost:${PORT}`);
});