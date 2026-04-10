-- B2B inbound replies (IMAP poll or future webhook). Run after create_aleco_b2b_mail.sql.

CREATE TABLE IF NOT EXISTS aleco_b2b_inbound_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  provider_message_id VARCHAR(500) NOT NULL COMMENT 'RFC Message-ID or imap-uid- fallback',
  from_email VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL DEFAULT '',
  body_text MEDIUMTEXT NULL,
  in_reply_to VARCHAR(500) NULL,
  references_header TEXT NULL,
  linked_message_id INT NULL,
  linked_recipient_id INT NULL,
  raw_headers MEDIUMTEXT NULL,
  received_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_b2b_inbound_provider (provider_message_id(255)),
  KEY idx_b2b_inbound_linked_msg (linked_message_id),
  KEY idx_b2b_inbound_received (received_at),
  CONSTRAINT fk_b2b_inbound_message
    FOREIGN KEY (linked_message_id) REFERENCES aleco_b2b_messages(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_b2b_inbound_recipient
    FOREIGN KEY (linked_recipient_id) REFERENCES aleco_b2b_message_recipients(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
