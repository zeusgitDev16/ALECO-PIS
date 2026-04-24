# Interruption admin ↔ poster generation — alignment gaps

**Purpose:** Document missing pieces and necessary additions so the admin experience centered on `src/components/Interruptions.jsx` (and its form/detail children) lines up with **print-style poster designs** and makes **HTML/CSS → Puppeteer → Cloudinary** generation straightforward.

**Scope:** Admin dashboard orchestration, `InterruptionAdvisoryForm` / view-only flows, shared poster-field helpers, public print route, and backend fields used by advisories. Not an implementation plan (that follows separately).

**Audit date:** 2026-04-22. **Last revised:** 2026-04-22 — full rescan of `src/**`, `backend/**` interruptions artifacts, SQL migrations, `server.js` schedulers, and `requireApiSession` public-route allowlist.

**Related:** `docs/ADMIN_INTERRUPTIONS_DASHBOARD_AUDIT.md`, `docs/ADMIN_INTERRUPTIONS_POSTER_FIELD_GAP.md`, **`docs/INTERRUPTION_POSTER_PRODUCT_DECISIONS.md`** (Facebook, capture timing, fallbacks, sizing, hosting — stakeholder decisions).

---

## 1. Executive summary

Today the system already centralizes most **ALECO-style** advisory data (type, control number, schedule, feeder, reason/cause/body, flat or **grouped** affected areas, status, images, stored poster URL) and exposes a **low-fidelity “poster fields preview”** plus **Puppeteer capture** of a **minimal public page** that renders the **feed infographic**, not the full reference posters.

**Gaps cluster in four areas:**

1. **Poster variants** — Reference artwork includes layouts the data model and admin UI do not distinguish (NGCP letter + table; “Schedule & area disconnection” branch columns).
2. **Time semantics** — Posters sometimes need **multiple non-contiguous windows** on one day; the model is **one start and one estimated end**.
3. **Lifecycle / branding** — **Cancelled** overlays and exact **headline strings** vs print references are not fully aligned with enums and `interruptionPosterFields.js`.
4. **Authoritative print DOM** — There is no dedicated **full-bleed print template** (footer, contact bar, logo, watermarks); capture targets the **infographic** component, so “poster design” and “capture output” diverge.

5. **Auth for print + capture** — `GET /api/interruptions/:id` is **not** public; **`PublicInterruptionPosterPage`** uses the same authenticated client as admin. Anonymous visitors and **default Puppeteer** (no stored JWT) may fail to load the advisory unless the pipeline is redesigned (§4.7, Appendix C).

Closing these gaps is what will make `Interruptions.jsx`-driven editing **predictably** drive future poster HTML.

---

## 2. What already aligns (baseline)

These are in good shape for **standard ALECO bar-style** content and should be preserved as the single source of truth for poster slots where applicable.

| Area | Mechanism |
|------|-----------|
| Classification | `type` (`Scheduled`, `Emergency`, `NgcScheduled`) |
| Reference line | `controlNo` (optional); `getPosterReferenceDisplay` |
| Schedule (single continuous range) | `dateTimeStart`, `dateTimeEndEstimated`; PH formatting in `dateUtils` |
| Multi-day same month | Derived from start/end in `formatToPhilippineDateRangeShort` / day range helpers |
| REASON line policy | `getPosterReasonText` — `cause` → first paragraph of `body` → cause category |
| Feeder | `feeder` (+ `feederId` for admin picks) |
| Affected areas (grouped) | `affectedAreasGrouped[]` in form + DB + DTO; fallback to flat `affectedAreas` / `affectedAreasText` |
| Status / energized | `status`, `dateTimeRestored` (lifecycle modal) |
| Optional advisory photo | `imageUrl` |
| Stored raster poster | `posterImageUrl`; stub + capture from `Interruptions.jsx` |
| Admin awareness | Collapsible **Poster fields preview** (`InterruptionPosterAlignmentPreview`) inside the advisory form |

---

## 3. Reference poster families vs system coverage

