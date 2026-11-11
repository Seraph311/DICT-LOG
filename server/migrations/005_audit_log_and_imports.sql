CREATE TABLE audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id integer REFERENCES users(id),
  action text NOT NULL CHECK (action IN ('create', 'edit', 'void', 'import', 'export')),
  entity text NOT NULL,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_created_at_idx ON audit_log (created_at DESC);
CREATE INDEX audit_log_actor_idx ON audit_log (actor_id);

CREATE TABLE import_batches (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  filename text NOT NULL,
  uploaded_by integer NOT NULL REFERENCES users(id),
  row_count integer NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  success_count integer NOT NULL DEFAULT 0 CHECK (success_count >= 0),
  error_count integer NOT NULL DEFAULT 0 CHECK (error_count >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX import_batches_created_at_idx ON import_batches (created_at DESC);
