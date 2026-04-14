-- B2B contact email verification support

ALTER TABLE aleco_b2b_contacts
  ADD COLUMN IF NOT EXISTS email_verified TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active,
  ADD COLUMN IF NOT EXISTS verified_at DATETIME NULL AFTER email_verified;

CREATE TABLE IF NOT EXISTS aleco_b2b_contact_verifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  contact_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL,
  status ENUM('pending','verified','expired','revoked') NOT NULL DEFAULT 'pending',
  expires_at DATETIME NOT NULL,
  verified_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_b2b_contact_verify_token_hash (token_hash),
  KEY idx_b2b_contact_verify_contact_status (contact_id, status),
  KEY idx_b2b_contact_verify_expires (expires_at),
  CONSTRAINT fk_b2b_contact_verify_contact
    FOREIGN KEY (contact_id) REFERENCES aleco_b2b_contacts(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
