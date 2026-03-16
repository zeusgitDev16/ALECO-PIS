-- ============================================================================
-- FIX STATUS ENUM VALUES IN ALECO_TICKETS TABLE
-- ============================================================================
-- This script updates the status enum to match the backend expectations
-- Run this in your MySQL database before starting the server
-- ============================================================================

USE aleco;

-- Update the status enum to include the correct values
-- Current: Unknown enum values
-- New: 'Pending', 'Ongoing', 'Restored', 'Unresolved'
ALTER TABLE aleco_tickets 
MODIFY COLUMN status ENUM('Pending', 'Ongoing', 'Restored', 'Unresolved') 
DEFAULT 'Pending';

-- Verify the change
SHOW COLUMNS FROM aleco_tickets WHERE Field = 'status';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check current status distribution
SELECT status, COUNT(*) as count 
FROM aleco_tickets 
GROUP BY status;

-- Check if there are any NULL status values
SELECT COUNT(*) as null_status_count 
FROM aleco_tickets 
WHERE status IS NULL;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. This script is SAFE to run multiple times (idempotent)
-- 2. Existing data will be preserved
-- 3. If you had 'Resolved' status before, you may need to manually update:
--    UPDATE aleco_tickets SET status = 'Restored' WHERE status = 'Resolved';
-- 4. The default value for new tickets is 'Pending'
-- ============================================================================

