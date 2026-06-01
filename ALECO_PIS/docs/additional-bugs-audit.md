# Additional Bugs & Edge Cases Audit - ALECO PIS System

## Areas Audited
1. Authentication & Authorization Security
2. Public Ticket Submission (Photos, GPS, Validation)
3. Search & Filtering Performance
4. Rate Limiting
5. Actor Attribution & Audit Trail Integrity
6. Map/GPS Boundary Validation (Server-Side)

---

## Scenario 39: Authentication Security - Legacy Headers Still Active

**Real-World Scenario:**
An attacker discovers the API endpoints. Since legacy session headers are still enabled, they can forge `x-user-email` and `x-token-version` headers to impersonate any user without a real JWT.

**Current Code (requireApiSession.js line 20-21):**
```javascript
function allowLegacySessionHeaders() {
  return String(process.env.ALLOW_LEGACY_SESSION_HEADERS || 'true').toLowerCase() !== 'false';
}
```

**Current Code (requireApiSession.js line 127-130):**
```javascript
const legacy = allowLegacySessionHeaders() ? readLegacyHeaders(req) : null;
if (legacy) {
  email = legacy.email;
  tokenVersion = legacy.tokenVersion;
}
```

**Current Code (tickets.js line 31-32):**
```javascript
function actorEmailFromReq(req) {
  return req.authUser?.email || String(req.headers['x-user-email'] || '').trim() || null;
}
```

**Bugs Found:**
- 🔴 **CRITICAL SECURITY BUG**: `ALLOW_LEGACY_SESSION_HEADERS` defaults to `true` even in production
- 🔴 **CRITICAL SECURITY BUG**: Anyone can send `x-user-email: admin@example.com` and `x-token-version: 1` to bypass JWT entirely
- 🔴 **CRITICAL SECURITY BUG**: Legacy headers don't verify against database on every request (only checked on login)
- 🔴 **CRITICAL SECURITY BUG**: `actorEmailFromReq` falls back to forged `x-user-email` even when authenticated
- ⚠️ **BUG**: No rate limiting on login endpoint
- ⚠️ **BUG**: No brute force protection
- ⚠️ **BUG**: No account lockout after failed attempts
- ⚠️ **BUG**: JWT tokens expire in 30 days (very long)

**Real-Life Scenarios:**
1. **Attacker forges headers**: Sends `x-user-email: admin@aleco.com` and `x-token-version: 1` to access admin endpoints
2. **Attacker brute forces token version**: Tries different `x-token-version` values until one matches
3. **Disgruntled employee**: Knows a coworker's email, guesses their token version (usually 1)
4. **Replay attack**: Captures legitimate headers, reuses them after user logs out

**Exploitation Path:**
```
Attacker → POST /api/tickets/:id/dispatch
Headers:
  x-user-email: admin@aleco.com
  x-token-version: 1
Result: Request accepted as admin!
```

**Proposed Solution:**
1. Set `ALLOW_LEGACY_SESSION_HEADERS=false` in production immediately
2. Remove legacy header fallback from `actorEmailFromReq`
3. Add rate limiting to login (5 attempts per 15 minutes)
4. Add account lockout after 5 failed attempts
5. Reduce JWT expiry to 24 hours with refresh token
6. Add IP-based anomaly detection

---

## Scenario 40: Actor Attribution Forgery

**Real-World Scenario:**
A staff member wants to hide their actions. They send a forged `x-user-email` header to make it look like someone else made the change.

**Current Code (tickets.js line 780-781):**
```javascript
const actorEmail = req.body.actor_email || req.headers['x-user-email'];
const actorName = req.body.actor_name || req.headers['x-user-name'];
```

**Bugs Found:**
- 🔴 **CRITICAL BUG**: `actor_email` accepted from request body - client can forge audit trail
- 🔴 **CRITICAL BUG**: `actor_name` accepted from request body - client can forge audit trail
- 🔴 **CRITICAL BUG**: Audit logs contain forged data, making them useless for accountability
- 🔴 **CRITICAL BUG**: `x-user-email` header used as fallback even when JWT session is active
- ⚠️ **BUG**: No verification that `actor_email` matches authenticated user

**Real-Life Scenarios:**
1. **Dispatcher covers tracks**: Sets `actor_email` to coworker's email after making a bad dispatch
2. **Staff frames colleague**: Forges `actor_email` to make it look like someone else deleted a ticket
3. **Automated attack**: Script sends random `actor_email` values to corrupt audit trail

