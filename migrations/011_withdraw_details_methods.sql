-- Типы реквизитов: банковский счёт | телефон (+ банк) | номер карты

ALTER TABLE withdraw_details
  ADD COLUMN IF NOT EXISTS method VARCHAR(20) NOT NULL DEFAULT 'bank_account',
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS card_number VARCHAR(16);

ALTER TABLE withdraw_details
  ALTER COLUMN account_number DROP NOT NULL,
  ALTER COLUMN bik DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'withdraw_details_method_check'
  ) THEN
    ALTER TABLE withdraw_details
      ADD CONSTRAINT withdraw_details_method_check
      CHECK (method IN ('bank_account', 'phone', 'card'));
  END IF;
END $$;

COMMENT ON COLUMN withdraw_details.method IS
  'Способ вывода: bank_account | phone | card';
COMMENT ON COLUMN withdraw_details.phone IS
  'Телефон для перевода (11 цифр, 7…); для method=phone';
COMMENT ON COLUMN withdraw_details.card_number IS
  'Номер карты (16 цифр); для method=card';
