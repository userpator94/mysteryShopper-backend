import { Router } from 'express';
import { getFavorites, addFavorite, removeFavorite } from '../controllers/favoritesController';
import { validateUserId } from '../middleware/userIdValidator';

const router = Router();

// Применяем middleware для валидации X-User-Id ко всем маршрутам
router.use(validateUserId);

// GET /api/favorites - получить список избранных предложений
router.get('/', getFavorites);

// POST /api/favorites - добавить предложение в избранное
router.post('/', addFavorite);

// DELETE /api/favorites/:offerId - удалить предложение из избранного
router.delete('/:offerId', removeFavorite);

export default router;
