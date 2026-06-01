# ALECO PIS — Implementation Plan
## Remediation Roadmap: From Foundation to UI Interactive Rewiring

**Date:** May 30, 2026  
**Total Documented Bugs:** 173  
**Constraint:** No UI changes in early phases. Backend safety nets and edge-case hardening only.  
**Goal:** Close critical vulnerabilities, eliminate race conditions, and add defensive guardrails without disrupting existing user flows.

---

## Phase Priority Philosophy

| Principle | Rationale |
|-----------|-----------|
| **1. Foundation before features** | Global error handling, security headers, and body limits protect everything above them. If the app crashes, nothing else matters. |
| **2. Exposure before complexity** | Publicly visible leaks (debug endpoints, API maps, health endpoints) are the easiest for attackers to exploit. Close them first. |
| **3. Auth before business logic** | If anyone can impersonate a dispatcher or admin, business-logic fixes are meaningless. Harden the gate first. |
| **4. Validation before optimization** | Prevent bad data from entering the system before you optimize how it flows through. |
| **5. UI rewiring last** | Frontend auth pattern changes (localStorage → cookies, legacy headers → JWT-only) require the most testing and risk breaking user flows. Do them after the backend is bulletproof. |

---

## Phase 1: Foundation — Crash Prevention & Immediate Exposure Reduction

**Goal:** Prevent the app from crashing under unexpected input, and remove low-hanging attack vectors that require zero logic changes.

**Risk Level:** Very Low — these are purely additive or subtractive changes. No existing behavior is modified.

### 1.1 Global Error Handlers & Process Resilience
**Files:** `server.js`  
**Bugs Addressed:** #146, #147  
**What:**
- Add `process.on('uncaughtException', ...)` handler to log and gracefully restart instead of crashing
- Add `process.on('unhandledRejection', ...)` handler to catch async promise rejections
- Wrap `server.js` startup in a try/catch with graceful shutdown on SIGTERM/SIGINT
- Add `clearInterval` cleanup for scheduled jobs on shutdown

**Why First:** If the server crashes during a storm or peak ticket submission, all operations halt. This is the bedrock safety net.

---

### 1.2 Security Headers (Helmet.js)
**Files:** `server.js`  
**Bugs Addressed:** #152  
**What:**
- Install and configure `helmet` middleware with:
  - `contentSecurityPolicy` (restrict inline scripts, external resources)
  - `xFrameOptions: 'DENY'` (prevent clickjacking)
  - `hsts: { maxAge: 31536000 }` (force HTTPS)
  - `referrerPolicy: { policy: 'same-origin' }`
  - `xContentTypeOptions: 'nosniff'`
  - `permissionsPolicy` (restrict camera, microphone, geolocation)
- Disable `contentSecurityPolicy` initially if inline React scripts break, then tune it

**Why First:** One-line middleware addition. Zero logic changes. Immediately raises security posture for all routes.

---

### 1.3 Request Body Size Limits
**Files:** `server.js`  
**Bugs Addressed:** #157  
**What:**
- Change `app.use(express.json())` to `app.use(express.json({ limit: '1mb' }))`
- Add `app.use(express.urlencoded({ limit: '1mb', extended: true }))` if needed
- Tune limit per route if ticket image metadata needs more

**Why First:** Prevents trivial DoS via 100MB JSON payloads on a 1GB RAM VM. No user-facing impact.

---

### 1.4 Remove/Hide Public Debug & Diagnostic Endpoints
**Files:** `server.js`  
**Bugs Addressed:** #156, #160, #167 (partial), #173  
**What:**
- Delete or guard `GET /api/debug/routes` behind `requireAdmin`
- Guard `GET /api/db-health` behind `requireAdmin` OR move to a separate internal port
- Remove stale deployment info from `/api/debug/routes` response ("Vercel", "Render")
- Move bot test endpoint `/debug/bot-test` behind admin auth or remove it

**Why First:** These endpoints are actively leaking the API surface area and infrastructure details to unauthenticated users. Removing them is the fastest way to reduce attack surface.

---

### 1.5 Fix Nginx Port Mismatch
**Files:** `nginx-bot-config.txt`, `nginx-fixed.txt`  
**Bugs Addressed:** #167  
**What:**
- Change `proxy_pass http://localhost:3000` to `proxy_pass http://localhost:5000`
- Remove or clarify purpose of `nginx-fixed.txt` (rename or delete if stale)
- Ensure nginx config file has `.conf` extension and is properly symlinked

**Why First:** Bot OG tags are already broken in production. This is a one-line config fix with immediate user-facing benefit.

---

