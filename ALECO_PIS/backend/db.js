import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// 1. Load the variables
dotenv.config();

// 2. Check if the computer actually sees the URL
console.log("🔍 Checking .env file...");
if (!process.env.DATABASE_URL) {
  console.log("❌ ERROR: The DATABASE_URL is still missing. Check your .env file!");
} else {
  console.log("✅ URL found! Attempting to connect...");
}

// 3. Setup the connection
const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log("🎉 SUCCESS! You are connected to Aiven MySQL.");
    connection.release();
    process.exit(0); // Closes the script cleanly
  } catch (error) {
    console.error("❌ Connection failed:", error.message);
  }
}

testConnection();