# Dashboard.jsx Refactor Plan
## Better Mobile UI + Structural Skeleton Loading

**Status:** Planning only — no code written yet.
**Files in scope:** `src/Dashboard.jsx`, `src/CSS/Dashboard.css`, new `src/CSS/DashboardUIScale.css`

---

## 1. Current State Audit

### Layout Problems
- `dash-kpi-ribbon` uses a hardcoded grid with fixed pixel breakpoints (`1200px`, `700px`) — no modular scale variable.
- All padding, font-sizes, and spacing inside section wrappers use hardcoded `px`/`rem` values with no `calc(... * var(--dashboard-ui-scale))` scaling.
- Nav action buttons (`dash-nav-btn`) have no mobile collapse — at ≤480px they overflow horizontally or wrap badly.
- Charts use a fixed `height={180}` on `ResponsiveContainer` — never scales down on narrow screens.
- Stats grid uses `repeat(auto-fit, minmax(140px, 1fr))` — card minimum width is fixed regardless of screen.

### Skeleton Problems (Critical)
- **Current approach is mimicking, not structural mirroring.** Example: the power advisories section has a separate `if (loadingAdvisories) { return <stats-grid>...</stats-grid> }` block that creates a parallel DOM tree with skeleton placeholders — it does not reuse the real wrapper CSS classes (`stat-card urgent`, `stat-card pending`, etc.).
- KPI ribbon skeleton: inline `{loading ? <Skeleton width={32} height={32} circle /> : <FaTicketAlt />}` is acceptable for atoms, but the wrapper card is always rendered — this part is already structurally correct.
- Charts: no skeleton state at all when chart data is loading — just empty charts appear.
- Service Memo + Users mini section: no skeleton — components render `0` values while loading.

---

## 2. CSS Variable Strategy — `--dashboard-ui-scale`

### New file: `src/CSS/DashboardUIScale.css`

Following the exact same pattern as `TicketUIScale.css`, `InterruptionUIScale.css`, and `PersonnelUIScale.css`.

Apply the variable on **`.dashboard-page-container`** (the existing root wrapper in Dashboard.jsx).

#### Scale tiers (matching §3 of MODULAR_SCALE_AND_DESIGN_PATTERNS.md)

```
≥ 1024px    → 1
768–1023px  → 0.88
600–767px   → 0.72
480–599px   → 0.72
425–479px   → 0.72
375–424px   → 0.68
321–374px   → 0.65
≤ 320px     → 0.55
```

**Usage pattern:** every spacing, size, and font property that should shrink on mobile uses:
```css
padding: calc(20px * var(--dashboard-ui-scale, 1));
font-size: calc(0.6rem * var(--dashboard-ui-scale, 1));
height: calc(180px * var(--dashboard-ui-scale, 1));
```

---

## 3. Layout Refactor Plan (Section by Section)

### 3.1 Header (`dashboard-header`)

**Current:** `flex-direction: row`, `justify-content: space-between` — nav buttons overflow on mobile.

**Fix:**
- At ≤600px: stack header vertically (`flex-direction: column`, `align-items: flex-start`).
- Nav action buttons at ≤480px: show icon only — hide the text label using a visually-hidden span, not `display:none`, so screen readers keep it.
- Apply `gap: calc(8px * var(--dashboard-ui-scale, 1))` between buttons.
- Title font-size already uses `var(--fs-lg)` — keep as-is, it already scales.

### 3.2 KPI Ribbon (`dash-kpi-ribbon`)

**Current:** `grid-template-columns: repeat(6, 1fr)` → `repeat(3, 1fr)` at ≤1200px → `repeat(2, 1fr)` at ≤700px.

**Fix:**
- Change to `repeat(auto-fit, minmax(calc(120px * var(--dashboard-ui-scale, 1)), 1fr))` so grid adapts proportionally.
- Keep 6-column layout by default with a `min-width: calc(120px * var(--dashboard-ui-scale, 1))` per card.
- Card padding: `calc(10px * var(--dashboard-ui-scale, 1)) calc(14px * var(--dashboard-ui-scale, 1))`.
- KPI icon size: `calc(36px * var(--dashboard-ui-scale, 1))`.
- KPI label font: `calc(0.6rem * var(--dashboard-ui-scale, 1))`.
- KPI value font: `calc(1.35rem * var(--dashboard-ui-scale, 1))`.

### 3.3 Section Wrappers

Applies to: `.dashboard-power-advisories-wrapper`, `.dashboard-ticket-features-wrapper`, `.dashboard-b2b-mail-wrapper`, `.dashboard-personnel-wrapper`, `.dashboard-mini-wrapper`.

