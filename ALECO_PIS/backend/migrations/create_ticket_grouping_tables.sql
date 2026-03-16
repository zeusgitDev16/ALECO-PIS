-- ============================================================================
-- TICKET GROUPING SYSTEM - DATABASE SCHEMA
-- Purpose: Enable grouping of similar tickets under a single Main Ticket ID
-- ============================================================================

-- Table 1: Ticket Groups (Main Ticket Records)
CREATE TABLE IF NOT EXISTS aleco_ticket_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    main_ticket_id VARCHAR(50) UNIQUE NOT NULL COMMENT 'Format: GROUP-YYYYMMDD-XXXX',
    title VARCHAR(255) NOT NULL COMMENT 'Group title/description',
    category VARCHAR(100) NOT NULL COMMENT 'Main category for the group',
    remarks TEXT COMMENT 'Initial remarks or notes',
    status ENUM('Pending', 'Ongoing', 'Resolved', 'Unresolved') DEFAULT 'Pending',
    ticket_count INT DEFAULT 0 COMMENT 'Number of tickets in this group',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_main_ticket_id (main_ticket_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Stores main ticket group records';

-- Table 2: Ticket Group Members (Junction Table)
CREATE TABLE IF NOT EXISTS aleco_ticket_group_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    main_ticket_id VARCHAR(50) NOT NULL COMMENT 'References aleco_ticket_groups.main_ticket_id',
    ticket_id VARCHAR(50) NOT NULL COMMENT 'References aleco_tickets.ticket_id',
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_group_member (main_ticket_id, ticket_id),
    INDEX idx_main_ticket (main_ticket_id),
    INDEX idx_ticket (ticket_id),
    FOREIGN KEY (main_ticket_id) REFERENCES aleco_ticket_groups(main_ticket_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Links individual tickets to their parent group';

-- Add columns to existing aleco_tickets table
ALTER TABLE aleco_tickets 
ADD COLUMN IF NOT EXISTS is_grouped TINYINT(1) DEFAULT 0 COMMENT 'Whether this ticket is part of a group',
ADD COLUMN IF NOT EXISTS group_id VARCHAR(50) DEFAULT NULL COMMENT 'Main ticket ID if grouped',
ADD INDEX idx_is_grouped (is_grouped),
ADD INDEX idx_group_id (group_id);

-- ============================================================================
-- SAMPLE QUERIES FOR REFERENCE
-- ============================================================================

-- Get all groups with their member tickets
-- SELECT 
--     g.main_ticket_id,
--     g.title,
--     g.category,
--     g.status,
--     g.ticket_count,
--     g.created_at,
--     GROUP_CONCAT(gm.ticket_id) as member_tickets
-- FROM aleco_ticket_groups g
-- LEFT JOIN aleco_ticket_group_members gm ON g.main_ticket_id = gm.main_ticket_id
-- GROUP BY g.main_ticket_id
-- ORDER BY g.created_at DESC;

-- Get all tickets in a specific group
-- SELECT t.* 
-- FROM aleco_tickets t
-- INNER JOIN aleco_ticket_group_members gm ON t.ticket_id = gm.ticket_id
-- WHERE gm.main_ticket_id = 'GROUP-20260316-0001';

-- Get ungrouped tickets only
-- SELECT * FROM aleco_tickets WHERE is_grouped = 0 OR is_grouped IS NULL;

-- Get grouped tickets only
-- SELECT * FROM aleco_tickets WHERE is_grouped = 1;

