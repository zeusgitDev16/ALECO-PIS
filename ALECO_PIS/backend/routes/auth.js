import express from 'express';
import bcrypt from 'bcrypt';
import pool from '../config/db.js';
import { verifyGoogleIdToken } from '../utils/verifyGoogleIdToken.js';
import { sendAppMail } from '../utils/appMail.js';

const router = express.Router();

// CHANGED: app.post -> router.post AND '/api/setup-account' -> '/setup-account'
router.post('/setup-account', async (req, res) => {
  const { email, inviteCode, password, name } = req.body; 
  if (!email || !inviteCode || !password) return res.status(400).json({ error: "Missing required fields." });

  const cleanEmail = email.trim().toLowerCase();
  // Protect against frontend sending integers instead of strings
  const cleanCode = String(inviteCode).trim();
  
  try {
    // 1. VERIFY: Ensure the code is valid and still "pending"
    const [inviteRecord] = await pool.execute(
      'SELECT * FROM access_codes WHERE email = ? AND code = ? AND status = ?',
      [cleanEmail, cleanCode, 'pending']
    );

    if (inviteRecord.length === 0) {
      return res.status(401).json({ error: "Invalid email, invite code, or account already active." });
    }

    // 2. SYNC ROLE: Pull the exact role the Admin assigned
    const userRole = inviteRecord[0].role_assigned;
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. REGISTER: Official users table with Security Defaults
    // THE FIX: Exactly 7 columns require exactly 7 '?' placeholders
    const insertUserQuery = `
      INSERT INTO users (name, email, password, role, auth_method, status, token_version) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    // THE FIX: The array perfectly matches the 7 placeholders above
    await pool.execute(insertUserQuery, [
        name || "New User", 
        cleanEmail, 
        hashedPassword, 
        userRole, 
        'password', 
        'Active', 
        1
    ]);

    // 4. UPDATE STATUS: Mark the invite as "used" (Idempotency guarantee)
    await pool.execute('UPDATE access_codes SET status = ? WHERE email = ?', ['used', cleanEmail]);

    console.log(`--- [REGISTRATION] Standard user ${cleanEmail} created as ${userRole} ---`);
    res.status(200).json({ message: "Account setup successful! You can now log in." });
    
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: "Account already set up." });
    console.error("Setup Error:", error);
    res.status(500).json({ error: "Server error during account setup." });
  }
});

router.post('/login', async (req, res) => {
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

router.post('/google-login', async (req, res) => {
  const { idToken } = req.body;
  if (!idToken || typeof idToken !== 'string') {
    return res.status(400).json({ error: 'Missing Google credential.' });
  }

  let google;
  try {
    google = await verifyGoogleIdToken(idToken);
  } catch (e) {
    if (e.code === 'GOOGLE_CLIENT_ID_NOT_CONFIGURED') {
      console.error('Google Login: GOOGLE_CLIENT_ID or VITE_GOOGLE_CLIENT_ID not set on server');
      return res.status(500).json({ error: 'Google sign-in is not configured on the server.' });
    }
    if (e.code === 'EMAIL_NOT_VERIFIED') {
      return res.status(403).json({ error: 'Google account email is not verified.' });
    }
    console.warn('Google Login: token verification failed');
    return res.status(401).json({ error: 'Invalid or expired Google sign-in. Please try again.' });
  }

  const email = google.email;

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

    // 2. DATA SYNC: Update profile pic and name from verified Google claims
    await pool.execute(
      'UPDATE users SET profile_pic = ?, name = ? WHERE email = ?', 
      [google.picture || user.profile_pic, google.name || user.name, email]
    );

    // 3. SECURE RESPONSE: Include token_version for App.jsx security handshake
    return res.status(200).json({
      message: "Google Login successful!",
      user: { 
        id: user.id,
        name: google.name || user.name,
        email: user.email, 
        role: user.role, 
        profilePic: google.picture || user.profile_pic,
        tokenVersion: user.token_version // Essential for session verification
      }
    });
  } catch (error) {
    console.error("Google Login Error:", error.message);
    res.status(500).json({ error: "Server error during Google login." });
  }
});

router.post('/setup-google-account', async (req, res) => {
  const { idToken, inviteCode } = req.body;
  if (!idToken || typeof idToken !== 'string' || !inviteCode) {
    return res.status(400).json({ error: "Missing Google credential or invite code." });
  }

  let google;
  try {
    google = await verifyGoogleIdToken(idToken);
  } catch (e) {
    if (e.code === 'GOOGLE_CLIENT_ID_NOT_CONFIGURED') {
      console.error('Google Setup: GOOGLE_CLIENT_ID or VITE_GOOGLE_CLIENT_ID not set on server');
      return res.status(500).json({ error: 'Google sign-in is not configured on the server.' });
    }
    if (e.code === 'EMAIL_NOT_VERIFIED') {
      return res.status(403).json({ error: 'Google account email is not verified.' });
    }
    console.warn('Google Setup: token verification failed');
    return res.status(401).json({ error: 'Invalid or expired Google sign-in. Please try again.' });
  }

  const cleanEmail = google.email;
  const cleanCode = String(inviteCode).trim();
  try {
    // 1. VERIFY: Ensure the code matches and is still "pending"
    const [invite] = await pool.execute(
      'SELECT * FROM access_codes WHERE email = ? AND code = ? AND status = "pending"',
      [cleanEmail, cleanCode]
    );

    if (invite.length === 0) {
      return res.status(401).json({ error: "Invalid invite code or account already active." });
    }

    const userRole = invite[0].role_assigned;

    // 2. REGISTER: Create user with verified Google info and Security Defaults
    const insertQuery = `
      INSERT INTO users (name, email, role, profile_pic, auth_method, status, token_version) 
      VALUES (?, ?, ?, ?, "google", "Active", 1)
    `;
    await pool.execute(insertQuery, [
      google.name || "Google User",
      cleanEmail,
      userRole,
      google.picture || null,
    ]);

    // 3. UPDATE STATUS: Mark the invitation as "used"
    await pool.execute('UPDATE access_codes SET status = ? WHERE email = ?', ['used', cleanEmail]);

    console.log(`--- [NEW USER] ${cleanEmail} linked Google as ${userRole} (Invite used) ---`);
    res.status(200).json({ message: "Google account linked successfully!" });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: "Account already exists." });
    console.error("Google Setup Error:", error.message);
    res.status(500).json({ error: "Database error during Google setup." });
  }
});

router.post('/logout-all', async (req, res) => {
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

const generateResetCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

router.post('/forgot-password', async (req, res) => {
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

    // 5. EMAIL: Send using functional Nodemailer template (optional PUBLIC_APP_URL = public SPA link for users)
    const publicApp = (process.env.PUBLIC_APP_URL || process.env.FRONTEND_ORIGIN || '').trim().replace(/\/$/, '');
    const appLinkHtml = publicApp
      ? `<p style="font-size: 14px; color: #555;">Open the app to enter this code: <a href="${publicApp}">${publicApp}</a></p>`
      : '';

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
          ${appLinkHtml}
          <p style="font-size: 14px; color: #888;">Valid for 15 minutes. If this wasn't you, ignore this email.</p>
        </div>`
    };

    await sendAppMail({
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
      html: mailOptions.html,
    });
    console.log(`--- [SECURITY] Reset code successfully delivered to ${cleanEmail} ---`);
    res.status(200).json({ message: "Reset code sent to your email!" });

  } catch (error) {
    console.error("--- [DEBUG] Forgot Password Error:", error.message);
    res.status(500).json({ error: "Failed to send reset code. Please try again later." });
  }
});

