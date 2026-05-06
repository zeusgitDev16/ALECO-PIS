// backend/config/db.js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// ─── HELPERS ────────────────────────────────────────────────────────────────

const toInt = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── CONFIGURATION ──────────────────────────────────────────────────────────
// All values tuned for Aiven free-tier MySQL (max ~10 simultaneous connections,
// ~5-minute idle TCP kill) running on Oracle Cloud VM (persistent, always-on).

// Pool sizing — stay well under Aiven's ~10 connection cap.
// 5 max connections leaves room for background tasks (heartbeat, IMAP poll, etc.)
const CONNECTION_LIMIT      = toInt(process.env.DB_CONNECTION_LIMIT,    5);
const MAX_IDLE              = toInt(process.env.DB_MAX_IDLE,             2);  // keep only 2 warm to avoid burst reconnect
const IDLE_TIMEOUT_MS       = toInt(process.env.DB_IDLE_TIMEOUT_MS, 240000); // 4 min — close before Aiven's 5 min kill
const CONNECT_TIMEOUT_MS    = toInt(process.env.DB_CONNECT_TIMEOUT_MS, 20000); // 20s — Aiven SSL handshake is slow

// Request queue — the primary defence against pool exhaustion.
// Any operation that cannot start immediately is queued here (not inside mysql2)
// and given a fair chance to run once a slot opens.
const QUEUE_CONCURRENCY     = toInt(process.env.DB_QUEUE_CONCURRENCY,    4);  // max simultaneous DB operations
const QUEUE_MAX_PENDING     = toInt(process.env.DB_QUEUE_MAX_PENDING,   60);  // max waiting in queue before rejecting
const QUEUE_ITEM_TIMEOUT_MS = toInt(process.env.DB_QUEUE_TIMEOUT_MS,  8000); // 8s: max time a queued request waits for a slot

// Retry — only for genuine transient network errors, not queue overload.
const RETRY_LIMIT           = toInt(process.env.DB_RETRY_LIMIT,          3);
const RETRY_BASE_MS         = toInt(process.env.DB_RETRY_BASE_MS,       250);
const RETRY_MAX_MS          = toInt(process.env.DB_RETRY_MAX_MS,       4000); // cap backoff at 4s

// Circuit breaker — trips only on TRUE network failures (ETIMEDOUT etc).
// A high threshold prevents a momentary hiccup from taking down the whole app.
const CIRCUIT_FAIL_THRESHOLD = toInt(process.env.DB_CIRCUIT_FAIL_THRESHOLD,  8);
const CIRCUIT_OPEN_MS        = toInt(process.env.DB_CIRCUIT_OPEN_MS,       8000); // 8s blackout then probe
const CIRCUIT_HALF_OPEN_MAX  = toInt(process.env.DB_CIRCUIT_HALF_OPEN_MAX,    3);

// Heartbeat — keeps the TCP socket alive and detects Aiven idle kills early.
const HEARTBEAT_INTERVAL_MS      = toInt(process.env.DB_HEARTBEAT_INTERVAL_MS,  55000); // 55s — well inside Aiven 5-min limit
const HEARTBEAT_JITTER_MS        = toInt(process.env.DB_HEARTBEAT_JITTER_MS,    10000); // ±10s
const HEARTBEAT_QUERY_TIMEOUT_MS = toInt(process.env.DB_HEARTBEAT_TIMEOUT_MS,    8000); // 8s ping timeout
const VALIDATION_IDLE_THRESHOLD_MS = toInt(process.env.DB_VALIDATION_THRESHOLD_MS, 15000); // validate conns idle >15s

// ─── POOL ───────────────────────────────────────────────────────────────────

const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port:     process.env.DB_PORT,
  ssl: { rejectUnauthorized: false },
  timezone:   '+08:00',
  dateStrings: true,
  charset:    'utf8mb4',
  multipleStatements: false,  // defence in depth against SQL injection
  waitForConnections: true,
  connectionLimit: CONNECTION_LIMIT,
  maxIdle:         MAX_IDLE,
  idleTimeout:     IDLE_TIMEOUT_MS,
  queueLimit:      0,           // mysql2 internal queue unlimited — our queue (below) controls load
  connectTimeout:  CONNECT_TIMEOUT_MS,
  enableKeepAlive:        true,
  keepAliveInitialDelay: 10000, // 10s — detect dead sockets fast
});

console.log(`✅ [db] Pool configured: max=${CONNECTION_LIMIT} idle=${MAX_IDLE} idleTimeout=${IDLE_TIMEOUT_MS}ms`);

// ─── ERROR CLASSIFICATION ───────────────────────────────────────────────────

