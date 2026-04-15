import { Router } from 'express';
import { getBanner, getOffers, getOfferById, getPromoOffers, getAuthorById, getImageById } from '../controllers/homepageController';
import { authenticateJWT, authenticateJWTOptional } from '../middleware/authMiddleware';

const router = Router();

// Direct API routes (without homepage prefix)
// Публичные эндпоинты (не требуют аутентификации)
router.get('/banner', getBanner);
// Список предложений — публичный, но может учитывать userId если токен передан
router.get('/offers', authenticateJWTOptional, getOffers);
router.get('/promo-offers', getPromoOffers);
router.get('/authors/:id', getAuthorById);
router.get('/images/:id', getImageById);

// Защищенный эндпоинт (требует JWT токен)
router.get('/offers/:id', authenticateJWT, getOfferById);

export default router;
