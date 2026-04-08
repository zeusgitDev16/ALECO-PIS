-- B2B Mail core schema
-- Run after feeder catalog migration.

CREATE TABLE IF NOT EXISTS aleco_b2b_contacts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_name VARCHAR(180) NOT NULL DEFAULT '',
  contact_name VARCHAR(180) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NULL,
  feeder_id INT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_aleco_b2b_contacts_email (email),
  KEY idx_aleco_b2b_contacts_active (is_active),
  KEY idx_aleco_b2b_contacts_feeder (feeder_id),
  KEY idx_aleco_b2b_contacts_name (contact_name),
  CONSTRAINT fk_aleco_b2b_contacts_feeder
    FOREIGN KEY (feeder_id) REFERENCES aleco_feeders(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS aleco_b2b_contact_feeders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  contact_id INT NOT NULL,
  feeder_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_aleco_b2b_contact_feeders (contact_id, feeder_id),
  KEY idx_aleco_b2b_contact_feeders_feeder (feeder_id),
  CONSTRAINT fk_aleco_b2b_contact_feeders_contact
    FOREIGN KEY (contact_id) REFERENCES aleco_b2b_contacts(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_aleco_b2b_contact_feeders_feeder
    FOREIGN KEY (feeder_id) REFERENCES aleco_feeders(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS aleco_b2b_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  subject VARCHAR(255) NOT NULL DEFAULT '',
  body_html MEDIUMTEXT NULL,
  body_text MEDIUMTEXT NULL,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  created_by_email VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_aleco_b2b_templates_name (name),
  KEY idx_aleco_b2b_templates_system (is_system)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS aleco_b2b_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subject VARCHAR(255) NOT NULL DEFAULT '',
  body_html MEDIUMTEXT NULL,
  body_text MEDIUMTEXT NULL,
  target_mode ENUM('all_feeders', 'selected_feeders', 'interruption_linked', 'manual_contacts') NOT NULL DEFAULT 'all_feeders',
  selected_feeder_ids TEXT NULL COMMENT 'JSON array of feeder ids',
  selected_contact_ids TEXT NULL COMMENT 'JSON array of contact ids',
  interruption_id INT NULL,
  template_id INT NULL,
  created_by_email VARCHAR(255) NULL,
  created_by_name VARCHAR(180) NULL,
  status ENUM('draft', 'queued', 'sending', 'sent', 'failed', 'cancelled') NOT NULL DEFAULT 'draft',
  sent_at DATETIME NULL,
  last_error TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_aleco_b2b_messages_status_created (status, created_at),
  KEY idx_aleco_b2b_messages_sender (created_by_email),
  KEY idx_aleco_b2b_messages_interruptions (interruption_id),
  CONSTRAINT fk_aleco_b2b_messages_interruptions
    FOREIGN KEY (interruption_id) REFERENCES aleco_interruptions(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_aleco_b2b_messages_templates
    FOREIGN KEY (template_id) REFERENCES aleco_b2b_templates(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS aleco_b2b_message_recipients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_id INT NOT NULL,
  contact_id INT NULL,
  email_snapshot VARCHAR(255) NOT NULL,
  name_snapshot VARCHAR(180) NOT NULL DEFAULT '',
  send_status ENUM('queued', 'sent', 'failed', 'skipped') NOT NULL DEFAULT 'queued',
  provider_message_id VARCHAR(255) NULL,
  error_message TEXT NULL,
  sent_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_aleco_b2b_msg_rec_unique (message_id, email_snapshot),
  KEY idx_aleco_b2b_msg_rec_message_status (message_id, send_status),
  KEY idx_aleco_b2b_msg_rec_email (email_snapshot),
  CONSTRAINT fk_aleco_b2b_msg_rec_message
    FOREIGN KEY (message_id) REFERENCES aleco_b2b_messages(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_aleco_b2b_msg_rec_contact
    FOREIGN KEY (contact_id) REFERENCES aleco_b2b_contacts(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS aleco_b2b_mail_audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_id INT NULL,
  actor_email VARCHAR(255) NULL,
  actor_name VARCHAR(180) NULL,
  action VARCHAR(80) NOT NULL,
  details TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_aleco_b2b_audit_message (message_id),
  KEY idx_aleco_b2b_audit_action_time (action, created_at),
  CONSTRAINT fk_aleco_b2b_audit_message
    FOREIGN KEY (message_id) REFERENCES aleco_b2b_messages(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO aleco_b2b_templates (name, subject, body_text, is_system, created_by_email)
VALUES
  ('General announcement', 'ALECO Advisory Notice', 'Good day.\n\nThis is an official advisory from ALECO.\n\n[Details]\n\nThank you.', 1, 'system'),
  ('Feeder-specific update', 'Feeder Update: [Feeder Name]', 'Good day.\n\nPlease be informed of the feeder-specific update below.\n\n[Details]\n\nThank you.', 1, 'system')
ON DUPLICATE KEY UPDATE
  subject = VALUES(subject),
  body_text = VALUES(body_text),
  is_system = VALUES(is_system);
