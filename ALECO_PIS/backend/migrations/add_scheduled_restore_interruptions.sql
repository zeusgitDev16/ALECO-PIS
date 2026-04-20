-- Add columns for scheduled automatic restoration of power advisories.
-- scheduled_restore_at: when the system should auto-mark this advisory as Restored.
-- scheduled_restore_remark: pre-written remark to log when auto-restored.

ALTER TABLE aleco_interruptions
  ADD COLUMN scheduled_restore_at DATETIME NULL DEFAULT NULL AFTER public_visible_at,
  ADD COLUMN scheduled_restore_remark TEXT NULL DEFAULT NULL AFTER scheduled_restore_at;
