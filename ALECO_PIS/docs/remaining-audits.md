# Remaining Audits - ALECO PIS System

## Areas Covered
1. Email/IMAP Integration (B2B Mail)
2. Report Generation and Exports
3. Power Interruption Announcements
4. History / Audit Logging
5. Dashboard and Analytics
6. Poster Worker (Cloud Run)

---

## Scenario 49: B2B IMAP Email - Credential Cascade Security Risk

**Real-World Scenario:**
The B2B inbound IMAP poll falls back to `EMAIL_USER` / `EMAIL_PASS` when B2B-specific credentials are missing. This means the main app Gmail account is used for B2B operations, exposing it to potential lockout.

**Current Code (b2bInboundImapPoll.js line 371-378):**
```javascript
const user =
    process.env.B2B_INBOUND_IMAP_USER ||
    process.env.B2B_MAIL_USER ||
    process.env.EMAIL_USER;
const pass =
    process.env.B2B_INBOUND_IMAP_PASS ||
    process.env.B2B_MAIL_PASS ||
    process.env.EMAIL_PASS;
```

**Bugs Found:**
- 🔴 **CRITICAL BUG**: IMAP credentials cascade to primary app email account
- 🔴 **CRITICAL BUG**: If B2B account is compromised, primary email is also compromised
- 🔴 **CRITICAL BUG**: No separation of concerns between app email and B2B email
- ⚠️ **BUG**: IMAP password stored in plaintext env vars (no key vault)
- ⚠️ **BUG**: No OAuth2 support for Gmail IMAP (basic auth deprecated by Google)
- ⚠️ **BUG**: No rate limiting on IMAP polling

**Real-Life Scenarios:**
1. **Google disables basic auth**: Gmail IMAP stops working entirely
2. **App password exposed**: Attacker gains full email access
3. **IMAP throttling**: Too many polls, Google locks the account
4. **Credential reuse**: B2B partner's reply triggers app email processing

**Proposed Solution:**
1. Mandate separate B2B IMAP credentials (no fallback to EMAIL_USER)
2. Implement OAuth2 for Gmail IMAP before basic auth deprecation
3. Add IMAP polling rate limit (max 1 per 5 minutes)
4. Encrypt credentials at rest (AWS Secrets Manager / HashiCorp Vault)

---

## Scenario 50: B2B IMAP - Concurrent Polling Guard is Process-Local Only

**Real-World Scenario:**
The B2B IMAP poll has a `_polling` flag to prevent concurrent calls, but this only works within a single Node.js process. If deployed on multiple instances (Cloud Run, multiple VMs), multiple polls can run simultaneously.

**Current Code (b2bInboundImapPoll.js line 355-365):**
```javascript
export async function pollB2BInboundOnce() {
    if (_polling) {
        console.log('[B2B inbound] Poll already in progress, skipping.');
        return { ran: false, reason: 'already_polling' };
    }
    _polling = true;
    try {
        return await _doPoll();
    } finally {
        _polling = false;
    }
}
```

**Bugs Found:**
- 🔴 **CRITICAL BUG**: `_polling` flag is process-local — useless in multi-instance deployments
- 🔴 **CRITICAL BUG**: Multiple Cloud Run instances can poll Gmail simultaneously
- 🔴 **CRITICAL BUG**: Google may rate-limit or ban the account for concurrent IMAP connections
- ⚠️ **BUG**: No distributed lock mechanism (Redis, DB row lock)
- ⚠️ **BUG**: No max poll duration — hung poll blocks forever

**Real-Life Scenarios:**
1. **Cloud Run scales to 3 instances**: All 3 poll Gmail at the same time
2. **Cron job triggers on 2 VMs**: Both VMs start IMAP poll simultaneously
3. **IMAP connection limit**: Gmail allows max 15 connections, system exhausts them
4. **Hung poll**: Network issue causes poll to hang, flag never resets (requires restart)

**Proposed Solution:**
1. Replace process-local flag with distributed lock (DB advisory lock or Redis)
2. Add max poll duration (2 minutes), force-release lock on timeout
3. Add jitter to cron schedule (±30 seconds) to avoid thundering herd
4. Monitor IMAP connection count, alert if >10 active

---

## Scenario 51: B2B Email - No SPF/DKIM/DMARC Validation on Inbound

**Real-World Scenario:**
A malicious actor spoofs a B2B partner's email address and sends a fake reply. The system accepts it without verifying the sender's domain authentication.

**Current Code (b2bInboundImapPoll.js line 455-460):**
```javascript
const env = msg.envelope || {};
let providerId = env.messageId || extractHeaderBlock(source, 'Message-ID');
if (!providerId) providerId = `imap-uid-${msg.uid}@${host}`;
const inReplyTo = env.inReplyTo || extractHeaderBlock(source, 'In-Reply-To');
```

