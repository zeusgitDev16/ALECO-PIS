-- Add normalized feeder reference to interruptions while keeping legacy feeder text.
-- Run AFTER create_aleco_feeder_catalog.sql
-- Idempotent for MySQL variants without ADD ... IF NOT EXISTS support.

SET @db_name = DATABASE();

SET @has_col = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'aleco_interruptions'
    AND COLUMN_NAME = 'feeder_id'
);
SET @sql = IF(
  @has_col = 0,
  'ALTER TABLE aleco_interruptions ADD COLUMN feeder_id INT NULL AFTER feeder',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_idx = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'aleco_interruptions'
    AND INDEX_NAME = 'idx_aleco_interruptions_feeder_id'
);
SET @sql = IF(
  @has_idx = 0,
  'ALTER TABLE aleco_interruptions ADD INDEX idx_aleco_interruptions_feeder_id (feeder_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_fk = (
  SELECT COUNT(*)
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = @db_name
    AND CONSTRAINT_NAME = 'fk_aleco_interruptions_feeder'
);
SET @sql = IF(
  @has_fk = 0,
  'ALTER TABLE aleco_interruptions ADD CONSTRAINT fk_aleco_interruptions_feeder FOREIGN KEY (feeder_id) REFERENCES aleco_feeders(id) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
