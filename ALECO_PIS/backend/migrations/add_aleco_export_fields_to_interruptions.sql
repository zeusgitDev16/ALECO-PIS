-- Add optional structured fields for ALECO interruption export alignment (idempotent).
-- Safe to run multiple times.

SET @has_substation_recloser := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'aleco_interruptions'
    AND COLUMN_NAME = 'substation_recloser'
);

SET @sql_substation_recloser := IF(
  @has_substation_recloser = 0,
  'ALTER TABLE aleco_interruptions ADD COLUMN substation_recloser VARCHAR(255) NULL AFTER feeder',
  'SELECT "Column substation_recloser already exists"'
);
PREPARE stmt_substation_recloser FROM @sql_substation_recloser;
EXECUTE stmt_substation_recloser;
DEALLOCATE PREPARE stmt_substation_recloser;

SET @has_indication_magnitude := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'aleco_interruptions'
    AND COLUMN_NAME = 'indication_magnitude'
);

SET @sql_indication_magnitude := IF(
  @has_indication_magnitude = 0,
  'ALTER TABLE aleco_interruptions ADD COLUMN indication_magnitude TEXT NULL AFTER cause',
  'SELECT "Column indication_magnitude already exists"'
);
PREPARE stmt_indication_magnitude FROM @sql_indication_magnitude;
EXECUTE stmt_indication_magnitude;
DEALLOCATE PREPARE stmt_indication_magnitude;

SET @has_possible_fault_location := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'aleco_interruptions'
    AND COLUMN_NAME = 'possible_fault_location'
);

SET @sql_possible_fault_location := IF(
  @has_possible_fault_location = 0,
  'ALTER TABLE aleco_interruptions ADD COLUMN possible_fault_location TEXT NULL AFTER indication_magnitude',
  'SELECT "Column possible_fault_location already exists"'
);
PREPARE stmt_possible_fault_location FROM @sql_possible_fault_location;
EXECUTE stmt_possible_fault_location;
DEALLOCATE PREPARE stmt_possible_fault_location;

SET @has_linemen_on_duty := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'aleco_interruptions'
    AND COLUMN_NAME = 'linemen_on_duty'
);

SET @sql_linemen_on_duty := IF(
  @has_linemen_on_duty = 0,
  'ALTER TABLE aleco_interruptions ADD COLUMN linemen_on_duty TEXT NULL AFTER possible_fault_location',
  'SELECT "Column linemen_on_duty already exists"'
);
PREPARE stmt_linemen_on_duty FROM @sql_linemen_on_duty;
EXECUTE stmt_linemen_on_duty;
DEALLOCATE PREPARE stmt_linemen_on_duty;
