# Modular scale, sizing, and design patterns (ALECO PIS)

This document describes how **responsive sizing** and **design patterns** work in the current codebase, with emphasis on **CSS scale variables**, **public vs admin contexts**, and **deployment-related frontend configuration**. It reflects the state of the repo as documented here; adjust if files drift.

---

## 1. Goals of the modular scale

- **One proportional “step down”** on smaller viewports so typography, spacing, and controls stay coherent (not random pixel tweaks per breakpoint).
- **Align** public landing sections (Power Outages, About, Privacy, Report a Problem) with the same **tiered scale** where possible.
- **Avoid double-shrinking**: shared “brick” components (text fields, dropdowns, upload) have **compact mobile rules** for the **admin/dashboard** context, but those rules are **disabled** on the public **Report a Problem** flow so **only** `--report-scale` applies there.

---

## 2. Core CSS variables

| Variable | Set on | Purpose |
|----------|--------|---------|
| `--public-section-scale` | `.body-padding` (tiers by viewport) | Public landing: section titles (`.section-title`), interruptions list spacing, About/Privacy-style blocks, report **header** rhythm tied to the same scale. |
| `--report-scale` | Same tiers on `.body-padding`; inherited by `#report` | **Report / Track wizard** inside `.report-problem-container`: stepper, form controls, GPS, map chrome, buttons, etc. |

Both variables are **tied to the same numeric tier** in `BodyLandPage.css` so the report card does not drift from other public H2s.

**Fallback in calculations:** always prefer `var(--report-scale, 1)` or `var(--public-section-scale, 1)` so undefined variables behave like desktop.

**`:root` default:** `ReportaProblem.css` sets `--report-scale: 1` for elements that reuse report class names outside the tiered context (e.g. shared cards).

---

## 3. Viewport tiers (current values)

Defined in `src/CSS/BodyLandPage.css` on **`.body-padding`** (public home uses this wrapper).

| Viewport (width) | `--public-section-scale` / `--report-scale` |
|------------------|---------------------------------------------|
| ≥ 1024px | `1` |
| 768px – 1023px | `0.88` |
| 600px – 767px | `0.72` |
| 480px – 599px | `0.72` |
| 425px – 479px | `0.72` |
| 375px – 424px | `0.68` |
| 321px – 374px | `0.65` |
| ≤ 320px | `0.55` |

**Separate from scale:** `.body-padding` also uses **fixed** `padding-top` / `padding-bottom` steps (in px) per breakpoint so the **fixed navbar/header** clears correctly; those values are documented in the same file and mirror “smaller on narrow screens” but are **not** multiplied by the scale variables.

**Smooth scroll:** `html.public-home-smooth-scroll` uses matching `scroll-padding-top` values for anchor links (`App.jsx` toggles this on the public home route).

---

## 4. Report a Problem: DOM anchor and inheritance

- Root wrapper: `<div id="report" className="report-problem-container">` in `ReportaProblem.jsx`.
- **`#report`** sits **inside** `.body-padding` on the land page, so it **inherits** `--report-scale` from the tier rules.
- **Scoped CSS:** most wizard overrides live under `.report-problem-container` in `ReportaProblem.css` (high specificity vs shared brick CSS and some global rules).

---

## 5. “Brick” components vs public report (critical pattern)

Shared components import their own CSS:

- `TextFieldProblem.css`, `IssueCategoryDropdown.css`, `ExplainTheProblem.css`, `UploadTheProblem.css`, etc.

Those files include **mobile compact** rules at small breakpoints. For the **public report**, we **must not** apply those fixed small sizes, or they **fight** `calc(... * var(--report-scale))`.

**Pattern used:** prefix aggressive brick rules with:

```css
body:not(:has(#report)) .some-class { ... }
```

So:

- **Admin / anywhere without `#report` on the page:** brick compact rules apply.
- **Public Report a Problem (body contains `#report`):** those rules are skipped; `ReportaProblem.css` owns sizing with `--report-scale`.

**When adding new shared form components:** if they have global `@media` shrink rules, consider the same `:has(#report)` guard or equivalent scoping.

---

## 6. Report flow: what scales (summary)

Implemented primarily in `ReportaProblem.css` under `.report-problem-container` (unless noted):

- **Stepper** (numbers, labels, connectors, track UI).
- **Wizard shell** (padding, min-heights, summary grid).
- **Text fields & phone input** (label, input, placeholder, focus ring, errors, `min-height` touch targets).
- **Issue category** `<select>` (`.issue-dropdown-container.layout-form`).
- **Concern textarea** (Explain the problem).
- **Upload** modal and area (report-specific overrides).
- **GPS:** Find my location, success/error boxes, clear button.
- **Aleco scope:** search input, district/municipality selects, clear button, grid gaps; focus rings; dark theme variants where added.
- **Map preview:** header, badges, footer, `map-preview-wrapper` height/max-width by breakpoint, Leaflet container radius, zoom controls, GPS marker `transform: scale(var(--report-scale))`.
- **Actions:** wizard Back/Next, Submit report, track submit (where rules exist).

