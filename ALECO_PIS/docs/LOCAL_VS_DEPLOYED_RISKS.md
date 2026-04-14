# Local vs deployed: behaviors that can diverge

This document lists **functionalities and configuration points** that often work during **local development** but **fail or behave differently** on **deployed** environments (e.g. Vercel SPA + Render API), based on a scan of this repository. **No code changes** are implied here—this is operational and architectural awareness.

For general env rules and checklists, see [ENV_AND_DEPLOYMENT_PRINCIPLES.md](./ENV_AND_DEPLOYMENT_PRINCIPLES.md).

---

## 1. Frontend API base URL (`VITE_*` build-time)

| Risk | Local | Deployed |
|------|--------|-----------|
| **Missing `VITE_API_URL` and `VITE_API_URL_PRODUCTION` in a production build** | Dev uses fallback `http://localhost:5000`. | **`getApiBaseUrl()` throws** when the app loads—fail-fast instead of silently calling localhost. |
| **`VITE_API_URL` set to `http://` while the SPA is served over `https://`** | Rare in local dev. | **Mixed content** blocked by the browser: requests to HTTP API from HTTPS page fail. |

**Mitigation:** Set `VITE_API_URL` to the **public HTTPS origin** of the API on the **frontend** build host; rebuild after any change.

---

## 2. CORS (API allows browser origins)

| Risk | Local | Deployed |
|------|--------|-----------|
| **Origin not in the allowlist** | `localhost` / `127.0.0.1` ports are in defaults (`backend/config/corsOrigins.js`). | **New** SPA URLs fail: **custom domain**, **new Vercel project**, **preview deployments** (`*.vercel.app` with new subdomains), or **staging** URLs unless added via `PUBLIC_APP_URL`, `FRONTEND_ORIGIN`, or `CORS_ALLOWED_ORIGINS`. |
| **Missing `PUBLIC_APP_URL` / `CORS_ALLOWED_ORIGINS` on the API** | Defaults include localhost only for dev. | Production SPA origins must be set via env; **`server.js` warns** at startup when `NODE_ENV=production` and no explicit public CORS env is set. |

**Symptom:** Browser console shows CORS errors; API works from curl/Postman (no `Origin` header) but not from the SPA.

---

## 3. Google OAuth and Google Maps (browser)

| Risk | Local | Deployed |
|------|--------|-----------|
| **Authorized JavaScript origins / OAuth client** | `http://localhost:5173` (and similar) can be registered. | Production and **preview** URLs must be added in **Google Cloud Console** or sign-in and Maps init **fail** only on those hosts. |
| **Maps Geocoding key (HTTP referrer restrictions)** | Localhost often allowed in key restrictions. | Production (and preview) **origins** must be allowed or **geocode** in `ReportaProblem.jsx` fails for deployed users. |
| **`VITE_GOOGLE_CLIENT_ID` / `VITE_GOOGLE_MAPS_API_KEY` missing in build** | Might fall back to undefined behavior. | Features depending on those env vars fail **only** in the built app if not set on the build host. |

---

## 4. Geolocation API (browser)

`ReportaProblem.jsx` uses `navigator.geolocation` and then Google’s Geocode API.

| Risk | Local | Deployed |
|------|--------|-----------|
| **Secure context** | `http://localhost` is treated as secure for geolocation. | **HTTPS** is required on non-localhost origins; **HTTP-only** deployment would block or restrict geolocation. |
| **User permission / policy** | Same as production in principle. | Corporate devices, browser settings, or missing HTTPS can block location **only** in real-world browsing. |

---

## 5. Inbound SMS webhook (Yeastar → Express)

| Risk | Local | Deployed |
|------|--------|-----------|
| **Callback URL must be reachable from the internet** | Yeastar cannot POST/GET to `http://localhost:5000/...` unless a **tunnel** (ngrok, Cloudflare Tunnel, etc.) is configured and the URL is updated in Yeastar. | Production uses the **public HTTPS** URL of the API (e.g. Render). Works if DNS + SSL + route are correct. |

**Mitigation:** Configure Yeastar (or equivalent) with the **deployed** API base URL + webhook path; test with the public URL, not localhost.

---

## 6. Outbound integrations (PhilSMS, email, Cloudinary, DB)

These are **server-side** (`process.env` on the API host). They do not depend on the user’s browser calling localhost.

| Area | Note |
|------|------|
| **PhilSMS** | Env vars must be set on the **API** server (Render, etc.). Missing keys fail everywhere, but “works on laptop” can happen if only local `.env` is filled and production env is incomplete. |
| **Email (`nodemailer`)** | Same: production host must have `EMAIL_*` (or equivalent) set. |
| **Cloudinary** | Uploads go from API to Cloudinary; works on deploy if env is set. |
| **MySQL** | `backend/config/db.js` uses env + SSL options. Local DB vs cloud DB: connection strings and firewall (IP allowlists) differ—**connection failures** are often **only on deploy** if the cloud DB does not allow Render’s egress IPs or credentials differ. |

---

## 7. Vite dev server: `allowedHosts` (`vite.config.js`)

The config includes a specific **ngrok** hostname under `server.allowedHosts`.

| Risk | Local | Deployed |
|------|--------|-----------|
| **Accessing the dev server via a different tunnel host** | Vite may **block** the Host header unless that host is listed. | N/A for production build (`vite build` output is static on Vercel). |

This affects **local tunneling**, not the Vercel production bundle.

---

## 8. Platform limits (timeouts, cold start)

Not application bugs, but **deploy-only** pain:

| Risk | Notes |
|------|--------|
| **Render free / low tier** | **Cold start**: first request after idle can be slow or time out. Long-running requests (large backup export/import) may hit **HTTP timeout** limits that you never see on localhost. |
| **Serverless vs long-running** | This app’s API is a **long-running Node** process on Render in the documented setup; behavior differs from splitting into serverless functions. |

---

## 9. Session verification (`/api/verify-session`)

Implemented with `fetch(apiUrl('/api/verify-session'))` in `App.jsx`. It fails like any other API call if **`apiUrl`** points to the wrong host or CORS blocks the SPA origin—same categories as sections 1–2.

---

## 10. Summary: what is already aligned in code

- **API calls** use **`apiUrl()`** or **axios** with **`getApiBaseUrl()`**; production builds **throw** if no `VITE_API_URL` / `VITE_API_URL_PRODUCTION` (dev still uses localhost fallback).
- **CORS** production origins come from **env** (`PUBLIC_APP_URL`, `FRONTEND_ORIGIN`, `CORS_ALLOWED_ORIGINS`), not a hardcoded SPA URL in code.
- **Express** uses **`PORT`** from env and **`trust proxy`** for reverse proxies.
- **Uploads** use **Cloudinary** (not local disk paths), which is suitable for stateless hosts.

---

## 11. Related docs

| Document | Purpose |
|----------|---------|
| [ENV_AND_DEPLOYMENT_PRINCIPLES.md](./ENV_AND_DEPLOYMENT_PRINCIPLES.md) | Host-agnostic env rules, AI checklist |
| [DEPLOYMENT_VERCEL_RENDER.md](./DEPLOYMENT_VERCEL_RENDER.md) | Example Vercel + Render setup |
