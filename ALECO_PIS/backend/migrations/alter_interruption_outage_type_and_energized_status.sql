-- Outage types: Scheduled | Emergency | NgcScheduled (replaces Unscheduled → Emergency).
-- Lifecycle status: Restored → Energized (resolved / re-energized advisories).
-- Run once against the database that already has create_aleco_interruptions applied.

-- 1) Type: add new enum members, migrate, drop old
ALTER TABLE aleco_interruptions
  MODIFY COLUMN type ENUM('Scheduled', 'Unscheduled', 'Emergency', 'NgcScheduled') NOT NULL DEFAULT 'Emergency';

UPDATE aleco_interruptions SET type = 'Emergency' WHERE type = 'Unscheduled';

ALTER TABLE aleco_interruptions
  MODIFY COLUMN type ENUM('Scheduled', 'Emergency', 'NgcScheduled') NOT NULL DEFAULT 'Emergency';

-- 2) Status: add Energized, migrate Restored, drop Restored
ALTER TABLE aleco_interruptions
  MODIFY COLUMN status ENUM('Pending', 'Ongoing', 'Restored', 'Energized') NOT NULL DEFAULT 'Pending';

UPDATE aleco_interruptions SET status = 'Energized' WHERE status = 'Restored';

ALTER TABLE aleco_interruptions
  MODIFY COLUMN status ENUM('Pending', 'Ongoing', 'Energized') NOT NULL DEFAULT 'Pending';