**Bugs Found:**
- 🔴 **CRITICAL BUG**: No SPF record validation on inbound email
- 🔴 **CRITICAL BUG**: No DKIM signature verification
- 🔴 **CRITICAL BUG**: No DMARC policy enforcement
- 🔴 **CRITICAL BUG**: `from` address trusted without authentication verification
- ⚠️ **BUG**: Anyone can spoof a partner email and inject fake B2B communications

**Real-Life Scenarios:**
1. **Spoofed NGCP email**: Attacker sends fake "restoration complete" email
2. **Spoofed municipal email**: Fake coordination request accepted as genuine
3. **Phishing via B2B**: Spoofed email contains malicious links, stored in system
4. **Data integrity**: False B2B replies linked to real tickets, corrupting audit trail

**Proposed Solution:**
1. Add SPF validation: check if sender IP matches partner domain's SPF record
2. Add DKIM verification: validate cryptographic signature
3. Add DMARC check: enforce domain policy
4. Flag unauthenticated emails in UI, require manual verification
5. Store authentication results (`spf_pass`, `dkim_pass`, `dmarc_pass`) in DB

---

## Scenario 52: B2B Outbound Email - No Delivery Confirmation

**Real-World Scenario:**
Staff sends a critical B2B email to NGCP about a scheduled interruption. The email bounces (invalid address), but the system reports "sent successfully" because Nodemailer only confirms handoff to SMTP, not delivery.

**Current Code (appMail.js line 52-56):**
```javascript
export async function sendAppMail(opts, { useB2BTransport = false } = {}) {
    const transporter = useB2BTransport ? getB2BMailTransporter() : getDefaultMailTransporter();
    const from = opts.from ?? process.env.EMAIL_USER;
    const info = await transporter.sendMail({
        from, to: opts.to, subject: opts.subject,
```

**Bugs Found:**
- 🔴 **CRITICAL BUG**: `sendMail` only confirms SMTP handoff, not actual delivery
- 🔴 **CRITICAL BUG**: No bounce detection or handling
- 🔴 **CRITICAL BUG**: No retry mechanism for failed deliveries
- ⚠️ **BUG**: Bounced emails silently dropped, sender never notified
- ⚠️ **BUG**: No delivery receipt tracking in database

**Real-Life Scenarios:**
1. **Bounced invitation**: New staff never receives invite code, admin thinks it sent
2. **Wrong B2B address**: Critical NGCP coordination email bounces, nobody knows
3. **Mailbox full**: Partner's inbox is full, email bounces, system shows "sent"
4. **Network issue**: SMTP timeout, email queued but never retried

**Proposed Solution:**
1. Parse SMTP response for bounce indicators
2. Store delivery status in database (`pending`, `delivered`, `bounced`, `failed`)
3. Add webhook endpoint for bounce notifications (if provider supports it)
4. Retry failed sends with exponential backoff (max 3 attempts)
5. Show delivery status in UI with bounce reason

---

## Scenario 53: Poster Worker - No Request Timeout on Cloud Run

**Real-World Scenario:**
The poster capture worker (Cloud Run) has a hard timeout of 90 seconds, but Cloud Run's own request timeout may be shorter. A hung Puppeteer process causes the request to fail ambiguously.

**Current Code (posterCapture.js line 24):**
```javascript
const CAPTURE_HARD_TIMEOUT_MS = 90_000;
```

**Current Code (poster-worker/server.js line 55-98):**
```javascript
app.post('/capture', requireApiKey, async (req, res) => {
    const { id, variant = 'print' } = req.body;
    // ... validation ...
    try {
        const result = await captureWithHardTimeout(id, variant);
        // ...
    } catch (error) {
        return res.status(500).json({ success: false, error: ... });
    }
});
```

**Bugs Found:**
- 🔴 **CRITICAL BUG**: No Cloud Run request timeout alignment (default 300s vs hard 90s)
- 🔴 **CRITICAL BUG**: No response sent if Puppeteer hangs between 90s and Cloud Run timeout
- 🔴 **CRITICAL BUG**: Browser instance never closed on SIGTERM if capture is mid-flight
- ⚠️ **BUG**: No graceful shutdown handling for in-flight captures
- ⚠️ **BUG**: Single browser instance — if it crashes, all subsequent requests fail

**Real-Life Scenarios:**
1. **Cloud Run timeout mismatch**: Request killed at 300s, but hard timeout at 90s leaves 210s of wasted compute
2. **Browser crash**: Chromium segfaults, instance stays null, all future requests fail until restart
3. **Memory leak**: Each page close doesn't free all memory, 1GB VM exhausted after N captures
4. **SIGTERM during capture**: Cloud Run scales down, capture interrupted, no retry