**Formula pattern:** `calc(<base px or rem> * var(--report-scale, 1))`. Borders sometimes use `max(1px, calc(1px * var(--report-scale, 1)))` so they do not disappear on small scales.

---

## 7. Touch / iOS input zoom (coarse pointer)

For **native inputs and selects** on the report flow, some rules use:

- Base: `font-size: calc(15px * var(--report-scale, 1))`.
- **`@media (pointer: coarse) and (max-width: 899px)`:** `font-size: max(16px, calc(15px * var(--report-scale, 1)))` so text fields stay at least **16px**, reducing unwanted zoom-on-focus on iOS Safari.

Apply the same idea when adding new report-scoped inputs.

---

## 8. Known gaps / not scaled by `--report-scale`

- **React portals** (e.g. modals rendered with `createPortal` under `document.body`) **do not** sit under `#report`; they **do not inherit** `--report-scale` unless separately styled. `ReportaProblem.jsx` notes this for TicketPopUp / ConfirmModal-style UI.
- **Admin dashboard** and **filter bars** use different layouts (`layout-inline`, Tailwind, etc.); they are **not** unified on `--report-scale`.
- **Third-party widgets** (e.g. Google button iframe) only partially follow CSS.

---

## 9. Theme (light / dark)

- `ThemeProvider` (`src/context/ThemeContext.jsx`) sets `document.documentElement` attribute **`data-theme`** to `light` or `dark` and persists to `localStorage`.
- CSS uses `[data-theme="dark"]` (and sometimes `[data-theme='dark']`) for overrides (e.g. Aleco scope focus rings, map tiles).
- Modular scale is **orthogonal** to theme: same `calc(... * var(--report-scale))` in both themes unless a dark block overrides colors only.

---

## 10. Typography and public section unity

- **`.section-title`** (`BodyLandPage.css`) drives **Power Outages**, **About**, **Privacy**-style headings with `--public-section-scale`.
- **`.body-padding .report-problem-container .report-title`** (and header section rhythm) is tuned to match that H2 rhythm so “Report a Problem” does not look like a different product.

---

## 11. API / deployment (frontend ↔ backend)

Not part of CSS scaling, but affects **real device** behavior:

- **Vite** inlines **`VITE_*`** at **build** time. **`VITE_API_URL`** must be set on **Vercel** to the **public HTTPS API** (e.g. Render), not `localhost`, for phones to reach the API.
- **`getApiBaseUrl()`** (`src/config/apiBase.js`): `VITE_API_URL` → optional `VITE_API_URL_PRODUCTION` in prod → fallback `http://localhost:5000` (dev only).
- **Express CORS** (`backend/config/corsOrigins.js` + `server.js`): allowlist includes local Vite ports and production Vercel origin; extend with **`CORS_ALLOWED_ORIGINS`** (comma-separated) for preview URLs; optional **`PUBLIC_APP_URL` / `FRONTEND_ORIGIN`**. Origins are **normalized** (trailing slash stripped).

---

## 12. Key files (quick reference)

| Area | Files |
|------|--------|
| Scale tiers + public layout | `src/CSS/BodyLandPage.css` |
| Report / Track wizard UI | `src/CSS/ReportaProblem.css`, `src/ReportaProblem.jsx` |
| Brick guards (`:has(#report)`) | `TextFieldProblem.css`, `IssueCategoryDropdown.css`, `ExplainTheProblem.css`, `UploadTheProblem.css` |
| Privacy / public cards | `src/CSS/PrivacyNotice.css` |
| Theme | `src/context/ThemeContext.jsx`, `index.css` / component CSS with `[data-theme]` |
| API base URL | `src/config/apiBase.js`, `src/utils/api.js`, `src/api/axiosConfig.js` |
| CORS | `backend/config/corsOrigins.js`, `server.js` |

---

## 13. Guidelines for future changes

1. **Prefer** `calc(... * var(--report-scale, 1))` (or `--public-section-scale`) for anything inside the **public report** or **public sections** inside `.body-padding`.
2. **Do not** add new global compact `@media` rules to brick CSS without considering **`body:not(:has(#report))`** if they would shrink report controls.
3. **Use** `!important` only when necessary to win specificity wars (document why in a short comment).
4. **Keep** `line-height` unitless when scaling only font/padding, unless you intentionally scale line-height with `calc`.
5. **Test** at **1024 → 320px** width and on a **real phone** (coarse pointer + Safari).
6. **Portals / modals:** if they must match the wizard visually, duplicate minimal scale variables or scope styles to a wrapper class that receives the same CSS variables via a parent or inline style.

---

*End of document.*
