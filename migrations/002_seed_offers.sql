-- Сид: один заказчик (user + employer) и несколько офферов.
-- Пароль пользователя: password (bcrypt hash)
-- Можно выполнить повторно: user и employer по id не дублируются (ON CONFLICT (id) DO NOTHING).

-- 1. Пользователь-заказчик
INSERT INTO users (id, email, password_hash, phone, name, surname, is_active, role, created_at, updated_at)
VALUES (
  'a0000001-0000-4000-8000-000000000001',
  'employer-seed@example.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  '+79001234567',
  'Иван',
  'Заказчиков',
  TRUE,
  'employer',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- 2. Заказчик в employers
INSERT INTO employers (id, user_id, company, description, website, is_active, created_at, updated_at)
VALUES (
  'b0000001-0000-4000-8000-000000000001',
  'a0000001-0000-4000-8000-000000000001',
  'ООО Сид Компани',
  'Компания для сидовых данных',
  'https://seed.example.com',
  TRUE,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- 3. Офферы (employer_id = сидовый заказчик)
INSERT INTO offers (employer_id, title, description, price, location, requirements, tags, start_date, end_date, max_participants, current_participants, is_promo, image_id, numeric_info, is_active, created_at, updated_at)
VALUES
  (
    'b0000001-0000-4000-8000-000000000001',
    'Тайный покупатель в кофейне',
    'Нужно посетить кофейню, сделать заказ и оценить качество обслуживания и напитков. Заполнить короткий чек-лист.',
    1500,
    'Москва, ул. Примерная, 1',
    'Смартфон с фото, 30–40 минут',
    '["кофе", "тайный покупатель", "Москва"]'::jsonb,
    NOW() + INTERVAL '1 day',
    NOW() + INTERVAL '7 days',
    5,
    0,
    FALSE,
    NULL,
    1500,
    TRUE,
    NOW(),
    NOW()
  ),
  (
    'b0000001-0000-4000-8000-000000000001',
    'Проверка аптеки',
    'Визит в аптеку: проверить наличие препаратов, время обслуживания, вежливость персонала. Отчёт в приложении.',
    2000,
    'Санкт-Петербург, Невский пр., 10',
    'Чек-лист будет выдан после одобрения заявки',
    '["аптека", "тайный покупатель", "СПб"]'::jsonb,
    NOW() + INTERVAL '2 days',
    NOW() + INTERVAL '14 days',
    3,
    0,
    TRUE,
    NULL,
    2000,
    TRUE,
    NOW(),
    NOW()
  ),
  (
    'b0000001-0000-4000-8000-000000000001',
    'Оценка ресторана быстрого питания',
    'Посещение ресторана: заказ по меню, оценка скорости, чистоты зала и качества блюд. Фото чека и заполненная форма.',
    1200,
    'Казань, ул. Баумана, 5',
    'Возраст 18+',
    '["ресторан", "фастфуд", "тайный покупатель"]'::jsonb,
    NOW() + INTERVAL '3 days',
    NOW() + INTERVAL '10 days',
    10,
    0,
    FALSE,
    NULL,
    1200,
    TRUE,
    NOW(),
    NOW()
  ),
  (
    'b0000001-0000-4000-8000-000000000001',
    'Проверка банковского офиса',
    'Визит в отделение банка: открытие счёта или консультация. Оценить очередь, время ожидания, работу сотрудников.',
    3500,
    'Новосибирск, Красный пр., 20',
    'Паспорт, 1–2 часа в рабочее время',
    '["банк", "тайный покупатель", "Новосибирск"]'::jsonb,
    NOW() + INTERVAL '5 days',
    NOW() + INTERVAL '21 days',
    2,
    0,
    FALSE,
    NULL,
    3500,
    TRUE,
    NOW(),
    NOW()
  ),
  (
    'b0000001-0000-4000-8000-000000000001',
    'Аудит розничного магазина',
    'Обход магазина: наличие ценников, порядок на полках, приветствие на входе. Фото и короткий отчёт.',
    800,
    'Екатеринбург, ул. Ленина, 50',
    'Ненавязчивое поведение, не привлекать внимание персонала',
    '["ритейл", "магазин", "тайный покупатель"]'::jsonb,
    NOW() + INTERVAL '1 day',
    NOW() + INTERVAL '5 days',
    8,
    0,
    FALSE,
    NULL,
    800,
    TRUE,
    NOW(),
    NOW()
  );
