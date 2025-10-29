import { Router } from 'express';
import { getUserStatistics } from '../controllers/userStatisticsController';
import { validateUserId } from '../middleware/userIdValidator';

const router = Router();

// Применяем middleware для валидации X-User-Id ко всем маршрутам
router.use(validateUserId);

// POST /api/user/stats - получить статистику пользователя (POST для защиты личных данных)
router.post('/', getUserStatistics);

export default router;
