# Tickets — analysis, improvement ideas, and bug tracking

**Scope:** Ticket-related backend routes, utilities, migrations, and admin/public UI (`Tickets.jsx`, `ReportaProblem.jsx`, `src/components/tickets/*`, hooks, CSS).  
**Status:** Read-only analysis (no implementation in the pass that produced this document).  
**Related:** Architecture map and route inventory in [`TICKET_FLOW_SCAN.md`](./TICKET_FLOW_SCAN.md).

---

## 1. How tickets work today (short)

| Layer | Responsibility |
|--------|----------------|
| **Public intake** | `POST /api/tickets/submit` (multipart, optional image, GPS, district validation, idempotency ~5 min), duplicate check, `GET /api/tickets/track/:ticketId`, optional email/SMS copy. |
| **Admin list** | `GET /api/filtered-tickets` — tabs, status, search (including child→parent group visibility), location, dates, group visibility, soft-delete exclusion. |
| **Admin lifecycle** | `tickets.js` — edit (non-group), soft delete, dispatch (SMS gate), hold, resume, status updates, crews/pool, logs, inbound SMS webhook. |
| **Grouping** | `ticket-grouping.js` — create `GROUP-*` master, link children via `parent_ticket_id`, ungroup, group dispatch/status, bulk restore for closed tickets. |
| **Client** | `useTickets` holds filter state and refetches on any filter change; `Tickets.jsx` orchestrates layouts (card / table / kanban / map), scope tabs (Urgent vs Regular **client-side**), bulk bar, modals, detail pane. |

**Data model (conceptual):** `ticket_id` (`ALECO-*` vs `GROUP-*`), `parent_ticket_id`, `status` enum, `deleted_at`, logs in `aleco_ticket_logs`. DTO [`backend/utils/ticketDto.js`](../backend/utils/ticketDto.js) normalizes datetime fields for the client.

---

## 2. Strengths (keep)

- Clear split between **filter brick** (`ticket-routes.js`), **lifecycle brick** (`tickets.js`), and **grouping brick** (`ticket-grouping.js`); `server.js` mount order preserves backup export paths (documented in `TICKET_FLOW_SCAN.md`).
- **Soft delete** + filter queries excluding `deleted_at` support a sane admin workflow.
- **Audit trail** via `insertTicketLog` on many mutations.
- **Consumer vs admin** surfaces are separated (public track vs full list).
- **Rich admin UI:** dual-pane filters, multiple layouts, grouping, bulk actions, draggable bulk bar.
- **Kanban** blocks Pending→Ongoing without dispatch data (redirects user to detail pane).

---

## 3. Gaps and improvement proposals (non-code)

### 3.1 Security and API contract

| Topic | Finding | Proposal |
|--------|---------|----------|
| **Admin API authentication** | `server.js` does not apply Express middleware that enforces JWT/session on `GET /api/filtered-tickets`, mutating ticket routes, etc. The SPA uses `localStorage` + `verify-session` for UX; **the API is not inherently protected from direct HTTP calls** if the base URL is known. | Add server-side auth (e.g. Bearer token or session cookie) on all non-public ticket routes; align with existing auth routes. Document public vs authenticated surface explicitly. |
| **Actor attribution** | Many routes accept `actor_email` / `actor_name` in JSON (and sometimes headers). | Prefer trusted identity from verified session only; treat body actor fields as override only for trusted integrations or remove for end users. |

### 3.2 Backend behavior and consistency

| Topic | Finding | Proposal |
|--------|---------|----------|
| **`tab` (Open / Closed)** | [`ticket-routes.js`](../backend/routes/ticket-routes.js) supports `tab=Open` / `Closed` to constrain statuses. [`useTickets.js`](../src/utils/useTickets.js) initializes `tab: ''` and **no ticket UI sets `tab`**. | Either wire Open/Closed (or equivalent) in the filter UI and send `tab`, or remove/simplify the unused parameter to avoid drift. |
| **`isUrgent` query param** | Backend filters when `isUrgent=true`. Ticket filter state includes `isUrgent`, but **no Tickets-page control toggles it** (Backup module does). Urgent vs Regular is implemented in **`Tickets.jsx` via client-side `useMemo`**, not via API. | Decide one model: (A) API-driven urgent filter for large lists/pagination, or (B) remove unused param from ticket dashboard state; document the chosen approach. |
| **Track + soft delete** | `GET /api/tickets/track/:ticketId` selects by `ticket_id` only — **does not exclude `deleted_at`**. | Product decision: return 404 or a generic “not found” for deleted tickets so consumers cannot track removed reports. |
| **Ticket ID generation** | `ALECO-${random 5 base36}` in [`tickets.js`](../backend/routes/tickets.js) — collision risk is low but nonzero under load. | Optional DB uniqueness retry or sequential component. |
| **Group ID date** | Group master IDs use `new Date().toISOString().slice(0, 10)` in [`ticket-grouping.js`](../backend/routes/ticket-grouping.js) while other paths use Philippine helpers. | Align date with `Asia/Manila` (same as `process.env.TZ`) to avoid off-by-one around midnight. |
| **Inbound SMS** | Complex keyword routing in `tickets.js`; deferred checklist already in `TICKET_FLOW_SCAN.md` Appendix A. | Schedule a focused test pass with real message samples and crew phone formats. |

