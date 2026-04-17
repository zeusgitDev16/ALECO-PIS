-- Service memo control numbers: per-municipality 3-letter prefix + 10-digit sequence (e.g. LEG-0000089729).
-- Run on Render / production AFTER backup. If UNIQUE(control_number) fails, deduplicate legacy rows first.

CREATE TABLE IF NOT EXISTS aleco_service_memo_prefix_seq (
  prefix CHAR(3) NOT NULL,
  next_seq BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (prefix)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT 'Next sequence value to issue per memo# prefix; see backend/utils/memoControlNumber.js';

-- Optional (run after deduping any duplicate control_number values): see add_aleco_service_memos_control_number_unique.sql
