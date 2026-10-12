-- ФИО получателя: фамилия, имя, отчество (отчество опционально)

ALTER TABLE withdraw_details
  ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100);

-- Перенос из старого единого поля (если уже успели сохранить)
UPDATE withdraw_details
SET
  last_name = COALESCE(NULLIF(trim(split_part(recipient_name, ' ', 1)), ''), '—'),
  first_name = COALESCE(
    NULLIF(trim(CASE
      WHEN array_length(regexp_split_to_array(trim(recipient_name), '\s+'), 1) >= 2
        THEN (regexp_split_to_array(trim(recipient_name), '\s+'))[2]
      ELSE NULL
    END), ''),
    '—'
  ),
  middle_name = NULLIF(trim(CASE
    WHEN array_length(regexp_split_to_array(trim(recipient_name), '\s+'), 1) >= 3
      THEN array_to_string((regexp_split_to_array(trim(recipient_name), '\s+'))[3:], ' ')
    ELSE NULL
  END), '')
WHERE last_name IS NULL OR first_name IS NULL;

ALTER TABLE withdraw_details
  ALTER COLUMN last_name SET NOT NULL,
  ALTER COLUMN first_name SET NOT NULL;

ALTER TABLE withdraw_details
  DROP COLUMN IF EXISTS recipient_name;

COMMENT ON COLUMN withdraw_details.last_name IS 'Фамилия получателя';
COMMENT ON COLUMN withdraw_details.first_name IS 'Имя получателя';
COMMENT ON COLUMN withdraw_details.middle_name IS 'Отчество получателя (опционально)';
