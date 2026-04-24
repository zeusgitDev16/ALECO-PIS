-- Grouped affected areas for poster sections; optional rendered poster image URL (e.g. Cloudinary).
-- Run: node backend/run-migration.js backend/migrations/add_affected_areas_grouped_and_poster_image_url.sql

ALTER TABLE aleco_interruptions
  ADD COLUMN affected_areas_grouped JSON NULL AFTER affected_areas;

ALTER TABLE aleco_interruptions
  ADD COLUMN poster_image_url VARCHAR(512) NULL AFTER image_url;
