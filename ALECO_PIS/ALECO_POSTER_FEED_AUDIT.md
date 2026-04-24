# ALECO PIS — Interruption Feed & Poster System Audit

> Last updated: April 23 2026  
> Covers: backend scheduling fix, poster CSS variables, feed card redesign, expanded modal, all patterns & rules.

---

## 1. System Overview

The interruption system has **two visual layers**:

| Layer | What it is | File |
|---|---|---|
| **Feed Card** | Compact thumbnail in the public carousel | `InterruptionFeedPost.jsx` |
| **Expanded Modal** | Fullscreen view opened by clicking a card | `InterruptionFeedExpandedView.jsx` |
| **Print Poster Component** | The live-rendered ALECO design (also used as fallback in modal) | `InterruptionAlecoPrintPoster.jsx` |
| **Captured Poster Image** | Puppeteer screenshot of the print poster, stored on Cloudinary | `posterImageUrl` field on the DTO |

The feed card shows the **captured image** when `posterImageUrl` is available, or falls back to a text infographic. The expanded modal shows the captured image when available, or falls back to the **live-rendered** `InterruptionAlecoPrintPoster` component.

---

## 2. Advisory Types & Their CSS Class Modifiers

### Backend Types (DB / API)
| API Type | Display | CSS Modifier (card) | Poster CSS class |
|---|---|---|---|
| `Scheduled` | Scheduled Power Interruption | `interruption-feed-post--type-scheduled` | `aleco-print-poster--scheduled` |
| `NgcScheduled` | NGC Scheduled | `interruption-feed-post--type-ngcscheduled` | `aleco-print-poster--ngcscheduled` |
| `Emergency` | Emergency Power Interruption | `interruption-feed-post--type-emergency` | `aleco-print-poster--emergency` |
| `Unscheduled` | (also emergency-flavoured) | `interruption-feed-post--type-emergency` | `aleco-print-poster--emergency` |

### How the type modifier is computed in `InterruptionFeedPost.jsx`
```js
const typeModifier = isEmergencyOutageType(item.type) ? 'emergency'
  : item.type === 'NgcScheduled' ? 'ngcscheduled'
  : 'scheduled';
```
`isEmergencyOutageType()` lives in `src/utils/interruptionLabels.js`.

---

## 3. Poster CSS Variable System (`InterruptionPrintPoster.css`)

All poster colours are driven by **CSS custom properties** set on `.aleco-print-poster`. Type modifier classes override individual variables without touching the rest.

### Base variables (Scheduled defaults)
```css
.aleco-print-poster {
  --poster-header-bg:          #0d1f6b;   /* dark navy — header band + right col bg */
  --poster-header-bg2:         #0a1550;
  --poster-accent-red:         #1d4ed8;   /* BLUE for scheduled labels */
  --poster-day-num-color:      #1d4ed8;   /* BLUE day number */
  --poster-feeder-bg:          #1e2d6b;   /* feeder row bg */
  --poster-datecard-bottom-bg: #162040;   /* THU-FRI badge bg */
  --poster-footer-bg:          #060e38;
}
```

### Emergency override
```css
.aleco-print-poster--emergency {
  --poster-header-bg:     #c41818;   /* red header */
  --poster-header-bg2:    #c41818;
  --poster-accent-red:    #ef4444;   /* red labels */
  --poster-day-num-color: #c41818;   /* red day number */
  --poster-footer-bg:     #2d0707;
  /* feeder-bg and datecard-bottom-bg intentionally NOT overridden — stay dark navy */
}
```

### Scheduled contrast override (blue header + red accents)
```css
.aleco-print-poster--scheduled {
  --poster-feeder-bg:          #c41818;   /* RED feeder row — contrast against blue header */
  --poster-datecard-bottom-bg: #c41818;   /* RED THU-FRI badge */
}
```
> **Rule:** Scheduled = blue header + red feeder/date-badge. Emergency = red header + navy feeder/date-badge. This creates opposite colour contrasts so the two types are always visually distinguishable.

### Energized override
```css
.aleco-print-poster--energized {
  --poster-header-bg:     #15803d;   /* green */
  --poster-feeder-bg:     #14532d;
  --poster-footer-bg:     #052e16;
}
```

### The `--poster-datecard-bottom-bg` variable
This was **added in this session** to make the date card bottom colour controllable per type. Previously it was hardcoded `#162040`. The variable allows the scheduled type to use red (`#c41818`) while emergency/NgcScheduled keep navy.

---

## 4. Poster Capture Pipeline

```
Admin creates advisory
  → backend/routes/interruptions.js generates posterImageUrl via Puppeteer
  → Puppeteer navigates to /print-interruption/:id
  → body.poster-capture-mode resets layout to full-bleed golden background
  → .aleco-print-poster renders at max-width: 900px with padding: 18px
  → Screenshot saved to Cloudinary
  → posterImageUrl stored in DB
```

