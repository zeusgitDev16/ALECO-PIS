# Admin Power Interruptions Dashboard — Technical Audit

**Scope:** `src/components/Interruptions.jsx` (default export `AdminInterruptions`), its data hook, API client, and directly mounted child modules.  
**Route:** `/admin-interruptions` (protected) in `src/App.jsx`.  
**Audit date:** 2026-04-22.

This document describes how the admin “Power advisories” screen works today, what it depends on, and gaps relevant to future work (e.g. poster preview, Puppeteer/Cloudinary exports).

---

## 1. Purpose and user-facing role

- Staff create and edit **power outage advisories** that appear on the **public home** “Power Outages Updates” feed (`InterruptionList.jsx`, separate from this file).
- The dashboard supports **three list layouts** (card grid, compact table, workflow columns), **filters**, **recent-opened shortcuts**, **create/edit modal**, **update lifecycle modal** (status + remarks + memos), **archive** (soft delete), **permanent delete** (archived only), and **pull/push public feed** flags.

---

## 2. High-level architecture

```mermaid
flowchart LR
  subgraph ui [Interruptions.jsx]
    Layout[AdminLayout]
    Toolbar[Filters + scope + refresh]
    Recent[RecentOpenedAdvisories]
    Main[Card | Compact | Workflow]
    Modals[Edit modal | Update modal | Confirms | Drawer]
  end
  subgraph hook [useAdminInterruptions]
    State[interruptions, editDetail, loading, saving, messages]
    API[interruptionsApi.js]
  end
  subgraph server [Backend]
    Routes["/api/interruptions"]
  end
  ui --> hook
  hook --> API
  API --> Routes
```

- **Single source of list data:** `useAdminInterruptions` holds `interruptions` and refetches after mutations.
- **Detail for edit/update:** `getInterruption(id)` populates `editDetail` (includes `updates[]` for remarks log).
- **Local-only UI state:** modal open, form draft, `viewMode`, chip/search filters, confirmation dialogs, filter drawer.

---

## 3. File inventory (direct dependencies)

| Layer | Path | Role |
|--------|------|------|
| Page shell | `components/AdminLayout.jsx` | `activePage="interruptions"` |
| Page | `components/Interruptions.jsx` | Orchestrates all admin interruption UX |
| Data | `hooks/useAdminInterruptions.js` | List load, CRUD, detail, memos, feed ops |
| HTTP | `api/interruptionsApi.js` | `authFetch` + `apiUrl` to `/api/interruptions` |
| Form/helpers | `utils/interruptionFormUtils.js` | `emptyForm`, validation, payload build, `rowToFormState` |
| Labels/filters | `utils/interruptionLabels.js` | `FILTER_CHIPS`, `isInterruptionEnergizedStatus`, type/status labels |
| List views | `interruptions/InterruptionAdvisoryBoard.jsx`, `InterruptionCompactView.jsx`, `InterruptionWorkflowView.jsx` | Render `filteredInterruptions` |
| Chrome | `interruptions/InterruptionAdvisoryFilters.jsx`, `InterruptionLayoutPicker.jsx`, `InterruptionFilterDrawer.jsx` | Filters + layout toggle + mobile drawer |
| Create/edit | `interruptions/InterruptionAdvisoryForm.jsx`, `InterruptionAdvisoryViewOnly.jsx` | Form vs read-only archived view |
| Lifecycle | `interruptions/UpdateAdvisoryModal.jsx` | Status change, required remarks, energized datetime, memo list |
| Shortcuts | `containers/RecentOpenedAdvisories.jsx` | Horizontal strip + localStorage-backed recents |
| CSS | `InterruptionsAdmin.css`, `InterruptionUIScale.css`, `InterruptionWorkflowView.css`, `InterruptionLayoutPicker.css`, `InterruptionFilterDrawer.css`, `InterruptionModalUIScale.css`, `AdminPageLayout.css`, `RecentOpenedAdvisories.css` (via RecentOpened) | Styling |