| Poster family | Description | Coverage today |
|---------------|-------------|----------------|
| **A — ALECO standard** | Header bar + ref + date/time card + reason + feeder + affected areas + disclaimer/contact in artwork | **Data mostly sufficient**; print chrome and some time edge cases missing |
| **B — NGCP scheduled** | Letterhead, addressee, body narrative, **tabular** schedule (date / time / substation / activities) | **Extended content relies on `body`** (strategy 4A); no structured table fields; capture page does not render letter layout |
| **C — Schedule & area disconnection** | Date + **branches** → town + barangay lists + sidebar branding | **No model or admin UI**; not representable as `affectedAreasGrouped` without abusing headings |
| **D — Status overlay** | e.g. **CANCELLED** stamp on standard layout | **No `Cancelled` status** in normal lifecycle enum / form |

---

## 4. Gap catalog (detailed)

### 4.1 Data model and validation

| ID | Gap | Impact on posters | Suggested direction |
|----|-----|-------------------|---------------------|
| DM-1 | **Single pair** `dateTimeStart` / `dateTimeEndEstimated` only | Cannot express **multiple windows** (e.g. `8:30–9:00 AM; 4:30–5:00 PM`) without encoding in free text | Add optional `scheduleSlots: { start, end }[]` (or JSON column) **or** document that slots must live in `body` and accept that automated poster time block will be wrong/incomplete |
| DM-2 | No first-class **Cancelled** (or “void”) state | No reliable flag for **stamp overlay** or suppressing misleading “upcoming” messaging | Add status (or `isCancelled` + rules) + admin transition + public/admin display rules |
| DM-3 | `controlNo` optional | Header `(SI…)` empty on posters if staff omit it | Optional **validation when publishing** or “generate poster” if business requires ref on every print |
| DM-4 | **Disconnection layout** hierarchy | Branch → municipality → areas cannot be authored structurally | New optional JSON shape (e.g. `disconnectionSchedule`) + `type` or `posterLayout` discriminator **or** separate advisory type |
| DM-5 | NGCP **table / addressee / line name** | Fidelity only in unstructured `body` | Keep 4A but add **admin guidance blocks** / optional structured `ngcpScheduleRows[]` later if editors need safer tables |

### 4.2 Copy and poster-field helpers (`interruptionPosterFields.js`)

| ID | Gap | Impact | Suggested direction |
|----|-----|--------|---------------------|
| CP-1 | Emergency headline is **`EMERGENCY OUTAGE`** | Mismatch vs print **“EMERGENCY POWER INTERRUPTION”** | Align string with cooperative branding; consider `type` + locale map |
| CP-2 | NGCP headline **`NGCP SCHEDULED INTERRUPTION`** | Mismatch vs **“NGCP SCHEDULED POWER INTERRUPTION”** (and color split in design) | Same as above |
| CP-3 | **Month name in date card** vs compact badges | Infographic uses combined badges; print may want **APRIL** / **25** / **SATURDAY** as separate slots | Export small helpers (or reuse `dateUtils`) explicitly named for **poster card slots** so HTML templates do not re-derive inconsistently |

### 4.3 Admin UX (`Interruptions.jsx` and form children)

| ID | Gap | Impact | Suggested direction |
|----|-----|--------|---------------------|
| UX-1 | **No poster layout picker** tied to data | Staff cannot declare which reference template applies (A vs B vs C) | Add `posterLayout` (or infer strictly from `type` + flags) and show **template-specific** field hints / required fields |
| UX-2 | **Preview is field list**, not WYSIWYG | Hard to catch mistakes before Puppeteer | Add **pixel preview** tab or link when print HTML exists; until then, strengthen preview (e.g. show headline + ref + slot-derived date card text) |
| UX-3 | **Grouped areas** UX is powerful but easy to leave empty | Falls back to flat list; poster may look unlike cooperative’s grouped style | Inline examples per layout; optional validation “grouped required when type = Scheduled” |
| UX-4 | **New advisory** has no `editingId` | Capture/stub only when editing existing row | Acceptable; document workflow “save then capture” **or** enable capture after first save from response id |
| UX-5 | Search / list still weak for poster ops | Hard to find advisories by `controlNo` or `body` | Extend filter/search (dashboard audit already notes partial coverage) |

