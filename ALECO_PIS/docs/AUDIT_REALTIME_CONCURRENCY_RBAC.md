# Codebase Audit — Real-time WebSocket, Concurrency Control, RBAC
*Scanned: May 1, 2026. No code changes made. Findings only.*

---

## 1. Real-time WebSocket System

### 1.1 Server-side (`server.js`)

**Transport:** Socket.IO over the same `http.createServer(app)` instance. Path `/socket.io`. Transports: WebSocket → polling fallback. CORS reuses the same `allowedOrigins` logic as the REST API.

**Connection handler (lines 80–85):**
```js
io.on('connection', (socket) => {
    socket.emit('realtime:connected', { ts, transport });
});
```
Minimal — only emits a handshake acknowledgment. No rooms, no namespaces, no authentication gate.

**Global write broadcaster (lines 107–128) — the "global wrapper":**
```js
app.use('/api', (req, res, next) => {
    // intercepts POST/PUT/PATCH/DELETE only
    res.on('finish', () => {
        if (statusCode >= 400) return; // error responses silently dropped
        io.emit('realtime:entity-changed', {
            module,   // derived from path via moduleFromApiPath()
            method, path, actorEmail, statusCode, ts, durationMs
        });
    });
});
```
This runs **before** `requireApiSession` is applied (`app.use('/api', requireApiSession)` is below it). It is registered at the middleware level, fires on `res.finish`, and broadcasts to **all connected sockets** (no room filtering). It is purely passive — it never blocks requests and never reads/writes state.

**Module mapping (`moduleFromApiPath`):**

| Path keyword | Module string |
|---|---|
| `/crews`, `/pool` | `personnel` |
| `/tickets` | `tickets` |
| `/interruptions` | `interruptions` |
| `/service-memos`, `/memo` | `service-memos` |
| `/b2b-mail` | `b2b-mail` |
| `/users`, `/invite`, `/send-email` | `users` |
| `/notifications` | `notifications` |
| `/backup`, `/export`, `/import`, `/archive` | `data-management` |
| `/history` | `history` |
| `/feeders` | `feeders` |
| (default) | `system` |

### 1.2 Client-side

**`src/utils/realtimeSocket.js`** — lazy singleton. `getRealtimeSocket()` creates exactly one `socket.io-client` connection per browser tab lifetime, returning the same instance on subsequent calls.

**`src/components/AdminLayout.jsx`** — the **bridge layer**:
```js
useEffect(() => {
    const socket = getRealtimeSocket();
    socket.on('realtime:entity-changed', (payload) => {
        window.dispatchEvent(new CustomEvent('aleco:realtime-change', { detail: payload }));
    });
}, []);
```
The socket is mounted once at the layout root. Individual page components never import the socket directly — they only listen to `window`'s `aleco:realtime-change` CustomEvent. This decouples every component from Socket.IO.

**`src/utils/authMutation.js`** — also dispatches `aleco:realtime-change` **locally** (not via socket) after a successful write:
```js
if (response.ok && emitRealtime && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('aleco:realtime-change', { detail: { module, source: 'auth-mutation' } }));
}
```
This causes the acting user's own UI to refetch immediately, without waiting for the socket round-trip from the server.

**Per-module event consumers (all via `window.addEventListener('aleco:realtime-change', ...)`):**

| Component / Hook | Modules it listens to |
|---|---|
| `Tickets.jsx` | `tickets`, `service-memos`, `data-management`, `system` |
| `useAdminInterruptions.js` | `interruptions`, `data-management`, `system` |
| `ServiceMemos.jsx` | `service-memos` |
| `PersonnelManagement.jsx` | `personnel` |
| `B2BMail.jsx` | `b2b-mail` |
| `AllUsers.jsx` | `users` |
| `Backup.jsx` | `data-management` |
| `SearchBarGlobal.jsx` | multiple |
| `EditTicketModal.jsx` | `tickets` |
| `UrgentKeywordsPanel.jsx` | `system` |
| `ProfilePage.jsx` | `users` |

**`src/constants/realtimeModules.js`** — single source of truth for module name strings (`REALTIME_MODULES` frozen object).

**`src/utils/realtimeModules.js`** — `matchesRealtimeModule(value, ...candidates)` normalizes and compares module strings so component listeners are case-insensitive.

### 1.3 Architecture notes

