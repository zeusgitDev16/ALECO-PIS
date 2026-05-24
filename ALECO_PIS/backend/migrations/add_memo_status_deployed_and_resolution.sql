-- Add new memo_status values for workflow: saved, deployed, resolved, unresolved, nofaultfound, accessdenied
-- Run this migration to expand the memo_status enum

ALTER TABLE aleco_service_memos
  MODIFY COLUMN memo_status ENUM('saved', 'deployed', 'resolved', 'unresolved', 'nofaultfound', 'accessdenied', 'closed') NOT NULL DEFAULT 'saved';