**Proposed Solution:**
1. NEVER accept `actor_email` or `actor_name` from request body
2. Always use `req.authUser.email` from validated session
3. If no session, reject the request (401)
4. Add server-side enforcement: `const actorEmail = req.authUser.email`

---

## Scenario 41: Public Ticket Submission - GPS Forgery

**Real-World Scenario:**
A malicious user from Manila wants to create a fake ticket. They manually set GPS coordinates and submit.

**Current Code (tickets.js lines 86-91):**
```javascript
const {
    account_number, first_name, middle_name, last_name,
    phone_number, address, category, concern, action_desired,
    district, municipality, is_urgent,
    reported_lat, reported_lng, location_accuracy, location_method,
    location_confidence
} = req.body;

console.log("📍 GPS Data Received:", { reported_lat, reported_lng, location_accuracy, location_method });
```

**Backend Flow:**
1. Client sends `reported_lat=14.5995` (Manila), `reported_lng=120.9842` (Manila)
2. Server accepts coordinates without validation
3. Server stores coordinates in database
4. No validation that coordinates match the municipality

**Bugs Found:**
- 🔴 **CRITICAL BUG**: `reported_lat` and `reported_lng` accepted without any validation
- 🔴 **CRITICAL BUG**: No server-side GPS boundary check against Albay province
- 🔴 **CRITICAL BUG**: `location_method` and `location_confidence` accepted from client without verification
- 🔴 **CRITICAL BUG**: No distance check between GPS coordinates and municipality center
- ⚠️ **BUG**: No validation that `location_method` is one of allowed values ('gps', 'map_pin', 'manual')
- ⚠️ **BUG**: No validation that `location_confidence` is one of allowed values ('high', 'medium', 'low')

**Real-Life Scenarios:**
1. **User from Manila reports**: Sets `district=Second District`, `municipality=Legazpi City` but GPS is in Manila (14.5995, 120.9842)
2. **Bot attack**: Automated script submits 1000 tickets with random GPS coordinates
3. **GPS spoofing**: User sends `location_method: 'gps'` but manually entered coordinates
4. **Wrong municipality**: User is in Tabaco City but pins location in Legazpi City

**Proposed Solution:**
1. Add server-side GPS boundary validation against Albay bounding box
2. Verify `location_method` is in allowed enum: `['gps', 'map_pin', 'manual']`
3. Verify `location_confidence` is in allowed enum: `['high', 'medium', 'low']`
4. Add distance check: GPS coordinates must be within 50km of municipality center
5. Reject submissions with GPS outside Albay unless manually overridden by dispatcher

---

## Scenario 42: Manual Ticket Creation - Relaxed GPS Validation

**Real-World Scenario:**
A dispatcher creates a manual ticket for a walk-in consumer. The consumer is outside Albay. The dispatcher uses "Find My Location" and the system accepts it.

**Current Code (ManualTicketModal.jsx line 162-163):**
```javascript
// Relaxed validation for manual creation - allow outside Albay
// Set GPS coordinates, municipality, and auto-fill address
```

**Backend Code (tickets.js line 470-475):**
```javascript
// --- RELAXED VALIDATION: Minimum required fields only ---
if (!first_name || !last_name || !phone_number || !address || !category || !concern) {
    console.warn('❌ Relaxed Validation: Missing required fields');
    return;
}
```

**Bugs Found:**
- 🔴 **CRITICAL BUG**: Manual ticket creation has "relaxed validation" that explicitly allows outside Albay
- 🔴 **CRITICAL BUG**: No GPS validation on manual tickets at all
- 🔴 **CRITICAL BUG**: Dispatcher can create tickets for anywhere in the Philippines
- ⚠️ **BUG**: No district/municipality validation on manual tickets
- ⚠️ **BUG**: No indication to dispatcher that location is outside Albay

**Real-Life Scenarios:**
1. **Dispatcher makes mistake**: Creates ticket for Manila consumer by accident
2. **Consumer walks in from outside**: Lives in Quezon Province, reports issue in Albay
3. **Wrong location**: Dispatcher clicks "Find My Location" while in Manila for training

**Proposed Solution:**
1. Remove "relaxed validation" for manual creation
2. Apply same GPS and location validation as public form
3. Add warning banner when dispatcher tries to create ticket outside Albay
4. Require admin approval for out-of-area tickets

---

## Scenario 43: Photo Upload - Cloudinary Failure Handling