**Fix:**
- Padding: `calc(20px * var(--dashboard-ui-scale, 1))` all sides.
- `border-radius: calc(20px * var(--dashboard-ui-scale, 1))`.
- Section title font: `calc(0.9rem * var(--dashboard-ui-scale, 1))`.
- Description text font: `calc(0.7rem * var(--dashboard-ui-scale, 1))`.

### 3.4 Stats Grid (`stats-grid`)

**Current:** uses a CSS grid with `repeat(auto-fit, minmax(140px, 1fr))` — hardcoded min.

**Fix:**
```css
grid-template-columns: repeat(auto-fit, minmax(calc(140px * var(--dashboard-ui-scale, 1)), 1fr));
gap: calc(10px * var(--dashboard-ui-scale, 1));
```
Stat card internal padding:
```css
padding: calc(14px * var(--dashboard-ui-scale, 1)) calc(16px * var(--dashboard-ui-scale, 1));
```
Stat number font:
```css
font-size: calc(1.5rem * var(--dashboard-ui-scale, 1));
```
Stat label font:
```css
font-size: calc(0.65rem * var(--dashboard-ui-scale, 1));
```

### 3.5 Charts

**Current:** `<ResponsiveContainer width="100%" height={180}>` — fixed 180px height.

**Fix:**
- Pass height as a CSS variable-computed value via an inline `style` on the wrapping `div`:
  ```jsx
  <div className="chart-wrapper" style={{ height: 'calc(180px * var(--dashboard-ui-scale, 1))' }}>
      <ResponsiveContainer width="100%" height="100%">
  ```
- This means the chart always fills the wrapper, which scales down via the CSS variable.
- XAxis/YAxis `fontSize` prop should also be dynamic: use `11` on desktop, `9` on mobile — can be derived from a tiny helper `useMediaQuery` or just use CSS variable in a `className` wrapper.

### 3.6 Auxiliary Grid (Memos + Users)

**Current:** `grid-template-columns: 1fr 1fr` → `1fr` at ≤900px. This is acceptable.

**Fix:** Add modular scale gap and inner padding. The collapse breakpoint stays at `≤900px`.

---

## 4. Skeleton Loading — Structural Mirror Approach

### The Principle (from user requirements)

> "Skeleton loading should be structural mirroring, not mimicking. The skeleton must use the same wrapper divs and CSS classes as the real card. The only difference is the content inside the containers."

### 4.1 KPI Ribbon Skeleton

**Already partially correct** — the wrapper `dash-kpi-card` is always rendered.

**Fix needed:**
- The `Skeleton` inside `.dash-kpi-body` should have widths matching the real label/value text:
  - Label: `<Skeleton height={calc'd based on --fs-sm} width={80} />`
  - Value: `<Skeleton height={calc'd based on --fs-xl} width={50} />`
- The icon container renders `<Skeleton circle width={36} height={36} />` — this is correct.
- No structural divergence — just content swap. ✓

### 4.2 Power Advisories Stats Grid Skeleton

**Current problem:** a completely separate parallel block `if (loadingAdvisories) { return <stats-grid>...</stats-grid> }`.

**Fix:**
- Remove the separate block.
- Render the real stats grid always, but pass an `isLoading` flag per card.
- Each `stat-card` renders with its real CSS class (`.stat-card.urgent`, `.stat-card.pending`, etc.) but content swapped to Skeleton:

```jsx
<div className="stats-grid">
  <div className="stat-card urgent">
    <div className="stat-icon-box">
      {loadingAdvisories ? <Skeleton circle width={32} height={32} /> : <FaBolt />}
    </div>
    <div className="stat-content">
      <span className="stat-label">
        {loadingAdvisories ? <Skeleton width={100} height={12} /> : 'Active Outages'}
      </span>
      <h3 className="stat-number">
        {loadingAdvisories ? <Skeleton width={60} height={28} /> : interruptionStats.active}
      </h3>
      <span className="stat-trend">
        {loadingAdvisories ? <Skeleton width={80} height={10} /> : 'Unscheduled'}
      </span>
    </div>
  </div>
  {/* ...same pattern for all 7 cards */}
</div>
```

**Why this works:** the border gradient (`stat-card.urgent` bottom-border, `stat-card.pending` bottom-border, etc.) still appears during loading. Zero layout shift. Zero DOM divergence.

### 4.3 Charts Skeleton

**Current problem:** no skeleton state for charts — blank chart containers flash in.

