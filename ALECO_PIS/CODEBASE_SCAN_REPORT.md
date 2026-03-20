# Codebase Scanning Verification Report

**Original scan date:** 2025-03-16  
**Doc / feature resync:** 2026-03-20 (verify-session, interruptions API, ticket ID docs, AllUsers, profile, phone utils); **2026-03-20** Task 1 interruption data-source inconsistency cleared (see [docs/FULL_CODEBASE_MAP.md](./docs/FULL_CODEBASE_MAP.md)).  
**Scope:** Frontend, Backend, Database - 18 modular tasks  
**Mode:** Historical findings below; items marked **(corrected)** were re-verified against the live repo. For a single navigational index of routes and files, prefer **FULL_CODEBASE_MAP.md**.

---

## Task 1 - Body Landing Page and Home Route

**Files scanned:** `src/App.jsx`, `src/InterruptionList.jsx`, `src/components/headers/landingPage.jsx`

### Bugs Found
| # | Description | Location | Severity |
|---|-------------|----------|----------|
| 1 | **Missing verify-session** ~~(was reported)~~ **(corrected):** `POST /api/verify-session` **is defined** in `backend/routes/auth.js` (~line 330). Session guard in `App.jsx` can succeed when `VITE_API_URL` points at the Express origin. | auth.js | — |
| 2 | **InterruptionList hardcoded data** ~~(was reported)~~ **(corrected):** Public `InterruptionList.jsx` now loads `GET /api/interruptions`; backend brick is `backend/routes/interruptions.js` (queries `aleco_interruptions`). | InterruptionList.jsx, interruptions.js | — |

### Duplicates Found
- None in this scope.

### Inconsistencies Found
| # | Description | Locations |
|---|-------------|-----------|
| ~~1~~ | **(Resolved 2026 full-map audit):** Public `InterruptionList.jsx` and admin `Interruptions.jsx` both load **`GET /api/interruptions`** (and admin uses POST/PUT/DELETE). No hardcoded-vs-API split. | See [docs/FULL_CODEBASE_MAP.md](./docs/FULL_CODEBASE_MAP.md) §3 |

### Recommendations
- Keep `VITE_API_URL` on the Express origin in dev (e.g. `http://localhost:5000`) so `/api/verify-session` and `/api/interruptions` resolve.
- Optional: add auth middleware on interruption **mutations** (POST/PUT/DELETE) if you require stricter server-side admin checks.

---

## Task 2 - Report a Problem Flow

**Files scanned:** `src/ReportaProblem.jsx`, `src/components/textfields/TextFieldProblem.jsx`, `src/components/textfields/PhoneInputProblem.jsx`, `src/components/textfields/ExplainTheProblem.jsx`, `src/components/buckets/UploadTheProblem.jsx`, `src/components/dropdowns/IssueCategoryDropdown.jsx`, `src/components/contact/HotlinesDisplay.jsx`, `src/utils/phoneUtils.js`, `backend/utils/phoneUtils.js`, `backend/routes/tickets.js`, `backend/routes/contact-numbers.js`

### Bugs Found
| # | Description | Location | Severity |
|---|-------------|----------|----------|
| 1 | **Phone validation logic error**: Frontend `validatePhilippineMobile` (src/utils/phoneUtils.js:66) checks `digits.startsWith('63') && digits.length === 11`. Philippine mobile in 63 format is 12 digits (63 + 10). Valid 63 numbers would fail validation. Backend correctly expects 12 digits. | src/utils/phoneUtils.js:66-69 | **Medium** |
| 2 | **Debug console.log in production**: ReportaProblem.jsx line 96+ has multiple `console.log` statements (e.g. "Find My Location button clicked") - should be removed or gated for dev. | ReportaProblem.jsx (handleFindMyLocation, GPS flow) | **Low** |

### Duplicates Found
| # | Description | Locations |
|---|-------------|-----------|
| 1 | **toTelHref logic**: HotlinesDisplay defines local `toTelHref` (lines 9-16) - similar phone-to-tel conversion could be in phoneUtils. | HotlinesDisplay.jsx vs phoneUtils.js |

