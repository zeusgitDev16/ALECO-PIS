-- ============================================================================
-- ADD PHONE INDEX FOR DUPLICATE CHECK PERFORMANCE
-- ============================================================================
-- Improves WHERE phone_number = ? AND created_at >= ... in duplicate check
-- Run: node backend/run-migration.js backend/migrations/add_phone_index.sql
-- ============================================================================

ALTER TABLE aleco_tickets ADD INDEX idx_phone_created (phone_number, created_at);
