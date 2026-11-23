ALTER TABLE csm_responses
  DROP CONSTRAINT IF EXISTS csm_responses_email_check;

ALTER TABLE csm_responses
  DROP COLUMN IF EXISTS email;
