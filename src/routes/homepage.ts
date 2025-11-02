import { Router } from 'express';
import { getBanner, getOffers, getOfferById, getPromoOffers, getAuthorById, getImageById } from '../controllers/homepageController';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = Router();

// Direct API routes (without homepage prefix)
// Публичные эндпоинты (не требуют аутентификации)
router.get('/banner', getBanner);
router.get('/offers', getOffers); // Список предложений - публичный
router.get('/promo-offers', getPromoOffers);
router.get('/authors/:id', getAuthorById);
router.get('/images/:id', getImageById);

// Защищенный эндпоинт (требует JWT токен)
router.get('/offers/:id', authenticateJWT, getOfferById);

export default router;
