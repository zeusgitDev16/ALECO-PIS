// backend/config/db.js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// 1. Initialize environment variables
dotenv.config();

const toInt = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
};

const RETRY_LIMIT = toInt(process.env.DB_RETRY_LIMIT, 2);
const RETRY_BASE_MS = toInt(process.env.DB_RETRY_BASE_MS, 250);
const CONNECT_TIMEOUT_MS = toInt(process.env.DB_CONNECT_TIMEOUT_MS, 10000);
const CONNECTION_LIMIT = toInt(process.env.DB_CONNECTION_LIMIT, 10);
const MAX_IDLE = toInt(process.env.DB_MAX_IDLE, 10);
const IDLE_TIMEOUT_MS = toInt(process.env.DB_IDLE_TIMEOUT_MS, 60000);
const CIRCUIT_FAIL_THRESHOLD = toInt(process.env.DB_CIRCUIT_FAIL_THRESHOLD, 6);
const CIRCUIT_OPEN_MS = toInt(process.env.DB_CIRCUIT_OPEN_MS, 15000);
const CIRCUIT_HALF_OPEN_MAX = toInt(process.env.DB_CIRCUIT_HALF_OPEN_MAX, 2);

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
  connectionLimit: CONNECTION_LIMIT,
  maxIdle: MAX_IDLE,
  idleTimeout: IDLE_TIMEOUT_MS,
  queueLimit: 0,
  connectTimeout: CONNECT_TIMEOUT_MS,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

console.log("✅ Database pool configured and ready for connections.");

function isTransientDbError(err) {
  const code = String(err?.code || '');
  return (
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED' ||
    code === 'PROTOCOL_CONNECTION_LOST' ||
    code === 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR' ||
    code === 'PROTOCOL_ENQUEUE_AFTER_QUIT'
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const breaker = {
  state: 'closed', // closed -> open -> half-open
  failures: 0,
  openedAtMs: 0,
  halfOpenInFlight: 0,
};

function makeDbCircuitOpenError() {
  const err = new Error('Database temporarily unavailable (circuit open).');
  err.code = 'DB_CIRCUIT_OPEN';
  return err;
}

function canPassCircuit() {
  if (breaker.state === 'closed') return true;
  if (breaker.state === 'open') {
    if (Date.now() - breaker.openedAtMs >= CIRCUIT_OPEN_MS) {
      breaker.state = 'half-open';
      breaker.halfOpenInFlight = 0;
    } else {
      return false;
    }
  }
  if (breaker.state === 'half-open') {
    if (breaker.halfOpenInFlight >= CIRCUIT_HALF_OPEN_MAX) return false;
    breaker.halfOpenInFlight += 1;
    return true;
  }
  return false;
}

function onCircuitSuccess() {
  breaker.failures = 0;
  if (breaker.state !== 'closed') {
    breaker.state = 'closed';
    breaker.openedAtMs = 0;
    breaker.halfOpenInFlight = 0;
    console.warn('[db] circuit closed after successful probe');
  }
}

function onCircuitFailure(err) {
  if (!isTransientDbError(err)) return;
  breaker.failures += 1;
  if (breaker.state === 'half-open' || breaker.failures >= CIRCUIT_FAIL_THRESHOLD) {
    breaker.state = 'open';
    breaker.openedAtMs = Date.now();
    breaker.halfOpenInFlight = 0;
    console.warn(`[db] circuit opened for ${CIRCUIT_OPEN_MS}ms after transient failures (${err.code})`);
  }
}

async function withDbRetry(operation, label) {
  if (!canPassCircuit()) {
    throw makeDbCircuitOpenError();
  }
  let attempt = 0;
  // Initial attempt + RETRY_LIMIT retries
  while (attempt <= RETRY_LIMIT) {
    try {
      const result = await operation();
      onCircuitSuccess();
      return result;
    } catch (err) {
      onCircuitFailure(err);
      const canRetry = isTransientDbError(err) && attempt < RETRY_LIMIT;
      if (!canRetry) throw err;
      const backoffMs = RETRY_BASE_MS * Math.pow(2, attempt);
      console.warn(`[db] transient error on ${label}; retry ${attempt + 1}/${RETRY_LIMIT} in ${backoffMs}ms (${err.code})`);
      await sleep(backoffMs);
      attempt += 1;
    } finally {
      if (breaker.state === 'half-open' && breaker.halfOpenInFlight > 0) {
        breaker.halfOpenInFlight -= 1;
      }
    }
  }
}

const rawExecute = pool.execute.bind(pool);
const rawQuery = pool.query.bind(pool);

pool.execute = (...args) => withDbRetry(() => rawExecute(...args), 'execute');
pool.query = (...args) => withDbRetry(() => rawQuery(...args), 'query');

// 3. THE MAGIC LINE: Export it for the rest of the app to use
export default pool;