**Real-World Scenario:**
A consumer submits a ticket with a photo. Cloudinary upload fails due to network issue. The ticket is still created but without the photo.

**Current Code (tickets.js line 78):**
```javascript
router.post('/tickets/submit', rateLimitTicketSubmission, upload.single('image'), async (req, res) => {
```

**Current Code (tickets.js line 141):**
```javascript
const image_url = req.file ? req.file.path : null;
```

**Backend Flow:**
1. Multer middleware (`upload.single('image')`) processes the file
2. If Cloudinary upload succeeds, `req.file.path` contains the URL
3. If Cloudinary upload fails, `req.file` is null
4. Ticket is still created with `image_url = null`
5. Consumer not notified that photo failed

**Bugs Found:**
- 🔴 **CRITICAL BUG**: No error handling if Cloudinary upload fails
- 🔴 **CRITICAL BUG**: Ticket created without photo, consumer not notified
- 🔴 **CRITICAL BUG**: No retry mechanism for photo upload
- ⚠️ **BUG**: Photo upload failure is silent (no error to consumer)
- ⚠️ **BUG**: No indication in ticket that photo was supposed to be attached
- ⚠️ **BUG**: Large photo files may cause memory issues (no size limit check)

**Real-Life Scenarios:**
1. **Cloudinary down**: Photo upload fails, ticket created without evidence
2. **Large photo**: Consumer uploads 10MB photo, upload times out
3. **Network issue**: Consumer on slow connection, upload fails mid-transfer
4. **Wrong file type**: Consumer uploads PDF instead of image

