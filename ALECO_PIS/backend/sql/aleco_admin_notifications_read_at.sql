-- Run once on existing DBs that already have aleco_admin_notifications.
-- Enables "mark all as read" (unread = read_at IS NULL).

ALTER TABLE aleco_admin_notifications
  ADD COLUMN read_at DATETIME NULL DEFAULT NULL COMMENT 'NULL = unread' AFTER created_at,
  ADD KEY idx_tab_read_created (tab, read_at, created_at);
