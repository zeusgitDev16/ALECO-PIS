-- When set, advisory is hidden from public GET until this time (server NOW). NULL = visible immediately.
-- Run after aleco_interruptions exists.

ALTER TABLE aleco_interruptions
  ADD COLUMN public_visible_at DATETIME NULL DEFAULT NULL
  AFTER date_time_restored;
