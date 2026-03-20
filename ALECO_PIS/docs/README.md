# ALECO PIS — technical docs index

Feature and architecture scans maintained alongside the codebase.

| Document | Contents |
|----------|----------|
| [FULL_CODEBASE_MAP.md](./FULL_CODEBASE_MAP.md) | **Spine doc:** directory manifest, all `/api` routes, screen→API matrix, DB/migrations/env, orphans and drift |
| [BACKEND_SERVER_FLOW.md](./BACKEND_SERVER_FLOW.md) | Express boot, DB pool, **router mount order**, full route inventory by brick |
| [TICKET_FLOW_SCAN.md](./TICKET_FLOW_SCAN.md) | Public + admin ticket flows, grouping, backup touchpoints, SMS deferral appendix |
| [DATA_MANAGEMENT_SCAN.md](./DATA_MANAGEMENT_SCAN.md) | Data Management UI, export / archive / import, entity picker vs tickets-only implementation |
| [USER_AUTH_SCAN.md](./USER_AUTH_SCAN.md) | Auth + user admin APIs, session / `token_version`, login UI |
| [PERSONNEL_HISTORY_SCAN.md](./PERSONNEL_HISTORY_SCAN.md) | Crews & pool (`/crews/*`, `/pool/*`), History + per-ticket logs |
| [LOCATION_PHONE_SMS_API_SCAN.md](./LOCATION_PHONE_SMS_API_SCAN.md) | GPS/geography, phone utils, PhilSMS + inbound webhook, full `/api` route table |

**Source of truth for code style:** [`.cursorrules`](../.cursorrules) and [`ALECO_PIS_COMPLETE_DOCUMENTATION.md`](../ALECO_PIS_COMPLETE_DOCUMENTATION.md).
