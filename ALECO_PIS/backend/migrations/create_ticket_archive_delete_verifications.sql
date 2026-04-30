CREATE TABLE IF NOT EXISTS aleco_ticket_archive_delete_verifications (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  admin_email VARCHAR(255) NOT NULL,
  code_hash CHAR(64) NOT NULL,
  status ENUM('pending', 'verified', 'expired', 'revoked') NOT NULL DEFAULT 'pending',
  attempt_count INT NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  verified_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ticket_archive_delete_verifications_code_hash (code_hash),
  KEY idx_ticket_archive_delete_verifications_admin_status (admin_email, status),
  KEY idx_ticket_archive_delete_verifications_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
