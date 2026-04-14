# Environment & deployment principles (local + any host)

This document is for **developers and AI assistants**: changes must work on **localhost** and on **deployed** environments. Hosting names (**Vercel**, **Render**) are **examples**—configuration must stay **replaceable**.

---

## 1. How the app is split

| Layer | Typical role | Notes |
|--------|----------------|--------|
| **SPA (Vite)** | Static HTML/JS/CSS | Built with env vars **inlined at build time** (`VITE_*`). |
| **API (Express)** | `server.js` + routes | Listens on `PORT` (e.g. Render injects `PORT`). |
| **Database** | MySQL (e.g. cloud) | Connection via `DB_*` env vars on the API server. |

The browser **never** calls `localhost` on your PC when users visit a public URL. The SPA must be built with a **public API base URL** (HTTPS).

---

## 2. Host-agnostic rules (do not tie code to one vendor)

1. **No hardcoded production URLs** in application logic (`src/`, `backend/` routes). Use:
   - **Frontend:** `import.meta.env.VITE_*` via `getApiBaseUrl()` / `apiUrl()` (`src/config/apiBase.js`, `src/utils/api.js`) and axios `baseURL` (`src/api/axiosConfig.js`).
   - **Backend:** `process.env.*` (e.g. `PUBLIC_APP_URL`, `CORS_ALLOWED_ORIGINS`, `DB_*`, `PORT`).

2. **Name env vars by purpose**, not by vendor:
   - Prefer **`VITE_API_URL`** = “full origin of the API (scheme + host, no path)”.
   - Prefer **`PUBLIC_APP_URL`** or **`FRONTEND_ORIGIN`** = “primary browser origin of the SPA”.
   - **`CORS_ALLOWED_ORIGINS`** = comma-separated extra origins (preview deploys, second domains).

3. **Changing SPA host** (e.g. Vercel → Netlify, or new domain): update **OAuth** (Google) authorized JavaScript origins, **Maps** key HTTP referrer restrictions, **Vercel/build env** `VITE_API_URL`, and **API** `PUBLIC_APP_URL` / `CORS_ALLOWED_ORIGINS`. No code change if URLs were env-only.

4. **Changing API host** (e.g. Render → another PaaS): update **`VITE_API_URL`** on the frontend build environment, **DNS/SSL** as needed, and **CORS** on the API. Database URLs remain on the API server only.

5. **After any `VITE_*` change:** trigger a **new frontend build** (values are baked in at compile time).

---

## 3. Local development

- **`.env`** (gitignored): typically `VITE_API_URL=http://localhost:5000` pointing at the local Express process.
- **`.env.example`:** documents variables without secrets; keep in sync when adding `VITE_*` or server vars.

See also: [`DEPLOYMENT_VERCEL_RENDER.md`](./DEPLOYMENT_VERCEL_RENDER.md) for step-by-step Vercel + Render (examples).

---

## 4. Codebase scan (current state)

### Aligned with these principles

- **`src/config/apiBase.js`** — `VITE_API_URL` → optional `VITE_API_URL_PRODUCTION` in **production** builds; **throws** if both missing in prod. Dev (`import.meta.env.DEV`) falls back to `http://localhost:5000`.
- **`src/utils/api.js`** — `apiUrl(path)` uses `getApiBaseUrl()` for all full URLs.
- **`src/api/axiosConfig.js`** — Axios uses `getApiBaseUrl()` (same source of truth).
- **`server.js`** — `PORT` from env; works on Render and locally.
- **`backend/config/db.js`** — Database from `DB_*` env vars.
- **`backend/config/corsOrigins.js`** — Localhost dev defaults + `CORS_ALLOWED_ORIGINS` + `PUBLIC_APP_URL` / `FRONTEND_ORIGIN` (no hardcoded third-party production URL). If `NODE_ENV=production` and none of those env vars are set, **`server.js` logs a CORS warning** at startup.

### Password reset email

- **`PUBLIC_APP_URL`** or **`FRONTEND_ORIGIN`** on the API host adds an optional “open the app” link in the forgot-password email (same vars as CORS primary SPA).

### Google Sign-In (server)

- **`POST /api/google-login`** and **`POST /api/setup-google-account`** expect **`idToken`** (Google credential JWT). The API verifies it with **`google-auth-library`** using **`GOOGLE_CLIENT_ID`** or **`VITE_GOOGLE_CLIENT_ID`** (same Web client ID as the SPA). Set **`GOOGLE_CLIENT_ID`** on the API host if the server process does not load `VITE_*` from `.env`.

---

## 5. Pre-merge / pre-release checklist

- [ ] New API calls use **`apiUrl(...)`** or axios with shared base—not a pasted absolute URL unless external (e.g. Google APIs).
- [ ] No new **`localhost`** assumptions in code paths that run in the **browser** for production users.
- [ ] If CORS or cookies depend on origin, **`PUBLIC_APP_URL`** / **`CORS_ALLOWED_ORIGINS`** documented for ops.
- [ ] **`VITE_*`** changes documented; team knows to **rebuild** the SPA.
- [ ] Smoke test: local (`VITE_API_URL` → local API) and deployed build (`VITE_API_URL` → public API HTTPS).

---

## 6. Related docs

| Doc | Topic |
|-----|--------|
| [`LOCAL_VS_DEPLOYED_RISKS.md`](./LOCAL_VS_DEPLOYED_RISKS.md) | **Scan:** what can work locally but fail on deploy (CORS, `VITE_*`, webhooks, Google, geolocation, etc.) |
| [`DEPLOYMENT_VERCEL_RENDER.md`](./DEPLOYMENT_VERCEL_RENDER.md) | Concrete Vercel + Render setup |
| [`MODULAR_SCALE_AND_DESIGN_PATTERNS.md`](./MODULAR_SCALE_AND_DESIGN_PATTERNS.md) | UI scale; mentions `VITE_*` build behavior |
| [`FULL_CODEBASE_MAP.md`](./FULL_CODEBASE_MAP.md) | High-level architecture |

---

## 7. Cursor rule

Project rule **`.cursor/rules/deployment-env-host-agnostic.mdc`** summarizes this for AI sessions—keep the rule short; use **this file** for detail.
