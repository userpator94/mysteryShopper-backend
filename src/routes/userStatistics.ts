import { Router } from 'express';
import { getUserStatistics } from '../controllers/userStatisticsController';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = Router();

// Применяем middleware для проверки JWT токена ко всем маршрутам
router.use(authenticateJWT);

// POST /api/user/stats - получить статистику пользователя (POST для защиты личных данных)
router.post('/', getUserStatistics);

export default router;
