-- Add service_memo_id column to aleco_tickets table
-- This column stores the foreign key relationship to aleco_service_memos table

SET @sql = 'ALTER TABLE aleco_tickets ADD COLUMN service_memo_id INT NULL DEFAULT NULL AFTER location_confidence';

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index for faster lookups
CREATE INDEX idx_service_memo_id ON aleco_tickets(service_memo_id);