**Proposed Solution:**
1. Align hard timeout with Cloud Run timeout minus 10s buffer
2. Add periodic health checks to browser instance
3. Implement browser restart after N captures or memory threshold
4. Add graceful shutdown: finish in-flight captures before exit
5. Return 503 with `Retry-After` header if browser is unhealthy

---

## Scenario 54: Poster Worker - API Key Stored in Environment, No Rotation

**Real-World Scenario:**
The poster worker uses a simple API key for authentication. If the key is leaked (e.g., in logs, Git commit, or env file), anyone can trigger expensive Puppeteer captures.

**Current Code (poster-worker/server.js line 16-20):**
```javascript
function requireApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.POSTER_WORKER_API_KEY;
  if (!expectedKey) {
    console.error('[worker] POSTER_WORKER_API_KEY not set in environment');
    return res.status(500).json({ error: 'Server configuration error: API key not set' });
  }
```

**Bugs Found:**
- 🔴 **CRITICAL BUG**: Single static API key, no rotation mechanism
- 🔴 **CRITICAL BUG**: Key exposed in process.env, may leak in logs/crash dumps
- 🔴 **CRITICAL BUG**: No rate limiting on capture endpoint (expensive operation)
- ⚠️ **BUG**: No key versioning or multiple valid keys during rotation
- ⚠️ **BUG**: No audit log of capture requests

**Real-Life Scenarios:**
1. **Key leaked in Git**: Attacker finds key, triggers thousands of captures
2. **Ex-staff knows key**: Fired employee uses key to run up Cloud Run costs
3. **Accidental log exposure**: Server logs print headers, key captured in log aggregator
4. **Cost attack**: Attacker floods capture endpoint, Cloud Run bills spike

**Proposed Solution:**
1. Implement key rotation (primary + secondary valid simultaneously)
2. Add rate limiting: max 10 captures per minute per API key
3. Store key hash (bcrypt) instead of plaintext comparison
4. Add request logging: timestamp, source IP, key ID (not full key)
5. Add Cloud Run max instances limit to control cost exposure

---

## Scenario 55: Interruption Auto-Transition - Race Condition with Manual Edit

**Real-World Scenario:**
An admin is editing a scheduled interruption at the exact moment the auto-transition cron job runs. The cron changes status from Pending to Ongoing, then the admin's update overwrites it back to Pending.

**Current Code (interruptionLifecycle.js line 163-178):**
```javascript
const upgradeWhere = `status = 'Pending'${delClause} AND (COALESCE(public_visible_at, date_time_start) <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))`;
const [upgradeCandidates] = await conn.query(
    `SELECT id, type, status, feeder, date_time_start, public_visible_at, poster_image_url 
     FROM aleco_interruptions 
     WHERE ${upgradeWhere} FOR UPDATE`
);
if (upgradeCandidates.length > 0) {
    const upgradeIds = upgradeCandidates.map(c => c.id);
    const upgradePlaceholders = upgradeIds.map(() => '?').join(',');
    await conn.query(
        `UPDATE aleco_interruptions SET status = 'Ongoing', updated_at = ? WHERE id IN (${upgradePlaceholders})`,
        [phNow, ...upgradeIds]
    );
}
```

**Bugs Found:**
- 🔴 **CRITICAL BUG**: `FOR UPDATE` locks released after SELECT, not held during UPDATE
- 🔴 **CRITICAL BUG**: Gap between SELECT and UPDATE allows concurrent modification
- 🔴 **CRITICAL BUG**: No optimistic locking on auto-transitions
- ⚠️ **BUG**: Admin edit can overwrite auto-transition without conflict detection
- ⚠️ **BUG**: `updated_at` not checked before transition

**Real-Life Scenarios:**
1. **Admin edits at go-live time**: Cron sets Ongoing, admin saves with old data, status reverts
2. **Two crons run**: Cron job runs twice (VM restart), double transition
3. **Network delay**: SELECT succeeds, UPDATE delayed, manual edit sneaks in between
4. **Batch update**: 50 advisories go live simultaneously, lock contention

**Proposed Solution:**
1. Combine SELECT and UPDATE in single statement: `UPDATE ... WHERE status = 'Pending' AND ...`
2. Check `affectedRows` — if 0, another process already changed it
3. Use `expected_updated_at` in manual edits to detect auto-transition changes
4. Add `version` column for optimistic locking on all updates

---

## Scenario 56: Interruption Create - No Control Number Uniqueness Check

**Real-World Scenario:**
Two staff members create interruptions with the same control number. The system accepts both because there's no UNIQUE constraint or pre-insert check.

**Current Code (interruptions.js line 822):**
```javascript
const controlNoVal = controlNo != null && String(controlNo).trim() !== '' ? String(controlNo).trim() : null;
```

