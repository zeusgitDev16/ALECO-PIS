-- ============================================================================
-- ADD NoFaultFound AND AccessDenied TICKET STATUS (P1 Outcomes)
-- ============================================================================
-- Run this in your MySQL database
-- ============================================================================

-- Add new status values to the enum
ALTER TABLE aleco_tickets 
MODIFY COLUMN status ENUM(
    'Pending', 
    'Ongoing', 
    'Restored', 
    'Unresolved',
    'NoFaultFound',
    'AccessDenied'
) DEFAULT 'Pending';
