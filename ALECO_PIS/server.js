import express from 'express';
import mysql from 'mysql2/promise'; // We use the /promise version for cleaner 'async' code
import cors from 'cors';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

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

  if (!email || !role || !code) {
    return res.status(400).json({ error: "Missing information in the package." });
  }

  // THE SANITIZER: Clean the email of accidental spaces and uppercase letters
  const cleanEmail = email.trim().toLowerCase();

  console.log(`--- [DEBUG] Raw Email: '${email}' ---`);
  console.log(`--- [DEBUG] Cleaned Email: '${cleanEmail}' ---`);

  try {
    // STEP 1: Search using the clean email in the access_codes table
    const [existingRecord] = await pool.execute(
      'SELECT * FROM access_codes WHERE email = ?', 
      [cleanEmail]
    );

    console.log(`--- [DEBUG] Found Records Count: ${existingRecord.length} ---`);

    if (existingRecord.length > 0) {
      // If it's already in the table, reject it with a 409! 
      // (This matches your frontend React error trigger)
      console.log("--- [DEBUG] Duplicate found. Blocking invite creation. ---");
      return res.status(409).json({ message: "Account already exists" });

    } else {
      // STEP 2: Insert the new row with the clean email
      const insertQuery = 'INSERT INTO access_codes (email, role_assigned, code) VALUES (?, ?, ?)';
      await pool.execute(insertQuery, [cleanEmail, role, code]);
      console.log("--- Success! New data committed to Aiven MySQL ---");
      
      return res.status(200).json({ message: "New invitation saved to database!" });
    }

  } catch (error) {
    console.error("Database Error:", error.message);
    res.status(500).json({ error: "The filing cabinet is jammed (Database error)." });
  }
});

app.post('/api/send-email', async (req, res) => {
  const { email, code } = req.body;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email, // The user's gmail from your UI
    subject: 'ALECO PIS - Your Official Invitation Code',
    text: `Hello! You have been invited to the ALECO Power Outage Tracking system. 
           Your 12-digit invitation code is: ${code}
           Please use this code to register your account.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email successfully delivered to ${email}`);
    res.status(200).json({ message: "Email sent successfully!" });
  } catch (error) {
    console.error("Nodemailer Error:", error);
    res.status(500).json({ error: "The mailman couldn't reach the recipient." });
  }
});

// Add this inside your Express server/routes file

app.post('/api/check-email', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ exists: false, message: "No email provided" });
  }

  // Sanitize exactly like your invite route
  const cleanEmail = email.trim().toLowerCase();
  console.log(`--- [DEBUG] Checking if email exists: '${cleanEmail}' ---`);

  try {
    // Check the access_codes table using your Aiven pool
    const query = 'SELECT * FROM access_codes WHERE email = ?';
    const [rows] = await pool.execute(query, [cleanEmail]);

    if (rows.length > 0) {
      console.log(`--- [DEBUG] Found duplicate in access_codes! Triggering red UI. ---`);
      // The email was found! Tell React to show the red indicator.
      return res.json({ exists: true }); 
    } else {
      console.log(`--- [DEBUG] Email is completely new. Keeping UI green. ---`);
      // The email is new. Tell React to keep things green.
      return res.json({ exists: false });
    }

  } catch (error) {
    console.error("Error checking email:", error.message);
    res.status(500).json({ message: "Server error during email check" });
  }
});

// 5. Start the Office
app.listen(PORT, () => {
  console.log(`Server running automatically on http://localhost:${PORT}`);
});