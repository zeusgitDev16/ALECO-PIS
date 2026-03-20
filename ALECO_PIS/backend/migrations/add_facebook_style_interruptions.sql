-- Facebook-style revamp: Add body (free-form post), control_no, image_url to aleco_interruptions
-- Run: node backend/run-migration.js backend/migrations/add_facebook_style_interruptions.sql

ALTER TABLE aleco_interruptions
  ADD COLUMN body TEXT NULL COMMENT 'Free-form post content (Facebook-style)' AFTER cause_category,
  ADD COLUMN control_no VARCHAR(50) NULL COMMENT 'e.g. SIMAR2026-037' AFTER body,
  ADD COLUMN image_url VARCHAR(500) NULL COMMENT 'Optional advisory graphic' AFTER control_no;
