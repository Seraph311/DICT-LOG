-- Lookup lists shared by visitor logs and CSM responses.

CREATE TABLE purposes (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE,
  is_other boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE offices (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  service_type text NOT NULL CHECK (
    service_type IN ('External/Serbisyong Panlabas', 'Internal/Serbisyong Panloob')
  ),
  active boolean NOT NULL DEFAULT true,
  UNIQUE (name, service_type)
);

CREATE TABLE regions (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE age_groups (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  label text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0
);