### Inconsistencies Found
| # | Description | Locations |
|---|-------------|-----------|
| 1 | ReportaProblem uses `fetch` with FormData for submit; HotlinesDisplay uses `fetch` with JSON. Both use apiUrl - consistent. | - |
| 2 | Backend tickets/submit expects `upload.single('image')` - ReportaProblem sends FormData with image. Verify field name matches. | ReportaProblem.jsx:431 vs tickets.js |

### API Endpoint Verification
| Frontend Call | Backend Route | Status |
|---------------|---------------|--------|
| POST /api/tickets/submit | tickets.js router.post('/tickets/submit') | OK |
| POST /api/check-duplicates | tickets.js router.post('/check-duplicates') | OK |
| GET /api/tickets/track/:id | tickets.js | OK |
| POST /api/tickets/send-copy | tickets.js | OK |
| GET /api/contact-numbers | contact-numbers.js | OK |

### Recommendations
- Extract toTelHref to phoneUtils if used elsewhere.
- Remove or gate debug console.log in ReportaProblem.

---

## Task 3 - About, Privacy, Footer, Cookie Banner

**Files scanned:** `src/About.jsx`, `src/PrivacyNotice.jsx`, `src/Footer.jsx`, `src/components/CookieBanner.jsx`

### Bugs Found
| # | Description | Location | Severity |
|---|-------------|----------|----------|
| 1 | **PrivacyNotice "Agree" button has no handler**: Button (line 18) has no onClick - does nothing when clicked. | PrivacyNotice.jsx:18 | **Low** |
| 2 | **CookieBanner "More Options" button has no handler**: Button (line 88) has no onClick - does nothing. | CookieBanner.jsx:88 | **Low** |
| 3 | **CookieBanner Privacy Policy link is dead**: `href="#"` (line 85) - no actual privacy policy URL. | CookieBanner.jsx:85 | **Low** |
| 4 | **Footer missing React import**: Uses JSX but no `import React` - may work with new JSX transform but inconsistent with other components. | Footer.jsx:1 | **Low** |

### Duplicates Found
| # | Description | Locations |
|---|-------------|-----------|
| 1 | Cookie consent vs Privacy "Agree" pattern - both components have similar consent UI; PrivacyNotice Agree is non-functional. | PrivacyNotice.jsx, CookieBanner.jsx |

### Inconsistencies Found
| # | Description | Locations |
|---|-------------|-----------|
| 1 | About uses `interruption-list-container` class for non-interruption content - semantic mismatch. | About.jsx:21 |
| 2 | PrivacyNotice uses same `interruption-list-container` - inconsistent reuse. | PrivacyNotice.jsx:7 |

### Recommendations
- Add onClick to PrivacyNotice Agree button (e.g. scroll to top or track consent).
- Add onClick to CookieBanner "More Options" or remove if not needed.
- Replace CookieBanner privacy link href with actual Privacy Notice section anchor (e.g. `#privacy`).
- Add React import to Footer for consistency.

---

## Task 4 - Auth Flow

**Files scanned:** `src/components/buttons/login.jsx`, `backend/routes/auth.js`

### Bugs Found
| # | Description | Location | Severity |
|---|-------------|----------|----------|
| 1 | **verify-session** ~~(was reported missing)~~ **(corrected):** `POST /api/verify-session` exists in `auth.js`. | auth.js | — |
| 2 | **setup-google-account UPDATE** ~~(was reported)~~ **(corrected):** Uses `['used', cleanEmail]` for `UPDATE access_codes SET status = ? WHERE email = ?`. | auth.js ~200 | — |
| 3 | **Login uses alert() for errors**: Inconsistent with rest of app (toast). | login.jsx (multiple handlers) | **Low** |
| 4 | **setup-account: login.jsx does not send `name`**: Backend uses `name \|\| "New User"`. User will always get "New User" unless they use Google setup. | login.jsx:135-138 | **Low** |

### Duplicates Found
| # | Description | Locations |
|---|-------------|-----------|
| 1 | Login modal and Forgot Password modal share same overlay structure and form pattern - could be extracted. | login.jsx:172-214, 218-268 |