function isTransientDbError(err) {
  const code = String(err?.code || '');
  return (
    code === 'ETIMEDOUT'                      ||
    code === 'ECONNRESET'                     ||
    code === 'ECONNREFUSED'                   ||
    code === 'ENOTFOUND'                      ||
    code === 'PROTOCOL_CONNECTION_LOST'       ||
    code === 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR' ||
    code === 'PROTOCOL_ENQUEUE_AFTER_QUIT'    ||
    code === 'ER_CON_COUNT_ERROR'             // MySQL "too many connections"
  );
}

function isPoolExhaustedError(err) {
  // These mean OUR queue or mysql2's internal queue is full — not a DB problem.
  return (
    err?.code === 'DB_QUEUE_FULL'    ||
    err?.code === 'DB_QUEUE_TIMEOUT' ||
    err?.message === 'HEARTBEAT_ACQUIRE_TIMEOUT'
  );
}

// ─── CIRCUIT BREAKER ────────────────────────────────────────────────────────
// Only opens on genuine network-layer DB failures. Pool exhaustion is treated
// as a load-shedding event, NOT as a signal that the database is down.

const breaker = {
  state: 'closed',   // 'closed' | 'open' | 'half-open'
  failures: 0,
  openedAtMs: 0,
  halfOpenInFlight: 0,
};

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
  // half-open: allow up to CIRCUIT_HALF_OPEN_MAX probe requests
  if (breaker.halfOpenInFlight >= CIRCUIT_HALF_OPEN_MAX) return false;
  breaker.halfOpenInFlight += 1;
  return true;
}

function onCircuitSuccess() {
  breaker.failures = 0;
  if (breaker.state !== 'closed') {
    breaker.state = 'closed';
    breaker.openedAtMs = 0;
    breaker.halfOpenInFlight = 0;
    console.warn('[db] Circuit CLOSED — database reachable again');
  }
}

function onCircuitFailure(err) {
  // Pool exhaustion is NOT a DB failure — never penalise the circuit for it.
  if (!isTransientDbError(err) || isPoolExhaustedError(err)) return;
  breaker.failures += 1;
  if (breaker.state === 'half-open' || breaker.failures >= CIRCUIT_FAIL_THRESHOLD) {
    breaker.state = 'open';
    breaker.openedAtMs = Date.now();
    breaker.halfOpenInFlight = 0;
    console.warn(`[db] Circuit OPEN for ${CIRCUIT_OPEN_MS}ms — consecutive transient failures (${err.code})`);
  }
}

function makeCircuitOpenError() {
  const e = new Error('Database temporarily unavailable — please retry in a moment.');
  e.code = 'DB_CIRCUIT_OPEN';
  e.status = 503;
  return e;
}

// ─── REQUEST QUEUE ──────────────────────────────────────────────────────────
// This is the KEY piece that was missing. Without it, every burst of requests
// races directly to the pool. When all connections are taken, mysql2 creates
// NEW TCP connections to Aiven which time out under SSL handshake pressure.
//
// The queue serialises load: at most QUEUE_CONCURRENCY operations run at once.
// Excess requests wait (up to QUEUE_ITEM_TIMEOUT_MS) then either run or error
// gracefully. This completely eliminates the "pool exhaustion → timeout" spiral.

let queueActive = 0;        // number of operations currently executing
const queuePending = [];    // { fn, resolve, reject, enqueuedAt, label }

function queueStats() {
  return { active: queueActive, pending: queuePending.length };
}

function drainQueue() {
  // Flush as many pending items as the concurrency cap allows
  while (queueActive < QUEUE_CONCURRENCY && queuePending.length > 0) {
    const item = queuePending.shift();
    const waitedMs = Date.now() - item.enqueuedAt;

    // If this item has already been waiting too long, reject it immediately
    if (waitedMs > QUEUE_ITEM_TIMEOUT_MS) {
      const e = new Error(`DB queue timeout: '${item.label}' waited ${waitedMs}ms`);
      e.code = 'DB_QUEUE_TIMEOUT';
      e.status = 503;
      item.reject(e);
      continue; // try next item
    }

    queueActive += 1;
    Promise.resolve()
      .then(() => item.fn())
      .then(item.resolve, item.reject)
      .finally(() => {
        queueActive -= 1;
        drainQueue(); // free slot — try next
      });
  }
}

function enqueue(fn, label) {
  return new Promise((resolve, reject) => {
    if (queuePending.length >= QUEUE_MAX_PENDING) {
      const e = new Error(`DB queue full (${QUEUE_MAX_PENDING} pending) — request for '${label}' rejected`);
      e.code = 'DB_QUEUE_FULL';
      e.status = 503;
      return reject(e);
    }
    queuePending.push({ fn, resolve, reject, enqueuedAt: Date.now(), label });
    drainQueue();
  });
}

