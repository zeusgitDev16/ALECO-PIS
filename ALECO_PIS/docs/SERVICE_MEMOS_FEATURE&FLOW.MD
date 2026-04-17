# Service memos — purpose and frozen spec

## Purpose

Audit and print information about a ticket (complaint-handling system). **Tickets** supply consumer/report data; **service memos** record dispatcher intake, referral, field timing, and action taken.

**Reference UI:** `src/assets/b04ffb6d-a65e-4814-ba35-21d85048278c.jpg` (layout only; legacy left-hand complaint checklist is **not** in v1).

## Validation rules

- **Required:** All fields below except **site arrived date/time** (optional).
- **Pools:** Same shell for **create**, **update**, **view** (read-only).

## Field matrix (stable API keys)

| API key | Required | Source | DB target (until migration) |
|---------|----------|--------|-------------------------------|
| `ticket_id` | yes | Ticket | `aleco_service_memos.ticket_id` (FK) |
| `account_number` | display/search | Ticket | `aleco_tickets.account_number` (join) |
| `requested_by` | display | Ticket | derived: `first_name`, `middle_name`, `last_name` |
| `location` | display | Ticket | `aleco_tickets.address` (+ municipality in UI) |
| `contact_no` | display | Ticket | `aleco_tickets.phone_number` |
| `action_desired` | display | Ticket | `aleco_tickets.action_desired` |
| `ticket_status` / `status` | display | Ticket + memo snapshot | `aleco_tickets.status` / `sm.ticket_status` |
| `control_number` | display | System | `aleco_service_memos.control_number` (generated) |
| `received_by` | yes | Memo | `aleco_service_memos.received_by` |
| `intake_date` | yes | Memo | `aleco_service_memos.service_date` (DATE) |
| `intake_time` | yes | Memo | extended JSON → `internal_notes` (`v:1` blob) |
| `referred_to` | yes | Memo | `aleco_service_memos.referred_to` |
| `referral_received_date` | yes | Memo | extended JSON |
| `referral_received_time` | yes | Memo | extended JSON |
| `action_taken` | yes | Memo | `aleco_service_memos.work_performed` |
| `site_arrived_date` | **no** | Memo | extended JSON (optional) |
| `site_arrived_time` | **no** | Memo | extended JSON (optional) |
| `finished_date` | yes | Memo | extended JSON |
| `finished_time` | yes | Memo | extended JSON |
| `resolution_details` | optional legacy | Memo | `aleco_service_memos.resolution_details` (optional) |

### Duplicate legacy labels (resolved)

- **Intake:** `intake_date` + `intake_time` — when the memo was received by the dispatcher (first block).
- **Referral handoff:** `referral_received_date` + `referral_received_time` — when the referred party acknowledged (second block).

## Extended JSON (`internal_notes`)

Until dedicated columns exist, a JSON object with `"v":1` is stored in `internal_notes` for: `intake_time`, `referral_received_date`, `referral_received_time`, `site_arrived_date`, `site_arrived_time`, `finished_date`, `finished_time`. Non-JSON `internal_notes` is treated as legacy plain text.

## Database

Schema changes (drop old columns, add final columns) are **last** — see `backend/migrations/` migration for service memos after UI sign-off.

## Memo number format

`SM-YYYY-NNNN` (four-digit sequence per year) — generated on create.
