-- Модерация отчёта заказчиком: комментарий при отказе
ALTER TABLE offer_reports ADD COLUMN IF NOT EXISTS employer_review_comment TEXT;

-- Решение заказчика по заявке (отклонение с пояснением)
ALTER TABLE offer_applications ADD COLUMN IF NOT EXISTS employer_decision_comment TEXT;