### 1.6 Fix Stale SEO Domains
**Files:** `public/robots.txt`, `public/sitemap.xml`, `index.html`, `vite.config.js`  
**Bugs Addressed:** #169, #170, #171  
**What:**
- Update `robots.txt` sitemap URL to `https://apisph.org/sitemap.xml`
- Update `sitemap.xml` `<loc>` to `https://apisph.org/`
- Add `Disallow: /api/` to `robots.txt`
- Fix `vite.config.js` `transformIndexHtml` to actually replace hardcoded URLs in `index.html` OR use `__SITE_CANONICAL__` placeholders in `index.html`
- Remove hardcoded ngrok host from `vite.config.js` `allowedHosts`

**Why First:** Pure config/static file changes. No code logic involved. Fixes broken social sharing immediately.

---

## Phase 2: Authentication & Session Hardening

**Goal:** Close the authentication bypasses and session vulnerabilities that allow attackers to impersonate users or force mass logouts.

**Risk Level:** Low to Medium — changes are in middleware and auth routes. Must be tested thoroughly but do not affect UI components.

### 2.1 Fix Legacy Header Authentication Bypass
**Files:** `backend/middleware/requireApiSession.js`  
**Bugs Addressed:** #139, #143, #144  
**What:**
- Set `ALLOW_LEGACY_SESSION_HEADERS=false` in production `.env`
- Verify `requireApiSession` rejects requests that only have `x-user-email` + `x-token-version` without a valid JWT
- Ensure `x-user-email` header is never trusted as the authenticated identity — always derive from JWT payload
- Add `req.authUser` population from JWT `sub` claim, not from any client-sent email header

**Why Second:** This closes the most critical auth bypass. Once fixed, all subsequent business-logic changes can assume JWT is the sole source of truth.

---

### 2.2 Rate Limit All Public State-Changing Routes
**Files:** `backend/routes/tickets.js`, `backend/routes/auth.js`  
**Bugs Addressed:** #141, #142  
**What:**
- Apply `rateLimitTicketSubmission`-style middleware to:
  - `POST /api/tickets/send-copy`
  - `POST /api/logout-all`
  - `POST /api/forgot-password`
  - `POST /api/reset-password`
- Use stricter limits for sensitive routes (e.g., 5 requests per 15 minutes for send-copy)

**Why Second:** Even with auth hardened, unauthenticated routes remain attack vectors. Rate limiting is a cheap, effective safety net.

---

### 2.3 JWT Session Improvements
**Files:** `backend/utils/sessionJwt.js`, `backend/routes/auth.js`  
**Bugs Addressed:** #144  
**What:**
- Reduce JWT `expiresIn` from `'30d'` to `'1d'` or `'7d'`
- Implement a refresh-token pattern OR add a `/api/refresh` endpoint that reissues access tokens for valid sessions
- Store `tokenVersion` in JWT payload and validate it on every request (already partially done, verify it works)

**Why Second:** 30-day tokens are excessive for a utility operations system. Shorter tokens limit the blast radius of a stolen token.

---

### 2.4 Add CSRF Protection for Cookie-Based Sessions (Future-Proofing)
**Files:** `server.js` (add `csurf` or custom token middleware)  
**Bugs Addressed:** #151  
**What:**
- Add `csurf` middleware to generate and validate CSRF tokens
- Return CSRF token in a response header for authenticated sessions
- Frontend will eventually need to send this token in `X-CSRF-Token` header
- **Note:** This can be added backend-only first; frontend wiring happens in Phase 5/6

**Why Second:** Backend CSRF infrastructure can be deployed before the frontend uses it. It sits silently until the UI is rewired.

---

### 2.5 Harden Actor Attribution — Remove Client-Supplied `actor_email` / `actor_name`
**Files:** `backend/routes/tickets.js`, `backend/routes/service-memos.js`, `backend/routes/interruptions.js`, `backend/routes/b2b-mail.js`, `backend/routes/user.js`  
**Bugs Addressed:** Scenario 40 (`additional-bugs-audit.md`)  
**What:**
- Remove `req.body.actor_email` and `req.body.actor_name` from ALL route handlers
- Enforce `const actorEmail = req.authUser?.email` as the ONLY source of actor identity
- Reject requests with `actor_email` in body with 400 (never trust client-sent attribution)
- Audit all `actorEmailFromReq` helper functions — remove fallback to `req.headers['x-user-email']`
- Add a lint rule or CI check to prevent `actor_email` from being accepted in request bodies

**Why Second:** If a disgruntled staff member can forge audit trail attribution, accountability is destroyed. This is a one-line change per route but closes a critical integrity gap.

---

