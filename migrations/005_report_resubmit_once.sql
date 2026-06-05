-- Одна доработка отчёта после отклонения заказчиком
ALTER TABLE offer_reports
  ADD COLUMN IF NOT EXISTS resubmit_used BOOLEAN NOT NULL DEFAULT FALSE;