### 4.4 Public feed vs poster consistency

| ID | Gap | Impact | Suggested direction |
|----|-----|--------|---------------------|
| PF-1 | `InterruptionFeedPostBody` **legacy path** (no `body`) does not show **`controlNo`** | Public card inconsistent with poster header | Render control # in legacy branch and/or in infographic header strip |
| PF-2 | Infographic does not show **reference** next to title | Poster art places `(SI…)` in header bar | Add optional ref chip to `InterruptionAdvisoryInfographic` when `controlNo` set |

### 4.5 Print route and capture pipeline

| ID | Gap | Impact | Suggested direction |
|----|-----|--------|---------------------|
| PP-1 | `PublicInterruptionPosterPage` renders **only** `InterruptionAdvisoryInfographic` | Puppeteer screenshots **feed-style** block, not full poster | New route(s) or query flag rendering **full print document** (static footer, dimensions, assets) |
| PP-2 | No explicit **viewport / paper size** contract in repo docs | Inconsistent image aspect ratio on Cloudinary | Document target width/height (e.g. 1080×1350) and implement in print CSS + Puppeteer options |
| PP-3 | **NGCP body** (rich letter) not on print page | NGCP poster cannot be captured from current URL | Separate print component that renders `body` (sanitized HTML or markdown) for `NgcScheduled` |
| PP-4 | **`GET /api/interruptions/:id` requires session** (`requireApiSession`; not in `isPublicApiRoute`) | `/poster/interruption/:id` and **Puppeteer `page.goto`** without injected auth → **401** on XHR; capture may screenshot error/empty state | Add **scoped public GET** (non-archived, visibility rules), **HMAC token** in poster URL, **server-rendered** HTML for capture, or **cookie/session** injection in Puppeteer |

### 4.6 Static poster chrome (footer, contacts, logo)

| ID | Gap | Impact | Suggested direction |
|----|-----|--------|---------------------|
| CH-1 | Disclaimer + contact bar exist only in **design references**, not in data | Correct for most cases | **Template constants** (frontend print bundle or small JSON from backend); optional env overrides for staging |
| CH-2 | Watermark / background art | Design-only | Static assets in `public/` or CDN URLs referenced only from print template |

### 4.7 Security, authorization, and session model

| ID | Gap | Notes |
|----|-----|--------|
| SEC-1 | **`DELETE /api/interruptions/:id/permanent`** — no `requireAdmin` in `backend/routes/interruptions.js` | Any **authenticated** user who passes `requireApiSession` could permanently delete an **archived** row if they know the id. **Should** use `requireAdmin` (or equivalent RBAC). |
| SEC-2 | **`POST /api/interruptions/:id/updates`** — no `requireAdmin` | Any authenticated user could append **user** remarks. Intended for staff-only memo trail → guard with admin (or interruptions-specific permission). |
| SEC-3 | **`GET /api/interruptions/:id`** — authenticated, not admin-scoped | Fine for staff tools; **blocks** true public poster URL and complicates **Puppeteer** (see **PP-4**). |

### 4.8 Database, migrations, and runtime degradation