### Inconsistencies Found
| # | Description | Locations |
|---|-------------|-----------|
| 1 | Login uses API (axiosConfig) while ReportaProblem uses fetch + apiUrl - different HTTP client patterns. | login.jsx vs ReportaProblem.jsx |
| 2 | Backend setup-account expects optional `name`; login form does not collect name for password setup. | login.jsx, auth.js |

### API Endpoint Verification
| Frontend Call | Backend Route | Status |
|---------------|---------------|--------|
| POST /api/setup-account | auth.js | OK |
| POST /api/login | auth.js | OK |
| POST /api/google-login | auth.js | OK |
| POST /api/setup-google-account | auth.js | OK |
| POST /api/logout-all | auth.js | OK |
| POST /api/forgot-password | auth.js | OK |
| POST /api/reset-password | auth.js | OK |
| POST /api/verify-session | auth.js | OK |

### Recommendations
- Add name field to setup-account form or document that "New User" is intentional.
- Consider replacing alert() with toast for consistency.

---

## Task 5 - Users Management

**Files scanned:** `src/components/Users.jsx`, `src/components/containers/AllUsers.jsx`, `src/components/containers/InviteNewUsers.jsx`, `backend/routes/user.js`

### Bugs Found
| # | Description | Location | Severity |
|---|-------------|----------|----------|
| 1 | **AllUsers ignores users prop**: Users.jsx passes `users={usersList}` to AllUsers, but AllUsers does not accept or use a users prop - it fetches from API. handleUserInvited updates usersList but AllUsers never displays it. | Users.jsx:42, AllUsers.jsx | **Medium** |
| 2 | **AllUsers URL** ~~(was hardcoded localhost)~~ **(corrected):** Uses `apiUrl('/api/users')`. | AllUsers.jsx | — |
| 3 | **Users.jsx mock data is dead**: usersList state and handleUserInvited are unused because AllUsers fetches its own data. | Users.jsx:15-22 | **Low** |
| 4 | **user.js toggle-status ignores requesterEmail**: Backend receives requesterEmail but does not validate (e.g. prevent self-disable). Frontend blocks it; backend does not. | user.js:171-184 | **Low** |

### Duplicates Found
| # | Description | Locations |
|---|-------------|-----------|
| 1 | USER_ROLES constant defined identically in Users.jsx, AllUsers.jsx, InviteNewUsers.jsx - should be shared. | Users.jsx:8-11, AllUsers.jsx:5-8, InviteNewUsers.jsx:5-8 |

### Inconsistencies Found
| # | Description | Locations |
|---|-------------|-----------|
| 1 | InviteNewUsers uses API (axiosConfig); AllUsers uses fetch. Mixed HTTP clients. | InviteNewUsers.jsx, AllUsers.jsx |
| 2 | InviteNewUsers onUserInvited passes optimistic data; AllUsers never refetches after invite - new user appears only after manual refresh. | Users.jsx, AllUsers.jsx |

### API Endpoint Verification
| Frontend Call | Backend Route | Status |
|---------------|---------------|--------|
| GET /api/users | user.js GET /users | OK |
| POST /api/invite | user.js POST /invite | OK |
| POST /api/send-email | user.js POST /send-email | OK |
| POST /api/check-email | user.js POST /check-email | OK |
| POST /api/users/toggle-status | user.js POST /users/toggle-status | OK |

### Recommendations
- Either pass users + refetch callback from Users to AllUsers, or have InviteNewUsers trigger AllUsers refetch (e.g. via callback or shared state).
- Extract USER_ROLES to shared constants.
- Add backend validation for toggle-status (reject if requesterEmail === target user).

---

## Task 6 - Profile Page

**Files scanned:** `src/components/profile/ProfilePage.jsx`

