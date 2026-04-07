import express from 'express';
import nodemailer from 'nodemailer';
import pool from '../config/db.js';
import { nowPhilippineForMysql } from '../utils/dateTimeUtils.js';

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
  const phNow = nowPhilippineForMysql();

  try {
    // 1. Are they already a fully registered user in the 'users' table?
    const [existingUser] = await pool.execute('SELECT * FROM users WHERE email = ?', [cleanEmail]);

    if (existingUser.length > 0) {
      console.log(`--- [DEBUG] User ${cleanEmail} is registered. Promoting to ${role}... ---`);
      // Update 'role' in the users table
      await pool.execute('UPDATE users SET role = ? WHERE email = ?', [role, cleanEmail]);
      
      return res.status(200).json({ 
        message: "User is already registered. Role updated successfully!",
        action: "role_updated" 
      });
    }

    // 2. Are they in the waiting room ('access_codes' table)?
    const [pendingInvite] = await pool.execute('SELECT * FROM access_codes WHERE email = ?', [cleanEmail]);

    if (pendingInvite.length > 0) {
      console.log("--- [DEBUG] Overwriting existing pending invite... ---");
      
      // FIXED: Using 'status' column and 'role_assigned' column from your schema
     const updateQuery = `
        UPDATE access_codes 
        SET code = ?, role_assigned = ?, status = 'pending', created_at = ? 
        WHERE email = ?
      `;
      await pool.execute(updateQuery, [code, role, phNow, cleanEmail]);
      
      return res.status(200).json({ message: "Invitation code re-generated!", action: "code_regenerated" });
    } 

    // 3. They are brand new.
    console.log("--- [DEBUG] Email is new. Creating fresh invite... ---");

    // FIXED: Exactly 4 placeholders match exactly 4 values
    const insertQuery = `
      INSERT INTO access_codes (email, role_assigned, code, status, created_at)
      VALUES (?, ?, ?, 'pending', ?)
    `;

    // FIXED: Removed duplicate "pending" from array - it's already in the SQL
    await pool.execute(insertQuery, [
        cleanEmail,  // 1st placeholder
        role,        // 2nd placeholder
        code,        // 3rd placeholder
        phNow   // 4th placeholder (status is hardcoded as 'pending')
    ]);
    
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
// Fetch all registered users
router.get('/users', async (req, res) => {
  try {
    // Matches schema columns: id, name, email, role, status
    const [rows] = await pool.execute(
      'SELECT id, name, email, role, status, profile_pic FROM users ORDER BY created_at DESC'
    );
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching users:", error.message);
    res.status(500).json({ error: "Failed to fetch users." });
  }
});

// Fetch all pending invitations
router.get('/invites/pending', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT email, role_assigned, code, created_at FROM access_codes WHERE status = 'pending' ORDER BY created_at DESC"
    );
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching pending invites:", error.message);
    res.status(500).json({ error: "Failed to fetch pending invitations." });
  }
});

// Update profile name — persists the name field from ProfilePage to the DB
router.put('/users/profile', async (req, res) => {
  const { email, name } = req.body;
  if (!email || !name || !name.trim()) return res.status(400).json({ error: "Missing email or name." });

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();

  try {
    const [result] = await pool.execute('UPDATE users SET name = ? WHERE email = ?', [cleanName, cleanEmail]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "User not found." });
    res.status(200).json({ message: "Profile updated successfully." });
  } catch (error) {
    console.error("Profile Update Error:", error.message);
    res.status(500).json({ error: "Failed to update profile." });
  }
});

// Toggle Status (Matches Schema Casing)
router.post('/users/toggle-status', async (req, res) => {
  const { id, currentStatus } = req.body;
  
  // Ensure we use 'Active' and 'Disabled' to match the Enum definition
  const newStatus = currentStatus === 'Active' ? 'Disabled' : 'Active';

  try {
    await pool.execute('UPDATE users SET status = ? WHERE id = ?', [newStatus, id]);
    res.status(200).json({ message: `User status updated to ${newStatus}`, newStatus });
  } catch (error) {
    console.error("Toggle Error:", error.message);
    res.status(500).json({ error: "Failed to update status." });
  }
});

export default router;