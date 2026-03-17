-- ADD TICKET LOGS TABLE (Ticket History / Audit Trail)
-- Tracks dispatcher actions, crew dispatch, status changes, and (future) lineman SMS-based resolution

CREATE TABLE IF NOT EXISTS aleco_ticket_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ticket_id VARCHAR(20) NOT NULL,
  action VARCHAR(50) NOT NULL,
  from_status VARCHAR(20) DEFAULT NULL,
  to_status VARCHAR(20) DEFAULT NULL,
  actor_type ENUM('dispatcher', 'sms_lineman', 'system') DEFAULT 'dispatcher',
  actor_id INT DEFAULT NULL,
  actor_email VARCHAR(255) DEFAULT NULL,
  actor_name VARCHAR(255) DEFAULT NULL,
  metadata JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ticket (ticket_id),
  INDEX idx_created (created_at)
);
