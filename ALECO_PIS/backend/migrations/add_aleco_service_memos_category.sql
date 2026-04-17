-- Snapshot of ticket category on the service memo (same source as request/ticket fields; persisted on save).
-- Run on deploy before relying on POST/PUT service-memo category.

ALTER TABLE aleco_service_memos
  ADD COLUMN category VARCHAR(255) NULL DEFAULT NULL COMMENT 'Ticket category at save time' AFTER ticket_status;