**Bugs Found:**
- 🔴 **CRITICAL BUG**: No UNIQUE constraint on `control_no` column
- 🔴 **CRITICAL BUG**: No pre-insert check for duplicate control numbers
- 🔴 **CRITICAL BUG**: Two interruptions can share the same control number
- ⚠️ **BUG**: Reports and tracking become ambiguous
- ⚠️ **BUG**: NGCP may reference wrong interruption by control number

**Real-Life Scenarios:**
1. **Duplicate NGCP advisory**: Same control number used for two different advisories
2. **Copy-paste error**: Staff copies wrong control number from email
3. **Auto-generated numbers**: System-generated control numbers collide
4. **Reporting confusion**: Management report counts unique control numbers, gets wrong data

**Proposed Solution:**
1. Add `UNIQUE` index on `control_no` column (allow NULL for optional)
2. Add pre-insert check: `SELECT id FROM aleco_interruptions WHERE control_no = ?`
3. Return 409 Conflict if control number already exists
4. Add control number format validation (regex pattern)

---

## Scenario 57: Interruption Status - Database ENUM Migration Hell

**Real-World Scenario:**
The system dynamically detects DB ENUM values and maps API types to DB literals. If a new type is added to the API but the DB migration wasn't run, the system returns confusing error messages.

**Current Code (interruptionTypeDbEnum.js line 30-55):**
```javascript
export function apiInterruptionTypeToDbLiteral(apiType, dbEnum) {
  if (!dbEnum || dbEnum.size === 0) {
    return { type: apiType };
  }
  if (dbEnum.has(apiType)) {
    return { type: apiType };
  }
  if (apiType === 'Emergency' && dbEnum.has('Unscheduled')) {
    return { type: 'Unscheduled' };
  }
  if (apiType === 'NgcScheduled' && !dbEnum.has('NgcScheduled')) {
    return {
      error: 'This database cannot store NGCP scheduled advisories until the type column is migrated...'
    };
  }
```

**Bugs Found:**
- 🔴 **CRITICAL BUG**: Runtime DB schema detection instead of fixed schema
- 🔴 **CRITICAL BUG**: Different DB instances may have different ENUMs
- 🔴 **CRITICAL BUG**: Error messages expose internal migration paths
- ⚠️ **BUG**: Production and staging behave differently depending on migration state
- ⚠️ **BUG**: No enforcement that all deployments have same schema

**Real-Life Scenarios:**
1. **Staging works, production fails**: Staging has new ENUM, production doesn't
2. **Rolling deployment**: Blue-green deploy, different schema versions
3. **Forgot to run migration**: New feature "CustomPoster" fails in production
4. **Aiven free tier**: Migration partially applied, ENUM in inconsistent state

**Proposed Solution:**
1. Remove runtime ENUM detection — use fixed application-level validation
2. Run migrations automatically on startup (with locking)
3. Add schema version table, enforce minimum version on startup
4. Fail fast: if DB schema < app requirement, refuse to start

---

## Scenario 58: Interruption Public List - Timezone Mismatch in Visibility

**Real-World Scenario:**
A scheduled interruption is set to go public at 8:00 AM Philippine time. The server uses UTC, and the visibility check adds 8 hours to UTC — but daylight saving time or PHP timezone changes break this.

**Current Code (interruptions.js line 424):**
```javascript
const clauses = ['(public_visible_at IS NULL OR public_visible_at <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))'];
```

**Bugs Found:**
- 🔴 **CRITICAL BUG**: Hardcoded +8 hour offset assumes Philippines never changes timezone
- 🔴 **CRITICAL BUG**: `UTC_TIMESTAMP()` + 8 hours is not the same as Philippine local time
- 🔴 **CRITICAL BUG**: DST changes (if any) or timezone law changes break visibility
- ⚠️ **BUG**: Interruption may be visible too early or too late
- ⚠️ **BUG**: `public_visible_at` stored in ??? timezone, compared with UTC+8

**Real-Life Scenarios:**
1. **Philippine DST reinstated**: Government reintroduces DST, all visibility times shift
2. **Server migration**: New server in different region, timezone offset wrong
3. **Midnight advisories**: Advisory scheduled for 12:01 AM becomes visible at 4:01 PM previous day
4. **Cross-timezone staff**: Admin in US creates advisory, times misinterpreted

**Proposed Solution:**
1. Store all times in UTC with timezone metadata
2. Use `CONVERT_TZ()` with named timezone 'Asia/Manila' instead of INTERVAL 8 HOUR
3. Use application-level timezone conversion, not DB-level arithmetic
4. Add timezone column per advisory for future multi-region support

---

## Scenario 59: Dashboard Stats - No Cache = Repeated Expensive Queries

