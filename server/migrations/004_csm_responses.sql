-- CSM responses are anonymous and have no link to visitor_logs.

CREATE TABLE csm_responses (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  response_date date NOT NULL DEFAULT CURRENT_DATE,
  email text NOT NULL CHECK (
    length(email) <= 254
    AND email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  age_group text NOT NULL REFERENCES age_groups(label) ON UPDATE CASCADE,
  sex text NOT NULL CHECK (sex IN ('Male', 'Female', 'Prefer not to say')),
  gender text NOT NULL CHECK (
    gender IN ('Masculine', 'Feminine', 'Non-Binary', 'Prefer Not to Say', 'Other')
  ),
  region text NOT NULL REFERENCES regions(name) ON UPDATE CASCADE,
  service_type text NOT NULL CHECK (
    service_type IN ('External/Serbisyong Panlabas', 'Internal/Serbisyong Panloob')
  ),
  office text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT csm_responses_office_check FOREIGN KEY (office, service_type)
    REFERENCES offices (name, service_type) ON UPDATE CASCADE
);

CREATE INDEX csm_responses_response_date_idx ON csm_responses (response_date);
CREATE INDEX csm_responses_office_idx ON csm_responses (office);
