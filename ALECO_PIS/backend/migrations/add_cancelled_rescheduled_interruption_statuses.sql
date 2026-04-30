-- Add Cancelled and Rescheduled to interruption lifecycle statuses.
-- Run once: node backend/run-migration.js backend/migrations/add_cancelled_rescheduled_interruption_statuses.sql

-- Transitional enum to support legacy rows still using Restored.
ALTER TABLE aleco_interruptions
  MODIFY COLUMN status ENUM('Pending', 'Ongoing', 'Restored', 'Energized', 'Cancelled', 'Rescheduled') NOT NULL DEFAULT 'Pending';

-- Normalize old literal to the current canonical value.
UPDATE aleco_interruptions
SET status = 'Energized'
WHERE status = 'Restored';

-- Final enum set used by the app.
ALTER TABLE aleco_interruptions
  MODIFY COLUMN status ENUM('Pending', 'Ongoing', 'Energized', 'Cancelled', 'Rescheduled') NOT NULL DEFAULT 'Pending';
