CREATE TABLE users (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username text NOT NULL UNIQUE CHECK (username = lower(username)),
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('front_desk', 'reviewer', 'administrator')),
  password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