**Puppeteer viewport:** `900 × variable height @2x deviceScaleFactor`  
The poster height adapts to content (number of affected area groups). This is why different advisories produce images with **different aspect ratios**.

---

## 5. Feed Card Architecture (`InterruptionFeedPost.jsx`)

### Current structure (post-redesign)
```jsx
<article class="interruption-feed-post
                interruption-feed-post--type-{emergency|scheduled|ngcscheduled}
                [interruption-feed-post--poster]">

  <div class="feed-post-status-banner">          <!-- floats ABOVE card top border -->
    <span class="feed-post-status-chip feed-post-status-chip--{status}">
      ENERGIZED / ONGOING / PENDING
    </span>
  </div>

  {/* if posterImageUrl exists */}
  <div class="feed-post-poster-display">
    <img class="feed-post-poster-img" ... />
  </div>

  {/* else */}
  <div class="feed-post-no-image-body">
    <InterruptionFeedPostBody />
    <InterruptionAdvisoryInfographic />
  </div>

</article>
```

### What was removed in this session
- `InterruptionFeedPostHeader` (ALECO logo, status chip, globe icon) — the card is now poster-only
- The `feed-post-expand-btn` button — clicking the entire card now opens the modal
- "Posted at" / "Updated at" timestamps from the header

### Click-to-expand pattern
```js
const clickable = !isExpandedView && Boolean(onExpand);
// article gets: onClick, role="button", tabIndex=0, onKeyDown (Enter/Space)
```

---

## 6. Feed Card CSS Rules

### The card itself (`.interruption-feed-post`)
```css
.interruption-feed-post {
  width: fit-content;                              /* adapts to poster's natural width */
  min-width: min(280px, 92vw);
  max-width: min(720px, 92vw);
  height: calc(380px * var(--public-section-scale, 1));  /* FIXED height */
  overflow: visible;                               /* lets banner escape above the border */
  position: relative;                              /* anchor for the absolute banner */
  border-radius: 16px;
  border: 1px solid var(--border-color);
}
```

> **Key design rule:** Height is fixed (`380px × scale`). Width is adaptive (`fit-content`).  
> This guarantees all cards have the same height regardless of poster content,  
> while each card's width follows the poster's natural aspect ratio without cropping.

### Type-coloured top border
```css
.interruption-feed-post                    { border-top: 3px solid #8b1a1a; }  /* emergency red */
.interruption-feed-post--type-scheduled,
.interruption-feed-post--type-ngcscheduled { border-top-color: #1d4ed8; }      /* blue */

[data-theme='dark'] .interruption-feed-post                    { border-top-color: #ef4444; }
[data-theme='dark'] .interruption-feed-post--type-scheduled,
[data-theme='dark'] .interruption-feed-post--type-ngcscheduled { border-top-color: #3b82f6; }
```

### Poster modifier (`.interruption-feed-post--poster`)
```css
.interruption-feed-post--poster {
  height: calc(380px * var(--public-section-scale, 1));
  overflow: visible;
}

.interruption-feed-post--poster .feed-post-poster-display {
  height: 100%;            /* fills the fixed card height */
  flex: none;
  overflow: hidden;
  border-radius: 16px;
  margin: 0;               /* overrides base .feed-post-poster-display margin: 4px 14px 14px */
  border: none;            /* overrides base border */
  box-shadow: none;        /* overrides base shadow */
  background: var(--bg-card);
}

.interruption-feed-post--poster .feed-post-poster-img {
  display: block;
  height: 100%;   /* scale to fixed card height */
  width: auto;    /* natural proportional width — zero cropping */
  border-radius: 16px;
}
```

> **Critical rule:** The base `.feed-post-poster-display` rule has `margin: 4px 14px 14px` and  
> `border: 1px solid`. The `--poster` modifier override **must explicitly reset** these to zero,  
> otherwise the poster renders inside a 14px-inset box and appears left-cropped.

### Floating status banner
```css
.feed-post-status-banner {
  position: absolute;
  top: 1px;
  right: 14px;
  transform: translateY(-100%);   /* fully above the card's top border */
  z-index: 10;
  pointer-events: none;
}
```

> **Why `overflow: visible` on the card is required:** With `overflow: hidden` the banner at  
> `translateY(-100%)` would be clipped. The poster display handles its own clipping with  
> `overflow: hidden` + `border-radius: 16px`, so the card itself can be `overflow: visible`.

> **Why `padding-top: 44px` on `.interruption-feed`:** The feed container has `overflow-y: hidden`.  
> The banner extends ~28px above each card. Without enough top padding the banner would fall  
> outside the feed container's clipping boundary. `padding-top: 44px` keeps the banner inside  
> the padding box (which `overflow-y: hidden` does NOT clip).

