-- ============================================================
-- DATABASE CLEANUP SCRIPT - TRUNCATE ALL TABLES
-- ============================================================
-- WARNING: This will permanently delete ALL data from all tables
-- Use only for testing/fresh start purposes
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- Audit/Log tables (child tables)
TRUNCATE TABLE aleco_ticket_logs;
TRUNCATE TABLE aleco_b2b_mail_audit_logs;
TRUNCATE TABLE aleco_interruption_logs;
TRUNCATE TABLE aleco_interruption_updates;
TRUNCATE TABLE aleco_personnel_audit_logs;
TRUNCATE TABLE aleco_export_log;

-- B2B Mail child tables
TRUNCATE TABLE aleco_b2b_inbound_messages;
TRUNCATE TABLE aleco_b2b_message_recipients;
TRUNCATE TABLE aleco_b2b_contact_verifications;
TRUNCATE TABLE aleco_b2b_contact_feeders;
TRUNCATE TABLE aleco_b2b_contacts;
TRUNCATE TABLE aleco_b2b_sync_state;
TRUNCATE TABLE aleco_b2b_templates;
TRUNCATE TABLE aleco_b2b_messages;

-- Personnel child tables
TRUNCATE TABLE aleco_crew_members;
TRUNCATE TABLE aleco_linemen_pool;
TRUNCATE TABLE aleco_personnel;

-- Interruptions child tables
TRUNCATE TABLE aleco_interruptions;
TRUNCATE TABLE aleco_incidents;

-- Service Memos
TRUNCATE TABLE aleco_service_memos;
TRUNCATE TABLE aleco_service_memo_prefix_seq;

-- Tickets
TRUNCATE TABLE aleco_tickets;
TRUNCATE TABLE aleco_ticket_archive_delete_verifications;

-- Reference/Configuration tables
TRUNCATE TABLE aleco_feeder_areas;
TRUNCATE TABLE aleco_feeders;
TRUNCATE TABLE aleco_contact_numbers;
TRUNCATE TABLE aleco_urgent_keywords;

-- User management (EXCLUDED - keep users table for login)
-- TRUNCATE TABLE access_codes;
-- TRUNCATE TABLE password_resets;
-- TRUNCATE TABLE aleco_admin_notification_reads;
-- TRUNCATE TABLE aleco_admin_notifications;
-- TRUNCATE TABLE users;

-- Site settings (keep last - may have defaults)
TRUNCATE TABLE aleco_site_settings;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- RESET AUTO_INCREMENT SEQUENCES
-- ============================================================
-- Reset auto-increment to 1 for clean start
ALTER TABLE aleco_ticket_logs AUTO_INCREMENT = 1;
ALTER TABLE aleco_b2b_mail_audit_logs AUTO_INCREMENT = 1;
ALTER TABLE aleco_interruption_logs AUTO_INCREMENT = 1;
ALTER TABLE aleco_interruption_updates AUTO_INCREMENT = 1;
ALTER TABLE aleco_personnel_audit_logs AUTO_INCREMENT = 1;
ALTER TABLE aleco_export_log AUTO_INCREMENT = 1;
ALTER TABLE aleco_b2b_inbound_messages AUTO_INCREMENT = 1;
ALTER TABLE aleco_b2b_message_recipients AUTO_INCREMENT = 1;
ALTER TABLE aleco_b2b_contact_verifications AUTO_INCREMENT = 1;
ALTER TABLE aleco_b2b_contact_feeders AUTO_INCREMENT = 1;
ALTER TABLE aleco_b2b_contacts AUTO_INCREMENT = 1;
ALTER TABLE aleco_b2b_sync_state AUTO_INCREMENT = 1;
ALTER TABLE aleco_b2b_templates AUTO_INCREMENT = 1;
ALTER TABLE aleco_b2b_messages AUTO_INCREMENT = 1;
ALTER TABLE aleco_crew_members AUTO_INCREMENT = 1;
ALTER TABLE aleco_linemen_pool AUTO_INCREMENT = 1;
ALTER TABLE aleco_personnel AUTO_INCREMENT = 1;
ALTER TABLE aleco_interruptions AUTO_INCREMENT = 1;
ALTER TABLE aleco_incidents AUTO_INCREMENT = 1;
ALTER TABLE aleco_service_memos AUTO_INCREMENT = 1;
ALTER TABLE aleco_service_memo_prefix_seq AUTO_INCREMENT = 1;
ALTER TABLE aleco_tickets AUTO_INCREMENT = 1;
ALTER TABLE aleco_ticket_archive_delete_verifications AUTO_INCREMENT = 1;
ALTER TABLE aleco_feeder_areas AUTO_INCREMENT = 1;
ALTER TABLE aleco_feeders AUTO_INCREMENT = 1;
ALTER TABLE aleco_contact_numbers AUTO_INCREMENT = 1;
ALTER TABLE aleco_urgent_keywords AUTO_INCREMENT = 1;

ALTER TABLE aleco_site_settings AUTO_INCREMENT = 1;

-- ============================================================
-- DONE - All tables truncated and sequences reset
-- ============================================================