### 2.6 Add Login Brute-Force Protection & Account Lockout
**Files:** `backend/routes/auth.js`  
**Bugs Addressed:** Scenario 39 (`additional-bugs-audit.md`) — "No rate limiting on login", "No brute force protection", "No account lockout"  
**What:**
- Add per-IP rate limit on `POST /api/login` and `POST /api/google-login` (e.g., 10 attempts per 15 minutes)
- Add per-email account lockout after 5 consecutive failed attempts (store `failed_login_count`, `locked_until` in `users` table)
- On lockout, return generic error ("Invalid credentials") to prevent email enumeration, but log lockout event server-side
- Reset failed count on successful login
- Add `X-RateLimit-Remaining` and `Retry-After` headers

**Why Second:** Login is the front door. Without brute-force protection, an attacker can systematically guess passwords or token versions.


---

## Phase 3: Data Integrity, Validation & Race Conditions

**Goal:** Prevent bad data from entering the database and eliminate race conditions that produce duplicates or corrupt sequences.

**Risk Level:** Medium — touches core business logic. Must be tested with realistic concurrent load.

### 3.1 Fix Service Memo Control Number Race Condition
**Files:** `backend/utils/memoControlNumber.js`  
**Bugs Addressed:** #153  
**What:**
- Always wrap `peekNextMemoControlNumber` in a transaction, regardless of `existingConnection`
- If `existingConnection` is passed but NOT in a transaction, start one inside the function
- Add `connection.inTransaction` check before skipping `beginTransaction()`
- Add unique constraint on `aleco_service_memos.control_number` at the DB level as final guardrail

**Why Third:** Duplicate control numbers break crew dispatch tracking. This is a data-integrity issue that gets worse as usage scales.

---

### 3.2 Add Service Memo Payload Validation
**Files:** `backend/utils/serviceMemoExtended.js`, `backend/routes/service-memos.js`  
**Bugs Addressed:** #154  
**What:**
- Restore `validateMemoPayload` to actually validate fields:
  - `ticket_id` exists and is a valid ticket
  - `referral_received_date`, `site_arrived_date`, `finished_date` are valid `YYYY-MM-DD` strings
  - `intake_time`, `referral_received_time`, etc. are valid `HH:MM` strings
  - `internal_notes` / `user_notes` length is capped (e.g., 10,000 chars)
- Reject malformed dates with clear 400 errors

**Why Third:** Currently ANY data is accepted. Adding validation prevents frontend crashes and reporting errors caused by garbage data.

---

### 3.3 Fix Ticket Grouping Timezone Bug
**Files:** `backend/routes/ticket-grouping.js` (or wherever group ID is generated)  
**Bugs Addressed:** #148  **What:**
- Ensure group ID generation uses `Asia/Manila` timezone, not server local time
- Use a timezone-aware date formatter (e.g., `dayjs().tz('Asia/Manila').format('YYYYMMDD')`)  
- Add a migration script to recompute group IDs for existing tickets if needed

**Why Third:** This causes real operational confusion — tickets filed at 11:30 PM Philippines time get grouped under the wrong date.

---

### 3.4 Prevent SMS Template Injection
**Files:** `backend/utils/smsTemplate.js`  
**Bugs Addressed:** #150  
**What:**
- Replace naive string replacement with a strict template engine OR sanitize all placeholder values
- Strip/escape curly braces `{` `}` and other template syntax from user input before substitution
- Add a maximum SMS length check after rendering (e.g., 1600 chars for multi-part SMS)
- Validate that rendered SMS contains no unsubstituted `{placeholder}` tokens before sending

**Why Third:** SMS injection can cause runaway billing or phishing messages sent to consumers.

---

### 3.5 Add File Upload Safety Limits & Cloudinary Failure Handling
**Files:** `cloudinaryConfig.js`, `backend/routes/tickets.js`  
**Bugs Addressed:** #132, #133, Scenario 43 (`additional-bugs-audit.md`)  
**What:**
- Add `limits: { fileSize: 5 * 1024 * 1024 }` to multer config (5MB max)
- Add explicit `fileFilter` that validates MIME type against allowed list (`image/jpeg`, `image/png`)
- Reject uploads where file extension does not match MIME type
- Verify Cloudinary upload signature or at least restrict upload folder permissions
- **Failure handling:** If Cloudinary upload fails, do NOT create the ticket silently. Return 500 with clear error. Retry once with exponential backoff before failing.
- Store `image_upload_status` in ticket record (`pending`, `uploaded`, `failed`) so dispatchers know when an image is missing

**Why Third:** Prevents storage abuse and ensures ticket creation is honest about whether a photo was actually saved.