**Proposed Solution:**
1. Add explicit Cloudinary error handling
2. If photo upload fails, return error to consumer (don't create ticket)
3. Add photo size validation (max 5MB)
4. Add photo type validation (JPEG, PNG only)
5. Add retry mechanism for Cloudinary upload (3 attempts)
6. Store upload status in ticket (`image_upload_status: pending/success/failed`)

---

## Scenario 44: Search/Filter - No Pagination = Memory Exhaustion

**Real-World Scenario:**
An admin opens the ticket list with no filters. The system fetches all 10,000 tickets at once, causing memory exhaustion and slow response.

**Current Code (ticket-routes.js line 22-25):**
```javascript
let query = `SELECT t.*, 
    (SELECT COUNT(*) FROM aleco_tickets c WHERE c.parent_ticket_id = t.ticket_id AND c.deleted_at IS NULL) as child_count,
    (EXISTS (SELECT 1 FROM aleco_service_memos sm WHERE sm.ticket_id = t.ticket_id)) AS has_service_memo
    FROM aleco_tickets t WHERE 1=1 AND t.deleted_at IS NULL`;
```

**Current Code (ticket-routes.js line 120):**
```javascript
query += ` ORDER BY t.created_at DESC`;

const [rows] = await pool.execute(query, params);
```

**Bugs Found:**
- 🔴 **CRITICAL BUG**: No LIMIT clause - fetches ALL matching tickets
- 🔴 **CRITICAL BUG**: No pagination parameters accepted
- 🔴 **CRITICAL BUG**: `SELECT t.*` fetches all columns for every ticket
- 🔴 **CRITICAL BUG**: Subqueries (`child_count`, `has_service_memo`) executed for every row
- 🔴 **CRITICAL BUG**: With 10,000 tickets, this loads 10,000 rows into memory
- ⚠️ **BUG**: No cursor-based pagination
- ⚠️ **BUG**: No max result limit
- ⚠️ **BUG**: Search with `% wildcard` prefix forces full table scan

**Real-Life Scenarios:**
1. **Admin opens dashboard**: System fetches all 10,000 tickets, takes 5 seconds
2. **Search with common term**: `%power%` matches 5000 tickets, all returned
3. **Mobile user**: Slow connection + large payload = timeout
4. **Concurrent users**: 5 users loading all tickets = 50,000 rows in memory

**Proposed Solution:**
1. Add mandatory LIMIT (default 50, max 200)
2. Add OFFSET or cursor-based pagination
3. Add pagination parameters to API: `?page=1&limit=50`
4. Optimize search queries with FULLTEXT index
5. Add `count` endpoint for total matching tickets
6. Return paginated response format:
   ```json
   {
     "data": [...],
     "pagination": {
       "page": 1,
       "limit": 50,
       "total": 10000,
       "totalPages": 200
     }
   }
   ```

---

## Scenario 45: Rate Limiting - Only Ticket Submission Protected

**Real-World Scenario:**
An attacker discovers that only the ticket submission endpoint has rate limiting. They flood other endpoints like login, dispatch, or status update to overwhelm the system.

**Current Code (tickets.js line 78):**
```javascript
router.post('/tickets/submit', rateLimitTicketSubmission, upload.single('image'), async (req, res) => {
```

**Search for other rate limits:**
- `rateLimitTicketSubmission` - only on ticket submission
- No rate limit on: login, logout, dispatch, status change, ticket edit, memo create

**Bugs Found:**
- 🔴 **CRITICAL BUG**: Only 1 endpoint has rate limiting
- 🔴 **CRITICAL BUG**: Login endpoint has no rate limiting (brute force vulnerability)
- 🔴 **CRITICAL BUG**: Dispatch endpoint has no rate limiting (can spam SMS to crew)
- 🔴 **CRITICAL BUG**: Status update endpoint has no rate limiting
- 🔴 **CRITICAL BUG**: Ticket edit endpoint has no rate limiting
- ⚠️ **BUG**: No global rate limiting middleware
- ⚠️ **BUG**: No per-IP rate limiting
- ⚠️ **BUG**: No per-user rate limiting

**Real-Life Scenarios:**
1. **Brute force login**: Attacker tries 1000 password combinations per minute
2. **SMS spam**: Attacker dispatches same ticket 100 times, crew gets 100 SMS
3. **Status flood**: Attacker changes ticket status rapidly, confusing system
4. **API abuse**: Script calls filtered-tickets 1000 times, DB overwhelmed
5. **DoS attack**: Simple script floods any endpoint, no protection

**Proposed Solution:**
1. Add global rate limiting middleware (100 requests per 15 minutes per IP)
2. Add strict rate limit on login (5 attempts per 15 minutes)
3. Add rate limit on dispatch (1 per minute per ticket)
4. Add rate limit on status changes (5 per minute per ticket)
5. Add rate limit on SMS sends (1 per 5 minutes per phone number)
6. Add per-user rate limiting for authenticated endpoints

---

## Scenario 46: Ticket Tracking - Public Endpoint Information Leakage

**Real-World Scenario:**
A user tracks their ticket using the public tracking page. The system returns more information than needed, potentially leaking other users' data.

**Current Code (requireApiSession.js lines 90-91):**
```javascript
if (m === 'GET' && /^\/api\/tickets\/track\//i.test(path)) return true;
if (m === 'GET' && /^\/api\/tickets\/jobs\//i.test(path)) return true;
```

**Bugs Found:**
- 🔴 **CRITICAL BUG**: Public ticket tracking endpoint returns full ticket data
- 🔴 **CRITICAL BUG**: No field filtering on public endpoints
- 🔴 **CRITICAL BUG**: May expose: consumer name, phone number, address, crew name
- ⚠️ **BUG**: No verification that tracker is the actual ticket owner
- ⚠️ **BUG**: Ticket ID is sequential/predictable (ALECO-12345, ALECO-12346)

**Real-Life Scenarios:**
1. **Neighbor spies**: Guesses ticket ID (ALECO-12345), sees your outage report
2. **Stalker**: Tracks someone's ticket to find their address
3. **Competitor**: Monitors ticket volume to gauge service quality
4. **ID enumeration**: Script enumerates all ticket IDs, builds database of complaints

**Proposed Solution:**
1. Return minimal data on public tracking: status, ticket_id, category only
2. Never expose: name, phone, address, crew info on public endpoints
3. Add rate limiting to tracking endpoint (5 per minute per IP)
4. Consider adding verification: last 4 digits of phone number

---

## Scenario 47: JWT Token Version - No Rotation Mechanism

**Real-World Scenario:**
A user's account is compromised. Admin disables the account, but the attacker's JWT token is still valid for 30 days because there's no token rotation mechanism.

**Current Code (sessionJwt.js line 36):**
```javascript
expiresIn: '30d',
```

**Current Code (auth.js line 120-127):**
```javascript
return res.status(200).json({ 
    message: "Login successful!",
    accessToken,
    user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        profilePic: user.profile_pic,
        tokenVersion: user.token_version 
    }
});
```

**Bugs Found:**
- 🔴 **CRITICAL BUG**: JWT tokens valid for 30 days - no way to revoke immediately
- 🔴 **CRITICAL BUG**: Disabling account doesn't invalidate existing tokens
- 🔴 **CRITICAL BUG**: No token rotation on password change
- 🔴 **CRITICAL BUG**: No token blacklist/revocation mechanism
- ⚠️ **BUG**: Token version only checked at login, not on every request (when using JWT)
- ⚠️ **BUG**: No refresh token mechanism

**Real-Life Scenarios:**
1. **Account compromised**: Attacker has JWT, admin disables account, attacker still has access for 30 days
2. **Employee fired**: Account disabled but ex-employee's token still works
3. **Password changed**: Old token still valid, attacker not logged out
4. **Token stolen**: No way to revoke without changing `token_version` in DB

**Proposed Solution:**
1. Reduce JWT expiry to 1 hour with refresh token (7 days)
2. Check `token_version` on every JWT verification
3. Add token blacklist (in-memory cache) for revoked tokens
4. Increment `token_version` on: password change, account disable, suspicious activity
5. Add "Log out all devices" functionality

---

## Scenario 48: Service Memo Public Endpoint - Data Leakage

**Real-World Scenario:**
The service memo endpoint is public (no auth required). Anyone can fetch memo details including consumer information.

**Current Code (requireApiSession.js line 95):**
```javascript
if (m === 'GET' && /^\/api\/service-memos\/[0-9]+$/i.test(path)) return true;
```

**Bugs Found:**
- 🔴 **CRITICAL BUG**: Service memo details publicly accessible without authentication
- 🔴 **CRITICAL BUG**: Memo contains: consumer name, address, phone, crew info, resolution notes
- 🔴 **CRITICAL BUG**: No field filtering on public memo endpoint
- ⚠️ **BUG**: Anyone with memo ID can view full memo details
- ⚠️ **BUG**: Sequential memo IDs make enumeration easy

**Real-Life Scenarios:**
1. **Data harvesting**: Script enumerates all memo IDs, collects consumer data
2. **Privacy breach**: Neighbor views your service memo with your address
3. **Stalking**: Attacker tracks someone's service history
4. **Information leakage**: Competitor analyzes resolution patterns

**Proposed Solution:**
1. Remove service memo from public endpoints
2. Require authentication for all memo endpoints
3. If public access needed, return only: ticket_id, memo_status, control_number
4. Never expose: consumer details, crew info, resolution notes on public endpoints

---

## Summary of New Critical Bugs

| # | Bug | Severity | Area |
|---|-----|----------|------|
| 39 | Legacy session headers allow impersonation | CRITICAL | Authentication |
| 40 | Actor attribution forgery via request body | CRITICAL | Audit Trail |
| 41 | GPS coordinates accepted without validation | CRITICAL | Ticket Submission |
| 42 | Manual ticket creation bypasses GPS validation | CRITICAL | Manual Tickets |
| 43 | Photo upload failure is silent | CRITICAL | File Upload |
| 44 | Search/filter fetches ALL results with no LIMIT | CRITICAL | Performance |
| 45 | Only 1 endpoint has rate limiting | CRITICAL | Security |
| 46 | Public tracking leaks consumer data | CRITICAL | Privacy |
| 47 | JWT tokens valid for 30 days, no revocation | CRITICAL | Authentication |
| 48 | Service memo endpoint public, leaks PII | CRITICAL | Privacy |

---

## Real-Life Attack Scenarios

**Scenario A: Full System Compromise**
1. Attacker discovers `ALLOW_LEGACY_SESSION_HEADERS=true`
2. Attacker sends `x-user-email: admin@aleco.com`, `x-token-version: 1`
3. Attacker gains admin access
4. Attacker downloads all tickets, service memos, consumer data
5. Attacker deletes all records

**Scenario B: Data Harvesting**
1. Attacker enumerates public ticket tracking IDs (ALECO-1, ALECO-2, ...)
2. Attacker collects: names, addresses, phone numbers, concerns
3. Attacker sells data or uses for targeted scams

**Scenario C: SMS Spam**
1. Attacker discovers dispatch endpoint has no rate limiting
2. Attacker dispatches same ticket 100 times
3. Crew receives 100 SMS notifications
4. Crew's phone bill increases, system SMS credits exhausted

**Scenario D: GPS Injection**
1. Attacker creates ticket with GPS coordinates in Manila
2. System stores coordinates without validation
3. Attacker creates 1000 fake tickets with random coordinates
4. Map view becomes unusable, database filled with garbage

**Scenario E: Audit Trail Poisoning**
1. Staff member makes bad dispatch decision
2. Staff sends forged `actor_email` to blame colleague
3. Audit log shows colleague made the change
4. Real perpetrator avoids accountability