### Bugs Found
| # | Description | Location | Severity |
|---|-------------|----------|----------|
| 1 | **Profile save** ~~(was reported)~~ **(corrected):** `PUT /api/users/profile` in `user.js` persists name; `ProfilePage.jsx` should call it on save (verify UI wiring in branch). | ProfilePage.jsx, user.js | — |
| 2 | **Change Password button has no handler**: Button (line 100) has no onClick - does nothing. | ProfilePage.jsx:100 | **Low** |
| 3 | **Activity Logs are hardcoded**: "Profile Updated", "Logged in", "Password Changed" are static - not from API. | ProfilePage.jsx:127-131 | **Low** |
| 4 | **Social links are non-functional**: Facebook, Twitter, GitHub have no href or onClick. | ProfilePage.jsx:109-120 | **Low** |
| 5 | **Hardcoded fallback name**: `'Aezy Millete'` used when localStorage empty - should be generic. | ProfilePage.jsx:9 | **Low** |

### Duplicates Found
- None in this scope.

### Inconsistencies Found
| # | Description | Locations |
|---|-------------|-----------|
| 1 | Profile reads from localStorage only; no backend profile API. Other admin pages use API. | ProfilePage.jsx |

### Recommendations
- Add Change Password flow (forgot-password or dedicated endpoint).
- Replace hardcoded activity logs with real audit data or remove.
- Use generic fallback (e.g. "User") instead of specific name.

---

## Task 7 - Ticket List, Filter, Layout

**Files scanned:** `src/components/Tickets.jsx`, `src/utils/useTickets.js`, `src/components/tickets/TicketListPane.jsx`, `src/components/tickets/TicketFilterSidebar.jsx`, `src/components/tickets/TicketFilterBar.jsx`, `backend/routes/ticket-routes.js`

### Bugs Found
| # | Description | Location | Severity |
|---|-------------|----------|----------|
| 1 | **Debug console.log in production**: Tickets.jsx lines 73-75, 78, 81 have console.log for selectedIds - should be removed. | Tickets.jsx:72-84 | **Low** |
| 2 | **useTickets refetch on every filter change**: useEffect([filters]) refetches when any filter changes. Rapid filter toggling could cause many requests. Consider debounce. | useTickets.js:54-56 | **Low** |

### Duplicates Found
- None significant.

### Inconsistencies Found
| # | Description | Locations |
|---|-------------|-----------|
| 1 | useTickets uses axios; ReportaProblem/AllUsers use fetch - mixed HTTP clients. | useTickets.js vs ReportaProblem.jsx |

### API Endpoint Verification
| Frontend Call | Backend Route | Status |
|---------------|---------------|--------|
| GET /api/filtered-tickets | ticket-routes.js | OK |
| GET /api/crews/list | tickets.js | OK |

### Recommendations
- Remove debug console.log from Tickets.jsx.
- Consider debouncing filter changes before fetch.

---

## Task 8 - Ticket Detail and Modals

**Files scanned:** `src/components/tickets/TicketDetailPane.jsx`, `DispatchTicketModal.jsx`, `EditTicketModal.jsx`, `HoldTicketModal.jsx`, `GroupIncidentModal.jsx`, `ConfirmModal.jsx`

### Bugs Found
| # | Description | Location | Severity |
|---|-------------|----------|----------|
| 1 | **ticket_id vs ticketId inconsistency**: Backend uses ticket_id (snake_case); frontend may use ticketId (camelCase). Verify mapping. | Various | **Low** |

### Duplicates Found
- Modal form patterns (Dispatch, Edit, Hold, Group) share similar structure - could use shared base.

### Inconsistencies Found
- Form validation and error handling vary across modals.

---

## Task 9 - Ticket Kanban and Grouping

**Files scanned:** `TicketKanbanView.jsx`, `KanbanColumn.jsx`, `KanbanTicketCard.jsx`, `backend/routes/ticket-grouping.js`

### API Endpoint Verification
| Frontend Call | Backend Route | Status |
|---------------|---------------|--------|
| POST /api/tickets/group/create | ticket-grouping.js | OK |
| GET /api/tickets/group/:mainTicketId | ticket-grouping.js | OK |
| PUT /api/tickets/group/:mainTicketId/ungroup | ticket-grouping.js | OK |
| PUT /api/tickets/group/:mainTicketId/dispatch | ticket-grouping.js | OK |
| PUT /api/tickets/group/:mainTicketId/status | ticket-grouping.js | OK |
| PUT /api/tickets/bulk/restore | ticket-grouping.js | OK |