---

### 3.6 Add Server-Side GPS Boundary Validation
**Files:** `backend/routes/tickets.js` (public submit and manual create), `backend/utils/gpsValidation.js` (new)  
**Bugs Addressed:** Scenario 41 (`additional-bugs-audit.md`) — GPS forgery  
**What:**
- Validate `reported_lat` and `reported_lng` are within Albay province bounding box (~12.5–13.5°N, 123.2–124.2°E)
- Reject coordinates outside Albay with 400 unless caller has `admin` role
- Validate `location_method` is in allowed enum: `['gps', 'map_pin', 'manual']`
- Validate `location_confidence` is in allowed enum: `['high', 'medium', 'low']`
- Add distance check: GPS coordinates must be within 50km of declared municipality center
- Strip/ignore any `location_*` fields that don't match allowed values

**Why Third:** Currently a user from Manila can submit a ticket with `reported_lat=14.5995` (Manila) and the system stores it blindly. This is a data-integrity issue.

---

### 3.7 Remove Relaxed Validation from Manual Ticket Creation
**Files:** `backend/routes/tickets.js` (manual create route)  
**Bugs Addressed:** Scenario 42 (`additional-bugs-audit.md`) — "Relaxed validation"  
**What:**
- Remove the "relaxed validation" branch for manual ticket creation
- Apply the SAME district-municipality, GPS, and phone validation as public ticket submission
- Add a `warnOutsideServiceArea` flag in response (not a block) so dispatcher knows the location is unusual
- Require `is_outside_albay` boolean field from dispatcher if they intentionally create an out-of-area ticket

**Why Third:** "Relaxed validation" is a euphemism for "no validation." Manual tickets should meet the same data-quality standards as public submissions.

---

### 3.8 Expand Duplicate Ticket Check to Include Location
**Files:** `backend/routes/tickets.js` (public submit)  
**Bugs Addressed:** Scenario 4 (`ticket-memo-flow.md`) — duplicate check ignores address/location  
**What:**
- Current duplicate check: same `phone_number + category + concern` within 5 minutes
- Add `district` and `municipality` to the duplicate-check WHERE clause
- Add approximate GPS distance check (within 2km) if coordinates are present
- Store the duplicate-detection criteria in the response so consumers understand why their ticket was flagged

**Why Third:** A consumer can currently submit the same power outage concern 3 times in 5 minutes by changing the address text slightly. Adding location scope reduces spam.

---

### 3.9 Add Service Memo Status Consistency & Grouped Ticket Handling
**Files:** `backend/routes/service-memos.js`, `backend/routes/tickets.js`  
**Bugs Addressed:** Scenarios 1, 2, 3 (`ticket-memo-flow.md`)  
**What:**
- **Status guardrail:** Before creating a memo, validate the ticket status is `Pending` or `Ongoing` — reject if already `Restored`, `Unresolved`, `NoFaultFound`, or `AccessDenied`
- **Status sync:** When a memo is created, do NOT force ticket status to `Ongoing` if it was already `Restored`. Only transition `Pending` → `Ongoing`.
- **Memo-ticket sync:** Add a DB check or trigger that warns if `ticket.status` does not match `memo.memo_status` mapping (e.g., memo `deployed` but ticket `Pending`)
- **Grouped tickets:** Allow service memo creation for child tickets (with `parent_ticket_id`) by ungrouping automatically or creating a group-level memo
  - Option A: Auto-ungroup the child ticket before memo creation (with audit log entry)
  - Option B: Create memo on the GROUP master ticket instead (preferred for operational coherence)
- Add DB-level check constraint: `CHECK (memo_status IN ('saved', 'deployed', 'closed', 'resolved', 'unresolved', 'nofaultfound', 'accessdenied'))`

**Why Third:** Currently grouped tickets CANNOT be resolved through the service memo flow — a dead end for multi-ticket incidents. And forcing `Restored` tickets back to `Ongoing` destroys status history.

---

### 3.10 Harden Phone Number Normalization (Philippines-Only)
**Files:** `backend/utils/phoneUtils.js` (or wherever `normalizePhoneForDB` lives)  
**Bugs Addressed:** Scenario 4 (`sms-flow-audit.md`) — phone normalization issues  
**What:**
- Reject non-Philippines numbers outright (must start with `63` after normalization, or `09` before)
- Reject numbers that don't result in exactly 12 digits (`63XXXXXXXXXX`)
- Reject landline numbers (starting with `63` + area code like `632` for Manila)
- Return clear 400 error: "Invalid Philippines mobile number. Please use format 09XX XXX XXXX."
- Do NOT silently return `null` — always return validated number or throw validation error
- Add `isValidPhilippinesMobile(phone)` helper for use in ticket submit, dispatch SMS, and consumer SMS