**Real-World Scenario:**
Every admin dashboard load triggers a full table scan COUNT(*) query on `aleco_tickets`. With 10,000 tickets and 50 concurrent admins, the database is overwhelmed.

**Current Code (ticket-routes.js line 137-157):**
```javascript
router.get('/tickets/dashboard-stats', requireStaff, async (req, res) => {
    const [rows] = await pool.execute(`
        SELECT
            COUNT(*) AS total,
            SUM(status = 'Pending') AS pending,
            SUM(status = 'Ongoing') AS ongoing,
            SUM(status IN ('Restored', 'Resolved')) AS resolved,
            SUM(status = 'Unresolved') AS unresolved,
            SUM(status = 'NoFaultFound') AS nofault,
            SUM(status = 'AccessDenied') AS denied,
            SUM(is_urgent = 1) AS urgent,
            SUM(service_memo_id IS NOT NULL) AS memo_linked
        FROM aleco_tickets
        WHERE deleted_at IS NULL
    `);
    res.json({ success: true, data: rows[0] });
});
```

**Bugs Found:**
- 🔴 **CRITICAL BUG**: No caching — every page load runs full table scan
- 🔴 **CRITICAL BUG**: Multiple SUM() conditions = full table scan with function evaluation
- 🔴 **CRITICAL BUG**: No index on `deleted_at` means table scan even for simple filter
- ⚠️ **BUG**: No materialized view for dashboard stats
- ⚠️ **BUG**: Stats become stale between queries but there's no benefit to real-time

**Real-Life Scenarios:**
1. **50 admins open dashboard**: 50 simultaneous full table scans
2. **Auto-refresh**: Frontend polls every 30 seconds, 120 queries per hour per admin
3. **Peak hours**: Dashboard queries compete with ticket submission, everything slows
4. **Report generation**: Same stats queried by reports, triple the load

**Proposed Solution:**
1. Cache dashboard stats in memory with 5-minute TTL
2. Add composite index: `INDEX(deleted_at, status)`
3. Create materialized view or counter table updated by triggers
4. Use event-based invalidation instead of time-based
5. Add `Cache-Control: max-age=300` header

---

## Scenario 60: History Export - No Limit = Memory Exhaustion

**Real-World Scenario:**
An admin exports the full history for the past year. The system builds a massive UNION ALL query across 7 tables, loads everything into memory, then generates an Excel file.

**Current Code (history.js line 394-396):**
```javascript
const [rows] = await pool.query(
    `SELECT * FROM (${unionSql}) h ${whereSql} ORDER BY h.createdAt DESC`
);
```

**Bugs Found:**
- 🔴 **CRITICAL BUG**: No LIMIT on export query — fetches ALL matching rows
- 🔴 **CRITICAL BUG**: UNION ALL across 7 tables, each potentially millions of rows
- 🔴 **CRITICAL BUG**: Entire result set loaded into Node.js memory before Excel generation
- ⚠️ **BUG**: With 100,000 history rows, Node.js process may OOM (1GB VM limit)
- ⚠️ **BUG**: No streaming export — everything buffered in memory

**Real-Life Scenarios:**
1. **Yearly audit export**: Admin exports 1 year of history = 500,000 rows, server crashes
2. **Multiple concurrent exports**: 3 admins export simultaneously, all OOM
3. **Large Excel file**: 500,000 rows * 10 columns = ~50MB in memory
4. **Frontend timeout**: Export takes 2 minutes, browser gives up, server still processing

**Proposed Solution:**
1. Add mandatory LIMIT (default 10,000, max 50,000)
2. Implement streaming export (cursor-based MySQL query, stream to Excel/CSV)
3. Use worker queue for large exports, email download link when ready
4. Add export size estimate in preview endpoint
5. Add `Content-Length` header for progress tracking

---

## Scenario 61: History Feed - SQL Injection via `q` and `actor` Parameters

**Real-World Scenario:**
The history feed uses `pool.escape()` for parameter escaping, but this is applied to LIKE patterns that include user input. If escaping has edge cases, SQL injection is possible.

**Current Code (history.js line 248-269):**
```javascript
function buildHistoryWhereSql({ modules, q, actor, startDate, endDate }) {
  const where = [];
  const esc = (v) => pool.escape(v);
  if (Array.isArray(modules) && modules.length > 0) {
    where.push(`h.module IN (${modules.map((m) => esc(m)).join(',')})`);
  }
  if (q) {
    const like = `%${q}%`;
    where.push(`(h.title LIKE ${esc(like)} OR h.detail LIKE ${esc(like)} OR h.entityLabel LIKE ${esc(like)})`);
  }
```

