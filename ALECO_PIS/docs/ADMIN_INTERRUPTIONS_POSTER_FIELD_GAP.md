# Admin interruptions ↔ poster design — field gap analysis

**Purpose:** Compare the **reference posters** (scheduled ALECO, emergency ALECO, NGCP scheduled) with what the **interruption dashboard** and **`aleco_interruptions`** row can supply today, so poster work and admin changes stay aligned.

**Sources:** Poster layouts described for public advisories; data model from `backend/utils/interruptionsDto.js` (`mapRowToDto`), `backend/routes/interruptions.js`, `src/utils/interruptionFormUtils.js`, `src/components/interruptions/InterruptionAdvisoryForm.jsx`.

---

## 1. Poster elements vs current data (ALECO scheduled & emergency)

These two layouts share the same information architecture (header color and title wording differ by `type`).

| Poster region | Typical content | Covered today? | Source in app |
|---------------|-----------------|----------------|---------------|
| Main title | e.g. SCHEDULED / EMERGENCY POWER INTERRUPTION | **Yes (derived)** | `item.type` → template string (`Scheduled` / `Emergency` / `NgcScheduled`) |
| Reference ID in header | e.g. `(SIAPR2026-053)` | **Yes** | `controlNo` — **optional** in DB; form has field; validate if poster requires it every time |
| Date card — month / day / weekday | e.g. APRIL / 25 / SATURDAY | **Yes (derived)** | `dateTimeStart` (PH formatting in `dateUtils` / poster component) |
| Time range | e.g. `9:00 AM - 5:00 PM` | **Partial** | `dateTimeStart` + `dateTimeEndEstimated`. If ERT is empty, poster template must define fallback (start only, or “TBD”) |
| REASON (long caps text) | Single prominent reason line | **Partial / ambiguous** | **`cause`** and **`body`** both exist; validation allows **either**. Poster must define **precedence** (e.g. `cause` else first paragraph of `body`) or staff will see inconsistent posters |
| SUBSTATION/FEEDER | e.g. WASHINGTON FEEDER 3 | **Yes** | `feeder` (and optional `feederId` for lookups — poster usually shows text) |
| AFFECTED AREAS — section title | “AFFECTED AREAS” | **Yes (static)** | Copy in template |
| AFFECTED AREAS — **grouped** blocks | “PORTION OF LEGAZPI CITY”, bullets; “MANITO — All coverage” | **No (structure)** | `affectedAreas` is a **flat list** (comma-separated in form → JSON array in DB). **No** municipality/heading grouping in schema or form |
| Re-energized time (if shown) | Actual restoration | **Yes** | `dateTimeRestored` + `status` (`Energized` / legacy `Restored`) — maintained via **Update advisory** flow, not always on create form |
| Lifecycle label on poster | Upcoming / Ongoing / Energized | **Yes** | `status` |
| Optional photo | — | **Yes** | `imageUrl` — not on all print references; optional overlay in template |
| Disclaimer + safety + contact bar + logo + watermark | Standard ALECO footer | **Not per-row** | **Template constants** (env or config if you need non-prod variants). No dashboard fields required unless you want CMS later |

**Summary (ALECO posters):** Core operational fields exist. The main **gaps** are **structured affected areas** and a **clear rule (or single field) for “REASON”** so the poster matches what editors intend.

---

## 2. NGCP scheduled poster — extra content

The NGCP reference adds a **letter-style** block and a **table**, beyond the simple ALECO bar layout.

| Poster region | Covered today? | Notes |
|---------------|----------------|-------|
| Distinct header treatment (“NGCP” + interruption title) | **Yes (derived)** | `type === 'NgcScheduled'` + copy |
| Control / reference line | **Partial** | `controlNo` may hold ALECO-style refs; NGCP codes (e.g. `NSPI-SL-D3-DAR-2026-015A`) may need **same field** with staff discipline or a **second** field |
| Addressee block (“ENGR. … Acting GM, ALECO”) | **No** | Not in `mapRowToDto` / form |
| Subject / scope sentence (e.g. line name “Daraga - Ligao 69 kV”) | **No** | Could overload **`body`** or add **`ngcpSubject`** / **`externalMemo`** |
| Table: **Date \| Time \| Affected substation \| Activities** | **No** | No structured columns; would need **`body`** (HTML/Markdown), **`ngcpTableJson`**, or attachment |
| Closing paragraph | **No** | Static in template or part of **`body`** |
| NGCP letterhead / logo strip | **Static assets** | Design-only unless you parameterize addresses |

**Summary (NGCP):** Fidelity to the third poster **cannot** rely on the current **quick fields** alone; you need **`body` as rich document**, **new JSON/text columns**, or **attached PDF/image** from comms.

**Implemented strategy (4A — body-only):** NGCP letter-style copy, addressee lines, and tabular schedules are authored in the advisory **`body`**. Quick fields still drive the shared banner/infographic when `type === 'NgcScheduled'`. The admin **Poster fields preview** reminds editors that the body carries extended NGCP content. There is no `poster_extension_json` column.

---

## 3. Dashboard (admin form) — what exists today

