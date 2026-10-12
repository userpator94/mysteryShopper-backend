-- Назначить роль admin существующему пользователю (signup admin запрещён).
-- Подставьте email аккаунта с рабочим password_hash.
--
-- Вход в панель: POST /api/admin/login и UI на скрытом префиксе фронта
-- (см. ADMIN_BASE в mysteryShopper/src/utils/adminPaths.ts).

BEGIN;

UPDATE users
SET role = 'admin',
    updated_at = NOW()
WHERE email = 'YOUR_ADMIN_EMAIL@example.com'
  AND password_hash IS NOT NULL;

-- Проверка:
-- SELECT id, email, role, is_active, email_verified FROM users WHERE role = 'admin';

COMMIT;