**Bugs Found:**
- 🔴 **CRITICAL BUG**: `pool.escape()` on LIKE patterns with `%` may not handle all edge cases
- 🔴 **CRITICAL BUG**: `modules` array values escaped individually but concatenated with `join(',')`
- ⚠️ **BUG**: No prepared statements used for history feed
- ⚠️ **BUG**: Direct string interpolation into SQL query
- ⚠️ **BUG**: `pool.escape()` behavior depends on mysql2 version and connection charset

**Real-Life Scenarios:**
1. **Malicious search**: Admin searches `'; DROP TABLE aleco_tickets; --`
2. **Unicode escape bypass**: Multi-byte character breaks escaping logic
3. **Module injection**: `?modules=tickets','interruptions` — malformed array handling
4. **Actor search**: `actor=%' OR '1'='1` — pattern matching bypass

**Proposed Solution:**
1. Use prepared statements for ALL history queries
2. Replace `pool.escape()` with parameterized queries
3. Validate `modules` against whitelist before query construction
4. Add SQL injection detection in WAF or middleware
5. Run regular security scans (SQLMap) on history endpoints

---

## Scenario 62: Global History Flush - No Confirmation or Audit Trail

**Real-World Scenario:**
An admin accidentally clicks "Flush History" or a compromised account calls `DELETE /history/flush`. All audit logs are permanently deleted with no trace.

**Current Code (history.js line 486-541):**
```javascript
router.delete('/history/flush', requireAdmin, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [r1] = await connection.execute('DELETE FROM aleco_ticket_logs');
    const [r2] = await connection.execute('DELETE FROM aleco_b2b_mail_audit_logs');
    // ... 4 more tables ...
    await connection.commit();
    // ...
  }
});
```

**Bugs Found:**
- 🔴 **CRITICAL BUG**: Single API call permanently deletes ALL audit logs
- 🔴 **CRITICAL BUG**: No confirmation code or MFA required
- 🔴 **CRITICAL BUG**: No pre-flush backup or export
- 🔴 **CRITICAL BUG**: Deleted logs not written to immutable store (WORM storage)
- ⚠️ **BUG**: No rate limiting — can be called repeatedly
- ⚠️ **BUG**: No notification to other admins that logs were flushed

**Real-Life Scenarios:**
1. **Malicious insider**: Disgruntled admin deletes all logs before resigning
2. **Account compromise**: Attacker gains admin access, wipes audit trail
3. **Accidental click**: "Flush History" button clicked without confirmation
4. **Cover-up**: Staff deletes logs to hide misconduct

**Proposed Solution:**
1. Require MFA + confirmation code for flush
2. Auto-export logs to immutable storage before flush
3. Add 24-hour delay: schedule flush, allow cancellation
4. Send notification to all admins when flush occurs
5. Maintain tamper-proof audit trail in separate system (append-only)

---

## Scenario 63: Interruption Poster - Public SPA URL Leakage Risk

**Real-World Scenario:**
The poster capture worker fetches a public-facing URL (`/print-interruption/:id`) which may be accessible to anyone. If this page contains sensitive data, it's exposed.

**Current Code (posterCapture.js line 75-84):**
```javascript
function getPublicPosterPageUrl(id, variant = 'print') {
  const base = getPublicAppBaseUrl();
  if (!base) return null;
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (variant === 'infographic') {
    return `${base}/poster/interruption/${n}`;
  }
  return `${base}/print-interruption/${n}`;
}
```

**Bugs Found:**
- 🔴 **CRITICAL BUG**: `/print-interruption/:id` is a public route, accessible without auth
- 🔴 **CRITICAL BUG**: If poster page contains internal notes or staff-only data, it's leaked
- ⚠️ **BUG**: No authentication on print-interruption route
- ⚠️ **BUG**: Search engines may index these pages

**Real-Life Scenarios:**
1. **Internal notes exposed**: Print page shows `actorEmail` or `actorName`
2. **Search engine indexing**: Google crawls `/print-interruption/123`, caches it
3. **Data harvesting**: Script enumerates all print pages, collects interruption data
4. **Social media preview**: Facebook scraper reads Open Graph meta tags

**Proposed Solution:**
1. Add authentication to `/print-interruption/:id` (require valid token)
2. Strip internal/sensitive data from public-facing print template
3. Add `noindex, nofollow` robots meta tag
4. Use `POST` with token instead of `GET` for poster capture trigger

---

## Scenario 64: Interruption Auto-Archive - Batch Update Without Row Lock

**Real-World Scenario:**
The auto-archive job runs a batch UPDATE on `aleco_interruptions` without row locks. If an admin edits an advisory during the archive, the update may be lost.

**Current Code (interruptionLifecycle.js line 118-122):**
```javascript
const [energizedResult] = await pool.query(
    `UPDATE aleco_interruptions SET deleted_at = ? WHERE status = '${energizedDbLiteral}' AND deleted_at IS NULL
     AND date_time_restored IS NOT NULL AND DATE_ADD(date_time_restored, INTERVAL ? HOUR) <= ?`,
    [phNow, RESOLVED_ARCHIVE_HOURS, phNow]
);
```

