-- Per-user read states for admin notifications.
-- Keeps notifications global but read/unread personal per user.

CREATE TABLE IF NOT EXISTS aleco_admin_notification_reads (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  notification_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  read_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_notif_reads_notif_user (notification_id, user_id),
  KEY idx_admin_notif_reads_user_read (user_id, read_at),
  KEY idx_admin_notif_reads_notif (notification_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