Backend DTO mapping reference: `backend/utils/interruptionsDto.js` (`mapRowToDto`).

---

## 4. Data flow details

### 4.1 Initial and ongoing list load

- `useAdminInterruptions` calls `listInterruptions` with:
  - `limit: 200` (`ADMIN_LIMIT`),
  - `includeFuture: true`,
  - `includeDeleted` / `deletedOnly` derived from `listArchiveFilter` (`active` | `all` | `archived`).
- On **`document.visibilitychange` → visible**, the list **refetches** (keeps dashboard fresh when tab returns).
- **Failure:** `fetchError` set; UI shows retry + “Refresh list”.

### 4.2 Client-side filtering (`Interruptions.jsx`)

- **Status chips:** `FILTER_CHIPS`; **Energized** chip uses `isInterruptionEnergizedStatus` so legacy `Restored` rows match.
- **Search:** case-insensitive substring on `feeder`, `cause`, and joined `affectedAreas` (does **not** search `body`, `controlNo`, or `id` unless present in those fields).
- **Interaction with scope:** Switching to **Archived** forces `activeChipKey` to `'all'` (effect) so chip filters don’t hide archived rows unexpectedly.

### 4.3 Edit / create modal

- **Open create:** `editingId = null`, `form = emptyForm`, `baselineForm` copy for dirty check.
- **Open edit:** `editingId` set, `loadEditDetail(id)` when `modalOpen && editingId`.
- **Form hydration:** When `editDetail.id === editingId`, **once per open** (`formLoadedForIdRef`), `rowToFormState(editDetail)` → `form` + `baselineForm`.
- **Archived advisory:** If `deletedAt` on `editDetail` or list row, modal shows **`InterruptionAdvisoryViewOnly`** (no edit form).
- **Submit:** `validateInterruptionForm` → `buildInterruptionPayload` (optimistic concurrency via `baselineUpdatedAt` / `editDetail.updatedAt`) → `saveAdvisory` → `createInterruption` or `updateInterruption`. Actor email/name from `localStorage`.
- **409 conflict:** `message.type === 'conflict'`; form shows reload affordance (`InterruptionAdvisoryForm`); global message hides when `type === 'conflict'` (line 297).
- **Dirty close:** `requestCloseModal` opens discard confirm.

### 4.4 Update advisory modal (lifecycle)

- `openUpdate` sets `updateModalId` and `loadEditDetail(row.id)`.
- **`UpdateAdvisoryModal`** receives `item={editDetail || interruptions.find(...)}` so list row can show while detail loads.
- **`handleSaveStatus`:** `saveAdvisory({ editingId: updateModalId, payload })` with status, optional `statusChangeRemark`, `dateTimeRestored` when energizing; then reloads detail.

### 4.5 Archive and permanent delete

- **Archive:** `deleteInterruption` via `removeAdvisory`; confirm dialog lists implications.
- **Permanent delete:** only from UI paths that pass `onPermanentDelete` (cards/workflow/recent); `permanentlyDeleteInterruption`.

### 4.6 Feed pull / push

- **`pullFromFeedAdvisory` / `pushToFeedAdvisory`:** API wrappers; success refreshes list and sets `message`.

---

## 5. View modes (dashboard layouts)

| `viewMode` | Component | Data |
|------------|-----------|------|
| `card` | `InterruptionAdvisoryBoard` | `filteredInterruptions`, `totalCount={interruptions.length}` |
| `compact` | `InterruptionCompactView` | Same |
| `workflow` | `InterruptionWorkflowView` | Same; columns from `interruptionWorkflowHelpers.js` |

- **Persistence:** `localStorage` key `interruptionViewMode`.
- **Picker:** `InterruptionLayoutPicker` — Card, Compact, Workflow + inline filter button opening **`InterruptionFilterDrawer`**.

---

## 6. Form model (admin edit)

