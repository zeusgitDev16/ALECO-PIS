# Deployment walkthrough: Vercel (frontend) + Render (backend)

This document records how **ALECO PIS** is split across **Vercel** and **Render**, what was configured in code, and how to reproduce or extend the setup. Replace example URLs with your real ones where noted.

**See also:** [ENV_AND_DEPLOYMENT_PRINCIPLES.md](./ENV_AND_DEPLOYMENT_PRINCIPLES.md) — host-agnostic rules, AI checklist, and what must work on localhost vs production.

---

## 1. Why two platforms

| Piece | Host | Role |
|--------|------|------|
| **React (Vite) SPA** | **Vercel** | Static build output (`npm run build` → `dist/`). Serves the browser app. |
| **Express API** (`server.js`) | **Render** (or similar) | Long-running Node process, `/api/*`, MySQL, email, uploads, cron-style intervals. |

Vercel does **not** run this repo’s full Express server as a default static project. The API must live on a **Node-capable** host with a public **HTTPS** URL.

---

## 2. Architecture (data flow)

```
User phone / browser
    → https://<vercel-project>.vercel.app  (static JS/CSS; VITE_* baked in at build)
    → API calls to https://<render-service>.onrender.com/api/...
    → MySQL (e.g. Aiven) from Render only
```

- **`VITE_API_URL`** on Vercel must equal the **Render service base URL** (scheme + host, no path), e.g. `https://aleco-pis-api.onrender.com`.
- Browsers on the internet **cannot** call `http://localhost:5000` on your PC.

---

## 3. Code changes made for deployment

### 3.1 Express: port and listen address (`server.js`)

- **`PORT`:** `Number(process.env.PORT) || 5000` — Render injects `PORT`; local dev keeps 5000.
- **`app.listen(PORT, '0.0.0.0', …)`** — listen on all interfaces (typical requirement on PaaS).
- **`app.set('trust proxy', 1)`** — correct client IP behind Render’s reverse proxy.

### 3.2 Production start command (`package.json`)

- **`"start": "node server.js"`** — Render’s default is often `npm start` (not `nodemon`).

### 3.3 CORS (`backend/config/corsOrigins.js` + `server.js`)

- Replaced wide-open `cors()` with an **allowlist**:
  - Local Vite: `http://localhost:5173`, `127.0.0.1:5173`, preview ports, `localhost:5000`.
  - Production frontend: `https://aleco-pis-x6zo.vercel.app` (adjust if your Vercel URL changes).
- **`CORS_ALLOWED_ORIGINS`** (env on Render): comma-separated **extra** origins (e.g. Vercel **preview** deployments: `https://…-git-branch-….vercel.app`).
- **`PUBLIC_APP_URL` or `FRONTEND_ORIGIN`:** optional single frontend URL (no trailing slash); merged into the allowlist. Useful for a **custom domain** later.
- **`normalizeOrigin()`** strips trailing slashes so `https://foo` and `https://foo/` match.

### 3.4 Operational endpoints

- **`GET /api/health`** — JSON `{ ok, service, ts }`, no DB. Use for Render health checks or quick uptime tests.
- **`GET /api/debug/routes`** — Human-readable route inventory (auth, tickets, users, interruptions, deployment hints).

### 3.5 Frontend API base (`src/config/apiBase.js`)

- **`getApiBaseUrl()`:** `VITE_API_URL` → if prod and unset, `VITE_API_URL_PRODUCTION` → else `http://localhost:5000`.
- **`src/utils/api.js`** and **`src/api/axiosConfig.js`** use `getApiBaseUrl()`.

### 3.6 Environment template (`.env.example`)

- Documents `VITE_*` for local, `CORS_ALLOWED_ORIGINS`, `PUBLIC_APP_URL` / `FRONTEND_ORIGIN` for the API host.

### 3.7 SEO / static assets (Vercel build)

- **`index.html`:** title, meta description, canonical, Open Graph (URLs should be updated if you change the production hostname).
- **`public/robots.txt`** and **`public/sitemap.xml`:** point to the live Vercel URL for crawlers (update if domain changes).

---

## 4. Render: step-by-step setup

