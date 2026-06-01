# Ticket & Service Memo Flow Audit

## Purpose
Document the complete flow of ticket and service memo interactions, including status transitions, edge cases, and potential bugs.

## Flow Scenarios

### Scenario 1: User clicks "Create Service Memo" button

**Frontend Flow (ServiceMemoForm.jsx):**
1. User enters ticket ID in the top strip
2. System debounces and verifies ticket ID against DB (450ms delay)
3. If ticket found, auto-fills customer info from ticket
4. User clicks "Generate memo number" button
5. System allocates control number based on municipality prefix
6. User fills form fields (received by, intake date/time, referred to, action taken, etc.)
7. User clicks "Save"
8. System validates required fields
9. System checks if ticket already has a service memo (prevents duplicate)

**Backend Flow (service-memos.js POST /api/service-memos):**
1. Validates user authentication (X-User-Email)
2. Validates required fields
3. Fetches ticket data from DB
4. Checks if service memo already exists for this ticket (returns 409 if yes)
5. Auto-allocates control number if not provided (based on municipality prefix)
6. Inserts into `aleco_service_memos` with:
   - `memo_status = 'saved'`
   - `ticket_status = 'Ongoing'`
   - `control_number` (auto-generated or provided)
   - Other fields from form
7. Updates `aleco_tickets`:
   - `service_memo_id = memo.id`
   - `status = 'Ongoing'` (forced regardless of previous status)
8. Records notification
9. Commits transaction

**Status Effects:**
- Ticket status is **forced to 'Ongoing'** even if it was 'Pending' or other status
- Memo status is set to 'saved'
- Ticket is now linked to memo via `service_memo_id`

**Potential Issues:**
- ⚠️ **BUG**: Ticket status is forced to 'Ongoing' even if it shouldn't be (e.g., if ticket was already 'Restored')
- ⚠️ **BUG**: No validation that ticket status is appropriate for creating a memo (can create memo for already-resolved tickets)

---

### Scenario 2: Service Memo Status Roles and Flow

**Memo Status Values:**
- `saved` - Initial status when memo is created
- `deployed` - When ticket is dispatched (crew assigned via dispatch button)
- `closed` - When memo is finalized with resolution
- `resolved` - Resolution status (Restored)
- `unresolved` - Resolution status (Unresolved)
- `nofaultfound` - Resolution status (No Fault Found)
- `accessdenied` - Resolution status (Access Denied)

**Status Transitions:**

**saved → deployed** (Dispatch flow):
- Trigger: User clicks "Start a Resolution" (dispatch button)
- Backend: `PUT /api/tickets/:ticketId/dispatch` updates memo_status to 'deployed'
- Effect: Memo is now in progress, crew is assigned

**saved → closed** (Direct close flow):
- Trigger: User clicks "Close Memo" or "Close memo (finalize)"
- Backend: `PUT /api/service-memos/:id/close` updates memo_status to 'closed'
- Effect: Memo is finalized, ticket status changes to resolution status

**deployed → closed** (Resolution completion):
- Trigger: Lineman updates via SMS or dispatcher closes memo
- Backend: Ticket status change updates memo to resolution status
- Effect: Memo reflects final resolution

**closed/resolved/unresolved/nofaultfound/accessdenied → saved** (Reopen):
- Trigger: User clicks "Reopen Memo"
- Backend: `PUT /api/service-memos/:id/reopen` updates memo_status to 'saved'
- Effect: Memo can be edited again

**Status Effects on UI:**
- `saved`: Dispatch button is visible (can start resolution)
- `deployed`: Dispatch button is visible (can re-dispatch or update)
- `resolved/unresolved/nofaultfound/accessdenied/closed`: Dispatch button is **hidden** (cannot dispatch)
- `closed`: Cannot edit, can only reopen

**Potential Issues:**
- ⚠️ **BUG**: No validation that ticket status matches memo status (e.g., memo 'saved' but ticket 'Restored')
- ⚠️ **BUG**: Can create memo for already-dispatched tickets (status 'Ongoing' with crew assigned)

---

### Scenario 3: User creates service memo with a grouped ticket

**Grouped Ticket Structure:**
- Master ticket: `GROUP-YYYYMMDD-XXXX` (has no parent_ticket_id)
- Child tickets: Have `parent_ticket_id = GROUP-XXXX`
- Child tickets cannot be edited individually while grouped

**Current Behavior:**
From `tickets.js` lines 698-701:
```javascript
if (existing[0].parent_ticket_id) {
    await connection.rollback();
    return res.status(400). json({ success: false, message: 'Cannot edit a ticket that is part of a group. Ungroup first.' });
}
```

**Service Memo Creation with Grouped Ticket:**
- If user tries to create memo for a **child ticket**: Backend blocks it (400 error)
- If user tries to create memo for a **GROUP master ticket**: Backend blocks it (400 error, line 687-690)
- **Result**: Cannot create service memo for any ticket in a group

**Why GROUP ticket has no "Edit Ticket" and "Ungroup" button:**
- From the code, GROUP master tickets are special records
- They are created by the grouping system, not by users
- They serve as containers for child tickets
- The UI likely treats them differently (display-only)

**Potential Issues:**
- 🔴 **CRITICAL BUG**: Cannot create service memo for grouped tickets at all
- 🔴 **CRITICAL BUG**: No way to dispatch crews for grouped incidents
- 🔴 **CRITICAL BUG**: Grouped tickets cannot be resolved through service memo flow
- ⚠️ **BUG**: GROUP master tickets should have ungroup button in UI
- ⚠️ **BUG**: Service memo creation should allow child tickets (or handle group-level memos)

**Expected Behavior:**
- Should be able to create service memo for grouped tickets
- Either:
  1. Allow memo creation for child tickets (with warning about group)
  2. Create group-level service memo that covers all child tickets
  3. Require ungrouping before memo creation (but provide clear UI to ungroup)

---

### Scenario 4: Consumer Reports a Problem (Public Ticket Submission)

**Frontend Flow (ReportaProblem.jsx):**
1. Consumer visits public report form
2. Fills personal information (name, phone, address)
3. Describes problem (category, concern)
4. System auto-detects GPS location (if browser allows)
5. Consumer may upload photo
6. Consumer submits ticket
7. System generates ticket ID (ALECO-XXXXX)
8. Consumer receives SMS confirmation with ticket ID

**Backend Flow (tickets.js POST /api/tickets/submit):**
1. Rate limiting applied (rateLimitTicketSubmission)
2. Validates district-municipality relationship
3. Checks for duplicate tickets (same phone + category + concern within 5 minutes)
4. Generates ticket ID: `ALECO-{random 5 chars}`
5. Validates GPS location against ALECO service area
6. Inserts into `aleco_tickets` with status 'Pending'
7. Sends SMS confirmation to consumer
8. Returns ticket ID to consumer

**Status Effects:**
- Ticket status: 'Pending'
- No service memo created
- No crew assigned
- Location stored (GPS or manual)

**Potential Issues:**
- ⚠️ **BUG**: Duplicate check only checks phone + category + concern within 5 minutes - doesn't check address/location
- ⚠️ **BUG**: No validation that phone number is in valid format
- ⚠️ **BUG**: GPS location validation may reject valid locations if ALECO service area data is incomplete
- ⚠️ **BUG**: No rate limiting per phone number (can spam with different phone numbers)
- ⚠️ **BUG**: Photo upload size not validated (could exceed limits)

---

### Scenario 5: Consumer Submits Ticket Without Map Pin

