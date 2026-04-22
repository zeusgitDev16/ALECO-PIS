-- Enforces unique memo numbers. Fails if duplicates exist in aleco_service_memos.control_number.

ALTER TABLE aleco_service_memos
  ADD UNIQUE INDEX uk_aleco_service_memos_control_number (control_number);
