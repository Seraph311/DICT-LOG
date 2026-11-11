CREATE TABLE visitor_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visit_date date NOT NULL DEFAULT CURRENT_DATE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  gender text NOT NULL CHECK (gender IN ('Male', 'Female', 'Others')),
  purpose text NOT NULL REFERENCES purposes(name) ON UPDATE CASCADE,
  purpose_other text CHECK (
    purpose_other IS NULL OR length(btrim(purpose_other)) BETWEEN 1 AND 120
  ),
  contact_number text NOT NULL CHECK (
    contact_number ~ '^(09[0-9]{9}|\+639[0-9]{9})$'
  ),
  created_by integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  voided boolean NOT NULL DEFAULT false,
  CONSTRAINT visitor_logs_purpose_other_required CHECK (
    (purpose = 'Others' AND purpose_other IS NOT NULL)
    OR (purpose <> 'Others' AND purpose_other IS NULL)
  )
);

CREATE INDEX visitor_logs_visit_date_idx ON visitor_logs (visit_date);
CREATE INDEX visitor_logs_purpose_idx ON visitor_logs (purpose);
CREATE INDEX visitor_logs_voided_visit_date_idx ON visitor_logs (voided, visit_date);
CREATE INDEX visitor_logs_name_lower_idx ON visitor_logs (lower(name));