---

## 7. Feed Container (`.interruption-feed`)

```css
.interruption-feed {
  display: flex;
  flex-direction: row;
  gap: 32px;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 44px 2px 18px 2px;   /* 44px top = room for the floating banner */
  scroll-snap-type: x mandatory;
  align-items: flex-start;
}
```

**Scrolling:** Horizontal snap-scroll carousel. Cards use `scroll-snap-align: start`.  
**Navigation:** `◀ ▶` buttons in the `feed-controls` row call `feedRef.current.scrollBy()`.

---

## 8. Expanded Modal Architecture (`InterruptionFeedExpandedView.jsx`)

```
feed-expanded-overlay       fixed full-screen, backdrop blur, click-outside closes
└── feed-expanded-panel     scrollable panel
    ├── feed-expanded-topbar    status chip + type label + ref + close button
    ├── feed-expanded-poster-wrap
    │       if posterImageUrl → <img class="feed-expanded-poster-img">
    │       else              → <InterruptionAlecoPrintPoster item={item} />
    └── feed-expanded-details   full structured data (schedule, cause, feeder, areas, meta)
```

> **Important:** The modal uses the **live-rendered** `InterruptionAlecoPrintPoster` as fallback  
> (not the infographic). This means advisories without a captured image still show the designed  
> poster layout in the modal. The `InterruptionPrintPoster.css` is imported directly into  
> `InterruptionFeedExpandedView.jsx` for this reason.

The poster-wrap in the modal keeps `background: #d4a84b` (golden sand) which matches the poster's  
own page background — intentional, looks good in the modal. Do **not** change this to `var(--bg-card)`.

---

## 9. Backend: Scheduled Advisory Visibility Fix

**Problem:** `NOW()` in MySQL was returning UTC time. Philippine time (+8h) datetimes stored in DB  
were being compared against UTC, causing scheduled advisories to appear 8 hours late.

**Fix:** All SQL `WHERE` clauses that compare against current time were changed from `NOW()` to:
```sql
DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR)
```

**`meta.nextScheduledAt` in API response:** The backend now returns the earliest future  
`public_visible_at` timestamp so the frontend can schedule a precise refetch exactly when  
the next advisory becomes public (instead of relying purely on polling intervals).

**Frontend hook (`usePublicInterruptions.js`):** Reads `meta.nextScheduledAt` and schedules a  
`setTimeout` to refetch ~1 second after that time. Falls back to 30s polling otherwise.

---

## 10. Backend: Auto-Restore Status Bug Fix

**Problem:** The auto-restore SQL was hardcoding `'Energized'` as the status to write to the DB,  
but the DB ENUM only has `'Restored'` (not `'Energized'`). This caused `WARN_DATA_TRUNCATED` and  
a server crash.

**Fix:** Used `apiInterruptionStatusToDbLiteral('Energized', statusDbEnum)` to dynamically resolve  
the correct DB literal before building SQL statements:
```js
const statusDbEnum = await getAlecoInterruptionsStatusDbEnum(pool);
const energizedDbLiteral = apiInterruptionStatusToDbLiteral('Energized', statusDbEnum).status ?? 'Energized';
```

**Rule:** Never hardcode status literals in SQL. Always resolve them through `apiInterruptionStatusToDbLiteral`.

---

## 11. Modular Scale System

All public-facing size values scale down on smaller viewports using:
```css
var(--public-section-scale, 1)
```

The `--public-section-scale` CSS variable is set on the public page wrapper based on viewport width.  
Card height, font sizes, and padding all multiply against this variable, ensuring proportional  
scaling without separate media query overrides for most properties.

---

## 12. Status Chip Colours

```css
.feed-post-status-chip--pending   { background: rgba(245,158,11,0.22); color: #b45309; }
.feed-post-status-chip--ongoing   { background: #dc2626; color: #ffffff; }
.feed-post-status-chip--restored,
.feed-post-status-chip--energized { background: rgba(22,163,74,0.18); color: #15803d; }

/* dark mode */
.feed-post-status-chip--pending   { background: rgba(245,158,11,0.25); color: #fbbf24; }
.feed-post-status-chip--ongoing   { background: #ef4444; color: #ffffff; }
.feed-post-status-chip--restored,
.feed-post-status-chip--energized { background: rgba(34,197,94,0.2);  color: #4ade80; }
```

---

## 13. File Map

