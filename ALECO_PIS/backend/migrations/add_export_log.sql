-- ADD EXPORT LOG TABLE (Track ticket export operations)
CREATE TABLE IF NOT EXISTS aleco_export_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  export_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  date_start DATE DEFAULT NULL,
  date_end DATE DEFAULT NULL,
  ticket_count INT DEFAULT 0,
  log_count INT DEFAULT 0,
  format VARCHAR(10) DEFAULT 'excel',
  exported_by VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_export_date (export_date)
);