**Fix:**
- Wrap the `<ResponsiveContainer>` with a conditional:
  ```jsx
  <div className="chart-wrapper">
    {loadingAdvisories
      ? <Skeleton height="100%" borderRadius={8} />
      : <ResponsiveContainer width="100%" height="100%">...</ResponsiveContainer>
    }
  </div>
  ```
- The `chart-card` wrapper and `chart-header-group` (title + icon) are always rendered.
- Only the chart itself is swapped to a skeleton rectangle.
- This mirrors the structure: `chart-card > chart-header-group + chart-wrapper`.

### 4.4 Feeder Health / Top Areas / Top Locations Lists

**Current problem:** these lists render empty or with `0` while loading.

**Fix:**
- Render 4 placeholder list items with the real `li` element and CSS classes but skeleton content:
  ```jsx
  {memoLinked loading
    ? Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="area-item">
          <span className="area-label"><Skeleton width={100} height={11} /></span>
          <div className="area-bar-track">
            <div className="area-bar" style={{ width: 0 }} />
          </div>
          <span className="area-count"><Skeleton width={20} height={11} /></span>
        </div>
      ))
    : topAreas.map(...)
  }
  ```

### 4.5 B2B Recent Activity List

Same pattern — render 5 placeholder `b2b-activity-item` divs with skeleton content inside the same wrapper.

### 4.6 Service Memos + Users Mini Section

**Current problem:** renders `0` for all values with no skeleton.

**Fix:**
- Apply the same inline `isLoading ? <Skeleton> : value` pattern to the stat numbers inside `.stat-card` wrappers.
- The `dashboard-mini-wrapper` div and `stat-card` divs are always rendered — no structural divergence.

---

## 5. Implementation Sequence

### Step 1 — Create `DashboardUIScale.css`
- Define `--dashboard-ui-scale` on `.dashboard-page-container` using the 8 breakpoint tiers.
- Import it in `Dashboard.jsx`.

### Step 2 — Update `Dashboard.css` to use the variable
- Replace all hardcoded padding/font/gap values inside KPI ribbon, section wrappers, stat cards, and charts with `calc(... * var(--dashboard-ui-scale, 1))`.
- Keep breakpoints only for **structural** layout changes (e.g. grid column count, flex-direction), not for size values.
- Update charts wrapper to use `height: calc(180px * var(--dashboard-ui-scale, 1))`.

### Step 3 — Mobile header + nav collapse
- Stack header at ≤600px.
- Icon-only nav buttons at ≤480px.

### Step 4 — Refactor skeleton loading in `Dashboard.jsx`
- Remove all parallel skeleton blocks.
- Inline skeleton content inside the real DOM structure card-by-card.
- Add chart skeletons.
- Add list/activity skeletons.

### Step 5 — Verify
- Test at: 1440px, 1024px, 768px, 480px, 375px, 320px.
- Confirm zero layout shift between loading and loaded states — the DOM structure must be identical.
- Confirm skeleton stat cards still show their color-coded bottom borders (`urgent` = red pulse, `pending` = amber, etc.).

---

## 6. Skeleton Height Reference (from Dashboard.css `--fs-*` tokens)

| Element | Skeleton height to use |
|---|---|
| `stat-number` (h3) | `calc(28px * var(--dashboard-ui-scale, 1))` |
| `stat-label` (span) | `calc(12px * var(--dashboard-ui-scale, 1))` |
| `stat-trend` (span) | `calc(10px * var(--dashboard-ui-scale, 1))` |
| `stat-icon-box` (icon) | `circle`, `calc(32px * var(--dashboard-ui-scale, 1))` |
| `dash-kpi-value` | `calc(22px * var(--dashboard-ui-scale, 1))` |
| `dash-kpi-label` | `calc(10px * var(--dashboard-ui-scale, 1))` |
| `dash-kpi-icon` | `circle`, `calc(36px * var(--dashboard-ui-scale, 1))` |
| chart area | Full width rect, `height: 100%` inside chart-wrapper |
| area-bar list label | `calc(11px * var(--dashboard-ui-scale, 1))` |
| activity list item | `calc(14px * var(--dashboard-ui-scale, 1))` |

---

## 7. Files to Create / Modify

| Action | File |
|---|---|
| **Create** | `src/CSS/DashboardUIScale.css` |
| **Modify** | `src/CSS/Dashboard.css` — swap hardcoded values to `calc(... * var(--dashboard-ui-scale, 1))` |
| **Modify** | `src/Dashboard.jsx` — remove parallel skeleton blocks, inline structural skeleton |

---

*End of plan. Ready to implement in next session.*
