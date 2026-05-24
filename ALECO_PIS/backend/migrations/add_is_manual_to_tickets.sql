-- Add is_manual column to aleco_tickets table
-- This column tracks whether a ticket was created manually by a dispatcher (is_manual = 1)
-- or submitted via the public "Report a Problem" form (is_manual = 0, default)

ALTER TABLE aleco_tickets
ADD COLUMN is_manual TINYINT(1) NOT NULL DEFAULT 0
AFTER location_confidence;
