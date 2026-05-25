-- Initialize aleco_service_memo_prefix_seq table with existing memo numbers
-- This ensures backward compatibility - new memos will continue from the highest existing number

-- Initialize sequences for all municipalities
INSERT INTO aleco_service_memo_prefix_seq (prefix, next_seq)
SELECT 
    UPPER(SUBSTRING(control_number, 1, 3)) AS prefix,
    COALESCE(MAX(CAST(SUBSTRING(control_number, 5) AS UNSIGNED)), 0) + 1 AS next_seq
FROM aleco_service_memos
WHERE CHAR_LENGTH(control_number) = 14
  AND SUBSTRING(control_number, 4, 1) = '-'
  AND UPPER(SUBSTRING(control_number, 1, 3)) IN ('BAC', 'MLP', 'MLN', 'SAN', 'TAB', 'TIW', 'CAM', 'DAR', 'LEG', 'MAN', 'RAP', 'GUI', 'JOV', 'LIB', 'LIG', 'OAS', 'PIO', 'POL')
GROUP BY UPPER(SUBSTRING(control_number, 1, 3))
ON DUPLICATE KEY UPDATE next_seq = VALUES(next_seq);

-- Ensure all municipalities have a sequence entry (even if no memos exist yet)
INSERT IGNORE INTO aleco_service_memo_prefix_seq (prefix, next_seq) VALUES
('BAC', 1),
('MLP', 1),
('MLN', 1),
('SAN', 1),
('TAB', 1),
('TIW', 1),
('CAM', 1),
('DAR', 1),
('LEG', 1),
('MAN', 1),
('RAP', 1),
('GUI', 1),
('JOV', 1),
('LIB', 1),
('LIG', 1),
('OAS', 1),
('PIO', 1),
('POL', 1);