// ─── RETRY WRAPPER ──────────────────────────────────────────────────────────
// Runs inside the queue slot — retries only genuine transient DB errors
// with exponential backoff capped at RETRY_MAX_MS.

async function withDbRetry(operation, label) {
  if (!canPassCircuit()) throw makeCircuitOpenError();

  let attempt = 0;
  while (attempt <= RETRY_LIMIT) {
    try {
      const result = await operation();
      onCircuitSuccess();
      if (breaker.state === 'half-open') breaker.halfOpenInFlight = Math.max(0, breaker.halfOpenInFlight - 1);
      return result;
    } catch (err) {
      if (breaker.state === 'half-open') breaker.halfOpenInFlight = Math.max(0, breaker.halfOpenInFlight - 1);
      onCircuitFailure(err);

      const canRetry = isTransientDbError(err) && !isPoolExhaustedError(err) && attempt < RETRY_LIMIT;
      if (!canRetry) throw err;

      const rawBackoff = RETRY_BASE_MS * Math.pow(2, attempt);
      const backoffMs = Math.min(rawBackoff, RETRY_MAX_MS);
      console.warn(`[db] Transient error on '${label}'; retry ${attempt + 1}/${RETRY_LIMIT} in ${backoffMs}ms (${err.code})`);
      await sleep(backoffMs);
      attempt += 1;
    }
  }
}

// ─── COMBINED DISPATCHER ────────────────────────────────────────────────────
// Entry point for all DB work: queue → circuit check → retry.

function dispatch(operation, label) {
  return enqueue(() => withDbRetry(operation, label), label);
}

// ─── RAW POOL REFERENCES (before monkey-patching) ───────────────────────────

const rawExecute      = pool.execute.bind(pool);
const rawQuery        = pool.query.bind(pool);
const rawGetConnection = pool.getConnection.bind(pool);

// ─── MONKEY-PATCH pool.execute / pool.query ──────────────────────────────────
// All app code calls pool.execute() / pool.query() — route them through the queue.

pool.execute = (...args) => dispatch(() => rawExecute(...args), 'execute');
pool.query   = (...args) => dispatch(() => rawQuery(...args),   'query');

// ─── MONKEY-PATCH pool.getConnection ─────────────────────────────────────────
// Validates stale connections on checkout so dead TCP sockets are caught before
// a query is attempted.

const connMeta = new WeakMap(); // conn → { acquiredAt, lastUsedAt, validatedAt }

pool.getConnection = async function getConnectionWithValidation() {
  const conn = await rawGetConnection();
  const now  = Date.now();
  const meta = connMeta.get(conn);

  if (meta && (now - meta.lastUsedAt > VALIDATION_IDLE_THRESHOLD_MS)) {
    try {
      await conn.execute('SELECT 1');
      meta.validatedAt = now;
      onCircuitSuccess();
    } catch (err) {
      try { conn.release(); } catch { /* ignore */ }
      onCircuitFailure(err);
      throw err;
    }
  }

  connMeta.set(conn, {
    acquiredAt:  now,
    lastUsedAt:  meta?.lastUsedAt  || now,
    validatedAt: meta?.validatedAt || now,
  });

  const originalRelease = conn.release.bind(conn);
  conn.release = function () {
    const m = connMeta.get(conn);
    if (m) m.lastUsedAt = Date.now();
    return originalRelease();
  };

  return conn;
};

// ─── ALWAYS-ON HEARTBEAT ────────────────────────────────────────────────────
//
// GOAL: Prevent Aiven free-tier from killing idle TCP connections (~5 min).
//
// DESIGN:
//   • Runs completely outside the request queue — never competes with app queries.
//   • Uses rawGetConnection() directly so pool saturation never blocks it.
//   • ADAPTIVE interval: normal = 55s, on failure tightens to 15s for fast recovery.
//   • On consecutive failures, attempts a full reconnect (destroy + reacquire).
//   • Tracks rich stats for the /api/db-health diagnostic endpoint.
//   • Pool pre-warm: after server start, establishes MIN_IDLE connections
//     immediately so the first real request is never slowed by a cold connect.
//
// AIVEN FREE TIER NOTE:
//   Aiven kills idle TCP connections after ~5 minutes. Our heartbeat fires every
//   ~55s (well inside that window). The server.js scheduled jobs (interruptions
//   every 60s, B2B poll every 5min) also hit the DB — together they guarantee
//   continuous activity across ALL connections in the pool.

