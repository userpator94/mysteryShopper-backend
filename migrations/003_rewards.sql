-- Фаза 3: Вознаграждения (начисления бонусов исполнителю)
-- ВАЖНО: мы не храним и не контролируем списания у партнёров; только начисления.

CREATE TABLE IF NOT EXISTS rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offer_id UUID REFERENCES offers(id) ON DELETE SET NULL,
  application_id UUID REFERENCES offer_applications(id) ON DELETE SET NULL,
  report_id UUID REFERENCES offer_reports(id) ON DELETE SET NULL,

  -- bonus | yandex_plus_points | other (на будущее)
  kind VARCHAR(50) NOT NULL DEFAULT 'bonus',

  -- сумма начисления в бонусах (1 бонус = 1 рубль)
  amount INTEGER NOT NULL CHECK (amount >= 0),

  -- pending | approved | cancelled (пока считаем auto-approved при создании отчёта)
  status VARCHAR(30) NOT NULL DEFAULT 'approved',

  description TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Один отчёт не должен начисляться дважды
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rewards_report_id_key'
  ) THEN
    ALTER TABLE rewards ADD CONSTRAINT rewards_report_id_key UNIQUE (report_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rewards_user_created_at ON rewards(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rewards_user_status ON rewards(user_id, status);

