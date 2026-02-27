import express from 'express';
import nodemailer from 'nodemailer';
import pool from '../config/db.js';

const router = express.Router();

// 4. The Mailman Configuration (Needed for '/send-email' below)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// 4. The Mailbox (The API Route)
router.post('/invite', async (req, res) => {
  const { email, role, code } = req.body;
  if (!email || !role || !code) return res.status(400).json({ error: "Missing info." });

  const cleanEmail = email.trim().toLowerCase();
  
  // THE PREVIOUS FIX: Sync the clock to Node.js to avoid the 9-minute Aiven database drift
  const manilaTime = new Date().toISOString().slice(0, 19).replace('T', ' '); 

  try {
    // 1. Are they already a fully registered user?
    const [existingUser] = await pool.execute('SELECT * FROM users WHERE email = ?', [cleanEmail]);

    if (existingUser.length > 0) {
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
      
      // THE FIX: Replaced CURRENT_TIMESTAMP with manilaTime (?) to keep timestamps perfectly synced
      const updateQuery = 'UPDATE access_codes SET code = ?, role_assigned = ?, status = "pending", created_at = ? WHERE email = ?';
      await pool.execute(updateQuery, [code, role, manilaTime, cleanEmail]);
      
      return res.status(200).json({ message: "Invitation code re-generated!", action: "code_regenerated" });
    } 

    // 3. They are brand new.
    console.log("--- [DEBUG] Email is new. Creating fresh invite... ---");
    
    // THE FIX: Added a 5th placeholder (?) for the created_at column so it stops crashing
    const insertQuery = 'INSERT INTO access_codes (email, role_assigned, code, status, created_at) VALUES (?, ?, ?, ?, ?)';
    // THE FIX: Passed manilaTime as the 4th item in the execution array (matching the 5th placeholder)
    await pool.execute(insertQuery, [cleanEmail, role, code,"pending",manilaTime]);
    
    return res.status(200).json({ message: "New invitation saved!", action: "code_generated" });

  } catch (error) {
    console.error("Database Error:", error.message);
    res.status(500).json({ error: "The filing cabinet is jammed." });
  } 
});

router.post('/send-email', async (req, res) => {
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

router.post('/check-email', async (req, res) => {
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

// Fetch all registered users from the 'users' table
router.get('/users', async (req, res) => {
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
router.post('/users/toggle-status', async (req, res) => {
  const { id, currentStatus } = req.body;
  const newStatus = currentStatus === 'Active' ? 'Disabled' : 'Active';

  try {
    await pool.execute('UPDATE users SET status = ? WHERE id = ?', [newStatus, id]);
    res.status(200).json({ message: `User status updated to ${newStatus}` });
  } catch (error) {
    res.status(500).json({ error: "Failed to update user status." });
  }
});

export default router;