**Why Third:** Invalid phone numbers cause SMS to fail silently (wasted PhilSMS credits) and consumers never receive confirmation.


---

## Phase 4: Infrastructure & Scheduled Job Stability

**Goal:** Fix deployment leaks, job overlaps, and environment misconfigurations.

**Risk Level:** Low — mostly config and scheduling changes.

### 4.1 Fix Scheduled Job Overlap
**Files:** `server.js`  
**Bugs Addressed:** #172  **What:**
- Replace `setInterval` with a flag-based runner:
  ```javascript
  let isRunningTransitions = false;
  setInterval(() => {
    if (isRunningTransitions) return;
    isRunningTransitions = true;
    runAutoTransitions(pool)
      .catch(...)
      .finally(() => { isRunningTransitions = false; });
  }, 60_000);
  ```
- Apply the same pattern to `autoArchiveResolved` and `pollB2BInboundOnce`
- Add a maximum execution timeout (e.g., 45 seconds) for each job

**Why Fourth:** On an e2-micro VM with 5 DB connections, overlapping jobs are a guaranteed outage during peak load.

---

### 4.2 Fix `deploy.sh` Credential Exposure
**Files:** `deploy.sh`  
**Bugs Addressed:** #166  **What:**
- Move VM IP and SSH username to environment variables:
  ```bash
  DEPLOY_HOST="${DEPLOY_HOST:-35.233.196.65}"
  DEPLOY_USER="${DEPLOY_USER:-aezymillete16}"
  ssh "${DEPLOY_USER}@${DEPLOY_HOST}" "..."
  ```
- Add a health check after `pm2 restart`:
  ```bash
  ssh "${DEPLOY_USER}@${DEPLOY_HOST}" "sleep 3 && curl -f http://localhost:5000/api/health || exit 1"
  ```
- Add `git stash` before `git reset --hard` OR remove `git reset --hard` in favor of clean fetch

**Why Fourth:** Pure deployment script improvement. Does not affect running app.

---

### 4.3 Clean Up Unused Dependencies
**Files:** `package.json`  
**Bugs Addressed:** #163, #162, #164  **What:**
- Remove `twilio` if unused (system uses PhilSMS)
- Move `jwt-decode` to `devDependencies` if it's only for frontend build, or remove if frontend installs it separately
- Evaluate `pdf-lib` usage — remove if not used for PDF generation
- Add `"engines": { "node": ">=18.0.0" }` to `package.json`
- Consider downgrading `multer` from `^2.0.2` (RC) to stable `1.4.5-lts.1`

**Why Fourth:** Reduces supply-chain attack surface. Can be done independently of other phases.

---

### 4.4 Align `VULNERABILITY_CONTROL_PLAN.md` with Reality
**Files:** `VULNERABILITY_CONTROL_PLAN.md`  
**Bugs Addressed:** #165, #173  **What:**
- Update deployment section: frontend is **Cloudflare Pages**, backend is **GCP VM**
- Remove claims about "cryptographically signed approval token" for uploads — document actual multer direct-upload behavior
- Remove claims about "automatic dispatch limits" for SMS — document actual rate limiting scope
- Add honest gap analysis: "Current gaps: no CSP, no CSRF tokens, 30-day JWTs"

**Why Fourth:** Accurate documentation is critical for compliance, onboarding, and incident response.

---

### 4.5 Separate B2B IMAP Credentials from App Email
**Files:** `backend/services/b2bInboundImapPoll.js`, `.env`, `.env.example`  
**Bugs Addressed:** Scenario 49 (`remaining-audits.md`) — credential cascade  
**What:**
- Remove the fallback chain `B2B_INBOUND_IMAP_USER || B2B_MAIL_USER || EMAIL_USER`
- Enforce that B2B IMAP credentials MUST be explicitly set (no fallback to `EMAIL_USER`)
- On startup, if B2B IMAP is enabled but credentials are missing, log FATAL error and skip polling — do NOT fall back to primary app email
- Add separate env vars to `.env.example`: `B2B_INBOUND_IMAP_USER`, `B2B_INBOUND_IMAP_PASS`
- Document that `EMAIL_USER` / `EMAIL_PASS` are NEVER used for B2B operations

**Why Fourth:** If the B2B IMAP account is compromised, the primary app Gmail account is currently also compromised via the fallback chain. Separation of concerns is a config-only change.

---