- **No server-to-specific-client targeting** — `io.emit()` broadcasts to all connected sockets. There is no use of rooms or namespaces. Every admin user receives every change notification regardless of what page they are on. The filtering is entirely client-side via `matchesRealtimeModule`.
- **Double-trigger design** — a mutation dispatches the CustomEvent locally (authMutation) AND the server emits the same event to all other connected clients via socket. The acting client refetches immediately; other clients refetch slightly later.
- **No socket auth** — the Socket.IO handshake has no token check. Any client that knows the API origin can connect and receive `realtime:entity-changed` broadcasts. The payload only contains `module`, `method`, `path`, `actorEmail`, `statusCode`, `ts`, `durationMs` — no actual data rows. Exploitation risk is low (no sensitive content) but worth noting.
- **`notifications` and `history` have no realtime consumers** — notifications module is in `moduleFromApiPath` but no component listens specifically to `notifications`. History has no realtime listener either.

---

## 2. Optimistic Concurrency Control

### 2.1 Tickets (`backend/utils/concurrencyControl.js`)

Shared utility, used by `tickets.js` write routes.

**Flow:**
1. Client sends `expected_updated_at` in request body (the `updated_at` of the row it last saw).
2. `buildOptimisticTicketWhere(pool, ticketId, expectedUpdatedAt)` queries DB for current `updated_at`.
3. Compares ISO strings. If mismatch → returns `conflict: true` with `latest` snapshot.
4. If match → returns `whereSql: 'ticket_id = ? AND updated_at = ?'` so the UPDATE only applies if DB row hasn't changed.
5. If UPDATE `affectedRows === 0` after that WHERE → another 409 is returned (second guard).

**Conflict code:** `CONFLICT_STALE_TICKET` (implied via 409, code not always set on tickets — inconsistent, see §4 findings).

**Routes using it:**
- `PUT /tickets/:ticket_id/dispatch`
- `PUT /tickets/:ticket_id/resolve-concern`
- `PUT /tickets/:ticket_id/hold`
- `PUT /tickets/:ticket_id/resume-hold`
- `PUT /tickets/:ticketId/status`

### 2.2 Interruptions (`backend/routes/interruptions.js`)

Own local implementation (not the shared util). More thorough.

**Local helpers:**
- `normalizeExpectedUpdatedAt(raw)` — converts to MySQL datetime string via `toMysqlDateTime()`
- `buildOptimisticInterruptionWhere(id, expectedUpdatedAtRaw)` — queries DB, validates datetime parse, returns `{ missing, invalidExpected, whereSql, whereParams, conflict, latest }`

**Conflict code:** `CONFLICT_STALE_INTERRUPTION` (consistently set).

**Routes using it:**
- `POST /interruptions/:id/updates` (append remark)
- `PUT /interruptions/:id` (update advisory)
- `DELETE /interruptions/:id` (soft delete)
- `PATCH /interruptions/:id/restore`
- `PATCH /interruptions/:id/pull-from-feed`
- `PATCH /interruptions/:id/push-to-feed`
- `DELETE /interruptions/:id/permanent` (permanent delete — no optimistic check, just hard delete)

### 2.3 Frontend (`src/utils/optimisticConcurrency.js`)

Three exports:
- `isOptimisticConflict(status, data)` — `status === 409` AND code is in `CONFLICT_CODES` set (`CONFLICT_STALE_TICKET`, `CONFLICT_STALE_INTERRUPTION`)
- `withExpectedUpdatedAt(body, expectedUpdatedAt, fieldName)` — injects field into body object
- `parseJsonSafe(response)` — safe JSON parse (returns `null` on error)

**`authMutation.js`** wraps all of this: attaches `expectedUpdatedAt`, parses response, normalizes conflict flag into `{ ok, status, success, conflict }` return shape.

**`Tickets.jsx`** — reads `updated_at` from the local ticket list snapshot before each mutation. Passes as `expectedUpdatedAt` to `authMutation`. Shows a conflict UI message if 409.

**`useAdminInterruptions.js`** — tracks `editDetail.updatedAt` via `getExpectedUpdatedAtById(id)` callback. Passes to all advisory mutations. Shows a conflict UI message.

### 2.4 Observations on Concurrency Coverage