---

## Task 10 - Ticket History and Logs

**Files scanned:** `TicketHistoryLogs.jsx`, `backend/utils/ticketLogHelper.js`

### Findings
- Logs API: GET /api/tickets/logs, GET /api/tickets/:ticketId/logs exist in tickets.js.
- ticketLogHelper provides insertTicketLog for audit trail.

---

## Task 11 - Personnel Management

**Files scanned:** `PersonnelManagement.jsx`, `CrewKanbanView.jsx`, `LinemanKanbanView.jsx`, `AddCrew.jsx`, `AddLinemen.jsx`

### API Endpoint Verification
- Crews: GET/POST/PUT/DELETE in tickets.js.
- Pool (linemen): GET/POST/PUT in tickets.js.

### Duplicates Found
| # | Description | Locations |
|---|-------------|-----------|
| 1 | Kanban pattern duplicated between tickets and personnel - kanbanHelpers vs personnelKanbanHelpers. | src/utils/kanbanHelpers.js, personnelKanbanHelpers.js |

---

## Task 12 - Backup and Export

**Files scanned:** `Backup.jsx`, `backup/*`, `backend/routes/backup.js`, `dataManagementEntities.js`

### API Endpoint Verification
| Frontend Call | Backend Route | Status |
|---------------|---------------|--------|
| GET /api/tickets/export/preview | backup.js | OK |
| GET /api/tickets/export | backup.js | OK |
| POST /api/tickets/archive | backup.js | OK |
| POST /api/tickets/import | backup.js | OK |

### Inconsistencies Found
- ~~dataManagementEntities interruptions `available: false`~~ **(corrected):** set to `true` now that interruptions CRUD exists.

---

## Task 13 - Backend Routes and Middleware

**Files scanned:** `server.js`, `backend/routes/*.js`

### Bugs Found
| # | Description | Location | Severity |
|---|-------------|----------|----------|
| 1 | **verify-session / setup-google-account** — see Task 4 **(corrected)** in live `auth.js`. | auth.js | — |

