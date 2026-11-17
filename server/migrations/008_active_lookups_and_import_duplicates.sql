ALTER TABLE regions
  ADD COLUMN active boolean NOT NULL DEFAULT true;

ALTER TABLE age_groups
  ADD COLUMN active boolean NOT NULL DEFAULT true;

ALTER TABLE import_batches
  ADD COLUMN duplicate_count integer NOT NULL DEFAULT 0 CHECK (duplicate_count >= 0);
