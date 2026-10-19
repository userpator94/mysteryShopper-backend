-- Статус заявки «срок истёк»: задача взята в работу, отчёта нет, календарный день end_date прошёл.
ALTER TABLE offer_applications DROP CONSTRAINT IF EXISTS offer_applications_status_check;

ALTER TABLE offer_applications
  ADD CONSTRAINT offer_applications_status_check
  CHECK (status::text = ANY (ARRAY[
    'pending',
    'approved',
    'rejected',
    'in_progress',
    'completed',
    'cancelled',
    'expired'
  ]::text[]));

UPDATE offer_applications oa
SET status = 'expired'
FROM offers o
WHERE oa.offer_id = o.id
  AND oa.status IN ('approved', 'in_progress')
  AND NOT EXISTS (
    SELECT 1 FROM offer_reports r WHERE r.application_id = oa.id
  )
  AND o.end_date::date < CURRENT_DATE;

UPDATE offers o
SET current_participants = (
  SELECT COUNT(*)
  FROM offer_applications oa
  WHERE oa.offer_id = o.id
    AND oa.status IN ('approved', 'in_progress', 'completed')
)
WHERE o.end_date::date < CURRENT_DATE;
