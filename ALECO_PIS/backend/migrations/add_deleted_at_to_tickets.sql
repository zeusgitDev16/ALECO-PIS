-- Add soft delete support for tickets
-- Tickets with deleted_at set are excluded from list views
-- Run: node backend/run-migration.js backend/migrations/add_deleted_at_to_tickets.sql

ALTER TABLE aleco_tickets ADD COLUMN deleted_at DATETIME DEFAULT NULL;
