-- Add CustomPoster to the outage type ENUM for custom/Canva-uploaded poster advisories.
-- Run once: node backend/run-migration.js backend/migrations/add_custom_poster_interruption_type.sql

ALTER TABLE aleco_interruptions
  MODIFY COLUMN type ENUM('Scheduled', 'Emergency', 'NgcScheduled', 'CustomPoster') NOT NULL DEFAULT 'Emergency';
