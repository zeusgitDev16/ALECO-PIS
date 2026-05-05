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
// Reduced defaults for Aiven free tier (max ~10 connections total across all clients)
const CONNECTION_LIMIT = toInt(process.env.DB_CONNECTION_LIMIT, 6); // Reduced from 10 to 6
const MAX_IDLE = toInt(process.env.DB_MAX_IDLE, 4); // Reduced from 10 to 4
const IDLE_TIMEOUT_MS = toInt(process.env.DB_IDLE_TIMEOUT_MS, 120000); // 2 minutes
const CIRCUIT_FAIL_THRESHOLD = toInt(process.env.DB_CIRCUIT_FAIL_THRESHOLD, 6);
const CIRCUIT_OPEN_MS = toInt(process.env.DB_CIRCUIT_OPEN_MS, 15000);
const CIRCUIT_HALF_OPEN_MAX = toInt(process.env.DB_CIRCUIT_HALF_OPEN_MAX, 2);

// Heartbeat configuration: always-on for zero-timeout reliability
const HEARTBEAT_INTERVAL_MS = toInt(process.env.DB_HEARTBEAT_INTERVAL_MS, 90000); // 90s base (well under Aiven 5min limit)
const HEARTBEAT_JITTER_MS = toInt(process.env.DB_HEARTBEAT_JITTER_MS, 15000);      // ±15s jitter
const HEARTBEAT_QUERY_TIMEOUT_MS = toInt(process.env.DB_HEARTBEAT_TIMEOUT_MS, 5000); // 5s max for heartbeat (was 3s, now more tolerant)
const VALIDATION_IDLE_THRESHOLD_MS = toInt(process.env.DB_VALIDATION_THRESHOLD_MS, 10000); // Validate conns idle >10s

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
  // Shorter idle timeout: let connections close naturally before Aiven kills them (5min)
  // This prevents "ghost" connections that appear alive but are dead
  idleTimeout: 120000, // 2 minutes (was 60s, now 2min to stay under Aiven 5min limit)
  queueLimit: 0,
  connectTimeout: CONNECT_TIMEOUT_MS,
  // enableKeepAlive and keepAliveInitialDelay are valid for mysql2
  enableKeepAlive: true,
  keepAliveInitialDelay: 30000 // 30s before first keepalive probe
});

// Connection metadata tracking for validation-on-checkout
const connMeta = new WeakMap(); // Connection -> { acquiredAt, lastUsedAt, validatedAt }
let heartbeatTimer = null;
let heartbeatStats = { lastRun: 0, lastSuccess: 0, consecutiveFailures: 0 };

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

// Capture raw pool methods before any monkey-patching
const rawExecute = pool.execute.bind(pool);
const rawQuery = pool.query.bind(pool);
const rawGetConnection = pool.getConnection.bind(pool);

pool.execute = (...args) => withDbRetry(() => rawExecute(...args), 'execute');
pool.query = (...args) => withDbRetry(() => rawQuery(...args), 'query');

// ─── CONNECTION VALIDATION ON CHECKOUT ──────────────────────────────────────
// Monkey-patch getConnection to validate stale connections before returning them

pool.getConnection = async function getConnectionWithValidation() {
  const conn = await rawGetConnection();
  const now = Date.now();
  const meta = connMeta.get(conn);
  
  // Check if connection has been idle too long and needs validation
  if (meta && (now - meta.lastUsedAt > VALIDATION_IDLE_THRESHOLD_MS)) {
    try {
      // Quick validation ping with short timeout
      await conn.execute('SELECT 1');
      meta.validatedAt = now;
      onCircuitSuccess(); // Validation success closes circuit
    } catch (err) {
      conn.release();
      onCircuitFailure(err);
      // If validation failed, throw to trigger retry logic upstream
      throw err;
    }
  }
  
  // Track connection usage
  connMeta.set(conn, {
    acquiredAt: now,
    lastUsedAt: meta?.lastUsedAt || now,
    validatedAt: meta?.validatedAt || now
  });
  
  // Wrap release to track when connection goes back to pool
  const originalRelease = conn.release.bind(conn);
  conn.release = function() {
    const m = connMeta.get(conn);
    if (m) m.lastUsedAt = Date.now();
    return originalRelease();
  };
  
  return conn;
};

