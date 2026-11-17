ALTER TABLE visitor_logs DROP CONSTRAINT visitor_logs_source_check;
ALTER TABLE visitor_logs
  ADD CONSTRAINT visitor_logs_source_check CHECK (source IN ('public', 'staff', 'import'));
