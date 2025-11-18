import { Router } from 'express';
import { getApplies } from '../controllers/applyController';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = Router();

// Применяем middleware для проверки JWT токена
router.use(authenticateJWT);

// GET /api/applies - получить список заявок пользователя
// GET /api/applies?offer_id=xxx - получить заявку по конкретному предложению
router.get('/', getApplies);

export default router;