### 4.6 Add Distributed Lock for B2B IMAP Polling
**Files:** `backend/services/b2bInboundImapPoll.js`  
**Bugs Addressed:** Scenario 50 (`remaining-audits.md`) — process-local `_polling` flag  
**What:**
- Replace `let _polling = false` with a DB advisory lock or Redis-based distributed lock
- Use MySQL `GET_LOCK('b2b_imap_poll', 0)` at the start of `pollB2BInboundOnce()` — if lock fails, skip the run
- Add max poll duration (2 minutes) with `RELEASE_LOCK()` in `finally` block
- Add jitter to the 5-minute interval (±30 seconds) to avoid thundering herd across multiple instances

**Why Fourth:** On a single VM this seems unnecessary, but if the app is ever scaled horizontally (or during a rolling restart with two processes), concurrent IMAP polls will exhaust Gmail's connection limits.

---

### 4.7 Add B2B Outbound Email Delivery Tracking
**Files:** `backend/utils/appMail.js`, DB migration for `aleco_b2b_mail_audit_logs` or new table  
**Bugs Addressed:** Scenario 52 (`remaining-audits.md`) — no delivery confirmation  
**What:**
- After `transporter.sendMail()`, parse the SMTP response and store delivery status in DB: `pending → sent → delivered | bounced | failed`
- Add a `delivery_status` column to `aleco_b2b_messages` or `aleco_b2b_mail_audit_logs`
- On bounce (detected via SMTP response code or Gmail webhook), update status to `bounced` and add UI indicator
- Retry failed sends with exponential backoff (max 3 attempts), storing each attempt in audit log
- Show delivery status in the existing B2B mail UI (minimal backend-only: just store the data; UI display comes later)

**Why Fourth:** Staff currently believe emails are delivered when they only reached the SMTP server. Tracking actual delivery prevents coordination failures with NGCP and other partners.


---

## Phase 5: Socket.io, Realtime & Poster Worker Security

**Goal:** Secure the realtime layer and the poster worker without breaking the existing dashboard experience.

**Risk Level:** Medium — Socket.io auth changes may require frontend adjustments.

### 5.1 Add Socket.io Authentication
**Files:** `server.js`, frontend socket initialization  
**Bugs Addressed:** #158  **What:**
- Add JWT verification in Socket.io `io.use` middleware:
  ```javascript
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    verifyAccessToken(token).then(user => {
      socket.authUser = user;
      next();
    }).catch(err => next(new Error('Authentication error')));
  });
  ```
- Update `realtime:entity-changed` broadcast to filter by user role/permissions
- Remove `actorEmail` from public broadcast OR emit only to authorized rooms

**Why Fifth:** Requires frontend to pass JWT during socket handshake. This is a contract change, so it must be done carefully.

---

### 5.2 Fix OG Tag XSS in Bot HTML
**Files:** `server.js`  
**Bugs Addressed:** #159  **What:**
- Apply `escapeHtml()` to `imageUrl` before inserting into meta tags and img src
- Validate `poster_image_url` starts with `https://res.cloudinary.com/` (or configured domain) before using it
- Reject URLs containing `"`, `'`, `<`, `>`, or `javascript:` protocol

**Why Fifth:** Bot HTML is server-side generated — fixable entirely in backend.

---

### 5.3 Poster Worker Hardening — Timeout Alignment, Graceful Shutdown & Key Rotation
**Files:** `poster-worker/server.js`, `poster-worker/posterCapture.js`, `backend/utils/posterClient.js`  
**Bugs Addressed:** #135, #137, Scenarios 53 & 54 (`remaining-audits.md`)  
**What:**
- **Timeout alignment:** Set `CAPTURE_HARD_TIMEOUT_MS` to `CloudRun_timeout - 10s` (e.g., if Cloud Run is 300s, set to 290s). Document this relationship.
- **Graceful shutdown:** Add `process.on('SIGTERM', ...)` to finish in-flight captures before exiting. Return 503 with `Retry-After` if browser is unhealthy.
- **Browser health:** Restart the Puppeteer browser instance after N captures (e.g., 50) or if memory exceeds threshold. Add periodic health check.
- **Request hardening:** Add `express.json({ limit: '100kb' })` to poster worker. Add request timeout to `posterClient.js` (30s).
- **Validation:** Validate `id` is a positive integer AND exists in `aleco_interruptions` before enqueuing.
- **Queue cap:** Add max queue size cap to `posterJobQueue.js`.
- **API key rotation:** Support multiple valid keys during rotation window. Add `POSTER_WORKER_API_KEY_V2` env var. Log all capture requests with caller IP for audit.

**Why Fifth:** Poster generation is a background concern. Hardening it doesn't affect core ticket/user flows, but misaligned timeouts and browser crashes waste Cloud Run budget.

