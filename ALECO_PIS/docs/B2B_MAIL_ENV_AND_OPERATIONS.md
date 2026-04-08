# B2B Mail Environment and Operations

## Purpose

`B2B Mail` sends advisory emails to feeder-linked partner contacts (LGU/DILG/other heads) from the admin UI.

## Required environment variables (API host)

- `EMAIL_USER` and `EMAIL_PASS`
  - Existing base mail credentials already used by auth and user invite routes.
- `B2B_MAIL_USER` and `B2B_MAIL_PASS` (optional, recommended)
  - If set, B2B mail uses these credentials instead of `EMAIL_*`.
- `B2B_MAIL_FROM` (optional)
  - Explicit sender header.
- `B2B_MAIL_SERVICE` (optional)
  - Defaults to `gmail`.

## Runtime behavior

- Provider utility: `backend/utils/b2bMailProvider.js`
- Route entry: `backend/routes/b2b-mail.js` (mounted at `/api`)
- Send pipeline service: `backend/services/b2bMailService.js`
- Feeder source of truth: `aleco_feeder_areas` + `aleco_feeders`

## Database prerequisites

Apply these migrations before using B2B Mail:

1. `backend/migrations/create_aleco_feeder_catalog.sql`
2. `backend/migrations/add_feeder_id_to_aleco_interruptions.sql`
3. `backend/migrations/create_aleco_b2b_mail.sql`

## Deployment notes (Render API + Vercel UI)

- Frontend must call API via `apiUrl()` / `getApiBaseUrl()` (already followed).
- Do not hardcode hostnames in B2B client code.
- Ensure API CORS envs include deployed UI origin:
  - `PUBLIC_APP_URL` or `FRONTEND_ORIGIN` or `CORS_ALLOWED_ORIGINS`

## Operational guardrails

- Message recipient expansion is deduplicated by email.
- Hard send cap per message is enforced in service (`MAX_RECIPIENTS`).
- Per-recipient delivery status is tracked (`queued/sent/failed/skipped`).
- Audit entries are recorded in `aleco_b2b_mail_audit_logs`.
