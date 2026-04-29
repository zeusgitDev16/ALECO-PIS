# Dev Audit — April 28, 2026

All changes made in this session. Three separate tasks, all scoped to the Service Memo UI.

---

## 1. Service Memo Modular UI Scale

**Goal:** Extend `ServiceMemoUIScale.css` to cover all Service Memo UI elements with `calc(... * var(--service-memo-ui-scale, 1))` scaling. The original file only covered form internals (strips, bands, rows). Everything surrounding the form had hardcoded `px` values with no responsive scaling.

### Root problem
The `--service-memo-ui-scale` CSS variable was defined only on `.service-memos-page-container`. The modal wrapper (`.service-memo-modal-container`) had no variable definition, so its header and footer elements — which are flex siblings, not descendants of `.service-memos-page-container` — could not inherit the variable.

### Files changed
- **`src/CSS/ServiceMemoUIScale.css`** — 276 lines appended

### What was added

| Group | Elements scaled |
|---|---|
| Modal container | `--service-memo-ui-scale` breakpoints (0.88 / 0.72 / 0.68 / 0.55) on `.service-memo-modal-container` to propagate the variable to modal header + footer |
| Modal top header | `.service-memo-modal-top-header` padding/gap, `.header-title` font-size, `.header-subtitle` font-size, `.service-memo-close-btn` width/height/font-size |
| Modal footer | `.service-memo-footer` padding/gap, `.service-memos-btn` padding/font-size/border-radius/min-height |
| Modal content padding | `.service-memo-modal-content .service-memos-page-container.admin-page-container` padding |
| Page container | `.service-memos-page-container` gap |
| Toolbar | `.service-memos-toolbar` gap/margin |
| Two-pane layout | `.memo-two-pane-layout` gap, `.memo-header-container` and `.memo-body-container` padding/border-radius |
| Navigation tabs | `.service-memos-tabs` gap/padding/radius, `.service-memo-tab` padding/font-size/radius |
| Browse content card | `.service-memos-content-card` padding/border-radius |
| Message bars | `.service-memos-msg` padding/font-size/margin/radius |
| Status badges | `.service-memo-status-badge`, `.ticket-status-badge` padding/font-size/radius |
| List row action buttons | `.service-memo-list-action-btn` padding/font/radius, icon variant sizing |
| Filter drawer | Header, body, footer padding; filter groups, labels, inputs, apply/clear buttons |
| Form helper text | Band hint, account reminder, municipality pill, generate-code button, preview/verify hint |
| Empty state | Placeholder `h3` and `.widget-text` font sizes |
| Tab/close rows | Action tab pills, close-memo finalize row padding |
| Coarse pointer (iOS) | Zoom prevention extended to filter inputs/selects |

---

## 2. Search Bar Overflow Fix

**Goal:** Fix the Acc# / Memo# search bar overflowing the right edge of the service memo modal on narrow (mobile) screens.

### Root problem
The `.service-memo-search-header` used a two-column flex layout:
- `.service-memo-search-left` → `flex: 0 0 55%` (hard-locked to 55% of container width)
- `.service-memo-search-right` → `flex: 1` with `min-height: 80px` — **always empty**, consuming the other 45%

Inside a ~320px inner modal, the left column got only ~176px. The Acc# + Memo# row needed ~244px minimum (two labels + two 80px inputs + gap), causing visible overflow.

### Files changed
- **`src/CSS/ServiceMemos.css`**

### What was fixed

| Selector | Before | After |
|---|---|---|
| `.service-memo-search-header` | `gap: 16px` | `gap` removed (right column is zero-width) |
| `.service-memo-search-left` | `flex: 0 0 55%` | `flex: 1 1 auto; min-width: 0` — fills all available width |
| `.service-memo-search-right` | `flex: 1; min-height: 80px` | `flex: 0 0 auto; min-height: 0` — collapses (empty div) |
| `.service-memo-search-row` | `gap: 12px/16px; no min-width` | `gap: 8px; min-width: 0` |
| `.service-memo-search-field` | no `flex`, no `min-width` | `flex: 1; min-width: 0` — Acc# and Memo# split the row equally |
| `.service-memo-search-input` | `min-width: 80px` (hard floor) | `min-width: 0; width: 0` — shrinks freely within flex parent |

---

## 3. Desktop Inline Filter Fields

**Goal:** Make the filter controls (Status, Date From, Date To) visible directly in the browse header on desktop/laptop (≥769px) without adding extra vertical space. On mobile, the existing 4-row layout and drawer remain unchanged.

### Root problem
The Status, Date From, Date To, and Owner filters were only accessible through the filter drawer (funnel icon → slide-in overlay). On desktop where the modal has ample horizontal space, this was an unnecessary extra click and those fields were effectively hidden from view.

### Files changed
- **`src/components/serviceMemos/ServiceMemoTabs.jsx`** — restructured rows
- **`src/CSS/ServiceMemos.css`** — new responsive classes

### Layout comparison

| Row | Mobile (< 769px) | Desktop (≥ 769px) |
|---|---|---|
| 1 | All \| Saved \| Closed tabs | Tabs + **Status select** (right side) |
| 2 | Acc# \| Memo# | Acc# \| Memo# \| **Name** |
| 3 | Name (own row) | *(hidden — Name moved up to row 2)* |
| 4 | Address (full width) | Address \| **Date From** \| **Date To** |

Desktop: **3 rows** total with 5 extra controls visible. Mobile: **4 rows** unchanged.

### New CSS classes

| Class | Purpose |
|---|---|
| `.service-memo-inline-desktop-field` | `display: none` by default; `display: flex` at ≥769px — wraps Status, Name-in-row-2, Date From, Date To |
| `.service-memo-mobile-only-row` | `display: flex` by default; `display: none` at ≥769px — wraps the Name-only mobile row |
| `.service-memo-tabs-filter-row` | Tabs row: `flex-wrap: nowrap; align-items: center` so tabs stay left, Status field takes remaining right space |
| `.service-memo-search-select` | `height: auto; min-height: 22px` overrides the fixed `height: 22px` on `.service-memo-search-input` for `<select>` elements |

The filter drawer (Owner / general search) remains accessible via the funnel button on all screen sizes.

---

## Files Modified Summary

| File | Type | Task |
|---|---|---|
| `src/CSS/ServiceMemoUIScale.css` | CSS | Task 1 — Modular scale extension |
| `src/CSS/ServiceMemos.css` | CSS | Task 2 — Search overflow fix |
| `src/CSS/ServiceMemos.css` | CSS | Task 3 — Desktop inline filter classes |
| `src/components/serviceMemos/ServiceMemoTabs.jsx` | JSX | Task 3 — Desktop inline filter fields |
