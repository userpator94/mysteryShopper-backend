import { Router } from 'express';
import { applyToOffer } from '../controllers/applyController';
import { authenticateJWT } from '../middleware/authMiddleware';
import { applyValidation } from '../utils/validators';
import { handleValidationErrors } from '../middleware/validationHandler';

const router = Router();

// Применяем middleware для проверки JWT токена ко всем маршрутам
router.use(authenticateJWT);

// POST /api/apply - подать заявку на предложение
router.post(
  '/',
  applyValidation,
  handleValidationErrors,
  applyToOffer
);

export default router;

