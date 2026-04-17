-- Optional header image for service memo (URL or data URL from UI). Run once.
ALTER TABLE aleco_service_memos
  ADD COLUMN photo_url TEXT NULL COMMENT 'Optional memo header image' AFTER internal_notes;