// ─── ALWAYS-ON HEARTBEAT ───────────────────────────────────────────────────
// Keeps TCP socket warm and provides fast circuit recovery
// Uses direct connection acquisition to bypass pool queue when saturated

async function runHeartbeat() {
  const now = Date.now();
  heartbeatStats.lastRun = now;
  
  let conn = null;
  try {
    // Get a fresh connection directly (bypasses pool queue which may be stuck)
    // Use short timeout for acquisition to fail fast if pool is exhausted
    const acquirePromise = rawGetConnection();
    const acquireTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('HEARTBEAT_ACQUIRE_TIMEOUT')), 2000)
    );
    conn = await Promise.race([acquirePromise, acquireTimeout]);
    
    // Ping the connection directly
    const pingPromise = conn.execute('SELECT 1 as heartbeat');
    const pingTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('HEARTBEAT_PING_TIMEOUT')), HEARTBEAT_QUERY_TIMEOUT_MS)
    );
    await Promise.race([pingPromise, pingTimeout]);
    
    // Success: close circuit immediately
    heartbeatStats.lastSuccess = now;
    heartbeatStats.consecutiveFailures = 0;
    onCircuitSuccess();
    
    // Log recovery transitions
    if (breaker.state !== 'closed') {
      console.log(`[db:heartbeat] Database reachable, circuit closed at ${new Date().toISOString()}`);
    }
  } catch (err) {
    heartbeatStats.consecutiveFailures += 1;
    onCircuitFailure(err);
    // Only log every 3rd failure to reduce noise during outages
    if (heartbeatStats.consecutiveFailures % 3 === 1) {
      console.warn(`[db:heartbeat] Failed (${heartbeatStats.consecutiveFailures} consecutive): ${err.message}`);
    }
  } finally {
    if (conn) {
      try { conn.release(); } catch { /* ignore */ }
    }
  }
}

function scheduleNextHeartbeat() {
  // Clear any existing timer
  if (heartbeatTimer) {
    clearTimeout(heartbeatTimer);
  }
  
  // Jitter: base interval ± jitter to prevent thundering herd on recovery
  const jitter = Math.floor(Math.random() * HEARTBEAT_JITTER_MS * 2) - HEARTBEAT_JITTER_MS;
  const nextInterval = HEARTBEAT_INTERVAL_MS + jitter;
  
  heartbeatTimer = setTimeout(async () => {
    await runHeartbeat();
    scheduleNextHeartbeat(); // Reschedule after completion
  }, nextInterval);
}

function startHeartbeat() {
  if (heartbeatTimer) return; // Already running
  console.log(`[db:heartbeat] Starting always-on heartbeat (interval: ${HEARTBEAT_INTERVAL_MS}ms ±${HEARTBEAT_JITTER_MS}ms)`);
  runHeartbeat(); // Immediate first beat
  scheduleNextHeartbeat();
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearTimeout(heartbeatTimer);
    heartbeatTimer = null;
    console.log('[db:heartbeat] Stopped');
  }
}

function getHeartbeatStats() {
  return {
    ...heartbeatStats,
    circuitState: breaker.state,
    circuitFailures: breaker.failures,
    lastRunIso: heartbeatStats.lastRun ? new Date(heartbeatStats.lastRun).toISOString() : null,
    lastSuccessIso: heartbeatStats.lastSuccess ? new Date(heartbeatStats.lastSuccess).toISOString() : null
  };
}

// ─── POOL STATS MONITORING ──────────────────────────────────────────────────
// Periodic logging for diagnostics (every 60s)

function logPoolStats() {
  const allConns = pool._allConnections?.length || 0;
  const freeConns = pool._freeConnections?.length || 0;
  const queued = pool._connectionQueue?.length || 0;
  const acquiring = pool._acquiringConnections?.length || 0;
  
  console.log(`[db:pool] total=${allConns} free=${freeConns} acquiring=${acquiring} queue=${queued} circuit=${breaker.state}`);
}

// Start heartbeat immediately
startHeartbeat();

// Periodic pool stats (optional, can be disabled via env)
if (process.env.DB_POOL_STATS !== 'false') {
  setInterval(logPoolStats, 60000);
}

// 3. THE MAGIC LINE: Export it for the rest of the app to use
export default pool;

// Additional exports for advanced control and monitoring
export { 
  startHeartbeat, 
  stopHeartbeat, 
  getHeartbeatStats, 
  logPoolStats,
  isTransientDbError 
};