---

### 5.4 Add SMS Retry & Delivery Tracking Infrastructure
**Files:** `backend/utils/sms.js`, `backend/utils/smsTemplate.js`, DB migration for `aleco_sms_log` table  
**Bugs Addressed:** Scenarios 1, 2, 3 (`sms-flow-audit.md`) — no retry, no delivery tracking  
**What:**
- Create `aleco_sms_log` table: `id`, `ticket_id`, `recipient_phone`, `message_type` (`consumer_create`, `consumer_dispatch`, `lineman_dispatch`), `message_body`, `status` (`pending`, `sent`, `delivered`, `failed`, `bounced`), `provider_response`, `retry_count`, `created_at`, `sent_at`
- Wrap `sendPhilSMS()` in a retry loop: retry up to 2 times on 5xx or network errors, with 5s exponential backoff
- On success, store `provider_response` (PhilSMS message ID if available) in the log
- On failure after retries, mark `status = 'failed'` and trigger a notification to the dispatcher dashboard
- Add `X-SMS-Retry-Count` header logic to prevent duplicate sends during retries
- **Backend-only:** Do not change UI yet. Just store the data so retry history exists.

**Why Fifth:** SMS failures are currently silent. Crews don't get dispatched, consumers don't get confirmation, and nobody knows. Adding tracking infrastructure is the prerequisite for any UI indicator later.


---

## Phase 6: UI Interactive Rewiring

**Goal:** Modernize frontend authentication patterns and remove legacy header dependencies.

**Risk Level:** High — touches every authenticated API call in the React app. Requires full regression testing.

### 6.1 Replace Legacy Headers with JWT-Only Auth in Frontend
**Files:** `src/components/buttons/login.jsx`, `src/components/ProtectedRoute.jsx`, `src/utils/api.js` (if exists), all components using `x-user-email` / `x-user-name` headers  
**Bugs Addressed:** #139, #143  **What:**
- Remove manual `x-user-email` and `x-token-version` header construction from all fetch/axios calls
- Use `Authorization: Bearer <token>` exclusively
- Store JWT in `httpOnly` cookie (requires backend cookie support) OR keep in `localStorage` but only send via `Authorization` header
- Update `ProtectedRoute.jsx` to verify JWT expiration client-side before API call

**Why Last:** This is the biggest contract change. Every authenticated component is affected. Only do this after the backend is hardened and legacy header fallback is removed.

---

### 6.2 Frontend CSRF Token Integration
**Files:** All frontend API call utilities  
**Bugs Addressed:** #151  **What:**
- Read CSRF token from response header or meta tag
- Include `X-CSRF-Token` header in all mutating requests (POST, PUT, PATCH, DELETE)
- Handle 403 CSRF errors with clear user messaging

**Why Last:** Depends on Phase 2.4 CSRF backend infrastructure being deployed and stable.

---

### 6.3 Socket.io Client Auth Update
**Files:** Frontend socket initialization  
**Bugs Addressed:** #158  **What:**
- Pass JWT token in `auth: { token: ... }` during socket connection
- Handle `connect_error` for auth failures gracefully (redirect to login)
- Subscribe to room-specific events instead of global `realtime:entity-changed`

**Why Last:** Depends on Phase 5.1 Socket.io auth being deployed and stable.

---

## Quick Reference: Safest to Riskiest

| Phase | Theme | Risk | Effort | Impact |
|-------|-------|------|--------|--------|
| **1** | Foundation (headers, limits, exposure removal) | Very Low | Low | High |
| **2** | Auth hardening (legacy headers, rate limits, JWT) | Low | Medium | Very High |
| **3** | Data integrity (validation, race conditions, timezone) | Medium | Medium | High |
| **4** | Infrastructure (jobs, deploy, deps, docs) | Low | Low | Medium |
| **5** | Realtime & poster worker security | Medium | Medium | Medium |
| **6** | UI rewiring (JWT-only, CSRF, socket auth) | High | High | High |

---

## Decision Tree: Where to Start Tomorrow

```
Q: Will this change crash the server if it has a bug?
  ├─ YES → Phase 1 first (error handlers, graceful shutdown)
  └─ NO  → Continue

Q: Does this expose information to unauthenticated users?
  ├─ YES → Phase 1 (hide debug/db-health endpoints) or Phase 2 (rate limits)
  └─ NO  → Continue

Q: Can an attacker bypass authentication with this?
  ├─ YES → Phase 2 (legacy headers, JWT hardening)
  └─ NO  → Continue

Q: Can this produce duplicate or corrupt data?
  ├─ YES → Phase 3 (control numbers, validation, timezone)
  └─ NO  → Continue

Q: Does this require frontend changes?
  ├─ YES → Phase 5 or 6 (save for last)
  └─ NO  → Do it now (Phase 1–4)
```

