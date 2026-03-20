-- Make affected_areas and cause optional (body can be primary content)
-- Run after add_facebook_style_interruptions.sql

ALTER TABLE aleco_interruptions
  MODIFY COLUMN affected_areas TEXT NULL,
  MODIFY COLUMN cause VARCHAR(255) NULL;
