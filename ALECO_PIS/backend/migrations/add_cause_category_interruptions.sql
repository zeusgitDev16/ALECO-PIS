-- Optional structured cause category for power advisories.
-- Apply manually after aleco_interruptions exists.

ALTER TABLE aleco_interruptions
  ADD COLUMN cause_category VARCHAR(64) NULL DEFAULT NULL
  AFTER cause;
