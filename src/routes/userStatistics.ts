import { Router } from 'express';
import { getUserStatistics } from '../controllers/userStatisticsController';
import { validateUserId } from '../middleware/userIdValidator';

const router = Router();

// Применяем middleware для валидации X-User-Id ко всем маршрутам
router.use(validateUserId);

// GET /api/user-statistics - получить статистику пользователя
router.get('/', getUserStatistics);

export default router;
