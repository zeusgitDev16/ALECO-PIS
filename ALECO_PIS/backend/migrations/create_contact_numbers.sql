-- ============================================================================
-- ALECO CONTACT NUMBERS (Hotlines & Business Numbers)
-- Purpose: Store hotlines and business numbers for display in Report a Problem
-- ============================================================================

CREATE TABLE IF NOT EXISTS aleco_contact_numbers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('hotline', 'business', 'emergency') NOT NULL,
  label VARCHAR(100) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  description VARCHAR(255) DEFAULT NULL,
  is_active TINYINT(1) DEFAULT 1,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_active_order (is_active, display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed initial data (adjust numbers as needed for ALECO)
INSERT INTO aleco_contact_numbers (type, label, phone_number, description, is_active, display_order) VALUES
('hotline', '24/7 Power Outage Hotline', '09171234567', 'Report outages and emergencies', 1, 1),
('business', 'Main Office', '0521234567', 'General inquiries, billing', 1, 2);
