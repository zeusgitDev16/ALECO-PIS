-- ============================================================================
-- ADD HOLD REASON AND HOLD_SINCE COLUMNS (P2 Holds)
-- ============================================================================
-- Ticket stays Ongoing; hold_reason and hold_since track why/when
-- Run each statement separately if one fails (column may already exist)
-- ============================================================================

ALTER TABLE aleco_tickets ADD COLUMN hold_reason VARCHAR(255) DEFAULT NULL;
ALTER TABLE aleco_tickets ADD COLUMN hold_since DATETIME DEFAULT NULL;