---

## Estimated Timeline (Solo Developer, Nights & Weekends)

| Phase | Tasks | Est. Time | Cumulative Bugs/Scenarios Closed |
|-------|-------|-----------|----------------------------------|
| **1 — Foundation** | 1.1–1.6 | 2–3 days | ~28 |
| **2 — Auth** | 2.1–2.6 | 4–5 days | ~42 |
| **3 — Data Integrity** | 3.1–3.10 | 5–7 days | ~55 |
| **4 — Infrastructure** | 4.1–4.7 | 3–4 days | ~28 |
| **5 — Realtime/Poster/SMS** | 5.1–5.4 | 4–5 days | ~22 |
| **6 — UI Rewiring** | 6.1–6.3 | 5–7 days | ~33 |
| **Total** | | **~23–31 days** | **173+** |

---

## Success Criteria per Phase

- **Phase 1:** Server does not crash on unhandled errors. No public debug endpoints accessible without auth. OG tags render safely.
- **Phase 2:** `x-user-email` alone cannot access protected routes. All public POST routes have rate limits. Login has brute-force protection. Audit logs cannot be forged via `actor_email` in request body.
- **Phase 3:** No duplicate control numbers under concurrent load. Invalid dates rejected with 400. SMS contains no unescaped user input. GPS coordinates outside Albay are rejected. Manual tickets meet same validation as public. Grouped tickets can be resolved via service memos.
- **Phase 4:** Scheduled jobs never overlap. Deployment script uses env vars, not hardcoded IPs. B2B IMAP uses separate credentials with distributed lock. Email delivery is tracked.
- **Phase 5:** Socket connections require valid JWT. Poster worker validates interruption IDs, aligns timeouts with Cloud Run, and rotates API keys. SMS failures are retried and logged.
- **Phase 6:** Zero `x-user-email` headers sent from frontend. CSRF token included on all mutating requests.

---

## Cross-Reference: Audit Document → Implementation Plan Phase

| Audit Document | Scenarios Covered | Implementation Plan Phase(s) |
|----------------|-------------------|------------------------------|
| `infrastructure-public-feed-manage-site-audit.md` | #132–#173 (42 scenarios) | 1, 2, 3, 4, 5 |
| `additional-bugs-audit.md` | #39–#48 (10 scenarios): legacy headers, actor forgery, GPS forgery, relaxed validation, photo upload, search performance, rate limiting, audit trail | 2 (2.1, 2.5, 2.6), 3 (3.5, 3.6, 3.7, 3.8) |
| `ticket-memo-flow.md` | #1–#38 (38 scenarios): status transitions, grouped ticket memo dead end, duplicate check gaps, GPS defaults, service memo status consistency | 3 (3.1, 3.8, 3.9), 4 (4.1) |
| `remaining-audits.md` | #49–#54 (6 scenarios): B2B IMAP credential cascade, distributed lock, SPF/DKIM/DMARC, email delivery, poster timeout, API key rotation | 4 (4.5, 4.6, 4.7), 5 (5.3) |
| `sms-flow-audit.md` | #1–#4 (4 scenarios): SMS retry, delivery tracking, crew dispatch fallback, phone normalization | 3 (3.10), 5 (5.4) |

### Coverage Gaps (Intentionally Deferred or Out of Scope)

| Gap | Reason | When to Address |
|-----|--------|---------------|
| **SPF/DKIM/DMARC validation** on inbound B2B email | Requires external email parsing library (e.g., `mailauth`). Complex and low-traffic currently. | Phase 7+ or when B2B volume increases |
| **Frontend UI changes** for SMS failure indicators | Explicitly deferred to Phase 6+ per user constraint. Backend tracking table is ready in Phase 5.4. | Phase 6 or a dedicated UI polish sprint |
| **GPS default coordinates for municipality centers** | Requires geocoded data in DB or hardcoded lookup table. Not a security issue. | Phase 3 follow-up or data migration |
| **`SELECT *` anti-pattern removal** | Performance optimization, not a safety net. Requires touching many queries. | Post-safety-net performance sprint |
| **Caching layer (Redis)** | Infrastructure addition, not a bug fix. | Post-safety-net scalability sprint |
| **Database foreign key constraints** | Data integrity improvement but risky migration on existing data. | Dedicated DB migration window |
| **B2B inbound email SPF/DKIM** | Requires third-party email auth library. Low immediate risk. | Phase 7+ |
