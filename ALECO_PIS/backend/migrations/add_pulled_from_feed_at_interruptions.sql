-- Pull from feed: creator can temporarily hide advisory from public without archiving.
-- When pulled_from_feed_at IS NOT NULL, advisory is excluded from public list (includeFuture=false).
-- Run: node backend/run-migration.js backend/migrations/add_pulled_from_feed_at_interruptions.sql

ALTER TABLE aleco_interruptions
  ADD COLUMN pulled_from_feed_at DATETIME NULL DEFAULT NULL
  AFTER public_visible_at;
