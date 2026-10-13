-- Фиксация принятия оферты при регистрации
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS offer_accepted_at timestamptz NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS offer_version varchar(32) NULL;
