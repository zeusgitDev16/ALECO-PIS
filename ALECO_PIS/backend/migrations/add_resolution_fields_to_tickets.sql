-- Add resolution accountability fields to aleco_tickets table
-- These fields store the final resolution remarks and accountability info when a ticket is resolved

ALTER TABLE aleco_tickets 
ADD COLUMN resolution_remarks TEXT DEFAULT NULL COMMENT 'Final resolution remarks when ticket is resolved',
ADD COLUMN referred_to VARCHAR(255) DEFAULT NULL COMMENT 'Entity/person the ticket was referred to',
ADD COLUMN accomplished_by VARCHAR(255) DEFAULT NULL COMMENT 'Person who accomplished the resolution';
