-- ============================================================================
-- ADD GROUP_TYPE AND VISIT_ORDER (Ticket Grouping Enhancement)
-- ============================================================================
-- group_type: only for GROUP masters (similar_incident | routing_batch)
-- visit_order: for children in routing groups (1, 2, 3...)
-- ============================================================================

ALTER TABLE aleco_tickets ADD COLUMN group_type VARCHAR(20) DEFAULT NULL;
ALTER TABLE aleco_tickets ADD COLUMN visit_order INT DEFAULT NULL;
