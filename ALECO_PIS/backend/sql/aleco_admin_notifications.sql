-- Admin header notifications (User tab, etc.). Run once on MySQL/MariaDB.
CREATE TABLE IF NOT EXISTS aleco_admin_notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tab VARCHAR(32) NOT NULL DEFAULT 'user',
  event_type VARCHAR(64) NOT NULL,
  subject_email VARCHAR(255) DEFAULT NULL,
  subject_name VARCHAR(255) DEFAULT NULL,
  detail VARCHAR(512) DEFAULT NULL,
  actor_email VARCHAR(255) DEFAULT NULL,
  created_at DATETIME NOT NULL,
  read_at DATETIME NULL DEFAULT NULL COMMENT 'NULL = unread',
  PRIMARY KEY (id),
  KEY idx_tab_created (tab, created_at),
  KEY idx_tab_read_created (tab, read_at, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
