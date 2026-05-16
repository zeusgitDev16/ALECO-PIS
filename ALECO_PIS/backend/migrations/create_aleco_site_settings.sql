-- Create a key-value store for site-wide settings (Logo, Nav Labels, etc.)
CREATE TABLE IF NOT EXISTS aleco_site_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);


INSERT IGNORE INTO aleco_site_settings (setting_key, setting_value) 
VALUES ('site_logo_url', NULL);
