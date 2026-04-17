-- Service memos — optional first-class columns (Phase 6)
-- The app currently stores extended timing fields as JSON in `internal_notes` (see `backend/utils/serviceMemoExtended.js`).
-- Run `DESCRIBE aleco_service_memos;` on your environment, then uncomment and adjust the statements below
-- to add dedicated columns. Backfill from JSON can be done in a follow-up script if needed.

-- Example (MySQL 8+): add nullable columns — remove or edit if your deployment already has these names.
/*
ALTER TABLE aleco_service_memos
  ADD COLUMN intake_time VARCHAR(32) NULL COMMENT 'HH:MM or time string' AFTER service_date,
  ADD COLUMN referral_received_date DATE NULL AFTER referred_to,
  ADD COLUMN referral_received_time VARCHAR(32) NULL AFTER referral_received_date,
  ADD COLUMN site_arrived_date DATE NULL,
  ADD COLUMN site_arrived_time VARCHAR(32) NULL,
  ADD COLUMN finished_date DATE NULL,
  ADD COLUMN finished_time VARCHAR(32) NULL;
*/

-- Do NOT drop legacy columns (`work_performed`, `resolution_details`, etc.) until application code
-- is updated to read/write the new columns exclusively.