From `InterruptionAdvisoryForm` + `buildInterruptionPayload`:

- **Classification:** `type`, `causeCategory`, `controlNo`, `feeder`, `feederId`
- **Schedule:** `dateTimeStart`, `dateTimeEndEstimated`, `publicVisibleAt` / `schedulePublicLater` (suppressed for emergency type), `scheduleAutoRestore`, `scheduledRestoreAt`, `scheduledRestoreRemark`
- **Content:** `body`, `cause`, `affectedAreasText` → `affectedAreas[]`, `affectedAreasGrouped[]`, `imageUrl`, `posterImageUrl` (read-only / stub until capture)
- **Not on create payload:** lifecycle `status` changes (handled in `UpdateAdvisoryModal`); `dateTimeRestored` only passed on edit when present on form

**Implication:** Anything the poster must show that is **not** in this list must be **added to form + payload + DB + DTO** (or intentionally stuffed into `body` with editor training).

---

## 4. Gap list — what to add or decide (prioritized)

### P0 — Decide (no schema change)

| ID | Gap | Recommendation |
|----|-----|----------------|
| D-1 | **REASON source** | Document rule: e.g. poster REASON = `cause` if non-empty, else `body` (plain), else “—”. Optionally **require `cause`** when poster layout is selected or for public publish. |
| D-2 | **Time range when ERT missing** | Template: show start-only, or hide end line, or show “Until further notice” per ops policy. |
| D-3 | **Reference number required?** | If poster always shows `(controlNo)`, add **validation** when saving for feed/public. |

### P1 — Structured affected areas (matches grouped poster)

| ID | Gap | Recommendation |
|----|-----|----------------|
| S-1 | **Grouped areas** | Extend model: e.g. `affectedAreasGrouped: { heading: string, items: string[] }[]` stored as **JSON column**, with admin UI (repeatable section) **or** strict **textarea convention** (parse headings) — convention is cheaper, structured is safer. |
| S-2 | **Migration + DTO** | `serialize`/`parse` in `interruptionsDto.js`; form state mirror; backward compatibility: if new field empty, fall back to flat `affectedAreas`. |

### P2 — NGCP-specific content

| ID | Gap | Recommendation |
|----|-----|----------------|
| N-1 | Letter addressee / subject / table | **Option A:** Rich **`body`** (admin rich-text) for NGCP-only. **Option B:** Columns `ngcpAddressee`, `ngcpSubject`, `ngcpScheduleTable` (JSON array of rows). **Option C:** Single **`posterExtensionJson`** blob for rare layouts. |
| N-2 | Separate ALECO vs NGCP control numbers | Only if both must appear: `ngcpControlNo` vs `controlNo`. |

### P3 — Poster pipeline alignment (not fields, but admin UX)

| ID | Gap | Recommendation |
|----|-----|----------------|
| U-1 | **Live poster preview** in admin | New panel or layout mode rendering the same `InterruptionAdvisoryPoster` component from `editDetail` / `form` state. |
| U-2 | **Stored poster image URL** (Cloudinary) | Column e.g. `poster_image_url` + regenerate button; optional for HTML-only public feed at first. |

---

## 5. Matrix: reference poster → DB column

| Poster need | Column / field today | Action |
|-------------|----------------------|--------|
| Title / theme | `type` | OK |
| Reference | `control_no` | OK; consider required-for-publish |
| Start / ERT | `date_time_start`, `date_time_end_estimated` | OK; define missing-ERT UX |
| Reason | `cause`, `body` | **Policy or merge field** |
| Feeder | `feeder`, `feeder_id` | OK |
| Areas (flat) | `affected_areas` | OK |
| Areas (grouped) | `affected_areas_grouped` (JSON) | **Added** — optional; flat `affected_areas` fallback in `interruptionPosterFields` |
| Status / energized | `status`, `date_time_restored` | OK |
| Image | `image_url` | OK |
| NGCP letter + table | **`body`** (4A) | Rich text in post body; optional future JSON if needed |
| Poster image asset | `poster_image_url` | Optional; stub/generate until Puppeteer + Cloudinary pipeline |
| Footer/contact/logo | — | **Constants in template** |

---

## 6. Related documents

- `docs/ADMIN_INTERRUPTIONS_DASHBOARD_AUDIT.md` — overall admin screen behavior  
- Implementation: `src/utils/interruptionFormUtils.js`, `backend/routes/interruptions.js`, `backend/utils/interruptionsDto.js`

---

## 7. Short conclusion

The dashboard already supports **most ALECO scheduled/emergency poster slots** with **REASON precedence** and **time-range helpers** in `src/utils/interruptionPosterFields.js`. **Grouped affected areas** use `affected_areas_grouped` with a flat-list fallback. **NGCP** extended content uses **strategy 4A** (rich **`body`**). **Poster preview** lives in admin (`InterruptionPosterAlignmentPreview`). **Public print route:** `/poster/interruption/:id` for Puppeteer. **Poster stub API:** `POST /api/interruptions/:id/poster-stub` sets `poster_image_url` (Cloudinary placeholder when configured, else `stub://` or `INTERRUPTION_POSTER_STUB_BASE_URL`).