### Route Summary
| Route File | Mount | Key Routes |
|------------|-------|------------|
| auth.js | /api | setup-account, login, google-login, setup-google-account, logout-all, forgot-password, reset-password, **verify-session** |
| user.js | /api | invite, send-email, check-email, users, users/toggle-status, users/profile |
| tickets.js | /api | tickets/submit, track, PUT, DELETE, send-copy, dispatch, hold, check-duplicates, logs, crews/*, pool/* |
| ticket-routes.js | /api | filtered-tickets |
| interruptions.js | /api | interruptions (GET list, POST/PUT/DELETE CRUD) |
| ticket-grouping.js | /api | tickets/group/*, tickets/bulk/restore |
| contact-numbers.js | /api | contact-numbers |
| backup.js | /api | tickets/export/*, tickets/archive, tickets/import |

### Middleware
- cors(), express.json() - no auth middleware on protected routes (relies on frontend).

---

## Task 14 - Database Schema and Migrations

**Files scanned:** `backend/migrations/*.sql`

### Migration Files (13+ total; add as needed)
- create_ticket_grouping_tables.sql, create_contact_numbers.sql
- add_ticket_logs.sql, add_deleted_at_to_tickets.sql, add_dispatched_at.sql
- add_hold_columns.sql, add_lineman_leave_columns.sql, add_group_type_and_visit_order.sql
- add_nff_access_denied_status.sql, fix_status_enum.sql, add_export_log.sql, add_phone_index.sql
- **create_aleco_interruptions.sql** — power advisory table (apply if missing)

### Tables Referenced
- aleco_tickets, aleco_ticket_logs, aleco_ticket_groups, aleco_ticket_group_members
- aleco_contact_numbers, aleco_export_log, aleco_personnel, aleco_crew_members, aleco_linemen_pool
- **aleco_interruptions** (power advisories; wired to `GET/POST/PUT/DELETE /api/interruptions`)
- users, access_codes, password_resets

### Inconsistencies
- Migration order not enforced by run-migration.js - manual ordering required.

---

## Task 15 - Shared Utilities and Duplicates

**Files scanned:** `src/utils/*.js`, `backend/utils/*.js`

### Bugs Found
| # | Description | Location | Severity |
|---|-------------|----------|----------|
| 1 | **Frontend 63-format length** — see Task 2 **(corrected).** | src/utils/phoneUtils.js | — |

### Duplicates Found
| # | Description | Locations |
|---|-------------|-----------|
| 1 | **phoneUtils**: Frontend and backend have separate files. Backend normalizes for DB; frontend validates/display. Logic should align (63 = 12 digits). | src/utils/phoneUtils.js, backend/utils/phoneUtils.js |
| 2 | **Kanban helpers**: kanbanHelpers (tickets) and personnelKanbanHelpers (crews/linemen) - different domains but similar group-by pattern. Not critical duplication. | kanbanHelpers.js, personnelKanbanHelpers.js |
| 3 | **toTelHref**: HotlinesDisplay has local implementation; could live in phoneUtils. | HotlinesDisplay.jsx |

### Inconsistencies
- Frontend/backend phone helpers remain duplicated files; logic should stay aligned on 63 = 12 digits.

---

## Task 16 - API Client and Error Handling

**Files scanned:** `src/utils/api.js`, `src/api/axiosConfig.js`

### Bugs Found
| # | Description | Location | Severity |
|---|-------------|----------|----------|
| 1 | **Fetch calls bypass loading interceptor**: axiosConfig has show/hide-global-loader; fetch (ReportaProblem, AllUsers, HotlinesDisplay) does not. Inconsistent loading UX. | api.js vs axiosConfig.js | **Low** |

### Inconsistencies Found
| # | Description | Locations |
|---|-------------|-----------|
| 1 | **Mixed HTTP clients**: Login, InviteNewUsers, useTickets use axios; ReportaProblem, AllUsers, HotlinesDisplay use fetch. | Various |
| 2 | **AllUsers URL** — **(corrected):** uses `apiUrl`. | AllUsers.jsx |

### Recommendations
- Use apiUrl for all fetch base URLs.
- Consider wrapping fetch in a helper that dispatches loader events, or migrate to axios for consistency.

---

## Task 17 - Context and Global State

**Files scanned:** `src/context/LoadingContext.jsx`

### Findings
- LoadingProvider listens for 'show-global-loader' and 'hide-global-loader'.
- axiosConfig dispatches these; fetch does not.
- Cleanup on unmount - no memory leak.
- useLoading hook exported but usage not verified across codebase.

---

## Task 18 - Maps and Location

**Files scanned:** `LocationPreviewMap.jsx`, `CoverageMap.jsx`, `src/utils/gpsLocationMatcher.js`, `alecoScope.js`

### Findings
- gpsLocationMatcher: matchGPSToAlecoScope, validateDistrictMunicipality - used by ReportaProblem.
- alecoScope.js: ALECO_SCOPE constant for districts/municipalities.
- Backend tickets.js validates district/municipality against location.
- Google Maps API key from VITE_GOOGLE_MAPS_API_KEY - ensure env is set.

---

# Summary: Previously flagged items (2026-03-20 status)

| # | Original finding | Status |
|---|------------------|--------|
| 1 | Missing POST /api/verify-session | **Fixed in code** — route in `auth.js`; ensure `VITE_API_URL` targets Express. |
| 2 | setup-google-account UPDATE params | **Fixed** — `['used', cleanEmail]`. |
| 3 | AllUsers hardcoded localhost | **Fixed** — `apiUrl('/api/users')`. |
| 4 | Frontend 63-format phone length | **Fixed** — 12 digits for `63…`. |
| 5 | InterruptionList static data / empty API | **Fixed** — `interruptions.js` + `InterruptionList` fetch; admin CRUD in `Interruptions.jsx`. |
| 6 | Profile save persistence | **Addressed** — `PUT /api/users/profile` pattern (verify in branch). |
| 7 | Users.jsx / AllUsers props | **Open** — optional refactor: `refreshKey` + refetch vs passing `users`. |

Remaining lower-priority items: console.log cleanup, cookie/privacy handlers, mixed fetch vs axios, optional auth middleware on admin mutations.

---
