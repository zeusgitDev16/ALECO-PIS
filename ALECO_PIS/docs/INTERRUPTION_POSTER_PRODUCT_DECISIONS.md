# Interruption poster — product & pipeline decisions

**Purpose:** Single reference for agreed behavior (Facebook sharing, generation timing, fallbacks, capture auth, image sizing, hosting plans). Use this when implementing poster HTML, Puppeteer, Cloudinary, and Open Graph.

**Status:** Decisions confirmed in conversation (2026). Hosting migration below is **planned**, not yet applied.

**Related:** `docs/INTERRUPTION_POSTER_ADMIN_ALIGNMENT_GAPS.md`, `docs/ADMIN_INTERRUPTIONS_POSTER_FIELD_GAP.md`, `docs/ADMIN_INTERRUPTIONS_DASHBOARD_AUDIT.md`.

---

## 1. Facebook and social preview

**Decision: use both patterns.**

1. **Canonical PIS link** — When sharing an advisory, prefer a **URL on the cooperative app** (public advisory or home deep link as you define). That page’s HTML (or prerendered meta) should expose **Open Graph** (and Twitter Card where useful) with:
   - **`og:image`** (and `og:image:secure_url` if applicable) pointing to the **Cloudinary** poster asset (`poster_image_url` or equivalent).
   - Appropriate **`og:title`**, **`og:description`**, **`og:url`** aligned with the shared link.

2. **Direct Cloudinary URL** — Also keep the **stable `https://` image URL** on Cloudinary available for:
   - Pasting into Facebook as an image/link where a **direct image** is preferred.
   - Internal tools, email, or other channels that do not go through the PIS page.

**Rationale:** Facebook’s crawler can fetch **`og:image`** from Cloudinary while the **shared link** stays on your domain for trust and analytics.

---

## 2. When to generate or refresh the poster asset

**Decision: both automatic and manual.**

| Trigger | Behavior |
|---------|----------|
| **Save / publish** | Regenerate (or queue regenerate) the poster asset when an advisory is **created or updated** in a way that affects public/poster content. |
| **Admin action** | Keep an explicit **capture / regenerate** control (e.g. current “Capture poster” flow) so staff can refresh without a full content edit. |

**Implementation default (recommended):** run **automatic** regeneration **when poster-relevant fields change** (e.g. type, schedule, feeder, cause/body, affected areas, grouped areas, status, control number—not necessarily every trivial metadata touch). This limits **Cloudinary uploads**, API load, and rate limits while matching the “both” intent. If product prefers **every** save, document that explicitly here when chosen.

---

## 3. Coverage and fallback when no raster poster exists

**Decision: every public advisory must be “preview-ready”; real poster is the norm.**

- **General case:** Persist a **`poster_image_url`** (Cloudinary) for the designed poster so shares and **`og:image`** use the real artwork.
- **If `poster_image_url` is missing** (new row, failed capture, migration gap): provide a **simple backup**—a minimal layout that **lists key advisory details** (headline/type, schedule, feeder, reason, affected areas, control ref, etc.) so Facebook (and humans) still get a sensible preview instead of a blank card.

**Note:** The backup can be a second Cloudinary upload from a “plain” template, or server-generated HTML screenshot—implementation choice. The product requirement is **no empty preview** for public advisories.

---

## 4. Puppeteer / capture and authentication

**Decision: server-side generation is acceptable; do not depend on a logged-in browser session.**

- Poster capture should run on the **API host** (or a dedicated worker) using **Puppeteer** with one or more of:
  - **Server-rendered HTML** for the poster (no SPA auth),
  - **Signed, time-limited public read** of advisory data for a print route, or
  - Another pattern that avoids **`GET /api/interruptions/:id` requiring a user JWT** inside headless Chrome.

This aligns with the audit finding that the current SPA print route + authenticated detail fetch blocks anonymous Puppeteer unless credentials are injected.

---

## 5. Image dimensions

**Decision: adaptive sizing.**

- Output dimensions should **adapt to content** (e.g. dynamic viewport height with a sensible max width, or template-driven aspect), not a single fixed **1200×630** for all advisories.
- **Practical note:** Facebook and other networks **resize and crop** link previews; adaptive art is fine as long as **`og:image`** URLs are **HTTPS**, reachable, and large enough for their minimums. Document chosen min/max in implementation notes when the template exists.

---

## 6. Hosting migration (planned — not active yet)

**Intent (from stakeholder):**

| Current | Planned |
|---------|---------|
| UI: **Vercel** | **Cloudflare Pages** (target: **$0** tier) |
| API: **Render** | **Oracle VM** (target: **$0** / self-managed) |

**Not switched yet.** When migrating:

- Keep **env-based** configuration (`VITE_API_URL`, `PUBLIC_APP_URL` / `FRONTEND_ORIGIN`, CORS allowlists, Puppeteer `page.goto` base URL)—**no hardcoded** Vercel/Render hostnames in app logic.
- **Oracle VM:** install **Chromium** (or bundled Chromium) and OS deps for Puppeteer; ensure memory/CPU for captures; outbound HTTPS to Cloudinary and to the **Pages** origin if capture still loads a URL from the deployed SPA.
- **Cloudflare Pages:** same SPA build; set production API origin in build env.

This section is **planning context** only until cutover.

---

## 7. Changelog

| Date | Change |
|------|--------|
| 2026-04-23 | Initial document: Facebook (both), generate (both + diff default note), public fallback, server capture OK, adaptive size, hosting plan. |