| ID | Topic | Detail |
|----|--------|--------|
| DB-1 | **Core table** `aleco_interruptions` | Created in `backend/migrations/create_aleco_interruptions.sql` — legacy `type`/`status` enums extended in `alter_interruption_outage_type_and_energized_status.sql` (`Emergency`, `NgcScheduled`, `Energized`; `Unscheduled`→`Emergency`, `Restored`→`Energized`). |
| DB-2 | **Facebook-style fields** | `add_facebook_style_interruptions.sql` — `body`, `control_no`, `image_url`. |
| DB-3 | **Soft delete** | `add_deleted_at_aleco_interruptions.sql` — `deleted_at`; without it, DELETE is **hard** delete (legacy path in route). |
| DB-4 | **Visibility & feed** | `add_public_visible_at_interruptions.sql`, `add_pulled_from_feed_at_interruptions.sql`. |
| DB-5 | **Cause category** | `add_cause_category_interruptions.sql`. |
| DB-6 | **Nullable / constraints** | `alter_interruptions_nullable.sql`. |
| DB-7 | **Scheduled auto-energize** | `add_scheduled_restore_interruptions.sql` — `scheduled_restore_at`, `scheduled_restore_remark` (server auto-sets `Energized` when due). |
| DB-8 | **Poster alignment** | `add_affected_areas_grouped_and_poster_image_url.sql` — `affected_areas_grouped` (JSON), `poster_image_url`. |
| DB-9 | **Feeder FK** | `add_feeder_id_to_aleco_interruptions.sql`. |
| DB-10 | **Updates / remarks** | `create_aleco_interruption_updates.sql` — child table; cascades on delete. |
| DB-11 | **Cross-feature FK** | `create_aleco_b2b_mail.sql` — `aleco_b2b_messages.interruption_id` → advisories (campaigns can target an advisory). |
| DB-12 | **Runtime probes** | `interruptionsDbSupport.js` caches whether `deleted_at`, `pulled_from_feed_at`, and poster columns exist; routes **omit** columns / behavior when migrations missing (warn logs; pull/push/poster return **503** with migration hint). |

### 4.9 Background jobs (API process)

| Job | Interval | File | Role |
|-----|----------|------|------|
| `transitionScheduledStarts` | **60s** | `server.js` | `Pending` → `Ongoing` for scheduled-like types when `date_time_start` passed; system memo. |
| `autoArchiveResolvedInterruptions` | **5 min** | `server.js` | Soft-delete **Energized** rows **36h** after `date_time_restored` (aligns with `RESOLVED_ARCHIVE_HOURS` / public `RESOLVED_DISPLAY_MS`). |
| List-route side effects | On **each** `GET /api/interruptions` | `interruptions.js` | Pending→Ongoing (by `public_visible_at` / start), **auto-energize** when `scheduled_restore_at` due, **auto-archive** energized past window. |

**Implication for posters:** advisories can change **status** or disappear from public list **without** someone opening the admin UI—poster capture timing should assume **stale snapshot** if captured long after publish.

---

## 5. Prioritized additions (for planning)

Use this as a backlog skeleton; order can change with product input.

### P0 — Decide (minimal or no schema)

- Official **headline strings** per `type` (match cooperative posters).
- **ERT missing** behavior on posters (start only vs “TBD” vs hide end).
- Whether **`controlNo` is mandatory** for public bulletin or for “Generate poster” only.
- **Poster read + capture auth:** public/signed **`GET`** for print, vs server HTML, vs Puppeteer credential injection (**PP-4**, **SEC-3**).
- **RBAC:** lock down **permanent delete** and **memo POST** (**SEC-1**, **SEC-2**).

### P1 — High value for ALECO standard posters

- **`Cancelled`** (or equivalent) lifecycle + overlay rules in print + feed.
- **Reference (`controlNo`)** visible on infographic and legacy feed body path (**PF-1**, **PF-2**).
- **Authoritative print DOM** for family **A** (new component + route); point **poster-capture** at it when ready.
- **Multi-slot schedule** (if ops need it often): schema + form + `interruptionPosterFields` time display.

### P2 — NGCP and specialized layouts

- **Print template B** (letter + optional table renderer from `body` or structured JSON).
- **`posterLayout`** (or derived rules) in admin to switch guidance and capture target.
- **Family C** (disconnection): data model + admin editor + third print template.

### P3 — Dashboard polish

- Search includes `controlNo`, `body` (and optionally `type` labels).
- Pagination or higher cap if poster campaigns create large histories.
- After print HTML exists: **live preview** or open print URL from modal.

---

## 6. Implementation touch map (when planning work)

Likely files (not exhaustive):