1. **Account:** [dashboard.render.com](https://dashboard.render.com) — connect **GitHub**.
2. **New → Web Service** — select repo **`ALECO-PIS`** (or your fork/name).
3. **Root directory:** If `package.json` is **not** at the repository root (e.g. it lives in a subfolder `ALECO_PIS/`), set **Root Directory** to that folder.  
   - **Common mistake:** setting Root to `src` → `npm install` fails (`ENOENT package.json`). The root must be the folder that contains **`package.json`** and **`server.js`**.
4. **Runtime:** Node.
5. **Build command:** `npm install`
6. **Start command:** `npm start` (runs `node server.js`).
7. **Environment variables:** Add all **backend** secrets (see section 6). Do **not** rely on `VITE_*` here for the SPA; see section 5.
8. **Deploy** — when **Live**, copy the service URL, e.g. `https://<name>.onrender.com`.
9. **Smoke tests:**
   - `https://<name>.onrender.com/api/health`
   - `https://<name>.onrender.com/api/debug/routes`

**Database:** MySQL stays on **Aiven** (or your provider). Ensure the database allows connections from the internet (or Render’s egress) and that `DB_*` on Render match Aiven’s SSL settings (`backend/config/db.js` uses TLS with `rejectUnauthorized: false` for Aiven-style certs).

**Free tier:** Render free web services **sleep** when idle; first request after sleep can be slow. Upgrade for always-on production if needed.

**Optional Render-only variable:** If Render’s onboarding required a **named generated secret** (e.g. `MY_RENDER_VARIABLE`), keep it as Render documents; the app does not need to read it unless you add code that uses it.

---

## 5. Vercel: step-by-step setup

1. **Import project** from GitHub — project used in production (e.g. **`aleco-pis-x6zo`**).
2. **Framework preset:** Vite (auto-detected in many cases).
3. **Build command:** `npm run build` (default).
4. **Output directory:** `dist` (Vite default).
5. **Root directory:** If the app is in a monorepo subfolder, set it to the same folder as **`package.json`** for the **frontend** (often the same path as on Render if one repo contains both).
6. **Environment variables** (Production, and Preview if desired):

| Variable | Purpose |
|----------|---------|
| **`VITE_API_URL`** | **HTTPS URL of the Render API** (no trailing slash), e.g. `https://<name>.onrender.com` |
| **`VITE_GOOGLE_CLIENT_ID`** | Google Sign-In (must match Google Cloud OAuth client) |
| **`VITE_GOOGLE_MAPS_API_KEY`** | Geocoding / maps from the browser |
| **`VITE_API_URL_PRODUCTION`** | Optional fallback if `VITE_API_URL` is unset in a prod build; **at least one** of `VITE_API_URL` or `VITE_API_URL_PRODUCTION` must be set or the production bundle **throws** on load (`apiBase.js`) |

7. **Redeploy** after changing any `VITE_*` value (values are **inlined at build time**).

---

## 6. Where each variable belongs (cheat sheet)

| Variable type | Vercel | Render |
|---------------|--------|--------|
| `VITE_API_URL`, `VITE_GOOGLE_*`, `VITE_*` | Yes | No (ignored by Express; does not fix the SPA) |
| `DB_*`, `EMAIL_*`, `CLOUDINARY_*`, `PHILSMS_*`, etc. | No | Yes |
| `CORS_ALLOWED_ORIGINS`, `PUBLIC_APP_URL`, `FRONTEND_ORIGIN` | No | **Yes** — set `PUBLIC_APP_URL` (or `CORS_ALLOWED_ORIGINS`) to your live Vercel URL so the browser can call the API; also enables optional link in forgot-password email |
| `PORT` | N/A | Set by Render (do not override unless you know why) |

---

## 7. Google Cloud (outside Render/Vercel)

- **OAuth 2.0 Web client → Authorized JavaScript origins:** include your Vercel URL(s), e.g. `https://aleco-pis-x6zo.vercel.app` (and preview URLs if you use Google login there).
- **Maps / Geocoding API key:** if restricted by HTTP referrer, add `https://aleco-pis-x6zo.vercel.app/*` (and previews as needed).

---

## 8. Verification checklist

- [ ] Render: `/api/health` returns JSON.
- [ ] Render: `/api/debug/routes` returns the route inventory.
- [ ] Vercel: Production deploy succeeded after setting `VITE_API_URL`.
- [ ] Phone on LTE/Wi‑Fi: open Vercel site → login / report flow hits **Render** URL (DevTools → Network), not `localhost`.
- [ ] CORS: no browser errors for blocked origin; add preview URLs to `CORS_ALLOWED_ORIGINS` if using Vercel previews against the same API.

---

## 9. Local development (unchanged mental model)

- Terminal 1: `npm run dev` (Vite).
- Terminal 2: `npm run server` (nodemon + `server.js`).
- **`.env`:** `VITE_API_URL=http://localhost:5000` (gitignored).

---

## 10. Cursor / Vercel MCP (optional)

- Vercel MCP (`https://mcp.vercel.com`) can be added in Cursor to inspect projects and deployments; it does **not** replace dashboard configuration for env vars.

---

## 11. Related docs

- **`docs/MODULAR_SCALE_AND_DESIGN_PATTERNS.md`** — UI scaling on the public report flow (orthogonal to deployment).
- **`.env.example`** — variable names and hints.

---

*Update this file when you add a custom domain, change Vercel/Render service names, or split repos.*
