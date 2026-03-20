-- Power advisory / public brownout list (GET /api/interruptions + admin CRUD)
-- Apply manually if the table does not exist yet.

CREATE TABLE IF NOT EXISTS aleco_interruptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('Scheduled', 'Unscheduled') NOT NULL DEFAULT 'Unscheduled',
  status ENUM('Pending', 'Ongoing', 'Restored') NOT NULL DEFAULT 'Pending',
  affected_areas TEXT NOT NULL COMMENT 'JSON array of area names, e.g. ["Legazpi City","Daraga"]',
  feeder VARCHAR(100) NOT NULL DEFAULT '',
  cause VARCHAR(255) NOT NULL DEFAULT '',
  date_time_start DATETIME NOT NULL,
  date_time_end_estimated DATETIME NULL,
  date_time_restored DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_type_status (type, status),
  KEY idx_start (date_time_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
