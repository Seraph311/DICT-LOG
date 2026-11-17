ALTER TABLE visitor_logs
  ALTER COLUMN created_by DROP NOT NULL,
  ADD COLUMN source text NOT NULL DEFAULT 'staff',
  ADD CONSTRAINT visitor_logs_source_check CHECK (source IN ('public', 'staff'));

ALTER TABLE audit_log
  ALTER COLUMN actor_id DROP NOT NULL;