| File | Purpose |
|---|---|
| `src/components/interruptions/InterruptionFeedPost.jsx` | Feed card component |
| `src/components/interruptions/InterruptionFeedExpandedView.jsx` | Fullscreen modal |
| `src/components/interruptions/InterruptionAlecoPrintPoster.jsx` | Live poster renderer |
| `src/components/interruptions/InterruptionFeedPostBody.jsx` | Text body for no-image cards |
| `src/components/interruptions/InterruptionAdvisoryInfographic.jsx` | Infographic for no-image cards |
| `src/CSS/InterruptionFeed.css` | All feed, card, banner, modal CSS |
| `src/CSS/InterruptionPrintPoster.css` | All poster CSS variables and layout |
| `src/hooks/usePublicInterruptions.js` | Polling hook + nextScheduledAt timeout |
| `src/api/interruptionsApi.js` | API client — returns `{ interruptions, meta }` |
| `backend/routes/interruptions.js` | REST routes — visibility filters, auto-upgrade, auto-restore |
| `backend/utils/interruptionTypeDbEnum.js` | `apiInterruptionStatusToDbLiteral` mapping |

---

## 14. Rules & Patterns to Preserve

1. **Never change the expanded modal poster background** (`background: #d4a84b`). The golden colour is correct context for the full poster view.
2. **The card's `overflow: visible` is intentional.** The poster display clips itself. Changing the card to `overflow: hidden` will clip the status banner.
3. **Always zero out margin/border on `.feed-post-poster-display` in the `--poster` context.** The base rule has `margin: 4px 14px 14px` which will cause inset/crop if not explicitly reset.
4. **Feed `padding-top: 44px` must be preserved** (or increased, never decreased). Reducing it clips the floating status banner.
5. **Type modifier classes drive both card border colour AND poster CSS variables.** They must always be in sync — the same type string determines both.
6. **DB status literals vs API labels:** `Energized` (API/display) maps to `Restored` (DB ENUM). Never hardcode either in SQL — use `apiInterruptionStatusToDbLiteral`.
7. **Timezone:** All SQL `NOW()` comparisons must use `DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR)`. The MySQL pool uses `timezone: '+08:00'` but remote (Aiven) MySQL ignores this for `NOW()`.

---

## 15. Advisory DTO Shape (`mapRowToDto`)

The backend `mapRowToDto` function in `backend/utils/interruptionsDto.js` normalises legacy DB values on the way out:

| DB value | API/DTO value | Reason |
|---|---|---|
| `type = 'Unscheduled'` | `type = 'Emergency'` | Legacy rows; renamed in migration |
| `status = 'Restored'` | `status = 'Energized'` | Pre-migration ENUM name |
| `affected_areas` (string/JSON) | `affectedAreas: string[]` | Parsed by `parseAffectedAreas` |
| `affected_areas_grouped` (JSON) | `affectedAreasGrouped: { heading, items[] }[]` | Parsed by `parseAffectedAreasGroupedFromDb` |
| `poster_image_url` | `posterImageUrl` | `null` when blank string |

All datetime columns come from DB as Philippine time strings (`dateStrings: true` in pool config).  
`toIsoForClient()` treats them as `+08:00` and converts to UTC ISO for the client.  
**Rule:** Never use `toISOString()` directly on DB datetime values — always go through `toIsoForClient()`.

---

## 16. Advisory Lifecycle & Automatic Status Transitions

Every `GET /api/interruptions` request triggers three side-effect SQL updates before returning data:

### 1 — Auto-upgrade: `Pending → Ongoing`
```sql
UPDATE aleco_interruptions
SET status = 'Ongoing', updated_at = ?
WHERE status = 'Pending'
  AND deleted_at IS NULL
  AND COALESCE(public_visible_at, date_time_start) <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR)
```
Triggers when the advisory's go-live time has passed. Uses `public_visible_at` when set, otherwise falls back to `date_time_start`.

### 2 — Auto-restore: `Pending|Ongoing → Energized` when `scheduled_restore_at` passes
```sql
UPDATE aleco_interruptions
SET status = '{energizedDbLiteral}', date_time_restored = ?, scheduled_restore_at = NULL, updated_at = ?
WHERE status IN ('Pending','Ongoing')
  AND deleted_at IS NULL
  AND scheduled_restore_at IS NOT NULL
  AND scheduled_restore_at <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR)
```
Also inserts a system update log entry: `"Auto-restored: {remark}"`.

### 3 — Auto-archive: `Energized → soft-deleted` after display window
```sql
UPDATE aleco_interruptions
SET deleted_at = ?
WHERE status = '{energizedDbLiteral}'
  AND deleted_at IS NULL
  AND date_time_restored IS NOT NULL
  AND DATE_ADD(date_time_restored, INTERVAL 36 HOUR) <= ?
```
Uses `RESOLVED_ARCHIVE_HOURS = 36` (from `backend/constants/interruptionConstants.js`).

### `computeInitialStatus` — status at creation time
```js
// Scheduled/NgcScheduled with future start → 'Pending'; everything else → 'Ongoing'
if (INTERRUPTION_SCHEDULED_LIKE_TYPES.has(type) && startMs > Date.now()) return 'Pending';
return 'Ongoing';
```
Emergency advisories are **always created as `Ongoing`** regardless of start time.

