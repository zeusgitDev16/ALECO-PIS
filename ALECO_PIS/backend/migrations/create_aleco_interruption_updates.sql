-- Append-only service memos / audit trail for power advisories.
-- Apply after aleco_interruptions exists.

CREATE TABLE IF NOT EXISTS aleco_interruption_updates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  interruption_id INT NOT NULL,
  remark TEXT NOT NULL,
  kind ENUM('user', 'system') NOT NULL DEFAULT 'user',
  actor_email VARCHAR(255) NULL DEFAULT NULL,
  actor_name VARCHAR(255) NULL DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_interruption_updates_interruption
    FOREIGN KEY (interruption_id) REFERENCES aleco_interruptions (id) ON DELETE CASCADE,
  KEY idx_interruption_created (interruption_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
