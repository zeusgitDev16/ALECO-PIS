import express from 'express';
import mysql from 'mysql2/promise'; // We use the /promise version for cleaner 'async' code
import cors from 'cors';
import dotenv from 'dotenv';

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

// 4. The Mailbox (The API Route)
app.post('/api/invite', async (req, res) => {
  const { email, role, code } = req.body;

  // Basic validation to ensure the conveyor belt isn't empty
  if (!email || !role || !code) {
    return res.status(400).json({ error: "Missing information in the package." });
  }

  try {
    console.log(`Attempting to file invitation for: ${email}`);

    // THE COMMIT: Writing the SQL command to the cabinet
    const query = 'INSERT INTO access_codes (assigned_to_email, role_to_assign, code) VALUES (?, ?, ?)';
    await pool.execute(query, [email, role, code]);

    console.log("--- Success! Data committed to Aiven MySQL ---");
    
    res.status(200).json({ message: "Invitation saved to database!" });

  } catch (error) {
    console.error("Database Error:", error.message);
    res.status(500).json({ error: "The filing cabinet is jammed (Database error)." });
  }
});

// 5. Start the Office
app.listen(PORT, () => {
  console.log(`Server running automatically on http://localhost:${PORT}`);
});