router.post('/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) return res.status(400).json({ error: "Missing required info." });

  const cleanEmail = email.trim().toLowerCase();
  try {
    // 1. VERIFY: Check code and expiration
    const [record] = await pool.execute(
      'SELECT * FROM password_resets WHERE email = ? AND token = ? AND expires_at > NOW()',
      [cleanEmail, code]
    );

    if (record.length === 0) return res.status(400).json({ error: "Invalid or expired reset code." });

    // 2. UPDATE: Securely hash and update the existing user row
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Bump token_version to flush all existing sessions
    await pool.execute(
      'UPDATE users SET password = ?, token_version = token_version + 1 WHERE email = ?', 
      [hashedPassword, cleanEmail]
    );

    // 3. CLEANUP: Delete used token
    await pool.execute('DELETE FROM password_resets WHERE email = ?', [cleanEmail]);

    console.log(`--- [SUCCESS] Password updated for ${cleanEmail} ---`);
    res.status(200).json({ message: "Password updated successfully!" });

  } catch (error) {
    console.error("--- [DEBUG] Reset Password Error:", error.message);
    res.status(500).json({ error: "Server error during password update." });
  }
});

// Session verification for App.jsx - validates tokenVersion on navigation
router.post('/verify-session', async (req, res) => {
  const { email, tokenVersion } = req.body;
  if (!email) return res.status(400).json({ status: 'invalid' });

  const cleanEmail = email.trim().toLowerCase();
  try {
    const [users] = await pool.execute('SELECT token_version FROM users WHERE email = ?', [cleanEmail]);
    if (users.length === 0) return res.status(200).json({ status: 'invalid' });
    const match = Number(users[0].token_version) === Number(tokenVersion);
    return res.status(200).json({ status: match ? 'valid' : 'invalid' });
  } catch (error) {
    console.error('Verify session error:', error.message);
    return res.status(200).json({ status: 'invalid' });
  }
});

// 3. Export this bundle of routes so server.js can plug it in
export default router;