const HEARTBEAT_NORMAL_INTERVAL_MS  = HEARTBEAT_INTERVAL_MS;         // 55s when healthy
const HEARTBEAT_RECOVERY_INTERVAL_MS = toInt(process.env.DB_HEARTBEAT_RECOVERY_MS, 15000); // 15s when failing
const HEARTBEAT_RECONNECT_AFTER     = toInt(process.env.DB_HEARTBEAT_RECONNECT_AFTER, 3);  // full reconnect after 3 consecutive failures
const POOL_PREWARM_CONNECTIONS      = toInt(process.env.DB_PREWARM_CONNECTIONS, 2);         // connections to establish on startup

let heartbeatTimer   = null;
let heartbeatRunning = false; // guard against overlapping runs

const heartbeatStats = {
  lastRun:             0,
  lastSuccess:         0,
  consecutiveFailures: 0,
  totalRuns:           0,
  totalFailures:       0,
  totalReconnects:     0,
  lastError:           null,
};

// Pre-warm: establish a small number of connections eagerly on startup so the
// first user request doesn't pay the SSL handshake cost. Uses rawGetConnection
// to bypass the app queue.
async function prewarmPool() {
  const conns = [];
  try {
    for (let i = 0; i < POOL_PREWARM_CONNECTIONS; i++) {
      const c = await rawGetConnection();
      conns.push(c);
    }
    console.log(`[db:heartbeat] Pool pre-warmed with ${conns.length} connection(s)`);
  } catch (err) {
    console.warn(`[db:heartbeat] Pre-warm partial (${conns.length}/${POOL_PREWARM_CONNECTIONS}): ${err.message}`);
  } finally {
    for (const c of conns) { try { c.release(); } catch { /* ignore */ } }
  }
}

// Attempt a full connection teardown + reacquire to replace a suspected dead socket.
async function attemptReconnect() {
  heartbeatStats.totalReconnects += 1;
  let conn = null;
  try {
    conn = await rawGetConnection();
    // Destroy the underlying socket so mysql2 will create a fresh TCP connection
    // next time, bypassing any cached-but-dead socket in the pool.
    conn.connection?.destroy?.();
    console.warn('[db:heartbeat] Dead connection destroyed — pool will create a fresh one');
  } catch (err) {
    console.warn(`[db:heartbeat] Reconnect attempt failed: ${err.message}`);
  } finally {
    if (conn) { try { conn.release(); } catch { /* ignore */ } }
  }
  // Now immediately try a fresh ping to verify the DB is actually reachable.
  try {
    const freshConn = await rawGetConnection();
    await freshConn.execute('SELECT 1 AS reconnect_probe');
    freshConn.release();
    console.log('[db:heartbeat] Reconnect probe succeeded — connection pool is healthy');
    onCircuitSuccess();
  } catch (err) {
    console.warn(`[db:heartbeat] Reconnect probe failed: ${err.message}`);
  }
}

async function runHeartbeat() {
  // Prevent overlapping runs if a previous one is still waiting for Aiven
  if (heartbeatRunning) return;
  heartbeatRunning = true;

  const now = Date.now();
  heartbeatStats.lastRun = now;
  heartbeatStats.totalRuns += 1;

  let conn = null;
  try {
    // Acquire a connection with a short deadline — if the pool is completely
    // saturated by app traffic, skip this beat (connections are clearly alive).
    const acquirePromise = rawGetConnection();
    const acquireTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('HEARTBEAT_ACQUIRE_TIMEOUT')), 3000)
    );
    conn = await Promise.race([acquirePromise, acquireTimeout]);

    // Ping — include timestamp so Aiven can't cache/elide the query.
    const pingPromise = conn.execute('SELECT 1 AS hb, NOW() AS ts');
    const pingTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('HEARTBEAT_PING_TIMEOUT')), HEARTBEAT_QUERY_TIMEOUT_MS)
    );
    await Promise.race([pingPromise, pingTimeout]);

    // ── SUCCESS ──────────────────────────────────────────────────────────────
    heartbeatStats.lastSuccess         = Date.now();
    heartbeatStats.consecutiveFailures = 0;
    heartbeatStats.lastError           = null;
    onCircuitSuccess();

  } catch (err) {
    // ── FAILURE ──────────────────────────────────────────────────────────────
    const isExhausted = isPoolExhaustedError(err);

    if (!isExhausted) {
      // Genuine network/DB failure
      heartbeatStats.consecutiveFailures += 1;
      heartbeatStats.totalFailures       += 1;
      heartbeatStats.lastError            = err.message;
      onCircuitFailure(err);

      // Log every failure (not just every 3rd) so Oracle VM syslog captures it
      console.warn(
        `[db:heartbeat] FAILED ×${heartbeatStats.consecutiveFailures} — ${err.message} ` +
        `(circuit: ${breaker.state})`
      );

      // After N consecutive failures, destroy the possibly-dead connection and
      // force a fresh TCP handshake — this repairs Aiven's idle-kill gracefully.
      if (heartbeatStats.consecutiveFailures >= HEARTBEAT_RECONNECT_AFTER) {
        console.warn('[db:heartbeat] Consecutive failure threshold reached — attempting forced reconnect');
        await attemptReconnect();
      }
    }
    // If pool is exhausted: app is busy, connections are alive — silently skip
  } finally {
    if (conn) { try { conn.release(); } catch { /* ignore */ } }
    heartbeatRunning = false;
  }
}

