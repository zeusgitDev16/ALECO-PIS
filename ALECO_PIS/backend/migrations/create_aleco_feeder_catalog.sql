-- Feeder catalog (area -> feeder) for advisory + B2B mail targeting.
-- This replaces hardcoded frontend feeder lists as the source of truth.

CREATE TABLE IF NOT EXISTS aleco_feeder_areas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  area_code VARCHAR(50) NOT NULL,
  area_label VARCHAR(100) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_area_code (area_code),
  KEY idx_areas_active_order (is_active, display_order, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS aleco_feeders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  area_id INT NOT NULL,
  feeder_code VARCHAR(50) NOT NULL,
  feeder_label VARCHAR(120) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_aleco_feeders_area
    FOREIGN KEY (area_id) REFERENCES aleco_feeder_areas(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE KEY uq_area_feeder_code (area_id, feeder_code),
  KEY idx_feeders_active_order (is_active, display_order, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed current production set from existing hardcoded FEEDER_AREAS.
INSERT INTO aleco_feeder_areas (area_code, area_label, display_order)
VALUES
  ('bitano', 'Bitano', 10),
  ('washington', 'Washington', 20),
  ('ligao', 'Ligao', 30),
  ('polangui', 'Polangui', 40),
  ('tabaco', 'Tabaco', 50),
  ('malinao', 'Malinao', 60),
  ('salvacion', 'Salvacion', 70)
ON DUPLICATE KEY UPDATE
  area_label = VALUES(area_label),
  display_order = VALUES(display_order),
  is_active = 1;

INSERT INTO aleco_feeders (area_id, feeder_code, feeder_label, display_order)
SELECT a.id, f.feeder_code, f.feeder_label, f.display_order
FROM aleco_feeder_areas a
JOIN (
  SELECT 'bitano' AS area_code, '1' AS feeder_code, 'Bitano Feeder 1' AS feeder_label, 10 AS display_order
  UNION ALL SELECT 'bitano', '2', 'Bitano Feeder 2', 20
  UNION ALL SELECT 'bitano', '3', 'Bitano Feeder 3', 30
  UNION ALL SELECT 'bitano', '4', 'Bitano Feeder 4', 40

  UNION ALL SELECT 'washington', '1', 'Washington Feeder 1', 10
  UNION ALL SELECT 'washington', '2', 'Washington Feeder 2', 20
  UNION ALL SELECT 'washington', '3', 'Washington Feeder 3', 30
  UNION ALL SELECT 'washington', '4', 'Washington Feeder 4', 40

  UNION ALL SELECT 'ligao', '1', 'Ligao Feeder 1', 10
  UNION ALL SELECT 'ligao', '2', 'Ligao Feeder 2', 20
  UNION ALL SELECT 'ligao', '3', 'Ligao Feeder 3', 30
  UNION ALL SELECT 'ligao', '4', 'Ligao Feeder 4', 40

  UNION ALL SELECT 'polangui', '1', 'Polangui Feeder 1', 10
  UNION ALL SELECT 'polangui', '2', 'Polangui Feeder 2', 20
  UNION ALL SELECT 'polangui', '3', 'Polangui Feeder 3', 30
  UNION ALL SELECT 'polangui', '4', 'Polangui Feeder 4', 40

  UNION ALL SELECT 'tabaco', '1', 'Tabaco Feeder 1', 10
  UNION ALL SELECT 'tabaco', '2', 'Tabaco Feeder 2', 20
  UNION ALL SELECT 'tabaco', '3', 'Tabaco Feeder 3', 30
  UNION ALL SELECT 'tabaco', '4', 'Tabaco Feeder 4', 40

  UNION ALL SELECT 'malinao', '1', 'Malinao Feeder 1', 10
  UNION ALL SELECT 'malinao', '2', 'Malinao Feeder 2', 20
  UNION ALL SELECT 'malinao', '3', 'Malinao Feeder 3', 30
  UNION ALL SELECT 'malinao', '4', 'Malinao Feeder 4', 40

  UNION ALL SELECT 'salvacion', 'SMF1', 'Salvacion SMF1', 10
  UNION ALL SELECT 'salvacion', 'SMF2', 'Salvacion SMF2', 20
  UNION ALL SELECT 'salvacion', '3', 'Salvacion Feeder 3', 30
  UNION ALL SELECT 'salvacion', '4', 'Salvacion Feeder 4', 40
) f ON f.area_code = a.area_code
ON DUPLICATE KEY UPDATE
  feeder_label = VALUES(feeder_label),
  display_order = VALUES(display_order),
  is_active = 1;
