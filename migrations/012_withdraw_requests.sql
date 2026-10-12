-- Заявки на вывод Рэшек (снимок реквизитов на момент заявки)

CREATE TABLE IF NOT EXISTS withdraw_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  -- pending | processing | paid | rejected | cancelled
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  method VARCHAR(20) NOT NULL CHECK (method IN ('bank_account', 'phone', 'card')),
  last_name VARCHAR(100) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100),
  account_number VARCHAR(20),
  bik VARCHAR(9),
  bank_name VARCHAR(200),
  phone VARCHAR(20),
  card_number VARCHAR(16),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdraw_requests_user_created
  ON withdraw_requests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_withdraw_requests_user_status
  ON withdraw_requests (user_id, status);

COMMENT ON TABLE withdraw_requests IS
  'Заявки исполнителя на вывод Рэшек; реквизиты копируются из withdraw_details';