function scheduleNextHeartbeat() {
  if (heartbeatTimer) clearTimeout(heartbeatTimer);

  // Tighten interval when failing so recovery is fast
  const baseInterval = heartbeatStats.consecutiveFailures > 0
    ? HEARTBEAT_RECOVERY_INTERVAL_MS
    : HEARTBEAT_NORMAL_INTERVAL_MS;

  const jitter = Math.floor(Math.random() * HEARTBEAT_JITTER_MS * 2) - HEARTBEAT_JITTER_MS;
  const nextMs = Math.max(5000, baseInterval + jitter); // never shorter than 5s

  heartbeatTimer = setTimeout(async () => {
    await runHeartbeat();
    scheduleNextHeartbeat();
  }, nextMs);
}

function startHeartbeat() {
  if (heartbeatTimer) return;
  console.log(
    `[db:heartbeat] Started — normal: ${HEARTBEAT_NORMAL_INTERVAL_MS / 1000}s, ` +
    `recovery: ${HEARTBEAT_RECOVERY_INTERVAL_MS / 1000}s, ` +
    `reconnect after: ${HEARTBEAT_RECONNECT_AFTER} failures`
  );
  // Pre-warm pool first, then start the beat
  prewarmPool().finally(() => {
    runHeartbeat();
    scheduleNextHeartbeat();
  });
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearTimeout(heartbeatTimer);
    heartbeatTimer = null;
    console.log('[db:heartbeat] Stopped');
  }
}

function getHeartbeatStats() {
  const nowMs = Date.now();
  const msSinceSuccess = heartbeatStats.lastSuccess
    ? nowMs - heartbeatStats.lastSuccess
    : null;
  return {
    circuitState:        breaker.state,
    circuitFailures:     breaker.failures,
    queueActive,
    queuePending:        queuePending.length,
    heartbeat: {
      lastRunIso:          heartbeatStats.lastRun     ? new Date(heartbeatStats.lastRun).toISOString()     : null,
      lastSuccessIso:      heartbeatStats.lastSuccess  ? new Date(heartbeatStats.lastSuccess).toISOString() : null,
      msSinceLastSuccess:  msSinceSuccess,
      consecutiveFailures: heartbeatStats.consecutiveFailures,
      totalRuns:           heartbeatStats.totalRuns,
      totalFailures:       heartbeatStats.totalFailures,
      totalReconnects:     heartbeatStats.totalReconnects,
      lastError:           heartbeatStats.lastError,
      healthy:             heartbeatStats.consecutiveFailures === 0 && msSinceSuccess !== null && msSinceSuccess < HEARTBEAT_NORMAL_INTERVAL_MS * 3,
    },
  };
}

// ─── POOL STATS LOGGING ──────────────────────────────────────────────────────

function logPoolStats() {
  const allConns  = pool._allConnections?.length   || 0;
  const freeConns = pool._freeConnections?.length  || 0;
  const queued    = pool._connectionQueue?.length  || 0;
  const hb        = getHeartbeatStats().heartbeat;
  console.log(
    `[db:pool] conns=${allConns} free=${freeConns} mysqlQueue=${queued} ` +
    `appQueue=${queuePending.length} active=${queueActive} circuit=${breaker.state} ` +
    `hb_ok=${hb.healthy} hb_fails=${hb.consecutiveFailures} reconnects=${hb.totalReconnects}`
  );
}

// ─── STARTUP ─────────────────────────────────────────────────────────────────

startHeartbeat();

if (process.env.DB_POOL_STATS !== 'false') {
  setInterval(logPoolStats, 60000);
}

// ─── EXPORTS ─────────────────────────────────────────────────────────────────

export default pool;
export {
  startHeartbeat,
  stopHeartbeat,
  getHeartbeatStats,
  logPoolStats,
  isTransientDbError,
  queueStats,
};