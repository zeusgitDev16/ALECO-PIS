# Interruption poster — backlog epics (post–poster alignment)

Tracked from the phased poster plan (Task 14+). Not in scope for the initial alignment rollout; implement when product and comms are ready.

## DM-2 — Cancelled status and overlay

- **Goal:** Treat **Cancelled** as a first-class lifecycle state with correct public messaging and optional poster overlay (strike/watermark pattern).
- **Touches:** Status enum / labels, `interruptionPosterFields`, infographic + print templates, feed cards, admin filters.

## DM-1 — Multi-slot schedule

- **Goal:** Support multiple date/time windows per advisory (JSON + form) and render them consistently on poster, feed, and share HTML.
- **Touches:** Schema or JSON column, validation, `InterruptionAdvisoryForm`, `interruptionPosterFields`, Puppeteer viewport if height grows.

## DM-4 — Disconnection layout

- **Goal:** Dedicated layout or data model for **disconnection**-style advisories (distinct from standard interruption wording and blocks).
- **Touches:** Type or subtype, poster HTML branch, optional NGCP co-branding rules.

## NGCP letter variant

- **Goal:** Full cooperative **NGCP** letter-style template (not only the headline string), aligned with reference PDFs/prints.
- **Touches:** New print route or variant flag, longer-form CSS, possible extra fields on the DTO.