| Resource | Backend guard | Frontend sends timestamp |
|---|---|---|
| Tickets — dispatch/hold/status | ✅ Double guard (pre-check + WHERE) | ✅ Yes (from list snapshot) |
| Interruptions — update/delete/restore/feed | ✅ Double guard (pre-check + WHERE) | ✅ Yes (from editDetail or list) |
| Service memos — update/close | ❌ None | ❌ None |
| Ticket groups — status/dispatch | ❌ None | ❌ None |
| Users — profile update | ❌ None | ❌ None |
| B2B mail messages | ❌ None | ❌ None |

---

## 3. RBAC — Role-Based Access Control

### 3.1 Roles in the system

Two roles exist: **`admin`** and **`employee`**. All role checks are lowercased and sourced exclusively from the DB (`users.role`), never from any client-sent header.

### 3.2 Core middleware

**`requireApiSession` (`backend/middleware/requireApiSession.js`)**
- Applied globally: `app.use('/api', requireApiSession)` in `server.js`
- Two auth flows (tried in priority order):
  1. **Legacy headers** — `X-User-Email` + `X-Token-Version` (enabled when `ALLOW_LEGACY_SESSION_HEADERS=true`, which is the default)
  2. **Bearer JWT** — `Authorization: Bearer <token>` via `verifyAccessToken()`
- DB lookup on every protected request: `SELECT status, token_version, role FROM users WHERE email = ?`
- Validates `token_version` (logout-all increments it, invalidating all existing sessions)
- Blocks disabled accounts (`status = 'Disabled'`)
- Sets `req.authUser = { email, role }` for downstream use

**`requireRole(...allowedRoles)` (`backend/middleware/requireRole.js`)**
- Three exported presets:
  - `requireAdmin` = admin only
  - `requireStaff` = admin or employee
  - `requireSelfOrAdmin(paramName, from)` = admin passes; others only if email matches their session

### 3.3 RBAC map — per route file

| Route file | Auth level | Notes |
|---|---|---|
| `auth.js` | **None** (all public) | Login, setup, forgot/reset password, verify-session |
| `contact-numbers.js` | **None** (public) | Read-only hotlines list |
| `feeders.js` | **None** (public) | Read-only feeders list |
| `tickets.js` | **`requireStaff`** on all admin routes | Public: `/tickets/submit`, `/tickets/track/:id`, `/tickets/send-copy`, `/check-duplicates`, `/tickets/sms/receive` |
| `ticket-routes.js` | **`requireStaff`** | `GET /filtered-tickets` only |
| `ticket-grouping.js` | **`requireStaff`** | All group create/get/ungroup/dispatch/status/bulk routes |
| `backup.js` | **`requireStaff`** | All export/import/archive/delete-code routes |
| `interruptions.js` | **`requireStaff`** on writes | Public: `GET /interruptions` (without admin flags), `GET /public/interruptions/:id`, `GET /share/interruption/:id`, `GET /interruptions/:id` (single, no guard). Dynamic: `requireStaffIfListQueryFlags` on list |
| `service-memos.js` | **`requireStaff`** | All endpoints (list, get, create, update, close, delete, allocate-control-number) |
| `user.js` | Mixed | `requireStaff`: invite, send-email, users list, toggle-status. `requireSelfOrAdmin`: profile R/W, activity log. `None`: check-email, invites/pending |
| `notifications.js` | **Manual check only** | No `requireRole` — each handler manually checks `req.authUser?.email`. Works because `requireApiSession` already ran, but inconsistent. |
| `history.js` | **`requireAdmin`** only | Most restrictive. Full audit log + export, admin-only. |
| `b2b-mail.js` | **`requireStaff`** | All contact + message + send + verification routes. Public: `GET /b2b-mail/contacts/verify`, `POST /b2b-mail/inbound/webhook` |
| `urgent-keywords.js` | Mixed | `GET /urgent-keywords` = public. `PUT /urgent-keywords` = `requireStaff` |

### 3.4 Frontend RBAC

**`ProtectedRoute.jsx`** — checks only `localStorage.getItem('userEmail')` and `localStorage.getItem('tokenVersion')`. No role check. All admin routes (`/admin-*`) require any valid logged-in session. A logged-in employee sees the same routes in the sidebar as an admin — backend enforces the actual restriction.

**No frontend role-gating** — the SPA does not conditionally hide pages based on role. Employees could navigate to `/admin-history` in the browser; the page would load but all API calls would return 403.

---

## 4. Identified Gaps & Observations