| Layer | Files |
|-------|--------|
| Admin shell | `src/components/Interruptions.jsx` |
| Form / preview | `src/components/interruptions/InterruptionAdvisoryForm.jsx`, `InterruptionAdvisoryViewOnly.jsx`, `InterruptionPosterAlignmentPreview.jsx` |
| Poster field logic | `src/utils/interruptionPosterFields.js`, `src/utils/interruptionFormUtils.js` |
| Feed / print | `src/components/interruptions/InterruptionAdvisoryInfographic.jsx`, `InterruptionFeedPostBody.jsx`, `PublicInterruptionPosterPage.jsx`, `src/App.jsx` (routes) |
| Labels | `src/utils/interruptionLabels.js` (status/type options) |
| API / DB | `backend/routes/interruptions.js`, `backend/utils/interruptionsDto.js`, migrations if new columns |
| Capture | `backend/routes/interruptions.js` (`poster-stub`, `poster-capture`), `backend/utils/posterCaptureUrl.js` |
| Session gate | `backend/middleware/requireApiSession.js` (`isPublicApiRoute`) |
| Schedulers | `server.js` |
| DB probes | `backend/utils/interruptionsDbSupport.js` |
| Backup export | `backend/routes/backup.js` (`/api/backup/interruptions/export*`) |
| B2B mail link | `backend/services/b2bMailService.js` (reads `feeder_id` from advisory) |
| Backup UI (legacy) | `src/components/backup/BackupInterruptionFiltersForm.jsx`, `BackupInterruptionFiltersBar.jsx` |

---

## 7. Success criteria (for a later “done” definition)

- Staff can open an advisory from **`Interruptions.jsx`**, fill fields, and see **the same slots** the print template will use (preview or WYSIWYG).
- **Capture poster** produces an image that matches the **intended template** for that advisory’s type/layout (not only the feed infographic), at agreed dimensions.
- **NGCP** and **disconnection** either have dedicated authoring + print paths or are explicitly **out of scope** with documented workarounds (`body` only, external design).

---

## 8. Conclusion

**`Interruptions.jsx` already wires** list/edit lifecycle, grouped areas, poster stub/capture, and alignment preview. **Misalignment** with real posters is concentrated in **missing layout types**, **schedule expressiveness**, **cancelled state**, **headline copy**, **the DOM Puppeteer captures**, **authenticated detail fetch vs “public” print URL**, and **optional validation** so required print fields are never empty. Addressing the prioritized additions above will make poster HTML/CSS generation a **direct projection** of admin state rather than a parallel creative interpretation.

---

## 9. Appendix A — Repository inventory (interruptions feature)

**Admin UI & shell:** `src/components/Interruptions.jsx`, `src/components/AdminLayout.jsx` (active page), `src/hooks/useAdminInterruptions.js`, `src/api/interruptionsApi.js`, `src/utils/interruptionFormUtils.js`, `src/utils/interruptionLabels.js`, `src/utils/interruptionPosterFields.js`, `src/utils/interruptionWorkflowHelpers.js`, `src/utils/interruptionStatusUtils.js`, `src/utils/interruptionDateFormat.js`, `src/constants/interruptionConstants.js`, `src/components/containers/RecentOpenedAdvisories.jsx`, `src/utils/useRecentOpenedAdvisories.js`.

**Admin child components:** `src/components/interruptions/InterruptionAdvisoryForm.jsx`, `InterruptionAdvisoryViewOnly.jsx`, `InterruptionPosterAlignmentPreview.jsx`, `InterruptionAdvisoryBoard.jsx`, `InterruptionCompactView.jsx`, `InterruptionWorkflowView.jsx`, `InterruptionAdvisoryCard.jsx`, `InterruptionAdvisoryDetailModal.jsx`, `InterruptionAdvisoryFilters.jsx`, `InterruptionLayoutPicker.jsx`, `InterruptionFilterDrawer.jsx`, `UpdateAdvisoryModal.jsx`, `InterruptionAdvisoryUpdates.jsx`, `InterruptionCardActionModal.jsx`, `FeederCascadeSelect.jsx`, `InModalDateTimePicker.jsx`, `PublicInterruptionPosterPage.jsx`, `InterruptionFeedPost*.jsx`, `InterruptionAdvisoryInfographic.jsx`, `VerticalProgressIndicator.jsx`, `AsOfDateTracker.jsx`.

**Public home:** `src/InterruptionList.jsx`, `src/hooks/usePublicInterruptions.js`.

