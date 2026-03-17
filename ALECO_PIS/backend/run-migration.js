#!/usr/bin/env node
/**
 * Run a single SQL migration file.
 * Usage: node backend/run-migration.js backend/migrations/add_ticket_logs.sql
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool from './config/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationPath = process.argv[2] || join(__dirname, 'migrations', 'add_ticket_logs.sql');

async function run() {
  try {
    const sql = readFileSync(migrationPath, 'utf8');
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));
    for (const stmt of statements) {
      if (stmt) {
        await pool.execute(stmt);
        console.log('Executed:', stmt.substring(0, 60) + '...');
      }
    }
    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

run();