**Frontend Flow:**
1. Consumer reports problem manually
2. Skips GPS location detection (user denies or browser doesn't support)
3. Selects municipality and district from dropdown
4. System validates district-municipality relationship
5. Submits ticket with municipality center as default location
6. Ticket created with approximate location

**Backend Flow:**
- Same as Scenario 4, but without GPS coordinates
- Uses district/municipality for location
- `reported_lat` and `reported_lng` may be null or use default values

**Status Effects:**
- Ticket status: 'Pending'
- Location is approximate (municipality center)
- Dispatcher can see location needs refinement

**Potential Issues:**
- ⚠️ **BUG**: No default GPS coordinates for municipality centers (may use null or 0,0)
- ⚠️ **BUG**: No indication to dispatcher that location is approximate vs precise
- ⚠️ **BUG**: District-municipality validation may have incomplete data

---

### Scenario 6: Consumer Tracks Ticket Status

**Frontend Flow (ReportaProblem.jsx - Track section):**
1. Consumer enters ticket ID in track form
2. System fetches ticket data from `/api/tickets/track/:ticketId`
3. System shows current status (Pending, Ongoing, Restored, etc.)
4. Displays service memo status (if created)
5. Shows assigned crew and ETA (if dispatched)
6. Displays resolution notes (if resolved)
7. Shows map location with Google Maps link

**Backend Flow (tickets.js GET /api/tickets/track/:ticketId):**
1. Fetches ticket by ticket_id
2. Fetches service memo if exists
3. Fetches assigned crew if dispatched
4. Returns sanitized data (hides internal fields)
5. Returns location data for map display

**Status Effects:**
- No status changes (read-only)
- Consumer sees current state

**Potential Issues:**
- ⚠️ **BUG**: No validation that ticket_id format is correct before query
- ⚠️ **BUG**: No rate limiting on track endpoint (can be abused to scrape data)
- ⚠️ **BUG**: If ticket is grouped, may show confusing data (child vs parent)
- ⚠️ **BUG**: Service memo control number is hidden (good for security but may confuse consumers)

---

### Scenario 7: Dispatcher Reviews New Tickets

**Frontend Flow (Dashboard.jsx / Tickets.jsx):**
1. Dispatcher logs into dashboard
2. Sees new tickets in Ticket Pool (status 'Pending')
3. Reviews ticket details and location on map
4. Checks for similar incidents in same area
5. Decides to dispatch or group with other tickets

**Backend Flow:**
- Fetches tickets via `/api/filtered-tickets` with filters
- Shows tickets with status 'Pending' or 'Ongoing'
- Displays location data on map
- Groups similar tickets if needed

**Status Effects:**
- No status changes (read-only view)

**Potential Issues:**
- ⚠️ **BUG**: No automatic detection of similar incidents (manual grouping only)
- ⚠️ **BUG**: Map may not show all tickets if location data is missing
- ⚠️ **BUG**: No indication if ticket already has service memo
- ⚠️ **BUG**: Pagination may miss new tickets if not refreshed

---

### Scenario 8: Dispatcher Creates Service Memo

**Frontend Flow:**
1. Dispatcher clicks "Create Service Memo" on ticket
2. Opens ServiceMemoForm in 'create' mode
3. System auto-fills customer info from ticket
4. Dispatcher generates control number
5. Dispatcher fills form fields
6. Dispatcher saves memo
7. Ticket status changes to 'Ongoing'

**Backend Flow:**
- Same as Scenario 1 (Create Service Memo)

**Status Effects:**
- Ticket status: 'Ongoing' (forced)
- Memo status: 'saved'
- Ticket linked to memo

**Potential Issues:**
- 🔴 **CRITICAL BUG**: Ticket status forced to 'Ongoing' even if already dispatched
- 🔴 **CRITICAL BUG**: No crew assignment in service memo creation (contradicts scenario description)
- ⚠️ **BUG**: Scenario description says "assigns crew from pool" but actual flow requires separate dispatch step
- ⚠️ **BUG**: No ETA setting in service memo creation (requires separate dispatch step)

---

### Scenario 9: Crew Receives Dispatch

**Frontend Flow:**
1. Crew logs into dashboard
2. Sees assigned tickets in dashboard
3. Views location on map with GPS coordinates
4. Reads dispatch notes and instructions
5. Navigates to incident location
6. Updates status upon arrival

**Backend Flow:**
- Fetches tickets assigned to crew via `/api/crews/list` or similar
- Shows tickets with `assigned_crew = crew_name`
- Shows dispatch notes from ticket

**Status Effects:**
- No status changes (read-only view)

**Potential Issues:**
- ⚠️ **BUG**: No separate crew dashboard (uses same admin dashboard)
- ⚠️ **BUG**: No "update status upon arrival" feature (status update is manual)
- ⚠️ **BUG**: No mobile-optimized view for field crews
- ⚠️ **BUG**: No offline support for areas with poor connectivity

---

### Scenario 10: Lineman Updates Status On-Site

**Frontend Flow:**
1. Lineman arrives at location
2. Updates ticket status via SMS or dashboard
3. Adds remarks about work done
4. Marks ticket as Restored or Unresolved
5. System sends SMS update to consumer

**Backend Flow (SMS Webhook - tickets.js):**
1. Receives SMS from lineman's phone
2. Parses keywords (fixed, unfixed, nofault, nores)
3. Extracts ticket ID from message
4. Updates ticket status based on keyword
5. Adds remarks to lineman_remarks
6. Sends SMS to consumer
7. Logs action in ticket history

**Status Effects:**
- Ticket status: Restored/Unresolved/NoFaultFound/AccessDenied
- Memo status: Updated to match resolution status
- Consumer receives SMS

**Potential Issues:**
- ⚠️ **BUG**: SMS parsing may fail if message format is incorrect
- ⚠️ **BUG**: No validation that sender is authorized crew member
- ⚠️ **BUG**: No photo upload via SMS (mentioned in scenario but not implemented)
- ⚠️ **BUG**: Bulk updates (all fixed) may affect wrong tickets if crew has multiple groups
- ⚠️ **BUG**: No undo mechanism for incorrect SMS updates

---

### Scenario 11: Group Incident Handling

**Frontend Flow:**
1. Multiple consumers report same issue
2. System detects similar incidents in same area (manual detection)
3. Dispatcher creates group ticket via GroupIncidentModal
4. System generates GROUP-YYYYMMDD-XXXX ID
5. All child tickets linked to parent via parent_ticket_id
6. Dispatcher creates service memo (BLOCKED - see Scenario 3)
7. Crew dispatched once for entire group
8. All child tickets resolved together

**Backend Flow (ticket-grouping.js):**
1. POST /api/tickets/group/create
2. Validates at least 2 tickets
3. Checks no ticket already in group
4. Generates GROUP-YYYYMMDD-XXXX ID
5. Creates master ticket record
6. Updates child tickets with parent_ticket_id
7. Sets visit_order for routing_batch groups

**Status Effects:**
- Master ticket: GROUP-XXXX (status inherited from first child)
- Child tickets: parent_ticket_id set
- All child tickets share same status

**Potential Issues:**
- 🔴 **CRITICAL BUG**: Cannot create service memo for grouped tickets (Scenario 3)
- 🔴 **CRITICAL BUG**: No automatic detection of similar incidents (manual only)
- 🔴 **CRITICAL BUG**: No service memo for group-level dispatch
- ⚠️ **BUG**: Group master ticket has no edit/ungroup button in UI
- ⚠️ **BUG**: Child tickets cannot be edited individually while grouped
- ⚠️ **BUG**: No way to add tickets to existing group
- ⚠️ **BUG**: Bulk SMS updates may not handle groups correctly

---

### Scenario 12: Service Memo Closure

**Frontend Flow:**
1. Crew completes repairs
2. Dispatcher closes service memo via "Close Memo" button
3. Selects resolution status (Restored/Unresolved/NoFaultFound/AccessDenied)
4. Adds resolution remarks
5. Optionally adds referred_to and accomplished_by
6. Ticket status changes to selected resolution
7. Consumer sees final status in track ticket
8. System logs all changes in history

**Backend Flow (service-memos.js PUT /api/service-memos/:id/close):**
1. Validates memo status is 'saved'
2. Updates memo_status to 'closed'
3. Updates ticket status to resolution status
4. Adds resolution remarks to ticket
5. Sets closed_at and closed_by
6. Logs action in history

**Status Effects:**
- Memo status: 'closed'
- Ticket status: Restored/Unresolved/NoFaultFound/AccessDenied
- Memo cannot be edited unless reopened

**Potential Issues:**
- ⚠️ **BUG**: Can only close memo if status is 'saved' (not 'deployed')
- ⚠️ **BUG**: No validation that ticket status matches memo status before closing
- ⚠️ **BUG**: Resolution remarks required but not validated for minimum length
- ⚠️ **BUG**: No way to close memo if ticket was already resolved via SMS
- ⚠️ **BUG**: Consumer SMS notification on close may not be sent

---

### Scenario 13: Consumer Shares Power Advisory Link

**Frontend Flow:**
1. Consumer views power interruption advisory
2. Clicks share button
3. System generates shareable link
4. Consumer shares link via social media
5. Others can view advisory with Open Graph tags

**Backend Flow (server.js):**
1. GET /advisory/:id or /poster/interruption/:id
2. Detects if request is from bot (Facebook, Twitter, etc.)
3. If bot: serves HTML with Open Graph tags
4. If human: redirects to frontend
5. Fetches advisory data from database
6. Generates OG tags with poster image URL

**Status Effects:**
- No status changes (read-only)

**Potential Issues:**
- ⚠️ **BUG**: No share button in UI (scenario mentions it but may not exist)
- ⚠️ **BUG**: Bot detection may miss some social media crawlers
- ⚠️ **BUG**: No caching of advisory data for bot requests (DB hit on every crawl)
- ⚠️ **BUG**: If poster image is missing, falls back to default (may be confusing)

---

### Scenario 14: User Creates Service Memo, Then Edits Ticket

**Frontend Flow:**
1. User creates service memo (ticket status → 'Ongoing', memo status → 'saved')
2. User navigates to ticket edit modal
3. User modifies ticket fields (name, phone, address, category, municipality, etc.)
4. User saves ticket changes

**Backend Flow (tickets.js PUT /api/tickets/:ticketId):**
1. Validates ticket is not a GROUP master
2. Validates ticket is not a child in a group
3. Checks concurrency control (expected_updated_at)
4. Updates ticket fields
5. **Auto-syncs category to service memo** if ticket has service_memo_id (line 751-756)
6. **Regenerates control number** if municipality changed and memo is not closed (line 761-779)
7. Logs ticket edit action
8. Commits transaction

**Status Effects:**
- Ticket: Updated with new values
- Service memo: Category synced, control number regenerated if municipality changed
- Memo status: Unchanged (remains 'saved' or 'deployed')
- Ticket status: Unchanged (remains 'Ongoing')

**Potential Issues:**
- ⚠️ **BUG**: No validation that ticket can be edited while memo is in certain states
- ⚠️ **BUG**: Can edit ticket fields that are supposed to be "snapshots" in memo (name, phone, address)
- ⚠️ **BUG**: Memo shows old customer data if ticket is edited (memo doesn't store customer data, it JOINs from ticket)
- ⚠️ **BUG**: No warning to user that editing ticket will affect linked service memo
- ⚠️ **BUG**: If municipality changes, control number regenerates even if memo is 'deployed' (should probably block this)

---

### Scenario 15: User Creates Service Memo, Changes Status to Resolved, Then Edits Ticket

**Frontend Flow:**
1. User creates service memo (ticket status → 'Ongoing', memo status → 'saved')
2. User closes memo with resolution (memo status → 'closed' or resolution status, ticket status → Restored/Unresolved/NoFaultFound/AccessDenied)
3. User navigates to ticket edit modal
4. User modifies ticket fields
5. User saves ticket changes

**Backend Flow:**
- Same as Scenario 14, but memo is now in 'closed' or resolution status
- Municipality change logic checks if memo_status is 'saved' or 'deployed' before regenerating control number (line 769)
- If memo is 'closed', control number will NOT be regenerated

**Status Effects:**
- Ticket: Updated with new values
- Service memo: Category synced (line 751-756 doesn't check memo status)
- Memo status: Unchanged (remains 'closed' or resolution status)
- Ticket status: May be changed by edit (no validation that it matches memo status)

**Potential Issues:**
- 🔴 **CRITICAL BUG**: Can edit ticket after memo is closed/resolved (should be blocked)
- 🔴 **CRITICAL BUG**: Category syncs to memo even if memo is closed (line 751-756 has no memo status check)
- 🔴 **CRITICAL BUG**: Ticket status can be changed to anything even if memo is resolved (no validation)
- 🔴 **CRITICAL BUG**: Data inconsistency: memo says "Restored" but ticket status changed to "Pending"
- ⚠️ **BUG**: No warning that editing resolved ticket will break audit trail
- ⚠️ **BUG**: Memo control number not regenerated if municipality changes (good for closed memos, but no user feedback)

---

### Scenario 16: User Edits Service Memo Instead of Ticket

**Frontend Flow:**
1. User creates service memo (ticket status → 'Ongoing', memo status → 'saved')
2. User opens service memo in 'update' mode
3. User modifies memo fields (received_by, intake date/time, referred_to, action_taken, etc.)
4. User saves memo changes

**Backend Flow (service-memos.js PUT /api/service-memos/:id):**
1. Validates user authentication
2. Fetches existing memo
3. Checks concurrency control (expected_updated_at)
4. Updates memo fields
5. Does NOT update ticket status
6. Logs memo update action
7. Commits transaction

**Status Effects:**
- Service memo: Updated with new values
- Memo status: Unchanged (remains 'saved' or 'deployed')
- Ticket status: Unchanged (remains 'Ongoing')
- Ticket fields: Unchanged

**Potential Issues:**
- ⚠️ **BUG**: Can edit memo even if ticket status doesn't match memo status
- ⚠️ **BUG**: Can edit memo even if ticket was already resolved via SMS
- ⚠️ **BUG**: No validation that memo status allows editing (can edit 'closed' memos via reopen, but not directly)
- ⚠️ **BUG**: Memo edit doesn't sync any changes back to ticket (one-way sync only from ticket to memo)

---

### Scenario 17: Service Memo Failing to Fetch Ticket Data

**Frontend Flow (ServiceMemoForm.jsx):**
1. User enters ticket ID in service memo create form
2. System debounces and calls `fetchTicketPreviewForMemo` (450ms delay)
3. System should auto-fill customer info from ticket
4. User reports that data is not being fetched

**Backend Flow (service-memos.js fetchTicketPreviewForMemo):**
- Frontend calls `/api/filtered-tickets` with `searchQuery` parameter (serviceMemosApi.js line 23)
- This is NOT a dedicated endpoint - it reuses the filtered tickets list API
- Endpoint returns array of tickets matching search
- Frontend filters for exact match if `exactMatchOnly: true`
- Returns first ticket if no exact match found

**Potential Issues:**
- 🔴 **CRITICAL BUG**: Using `/api/filtered-tickets` for single ticket lookup is inefficient (returns full list)
- 🔴 **CRITICAL BUG**: `/api/filtered-tickets` may require authentication headers that aren't being sent by axios
- 🔴 **CRITICAL BUG**: If ticket is grouped, the search may return GROUP master instead of child ticket
- 🔴 **CRITICAL BUG**: If ticket has `deleted_at` set, it won't appear in filtered-tickets results
- 🔴 **CRITICAL BUG**: If ticket is in a group, `parent_ticket_id` filter may exclude it depending on query params
- ⚠️ **BUG**: Debounce delay (450ms) may be too long, user thinks it's not working
- ⚠️ **BUG**: No error message shown to user if fetch fails (only sets `ticketLookupError`)
- ⚠️ **BUG**: No loading indicator during debounced fetch (only `ticketVerifyBusy` state)
- ⚠️ **BUG**: If `/api/filtered-tickets` returns multiple tickets, it picks the first one (may be wrong)

**Root Cause Analysis:**
The `fetchTicketPreviewForMemo` function in `serviceMemosApi.js` (line 16-46) uses axios to call `/api/filtered-tickets`. This endpoint:
1. Requires authentication (should use authHeaders but uses axios directly)
2. Returns paginated results (may not include the ticket if it's on page 2+)
3. Has complex filtering logic that may exclude certain tickets
4. Is designed for list views, not single ticket lookup

**Fix Needed:**
- Create dedicated endpoint `/api/tickets/:ticketId/preview` for service memo lookup
- Or ensure `/api/filtered-tickets` includes all tickets regardless of pagination
- Add proper authentication headers to axios call
- Add better error handling and user feedback

---

### Scenario 18: Crew Replacement (Crew 1 Dispatched, Crew 2 Replaces Due to Emergency)

**Real-World Scenario:**
- Dispatcher dispatches Crew 1 to a ticket
- Crew 1 experiences emergency (sickness, equipment failure, other urgent matter)
- Dispatcher needs to reassign ticket to Crew 2
- System should track this crew change for audit trail

**Current System Behavior:**
- Dispatch is done via `PUT /api/tickets/:ticketId/dispatch`
- Sets `assigned_crew` field on ticket
- Sets `dispatched_at` timestamp
- No history of previous crew assignments
- No "reassign" functionality - just overwrites `assigned_crew`

**Backend Flow (Current):**
1. Dispatcher clicks dispatch button
2. System updates `assigned_crew`, `eta`, `dispatch_notes`
3. System updates memo_status to 'deployed'
4. System sends SMS to consumer
5. If dispatcher dispatches again, it simply overwrites `assigned_crew`

**Current Issues:**
- 🔴 **MISSING FEATURE**: No crew change history/audit trail
- 🔴 **MISSING FEATURE**: No reason field for crew reassignment
- 🔴 **MISSING FEATURE**: No notification to original crew that they're being replaced
- 🔴 **MISSING FEATURE**: No notification to consumer about crew change
- ⚠️ **BUG**: Overwriting `assigned_crew` loses previous assignment data
- ⚠️ **BUG**: `dispatched_at` timestamp is updated (loses original dispatch time)

**Proposed Solution:**
1. Add `crew_assignments` table to track all crew changes:
   - `id`, `ticket_id`, `crew_name`, `assigned_at`, `replaced_at`, `replacement_reason`, `replaced_by`
2. Add "Reassign Crew" button in UI (separate from "Dispatch")
3. Require reason for crew reassignment (emergency, unavailable, etc.)
4. Send SMS to consumer about crew change
5. Send notification to original crew (if they have app access)
6. Keep original `dispatched_at` for SLA tracking, add `reassigned_at` for new assignment

**Status Effects:**
- Ticket status: Remains 'Ongoing'
- Memo status: Remains 'deployed'
- Assigned crew: Changes to new crew
- Audit trail: New entry in crew_assignments table

---

### Scenario 19: Issue Type Mismatch (User Reports Sagging Wire, Linemen Find Leaning Pole)

**Real-World Scenario:**
- Consumer reports "sagging wire" via ticket
- Dispatcher creates service memo with category "Sagging Wire"
- Crew arrives on-site and finds actual issue is "leaning pole"
- Crew needs to update the issue type to match reality
- System should track this change for analytics

**Current System Behavior:**
- Ticket has `category` field
- Service memo has `category` field (synced from ticket)
- Category can be edited on ticket (syncs to memo)
- No "actual issue found" field separate from reported issue
- No history of category changes

**Backend Flow (Current):**
1. User edits ticket category
2. System syncs category to service memo (line 751-756 in tickets.js)
3. No separate tracking of "reported category" vs "actual category"
4. No audit trail of category changes

**Current Issues:**
- 🔴 **MISSING FEATURE**: No separation between "reported category" and "actual category"
- 🔴 **MISSING FEATURE**: No field for "lineman findings" or "actual issue on-site"
- 🔴 **MISSING FEATURE**: No audit trail of category changes
- ⚠️ **BUG**: Editing category changes both reported and actual (loses original report)
- ⚠️ **BUG**: No way to track accuracy of consumer reports (analytics)

**Proposed Solution:**
1. Add `reported_category` field (immutable after creation)
2. Add `actual_category` field (updatable by crew/dispatcher)
3. Add `category_change_reason` field (why category was changed)
4. Add `lineman_findings` field (free text for on-site observations)
5. Audit trail for category changes
6. Analytics dashboard to track report accuracy

**Status Effects:**
- Ticket status: Unchanged
- Memo status: Unchanged
- Category: Updated to actual issue
- Audit trail: New entry showing category change

---

### Scenario 20: Add Channel/Source Field to Tickets

**Real-World Scenario:**
- Tickets come from various channels: Messenger, SMS, Phone Call, Email, Facebook, Walk-in
- Dispatcher needs to know where the ticket originated
- Analytics needed to track which channels are most used
- Some channels may have different SLA requirements

**Current System Behavior:**
- No `channel` or `source` field in tickets table
- No way to track ticket origin
- All tickets treated the same regardless of source

**Backend Flow (Current):**
- Ticket submission (POST /api/tickets/submit) does not capture channel
- Manual ticket creation (via admin) does not capture channel
- No field in database for this

**Current Issues:**
- 🔴 **MISSING FEATURE**: No channel/source field in tickets table
- 🔴 **MISSING FEATURE**: No way to categorize manual tickets by origin
- 🔴 **MISSING FEATURE**: No analytics on ticket sources
- 🔴 **MISSING FEATURE**: No channel-specific SLA tracking
- ⚠️ **BUG**: Cannot track which channels are most effective

**Proposed Solution:**
1. Add `channel` field to `aleco_tickets` table:
   - Values: 'web_form', 'messenger', 'sms', 'phone_call', 'email', 'facebook', 'walk_in', 'other'
2. Add channel dropdown to public report form (auto-detect where possible)
3. Add channel dropdown to admin ticket creation
4. Add channel filter to ticket list view
5. Add channel analytics to dashboard
6. For SMS tickets, auto-set channel to 'sms'
7. For web form, auto-set channel to 'web_form'

**Database Migration Needed:**
```sql
ALTER TABLE aleco_tickets ADD COLUMN channel VARCHAR(50) DEFAULT 'web_form';
ALTER TABLE aleco_tickets ADD INDEX idx_channel (channel);
```

**Status Effects:**
- Ticket status: Unchanged
- New field: `channel` stored with ticket
- Analytics: Can now track ticket sources

---

### Scenario 21: Changing Status in Both Ticket and Service Memo

**Real-World Scenario:**
- Dispatcher changes ticket status directly (e.g., from Ongoing to Restored)
- Dispatcher also changes service memo status (e.g., from deployed to closed)
- System needs to handle these changes consistently
- What happens if they conflict?

**Current System Behavior:**
- Ticket status change via `PUT /api/tickets/:ticketId/status`
- Memo status change via `PUT /api/service-memos/:id/close` or reopen
- No automatic sync between ticket and memo status
- Can have inconsistent states (ticket: Restored, memo: saved)

**Backend Flow (Ticket Status Change):**
1. Dispatcher changes ticket status via status update
2. System updates `aleco_tickets.status`
3. System logs action in history
4. **Does NOT update memo status**

**Backend Flow (Memo Status Change):**
1. Dispatcher closes memo via close endpoint
2. System updates `aleco_service_memos.memo_status` to 'closed'
3. System updates `aleco_tickets.status` to resolution status
4. System logs action in history

**Current Issues:**
- 🔴 **CRITICAL BUG**: Ticket status change does NOT update memo status
- 🔴 **CRITICAL BUG**: Can have inconsistent states (ticket: Restored, memo: saved)
- 🔴 **CRITICAL BUG**: No validation that ticket status matches memo status
- 🔴 **CRITICAL BUG**: Memo close updates ticket, but ticket status change doesn't update memo (one-way sync)
- ⚠️ **BUG**: No warning when statuses are inconsistent
- ⚠️ **BUG**: User can close memo even if ticket status doesn't match

**Proposed Solution:**
1. Add bidirectional sync between ticket and memo status
2. When ticket status changes to resolution, auto-update memo to matching status
3. When memo status changes, auto-update ticket status
4. Add validation to prevent inconsistent states
5. Add warning in UI if statuses are inconsistent
6. Add "Sync Status" button to force alignment

**Status Effects (Current):**
- Ticket status change: Memo status unchanged (INCONSISTENT)
- Memo status change: Ticket status updated (CONSISTENT)

**Status Effects (Proposed):**
- Ticket status change: Memo status auto-synced (CONSISTENT)
- Memo status change: Ticket status auto-synced (CONSISTENT)

---

### Scenario 22: Complete Status Change Audit - Service Memo States

**Service Memo Status Values:**
- `saved` - Initial state when memo is created
- `deployed` - When ticket is dispatched (crew assigned)
- `closed` - When memo is finalized with resolution
- `resolved` - Resolution status (maps to ticket 'Restored')
- `unresolved` - Resolution status (maps to ticket 'Unresolved')
- `nofaultfound` - Resolution status (maps to ticket 'NoFaultFound')
- `accessdenied` - Resolution status (maps to ticket 'AccessDenied')

**Service Memo Status: 'saved'**

**How it gets to 'saved':**
1. Created via POST /api/service-memos (line 480 in service-memos.js)
2. Reopened via PUT /api/service-memos/:id/reopen (line 701 in service-memos.js)

**What happens when memo is 'saved':**
- Memo is editable
- Dispatch button is visible (canStartResolution = true)
- Close button is visible
- Reopen button is hidden
- Ticket status is typically 'Ongoing' (but not enforced)
- No closed_at or closed_by values

**Backend operations allowed:**
- Update memo fields (PUT /api/service-memos/:id)
- Close memo (PUT /api/service-memos/:id/close)
- Delete memo (DELETE /api/service-memos/:id)
- Undo memo (DELETE /api/service-memos/:id/undo)

**Potential Issues:**
- ⚠️ **BUG**: No validation that ticket status matches memo status
- ⚠️ **BUG**: Can be 'saved' while ticket is 'Restored' (inconsistent)

---

**Service Memo Status: 'deployed'**

**How it gets to 'deployed':**
1. Ticket dispatched via PUT /api/tickets/:ticketId/dispatch (line 1021-1025 in tickets.js)
   - Updates memo_status to 'deployed' if it was 'saved'
   - Only updates if memo_status is 'saved' (condition: `AND memo_status = 'saved'`)

**What happens when memo is 'deployed':**
- Memo is editable
- Dispatch button is visible (canStartResolution = true)
- Close button is visible
- Reopen button is hidden
- Ticket status is 'Ongoing'
- Crew is assigned to ticket
- dispatched_at timestamp is set on ticket

**Backend operations allowed:**
- Update memo fields (PUT /api/service-memos/:id)
- Close memo (PUT /api/service-memos/:id/close) - **BUT THIS FAILS** (see below)
- Delete memo (DELETE /api/service-memos/:id)
- Undo memo (DELETE /api/service-memos/:id/undo)

**Potential Issues:**
- 🔴 **CRITICAL BUG**: Close memo endpoint requires memo_status = 'saved' (line 755-757 in service-memos.js)
- 🔴 **CRITICAL BUG**: Cannot close memo if it's 'deployed' - must reopen to 'saved' first
- 🔴 **CRITICAL BUG**: No validation that crew is assigned when memo is 'deployed'
- ⚠️ **BUG**: Can be 'deployed' while ticket is not 'Ongoing' (inconsistent)

---

**Service Memo Status: 'closed'**

**How it gets to 'closed':**
1. Memo closed via PUT /api/service-memos/:id/close (line 763 in service-memos.js)
   - Only works if memo_status is 'saved' (line 755-757)
   - Sets closed_at = NOW()
   - Sets closed_by = user name
   - **Does NOT update ticket status** (missing sync)

**What happens when memo is 'closed':**
- Memo is NOT editable (must reopen first)
- Dispatch button is hidden (canStartResolution = false)
- Close button is hidden
- Reopen button is visible
- closed_at and closed_by are set
- Ticket status should be resolution status (but not enforced)

**Backend operations allowed:**
- Reopen memo (PUT /api/service-memos/:id/reopen)
- Delete memo (DELETE /api/service-memos/:id)

**Potential Issues:**
- 🔴 **CRITICAL BUG**: Close endpoint doesn't update ticket status to resolution
- 🔴 **CRITICAL BUG**: Can only close if memo is 'saved' (not 'deployed')
- 🔴 **CRITICAL BUG**: No validation that ticket status matches resolution
- ⚠️ **BUG**: closed_at and closed_by are not cleared on reopen (line 701 clears them)

---

**Service Memo Status: 'resolved' / 'unresolved' / 'nofaultfound' / 'accessdenied'**

**How it gets to these statuses:**
- **NOT IMPLEMENTED** - These statuses are mentioned in code but never set
- The close endpoint only sets memo_status to 'closed' (line 763)
- These statuses appear in the dispatch button condition (line 512 in ServiceMemoForm.jsx)
- These statuses appear in the frontend but not in backend

**What happens when memo has these statuses:**
- Memo is NOT editable
- Dispatch button is hidden (canStartResolution = false)
- Close button is hidden
- Reopen button is visible

**Backend operations allowed:**
- Reopen memo (PUT /api/service-memos/:id/reopen) - sets to 'saved'
- Delete memo (DELETE /api/service-memos/:id)

**Potential Issues:**
- 🔴 **CRITICAL BUG**: These statuses are never set by backend
- 🔴 **CRITICAL BUG**: Memo status never matches ticket resolution status
- 🔴 **CRITICAL BUG**: No way to distinguish between different resolution types in memo
- ⚠️ **BUG**: Frontend checks for these statuses but backend never sets them

---

### Scenario 23: Complete Status Change Audit - Ticket States

**Ticket Status Values:**
- `Pending` - Initial state when ticket is created
- `Ongoing` - When service memo is created or ticket is dispatched
- `Restored` - Issue resolved successfully
- `Unresolved` - Issue could not be resolved
- `NoFaultFound` - No issue found on-site
- `AccessDenied` - Crew could not access location

**Ticket Status: 'Pending'**

**How it gets to 'Pending':**
1. Created via POST /api/tickets/submit (default status)
2. Reverted via DELETE /api/service-memos/:id/undo (line 887 in service-memos.js)

**What happens when ticket is 'Pending':**
- No service memo linked (service_memo_id = NULL)
- No crew assigned
- No dispatched_at timestamp
- Can be edited
- Can have service memo created

**Backend operations allowed:**
- Edit ticket (PUT /api/tickets/:ticketId)
- Create service memo (POST /api/service-memos)
- Update status to 'Ongoing' (via dispatch or manual)

**Potential Issues:**
- ⚠️ **BUG**: No validation that service_memo_id is NULL when status is 'Pending'

---

**Ticket Status: 'Ongoing'**

**How it gets to 'Ongoing':**
1. Service memo created (line 498 in service-memos.js) - forces status to 'Ongoing'
2. Ticket dispatched (line 1027 in tickets.js) - sets status to 'Ongoing'
3. Manual status update (PUT /api/tickets/:ticketId/status)

**What happens when ticket is 'Ongoing':**
- Service memo is linked (service_memo_id is set)
- Crew may be assigned
- dispatched_at may be set
- Memo status should be 'saved' or 'deployed' (but not enforced)
- Can be edited
- Can be dispatched
- Can be resolved

**Backend operations allowed:**
- Edit ticket (PUT /api/tickets/:ticketId)
- Dispatch (PUT /api/tickets/:ticketId/dispatch)
- Update status to resolution (via SMS or manual)
- Close service memo (PUT /api/service-memos/:id/close)

**Potential Issues:**
- 🔴 **CRITICAL BUG**: Service memo creation forces status to 'Ongoing' even if already resolved
- 🔴 **CRITICAL BUG**: No validation that memo status matches 'Ongoing'
- ⚠️ **BUG**: Can be 'Ongoing' without service memo (manual status change)
- ⚠️ **BUG**: Can be 'Ongoing' without crew assigned

---

**Ticket Status: 'Restored'**

**How it gets to 'Restored':**
1. SMS keyword "fixed" (line 1494 in tickets.js)
2. Bulk SMS "all fixed" (line 1230 in tickets.js)
3. Manual status update (PUT /api/tickets/:ticketId/status)
4. **NOT** via service memo close (missing sync)

**What happens when ticket is 'Restored':**
- Issue is resolved
- Consumer should receive SMS notification
- Memo status should be 'resolved' or 'closed' (but not enforced)
- Service memo is still linked
- Crew assignment is kept

**Backend operations allowed:**
- Edit ticket (PUT /api/tickets/:ticketId) - **SHOULD BE BLOCKED**
- Update status back to 'Ongoing' (manual)
- Reopen service memo (PUT /api/service-memos/:id/reopen)

**Potential Issues:**
- 🔴 **CRITICAL BUG**: Memo status is NOT updated to 'resolved' or 'closed'
- 🔴 **CRITICAL BUG**: Can edit ticket even though it's resolved (should be blocked)
- 🔴 **CRITICAL BUG**: No validation that memo status matches 'Restored'
- ⚠️ **BUG**: Service memo close doesn't set ticket to 'Restored'
- ⚠️ **BUG**: Can have inconsistent states (ticket: Restored, memo: saved)

---

**Ticket Status: 'Unresolved'**

**How it gets to 'Unresolved':**
1. SMS keyword "unfixed" (line 1359 in tickets.js)
2. Bulk SMS "all unfixed" (line 1230 in tickets.js)
3. Manual status update (PUT /api/tickets/:ticketId/status)

**What happens when ticket is 'Unresolved':**
- Issue could not be resolved
- Consumer should receive SMS notification
- Memo status should be 'unresolved' or 'closed' (but not enforced)
- Service memo is still linked
- Crew assignment is kept

**Backend operations allowed:**
- Edit ticket (PUT /api/tickets/:ticketId) - **SHOULD BE BLOCKED**
- Update status back to 'Ongoing' (manual)
- Reopen service memo (PUT /api/service-memos/:id/reopen)

**Potential Issues:**
- 🔴 **CRITICAL BUG**: Memo status is NOT updated to 'unresolved' or 'closed'
- 🔴 **CRITICAL BUG**: Can edit ticket even though it's unresolved (should be blocked)
- 🔴 **CRITICAL BUG**: No validation that memo status matches 'Unresolved'
- ⚠️ **BUG**: Service memo close doesn't set ticket to 'Unresolved'
- ⚠️ **BUG**: Can have inconsistent states (ticket: Unresolved, memo: saved)

---

**Ticket Status: 'NoFaultFound'**

**How it gets to 'NoFaultFound':**
1. SMS keyword "nofault" (line 1390 in tickets.js)
2. Bulk SMS "all nofault" (line 1230 in tickets.js)
3. Manual status update (PUT /api/tickets/:ticketId/status)

**What happens when ticket is 'NoFaultFound':**
- No issue found on-site
- Consumer should receive SMS notification
- Memo status should be 'nofaultfound' or 'closed' (but not enforced)
- Service memo is still linked
- Crew assignment is kept

**Backend operations allowed:**
- Edit ticket (PUT /api/tickets/:ticketId) - **SHOULD BE BLOCKED**
- Update status back to 'Ongoing' (manual)
- Reopen service memo (PUT /api/service-memos/:id/reopen)

**Potential Issues:**
- 🔴 **CRITICAL BUG**: Memo status is NOT updated to 'nofaultfound' or 'closed'
- 🔴 **CRITICAL BUG**: Can edit ticket even though it's resolved (should be blocked)
- 🔴 **CRITICAL BUG**: No validation that memo status matches 'NoFaultFound'
- ⚠️ **BUG**: Service memo close doesn't set ticket to 'NoFaultFound'
- ⚠️ **BUG**: Can have inconsistent states (ticket: NoFaultFound, memo: saved)

---

**Ticket Status: 'AccessDenied'**

**How it gets to 'AccessDenied':**
1. SMS keyword "nores" (line 1422 in tickets.js)
2. Bulk SMS "all nores" (line 1230 in tickets.js)
3. Manual status update (PUT /api/tickets/:ticketId/status)

**What happens when ticket is 'AccessDenied':**
- Crew could not access location
- Consumer should receive SMS notification
- Memo status should be 'accessdenied' or 'closed' (but not enforced)
- Service memo is still linked
- Crew assignment is kept

**Backend operations allowed:**
- Edit ticket (PUT /api/tickets/:ticketId) - **SHOULD BE BLOCKED**
- Update status back to 'Ongoing' (manual)
- Reopen service memo (PUT /api/service-memos/:id/reopen)

**Potential Issues:**
- 🔴 **CRITICAL BUG**: Memo status is NOT updated to 'accessdenied' or 'closed'
- 🔴 **CRITICAL BUG**: Can edit ticket even though it's resolved (should be blocked)
- 🔴 **CRITICAL BUG**: No validation that memo status matches 'AccessDenied'
- ⚠️ **BUG**: Service memo close doesn't set ticket to 'AccessDenied'
- ⚠️ **BUG**: Can have inconsistent states (ticket: AccessDenied, memo: saved)

---

### Scenario 24: Status Change Matrix - What Actually Happens

| Action | Ticket Status | Memo Status | Synced? | Issues |
|--------|--------------|-------------|---------|---------|
| Create service memo | Forced to 'Ongoing' | Set to 'saved' | YES (ticket→memo) | Forces ticket even if already resolved |
| Dispatch ticket | Set to 'Ongoing' | Set to 'deployed' (if was 'saved') | YES (ticket→memo) | Only updates if memo was 'saved' |
| Close memo | No change | Set to 'closed' | NO (memo→ticket missing) | Should update ticket to resolution |
| Reopen memo | No change | Set to 'saved' | NO (memo→ticket missing) | Should update ticket to 'Ongoing' |
| SMS "fixed" | Set to 'Restored' | No change | NO (ticket→memo missing) | Memo should be 'resolved' |
| SMS "unfixed" | Set to 'Unresolved' | No change | NO (ticket→memo missing) | Memo should be 'unresolved' |
| SMS "nofault" | Set to 'NoFaultFound' | No change | NO (ticket→memo missing) | Memo should be 'nofaultfound' |
| SMS "nores" | Set to 'AccessDenied' | No change | NO (ticket→memo missing) | Memo should be 'accessdenied' |
| Manual ticket status change | Set to new status | No change | NO (ticket→memo missing) | Memo should sync |
| Edit ticket (category) | No change | Category synced | YES (ticket→memo) | Syncs even if memo is closed |
| Edit ticket (municipality) | No change | Control number regenerated | YES (ticket→memo) | Only if memo is 'saved' or 'deployed' |

**Critical Findings:**
1. **One-way sync**: Ticket changes sync to memo, but memo changes don't sync to ticket
2. **SMS resolution**: Ticket status changes via SMS don't update memo status
3. **Memo close**: Doesn't update ticket status (should set to resolution)
4. **Memo reopen**: Doesn't update ticket status (should set to 'Ongoing')
5. **Deployed memo**: Cannot be closed (must reopen to 'saved' first)
6. **Resolution statuses**: Memo never uses 'resolved/unresolved/nofaultfound/accessdenied' - only 'closed'

---

### Clarification: Purpose of 'saved' Status

**What 'saved' means:**
Yes, you're correct. The 'saved' status is the initial state when a service memo is first created. It indicates:
- Memo has been created and saved to database
- Memo is editable
- Memo has not yet been dispatched to a crew
- Memo has not yet been closed/finalized
- Dispatch button is visible (can start resolution)

**Status Flow:**
```
Created → saved → deployed → closed
                ↑
                |
          (can reopen to saved)
```

**'saved' is NOT:**
- A temporary draft (it's permanently saved)
- A "pending approval" state
- A "needs review" state
- A "waiting for something" state

**Current Issues with 'saved':**
- ⚠️ **BUG**: Can be 'saved' while ticket is already resolved (inconsistent)
- ⚠️ **BUG**: No validation that ticket status is appropriate for 'saved' memo
- ⚠️ **BUG**: Can stay 'saved' indefinitely (no timeout or stale check)

---

### Scenario 25: Child Service Memos (Linemen Find Additional Issues)

**Real-World Scenario:**
- Consumer reports "fluctuating voltage"
- Dispatcher creates service memo with category "Fluctuating Voltage"
- Crew arrives on-site and finds: fluctuating voltage + cut off live wire
- Crew needs to report both issues accurately
- System should allow child service memos under parent memo

**Current System Behavior:**
- No concept of child/parent service memos
- Each ticket can only have ONE service memo (service_memo_id is single field)
- No way to report multiple issues from single site visit
- Linemen must either:
  1. Edit the original memo (loses original report)
  2. Create new ticket for additional issue (breaks audit trail)
  3. Ignore additional issue (inaccurate reporting)

**Backend Flow (Current):**
- `aleco_tickets.service_memo_id` is a single field (not an array)
- `aleco_service_memos` has no `parent_memo_id` field
- No relationship table for memo hierarchy
- No validation to prevent multiple memos per ticket (but API blocks it)

**Current Issues:**
- 🔴 **MISSING FEATURE**: No child/parent service memo relationship
- 🔴 **MISSING FEATURE**: No way to report multiple issues from single visit
- 🔴 **MISSING FEATURE**: No audit trail of discovered issues vs reported issues
- 🔴 **MISSING FEATURE**: Cannot track "issue discovery" process
- ⚠️ **BUG**: One ticket = one memo constraint prevents accurate reporting
- ⚠️ **BUG**: No way to link multiple memos to same ticket

**Proposed Solution:**
1. Add `parent_memo_id` field to `aleco_service_memos` table
2. Allow multiple service memos per ticket (remove service_memo_id uniqueness constraint)
3. Add memo_type field: 'primary' (original) vs 'discovered' (child)
4. Add "Add Child Memo" button in service memo UI
5. Child memos should:
   - Link to same ticket
   - Link to parent memo
   - Have own category (actual discovered issue)
   - Have own resolution details
   - Share crew assignment with parent
6. Audit trail should show parent→child relationship
7. Analytics should track "reported vs discovered" issue accuracy

**Database Migration Needed:**
```sql
ALTER TABLE aleco_service_memos ADD COLUMN parent_memo_id INT NULL;
ALTER TABLE aleco_service_memos ADD COLUMN memo_type ENUM('primary', 'discovered') DEFAULT 'primary';
ALTER TABLE aleco_service_memos ADD INDEX idx_parent_memo (parent_memo_id);
ALTER TABLE aleco_service_memos ADD INDEX idx_memo_type (memo_type);
```

**Status Effects:**
- Parent memo: Can be 'saved', 'deployed', or 'closed'
- Child memo: Inherits parent's status initially, can be closed independently
- Ticket: Linked to primary memo (service_memo_id), child memos linked via parent_memo_id

**Example Flow:**
1. Consumer reports "fluctuating voltage"
2. Dispatcher creates primary memo (category: "Fluctuating Voltage", memo_type: 'primary')
3. Crew dispatched, arrives on-site
4. Crew discovers "cut off live wire"
5. Crew clicks "Add Child Memo" in UI
6. Child memo created (category: "Cut Off Live Wire", memo_type: 'discovered', parent_memo_id: primary memo ID)
7. Both issues tracked accurately
8. Both memos can be closed independently or together

---

### Scenario 26: Action Taken Field - Unprofessional Input

**Real-World Scenario:**
- Consumer enters "fix" in action desired field
- Dispatcher creates service memo with action_taken = "fix"
- Linemen completes work (e.g., replaced transformer, repaired wire, etc.)
- Current system only allows free text input for action_taken
- Result: Unprofessional, non-specific, inaccurate reporting

**Current System Behavior:**
- `action_taken` field is free text (no validation, no dropdown)
- Users can enter anything: "fix", "done", "ok", etc.
- No predefined list of professional action types
- No way to enforce standard terminology
- Analytics cannot group by action type (too many variations)

**Backend Flow (Current):**
- `action_taken` stored as plain text in `aleco_service_memos` table
- No validation on input
- No enum or check constraint
- No reference table for action types

**Current Issues:**
- 🔴 **MISSING FEATURE**: No predefined action types dropdown
- 🔴 **MISSING FEATURE**: No validation of action_taken input
- 🔴 **MISSING FEATURE**: No way to enforce professional terminology
- 🔴 **MISSING FEATURE**: Analytics cannot group by action type
- ⚠️ **BUG**: Free text allows unprofessional input
- ⚠️ **BUG**: No way to track common actions (e.g., "replaced transformer" vs "fixed")

**Proposed Solution:**
1. Create `action_types` reference table:
   - `id`, `name`, `description`, `category`
   - Examples: "Replaced Transformer", "Repaired Wire", "Replaced Fuse", "Reset Breaker", "Installed Pole", etc.
2. Add `action_type_id` field to `aleco_service_memos` (foreign key to action_types)
3. Keep `action_taken` as free text for additional details (optional)
4. Add dropdown in service memo UI for action type selection
5. Add "Other" option with free text input for custom actions
6. Analytics can now group by action_type_id
7. Reports can show most common actions taken

**Database Migration Needed:**
```sql
CREATE TABLE action_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE aleco_service_memos ADD COLUMN action_type_id INT NULL;
ALTER TABLE aleco_service_memos ADD INDEX idx_action_type (action_type_id);
ALTER TABLE aleco_service_memos ADD CONSTRAINT fk_action_type FOREIGN KEY (action_type_id) REFERENCES action_types(id);
```

**Initial Action Types Data:**
```sql
INSERT INTO action_types (name, description, category) VALUES
('Replaced Transformer', 'Replaced faulty transformer with new unit', 'Equipment'),
('Repaired Wire', 'Repaired damaged wire connection', 'Wiring'),
('Replaced Fuse', 'Replaced blown fuse', 'Equipment'),
('Reset Breaker', 'Reset tripped circuit breaker', 'Equipment'),
('Installed Pole', 'Installed new utility pole', 'Infrastructure'),
('Repaired Meter', 'Repaired or replaced electric meter', 'Meter'),
('Trimmed Trees', 'Trimmed trees interfering with lines', 'Vegetation'),
('Replaced Service Drop', 'Replaced service drop wire to consumer', 'Wiring'),
('Tightened Connections', 'Tightened loose electrical connections', 'Maintenance'),
('Replaced Insulator', 'Replaced damaged insulator', 'Equipment');
```

**Status Effects:**
- No status changes
- New field: `action_type_id` stored with memo
- Better analytics and reporting

**UI Changes:**
- Replace free text input with dropdown
- Add "Other" option with free text for custom actions
- Show action type name in memo list view
- Filter memos by action type in analytics

**Example Flow:**
1. Consumer enters "fix" in action desired (ignored, just for context)
2. Dispatcher creates service memo
3. Dispatcher selects "Replaced Transformer" from action type dropdown
4. Dispatcher optionally adds details: "Replaced 25kVA transformer, old unit had internal fault"
5. Memo saved with professional action type
6. Analytics can now report: "Replaced Transformer: 45 cases this month"

---

### Scenario 27: Additional Real-Life Scenarios to Consider

Based on the audit above, here are additional real-life scenarios the system should handle:

**27.1 Duplicate Tickets from Same Consumer**
- Consumer submits multiple tickets for same issue (impatient, thinks first was lost)
- System should detect and merge duplicates
- Current: Duplicate check only within 5 minutes, phone + category + concern
- Missing: No way to merge existing duplicates, no consumer notification about duplicate

**27.2 Ticket Escalation**
- Dispatcher escalates ticket to supervisor/manager for approval
- Urgent or complex issues need higher-level review
- Current: No escalation workflow, no approval process
- Missing: Escalation status, approval workflow, escalation history

**27.3 Partial Resolution / Follow-up Required**
- Crew fixes part of issue but needs to return later (e.g., waiting for materials)
- Ticket status should reflect "partially resolved" or "follow-up needed"
- Current: No intermediate status between Ongoing and Resolved
- Missing: "Partially Resolved" status, follow-up date tracking, return visit scheduling

**27.4 Issue Recurrence (Follow-up Tickets)**
- Same consumer reports same issue after resolution
- System should link to previous ticket for history
- Current: No linkage between related tickets
- Missing: "related_ticket_id" field, recurrence tracking, pattern detection

**27.5 Emergency vs Routine Priority**
- Urgent issues (life-threatening, major outage) need faster SLA
- Routine issues can wait longer
- Current: is_urgent flag exists but no SLA enforcement
- Missing: Priority levels, SLA tracking per priority, automatic escalation for overdue urgent tickets

**27.6 Material Shortage**
- Crew can't complete work due to lack of materials
- Need to track material requests and delays
- Current: No material tracking, no delay reason field
- Missing: Material inventory, material request workflow, delay reason tracking

**27.7 Weather Delays**
- Work delayed due to weather conditions (typhoon, heavy rain)
- Need to track weather-related delays
- Current: No delay tracking, no weather integration
- Missing: Delay reason field, weather API integration, automatic delay logging

**27.8 Consumer Not Available**
- Crew arrives but consumer not home (locked gate, no one present)
- Need to reschedule or leave notice
- Current: No way to track "consumer unavailable" status
- Missing: "Consumer Unavailable" status, rescheduling workflow, notice leaving

**27.9 Multiple Consumers at Same Location**
- Apartment building, subdivision with multiple affected consumers
- Single location, multiple tickets
- Current: Grouping exists but may not handle this well
- Missing: Location-based ticket grouping, bulk notification for same location

**27.10 Service Transfer (Municipality/District Change)**
- Ticket needs to be transferred to different municipality/district
- Wrong municipality selected, or boundary issue
- Current: Municipality can be edited but no transfer workflow
- Missing: Transfer reason, transfer history, notification to receiving dispatcher

**27.11 Photo Evidence Requirements**
- Before/after photos mandatory for certain issue types
- Proof of work completion
- Current: Photo upload exists but not mandatory
- Missing: Required photo per category, photo validation, before/after photo pairing

**27.12 Work Completion Confirmation**
- Consumer signs off on work done (digital signature or confirmation)
- Prevents disputes about work quality
- Current: No consumer confirmation workflow
- Missing: Consumer confirmation SMS/app, digital signature, confirmation history

**27.13 ETA Accuracy Tracking**
- Track estimated time vs actual completion time
- Improve future ETA predictions
- Current: ETA field exists but no accuracy tracking
- Missing: ETA vs actual time comparison, accuracy metrics, predictive ETA

**27.14 Crew Availability Conflicts**
- Crew overbooked or unavailable (sick leave, training)
- Need to reassign or reschedule
- Current: No crew availability tracking, no conflict detection
- Missing: Crew calendar, availability status, conflict detection, auto-reschedule

**27.15 Ticket Priority Changes**
- Urgent ticket becomes less urgent (e.g., power restored in area)
- Routine ticket becomes urgent (e.g., safety hazard discovered)
- Current: Priority can be edited but no audit trail
- Missing: Priority change history, automatic priority escalation, priority notification

**27.16 Consumer Feedback/Rating**
- Consumer rates service quality after resolution
- Track crew performance
- Current: No feedback system
- Missing: Rating system, feedback form, crew performance metrics

**27.17 Material Usage Tracking**
- Track materials used for each job (transformers, wire, poles, etc.)
- Inventory management
- Current: No material tracking
- Missing: Material inventory, material usage per memo, low stock alerts

**27.18 Safety Incidents**
- Crew reports safety issue on-site (downed line, hazardous condition)
- Immediate attention required
- Current: No safety incident reporting
- Missing: Safety incident status, immediate escalation, safety incident log

**27.19 Power Restoration Verification**
- Confirm power is actually restored before closing ticket
- May require consumer confirmation or meter reading
- Current: No verification step
- Missing: Restoration verification, consumer confirmation, meter reading upload

**27.20 Bulk Operations for Same Consumer**
- Consumer has multiple tickets (e.g., multiple issues at same property)
- Need to resolve all together
- Current: No bulk operations per consumer
- Missing: Consumer-based grouping, bulk close for same consumer, consumer history view

**27.21 Scheduled Maintenance vs Emergency**
- Distinguish between planned maintenance and emergency repairs
- Different workflows and SLA
- Current: No maintenance scheduling
- Missing: Maintenance calendar, scheduled work vs emergency, preventive maintenance tracking

**27.22 Third-Party Coordination**
- Need to coordinate with other utilities (water, telecom) or government agencies
- Multi-party resolution
- Current: No third-party tracking
- Missing: External party field, coordination notes, external party status

**27.23 Equipment Failure Tracking**
- Track equipment failures (transformers, poles, meters)
- Predictive maintenance
- Current: No equipment tracking
- Missing: Equipment inventory, failure logging, replacement tracking, predictive maintenance alerts

**27.24 Consumer Communication Preferences**
- Some consumers prefer SMS, others prefer call, others prefer app notification
- Respect communication preferences
- Current: Only SMS used
- Missing: Communication preference field, multi-channel notification, opt-out management

**27.25 Time-of-Day Restrictions**
- Some areas have restrictions on work hours (noise ordinances, access restrictions)
- Schedule work accordingly
- Current: No time restrictions
- Missing: Time restriction rules, scheduling validation, after-hours work tracking

**27.26 Seasonal Pattern Analysis**
- Certain issues more common in certain seasons (e.g., storms in rainy season)
- Resource planning
- Current: No seasonal analysis
- Missing: Seasonal analytics, resource forecasting, pattern detection

**27.27 Anonymous vs Identified Consumers**
- Some consumers want anonymity, others provide full details
- Privacy considerations
- Current: All consumers must provide details
- Missing: Anonymous reporting option, privacy settings, data retention policies

**27.28 Mobile Crew App**
- Crew needs mobile app for on-site updates
- Current: Crew uses same admin dashboard (not mobile-optimized)
- Missing: Mobile crew app, offline support, GPS check-in, photo upload from mobile

**27.29 Offline Mode for Field Crews**
- Areas with poor connectivity need offline capability
- Sync when connection restored
- Current: No offline support
- Missing: Offline data storage, sync queue, conflict resolution for offline edits

**27.30 Audit Trail Completeness**
- Every action should be logged for accountability
- Current: Some actions logged, but not comprehensive
- Missing: Complete audit trail, immutable logs, log export for compliance

---

### Scenario 28: Deletion and Undo Scenarios

**28.1 Delete Ticket with Service Memo**

**Real-World Scenario:**
- Dispatcher accidentally creates wrong ticket
- Dispatcher deletes ticket
- Service memo is linked to deleted ticket
- What happens to the service memo?

**Current System Behavior:**
- Ticket deletion via DELETE /api/tickets/:ticketId
- Service memo has service_memo_id foreign key
- No cascade delete configured
- Soft delete (deleted_at timestamp) used

**Backend Flow:**
1. Dispatcher deletes ticket
2. System sets deleted_at = NOW()
3. Service memo still exists with service_memo_id pointing to deleted ticket
4. Service memo becomes orphaned

**Current Issues:**
- 🔴 **CRITICAL BUG**: Orphaned service memos when ticket deleted
- 🔴 **CRITICAL BUG**: No cascade delete or nullification of service_memo_id
- 🔴 **CRITICAL BUG**: Service memo list may show memos for deleted tickets
- ⚠️ **BUG**: No warning that deleting ticket will orphan service memo
- ⚠️ **BUG**: Cannot restore service memo if ticket is restored

**Proposed Solution:**
- Add cascade delete or nullify service_memo_id on ticket deletion
- Add warning before deleting ticket with linked service memo
- Allow option to delete service memo with ticket
- Implement soft delete for both ticket and memo

---

**28.2 Delete Service Memo**

**Real-World Scenario:**
- Dispatcher accidentally creates wrong service memo
- Dispatcher deletes service memo
- Ticket still exists but service_memo_id points to deleted memo
- What happens to the ticket?

**Current System Behavior:**
- Service memo deletion via DELETE /api/service-memos/:id
- Ticket has service_memo_id foreign key
- Undo functionality exists (DELETE /api/service-memos/:id/undo)

**Backend Flow:**
1. Dispatcher deletes service memo
2. System sets deleted_at = NOW()
3. Ticket service_memo_id still points to deleted memo
4. Undo can restore memo

**Current Issues:**
- 🔴 **CRITICAL BUG**: Ticket service_memo_id not nullified on memo deletion
- 🔴 **CRITICAL BUG**: Ticket status remains 'Ongoing' even though memo deleted
- ⚠️ **BUG**: No warning that deleting memo will leave ticket in inconsistent state
- ⚠️ **BUG**: Undo only works within certain time window (if any)

**Proposed Solution:**
- Nullify service_memo_id on memo deletion
- Revert ticket status to 'Pending' on memo deletion
- Add warning before deleting memo
- Keep undo functionality with time limit

---

**28.3 Undo Service Memo**

**Real-World Scenario:**
- Dispatcher creates service memo
- Dispatcher realizes mistake
- Dispatcher uses undo functionality
- What happens to ticket status?

**Current System Behavior:**
- Undo via DELETE /api/service-memos/:id/undo
- Restores deleted memo
- Reverts ticket status to 'Pending'

**Backend Flow (service-memos.js line 887):**
1. Dispatcher clicks undo
2. System restores memo (deleted_at = NULL)
3. System reverts ticket status to 'Pending'
4. System nullifies service_memo_id

**Current Issues:**
- ⚠️ **BUG**: No time limit on undo (can undo days later)
- ⚠️ **BUG**: No audit trail of undo action
- ⚠️ **BUG**: Can undo even if ticket was already resolved by other means
- ⚠️ **BUG**: No validation that undo is appropriate

**Proposed Solution:**
- Add time limit on undo (e.g., 5 minutes)
- Log undo action in history
- Validate that undo won't cause conflicts
- Require confirmation for undo

---

### Scenario 29: Bulk Operations

**29.1 Bulk Close Tickets**

**Real-World Scenario:**
- Dispatcher wants to close multiple tickets at once
- E.g., power restored in entire area
- Select multiple tickets and bulk close

**Current System Behavior:**
- No bulk close endpoint
- Must close each ticket individually
- Time-consuming for bulk operations

**Current Issues:**
- 🔴 **MISSING FEATURE**: No bulk close functionality
- 🔴 **MISSING FEATURE**: No bulk status update
- ⚠️ **BUG**: Inefficient for large-scale operations

**Proposed Solution:**
- Add POST /api/tickets/bulk/close endpoint
- Accept array of ticket IDs
- Apply same validation as individual close
- Log each action separately

---

**29.2 Bulk Dispatch**

**Real-World Scenario:**
- Dispatcher wants to dispatch multiple tickets to same crew
- E.g., 5 tickets in same area
- Select multiple tickets and bulk dispatch

**Current System Behavior:**
- No bulk dispatch endpoint
- Must dispatch each ticket individually
- Grouped tickets have bulk dispatch but only for groups

**Current Issues:**
- 🔴 **MISSING FEATURE**: No bulk dispatch for ungrouped tickets
- ⚠️ **BUG**: Inefficient for assigning multiple tickets to same crew

**Proposed Solution:**
- Add POST /api/tickets/bulk/dispatch endpoint
- Accept array of ticket IDs and crew assignment
- Apply same validation as individual dispatch
- Send SMS for each ticket

---

**29.3 Bulk Status Update**

**Real-World Scenario:**
- Dispatcher wants to change status of multiple tickets
- E.g., mark all as "Restored" after area-wide repair
- Select multiple tickets and bulk update status

**Current System Behavior:**
- Bulk SMS exists for crew (all fixed, all unfixed, etc.)
- No bulk status update for dispatcher
- Must update each ticket individually

**Current Issues:**
- 🔴 **MISSING FEATURE**: No bulk status update for dispatcher
- ⚠️ **BUG**: Inefficient for large-scale status changes

**Proposed Solution:**
- Add POST /api/tickets/bulk/status endpoint
- Accept array of ticket IDs and new status
- Apply same validation as individual status update
- Log each action separately

---

### Scenario 30: Concurrent Editing

**30.1 Two Users Edit Same Ticket Simultaneously**

**Real-World Scenario:**
- Dispatcher A edits ticket
- Dispatcher B edits same ticket at same time
- Last save wins, overwrites first edit
- Data loss

**Current System Behavior:**
- Optimistic concurrency control via expected_updated_at
- If version mismatch, returns 409 CONFLICT
- Frontend should handle conflict

**Backend Flow:**
1. Dispatcher A loads ticket (updated_at = T1)
2. Dispatcher B loads ticket (updated_at = T1)
3. Dispatcher A saves with expected_updated_at = T1
4. Ticket updated, updated_at = T2
5. Dispatcher B saves with expected_updated_at = T1
6. Version mismatch (T1 ≠ T2), returns 409
7. Dispatcher B must reload and re-edit

**Current Issues:**
- ⚠️ **BUG**: Conflict handling may not be user-friendly
- ⚠️ **BUG**: No merge capability for concurrent edits
- ⚠️ **BUG**: No indication to users that someone else is editing

**Proposed Solution:**
- Add "editing" lock when user opens ticket
- Show "being edited by X" to other users
- Implement field-level conflict resolution
- Better conflict UI (show differences, allow selective merge)

---

**30.2 Two Users Edit Same Service Memo Simultaneously**

**Real-World Scenario:**
- Dispatcher A edits service memo
- Dispatcher B edits same memo at same time
- Last save wins, overwrites first edit
- Data loss

**Current System Behavior:**
- Same optimistic concurrency control as tickets
- expected_updated_at field on service memos
- Returns 409 on conflict

**Current Issues:**
- Same as ticket concurrent editing
- ⚠️ **BUG**: No lock indication
- ⚠️ **BUG**: No merge capability

**Proposed Solution:**
- Same as ticket concurrent editing
- Add editing lock for service memos

---

### Scenario 31: Notification Failures

**31.1 SMS Not Sent to Consumer**

**Real-World Scenario:**
- Ticket created, SMS should be sent to consumer
- SMS gateway down or phone number invalid
- SMS not sent, but ticket created successfully
- Consumer doesn't know ticket ID

**Current System Behavior:**
- SMS sent after ticket creation
- If SMS fails, ticket still created
- No retry mechanism
- No indication in system that SMS failed

**Current Issues:**
- 🔴 **CRITICAL BUG**: No retry mechanism for failed SMS
- 🔴 **CRITICAL BUG**: No indication in UI that SMS failed
- 🔴 **CRITICAL BUG**: Consumer may not receive ticket ID
- ⚠️ **BUG**: No manual resend option
- ⚠️ **BUG**: No SMS delivery status tracking

**Proposed Solution:**
- Add sms_sent flag to tickets table
- Add sms_delivery_status field (pending, sent, delivered, failed)
- Add retry queue for failed SMS
- Add manual resend button in UI
- Show SMS status in ticket details

---

**31.2 SMS Not Sent to Crew**

**Real-World Scenario:**
- Ticket dispatched, SMS should be sent to crew
- Crew phone number invalid or SMS gateway down
- SMS not sent, crew doesn't know about dispatch
- Work not started

**Current System Behavior:**
- SMS sent after dispatch
- If SMS fails, dispatch still succeeds
- No retry mechanism
- No indication that SMS failed

**Current Issues:**
- 🔴 **CRITICAL BUG**: No retry for crew SMS
- 🔴 **CRITICAL BUG**: Crew may not receive dispatch notification
- ⚠️ **BUG**: No manual resend for crew SMS
- ⚠️ **BUG**: No SMS delivery status for crew

**Proposed Solution:**
- Add crew_sms_sent flag
- Add crew_sms_delivery_status
- Add retry queue for crew SMS
- Add manual resend for crew SMS

---

### Scenario 32: Control Number Allocation Conflicts

**32.1 Control Number Race Condition**

**Real-World Scenario:**
- Two dispatchers create service memos for same municipality simultaneously
- Both request control number allocation
- System allocates same control number to both
- Duplicate control numbers

**Current System Behavior:**
- Control number allocated via POST /api/service-memos/allocate-control-number
- Uses MAX query to find last number
- No transaction isolation
- Possible race condition

**Backend Flow:**
1. Dispatcher A requests control number for municipality
2. System queries MAX(control_number) for municipality
3. System returns next number (e.g., SM-001)
4. Dispatcher B requests control number for same municipality
5. System queries MAX(control_number) for municipality
6. System returns same next number (SM-001)
7. Both memos created with same control number

**Current Issues:**
- 🔴 **CRITICAL BUG**: Race condition in control number allocation
- 🔴 **CRITICAL BUG**: Duplicate control numbers possible
- ⚠️ **BUG**: No unique constraint on control_number + municipality

**Proposed Solution:**
- Add unique constraint on (control_number, municipality)
- Use transaction with SELECT FOR UPDATE
- Implement atomic increment
- Return error if allocation fails

---

**32.2 Control Number Gaps**

**Real-World Scenario:**
- Service memo created, control number allocated
- Memo deleted before save
- Control number skipped
- Gaps in sequence

**Current System Behavior:**
- Control number allocated on preview, not on save
- If memo not saved, number lost
- Gaps in sequence

**Current Issues:**
- ⚠️ **BUG**: Gaps in control number sequence
- ⚠️ **BUG**: Control number allocated but not used

**Proposed Solution:**
- Allocate control number on save, not preview
- Or implement number reservation with timeout
- Allow gaps (not critical for internal use)

---

### Scenario 33: Photo Upload Edge Cases

**33.1 Photo Too Large**

**Real-World Scenario:**
- Consumer uploads high-resolution photo
- File size exceeds upload limit
- Upload fails
- Ticket created without photo

**Current System Behavior:**
- Multer middleware handles upload
- No explicit size limit configured
- May fail silently or with error

**Current Issues:**
- ⚠️ **BUG**: No explicit file size limit
- ⚠️ **BUG**: No client-side validation before upload
- ⚠️ **BUG**: No resize/compression before upload
- ⚠️ **BUG**: No error message if upload fails

**Proposed Solution:**
- Add file size limit (e.g., 5MB)
- Add client-side validation
- Add image compression on upload
- Show clear error message if upload fails

---

**33.2 Invalid Photo Format**

**Real-World Scenario:**
- Consumer uploads non-image file (PDF, DOCX, etc.)
- Upload fails or corrupts database
- Ticket may not be created

**Current System Behavior:**
- Multer file filter checks mime type
- May accept invalid files
- No validation after upload

**Current Issues:**
- ⚠️ **BUG**: Weak file type validation
- ⚠️ **BUG**: No magic number validation
- ⚠️ **BUG**: May accept malicious files

**Proposed Solution:**
- Add strict file type validation
- Add magic number validation
- Only accept JPEG, PNG, WEBP
- Scan uploaded files for malware

---

**33.3 Photo Upload Fails**

**Real-World Scenario:**
- Consumer uploads photo
- Upload fails (network error, server error)
- Ticket creation blocked or fails
- Consumer frustrated

**Current System Behavior:**
- Photo upload required for ticket creation
- If upload fails, ticket not created
- No retry mechanism

**Current Issues:**
- 🔴 **CRITICAL BUG**: Photo upload failure blocks ticket creation
- ⚠️ **BUG**: No retry mechanism
- ⚠️ **BUG**: No option to create ticket without photo

**Proposed Solution:**
- Make photo optional
- Allow ticket creation without photo
- Add photo upload after ticket creation
- Add retry mechanism for failed uploads

---

### Scenario 34: SMS Keyword Parsing Edge Cases

**34.1 Typo in SMS Keyword**

**Real-World Scenario:**
- Lineman sends "fixd ALECO-12345" (typo: fixd instead of fixed)
- SMS parser doesn't recognize keyword
- Status not updated
- Lineman confused

**Current System Behavior:**
- SMS parser looks for exact keywords: fixed, unfixed, nofault, nores
- Typos not recognized
- No fuzzy matching

**Current Issues:**
- 🔴 **CRITICAL BUG**: No fuzzy matching for SMS keywords
- 🔴 **CRITICAL BUG**: Typos cause status update to fail
- ⚠️ **BUG**: No feedback to lineman that keyword not recognized
- ⚠️ **BUG**: No suggested correction

**Proposed Solution:**
- Add fuzzy matching (Levenshtein distance)
- Add common typo detection
- Send feedback SMS if keyword not recognized
- Suggest correct keyword

---

**34.2 Wrong Ticket ID Format**

**Real-World Scenario:**
- Lineman sends "fixed ALECO12345" (missing hyphen)
- SMS parser doesn't recognize ticket ID
- Status not updated

**Current System Behavior:**
- SMS parser expects ALECO-XXXXX format
- Wrong format not recognized
- No fuzzy matching for ticket ID

**Current Issues:**
- 🔴 **CRITICAL BUG**: No fuzzy matching for ticket ID
- 🔴 **CRITICAL BUG**: Wrong format causes update to fail
- ⚠️ **BUG**: No feedback to lineman

**Proposed Solution:**
- Add fuzzy matching for ticket ID
- Accept multiple formats (with/without hyphen)
- Send feedback if ticket not found

---

**34.3 SMS from Unauthorized Number**

**Real-World Scenario:**
- Non-crew member sends SMS with keyword
- System may process it
- Unauthorized status update

**Current System Behavior:**
- SMS parser checks if sender is in personnel table
- If not found, ignores SMS
- No audit log of unauthorized attempts

**Current Issues:**
- ⚠️ **BUG**: No logging of unauthorized SMS attempts
- ⚠️ **BUG**: No alert for repeated unauthorized attempts
- ⚠️ **BUG**: No rate limiting on unauthorized SMS

**Proposed Solution:**
- Log all unauthorized SMS attempts
- Alert admin on repeated attempts
- Rate limit unauthorized numbers
- Block numbers after multiple attempts

---

### Scenario 35: Permission and Role-Based Access

**35.1 Dispatcher Access to All Tickets**

**Real-World Scenario:**
- Dispatcher should only see tickets for their district
- Current system allows access to all tickets
- No district-based access control

**Current System Behavior:**
- All staff can see all tickets
- No district-based filtering
- No role-based access control

**Current Issues:**
- 🔴 **MISSING FEATURE**: No district-based access control
- 🔴 **MISSING FEATURE**: No role-based permissions
- ⚠️ **BUG**: Dispatcher can edit tickets outside their district

**Proposed Solution:**
- Add district field to users table
- Filter tickets by user's district
- Add role-based permissions (admin, dispatcher, crew, viewer)
- Add audit log for cross-district access

---

**35.2 Crew Access to Own Tickets Only**

**Real-World Scenario:**
- Crew should only see tickets assigned to them
- Current system may show all tickets
- Privacy and security concern

**Current System Behavior:**
- Crew uses same dashboard as dispatchers
- No crew-specific view
- No access control

**Current Issues:**
- 🔴 **MISSING FEATURE**: No crew-specific view
- 🔴 **MISSING FEATURE**: No access control for crew
- ⚠️ **BUG**: Crew can see other crews' tickets

**Proposed Solution:**
- Add crew-specific dashboard
- Filter tickets by assigned_crew
- Add role-based access control
- Add mobile crew app with limited access

---

### Scenario 36: Data Integrity Constraints

**36.1 Orphaned Records**

**Real-World Scenario:**
- Service memo references non-existent ticket
- Ticket references non-existent crew
- Orphaned records in database

**Current System Behavior:**
- Foreign key constraints may not be enforced
- Orphaned records possible
- No cleanup mechanism

**Current Issues:**
- 🔴 **CRITICAL BUG**: Foreign key constraints not enforced
- 🔴 **CRITICAL BUG**: Orphaned records possible
- ⚠️ **BUG**: No cleanup job for orphaned records

**Proposed Solution:**
- Add foreign key constraints with ON DELETE CASCADE/SET NULL
- Add periodic cleanup job
- Add validation for orphaned records
- Add integrity check in health endpoint

---

**36.2 Circular References**

**Real-World Scenario:**
- Ticket A references ticket B
- Ticket B references ticket A
- Circular reference causes infinite loops

**Current System Behavior:**
- No circular reference detection
- May cause issues in queries
- May cause infinite loops in recursive queries

**Current Issues:**
- ⚠️ **BUG**: No circular reference detection
- ⚠️ **BUG**: May cause query issues

**Proposed Solution:**
- Add circular reference detection
- Prevent circular references in API
- Add validation in database triggers

---

### Scenario 37: System Downtime Scenarios

**37.1 Database Connection Failure**

**Real-World Scenario:**
- Database server down
- Ticket submission fails
- Consumer sees error

**Current System Behavior:**
- Error returned to user
- No retry mechanism
- No queue for offline submissions

**Current Issues:**
- 🔴 **CRITICAL BUG**: No retry mechanism for DB failures
- 🔴 **CRITICAL BUG**: No queue for offline submissions
- ⚠️ **BUG**: Poor error handling

**Proposed Solution:**
- Add retry mechanism with exponential backoff
- Add queue for offline submissions
- Add graceful degradation
- Add health check endpoint

---

**37.2 SMS Gateway Down**

**Real-World Scenario:**
- SMS gateway down
- Notifications not sent
- Users not informed

**Current System Behavior:**
- SMS fails silently
- No retry queue
- No fallback notification method

**Current Issues:**
- 🔴 **CRITICAL BUG**: No retry queue for SMS
- 🔴 **CRITICAL BUG**: No fallback notification method
- ⚠️ **BUG**: SMS failures not logged

**Proposed Solution:**
- Add retry queue for SMS
- Add fallback notification (email, app push)
- Add SMS gateway health check
- Add alternative SMS provider

---

### Scenario 38: Performance and Scalability

**38.1 Large Number of Tickets**

**Real-World Scenario:**
- System has 100,000+ tickets
- Queries become slow
- Pagination issues
- Map rendering slow

**Current System Behavior:**
- No optimization for large datasets
- No caching
- No indexing strategy

**Current Issues:**
- ⚠️ **BUG**: No database indexing optimization
- ⚠️ **BUG**: No query optimization
- ⚠️ **BUG**: No caching layer
- ⚠️ **BUG**: No pagination optimization

**Proposed Solution:**
- Add proper database indexes
- Add query optimization
- Add caching layer (Redis)
- Add pagination optimization
- Add database archiving for old tickets

---

**38.2 Concurrent User Load**

**Real-World Scenario:**
- 100 dispatchers using system simultaneously
- Database connection pool exhausted
- Slow response times
- Timeouts

**Current System Behavior:**
- Connection pool limit: 5 (from memory)
- May be insufficient for concurrent load
- No load balancing

**Current Issues:**
- 🔴 **CRITICAL BUG**: Connection pool too small (5 connections)
- 🔴 **CRITICAL BUG**: No load balancing
- ⚠️ **BUG**: No rate limiting per user

**Proposed Solution:**
- Increase connection pool size
- Add connection pooling optimization
- Add rate limiting per user
- Add load balancing
- Add horizontal scaling capability