Defined in `interruptionFormUtils.js` (`emptyForm` / `InterruptionFormState`):

- **Classification:** `type`, `status`, `cause`, `causeCategory`, `controlNo`, `feeder`, `feederId`, `affectedAreasText`
- **Schedule:** `dateTimeStart`, `dateTimeEndEstimated`, `dateTimeRestored`, `publicVisibleAt`, `schedulePublicLater`
- **Content:** `body`, `imageUrl`
- **Lifecycle note:** `statusChangeRemark` (when applicable in payload)
- **Auto-energize:** `scheduleAutoRestore`, `scheduledRestoreAt`, `scheduledRestoreRemark`

This set aligns with `mapRowToDto` fields and is the **authoritative input surface** for any future **poster preview** on the admin side.

---

## 7. Findings and gaps

### 7.1 Critical / product

| ID | Finding | Severity |
|----|---------|----------|
| G-1 | **`restoreAdvisory` is implemented in `useAdminInterruptions` and exported but never destructured or used in `Interruptions.jsx` or any child searched.** `restoreInterruption` API exists. Archive copy claims advisories can be “restored from the Archived list,” but **no unarchive control** was found on the dashboard or `InterruptionAdvisoryDetailModal`. | **High** — possible dead product promise |
| G-2 | **List cap:** Admin list hard-limited to **200** rows per query. Large histories may be incomplete without pagination or higher cap. | Medium |
| G-3 | **Search coverage:** Query does not include `body`, `controlNo`, or `status`/`type` strings; long advisories may be hard to find. | Low–medium |

### 7.2 UX / maintainability

| ID | Finding | Note |
|----|---------|------|
| U-1 | **Duplicate filter UI:** Toolbar and `InterruptionFilterDrawer` both embed `InterruptionAdvisoryFilters` + archive scope; logic must stay in sync manually. | Acceptable but duplication risk |
| U-2 | **`getActiveFiltersCount`** ignores `listArchiveFilter`; badge only counts chip + search. | May under-report “active filters” if scope ≠ active |
| U-3 | **Validation errors** auto-clear after 8s; easy to miss. | Minor |

### 7.3 Future: poster / export alignment

| ID | Finding | Note |
|----|---------|------|
| P-1 | **No dedicated “public poster preview”** in admin; staff see cards/compact/workflow + form, not the final public poster layout. | Add shared `InterruptionAdvisoryPoster` + optional layout/tab |
| P-2 | **Structured “affected areas by municipality”** is not a first-class form model; poster designs may need richer data or conventions in `body`/`affectedAreasText`. | Schema/product decision |
| P-3 | **Puppeteer/Cloudinary** would live **outside** this component (API + stored URL); admin would trigger “Generate poster” and display resulting URL. | Backend + env on Render |

---

## 8. Security and deployment notes

- All mutations go through **`authFetch`** (`interruptionsApi.js`); page is behind **`ProtectedRoute`**.
- **Environment:** List/detail endpoints target the same `apiUrl` as the rest of the app (see deployment docs: UI Vercel, API Render).

---

## 9. Summary

The admin interruptions dashboard is a **single orchestrator** (`Interruptions.jsx`) on top of a **focused hook** (`useAdminInterruptions`) and a **consistent REST client**. Layout and filtering are solid for day-to-day ops; the main **integrity gap** identified in this audit is **unarchive (`restoreAdvisory`) not being wired in the UI** despite API/hook support. For the **poster revamp**, the dashboard already centralizes **form fields** and **detail loading**; the next step is a **shared poster component** plus optional **admin preview** and **export pipeline** without duplicating business rules.

---

## 10. Related docs

- `docs/DEPLOYMENT_VERCEL_RENDER.md` — hosting split
- `docs/DATA_MANAGEMENT_SCAN.md` — broader data-management context (if interruptions are cross-referenced)
- Backend: `backend/routes/interruptions.js`, `backend/utils/interruptionsDto.js`
