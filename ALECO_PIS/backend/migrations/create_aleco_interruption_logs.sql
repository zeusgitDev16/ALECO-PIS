-- ALECO INTERRUPTION LOGS TABLE
-- Full CRUD audit trail for power interruption advisories
-- Tracks all actions: create, update, delete, archive, restore, status changes, feed operations

CREATE TABLE IF NOT EXISTS aleco_interruption_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  interruption_id INT NOT NULL,
  action VARCHAR(50) NOT NULL,
  field_changed VARCHAR(50) DEFAULT NULL,
  old_value TEXT DEFAULT NULL,
  new_value TEXT DEFAULT NULL,
  from_status VARCHAR(20) DEFAULT NULL,
  to_status VARCHAR(20) DEFAULT NULL,
  actor_type ENUM('user', 'system') DEFAULT 'user',
  actor_id INT DEFAULT NULL,
  actor_email VARCHAR(255) DEFAULT NULL,
  actor_name VARCHAR(255) DEFAULT NULL,
  metadata JSON DEFAULT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_interruption_logs_interruption
    FOREIGN KEY (interruption_id) REFERENCES aleco_interruptions (id) ON DELETE CASCADE,
  
  INDEX idx_interruption (interruption_id),
  INDEX idx_created (created_at),
  INDEX idx_action (action),
  INDEX idx_actor (actor_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
