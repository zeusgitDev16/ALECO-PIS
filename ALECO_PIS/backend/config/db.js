// backend/config/db.js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// 1. Initialize environment variables
dotenv.config();

// 2. Create the exact pool from your server.js
// Note: timezone '+08:00' hints that DATE/DATETIME are Philippine. Aiven may still use
// UTC for NOW(). We use explicit nowPhilippineForMysql() in writes for deterministic behavior.
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: false
  },
  timezone: '+08:00',
  dateStrings: true,
  charset: 'utf8mb4',
  /** Disallow `;` stacked statements in a single query (defense in depth). */
  multipleStatements: false,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

console.log("✅ Database pool configured and ready for connections.");

// 3. THE MAGIC LINE: Export it for the rest of the app to use
export default pool;