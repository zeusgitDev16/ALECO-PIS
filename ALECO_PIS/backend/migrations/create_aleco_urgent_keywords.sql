-- ============================================================================
-- ALECO URGENT KEYWORDS (Report a Problem / ticket urgency detection)
-- Matches legacy hardcoded list in ReportaProblem.jsx + tickets.js submit
-- ============================================================================

CREATE TABLE IF NOT EXISTS aleco_urgent_keywords (
  id INT AUTO_INCREMENT PRIMARY KEY,
  keyword VARCHAR(128) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_keyword (keyword)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO aleco_urgent_keywords (keyword, display_order) VALUES
('sparking', 1),
('fire', 2),
('sunog', 3),
('explosion', 4),
('sumabog', 5),
('pumuputok', 6),
('electrocuted', 7),
('nakuryente', 8),
('live wire', 9),
('nakabitin na wire', 10),
('smoke', 11),
('usok', 12),
('umuusok', 13),
('burning', 14),
('nasusunog', 15),
('fallen pole', 16),
('natumba', 17),
('nahulog na poste', 18),
('leaning pole', 19),
('nakahilig', 20),
('dangling wire', 21),
('nakabitin', 22),
('naputol na wire', 23),
('cutoff wire', 24),
('walang kuryente', 25),
('patay na kuryente', 26),
('brownout', 27),
('blackout', 28),
('no power', 29),
('power outage', 30),
('emergency', 31),
('aksidente', 32)
ON DUPLICATE KEY UPDATE display_order = VALUES(display_order);