**Styles:** `src/CSS/InterruptionsAdmin.css`, `InterruptionFeed.css`, `InterruptionWorkflowView.css`, `InterruptionCompactView.css`, `InterruptionLayoutPicker.css`, `InterruptionFilterDrawer.css`, `InterruptionModalUIScale.css`, `InterruptionUIScale.css`, `PublicInterruptionPosterPage.css`, `AdminPageLayout.css`, `RecentOpenedAdvisories.css` (if referenced).

**Backend:** `backend/routes/interruptions.js`, `backend/utils/interruptionsDto.js`, `backend/utils/interruptionsDbSupport.js`, `backend/services/interruptionLifecycle.js`, `backend/constants/interruptionFieldEnums.js`, `backend/constants/interruptionConstants.js`, `backend/utils/adminNotifications.js` (interruption events), `backend/utils/posterCaptureUrl.js`.

**Related non-poster:** `backend/routes/backup.js` (interruption CSV/export), B2B mail schema/service.

---

## 10. Appendix B — SQL migrations touching `aleco_interruptions` (order for greenfield)

1. `create_aleco_interruptions.sql`  
2. `add_facebook_style_interruptions.sql`  
3. `add_deleted_at_aleco_interruptions.sql` (soft delete)  
4. `add_public_visible_at_interruptions.sql`  
5. `add_cause_category_interruptions.sql`  
6. `alter_interruptions_nullable.sql`  
7. `add_scheduled_restore_interruptions.sql`  
8. `add_pulled_from_feed_at_interruptions.sql`  
9. `alter_interruption_outage_type_and_energized_status.sql`  
10. `add_feeder_id_to_aleco_interruptions.sql`  
11. `add_affected_areas_grouped_and_poster_image_url.sql`  

`create_aleco_interruption_updates.sql` and `create_aleco_b2b_mail.sql` are dependent related tables.

---

## 11. Appendix C — API surface (interruptions router)

| Method | Path | `requireAdmin` | Public (`requireApiSession` bypass) |
|--------|------|------------------|-------------------------------------|
| GET | `/api/interruptions` | Only if admin query flags | **Yes**, when no `includeDeleted` / `deletedOnly` / `includeFuture` / `includeScheduled` |
| GET | `/api/interruptions/:id` | No | **No** — needs JWT or legacy session headers |
| POST | `/api/interruptions` | Yes | No |
| PUT | `/api/interruptions/:id` | Yes | No |
| DELETE | `/api/interruptions/:id` | Yes (soft delete) | No |
| DELETE | `/api/interruptions/:id/permanent` | **Missing** | No |
| PATCH | `/api/interruptions/:id/restore` | Yes | No |
| PATCH | `.../pull-from-feed`, `.../push-to-feed` | Yes | No |
| POST | `/api/interruptions/:id/updates` | **Missing** | No |
| POST | `/api/interruptions/upload-image` | Yes | No |
| POST | `/api/interruptions/:id/poster-stub` | Yes | No |
| POST | `/api/interruptions/:id/poster-capture` | Yes | No |

**List response shaping:** public callers get rows filtered by **`public_visible_at`**, **`pulled_from_feed_at IS NULL`** (when column exists), **`deleted_at IS NULL`** (when column exists), plus server-side status transitions (§4.9).

---

## 12. Appendix D — Items explicitly checked and not expanded elsewhere

- **`computeInitialStatus`** / `PUT` conflict handling — in `interruptionsDto.js` / `interruptions.js` (optimistic locking for admin saves).  
- **Public default list limit:** client `usePublicInterruptions` uses **50**; server clamps **1–200** (default **100** in `clampSqlInt` for list route).  
- **Admin list limit:** **200** in `useAdminInterruptions`.  
- **Image upload:** Cloudinary path via `upload.single('image')` on upload route.  
- **Poster capture env:** `PUBLIC_APP_URL` / `FRONTEND_ORIGIN`, Cloudinary, optional `POSTER_CAPTURE_VIEWPORT_WIDTH` / `HEIGHT`.  
- **Emergency type:** `publicVisibleAt` / bulletin scheduling suppressed in form UX for immediate types (per existing form logic — verify when adding poster layouts per type).
