-- Soft delete for power advisories: rows stay for reporting, public lists hide archived.
-- Run: node backend/run-migration.js backend/migrations/add_deleted_at_aleco_interruptions.sql

ALTER TABLE aleco_interruptions
  ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL,
  ADD INDEX idx_aleco_interruptions_deleted_at (deleted_at);