**Bugs Found:**
- 🔴 **CRITICAL BUG**: No `FOR UPDATE` or transaction isolation on batch archive
- 🔴 **CRITICAL BUG**: Admin edit and auto-archive can collide silently
- 🔴 **CRITICAL BUG**: `deleted_at` set by system, admin's `updated_at` not checked
- ⚠️ **BUG**: No notification that advisory was auto-archived
- ⚠️ **BUG**: `RESOLVED_ARCHIVE_HOURS` hardcoded, not configurable per advisory

**Real-Life Scenarios:**
1. **Admin reopens archived advisory**: Admin edits advisory at archive time, changes lost
2. **Batch job during peak**: Archive runs during busy period, affects active edits
3. **Wrong archive timing**: Emergency advisory archived too quickly, consumers confused
4. **Legal hold**: Advisory under investigation gets auto-archived, evidence lost

**Proposed Solution:**
1. Use transaction with `FOR UPDATE` on affected rows
2. Check `updated_at` before archive: if changed since loaded, skip
3. Add `do_not_archive` flag per advisory for legal/sensitive cases
4. Make `RESOLVED_ARCHIVE_HOURS` configurable per type
5. Send notification before auto-archive (grace period)

---

## Scenario 65: Email Configuration - Gmail App Password in Environment Variables

**Real-World Scenario:**
The system uses Gmail SMTP with app passwords stored in `.env` files. These files may be committed to Git, exposed in logs, or leaked through process inspection.

**Current Code (appMail.js line 10-18):**
```javascript
export function getDefaultMailTransporter() {
    if (!defaultTransporter) {
        defaultTransporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });
    }
    return defaultTransporter;
}
```

**Bugs Found:**
- 🔴 **CRITICAL BUG**: Gmail password in plaintext environment variable
- 🔴 **CRITICAL BUG**: No OAuth2 or service account authentication
- 🔴 **CRITICAL BUG**: `.env` files may be committed, logged, or exposed
- ⚠️ **BUG**: Gmail app passwords have limited security, no 2FA
- ⚠️ **BUG**: No email sending fallback if Gmail is down

**Real-Life Scenarios:**
1. **`.env` committed to Git**: Password exposed in repository history
2. **Container inspection**: `docker inspect` reveals env vars
3. **Process dump**: Core dump contains environment variables
4. **Gmail security alert**: Google detects "less secure app access", disables account
5. **Account takeover**: Password leaked, attacker reads all system emails

**Proposed Solution:**
1. Migrate to OAuth2 (Google Workspace service account)
2. Use secret manager (AWS Secrets Manager, GCP Secret Manager)
3. Add email provider fallback (SendGrid, AWS SES)
4. Rotate credentials quarterly with automated reminder
5. Scan repository for `.env` files in CI/CD pipeline

---

## Scenario 66: Interruption List - N+1 Query on Every List Request

**Real-World Scenario:**
The interruption list endpoint runs auto-transitions on every request, which queries the DB for candidates, then updates them. This is done even for public list requests.

**Current Code (interruptions.js line 476):**
```javascript
const { goLivePosterCandidates } = await runAutoTransitions(pool);
```

**Bugs Found:**
- 🔴 **CRITICAL BUG**: Auto-transition runs on EVERY list request, not just cron
- 🔴 **CRITICAL BUG**: Public list requests trigger DB writes (side effects on GET)
- 🔴 **CRITICAL BUG**: N+1: one query to find candidates, then N updates
- ⚠️ **BUG**: No read/write separation — GET requests modify data
- ⚠️ **BUG**: Cache invalidation nightmare — list modifies data it returns

**Real-Life Scenarios:**
1. **Public page refresh**: Consumer refreshes bulletin, triggers DB writes
2. **Bot scraping**: Scraper hits public list, triggers hundreds of transitions
3. **Rate limiting bypass**: Attacker calls list endpoint to force transitions
4. **Inconsistent reads**: List returns data, transitions change it mid-request

**Proposed Solution:**
1. Move auto-transitions to dedicated cron job only
2. List endpoint should be pure read, no side effects
3. Use read replica for list queries if write separation implemented
4. Add `skipAutoTransition` flag for internal/batch operations

---

## Scenario 67: History Union Query - Performance Degradation Over Time

**Real-World Scenario:**
The history feed uses a massive UNION ALL across 7 tables with no indexing strategy. As data grows, this query becomes exponentially slower.

