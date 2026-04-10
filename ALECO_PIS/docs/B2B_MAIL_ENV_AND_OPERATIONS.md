# B2B Mail Environment and Operations

## Purpose

`B2B Mail` sends advisory emails to feeder-linked partner contacts (LGU/DILG/other heads) from the admin UI.

## Required environment variables (API host)

- `EMAIL_USER` and `EMAIL_PASS`
  - Shared app mail credentials used by tickets (`/api/tickets/send-copy`), auth (password reset), user invites, and the default B2B transport when `B2B_MAIL_*` is not set.
- `B2B_MAIL_USER` and `B2B_MAIL_PASS` (optional, recommended)
  - If set, B2B outbound uses a dedicated mailbox via `backend/utils/appMail.js` (`useB2BTransport`).
- `B2B_MAIL_FROM` (optional)
  - Explicit sender header.
- `B2B_MAIL_REPLY_TO` (optional)
  - Where partner replies should go; defaults to B2B or app sender. Use the same mailbox you poll for inbound.
- `B2B_MAIL_SERVICE` (optional)
  - Defaults to `gmail`.
- `PUBLIC_API_URL` (optional, recommended)
  - Public HTTPS API origin used to build contact verification links sent by email. If omitted, backend derives from request host.

## Inbound replies (optional)

**Decision:** Primary ingestion path is **IMAP polling** against the same Gmail-style mailbox (compatible with existing nodemailer setup). An optional **JSON webhook** is available for server-to-server forwarding (e.g. automation).

### Database

4. `backend/migrations/create_aleco_b2b_inbound.sql` — table `aleco_b2b_inbound_messages`.

### IMAP poll (Render / long-running API)

- Set `B2B_INBOUND_IMAP_ENABLED=true`.
- `B2B_INBOUND_IMAP_HOST` (default `imap.gmail.com`), `B2B_INBOUND_IMAP_PORT` (default `993`), `B2B_INBOUND_IMAP_TLS` (default `true`).
- Credentials: `B2B_INBOUND_IMAP_USER` / `B2B_INBOUND_IMAP_PASS`, or fall back to `B2B_MAIL_*`, then `EMAIL_*`.
- The API runs `pollB2BInboundOnce()` on startup and every **5 minutes** (`server.js`). Unseen messages are marked read after insert to avoid duplicates.
- Linking: `In-Reply-To` is matched to `aleco_b2b_message_recipients.provider_message_id` from outbound sends.

### Inbound webhook

- Set `B2B_INBOUND_WEBHOOK_SECRET` to a long random string.
- `POST /api/b2b-mail/inbound/webhook` with header `X-B2B-Webhook-Secret: <same value>`.
- JSON body: `providerMessageId` (required), `fromEmail`, `subject`, `bodyText`, `inReplyTo`, `references`, optional `linkedMessageId` / `linkedRecipientId`.

## Runtime behavior

- Shared send helper: `backend/utils/appMail.js` (`sendAppMail`, cached transporters).
- B2B wrapper: `backend/utils/b2bMailProvider.js` (headers `X-ALECO-B2B-Message-Id`, `X-ALECO-B2B-Recipient-Id`, `replyTo`).
- Route entry: `backend/routes/b2b-mail.js` (mounted at `/api`)
- Send pipeline service: `backend/services/b2bMailService.js`
- Inbound poll: `backend/services/b2bInboundImapPoll.js`
- Feeder source of truth: `aleco_feeder_areas` + `aleco_feeders`

## Smoke test (after deploy)

1. Run all SQL migrations above (including inbound if using replies).
2. In admin **B2B Mail**, add at least one active contact with a real test email.
3. Compose → **Preview recipients** → confirm count ≥ 1.
4. **Save draft** → **Send** → confirm rows in `aleco_b2b_message_recipients` with `sent` or `failed` and `provider_message_id` set.
5. Optional: reply from the test mailbox; after IMAP poll, row appears in `aleco_b2b_inbound_messages` and in the UI **Inbound replies** list.

## Database prerequisites

Apply these migrations before using B2B Mail:

1. `backend/migrations/create_aleco_feeder_catalog.sql`
2. `backend/migrations/add_feeder_id_to_aleco_interruptions.sql`
3. `backend/migrations/create_aleco_b2b_mail.sql`
4. `backend/migrations/add_b2b_contact_email_verification.sql`

## Deployment notes (Render API + Vercel UI)

- Frontend must call API via `apiUrl()` / `getApiBaseUrl()` (already followed).
- Do not hardcode hostnames in B2B client code.
- Ensure API CORS envs include deployed UI origin:
  - `PUBLIC_APP_URL` or `FRONTEND_ORIGIN` or `CORS_ALLOWED_ORIGINS`

## Operational guardrails

- Message recipient expansion is deduplicated by email.
- **Only verified contacts are eligible** for recipient expansion (`email_verified=1`).
- Hard send cap per message is enforced in service (`MAX_RECIPIENTS`).
- Per-recipient delivery status is tracked (`queued/sent/failed/skipped`).
- Audit entries are recorded in `aleco_b2b_mail_audit_logs`.