---

## 17. DB Migration Compatibility Layer

The backend checks column/feature support at runtime to stay backward-compatible with pre-migration databases:

| Helper function | Checks for |
|---|---|
| `getAlecoInterruptionsDeletedAtSupported(pool)` | `deleted_at` column (soft-delete) |
| `getAlecoInterruptionsPulledFromFeedAtSupported(pool)` | `pulled_from_feed_at` column |
| `getAlecoInterruptionsPosterExtrasSupported(pool)` | `poster_image_url` + `affected_areas_grouped` columns |
| `getAlecoInterruptionsTypeDbEnum(pool)` | Live ENUM values for `type` column |
| `getAlecoInterruptionsStatusDbEnum(pool)` | Live ENUM values for `status` column |

Results are typically cached in-process. This means **all four helpers must be called fresh per request** if the schema may have been migrated while the server was running.

---

## 18. `publicVisibleAt` & `pulledFromFeedAt` Fields

### `public_visible_at`
- Set by admin to schedule when an advisory first appears on the public feed.
- If `NULL`, the advisory is immediately visible (no scheduling delay).
- The visibility clause is:  
  `(public_visible_at IS NULL OR public_visible_at <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))`
- When `public_visible_at > NOW_PH`, the advisory is returned in `meta.nextScheduledAt` so the frontend can schedule a precise refetch.

### `pulled_from_feed_at`
- Set when admin uses **"Pull from feed"** — temporarily hides the advisory from public without archiving.
- Visibility clause: `pulled_from_feed_at IS NULL`
- Admin can **"Push to feed"** to restore it: sets `pulled_from_feed_at = NULL`.
- API endpoints: `PATCH /api/interruptions/:id/pull-from-feed` and `PATCH /api/interruptions/:id/push-to-feed`.

---

## 19. Soft Delete Pattern

`deleted_at` is a nullable `DATETIME`. Advisory is "archived" when `deleted_at IS NOT NULL`.

- `DELETE /api/interruptions/:id` — soft delete (sets `deleted_at = NOW_PH`)
- `PATCH /api/interruptions/:id/restore` — restores (sets `deleted_at = NULL`)
- `DELETE /api/interruptions/:id/permanent` — hard delete (only works if already soft-deleted)
- Public feed always adds `deleted_at IS NULL` to its WHERE clause.

---

## 20. Admin-Only Query Flags & `requireAdminIfListQueryFlags`

The `GET /api/interruptions` route is **public by default**, but elevates to admin when these query params are present:

| Query param | Effect |
|---|---|
| `includeFuture=1` | Shows `public_visible_at > NOW_PH` advisories |
| `includeDeleted=1` | Includes soft-deleted rows |
| `deletedOnly=1` | Only soft-deleted rows |
| `includeScheduled=1` | Alias for `includeFuture=1` |

The guard function `requireAdminIfListQueryFlags` checks for these flags and calls `requireAdmin` middleware conditionally. Without any flags, the request passes through as public.

> **Router anti-pattern to avoid:** Using `router.use(requireAdmin)` at the top of a router file mounted on a shared prefix (e.g. `/api`) will block ALL `/api/*` routes, including public ones from other router files. Always use inline per-route middleware: `router.get('/path', requireAdmin, handler)`.

---

## 21. Full API Endpoint Reference

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/interruptions` | Public / Admin-if-flags | List advisories (triggers lifecycle automations) |
| `GET` | `/api/interruptions/:id` | Admin | Single advisory (full detail) |
| `GET` | `/api/public/interruptions/:id` | Public | Single advisory snapshot (public visibility rules) |
| `POST` | `/api/interruptions` | Admin | Create advisory |
| `PUT` | `/api/interruptions/:id` | Admin | Full update advisory |
| `DELETE` | `/api/interruptions/:id` | Admin | Soft delete (archive) |
| `PATCH` | `/api/interruptions/:id/restore` | Admin | Un-archive |
| `DELETE` | `/api/interruptions/:id/permanent` | Admin | Hard delete (only if already soft-deleted) |
| `PATCH` | `/api/interruptions/:id/pull-from-feed` | Admin | Temporarily hide from public |
| `PATCH` | `/api/interruptions/:id/push-to-feed` | Admin | Re-publish to public |
| `POST` | `/api/interruptions/upload-image` | Admin | Upload image to Cloudinary |
| `POST` | `/api/interruptions/:id/updates` | Admin | Add update/remark to advisory log |
| `POST` | `/api/interruptions/:id/poster-stub` | Admin | Set stub `posterImageUrl` placeholder |
| `POST` | `/api/interruptions/:id/poster-capture` | Admin | Puppeteer screenshot → Cloudinary |

---

## 22. Poster Capture Service

**`captureInterruptionPosterForAdmin(pool, id)`** (in `backend/services/interruptionPosterCapture.js`):
1. Resolves the public app base URL via `getPublicAppBaseUrl()`
2. Launches Puppeteer → navigates to `/poster/interruption/:id`
3. Page renders `InterruptionAlecoPrintPoster` (React) on `body.poster-capture-mode`
4. Screenshots at `900×variable height @2x deviceScaleFactor`
5. Uploads to Cloudinary → stores URL in `poster_image_url`

**`maybeRegeneratePosterAfterMutation(pool, id)`**: called after `PUT /interruptions/:id`. If the advisory has an existing `poster_image_url` and field changes were substantial (cause, feeder, affected areas, dates), it triggers a new capture automatically.

---

## 23. Poster Fields Utility — REASON Precedence

`getPosterReasonText(item)` in `src/utils/interruptionPosterFields.js` selects the reason text by priority:

```
1. item.cause         (legacy single-line reason field)
2. item.body          (first paragraph only — firstParagraphOrFull())
3. causeCategory      (resolved via getCauseCategoryLabel())
4. em-dash '—'        (fallback)
```

`getPosterReasonTextUpper()` = same but `.toUpperCase()` for the poster display.

---

## 24. `posterImageUrl` Stub Detection

Both `InterruptionFeedPost.jsx` and `InterruptionFeedExpandedView.jsx` check for stubs before using the URL:

```js
const isBlankStub = typeof item.posterImageUrl === 'string'
  && item.posterImageUrl.includes('_stub');