**Current Code (history.js line 91-245):**
```sql
SELECT ... FROM aleco_ticket_logs
UNION ALL
SELECT ... FROM aleco_interruption_updates
UNION ALL
SELECT ... FROM aleco_interruption_logs
UNION ALL
SELECT ... FROM aleco_personnel_audit_logs
UNION ALL
SELECT ... FROM aleco_b2b_mail_audit_logs
UNION ALL
SELECT ... FROM aleco_export_log
UNION ALL
SELECT ... FROM users
UNION ALL
SELECT ... FROM access_codes
```

**Bugs Found:**
- 🔴 **CRITICAL BUG**: UNION ALL across 8 tables, each potentially large
- 🔴 **CRITICAL BUG**: No indexes on `created_at` for all history tables
- 🔴 **CRITICAL BUG**: `CONCAT()` and `CASE` expressions in every row prevent index use
- ⚠️ **BUG**: `SELECT *` from union result fetches all columns
- ⚠️ **BUG**: `COUNT(*)` on union requires full scan of all tables
- ⚠️ **BUG**: No partitioning by date for large history tables

**Real-Life Scenarios:**
1. **1 year of operations**: 8 tables * 100,000 rows = 800,000 row union
2. **Concurrent history feeds**: 10 admins viewing history simultaneously
3. **Export + feed**: Admin exports while another views feed, double load
4. **Memory pressure**: MySQL temp table for UNION exceeds buffer pool

**Proposed Solution:**
1. Add `INDEX(created_at)` on all history tables
2. Create unified `aleco_audit_log` table with partitioning by month
3. Use event sourcing pattern — append-only log, separate read models
4. Add materialized view refreshed every 5 minutes
5. Cache count queries separately from data queries

---

## Summary of New Critical Bugs

| # | Bug | Severity | Area |
|---|-----|----------|------|
| 49 | IMAP credentials cascade to primary email account | CRITICAL | B2B Mail |
| 50 | Concurrent polling guard is process-local only | CRITICAL | B2B Mail |
| 51 | No SPF/DKIM/DMARC validation on inbound email | CRITICAL | B2B Mail |
| 52 | No delivery confirmation for outbound email | CRITICAL | Email |
| 53 | No request timeout alignment on Cloud Run | CRITICAL | Poster Worker |
| 54 | Static API key, no rotation, no rate limiting | CRITICAL | Poster Worker |
| 55 | Race condition: auto-transition vs manual edit | CRITICAL | Interruptions |
| 56 | No control number uniqueness check | CRITICAL | Interruptions |
| 57 | Runtime DB ENUM detection causes inconsistency | CRITICAL | Interruptions |
| 58 | Hardcoded timezone offset for visibility | CRITICAL | Interruptions |
| 59 | Dashboard stats no cache, full table scan | CRITICAL | Dashboard |
| 60 | History export no LIMIT = memory exhaustion | CRITICAL | History |
| 61 | SQL injection risk in history feed parameters | CRITICAL | History |
| 62 | Global history flush no confirmation or backup | CRITICAL | History |
| 63 | Public print-interruption URL leaks data | CRITICAL | Interruptions |
| 64 | Auto-archive batch update without row lock | CRITICAL | Interruptions |
| 65 | Gmail password in plaintext env var | CRITICAL | Email |
| 66 | Auto-transition runs on every list request | CRITICAL | Interruptions |
| 67 | History UNION query performance degrades over time | CRITICAL | History |

---

## Real-Life Combined Attack Scenarios

**Scenario F: Email-Based System Takeover**
1. Attacker discovers Gmail app password in leaked `.env`
2. Attacker uses password to access Gmail IMAP directly
3. Attacker reads all B2B emails, extracts partner contacts
4. Attacker spoofs NGCP email, sends fake restoration notice
5. System accepts fake email (no SPF/DKIM check)
6. Fake update linked to real interruption, public misinformed

**Scenario G: Audit Trail Destruction**
1. Attacker gains admin access via forged legacy headers (Scenario 39)
2. Attacker calls `DELETE /history/flush` — all logs gone
3. Attacker modifies tickets, no audit trail exists
4. Attacker logs out, investigation impossible

**Scenario H: Cost Exploitation via Poster Worker**
1. Attacker obtains poster worker API key
2. Attacker floods `/capture` endpoint with requests
3. Cloud Run scales to max instances, running expensive Puppeteer
4. Cloud Run bill spikes, system owner unaware
5. Legitimate poster captures queued behind attack traffic

**Scenario I: Interruption Status Manipulation**
1. Attacker calls public interruption list repeatedly
2. Each call triggers `runAutoTransitions()` with DB writes
3. Attacker forces premature status changes
4. Public bulletin shows wrong status, causing confusion

**Scenario J: Data Leak via Public Routes**
1. Attacker enumerates `/print-interruption/1`, `/2`, `/3`...
2. Pages contain actor email, internal notes, staff names
3. Attacker builds database of ALECO operations and staff
4. Information used for targeted phishing or social engineering
