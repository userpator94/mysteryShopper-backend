-- Фаза 1: Роли и таблица employers (связь user_id)
-- Добавляем роль в users, если колонки ещё нет
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
  ) THEN
    ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'user';
    COMMENT ON COLUMN users.role IS 'user = исполнитель (тайный покупатель), employer = заказчик';
  END IF;
END $$;

-- Таблица employers: связь с users по user_id (если таблица уже есть — добавляем недостающие колонки)
CREATE TABLE IF NOT EXISTS employers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company VARCHAR(255) NOT NULL,
  description TEXT,
  website VARCHAR(500),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Индекс для быстрого поиска employer по user_id
CREATE INDEX IF NOT EXISTS idx_employers_user_id ON employers(user_id);

-- Если в employers уже были колонки name/surname — можно оставить для обратной совместимости
-- или мигрировать данные из users и удалить. Здесь предполагаем структуру: user_id, company, description, website.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employers' AND column_name = 'user_id'
  ) AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employers') THEN
    -- Если таблица employers уже есть без user_id — добавляем колонку (нужно заполнить вручную или отдельным скриптом)
    ALTER TABLE employers ADD COLUMN user_id UUID REFERENCES users(id);
  END IF;
END $$;
