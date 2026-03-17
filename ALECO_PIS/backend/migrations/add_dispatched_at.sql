-- ============================================================================
-- ADD DISPATCHED_AT COLUMN (P2 Dispatcher Flow)
-- ============================================================================
-- Tracks when a ticket was dispatched for reporting and timeline
-- ============================================================================

ALTER TABLE aleco_tickets ADD COLUMN dispatched_at DATETIME DEFAULT NULL;