### 3.3 Frontend / UX

| Topic | Finding | Proposal |
|--------|---------|----------|
| **Filter discoverability** | Sidebar uses icon-only filters; full bar lives in drawer — good for density, **steep learning curve** for new dispatchers. | Onboarding: first-visit tooltips, “filters active” summary line, or a compact legend. |
| **Error copy** | [`useTickets.js`](../src/utils/useTickets.js): non-`success` JSON sets *"No tickets found matching your filters"* even when the failure is not “empty result”. | Differentiate empty list vs API error vs unauthorized. |
| **Bulk bar label “Restore”** | Bulk action marks tickets **Restored** (resolution). Could be read as “restore deleted”. | Rename to e.g. “Mark Restored” / “Close (Restored)” with short helper text. |
| **Detail pane / stepper** | Resolution stepper in [`TicketDetailPane.jsx`](../src/components/tickets/TicketDetailPane.jsx) treats **Unresolved** as part of step 1 (“Dispatch”) active states — may read oddly (Unresolved is a terminal/outcome-style state in other places). | Revisit stepper rules so “Unresolved” fits the narrative or gets its own visual branch. |
| **Accessibility** | Modals, kanban, and floating bar are rich but rely heavily on pointer interactions. | Keyboard focus traps, `aria-live` for toast-equivalent errors, visible focus on scope tabs and filter icons. |
| **Report wizard / portals** | `ReportaProblem.jsx` notes portals may not inherit `--report-scale` — TicketPopUp/ConfirmModal scaling called out as optional follow-up elsewhere. | If visual consistency matters, unify scaling tokens for modal portals. |

### 3.4 Performance and operations

| Topic | Finding | Proposal |
|--------|---------|----------|
| **Refetch on every filter change** | `useEffect([filters])` refetches immediately for each key change. Search is debounced in the sidebar input, but other fields are not. | Optional debounce or batching for rapid filter changes; consider `staleTime` if you introduce React Query later. |
| **Large lists** | Table/grid/kanban exist; virtualized grid component is present for some modes. | Confirm performance targets (e.g. 10k rows) and document which view to use for huge backlogs. |

---

## 4. Bug and risk register (tracked)

Use this table for triage; IDs are stable for follow-up tickets.

| ID | Severity | Area | Description | Notes / suspected location |
|----|----------|------|-------------|----------------------------|
| T-01 | High | Security | Admin ticket endpoints callable without server-enforced session | `server.js` + ticket route mounts |
| T-02 | Medium | Public API | Tracking may return data for **soft-deleted** tickets | `GET /tickets/track/:ticketId` in [`tickets.js`](../backend/routes/tickets.js) |
| T-03 | Medium | Product drift | `tab` (Open/Closed) supported in API but **never set** from ticket UI | [`useTickets.js`](../src/utils/useTickets.js), [`ticket-routes.js`](../backend/routes/ticket-routes.js) |
| T-04 | Low | Product drift | `isUrgent` filter param unused on Tickets page (state exists) | [`useTickets.js`](../src/utils/useTickets.js) vs Backup filters |
| T-05 | Low | UX copy | Misleading message when API returns `success: false` | [`useTickets.js`](../src/utils/useTickets.js) |
| T-06 | Low | Consistency | Group ID date string may not match Philippine “business day” | [`ticket-grouping.js`](../backend/routes/ticket-grouping.js) |
| T-07 | Info | Risk | Rare `ALECO-*` ID collision | [`tickets.js`](../backend/routes/tickets.js) submit route |

**Not logged as bugs (by design / verified):**

- Kanban merges **Ongoing** and **OnHold** in one column (`kanbanHelpers.js`); drag between them is intentionally ignored; hold is meant to go through the hold modal — consistent with backend requiring Ongoing for hold.
- `handleUpdateTicket` does not need to handle raw `OnHold` from kanban column IDs because there is no separate OnHold drop target mapped in `statusMap` for column drag — closure paths use Restored / NFF / etc.

---

## 5. Suggested implementation order (when you code)

1. **Clarify product rules** for track + deleted tickets and Open/Closed listing.  
2. **Security:** protect admin routes; then tighten actor identity.  
3. **UX quick wins:** filter error messages, bulk button labeling, optional Open/Closed or remove dead `tab` state.  
4. **Deeper:** group ID timezone, optional ticket ID uniqueness hardening, SMS audit from Appendix A.

---

## 6. File index (ticket touchpoints)

**Backend:** `backend/routes/tickets.js`, `ticket-routes.js`, `ticket-grouping.js`, `utils/ticketDto.js`, `utils/ticketLogHelper.js`, migrations under `backend/migrations/*ticket*`.  
**Frontend:** `src/components/Tickets.jsx`, `src/ReportaProblem.jsx`, `src/utils/useTickets.js`, `src/utils/useRecentOpenedTickets.js`, `src/utils/kanbanHelpers.js`, `src/utils/ticketStatusDisplay.js`, `src/components/tickets/**`, related CSS under `src/CSS/`.  
**Containers:** `UrgentTickets.jsx`, `RecentOpenedTickets.jsx`, `TicketPopUp.jsx`.

---

*Last updated: analysis pass (documentation only).*
