-- Retire draft: only saved + closed remain. Run after deploy alongside app that no longer uses draft.

UPDATE aleco_service_memos
SET memo_status = 'saved'
WHERE memo_status = 'draft';

-- If memo_status is ENUM('draft','saved','closed'), optionally narrow the enum (uncomment after verifying no draft rows remain):
-- ALTER TABLE aleco_service_memos
--   MODIFY COLUMN memo_status ENUM('saved', 'closed') NOT NULL DEFAULT 'saved';
