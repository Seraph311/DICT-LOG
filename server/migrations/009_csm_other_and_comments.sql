ALTER TABLE csm_responses
  ADD COLUMN IF NOT EXISTS age_other text,
  ADD COLUMN IF NOT EXISTS gender_other text,
  ADD COLUMN IF NOT EXISTS comment text;

INSERT INTO age_groups (label, sort_order)
VALUES ('Other', 5)
ON CONFLICT (label) DO UPDATE SET sort_order = EXCLUDED.sort_order;

UPDATE csm_responses
SET gender_other = 'Not specified (legacy)'
WHERE gender = 'Other'
  AND (gender_other IS NULL OR btrim(gender_other) = '');

UPDATE csm_responses
SET age_other = 'Not specified (legacy)'
WHERE age_group = 'Other'
  AND (age_other IS NULL OR btrim(age_other) = '');

ALTER TABLE csm_responses
  ADD CONSTRAINT csm_responses_age_other_check
    CHECK (
      (age_group = 'Other' AND age_other IS NOT NULL AND btrim(age_other) <> '' AND length(age_other) <= 30)
      OR (age_group <> 'Other' AND age_other IS NULL)
    ),
  ADD CONSTRAINT csm_responses_gender_other_check
    CHECK (
      (gender = 'Other' AND gender_other IS NOT NULL AND btrim(gender_other) <> '' AND length(gender_other) <= 50)
      OR (gender <> 'Other' AND gender_other IS NULL)
    ),
  ADD CONSTRAINT csm_responses_comment_check
    CHECK (comment IS NULL OR length(comment) <= 1000);
