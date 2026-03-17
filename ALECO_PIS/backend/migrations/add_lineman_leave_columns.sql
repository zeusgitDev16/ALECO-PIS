-- ============================================================================
-- ADD LEAVE OF ABSENCE COLUMNS FOR LINEMEN (P2 Lifecycle)
-- ============================================================================
-- Run migrations in order. If column already exists, skip that statement.
-- ============================================================================

ALTER TABLE aleco_linemen_pool ADD COLUMN leave_start DATE DEFAULT NULL;
ALTER TABLE aleco_linemen_pool ADD COLUMN leave_end DATE DEFAULT NULL;
ALTER TABLE aleco_linemen_pool ADD COLUMN leave_reason VARCHAR(255) DEFAULT NULL;

-- Expand status enum to include Leave
ALTER TABLE aleco_linemen_pool MODIFY COLUMN status ENUM('Active', 'Inactive', 'Leave') DEFAULT 'Active';