const safePosterUrl = (!isBlankStub && item.posterImageUrl)
  ? getSafeResourceUrl(item.posterImageUrl)
  : null;
```

- A **stub** (`_stub` in URL) = placeholder set while Puppeteer capture runs. Treated as no image.
- `getSafeResourceUrl()` blocks non-`http(s)` protocols (XSS hardening). Returns `null` for `javascript:`, `data:`, `blob:`, etc.
- If `safePosterUrl` is `null`: feed card shows infographic; modal shows live `InterruptionAlecoPrintPoster`.

---

## 25. Affected Areas — Flat vs Grouped

Two parallel data structures exist on each advisory:

| Field | Type | When used |
|---|---|---|
| `affectedAreas` | `string[]` | Legacy; flat list of barangay/area names |
| `affectedAreasGrouped` | `{ heading: string, items: string[] }[]` | When areas are grouped by municipality/district |

Rendering priority (poster + modal): **grouped first, flat as fallback**.  
The `getPosterAffectedAreasGrouped(item)` utility returns `[]` if no groups, then the poster component falls back to the flat `affectedAreas` list.

---

## 26. `usePublicInterruptions` — Polling Strategy

Three concurrent refresh mechanisms:

| Trigger | Interval / Timing | Notes |
|---|---|---|
| On mount | Immediate (spinner) | Initial load |
| Tab visibility change | Instant on focus | `visibilitychange` event |
| Background poll (normal) | Every 30 s | Only when tab visible |
| Background poll (fast) | Every 10 s | When any advisory has `dateTimeStart > now` or `publicVisibleAt > now` |
| Precise timeout | `nextScheduledAt + 1000 ms` | Fires ~1s after a scheduled advisory goes live; clears old timer when updated |

The fast poll (`POLL_MS_FAST = 10_000`) kicks in when an advisory is upcoming, so the status flip from Pending → Ongoing happens quickly for the public user.

---

## 27. Payload Validation (`validatePayload`)

The backend validates all `POST`/`PUT` bodies before touching the DB:

| Field | Required | Rule |
|---|---|---|
| `type` | Yes (full) | Must be in `INTERRUPTION_TYPES` set |
| `status` | Yes (full) | Must be in `INTERRUPTION_STATUSES` set |
| `feeder` | Yes | Non-empty text OR valid `feederId` integer |
| `cause` or `body` | At least one (full) | Cannot both be blank on create |
| `dateTimeStart` | Yes (full) | Must parse via `toMysqlDateTime()` |
| `publicVisibleAt` | No | If provided, must parse via `toMysqlDateTime()` |
| `causeCategory` | No | If provided, must be from allowed set |
| `affectedAreasGrouped` | No | Must be array if provided |

Partial updates (`PUT` with `partial: true`) only validate provided fields.

---

## 28. Date/Time Handling Rules

| Operation | Function | Rule |
|---|---|---|
| Store datetime from client | `toMysqlDateTime(input)` | Store wall-clock Philippine time verbatim — **never** convert via UTC |
| Read datetime from DB row | `toMysqlDateTimeFromRow(val)` | Returns `YYYY-MM-DD HH:mm:ss` string |
| Send datetime to client | `toIsoForClient(val)` | Treats DB string as `+08:00`, returns UTC ISO string |
| Display datetime in UI | `formatToPhilippineTime(isoUtc)` | Client converts UTC ISO → Philippine civil time |
| SQL comparisons in queries | `DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR)` | Safe Philippine NOW for Aiven/remote MySQL |
| PHP-style wall time for `updated_at` writes | `nowPhilippineForMysql()` | Returns current Philippine time as `YYYY-MM-DD HH:mm:ss` |

---

## 29. SQL Safety: `LIMIT` Interpolation

The list query uses **string interpolation** for `LIMIT`, not a prepared statement `?` placeholder:
```js
`SELECT ... FROM aleco_interruptions${visibilityWhere} ORDER BY date_time_start DESC LIMIT ${limit}`
```
This is safe because `limit` is server-clamped via `clampSqlInt(req.query.limit, 1, 200, 100)`.  
Reason: some MySQL/MariaDB builds throw `ER_WRONG_ARGUMENTS` for `LIMIT ?` in prepared statements.

---

## 30. `controlNo` / Reference Number Format

Stored as `control_no` in the DB. Displayed as `(SIAPR2026-053)` on the poster.  
`getPosterReferenceDisplay(controlNo)`:
- Wraps in parentheses if not already wrapped
- Returns empty string if blank (no ref line rendered on poster)

---

## 31. `PrintInterruptionPosterPage` — Puppeteer Capture Target

**Route:** `/print-interruption/:id` (React Router)  
**File:** `src/components/interruptions/PrintInterruptionPosterPage.jsx`

This is the page Puppeteer navigates to when capturing a poster screenshot. Its lifecycle:

1. Adds `poster-capture-mode` class to `document.body` on mount (removed on unmount)
2. Calls `getPublicInterruptionSnapshot(id)` — the **public** API endpoint (no auth needed)
3. Renders `<InterruptionAlecoPrintPoster item={item} />` inside `.print-poster-page`

The `poster-capture-mode` body class triggers the CSS reset in `InterruptionPrintPoster.css`:
```css
body.poster-capture-mode {
  margin: 0 !important;
  padding: 0 !important;
  background: #d4a84b !important;  /* golden sand — the poster outer background */
  overflow-x: hidden;
}
```

> **Rule:** The poster capture route uses the **public** snapshot API (no auth). This means the advisory must be publicly visible at capture time. If `public_visible_at` is in the future, the snapshot will return 404 and the poster won't capture. Admin-initiated captures bypass this via the internal service.

---

## 32. `PublicInterruptionPosterPage` — Shareable Poster View

**Route:** `/poster/interruption/:id`  
**File:** `src/components/interruptions/PublicInterruptionPosterPage.jsx`

A public-facing poster preview page (not for Puppeteer — for sharing/embedding). Renders the same `InterruptionAlecoPrintPoster` in a scrollable/centered layout. This is the human-readable share page.

---

## 33. Orphaned / Legacy Components

These components remain in the codebase but are **no longer rendered in the public feed card**:

| Component | Status | Notes |
|---|---|---|
| `InterruptionFeedPostHeader.jsx` | **Orphaned** | Previously rendered ALECO branding + status chip in the card header. Removed in this session. Still valid for admin/compact views. |
| `.feed-post-expand-btn` (CSS) | **Orphaned** | CSS class for the old "expand" button removed from the card. Still has media query rules. Can be deleted safely. |

> **Note:** `InterruptionFeedPostHeader` is still imported and used by the **admin dashboard** card views (`InterruptionAdvisoryCard.jsx`, `InterruptionCompactView.jsx`). Do NOT delete it — only the public `InterruptionFeedPost.jsx` no longer uses it.

---

## 34. ⚠️ CRITICAL — Stale Media Queries in `InterruptionFeed.css`

**This is the most important thing for the next AI to know.**

There are media query overrides that hardcode OLD card dimensions and REMOVE the banner's required top padding. These WILL break the public feed card on tablet/mobile:

### Tablet breakpoint (768–1023px) — STALE
```css
@media (min-width: 768px) and (max-width: 1023px) {
  .interruption-feed {
    padding: 18px 12px; /* ❌ KILLS the 44px top padding — banner gets clipped */
  }
  .interruption-feed-post {
    width: 380px;  /* ❌ OVERRIDES fit-content */
    height: 400px; /* ❌ OVERRIDES calc(380px * var(--public-section-scale)) */
    padding: 0;
  }
}
```

### Large mobile (480–599px) — STALE
```css
@media (min-width: 480px) and (max-width: 599px) {
  .interruption-feed {
    padding: 14px 10px; /* ❌ KILLS top padding for banner */
  }
}
```

These breakpoints also contain orphaned `.feed-post-expand-btn` overrides (the button no longer exists).

**Next AI action required:** Update all media queries to:
- Keep `padding-top: 44px` on `.interruption-feed` (or increase, never decrease)
- Replace fixed `width: XXXpx` with `width: fit-content; max-width: min(720px, 92vw)`
- Replace fixed `height: 400px` with `height: calc(380px * var(--public-section-scale, 1))`
- Remove all `.feed-post-expand-btn` overrides from media queries

---

## 35. Admin Dashboard Component Map

The admin-facing interruption dashboard has its own separate component tree (not touched in this session):

| Component | Purpose |
|---|---|
| `InterruptionAdvisoryBoard.jsx` | Main admin board — lists all advisories with filter/sort |
| `InterruptionAdvisoryCard.jsx` | Admin card — uses `InterruptionFeedPostHeader` + action buttons |
| `InterruptionAdvisoryDetailModal.jsx` | Admin full-detail modal (separate from public `InterruptionFeedExpandedView`) |
| `InterruptionAdvisoryForm.jsx` | Create/edit advisory form |
| `InterruptionAdvisoryFilters.jsx` | Filter chips + sort for admin board |
| `InterruptionAdvisoryUpdates.jsx` | Update log (remarks/system events) |
| `InterruptionAdvisoryViewOnly.jsx` | Read-only detail view for non-edit contexts |
| `InterruptionCardActionModal.jsx` | Confirm modal for pull/push/archive/delete actions |
| `InterruptionWorkflowView.jsx` | Workflow status timeline view |
| `InterruptionCompactView.jsx` | Compact row/list view of advisory |
| `InterruptionLayoutPicker.jsx` | Toggle between board/list/compact layouts |
| `InterruptionFilterDrawer.jsx` | Slide-in filter drawer (mobile admin) |
| `InterruptionPosterAlignmentPreview.jsx` | Preview poster alignment before capture |
| `AdvisoryActionIcons.jsx` | Shared action icon buttons (edit, archive, pull, etc.) |
| `AdvisoryLog.jsx` | Update log renderer |
| `UpdateAdvisoryModal.jsx` | "Add Update" modal for admin |
| `FeederCascadeSelect.jsx` | Cascading feeder selector (area → feeder) |
| `InModalDateTimePicker.jsx` | DateTime picker used inside advisory form/modals |

> **Important:** The admin dashboard card (`InterruptionAdvisoryCard`) still uses `InterruptionFeedPostHeader`. Any changes to that component will affect the admin view. The **public feed card** (`InterruptionFeedPost`) does NOT use it.

---

## 36. Handoff Instructions for the Next AI

### Current state of the public feed (as of this session)
- ✅ Header/logo/button removed from feed card
- ✅ Entire card is clickable → opens `InterruptionFeedExpandedView` modal
- ✅ Status badge (`ENERGIZED`/`ONGOING`/`UPCOMING`) floats above top-right corner of card
- ✅ Poster fills card with `height: 100%; width: auto` — no cropping
- ✅ Card height is fixed `calc(380px × scale)`, width is `fit-content`
- ✅ All poster cards equal height; width adapts to each poster's natural aspect ratio
- ✅ Expanded modal shows captured image or live `InterruptionAlecoPrintPoster` as fallback
- ✅ Backend timezone fixed (`DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR)`)
- ✅ `meta.nextScheduledAt` enables precise frontend refetch timing

### Known issues / pending work
1. **Stale media queries** (§34) — tablet/mobile breakpoints still override card dimensions with old values. Must be updated to use the new `fit-content` + `calc(380px)` system.
2. **`.feed-post-expand-btn` media query rules** — orphaned CSS from the old expand button. Safe to remove.
3. **`InterruptionFeedPostHeader` is unused in public feed** — it's still in the file system. Decide whether to delete or keep for admin use only.

### Do NOT touch (unless you understand fully)
- `InterruptionFeedExpandedView.jsx` — the full modal. Do not add/remove poster logic here without re-reading §8.
- `body.poster-capture-mode` CSS reset — Puppeteer depends on this exact class name and styling.
- `toIsoForClient()` in `interruptionsDto.js` — any change breaks all datetime display.
- `apiInterruptionStatusToDbLiteral` / `apiInterruptionTypeToDbLiteral` — always use these before SQL writes.
- The 3 auto-SQL blocks in `GET /api/interruptions` — execution order matters (upgrade → restore → archive).
- `padding-top: 44px` on `.interruption-feed` — do not reduce this below 36px.
- `overflow: visible` on `.interruption-feed-post` — card clips via poster display, not the card itself.
- `margin: 0; border: none; box-shadow: none` on `.interruption-feed-post--poster .feed-post-poster-display` — removing these re-introduces the 14px margin that causes left/right crop.

### Where to continue
- Fix the stale media queries (§34) — this is the highest priority remaining visual bug
- Consider adding a `max-height` cap on very-short poster images so they don't produce overly-wide cards in the feed
- The `InterruptionAdvisoryBoard` (admin) has not been touched — it is safe to modify independently
