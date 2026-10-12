-- Опциональная пометка заказчика к адресу места выполнения (как пройти / уточнение)
ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS location_note character varying(300) DEFAULT NULL;

COMMENT ON COLUMN offers.location_note IS
  'Короткий текст (до 300 символов) с деталями к адресу; только при указанном location';