### Gap 1 — `GET /invites/pending` has no auth guard
**File:** `backend/routes/user.js`
```js
router.get('/invites/pending', async (req, res) => { ... }
```
No `requireStaff`, no role check. Returns email, role_assigned, code, created_at for all pending invitations. Since `requireApiSession` is global it does require a login, but any authenticated employee (not just admin) can access it. Invite codes being readable by employees is a design concern.

### Gap 2 — `GET /interruptions/:id` (single advisory) has no auth guard
**File:** `backend/routes/interruptions.js`
```js
router.get('/interruptions/:id', async (req, res) => { ... }
```
No `requireStaff`. `requireApiSession` is global so it requires a logged-in session, but the response returns the full advisory record including remarks/updates intended for admin view. The public endpoint for the same data is `/public/interruptions/:id` which returns a filtered DTO. The admin single-GET returns unfiltered data to any authenticated user regardless of role.

### Gap 3 — Notifications use manual auth check instead of middleware
**File:** `backend/routes/notifications.js`
All four notification routes manually check `req.authUser?.email` and return 401 if missing. This works but is inconsistent with the rest of the codebase. If `requireApiSession` were ever disabled or its output changed, these routes would have no fallback role guard.

### Gap 4 — Socket.IO has no authentication gate
**File:** `server.js` lines 68–85
The Socket.IO connection accepts any client from an allowed CORS origin without validating a session token. Any visitor to the app who knows the API URL can connect and receive `realtime:entity-changed` broadcasts. The payload contains actor email, HTTP method, path, and timestamp — no record data — so the practical risk is low. But the actor email being leaked to unauthenticated observers is a data exposure concern.

### Gap 5 — Ticket concurrency control has no `CONFLICT_STALE_TICKET` code in 409 response
**File:** `backend/routes/tickets.js`
Interruptions consistently return `code: 'CONFLICT_STALE_INTERRUPTION'` in 409 bodies. Ticket conflicts return 409 but the code field is not always set (varies by route handler). Frontend `isOptimisticConflict()` checks for the code in a Set — if the code is missing, it still detects 409 correctly, but the behavior depends on an implicit fallback in `isOptimisticConflict`:
```js
const code = String(data?.code || '').trim();
return !code || CONFLICT_CODES.has(code); // passes if code is empty string
```
This means **any 409** from a ticket route is treated as a concurrency conflict, even non-concurrency 409s that might be added later. A future ticket route returning 409 for business logic (e.g., duplicate detection) would be misinterpreted as a conflict.

### Gap 6 — Service memos and ticket groups have no optimistic concurrency guard
As noted in §2.4, `PUT /service-memos/:id`, `PUT /service-memos/:id/close`, and all ticket group write routes have no `expected_updated_at` check. Concurrent edits to the same memo or group status can silently overwrite each other.

### Gap 7 — Concurrency control is duplicated between `concurrencyControl.js` and `interruptions.js`
Tickets use `backend/utils/concurrencyControl.js`. Interruptions have their own local `buildOptimisticInterruptionWhere` inside the route file. They are not identical — interruptions normalizes to MySQL datetime format, tickets compares ISO strings. This divergence risks behavioral differences and makes future changes harder to synchronize.

### Gap 8 — `check-email` is publicly accessible
**File:** `backend/routes/user.js`
```js
router.post('/check-email', async (req, res) => { ... }
```
Returns whether an email exists in the `users` table. This is a user enumeration endpoint with no auth. It was likely added for invite code UX flows. The practical risk depends on whether attacker knowledge of valid admin emails is a concern.

---

## 5. Summary Table

| System | Implemented | Coverage | Key gaps |
|---|---|---|---|
| **WebSocket real-time** | ✅ Full | All write modules broadcast | No socket auth; no room filtering; `notifications` + `history` have no listeners |
| **Optimistic concurrency** | ✅ Partial | Tickets + Interruptions | Service memos, groups, users, B2B mail have none; two separate implementations |
| **RBAC — session auth** | ✅ Full | All `/api` routes (global gate) | N/A |
| **RBAC — role guard** | ✅ Mostly | All admin write routes | `invites/pending` open to any auth; `interruptions/:id` GET open to any auth; `notifications` no middleware |
| **Frontend RBAC** | ⚠️ UX-only | Login check only | No role-based page hiding; all enforcement is server-side |
