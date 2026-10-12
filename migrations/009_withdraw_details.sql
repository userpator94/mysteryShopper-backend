-- Реквизиты исполнителя для вывода Рэшек на банковский счёт (один набор на пользователя).

CREATE TABLE IF NOT EXISTS withdraw_details (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  method VARCHAR(20) NOT NULL DEFAULT 'bank_account'
    CHECK (method IN ('bank_account', 'phone', 'card')),
  last_name VARCHAR(100) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100),
  account_number VARCHAR(20),
  bik VARCHAR(9),
  bank_name VARCHAR(200),
  phone VARCHAR(20),
  card_number VARCHAR(16),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT withdraw_details_account_number_digits CHECK (
    account_number IS NULL OR account_number ~ '^[0-9]{20}$'
  ),
  CONSTRAINT withdraw_details_bik_digits CHECK (
    bik IS NULL OR bik ~ '^[0-9]{9}$'
  )
);

COMMENT ON TABLE withdraw_details IS
  'Сохранённые реквизиты исполнителя для обналичивания Рэшек';
COMMENT ON COLUMN withdraw_details.method IS 'Способ вывода: bank_account | phone | card';
COMMENT ON COLUMN withdraw_details.last_name IS 'Фамилия получателя';
COMMENT ON COLUMN withdraw_details.first_name IS 'Имя получателя';
COMMENT ON COLUMN withdraw_details.middle_name IS 'Отчество получателя (опционально)';
COMMENT ON COLUMN withdraw_details.account_number IS 'Номер расчётного счёта (20 цифр); для bank_account';
COMMENT ON COLUMN withdraw_details.bik IS 'БИК банка (9 цифр); для bank_account';
COMMENT ON COLUMN withdraw_details.bank_name IS 'Название банка (обязательно для phone)';
COMMENT ON COLUMN withdraw_details.phone IS 'Телефон для перевода; для phone';
COMMENT ON COLUMN withdraw_details.card_number IS 'Номер карты; для card';
